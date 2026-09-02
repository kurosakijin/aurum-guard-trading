//+------------------------------------------------------------------+
//|                                      AurumGuardAutoTrader.mq5    |
//|   H1 Gold entries + M15 manipulation safety + broker-side risk  |
//|   Educational automation. Demo-only by default.                  |
//+------------------------------------------------------------------+
#property copyright "Aurum Guard"
#property version   "1.00"
#property strict
#property description "H1 Gold pullback EA with Gold/Silver confirmation, M15 safety, news filter and risk-based sizing."

#include <Trade/Trade.mqh>

CTrade trade;

// --- Account and execution safety
input bool   AllowLiveTrading              = false;
input bool   EnableNewEntries              = true;
input ulong  MagicNumber                   = 26090315;
input double RiskPerTradePercent           = 0.25;
input double MaxDailyLossPercent           = 1.00;
input int    MaxTradesPerDay               = 2;
input double MaximumLots                   = 1.00;
input ulong  DeviationPoints               = 30;
input double MaxSpreadAsATR                = 0.08;

// --- Symbols and timeframes
input string TradeSymbol                   = "";       // Blank uses the chart symbol
input string SilverConfirmationSymbol      = "XAGUSD"; // Use your broker's exact symbol
input ENUM_TIMEFRAMES SignalTimeframe       = PERIOD_H1;
input ENUM_TIMEFRAMES SafetyTimeframe       = PERIOD_M15;
input bool   RequireGoldSilverSync          = true;
input int    SyncLookbackBars               = 5;
input int    SyncCorrelationLength          = 20;
input double MinimumMetalCorrelation        = 0.25;

// --- H1 precision entry
input int    FastEMAPeriod                  = 20;
input int    SlowEMAPeriod                  = 50;
input int    RSIPeriod                      = 14;
input int    ATRPeriod                      = 14;
input double PullbackBufferATR              = 0.35;
input double MaximumEntryDistanceATR        = 0.75;
input int    StructureLookback              = 7;
input double StopBufferATR                  = 0.10;
input double MinimumStopATR                 = 1.20;
input double FinalRewardRisk                = 2.14;

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
input bool   TakePartialAtTP1                = true;
input bool   TakePartialAtTP2                = true;
input double TP1ClosePercent                = 33.0;
input double TP2ClosePercent                = 33.0;
input bool   MoveStopToBreakEvenAtTP1        = true;
input int    BreakEvenOffsetPoints           = 5;

string   g_symbol = "";
datetime g_lastSignalBar = 0;
datetime g_lastSafetyBar = 0;
datetime g_safetyPauseUntil = 0;
datetime g_lastManageAttempt = 0;
string   g_safetyStatus = "CLEAR";
string   g_lastDecision = "WAITING FOR H1 CLOSE";

int g_fastHandle = INVALID_HANDLE;
int g_slowHandle = INVALID_HANDLE;
int g_rsiHandle = INVALID_HANDLE;
int g_atrHandle = INVALID_HANDLE;
int g_dailyEMAHandle = INVALID_HANDLE;
int g_safetyFastHandle = INVALID_HANDLE;
int g_safetySlowHandle = INVALID_HANDLE;
int g_safetyATRHandle = INVALID_HANDLE;

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
   double maximum=MathMin(SymbolInfoDouble(g_symbol,SYMBOL_VOLUME_MAX),MaximumLots);
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

double NormalizePrice(const double price)
  {
   int digits=(int)SymbolInfoInteger(g_symbol,SYMBOL_DIGITS);
   return NormalizeDouble(price,digits);
  }

bool ReadBuffer(const int handle,const int count,double &values[])
  {
   ArraySetAsSeries(values,true);
   return CopyBuffer(handle,0,0,count,values)==count;
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
   dayPnL=AccountInfoDouble(ACCOUNT_EQUITY)-dayStartBalance;
  }

bool DailyRiskAllowsEntry(string &reason)
  {
   double dayPnL=0.0,dayStartBalance=0.0;
   int entryCount=0;
   GetDailyStats(dayPnL,entryCount,dayStartBalance);
   if(dayStartBalance>0.0 && dayPnL<=-dayStartBalance*MaxDailyLossPercent/100.0)
     {
      reason="DAILY LOSS LOCK";
      return false;
     }
   if(entryCount>=MaxTradesPerDay)
     {
      reason="MAX TRADES REACHED";
      return false;
     }
   return true;
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

bool MetalsConfirmDirection(const int direction,string &reason)
  {
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
   double correlation=PearsonCorrelation(goldReturns,silverReturns,SyncCorrelationLength);
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

//+------------------------------------------------------------------+
//| H1 signal                                                        |
//+------------------------------------------------------------------+
bool EvaluateSignal(int &direction,double &atrValue,string &reason)
  {
   direction=0;
   int needed=MathMax(StructureLookback+5,60);
   MqlRates bars[],dailyBars[];
   double fast[],slow[],rsi[],atr[],dailyEMA[];
   if(!ReadRates(g_symbol,SignalTimeframe,needed,bars) || !ReadRates(g_symbol,PERIOD_D1,4,dailyBars) || !ReadBuffer(g_fastHandle,5,fast) || !ReadBuffer(g_slowHandle,5,slow) || !ReadBuffer(g_rsiHandle,5,rsi) || !ReadBuffer(g_atrHandle,5,atr) || !ReadBuffer(g_dailyEMAHandle,4,dailyEMA))
     {
      reason="INDICATOR DATA NOT READY";
      return false;
     }

   atrValue=atr[1];
   MqlRates candle=bars[1];
   double point=SymbolInfoDouble(g_symbol,SYMBOL_POINT);
   double body=MathMax(MathAbs(candle.close-candle.open),point);
   double lowerWick=MathMin(candle.open,candle.close)-candle.low;
   double upperWick=candle.high-MathMax(candle.open,candle.close);
   double range=candle.high-candle.low;
   bool dailyBull=dailyBars[1].close>dailyEMA[1];
   bool dailyBear=dailyBars[1].close<dailyEMA[1];
   bool trendBull=fast[1]>slow[1] && fast[1]>fast[2] && slow[1]>=slow[2];
   bool trendBear=fast[1]<slow[1] && fast[1]<fast[2] && slow[1]<=slow[2];

   bool longRetest=trendBull && dailyBull && candle.low<=fast[1]+atr[1]*PullbackBufferATR && candle.close>fast[1] && candle.close>slow[1] && candle.close>candle.open && lowerWick/body>=0.35 && candle.close-fast[1]<=atr[1]*MaximumEntryDistanceATR && rsi[1]>=52.0 && rsi[1]<=68.0 && range<=atr[1]*1.50;
   bool shortRetest=trendBear && dailyBear && candle.high>=fast[1]-atr[1]*PullbackBufferATR && candle.close<fast[1] && candle.close<slow[1] && candle.close<candle.open && upperWick/body>=0.35 && fast[1]-candle.close<=atr[1]*MaximumEntryDistanceATR && rsi[1]<=48.0 && rsi[1]>=32.0 && range<=atr[1]*1.50;

   if(longRetest)
      direction=1;
   else if(shortRetest)
      direction=-1;
   else
     {
      reason="NO CONFIRMED H1 RETEST";
      return false;
     }

   if(!MetalsConfirmDirection(direction,reason))
     {
      direction=0;
      return false;
     }
   return true;
  }

double CalculateVolume(const double entry,const double stop)
  {
   double tickSize=SymbolInfoDouble(g_symbol,SYMBOL_TRADE_TICK_SIZE);
   double tickValue=SymbolInfoDouble(g_symbol,SYMBOL_TRADE_TICK_VALUE_LOSS);
   if(tickValue<=0.0)
      tickValue=SymbolInfoDouble(g_symbol,SYMBOL_TRADE_TICK_VALUE);
   double stopDistance=MathAbs(entry-stop);
   if(tickSize<=0.0 || tickValue<=0.0 || stopDistance<=0.0)
      return 0.0;

   double riskMoney=AccountInfoDouble(ACCOUNT_EQUITY)*RiskPerTradePercent/100.0;
   double lossPerLot=(stopDistance/tickSize)*tickValue;
   if(lossPerLot<=0.0)
      return 0.0;
   // Never round a too-small risk size up to the broker minimum. Skipping the
   // trade is safer than silently risking more than the configured percentage.
   return NormalizeVolume(riskMoney/lossPerLot,false);
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

void OpenSignalTrade(const int direction,const double atrValue)
  {
   MqlTick tick;
   MqlRates bars[];
   if(!SymbolInfoTick(g_symbol,tick) || !ReadRates(g_symbol,SignalTimeframe,StructureLookback+3,bars))
     {
      g_lastDecision="QUOTE OR STRUCTURE DATA MISSING";
      return;
     }

   double entry=direction>0 ? tick.ask : tick.bid;
   double structure=direction>0 ? bars[1].low : bars[1].high;
   for(int i=2;i<=StructureLookback;i++)
      structure=direction>0 ? MathMin(structure,bars[i].low) : MathMax(structure,bars[i].high);

   double structuralStop=direction>0 ? structure-atrValue*StopBufferATR : structure+atrValue*StopBufferATR;
   double minimumStop=direction>0 ? entry-atrValue*MinimumStopATR : entry+atrValue*MinimumStopATR;
   double stop=direction>0 ? MathMin(structuralStop,minimumStop) : MathMax(structuralStop,minimumStop);
   double minimumBrokerDistance=(double)SymbolInfoInteger(g_symbol,SYMBOL_TRADE_STOPS_LEVEL)*SymbolInfoDouble(g_symbol,SYMBOL_POINT);
   if(direction>0 && entry-stop<minimumBrokerDistance)
      stop=entry-minimumBrokerDistance;
   if(direction<0 && stop-entry<minimumBrokerDistance)
      stop=entry+minimumBrokerDistance;

   entry=NormalizePrice(entry);
   stop=NormalizePrice(stop);
   double risk=MathAbs(entry-stop);
   double finalTarget=NormalizePrice(direction>0 ? entry+risk*FinalRewardRisk : entry-risk*FinalRewardRisk);
   double volume=CalculateVolume(entry,stop);
   if(volume<=0.0)
     {
      g_lastDecision="RISK SIZE BELOW BROKER MINIMUM";
      return;
     }

   bool requestSent=direction>0 ? trade.Buy(volume,g_symbol,0.0,stop,finalTarget,"AG H1 BUY") : trade.Sell(volume,g_symbol,0.0,stop,finalTarget,"AG H1 SELL");
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
   g_lastDecision=direction>0 ? "BUY OPENED WITH SL + TP3" : "SELL OPENED WITH SL + TP3";
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
   double risk=LoadState("RISK",MathAbs(finalTarget-entry)/FinalRewardRisk);
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
            if(valid)
               protectedStop=breakEvenStop;
           }
         trade.PositionModify(ticket,protectedStop,finalTarget);
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
         trade.PositionModify(ticket,PositionGetDouble(POSITION_SL),finalTarget);
      if(EnableTerminalAlerts)
         Alert("Aurum Guard ",g_symbol,": TP2 reached; remaining position targets TP3.");
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

   string reason="";
   if(!DailyRiskAllowsEntry(reason) || !SafetyAllowsEntry(reason) || IsUSDNewsBlocked(reason))
     {
      g_lastDecision=reason;
      return;
     }

   int direction=0;
   double atrValue=0.0;
   if(!EvaluateSignal(direction,atrValue,reason) || !SpreadAllowsEntry(atrValue,reason))
     {
      g_lastDecision=reason;
      return;
     }
   OpenSignalTrade(direction,atrValue);
  }

void UpdateChartPanel()
  {
   ENUM_ACCOUNT_TRADE_MODE mode=(ENUM_ACCOUNT_TRADE_MODE)AccountInfoInteger(ACCOUNT_TRADE_MODE);
   string modeText=mode==ACCOUNT_TRADE_MODE_REAL ? (AllowLiveTrading ? "REAL ENABLED" : "REAL LOCKED") : mode==ACCOUNT_TRADE_MODE_DEMO ? "DEMO" : "CONTEST";
   double dayPnL=0.0,dayStartBalance=0.0;
   int tradesToday=0;
   GetDailyStats(dayPnL,tradesToday,dayStartBalance);
   string pauseText=TimeCurrent()<g_safetyPauseUntil ? "PAUSED UNTIL "+TimeToString(g_safetyPauseUntil,TIME_MINUTES) : g_safetyStatus;
   Comment("AURUM GUARD AUTO TRADER\n",
           "Mode: ",modeText," | Symbol: ",g_symbol,"\n",
           "H1 decision: ",g_lastDecision,"\n",
           "M15 safety: ",pauseText,"\n",
           "Today: ",DoubleToString(dayPnL,2)," | Entries: ",tradesToday,"/",MaxTradesPerDay,"\n",
           "Risk/trade: ",DoubleToString(RiskPerTradePercent,2),"% | Daily lock: ",DoubleToString(MaxDailyLossPercent,2),"%\n",
           "No martingale. No instant revenge re-entry.");
  }

//+------------------------------------------------------------------+
//| Expert lifecycle                                                 |
//+------------------------------------------------------------------+
int OnInit()
  {
   if(RiskPerTradePercent<=0.0 || RiskPerTradePercent>2.0 || MaxDailyLossPercent<=0.0 || MaxDailyLossPercent>5.0 || FinalRewardRisk<=0.0)
     {
      Print("Aurum Guard: unsafe or invalid risk inputs.");
      return INIT_PARAMETERS_INCORRECT;
     }

   g_symbol=TradeSymbol=="" ? _Symbol : TradeSymbol;
   if(!SymbolSelect(g_symbol,true))
     {
      Print("Aurum Guard: cannot select trade symbol ",g_symbol);
      return INIT_FAILED;
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
   if(g_fastHandle==INVALID_HANDLE || g_slowHandle==INVALID_HANDLE || g_rsiHandle==INVALID_HANDLE || g_atrHandle==INVALID_HANDLE || g_dailyEMAHandle==INVALID_HANDLE || g_safetyFastHandle==INVALID_HANDLE || g_safetySlowHandle==INVALID_HANDLE || g_safetyATRHandle==INVALID_HANDLE)
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
  }

void OnTick()
  {
   ManageOpenPosition();
   if(IsNewBar(g_symbol,SafetyTimeframe,g_lastSafetyBar))
      EvaluateM15Safety();
   if(IsNewBar(g_symbol,SignalTimeframe,g_lastSignalBar))
      EvaluateNewEntry();
   UpdateChartPanel();
  }
//+------------------------------------------------------------------+
