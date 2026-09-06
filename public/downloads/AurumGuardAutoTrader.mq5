//+------------------------------------------------------------------+
//|                                      AurumGuardAutoTrader.mq5    |
//|   POC sweep-return entries + M15 safety + capped money risk     |
//|   Educational automation. Demo-only by default.                  |
//+------------------------------------------------------------------+
#property copyright "Aurum Guard"
#property version   "1.90"
#property strict
#property description "Aurum Guard POC sequence EA: consolidation, liquidity sweep, displacement, POC return and 2.14R target. Demo-safe by default."

#include <Trade/Trade.mqh>

CTrade trade;

// --- Account and execution safety
input bool   AllowLiveTrading              = false;
input bool   EnableNewEntries              = true;  // Demo/tester entries enabled; real accounts remain locked below
input ulong  MagicNumber                   = 26090315;
input double StopLossMoney                 = 2.00;  // Hard maximum account-currency risk at fixed 0.01 lot
input ulong  DeviationPoints               = 30;
input double MaxSpreadAsATR                = 0.08;

const double FIXED_LOTS                    = 0.01;

// --- Local AI approval layer (Python scores; this EA keeps execution and risk control)
input bool   UseAIApprovalGate             = true;
input bool   AIShadowMode                  = true;  // observe decisions without blocking or approving orders
input string AIApprovalFile                = "aurum_guard_ai_signal.csv";
input double MinimumAIApprovalProbability  = 0.525; // calibrated for the protected-outcome model; not a claimed win rate
input int    MaximumAISignalAgeSeconds      = 180;
input bool   AIRequireMatchingSymbol       = true;

// --- Symbols and timeframes
input string TradeSymbol                   = "";       // Blank uses the chart symbol
input string SilverConfirmationSymbol      = "XAGUSD"; // Use your broker's exact symbol
input ENUM_TIMEFRAMES SignalTimeframe       = PERIOD_M15; // POC sequence is designed for M15-M30-H1, never M1
input ENUM_TIMEFRAMES SafetyTimeframe       = PERIOD_H1;
input ENUM_TIMEFRAMES TrendTimeframe        = PERIOD_H4;
input bool   RequireGoldSilverSync          = true;
input int    SyncLookbackBars               = 5;
input int    SyncCorrelationLength          = 20;
input double MinimumMetalCorrelation        = 0.25;

// --- Precision entry (H1 default; M1 can be selected for demo tests)
input int    FastEMAPeriod                  = 20;
input int    SlowEMAPeriod                  = 50;
input int    RSIPeriod                      = 14;
input int    ATRPeriod                      = 14;
input double PullbackBufferATR              = 0.35;
input double MaximumEntryDistanceATR        = 0.75;
input bool   RequireSafetyTrendAlignment     = true; // M1 entries must agree with the M15 20/50 EMA trend
input bool   RequireTrendTimeframeAlignment  = true; // M1 entries must agree with the H1 20/50 EMA trend
input bool   RequireDailyEMASlope             = true; // avoid buying while the daily trend is weakening
input int    ADXPeriod                        = 14;
input double MinimumSafetyADX                 = 20.0; // require directional strength on the M15 safety chart
input double MaximumSignalRangeATR            = 1.25; // reject oversized entry candles
input double MinimumEntryBodyShare            = 0.40; // reject indecision candles
input double MinimumStopDistanceATR            = 0.35; // refuse stops that normal noise can reach too easily
input int    MinimumSetupScore                 = 85;   // confluence gate, not a guaranteed probability
input bool   RequireTwoBarConfirmation         = true; // reduced trade count/drawdown in testing, but did not prove a profitable edge
input bool   UseConfirmationRetestEntry         = true; // wait for a better price instead of chasing the confirmation close
input double ConfirmationRetestFraction         = 0.75; // 0=open, 1=close; a shallow pullback avoids chasing without demanding a full reversal
input int    ConfirmationRetestBars             = 3;    // cancel an unfilled idea after this many signal bars
input bool   RequireDefendedRetestClose          = true; // a touch is not an entry; require a completed reclaim candle
input int    RetestDefenseBars                   = 2;    // completed candles allowed to prove the retest was defended
input double MinimumDefenseBodyShare             = 0.35; // reject weak/indecisive reclaim candles
input bool   EnableLongEntries               = true;
input bool   EnableShortEntries              = true;

// --- Consolidation -> sweep -> displacement -> POC return
// MT5 POC is approximated from typical price weighted by broker tick volume.
input bool   UsePOCSweepSequence              = true;
input int    ConsolidationLookbackBars        = 36;
input int    VolumeProfileBins                = 24;
input double ConsolidationMaximumRangeATR     = 3.50;
input double SweepBufferATR                   = 0.08;
input double DisplacementFromPOCATR           = 0.60;
input double POCReturnToleranceATR            = 0.18;
input double StructureStopBufferATR           = 0.12;
input int    POCSetupExpiryBars               = 18;
input double FibonacciRewardMultiple          = 2.14;

// --- M15 manipulation, blow-off and shock guard
input bool   EnableM15Safety                = true;
input int    LiquidityLookback              = 12;
input double ManipulationMinimumWickShare   = 0.45;
input double BlowOffRangeATR                = 2.20;
input double BlowOffDistanceATR             = 2.00;
input int    BlowOffVolumeWindow            = 20;
input double BlowOffVolumeMultiple          = 1.80;
input bool   RequireBlowOffVolume            = true;
input double ShockRangeATR                  = 2.00;
input double ShockGapATR                    = 0.75;
input int    SafetyPauseBars                = 3;
input bool   EnableTerminalAlerts           = true;

// --- Built-in MT5 economic calendar guard
input bool   UseUSDHighImpactNewsFilter      = true;
input int    NewsMinutesBefore              = 30;
input int    NewsMinutesAfter               = 20;
input bool   FailClosedWhenCalendarUnavailable = true;

// --- Position management
input bool   TakePartialAtTP1                = false; // 0.01 lot cannot usually be split safely
input bool   TakePartialAtTP2                = false; // keep the minimum-size position intact
input double TP1ClosePercent                = 33.0;
input double TP2ClosePercent                = 33.0;
input bool   MoveStopToBreakEvenAtTP1        = true;
input int    BreakEvenOffsetPoints           = 5;
input bool   LockOneRAtTP2                   = true;  // protect about one planned SL of profit
input bool   EnableEarlyProfitProtection      = true;  // one-way stop tightening; never widens risk
input double BreakEvenTriggerMoney            = 2.00;
input double ProfitLockTriggerMoney           = 3.00;
input double ProfitLockMoney                  = 1.00;
input double TrailingTriggerMoney             = 4.00;
input double TrailingGivebackMoney            = 1.20;

string   g_symbol = "";
datetime g_lastSignalBar = 0;
datetime g_lastSafetyBar = 0;
datetime g_safetyPauseUntil = 0;
datetime g_lastManageAttempt = 0;
string   g_safetyStatus = "CLEAR";
string   g_lastDecision = "WAITING FOR SIGNAL CLOSE";
int      g_lastSetupScore = 0;
bool     g_pendingEntry = false;
int      g_pendingDirection = 0;
double   g_pendingPrice = 0.0;
double   g_pendingInvalidation = 0.0;
double   g_pendingATR = 0.0;
datetime g_pendingExpires = 0;
bool     g_pendingTouched = false;
datetime g_pendingTouchBar = 0;
datetime g_pendingLastCheckedBar = 0;
string   g_aiStatus = "SHADOW - WAITING FOR SCORE";
double   g_aiProbability = 0.0;
string   g_aiModel = "NONE";
int      g_pocStage = 0; // 0=find range, 1=wait sweep, 2=wait displacement, 3=wait POC return
int      g_pocDirection = 0;
double   g_pocPrice = 0.0;
double   g_pocRangeHigh = 0.0;
double   g_pocRangeLow = 0.0;
double   g_pocSweepExtreme = 0.0;
double   g_signalStopPrice = 0.0;
datetime g_pocExpires = 0;

int g_fastHandle = INVALID_HANDLE;
int g_slowHandle = INVALID_HANDLE;
int g_rsiHandle = INVALID_HANDLE;
int g_atrHandle = INVALID_HANDLE;
int g_dailyEMAHandle = INVALID_HANDLE;
int g_safetyFastHandle = INVALID_HANDLE;
int g_safetySlowHandle = INVALID_HANDLE;
int g_safetyATRHandle = INVALID_HANDLE;
int g_safetyADXHandle = INVALID_HANDLE;
int g_trendFastHandle = INVALID_HANDLE;
int g_trendSlowHandle = INVALID_HANDLE;

//+------------------------------------------------------------------+
//| Helpers                                                          |
//+------------------------------------------------------------------+
string StateKey(const string suffix)
  {
   return "AG_"+(string)MagicNumber+"_"+g_symbol+"_"+suffix;
  }

void SaveState(const string suffix,const double value)
  {
   GlobalVariableSet(StateKey(suffix),value);
  }

double LoadState(const string suffix,const double fallback)
  {
   string key=StateKey(suffix);
   return GlobalVariableCheck(key) ? GlobalVariableGet(key) : fallback;
  }

void ClearPositionState()
  {
   string keys[];
   ArrayResize(keys,4);
   keys[0]=StateKey("RISK");
   keys[1]=StateKey("INITIAL_VOLUME");
   keys[2]=StateKey("TP1_DONE");
   keys[3]=StateKey("TP2_DONE");
   for(int i=0;i<ArraySize(keys);i++)
      if(GlobalVariableCheck(keys[i]))
         GlobalVariableDel(keys[i]);
  }

bool TradeResultAccepted()
  {
   uint code=trade.ResultRetcode();
   return code==TRADE_RETCODE_DONE || code==TRADE_RETCODE_DONE_PARTIAL || code==TRADE_RETCODE_PLACED;
  }

int VolumeDigits(const double step)
  {
   int digits=0;
   double scaled=step;
   while(digits<8 && MathAbs(scaled-MathRound(scaled))>1e-8)
     {
      scaled*=10.0;
      digits++;
     }
   return digits;
  }

double NormalizeVolume(const double requested,const bool enforceMinimum=true)
  {
   double minimum=SymbolInfoDouble(g_symbol,SYMBOL_VOLUME_MIN);
   double maximum=SymbolInfoDouble(g_symbol,SYMBOL_VOLUME_MAX);
   double step=SymbolInfoDouble(g_symbol,SYMBOL_VOLUME_STEP);
   if(step<=0.0 || maximum<=0.0)
      return 0.0;

   double normalized=MathFloor(requested/step+1e-9)*step;
   if(enforceMinimum)
      normalized=MathMax(normalized,minimum);
   else if(normalized<minimum)
      return 0.0;
   normalized=MathMin(normalized,maximum);
   return NormalizeDouble(normalized,VolumeDigits(step));
  }

double FixedTradeVolume()
  {
   double minimum=SymbolInfoDouble(g_symbol,SYMBOL_VOLUME_MIN);
   double maximum=SymbolInfoDouble(g_symbol,SYMBOL_VOLUME_MAX);
   double step=SymbolInfoDouble(g_symbol,SYMBOL_VOLUME_STEP);
   if(step<=0.0 || FIXED_LOTS<minimum-1e-9 || FIXED_LOTS>maximum+1e-9)
      return 0.0;
   double steps=MathRound(FIXED_LOTS/step);
   double normalized=steps*step;
   if(MathAbs(normalized-FIXED_LOTS)>1e-9)
      return 0.0;
   return NormalizeDouble(normalized,VolumeDigits(step));
  }

double MoneyToPriceDistance(const int direction,const double entry,const double money,const double volume,const bool lossSide)
  {
   double tickSize=SymbolInfoDouble(g_symbol,SYMBOL_TRADE_TICK_SIZE);
   double point=SymbolInfoDouble(g_symbol,SYMBOL_POINT);
   double referenceDistance=MathMax(tickSize,point);
   if(money<=0.0 || volume<=0.0 || referenceDistance<=0.0 || entry<=0.0)
      return 0.0;

   ENUM_ORDER_TYPE orderType=direction>0 ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
   double closePrice=entry;
   if(lossSide)
      closePrice=direction>0 ? entry-referenceDistance : entry+referenceDistance;
   else
      closePrice=direction>0 ? entry+referenceDistance : entry-referenceDistance;

   double referenceMoney=0.0;
   ResetLastError();
   if(!OrderCalcProfit(orderType,g_symbol,volume,entry,closePrice,referenceMoney) || MathAbs(referenceMoney)<=1e-9)
      return 0.0;
   return referenceDistance*money/MathAbs(referenceMoney);
  }

double NormalizePrice(const double price)
  {
   int digits=(int)SymbolInfoInteger(g_symbol,SYMBOL_DIGITS);
   return NormalizeDouble(price,digits);
  }

bool ReadIndicatorBuffer(const int handle,const int bufferIndex,const int count,double &values[])
  {
   ArraySetAsSeries(values,true);
   return CopyBuffer(handle,bufferIndex,0,count,values)==count;
  }

bool ReadBuffer(const int handle,const int count,double &values[])
  {
   return ReadIndicatorBuffer(handle,0,count,values);
  }

bool ReadRates(const string symbol,const ENUM_TIMEFRAMES timeframe,const int count,MqlRates &rates[])
  {
   ArraySetAsSeries(rates,true);
   return CopyRates(symbol,timeframe,0,count,rates)==count;
  }

bool IsNewBar(const string symbol,const ENUM_TIMEFRAMES timeframe,datetime &lastBar)
  {
   datetime current=iTime(symbol,timeframe,0);
   if(current<=0 || current==lastBar)
      return false;
   lastBar=current;
   return true;
  }

bool FindOwnPosition(ulong &ticket)
  {
   ticket=0;
   for(int i=PositionsTotal()-1;i>=0;i--)
     {
      ulong candidate=PositionGetTicket(i);
      if(candidate==0 || !PositionSelectByTicket(candidate))
         continue;
      if(PositionGetString(POSITION_SYMBOL)==g_symbol && (ulong)PositionGetInteger(POSITION_MAGIC)==MagicNumber)
        {
         ticket=candidate;
         return true;
        }
     }
   return false;
  }

bool AnyPositionOnTradeSymbol()
  {
   for(int i=PositionsTotal()-1;i>=0;i--)
     {
      ulong ticket=PositionGetTicket(i);
      if(ticket>0 && PositionSelectByTicket(ticket) && PositionGetString(POSITION_SYMBOL)==g_symbol)
         return true;
     }
   return false;
  }

datetime BrokerDayStart()
  {
   MqlDateTime nowParts;
   TimeToStruct(TimeCurrent(),nowParts);
   nowParts.hour=0;
   nowParts.min=0;
   nowParts.sec=0;
   return StructToTime(nowParts);
  }

void GetDailyStats(double &dayPnL,int &entryCount,double &dayStartBalance)
  {
   dayPnL=0.0;
   entryCount=0;
   dayStartBalance=AccountInfoDouble(ACCOUNT_BALANCE);
   datetime start=BrokerDayStart();
   if(!HistorySelect(start,TimeCurrent()))
      return;

   double closedPnL=0.0;
   int total=HistoryDealsTotal();
   for(int i=0;i<total;i++)
     {
      ulong ticket=HistoryDealGetTicket(i);
      if(ticket==0)
         continue;
      if(HistoryDealGetString(ticket,DEAL_SYMBOL)!=g_symbol || (ulong)HistoryDealGetInteger(ticket,DEAL_MAGIC)!=MagicNumber)
         continue;

      ENUM_DEAL_ENTRY entry=(ENUM_DEAL_ENTRY)HistoryDealGetInteger(ticket,DEAL_ENTRY);
      if(entry==DEAL_ENTRY_IN)
         entryCount++;
      if(entry==DEAL_ENTRY_OUT || entry==DEAL_ENTRY_OUT_BY)
         closedPnL+=HistoryDealGetDouble(ticket,DEAL_PROFIT)+HistoryDealGetDouble(ticket,DEAL_SWAP)+HistoryDealGetDouble(ticket,DEAL_COMMISSION)+HistoryDealGetDouble(ticket,DEAL_FEE);
     }

   dayStartBalance=AccountInfoDouble(ACCOUNT_BALANCE)-closedPnL;
   dayPnL=closedPnL;
  }

bool IsUSDNewsBlocked(string &reason)
  {
   if(!UseUSDHighImpactNewsFilter || (bool)MQLInfoInteger(MQL_TESTER))
      return false;

   datetime now=TimeTradeServer();
   if(now<=0)
      now=TimeCurrent();
   MqlCalendarValue values[];
   ResetLastError();
   int count=CalendarValueHistory(values,now-NewsMinutesAfter*60,now+NewsMinutesBefore*60,NULL,"USD");
   if(count<0)
     {
      reason="USD CALENDAR UNAVAILABLE";
      return FailClosedWhenCalendarUnavailable;
     }

   for(int i=0;i<count;i++)
     {
      MqlCalendarEvent event;
      if(CalendarEventById(values[i].event_id,event) && event.importance==CALENDAR_IMPORTANCE_HIGH)
        {
         reason="HIGH-IMPACT USD NEWS: "+event.name;
         return true;
        }
     }
   return false;
  }

double PearsonCorrelation(const double &left[],const double &right[],const int count)
  {
   if(count<2)
      return 0.0;
   double leftMean=0.0,rightMean=0.0;
   for(int i=0;i<count;i++)
     {
      leftMean+=left[i];
      rightMean+=right[i];
     }
   leftMean/=count;
   rightMean/=count;

   double covariance=0.0,leftVariance=0.0,rightVariance=0.0;
   for(int i=0;i<count;i++)
     {
      double leftDelta=left[i]-leftMean;
      double rightDelta=right[i]-rightMean;
      covariance+=leftDelta*rightDelta;
      leftVariance+=leftDelta*leftDelta;
      rightVariance+=rightDelta*rightDelta;
     }
   if(leftVariance<=0.0 || rightVariance<=0.0)
      return 0.0;
   return covariance/MathSqrt(leftVariance*rightVariance);
  }

bool MetalsConfirmDirection(const int direction,string &reason,double &correlation)
  {
   correlation=1.0;
   if(!RequireGoldSilverSync)
      return true;

   int needed=SyncCorrelationLength+SyncLookbackBars+3;
   MqlRates gold[],silver[];
   if(!ReadRates(g_symbol,SignalTimeframe,needed,gold) || !ReadRates(SilverConfirmationSymbol,SignalTimeframe,needed,silver))
     {
      reason="GOLD/SILVER DATA NOT READY";
      return false;
     }

   double goldReturns[],silverReturns[];
   ArrayResize(goldReturns,SyncCorrelationLength);
   ArrayResize(silverReturns,SyncCorrelationLength);
   for(int i=0;i<SyncCorrelationLength;i++)
     {
      goldReturns[i]=gold[i+1].close-gold[i+2].close;
      silverReturns[i]=silver[i+1].close-silver[i+2].close;
     }
   correlation=PearsonCorrelation(goldReturns,silverReturns,SyncCorrelationLength);
   double goldMove=gold[1].close-gold[1+SyncLookbackBars].close;
   double silverMove=silver[1].close-silver[1+SyncLookbackBars].close;
   bool aligned=direction>0 ? goldMove>0.0 && silverMove>0.0 : goldMove<0.0 && silverMove<0.0;
   if(!aligned || correlation<MinimumMetalCorrelation)
     {
      reason=StringFormat("METALS NOT SYNCED (corr %.2f)",correlation);
      return false;
     }
   return true;
  }

//+------------------------------------------------------------------+
//| M15 safety                                                       |
//+------------------------------------------------------------------+
void EvaluateM15Safety()
  {
   if(!EnableM15Safety)
     {
      g_safetyStatus="OFF";
      return;
     }

   int needed=MathMax(LiquidityLookback+4,BlowOffVolumeWindow+4);
   MqlRates bars[];
   double fast[],slow[],atr[];
   if(!ReadRates(g_symbol,SafetyTimeframe,needed,bars) || !ReadBuffer(g_safetyFastHandle,4,fast) || !ReadBuffer(g_safetySlowHandle,4,slow) || !ReadBuffer(g_safetyATRHandle,4,atr))
     {
      g_safetyStatus="WAITING FOR M15 DATA";
      return;
     }

   MqlRates candle=bars[1];
   double point=SymbolInfoDouble(g_symbol,SYMBOL_POINT);
   double range=MathMax(candle.high-candle.low,point);
   double upperWick=candle.high-MathMax(candle.open,candle.close);
   double lowerWick=MathMin(candle.open,candle.close)-candle.low;
   double upperShare=upperWick/range;
   double lowerShare=lowerWick/range;
   double closeLocation=(candle.close-candle.low)/range;

   double priorHigh=bars[2].high;
   double priorLow=bars[2].low;
   for(int i=3;i<2+LiquidityLookback;i++)
     {
      priorHigh=MathMax(priorHigh,bars[i].high);
      priorLow=MathMin(priorLow,bars[i].low);
     }

   double averageVolume=0.0;
   for(int i=2;i<2+BlowOffVolumeWindow;i++)
      averageVolume+=(double)bars[i].tick_volume;
   averageVolume/=BlowOffVolumeWindow;
   bool volumeSpike=averageVolume>0.0 && (double)candle.tick_volume>=averageVolume*BlowOffVolumeMultiple;
   bool volumeOK=!RequireBlowOffVolume || volumeSpike;

   bool buySideSweep=candle.high>priorHigh && candle.close<priorHigh && upperShare>=ManipulationMinimumWickShare && closeLocation<=0.45;
   bool sellSideSweep=candle.low<priorLow && candle.close>priorLow && lowerShare>=ManipulationMinimumWickShare && closeLocation>=0.55;
   bool blowOffTop=candle.high-fast[1]>=atr[1]*BlowOffDistanceATR && range>=atr[1]*BlowOffRangeATR && upperShare>=0.30 && closeLocation<=0.55 && fast[1]>slow[1] && volumeOK;
   bool blowOffBottom=fast[1]-candle.low>=atr[1]*BlowOffDistanceATR && range>=atr[1]*BlowOffRangeATR && lowerShare>=0.30 && closeLocation>=0.45 && fast[1]<slow[1] && volumeOK;
   bool shock=range>=atr[1]*ShockRangeATR || MathAbs(candle.open-bars[2].close)>=atr[1]*ShockGapATR;

   string warning="";
   if(blowOffTop)
      warning="BLOW-OFF TOP - WAIT";
   else if(blowOffBottom)
      warning="BLOW-OFF BOTTOM - WAIT";
   else if(buySideSweep)
      warning="MANIPULATION - AVOID LONG";
   else if(sellSideSweep)
      warning="MANIPULATION - AVOID SHORT";
   else if(shock)
      warning="VOLATILITY SHOCK - WAIT";

   if(warning!="")
     {
      datetime currentSafetyOpen=iTime(g_symbol,SafetyTimeframe,0);
      g_safetyPauseUntil=currentSafetyOpen+SafetyPauseBars*PeriodSeconds(SafetyTimeframe);
      g_safetyStatus=warning;
      Print("Aurum Guard: ",warning,". New entries paused until ",TimeToString(g_safetyPauseUntil,TIME_DATE|TIME_MINUTES));
      if(EnableTerminalAlerts)
         Alert("Aurum Guard ",g_symbol,": ",warning,". No automatic reversal.");
     }
   else if(TimeCurrent()>=g_safetyPauseUntil)
      g_safetyStatus="CLEAR";
  }

bool SafetyAllowsEntry(string &reason)
  {
   if(EnableM15Safety && TimeCurrent()<g_safetyPauseUntil)
     {
      reason=g_safetyStatus;
      return false;
     }
   return true;
  }

void ResetPOCSequence(const string status="SEARCHING CONSOLIDATION")
  {
   g_pocStage=0;
   g_pocDirection=0;
   g_pocPrice=0.0;
   g_pocRangeHigh=0.0;
   g_pocRangeLow=0.0;
   g_pocSweepExtreme=0.0;
   g_pocExpires=0;
   g_signalStopPrice=0.0;
   if(status!="")
      g_lastDecision=status;
  }

bool BuildTickVolumePOC(const MqlRates &bars[],const int firstIndex,const int count,const double atrValue,double &rangeLow,double &rangeHigh,double &poc)
  {
   rangeLow=DBL_MAX;
   rangeHigh=-DBL_MAX;
   for(int i=firstIndex;i<firstIndex+count;i++)
     {
      rangeLow=MathMin(rangeLow,bars[i].low);
      rangeHigh=MathMax(rangeHigh,bars[i].high);
     }
   double range=rangeHigh-rangeLow;
   if(range<=0.0 || atrValue<=0.0 || range>atrValue*ConsolidationMaximumRangeATR)
      return false;

   double histogram[];
   ArrayResize(histogram,VolumeProfileBins);
   ArrayInitialize(histogram,0.0);
   double binSize=range/VolumeProfileBins;
   if(binSize<=0.0)
      return false;
   for(int i=firstIndex;i<firstIndex+count;i++)
     {
      double typical=(bars[i].high+bars[i].low+bars[i].close)/3.0;
      int bin=(int)MathFloor((typical-rangeLow)/binSize);
      bin=MathMax(0,MathMin(VolumeProfileBins-1,bin));
      histogram[bin]+=(double)MathMax((long)1,bars[i].tick_volume);
     }
   int pocBin=0;
   for(int i=1;i<VolumeProfileBins;i++)
      if(histogram[i]>histogram[pocBin])
         pocBin=i;
   poc=NormalizePrice(rangeLow+(pocBin+0.5)*binSize);
   return true;
  }

bool EvaluatePOCSweepEntry(int &direction,double &atrValue,string &reason)
  {
   direction=0;
   g_signalStopPrice=0.0;
   int needed=ConsolidationLookbackBars+6;
   MqlRates bars[];
   double atr[];
   if(!ReadRates(g_symbol,SignalTimeframe,needed,bars) || !ReadBuffer(g_atrHandle,5,atr))
     {
      reason="POC DATA NOT READY";
      return false;
     }
   atrValue=atr[1];
   if(atrValue<=0.0)
     {
      reason="INVALID POC ATR";
      return false;
     }
   datetime currentOpen=iTime(g_symbol,SignalTimeframe,0);
   if(g_pocStage>=2 && (g_pocExpires<=0 || currentOpen>g_pocExpires))
      ResetPOCSequence("POC SETUP EXPIRED");

   if(g_pocStage<=1)
     {
      double rangeLow=0.0,rangeHigh=0.0,poc=0.0;
      if(BuildTickVolumePOC(bars,3,ConsolidationLookbackBars,atrValue,rangeLow,rangeHigh,poc))
        {
         g_pocStage=1;
         g_pocRangeLow=rangeLow;
         g_pocRangeHigh=rangeHigh;
         g_pocPrice=poc;
        }
      else if(g_pocStage==0)
        {
         reason="NO TIGHT CONSOLIDATION";
         return false;
        }

      MqlRates sweep=bars[1];
      double buffer=atrValue*SweepBufferATR;
      bool sweptLow=sweep.low<g_pocRangeLow-buffer && sweep.close>g_pocRangeLow;
      bool sweptHigh=sweep.high>g_pocRangeHigh+buffer && sweep.close<g_pocRangeHigh;
      if(sweptLow && EnableLongEntries)
        {
         g_pocStage=2;
         g_pocDirection=1;
         g_pocSweepExtreme=sweep.low;
        }
      else if(sweptHigh && EnableShortEntries)
        {
         g_pocStage=2;
         g_pocDirection=-1;
         g_pocSweepExtreme=sweep.high;
        }
      else
        {
         reason=StringFormat("RANGE FOUND - NO TRADE | POC %.2f",g_pocPrice);
         return false;
        }
      g_pocExpires=currentOpen+POCSetupExpiryBars*PeriodSeconds(SignalTimeframe);
      reason=g_pocDirection>0 ? "SELL-SIDE SWEEP - WAIT BULLISH DISPLACEMENT" : "BUY-SIDE SWEEP - WAIT BEARISH DISPLACEMENT";
      return false;
     }

   MqlRates candle=bars[1];
   if(g_pocStage==2)
     {
      bool displaced=g_pocDirection>0
         ? candle.close>=g_pocPrice+atrValue*DisplacementFromPOCATR && candle.close>candle.open
         : candle.close<=g_pocPrice-atrValue*DisplacementFromPOCATR && candle.close<candle.open;
      if(!displaced)
        {
         reason=g_pocDirection>0 ? "SWEEP CONFIRMED - WAIT BULLISH DISTRIBUTION" : "SWEEP CONFIRMED - WAIT BEARISH DISTRIBUTION";
         return false;
        }
      g_pocStage=3;
      reason=StringFormat("DISTRIBUTION CONFIRMED - WAIT POC %.2f",g_pocPrice);
      return false;
     }

   double tolerance=atrValue*POCReturnToleranceATR;
   bool touched=candle.low<=g_pocPrice+tolerance && candle.high>=g_pocPrice-tolerance;
   double range=MathMax(candle.high-candle.low,SymbolInfoDouble(g_symbol,SYMBOL_POINT));
   double closeLocation=(candle.close-candle.low)/range;
   bool rejected=g_pocDirection>0
      ? candle.close>candle.open && candle.close>g_pocPrice && closeLocation>=0.60
      : candle.close<candle.open && candle.close<g_pocPrice && closeLocation<=0.40;
   if(!touched || !rejected)
     {
      reason=StringFormat("WAIT POC RETURN + %s CLOSE | POC %.2f",g_pocDirection>0 ? "BULLISH" : "BEARISH",g_pocPrice);
      return false;
     }

   direction=g_pocDirection;
   g_signalStopPrice=NormalizePrice(direction>0 ? g_pocSweepExtreme-atrValue*StructureStopBufferATR : g_pocSweepExtreme+atrValue*StructureStopBufferATR);
   g_lastSetupScore=90;
   reason=direction>0 ? "POC RECLAIM BUY" : "POC REJECTION SELL";
   g_pocStage=0;
   return true;
  }

void ClearPendingEntry()
  {
   g_pendingEntry=false;
   g_pendingDirection=0;
   g_pendingPrice=0.0;
   g_pendingInvalidation=0.0;
   g_pendingATR=0.0;
   g_pendingExpires=0;
   g_pendingTouched=false;
   g_pendingTouchBar=0;
   g_pendingLastCheckedBar=0;
  }

bool PendingRetestDefended(double &atrValue,string &reason)
  {
   MqlRates bars[];
   double fast[],slow[],rsi[],atr[];
   if(!ReadRates(g_symbol,SignalTimeframe,4,bars) ||
      !ReadBuffer(g_fastHandle,4,fast) ||
      !ReadBuffer(g_slowHandle,4,slow) ||
      !ReadBuffer(g_rsiHandle,4,rsi) ||
      !ReadBuffer(g_atrHandle,4,atr))
     {
      reason="DEFENSE DATA NOT READY";
      return false;
     }

   MqlRates defense=bars[1];
   double point=SymbolInfoDouble(g_symbol,SYMBOL_POINT);
   double range=MathMax(defense.high-defense.low,point);
   double body=MathAbs(defense.close-defense.open);
   double bodyShare=body/range;
   double closeLocation=(defense.close-defense.low)/range;
   atrValue=atr[1];
   if(atrValue<=0.0)
     {
      reason="INVALID DEFENSE ATR";
      return false;
     }

   // The original setup already passed D1/H1/M15/ADX and setup-score checks.
   // Here we only require evidence that the touched level was reclaimed; duplicating
   // every original filter on a later M1 candle made otherwise valid entries impossible.
   bool signalDefense=g_pendingDirection>0
      ? defense.close>defense.open && defense.close>g_pendingPrice && closeLocation>=0.60 && bodyShare>=MinimumDefenseBodyShare && defense.close>fast[1] && defense.close>slow[1] && defense.close-fast[1]<=atr[1]*MaximumEntryDistanceATR && rsi[1]>=50.0 && rsi[1]<=70.0
      : defense.close<defense.open && defense.close<g_pendingPrice && closeLocation<=0.40 && bodyShare>=MinimumDefenseBodyShare && defense.close<fast[1] && defense.close<slow[1] && fast[1]-defense.close<=atr[1]*MaximumEntryDistanceATR && rsi[1]<=50.0 && rsi[1]>=30.0;
   bool signalTrend=g_pendingDirection>0 ? fast[1]>slow[1] : fast[1]<slow[1];
   bool rangeOK=range<=atr[1]*MaximumSignalRangeATR;
   if(!signalDefense || !signalTrend || !rangeOK)
     {
      reason=g_pendingDirection>0 ? "RETEST TOUCHED - WAIT BULLISH DEFENSE" : "RETEST TOUCHED - WAIT BEARISH DEFENSE";
      return false;
     }
   return true;
  }

//+------------------------------------------------------------------+
//| Closed-candle signal                                             |
//+------------------------------------------------------------------+
bool EvaluateSignal(int &direction,double &atrValue,string &reason)
  {
   direction=0;
   g_lastSetupScore=0;
   if(UsePOCSweepSequence)
     {
      if(!EvaluatePOCSweepEntry(direction,atrValue,reason))
         return false;
      double metalCorrelation=0.0;
      if(!MetalsConfirmDirection(direction,reason,metalCorrelation))
        {
         direction=0;
         return false;
        }
      PrintFormat("Aurum Guard POC entry accepted: direction=%d POC=%.2f stop=%.2f metals corr=%.2f ATR=%.2f",direction,g_pocPrice,g_signalStopPrice,metalCorrelation,atrValue);
      return true;
     }
   int needed=60;
   MqlRates bars[],dailyBars[],trendBars[];
   double fast[],slow[],rsi[],atr[],dailyEMA[],safetyFast[],safetySlow[],trendFast[],trendSlow[],adx[],plusDI[],minusDI[];
   if(!ReadRates(g_symbol,SignalTimeframe,needed,bars) ||
      !ReadRates(g_symbol,PERIOD_D1,5,dailyBars) ||
      !ReadRates(g_symbol,TrendTimeframe,5,trendBars) ||
      !ReadBuffer(g_fastHandle,5,fast) ||
      !ReadBuffer(g_slowHandle,5,slow) ||
      !ReadBuffer(g_rsiHandle,5,rsi) ||
      !ReadBuffer(g_atrHandle,5,atr) ||
      !ReadBuffer(g_dailyEMAHandle,5,dailyEMA) ||
      !ReadBuffer(g_safetyFastHandle,5,safetyFast) ||
      !ReadBuffer(g_safetySlowHandle,5,safetySlow) ||
      !ReadBuffer(g_trendFastHandle,5,trendFast) ||
      !ReadBuffer(g_trendSlowHandle,5,trendSlow) ||
      !ReadIndicatorBuffer(g_safetyADXHandle,0,5,adx) ||
      !ReadIndicatorBuffer(g_safetyADXHandle,1,5,plusDI) ||
      !ReadIndicatorBuffer(g_safetyADXHandle,2,5,minusDI))
     {
      reason="INDICATOR DATA NOT READY";
      return false;
     }

   atrValue=atr[1];
   if(atrValue<=0.0)
     {
      reason="INVALID ATR";
      return false;
     }
   MqlRates candle=bars[1];
   double point=SymbolInfoDouble(g_symbol,SYMBOL_POINT);
   double body=MathMax(MathAbs(candle.close-candle.open),point);
   double lowerWick=MathMin(candle.open,candle.close)-candle.low;
   double upperWick=candle.high-MathMax(candle.open,candle.close);
   double range=MathMax(candle.high-candle.low,point);
   double bodyShare=body/range;
   bool dailyBull=dailyBars[1].close>dailyEMA[1] && (!RequireDailyEMASlope || dailyEMA[1]>dailyEMA[2]);
   bool dailyBear=dailyBars[1].close<dailyEMA[1] && (!RequireDailyEMASlope || dailyEMA[1]<dailyEMA[2]);
   bool trendBull=fast[1]>slow[1] && fast[1]>fast[2] && slow[1]>=slow[2];
   bool trendBear=fast[1]<slow[1] && fast[1]<fast[2] && slow[1]<=slow[2];
   bool safetyBull=!RequireSafetyTrendAlignment || (safetyFast[1]>safetySlow[1] && safetyFast[1]>=safetyFast[2]);
   bool safetyBear=!RequireSafetyTrendAlignment || (safetyFast[1]<safetySlow[1] && safetyFast[1]<=safetyFast[2]);
   bool higherBull=!RequireTrendTimeframeAlignment || (trendBars[1].close>trendFast[1] && trendFast[1]>trendSlow[1] && trendFast[1]>trendFast[2] && trendSlow[1]>=trendSlow[2]);
   bool higherBear=!RequireTrendTimeframeAlignment || (trendBars[1].close<trendFast[1] && trendFast[1]<trendSlow[1] && trendFast[1]<trendFast[2] && trendSlow[1]<=trendSlow[2]);
   bool adxBull=adx[1]>=MinimumSafetyADX && plusDI[1]>minusDI[1];
   bool adxBear=adx[1]>=MinimumSafetyADX && minusDI[1]>plusDI[1];

   bool longTwoBarConfirmed=!RequireTwoBarConfirmation || (bars[2].close<bars[2].open && bars[2].low<=fast[2]+atr[2]*PullbackBufferATR && candle.close>bars[2].high);
   bool shortTwoBarConfirmed=!RequireTwoBarConfirmation || (bars[2].close>bars[2].open && bars[2].high>=fast[2]-atr[2]*PullbackBufferATR && candle.close<bars[2].low);
   bool longRetest=EnableLongEntries && trendBull && longTwoBarConfirmed && candle.low<=fast[1]+atr[1]*PullbackBufferATR && candle.close>fast[1] && candle.close>slow[1] && candle.close>candle.open && lowerWick/body>=0.35 && bodyShare>=MinimumEntryBodyShare && candle.close-fast[1]<=atr[1]*MaximumEntryDistanceATR && rsi[1]>=52.0 && rsi[1]<=68.0 && range<=atr[1]*MaximumSignalRangeATR;
   bool shortRetest=EnableShortEntries && trendBear && shortTwoBarConfirmed && candle.high>=fast[1]-atr[1]*PullbackBufferATR && candle.close<fast[1] && candle.close<slow[1] && candle.close<candle.open && upperWick/body>=0.35 && bodyShare>=MinimumEntryBodyShare && fast[1]-candle.close<=atr[1]*MaximumEntryDistanceATR && rsi[1]<=48.0 && rsi[1]>=32.0 && range<=atr[1]*MaximumSignalRangeATR;

   if(longRetest)
      direction=1;
   else if(shortRetest)
      direction=-1;
   else
     {
      reason="NO CONFIRMED SIGNAL RETEST";
      return false;
     }

   bool dailyAligned=direction>0 ? dailyBull : dailyBear;
   bool safetyAligned=direction>0 ? safetyBull : safetyBear;
   bool higherAligned=direction>0 ? higherBull : higherBear;
   bool adxAligned=direction>0 ? adxBull : adxBear;
   if(!dailyAligned)
     {
      reason="D1 TREND OR SLOPE NOT ALIGNED";
      direction=0;
      return false;
     }
   if(!safetyAligned)
     {
      reason="M15 TREND NOT ALIGNED";
      direction=0;
      return false;
     }
   if(!higherAligned)
     {
      reason="H1 TREND NOT ALIGNED";
      direction=0;
      return false;
     }
   if(!adxAligned)
     {
      reason=StringFormat("M15 TREND STRENGTH TOO LOW (ADX %.1f)",adx[1]);
      direction=0;
      return false;
     }

   double metalCorrelation=0.0;
   if(!MetalsConfirmDirection(direction,reason,metalCorrelation))
     {
      direction=0;
      return false;
     }

   int score=75; // D1 + M15 + H1 + ADX + metals all passed.
   bool clearEMASeparation=MathAbs(fast[1]-slow[1])>=atr[1]*0.10;
   bool strongBody=bodyShare>=0.55;
   bool strongRejection=direction>0 ? lowerWick/body>=0.60 : upperWick/body>=0.60;
   bool idealRSI=direction>0 ? (rsi[1]>=54.0 && rsi[1]<=64.0) : (rsi[1]<=46.0 && rsi[1]>=36.0);
   double entryDistance=direction>0 ? candle.close-fast[1] : fast[1]-candle.close;
   bool closeToValue=entryDistance<=atr[1]*0.40;
   if(clearEMASeparation) score+=5;
   if(strongBody) score+=5;
   if(strongRejection) score+=5;
   if(idealRSI) score+=5;
   if(closeToValue) score+=5;
   g_lastSetupScore=MathMin(score,100);
   if(g_lastSetupScore<MinimumSetupScore)
     {
      reason=StringFormat("SETUP SCORE %d/%d - WAIT",g_lastSetupScore,MinimumSetupScore);
      direction=0;
      return false;
     }
   double rejectionRatio=direction>0 ? lowerWick/body : upperWick/body;
   PrintFormat("Aurum Guard accepted setup: score=%d RSI=%.2f ADX=%.2f DI+=%.2f DI-=%.2f body=%.2f%% rejection=%.2f ATR distance=%.2f ATR EMA gap=%.2f ATR metals corr=%.2f signal ATR=%.2f",
               g_lastSetupScore,rsi[1],adx[1],plusDI[1],minusDI[1],bodyShare*100.0,rejectionRatio,entryDistance/atr[1],MathAbs(fast[1]-slow[1])/atr[1],metalCorrelation,atr[1]);
   return true;
  }

double CalculateVolume()
  {
   return FixedTradeVolume();
  }

bool SpreadAllowsEntry(const double atrValue,string &reason)
  {
   MqlTick tick;
   if(!SymbolInfoTick(g_symbol,tick) || atrValue<=0.0)
     {
      reason="NO LIVE QUOTE";
      return false;
     }
   double spread=tick.ask-tick.bid;
   if(spread>atrValue*MaxSpreadAsATR)
     {
      reason="SPREAD TOO WIDE";
      return false;
     }
   return true;
  }

bool AIAllowsEntry(const int direction,string &reason)
  {
   if(!UseAIApprovalGate)
     {
      g_aiStatus="OFF";
      g_aiProbability=0.0;
      return true;
     }

   if((bool)MQLInfoInteger(MQL_TESTER) && !AIShadowMode)
     {
      reason="AI STRICT MODE NEEDS LIVE DEMO FEED";
      g_aiStatus="BLOCK - TESTER HAS NO AI REPLAY";
      return false;
     }

   ResetLastError();
   int file=FileOpen(AIApprovalFile,FILE_READ|FILE_CSV|FILE_ANSI|FILE_SHARE_READ|FILE_COMMON,',');
   if(file==INVALID_HANDLE)
     {
      reason="AI SCORE FILE MISSING";
      g_aiStatus=AIShadowMode ? "SHADOW - SCORE FILE MISSING" : "BLOCK - SCORE FILE MISSING";
      g_aiProbability=0.0;
      return AIShadowMode;
     }

   int formatVersion=(int)FileReadNumber(file);
   long generatedAt=(long)FileReadNumber(file);
   string scoreSymbol=FileReadString(file);
   string scoreTimeframe=FileReadString(file);
   int scoreDirection=(int)FileReadNumber(file);
   double longProbability=FileReadNumber(file);
   double shortProbability=FileReadNumber(file);
   double noTradeProbability=FileReadNumber(file);
   string modelId=FileReadString(file);
   long scoredBar=(long)FileReadNumber(file);
   int deploymentEligible=FileIsEnding(file) ? 0 : (int)FileReadNumber(file);
   string scoreHealth=FileIsEnding(file) ? "INVALID" : FileReadString(file);
   double driftShare=FileIsEnding(file) ? 1.0 : FileReadNumber(file);
   FileClose(file);

   g_aiModel=modelId;
   g_aiProbability=direction>0 ? longProbability : shortProbability;
   long scoreAge=(long)TimeGMT()-generatedAt;
   bool structurallyValid=(formatVersion==3 && generatedAt>0 && scoredBar>0 && modelId!="");
   bool symbolValid=(!AIRequireMatchingSymbol || scoreSymbol==g_symbol);
   bool timeframeValid=(scoreTimeframe=="M1" && SignalTimeframe==PERIOD_M1);
   bool ageValid=(scoreAge>=-30 && scoreAge<=MaximumAISignalAgeSeconds);
   double oppositeProbability=direction>0 ? shortProbability : longProbability;
   bool probabilityValid=(g_aiProbability>=MinimumAIApprovalProbability && g_aiProbability>oppositeProbability && g_aiProbability>noTradeProbability);
   bool healthValid=(scoreHealth=="CANDIDATE_APPROVED" && driftShare<=0.15);
   bool approved=(structurallyValid && symbolValid && timeframeValid && ageValid && deploymentEligible==1 && healthValid && scoreDirection==direction && probabilityValid);

   if(approved)
     {
      g_aiStatus=StringFormat("%s%s %.0f%% (%s)",AIShadowMode ? "SHADOW WOULD APPROVE " : "APPROVE ",direction>0 ? "BUY" : "SELL",g_aiProbability*100.0,modelId);
      return true;
     }

   if(!structurallyValid)
      reason="AI SCORE INVALID";
   else if(!symbolValid)
      reason="AI SYMBOL MISMATCH";
   else if(!timeframeValid)
      reason="AI MODEL IS M1 ONLY";
   else if(!ageValid)
      reason="AI SCORE STALE";
   else if(deploymentEligible!=1)
      reason="AI MODEL NOT RESEARCH-VALIDATED";
   else if(!healthValid)
      reason="AI HEALTH "+scoreHealth;
   else if(scoreDirection!=direction)
      reason="AI DOES NOT CONFIRM DIRECTION";
   else
      reason="AI CONFIDENCE BELOW GATE";

   g_aiStatus=StringFormat("%s - %s %.0f%%",AIShadowMode ? "SHADOW WOULD BLOCK" : "BLOCK",reason,g_aiProbability*100.0);
   return AIShadowMode;
  }

void OpenSignalTrade(const int direction,const double signalATR,const double structureStop=0.0)
  {
   string aiReason="";
   if(!AIAllowsEntry(direction,aiReason))
     {
      g_lastDecision=aiReason;
      return;
     }

   MqlTick tick;
   if(!SymbolInfoTick(g_symbol,tick))
     {
      g_lastDecision="LIVE QUOTE MISSING";
      return;
     }

   double volume=CalculateVolume();
   if(volume<=0.0)
     {
      g_lastDecision="BROKER DOES NOT SUPPORT FIXED 0.01 LOT";
      return;
     }

   double entry=direction>0 ? tick.ask : tick.bid;
   double maximumStopDistance=MoneyToPriceDistance(direction,entry,StopLossMoney,volume,true);
   double stopDistance=structureStop>0.0 ? (direction>0 ? entry-structureStop : structureStop-entry) : maximumStopDistance;
   if(maximumStopDistance<=0.0 || stopDistance<=0.0)
     {
      g_lastDecision="BROKER TICK VALUE MISSING";
      return;
     }
   if(stopDistance>maximumStopDistance)
     {
      g_lastDecision=StringFormat("SKIP - STRUCTURE SL EXCEEDS %.2f RISK CAP",StopLossMoney);
      return;
     }
   double targetDistance=stopDistance*FibonacciRewardMultiple;
   if(signalATR<=0.0 || stopDistance<signalATR*MinimumStopDistanceATR)
     {
      g_lastDecision=StringFormat("VOLATILITY TOO HIGH FOR $ SL (stop %.2f ATR)",signalATR>0.0 ? stopDistance/signalATR : 0.0);
      return;
     }

   double minimumBrokerDistance=(double)SymbolInfoInteger(g_symbol,SYMBOL_TRADE_STOPS_LEVEL)*SymbolInfoDouble(g_symbol,SYMBOL_POINT);
   if(stopDistance<minimumBrokerDistance || targetDistance<minimumBrokerDistance)
     {
      g_lastDecision="BROKER MINIMUM STOP EXCEEDS MONEY PLAN";
      return;
     }

   entry=NormalizePrice(entry);
   double stop=NormalizePrice(direction>0 ? entry-stopDistance : entry+stopDistance);
   double finalTarget=NormalizePrice(direction>0 ? entry+targetDistance : entry-targetDistance);
   double risk=MathAbs(entry-stop);

   bool requestSent=direction>0 ? trade.Buy(volume,g_symbol,0.0,stop,finalTarget,"AG FIXED BUY") : trade.Sell(volume,g_symbol,0.0,stop,finalTarget,"AG FIXED SELL");
   if(!requestSent || !TradeResultAccepted())
     {
      g_lastDecision="ORDER REJECTED: "+trade.ResultRetcodeDescription();
      Print("Aurum Guard order rejected: ",trade.ResultRetcode()," ",trade.ResultRetcodeDescription());
      return;
     }

   ulong ticket=0;
   double actualEntry=entry,actualStop=stop;
   if(FindOwnPosition(ticket) && PositionSelectByTicket(ticket))
     {
      actualEntry=PositionGetDouble(POSITION_PRICE_OPEN);
      actualStop=PositionGetDouble(POSITION_SL);
      volume=PositionGetDouble(POSITION_VOLUME);
     }
   SaveState("RISK",MathAbs(actualEntry-actualStop));
   SaveState("INITIAL_VOLUME",volume);
   SaveState("TP1_DONE",0.0);
   SaveState("TP2_DONE",0.0);
   g_lastDecision=direction>0 ? "0.01 BUY | $ SL + $20 TP" : "0.01 SELL | $ SL + $20 TP";
   if(EnableTerminalAlerts)
      Alert("Aurum Guard ",g_symbol,": ",g_lastDecision);
  }

bool ReducePosition(const ulong ticket,const double volume,const ENUM_POSITION_TYPE type)
  {
   if(volume<=0.0)
      return true;
   ENUM_ACCOUNT_MARGIN_MODE marginMode=(ENUM_ACCOUNT_MARGIN_MODE)AccountInfoInteger(ACCOUNT_MARGIN_MODE);
   bool sent=false;
   if(marginMode==ACCOUNT_MARGIN_MODE_RETAIL_HEDGING)
      sent=trade.PositionClosePartial(ticket,volume,DeviationPoints);
   else if(type==POSITION_TYPE_BUY)
      sent=trade.Sell(volume,g_symbol,0.0,0.0,0.0,"AG partial close");
   else
      sent=trade.Buy(volume,g_symbol,0.0,0.0,0.0,"AG partial close");
   return sent && TradeResultAccepted();
  }

void ApplyEarlyProfitProtection(const ulong ticket,const ENUM_POSITION_TYPE type,const double entry,const double finalTarget,const double currentVolume,const double marketPrice)
  {
   if(!EnableEarlyProfitProtection || !PositionSelectByTicket(ticket))
      return;
   double openProfit=PositionGetDouble(POSITION_PROFIT);
   if(openProfit<BreakEvenTriggerMoney)
      return;

   int direction=type==POSITION_TYPE_BUY ? 1 : -1;
   double point=SymbolInfoDouble(g_symbol,SYMBOL_POINT);
   double currentStop=PositionGetDouble(POSITION_SL);
   double candidate=NormalizePrice(direction>0 ? entry+BreakEvenOffsetPoints*point : entry-BreakEvenOffsetPoints*point);

   if(openProfit>=ProfitLockTriggerMoney)
     {
      double lockDistance=MoneyToPriceDistance(direction,entry,ProfitLockMoney,currentVolume,false);
      if(lockDistance>0.0)
         candidate=NormalizePrice(direction>0 ? entry+lockDistance : entry-lockDistance);
     }
   if(openProfit>=TrailingTriggerMoney)
     {
      double givebackDistance=MoneyToPriceDistance(direction,marketPrice,TrailingGivebackMoney,currentVolume,true);
      if(givebackDistance>0.0)
        {
         double trailingStop=NormalizePrice(direction>0 ? marketPrice-givebackDistance : marketPrice+givebackDistance);
         bool trailImproves=direction>0 ? trailingStop>candidate : trailingStop<candidate;
         if(trailImproves)
            candidate=trailingStop;
        }
     }

   MqlTick latest;
   if(!SymbolInfoTick(g_symbol,latest))
      return;
   double stopLevel=(double)SymbolInfoInteger(g_symbol,SYMBOL_TRADE_STOPS_LEVEL)*point;
   bool valid=direction>0 ? candidate<latest.bid-stopLevel : candidate>latest.ask+stopLevel;
   bool improves=direction>0 ? (currentStop<=0.0 || candidate>currentStop+point) : (currentStop<=0.0 || candidate<currentStop-point);
   if(valid && improves && !trade.PositionModify(ticket,candidate,finalTarget))
      Print("Aurum Guard profit-protection modify failed: ",trade.ResultRetcodeDescription());
  }

void ManageOpenPosition()
  {
   ulong ticket=0;
   if(!FindOwnPosition(ticket))
     {
      if(GlobalVariableCheck(StateKey("RISK")))
         ClearPositionState();
      return;
     }
   if(!PositionSelectByTicket(ticket))
      return;

   datetime now=TimeCurrent();
   if(now==g_lastManageAttempt)
      return;
   g_lastManageAttempt=now;

   ENUM_POSITION_TYPE type=(ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
   double entry=PositionGetDouble(POSITION_PRICE_OPEN);
   double stop=PositionGetDouble(POSITION_SL);
   double finalTarget=PositionGetDouble(POSITION_TP);
   double currentVolume=PositionGetDouble(POSITION_VOLUME);
   double configuredRewardRisk=FibonacciRewardMultiple;
   double fallbackRisk=stop>0.0 ? MathAbs(entry-stop) : (configuredRewardRisk>0.0 ? MathAbs(finalTarget-entry)/configuredRewardRisk : 0.0);
   double risk=LoadState("RISK",fallbackRisk);
   double initialVolume=LoadState("INITIAL_VOLUME",currentVolume);
   bool tp1Done=LoadState("TP1_DONE",0.0)>0.5;
   bool tp2Done=LoadState("TP2_DONE",0.0)>0.5;
   if(risk<=0.0)
      return;

   MqlTick tick;
   if(!SymbolInfoTick(g_symbol,tick))
      return;
   double marketPrice=type==POSITION_TYPE_BUY ? tick.bid : tick.ask;
   double tp1=type==POSITION_TYPE_BUY ? entry+risk : entry-risk;
   double tp2=type==POSITION_TYPE_BUY ? entry+risk*1.50 : entry-risk*1.50;

   ApplyEarlyProfitProtection(ticket,type,entry,finalTarget,currentVolume,marketPrice);

   bool reachedTP1=type==POSITION_TYPE_BUY ? marketPrice>=tp1 : marketPrice<=tp1;
   bool reachedTP2=type==POSITION_TYPE_BUY ? marketPrice>=tp2 : marketPrice<=tp2;
   if(reachedTP1 && !tp1Done)
     {
      double closeVolume=TakePartialAtTP1 ? NormalizeVolume(initialVolume*TP1ClosePercent/100.0,false) : 0.0;
      double minimum=SymbolInfoDouble(g_symbol,SYMBOL_VOLUME_MIN);
      if(closeVolume>0.0 && currentVolume-closeVolume>=minimum-1e-9 && !ReducePosition(ticket,closeVolume,type))
        {
         Print("Aurum Guard TP1 partial close failed: ",trade.ResultRetcodeDescription());
         return;
        }
      SaveState("TP1_DONE",1.0);
      if(PositionSelectByTicket(ticket))
        {
         double protectedStop=PositionGetDouble(POSITION_SL);
         if(MoveStopToBreakEvenAtTP1)
           {
            double point=SymbolInfoDouble(g_symbol,SYMBOL_POINT);
            double breakEvenStop=NormalizePrice(type==POSITION_TYPE_BUY ? entry+BreakEvenOffsetPoints*point : entry-BreakEvenOffsetPoints*point);
            MqlTick latest;
            SymbolInfoTick(g_symbol,latest);
            double stopLevel=(double)SymbolInfoInteger(g_symbol,SYMBOL_TRADE_STOPS_LEVEL)*point;
            bool valid=type==POSITION_TYPE_BUY ? breakEvenStop<latest.bid-stopLevel : breakEvenStop>latest.ask+stopLevel;
            bool improves=type==POSITION_TYPE_BUY ? (protectedStop<=0.0 || breakEvenStop>protectedStop+point) : (protectedStop<=0.0 || breakEvenStop<protectedStop-point);
            if(valid && improves)
              {
               if(!trade.PositionModify(ticket,breakEvenStop,finalTarget))
                  Print("Aurum Guard TP1 break-even modify failed: ",trade.ResultRetcodeDescription());
              }
           }
        }
      if(EnableTerminalAlerts)
         Alert("Aurum Guard ",g_symbol,": TP1 reached; partial and break-even rules checked.");
     }

   if(!PositionSelectByTicket(ticket))
      return;
   currentVolume=PositionGetDouble(POSITION_VOLUME);
   if(reachedTP2 && !tp2Done)
     {
      double closeVolume=TakePartialAtTP2 ? NormalizeVolume(initialVolume*TP2ClosePercent/100.0,false) : 0.0;
      double minimum=SymbolInfoDouble(g_symbol,SYMBOL_VOLUME_MIN);
      if(closeVolume>0.0 && currentVolume-closeVolume>=minimum-1e-9 && !ReducePosition(ticket,closeVolume,type))
        {
         Print("Aurum Guard TP2 partial close failed: ",trade.ResultRetcodeDescription());
         return;
        }
      SaveState("TP2_DONE",1.0);
      if(PositionSelectByTicket(ticket))
        {
         double protectedStop=PositionGetDouble(POSITION_SL);
         if(LockOneRAtTP2)
           {
            double point=SymbolInfoDouble(g_symbol,SYMBOL_POINT);
            double lockedStop=NormalizePrice(type==POSITION_TYPE_BUY ? entry+risk : entry-risk);
            MqlTick latest;
            SymbolInfoTick(g_symbol,latest);
            double stopLevel=(double)SymbolInfoInteger(g_symbol,SYMBOL_TRADE_STOPS_LEVEL)*point;
            bool valid=type==POSITION_TYPE_BUY ? lockedStop<latest.bid-stopLevel : lockedStop>latest.ask+stopLevel;
            bool improves=type==POSITION_TYPE_BUY ? (protectedStop<=0.0 || lockedStop>protectedStop) : (protectedStop<=0.0 || lockedStop<protectedStop);
            if(valid && improves)
               trade.PositionModify(ticket,lockedStop,finalTarget);
           }
        }
      if(EnableTerminalAlerts)
         Alert("Aurum Guard ",g_symbol,": TP2 reached; one-R profit lock checked before TP3.");
     }
  }

void EvaluateNewEntry()
  {
   if(!EnableNewEntries)
     {
      g_lastDecision="NEW ENTRIES DISABLED";
      return;
     }
   if((ENUM_ACCOUNT_TRADE_MODE)AccountInfoInteger(ACCOUNT_TRADE_MODE)==ACCOUNT_TRADE_MODE_REAL && !AllowLiveTrading)
     {
      g_lastDecision="REAL ACCOUNT LOCKED";
      return;
     }
   if(!AccountInfoInteger(ACCOUNT_TRADE_ALLOWED) || !AccountInfoInteger(ACCOUNT_TRADE_EXPERT))
     {
      g_lastDecision="MT5 AUTO TRADING DISABLED";
      return;
     }
   if(AnyPositionOnTradeSymbol())
     {
      g_lastDecision="POSITION ALREADY OPEN";
      return;
     }
   if(g_pendingEntry)
     {
      g_lastDecision=g_pendingDirection>0 ? "BUY CONFIRMED - WAITING FOR RETEST" : "SELL CONFIRMED - WAITING FOR RETEST";
      return;
     }

   string reason="";
   if(!SafetyAllowsEntry(reason) || IsUSDNewsBlocked(reason))
     {
      g_lastDecision=reason;
      return;
     }

   int direction=0;
   double atrValue=0.0;
   if(!EvaluateSignal(direction,atrValue,reason))
     {
      g_lastDecision=reason;
      return;
     }
   if(UseConfirmationRetestEntry && !UsePOCSweepSequence)
     {
      MqlRates signalBars[];
      if(!ReadRates(g_symbol,SignalTimeframe,3,signalBars))
        {
         g_lastDecision="CONFIRMATION DATA NOT READY";
         return;
        }
      MqlRates confirmation=signalBars[1];
      g_pendingDirection=direction;
      g_pendingPrice=NormalizePrice(confirmation.open+(confirmation.close-confirmation.open)*ConfirmationRetestFraction);
      g_pendingInvalidation=direction>0 ? confirmation.low : confirmation.high;
       g_pendingATR=atrValue;
      int secondsPerBar=PeriodSeconds(SignalTimeframe);
       g_pendingExpires=iTime(g_symbol,SignalTimeframe,0)+ConfirmationRetestBars*secondsPerBar;
       g_pendingEntry=true;
       g_pendingTouched=false;
       g_pendingTouchBar=0;
       g_pendingLastCheckedBar=0;
      g_lastDecision=StringFormat("%s CONFIRMED - WAIT RETEST %.2f",direction>0 ? "BUY" : "SELL",g_pendingPrice);
      return;
     }
   if(!SpreadAllowsEntry(atrValue,reason))
     {
      g_lastDecision=reason;
      return;
     }
   OpenSignalTrade(direction,atrValue,g_signalStopPrice);
  }

void EvaluatePendingEntry()
  {
   if(!g_pendingEntry)
      return;
   if(!EnableNewEntries || AnyPositionOnTradeSymbol())
     {
      ClearPendingEntry();
      return;
     }
   if(TimeCurrent()>g_pendingExpires)
     {
      g_lastDecision="CONFIRMED SETUP EXPIRED - NO CHASE";
      ClearPendingEntry();
      return;
     }

   MqlTick tick;
   if(!SymbolInfoTick(g_symbol,tick))
      return;
   bool invalidated=g_pendingDirection>0 ? tick.bid<=g_pendingInvalidation : tick.ask>=g_pendingInvalidation;
   if(invalidated)
     {
      g_lastDecision="CONFIRMED SETUP INVALIDATED BEFORE ENTRY";
      ClearPendingEntry();
      return;
     }
   bool touched=g_pendingDirection>0 ? tick.ask<=g_pendingPrice : tick.bid>=g_pendingPrice;
   if(!g_pendingTouched && !touched)
     {
      g_lastDecision=StringFormat("%s CONFIRMED - WAIT RETEST %.2f",g_pendingDirection>0 ? "BUY" : "SELL",g_pendingPrice);
      return;
     }

   if(RequireDefendedRetestClose)
     {
      datetime currentBar=iTime(g_symbol,SignalTimeframe,0);
      if(!g_pendingTouched)
        {
         g_pendingTouched=true;
         g_pendingTouchBar=currentBar;
         int secondsPerBar=PeriodSeconds(SignalTimeframe);
         datetime defenseDeadline=currentBar+(RetestDefenseBars+1)*secondsPerBar;
         if(defenseDeadline>g_pendingExpires)
            g_pendingExpires=defenseDeadline;
         g_lastDecision=g_pendingDirection>0 ? "BUY RETEST TOUCHED - WAIT BULLISH CLOSE" : "SELL RETEST TOUCHED - WAIT BEARISH CLOSE";
         return;
        }
      if(currentBar<=g_pendingTouchBar || currentBar==g_pendingLastCheckedBar)
        {
         g_lastDecision=g_pendingDirection>0 ? "BUY RETEST TOUCHED - WAIT BULLISH CLOSE" : "SELL RETEST TOUCHED - WAIT BEARISH CLOSE";
         return;
        }
      g_pendingLastCheckedBar=currentBar;
      string defenseReason="";
      double defendedATR=g_pendingATR;
      if(!PendingRetestDefended(defendedATR,defenseReason))
        {
         g_lastDecision=defenseReason;
         return;
        }
      g_pendingATR=defendedATR;
     }

   string reason="";
   double correlation=0.0;
    if(!SafetyAllowsEntry(reason) || IsUSDNewsBlocked(reason) || !SpreadAllowsEntry(g_pendingATR,reason) || !MetalsConfirmDirection(g_pendingDirection,reason,correlation))
     {
      g_lastDecision=reason;
      return;
     }
   int direction=g_pendingDirection;
   double atrValue=g_pendingATR;
   double structureStop=g_pendingInvalidation;
   ClearPendingEntry();
   OpenSignalTrade(direction,atrValue,structureStop);
  }

void UpdateChartPanel()
  {
   ENUM_ACCOUNT_TRADE_MODE mode=(ENUM_ACCOUNT_TRADE_MODE)AccountInfoInteger(ACCOUNT_TRADE_MODE);
   string modeText=mode==ACCOUNT_TRADE_MODE_REAL ? (AllowLiveTrading ? "REAL ENABLED" : "REAL LOCKED") : mode==ACCOUNT_TRADE_MODE_DEMO ? "DEMO" : "CONTEST";
   double dayPnL=0.0,dayStartBalance=0.0;
   int tradesToday=0;
   GetDailyStats(dayPnL,tradesToday,dayStartBalance);
   string pauseText=TimeCurrent()<g_safetyPauseUntil ? "PAUSED UNTIL "+TimeToString(g_safetyPauseUntil,TIME_MINUTES) : g_safetyStatus;
   string currency=AccountInfoString(ACCOUNT_CURRENCY);
   string pocStageText=g_pocStage==1 ? "RANGE / WAIT SWEEP" : g_pocStage==2 ? "SWEEP / WAIT DISPLACEMENT" : g_pocStage==3 ? "DISTRIBUTION / WAIT POC RETURN" : "SEARCHING RANGE";
   Comment("AURUM GUARD AUTO TRADER\n",
           "Mode: ",modeText," | Symbol: ",g_symbol,"\n",
           "Signal decision: ",g_lastDecision,"\n",
           "Higher-timeframe safety: ",pauseText,"\n",
           "AI approval: ",g_aiStatus,"\n",
           "Setup score: ",IntegerToString(g_lastSetupScore),"/100 | Entry gate: ",IntegerToString(MinimumSetupScore),"\n",
            "POC sequence: ",pocStageText," | Tick-volume POC: ",DoubleToString(g_pocPrice,2),"\n",
            "Today realized: ",currency," ",DoubleToString(dayPnL,2)," | Entries: ",tradesToday," | No daily quota\n",
            "Fixed lot: 0.01 | Max risk: ",currency," ",DoubleToString(StopLossMoney,2)," | Fib target: ",DoubleToString(FibonacciRewardMultiple,2),"R\n",
           "Direction preset: ",EnableLongEntries ? (EnableShortEntries ? "LONG + SHORT" : "LONG ONLY") : (EnableShortEntries ? "SHORT ONLY" : "DISABLED"),"\n",
            "POC decisions use M15/M30/H1 only: range -> sweep -> displacement -> POC return.\n",
            "No M1 POC signals, martingale, or revenge re-entry.");
  }

//+------------------------------------------------------------------+
//| Expert lifecycle                                                 |
//+------------------------------------------------------------------+
int OnInit()
  {
   if(StopLossMoney<=0.0 || FibonacciRewardMultiple<=1.0 || BreakEvenTriggerMoney<=0.0 || ProfitLockTriggerMoney<BreakEvenTriggerMoney || ProfitLockMoney<0.0 || TrailingTriggerMoney<ProfitLockTriggerMoney || TrailingGivebackMoney<=0.0)
     {
      Print("Aurum Guard: invalid risk controls. Risk must be positive and the Fibonacci reward multiple must exceed 1.0.");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(MinimumAIApprovalProbability<0.50 || MinimumAIApprovalProbability>0.99 || MaximumAISignalAgeSeconds<60)
     {
      Print("Aurum Guard: invalid AI controls. Probability must be 0.50-0.99 and signal age must be at least 60 seconds.");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(MinimumSafetyADX<0.0 || MaximumSignalRangeATR<=0.0 || MinimumEntryBodyShare<0.0 || MinimumEntryBodyShare>1.0 || MinimumStopDistanceATR<=0.0 || MinimumSetupScore<0 || MinimumSetupScore>100 || ConfirmationRetestFraction<0.0 || ConfirmationRetestFraction>1.0 || ConfirmationRetestBars<1 || RetestDefenseBars<1 || MinimumDefenseBodyShare<0.0 || MinimumDefenseBodyShare>1.0)
     {
      Print("Aurum Guard: invalid smart-entry controls. Check ADX, candle, volatility and setup-score inputs.");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(ConsolidationLookbackBars<10 || VolumeProfileBins<4 || VolumeProfileBins>100 || ConsolidationMaximumRangeATR<=0.0 || SweepBufferATR<0.0 || DisplacementFromPOCATR<=0.0 || POCReturnToleranceATR<=0.0 || StructureStopBufferATR<0.0 || POCSetupExpiryBars<3)
     {
      Print("Aurum Guard: invalid POC sequence controls.");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(UsePOCSweepSequence && SignalTimeframe!=PERIOD_M15 && SignalTimeframe!=PERIOD_M30 && SignalTimeframe!=PERIOD_H1)
     {
      Print("Aurum Guard: the POC/sweep sequence is valid only on M15, M30, or H1. M1 is intentionally blocked to avoid misleading micro-noise signals.");
      return INIT_PARAMETERS_INCORRECT;
     }

   g_symbol=TradeSymbol=="" ? _Symbol : TradeSymbol;
   if(!SymbolSelect(g_symbol,true))
     {
      Print("Aurum Guard: cannot select trade symbol ",g_symbol);
      return INIT_FAILED;
     }
   if(FixedTradeVolume()<=0.0)
     {
      Print("Aurum Guard: broker symbol ",g_symbol," does not support the required fixed 0.01 lot size.");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(RequireGoldSilverSync && !SymbolSelect(SilverConfirmationSymbol,true))
     {
      Print("Aurum Guard: cannot select silver confirmation symbol ",SilverConfirmationSymbol,". Enter the broker's exact Market Watch name.");
      return INIT_FAILED;
     }

   ENUM_ACCOUNT_TRADE_MODE accountMode=(ENUM_ACCOUNT_TRADE_MODE)AccountInfoInteger(ACCOUNT_TRADE_MODE);
   if(accountMode==ACCOUNT_TRADE_MODE_REAL && !AllowLiveTrading)
     {
      Print("Aurum Guard safety lock: this is a REAL account. Set AllowLiveTrading=true only after demo forward testing.");
      return INIT_FAILED;
     }

   g_fastHandle=iMA(g_symbol,SignalTimeframe,FastEMAPeriod,0,MODE_EMA,PRICE_CLOSE);
   g_slowHandle=iMA(g_symbol,SignalTimeframe,SlowEMAPeriod,0,MODE_EMA,PRICE_CLOSE);
   g_rsiHandle=iRSI(g_symbol,SignalTimeframe,RSIPeriod,PRICE_CLOSE);
   g_atrHandle=iATR(g_symbol,SignalTimeframe,ATRPeriod);
   g_dailyEMAHandle=iMA(g_symbol,PERIOD_D1,SlowEMAPeriod,0,MODE_EMA,PRICE_CLOSE);
   g_safetyFastHandle=iMA(g_symbol,SafetyTimeframe,FastEMAPeriod,0,MODE_EMA,PRICE_CLOSE);
   g_safetySlowHandle=iMA(g_symbol,SafetyTimeframe,SlowEMAPeriod,0,MODE_EMA,PRICE_CLOSE);
   g_safetyATRHandle=iATR(g_symbol,SafetyTimeframe,ATRPeriod);
   g_safetyADXHandle=iADX(g_symbol,SafetyTimeframe,ADXPeriod);
   g_trendFastHandle=iMA(g_symbol,TrendTimeframe,FastEMAPeriod,0,MODE_EMA,PRICE_CLOSE);
   g_trendSlowHandle=iMA(g_symbol,TrendTimeframe,SlowEMAPeriod,0,MODE_EMA,PRICE_CLOSE);
   if(g_fastHandle==INVALID_HANDLE || g_slowHandle==INVALID_HANDLE || g_rsiHandle==INVALID_HANDLE || g_atrHandle==INVALID_HANDLE || g_dailyEMAHandle==INVALID_HANDLE || g_safetyFastHandle==INVALID_HANDLE || g_safetySlowHandle==INVALID_HANDLE || g_safetyATRHandle==INVALID_HANDLE || g_safetyADXHandle==INVALID_HANDLE || g_trendFastHandle==INVALID_HANDLE || g_trendSlowHandle==INVALID_HANDLE)
     {
      Print("Aurum Guard: failed to create indicator handles. Error ",GetLastError());
      return INIT_FAILED;
     }

   trade.SetExpertMagicNumber(MagicNumber);
   trade.SetDeviationInPoints(DeviationPoints);
   trade.SetTypeFillingBySymbol(g_symbol);
   trade.SetMarginMode();
   trade.SetAsyncMode(false);
   g_lastSignalBar=iTime(g_symbol,SignalTimeframe,0);
   g_lastSafetyBar=iTime(g_symbol,SafetyTimeframe,0);
   EvaluateM15Safety();
   Print("Aurum Guard initialized on ",g_symbol,". Account mode: ",EnumToString(accountMode));
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   Comment("");
   if(g_fastHandle!=INVALID_HANDLE) IndicatorRelease(g_fastHandle);
   if(g_slowHandle!=INVALID_HANDLE) IndicatorRelease(g_slowHandle);
   if(g_rsiHandle!=INVALID_HANDLE) IndicatorRelease(g_rsiHandle);
   if(g_atrHandle!=INVALID_HANDLE) IndicatorRelease(g_atrHandle);
   if(g_dailyEMAHandle!=INVALID_HANDLE) IndicatorRelease(g_dailyEMAHandle);
   if(g_safetyFastHandle!=INVALID_HANDLE) IndicatorRelease(g_safetyFastHandle);
   if(g_safetySlowHandle!=INVALID_HANDLE) IndicatorRelease(g_safetySlowHandle);
   if(g_safetyATRHandle!=INVALID_HANDLE) IndicatorRelease(g_safetyATRHandle);
   if(g_safetyADXHandle!=INVALID_HANDLE) IndicatorRelease(g_safetyADXHandle);
   if(g_trendFastHandle!=INVALID_HANDLE) IndicatorRelease(g_trendFastHandle);
   if(g_trendSlowHandle!=INVALID_HANDLE) IndicatorRelease(g_trendSlowHandle);
  }

void OnTick()
  {
   ManageOpenPosition();
   if(IsNewBar(g_symbol,SafetyTimeframe,g_lastSafetyBar))
      EvaluateM15Safety();
   if(IsNewBar(g_symbol,SignalTimeframe,g_lastSignalBar))
      EvaluateNewEntry();
   EvaluatePendingEntry();
   UpdateChartPanel();
  }

double OnTester()
  {
   double trades=TesterStatistics(STAT_TRADES);
   double profit=TesterStatistics(STAT_PROFIT);
   double profitFactor=TesterStatistics(STAT_PROFIT_FACTOR);
   double equityDrawdownPct=TesterStatistics(STAT_EQUITY_DDREL_PERCENT);
   // An optimizer must not rank tiny or losing samples as high quality.
   if(trades<30.0)
      return -100000.0+trades;
   if(profit<=0.0 || profitFactor<1.20 || equityDrawdownPct>5.0)
      return -10000.0+profit-profitFactor-equityDrawdownPct;
   return profit*profitFactor*MathSqrt(trades)/(1.0+equityDrawdownPct);
  }
//+------------------------------------------------------------------+
