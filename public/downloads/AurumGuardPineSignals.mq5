//+------------------------------------------------------------------+
//|                               AurumGuardPineSignals.mq5          |
//|   MT5 companion overlay for Aurum Guard's TradingView strategy  |
//|   Signals are confirmed on closed candles; this file never      |
//|   submits, changes, or closes an order.                          |
//+------------------------------------------------------------------+
#property copyright "Aurum Guard"
#property version   "1.00"
#property strict
#property indicator_chart_window
#property indicator_buffers 2
#property indicator_plots   2
#property indicator_label1  "Aurum Fast EMA"
#property indicator_type1   DRAW_LINE
#property indicator_color1  clrAqua
#property indicator_width1  2
#property indicator_label2  "Aurum Slow EMA"
#property indicator_type2   DRAW_LINE
#property indicator_color2  clrOrange
#property indicator_width2  2
#property description "Closed-candle P1/P2/P3 signals, liquidity, Fibonacci, Gold/Silver sync, M15 safety and trade-plan overlay."

// --- Symbols and decision clocks
input string          TradeSymbol                    = "";       // Blank uses chart symbol
input string          SilverConfirmationSymbol       = "XAGUSD"; // Broker's exact silver symbol
input ENUM_TIMEFRAMES SignalTimeframe                 = PERIOD_CURRENT;
input bool            AutoConfirmationTimeframe       = true;
input ENUM_TIMEFRAMES ManualConfirmationTimeframe     = PERIOD_M15;
input ulong           ExpertMagicNumber               = 26090315;

// --- Pine engines and filters
input bool   EnableP1Trend                            = true;
input bool   EnableP2Reversal                         = true;
input bool   EnableP3PostStopReset                    = true;
input bool   RequireGoldSilverSync                    = true;
input int    SyncLookbackBars                         = 5;
input int    SyncCorrelationLength                    = 20;
input double MinimumMetalCorrelation                  = 0.25;
input int    FastEMAPeriod                            = 20;
input int    SlowEMAPeriod                            = 50;
input int    RSIPeriod                                = 14;
input int    ATRPeriod                                = 14;
input int    EMASlopeBars                             = 3;
input int    TrendCooldownBars                        = 10;
input int    PivotLength                              = 5;
input int    StructureLookback                        = 7;
input double MinimumReversalWickBody                  = 1.50;
input int    ReversalTriggerExpiryBars                = 3;
input int    ReentryWaitBars                          = 1;
input int    ReentryScanBars                          = 12;
input int    ReentryTriggerExpiryBars                 = 2;
input double ReentrySizeReference                     = 0.50; // Display only; EA controls actual risk
input double StopBufferATR                            = 0.10;
input double TrendStopATR                             = 1.50;
input double FinalRewardRisk                          = 2.14;

// --- Entry and trade-health guards
input double NoChaseDistanceATR                       = 1.35;
input double TP1ApproachPercent                       = 0.75;
input double TP1GivebackPercent                       = 0.35;
input double HalfStopPercent                          = 0.50;

// --- M15 manipulation / blow-off safety
input bool   EnableM15Safety                          = true;
input ENUM_TIMEFRAMES SafetyTimeframe                 = PERIOD_M15;
input int    LiquidityLookback                        = 12;
input double ManipulationMinimumWickShare             = 0.45;
input double BlowOffRangeATR                          = 2.20;
input double BlowOffDistanceATR                       = 2.00;
input int    BlowOffVolumeWindow                      = 20;
input double BlowOffVolumeMultiple                    = 1.80;
input bool   RequireBlowOffVolume                     = true;
input double ShockRangeATR                            = 2.00;
input double ShockGapATR                              = 0.75;
input int    SafetyPauseBars                          = 3;

// --- Chart display
input bool   ShowEMA                                  = true;
input bool   ShowLiquidity                            = true;
input bool   ShowStructure                            = true;
input bool   ShowAutomaticFibonacci                   = true;
input bool   ShowFibonacciLabels                      = true;
input int    FibonacciProjectionBars                  = 35;
input bool   ShowSignalLabels                         = true;
input bool   ShowTradePlan                            = true;
input bool   ShowBadEntryWarnings                     = true;
input bool   ShowCompactPanel                         = true;
input bool   EnableTerminalAlerts                     = true;

double FastPlot[];
double SlowPlot[];

string          g_symbol="";
ENUM_TIMEFRAMES g_signalTf=PERIOD_M1;
ENUM_TIMEFRAMES g_confirmTf=PERIOD_M15;
datetime        g_lastSignalBar=0;
datetime        g_lastSafetyBar=0;
datetime        g_safetyPauseUntil=0;
datetime        g_lastP1Time=0;
datetime        g_lastProcessedStopTime=0;
string          g_safetyStatus="CLEAR";
string          g_metalsStatus="WAIT · DATA";
string          g_fibStatus="WAIT CONFIRMED SWINGS";
string          g_entryGuard="CLEAR";
string          g_lastSignal="NONE · KEEP WAITING";
string          g_lastAction="WAIT";
double          g_swingHigh=0.0;
double          g_swingLow=0.0;
datetime        g_swingHighTime=0;
datetime        g_swingLowTime=0;

int      g_pendingType=0;      // 2 = P2 reversal, 3 = P3 reset
int      g_pendingDirection=0; // +1 buy, -1 sell
double   g_pendingEntry=0.0;
double   g_pendingStop=0.0;
datetime g_pendingStartBar=0;
int      g_pendingExpiryBars=0;

bool     g_reentryArmed=false;
double   g_reentryRecoveryPrice=0.0;
datetime g_reentryStopTime=0;
int      g_reentryBarsElapsed=0;

bool g_tp1Approached=false;
bool g_tp1Reached=false;
bool g_tp1FailureWarned=false;
bool g_halfStopWarned=false;

int g_fastHandle=INVALID_HANDLE;
int g_slowHandle=INVALID_HANDLE;
int g_rsiHandle=INVALID_HANDLE;
int g_atrHandle=INVALID_HANDLE;
int g_confirmEMAHandle=INVALID_HANDLE;
int g_safetyFastHandle=INVALID_HANDLE;
int g_safetySlowHandle=INVALID_HANDLE;
int g_safetyATRHandle=INVALID_HANDLE;

const string PREFIX="AGPS_";

//+------------------------------------------------------------------+
//| Data helpers                                                     |
//+------------------------------------------------------------------+
bool ReadRates(const string symbol,const ENUM_TIMEFRAMES timeframe,const int count,MqlRates &rates[])
  {
   ArraySetAsSeries(rates,true);
   return CopyRates(symbol,timeframe,0,count,rates)==count;
  }

bool ReadBuffer(const int handle,const int count,double &values[])
  {
   ArraySetAsSeries(values,true);
   return handle!=INVALID_HANDLE && CopyBuffer(handle,0,0,count,values)==count;
  }

ENUM_TIMEFRAMES AutoConfirmTimeframe(const ENUM_TIMEFRAMES chartTf)
  {
   int seconds=PeriodSeconds(chartTf);
   if(seconds<=60)    return PERIOD_M15;
   if(seconds<=180)   return PERIOD_M30;
   if(seconds<=300)   return PERIOD_H1;
   if(seconds<=900)   return PERIOD_H4;
   if(seconds<=3600)  return PERIOD_D1;
   if(seconds<=86400) return PERIOD_W1;
   return PERIOD_MN1;
  }

string TFText(const ENUM_TIMEFRAMES timeframe)
  {
   string value=EnumToString(timeframe);
   StringReplace(value,"PERIOD_","");
   return value;
  }

double PearsonCorrelation(const double &left[],const double &right[],const int count)
  {
   if(count<2)
      return 0.0;
   double lm=0.0,rm=0.0;
   for(int i=0;i<count;i++)
     {
      lm+=left[i];
      rm+=right[i];
     }
   lm/=count;
   rm/=count;
   double covariance=0.0,lv=0.0,rv=0.0;
   for(int i=0;i<count;i++)
     {
      double ld=left[i]-lm;
      double rd=right[i]-rm;
      covariance+=ld*rd;
      lv+=ld*ld;
      rv+=rd*rd;
     }
   if(lv<=0.0 || rv<=0.0)
      return 0.0;
   return covariance/MathSqrt(lv*rv);
  }

int MetalsState(double &correlation)
  {
   correlation=0.0;
   if(!RequireGoldSilverSync)
     {
      g_metalsStatus="FILTER OFF";
      return 2;
     }
   int needed=SyncCorrelationLength+SyncLookbackBars+3;
   MqlRates gold[],silver[];
   if(!ReadRates(g_symbol,g_signalTf,needed,gold) || !ReadRates(SilverConfirmationSymbol,g_signalTf,needed,silver))
     {
      g_metalsStatus="WAIT · DATA";
      return 0;
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
   if(goldMove>0.0 && silverMove>0.0 && correlation>=MinimumMetalCorrelation)
     {
      g_metalsStatus=StringFormat("GOOD · BULLISH (%.2f)",correlation);
      return 1;
     }
   if(goldMove<0.0 && silverMove<0.0 && correlation>=MinimumMetalCorrelation)
     {
      g_metalsStatus=StringFormat("GOOD · BEARISH (%.2f)",correlation);
      return -1;
     }
   g_metalsStatus=StringFormat("WAIT · NOT SYNCED (%.2f)",correlation);
   return 0;
  }

bool HigherTrend(int &direction)
  {
   direction=0;
   MqlRates rates[];
   double ema[];
   if(!ReadRates(g_symbol,g_confirmTf,3,rates) || !ReadBuffer(g_confirmEMAHandle,3,ema))
      return false;
   if(rates[1].close>ema[1]) direction=1;
   if(rates[1].close<ema[1]) direction=-1;
   return direction!=0;
  }

//+------------------------------------------------------------------+
//| Chart-object helpers                                             |
//+------------------------------------------------------------------+
void DeletePrefix(const string prefix)
  {
   for(int i=ObjectsTotal(0,-1,-1)-1;i>=0;i--)
     {
      string name=ObjectName(0,i,-1,-1);
      if(StringFind(name,prefix)==0)
         ObjectDelete(0,name);
     }
  }

void StyleObject(const string name)
  {
   ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,name,OBJPROP_SELECTED,false);
   ObjectSetInteger(0,name,OBJPROP_HIDDEN,true);
  }

void DrawSegment(const string name,const datetime t1,const datetime t2,const double price,const color clr,const ENUM_LINE_STYLE style,const int width)
  {
   if(ObjectFind(0,name)<0)
      ObjectCreate(0,name,OBJ_TREND,0,t1,price,t2,price);
   else
     {
      ObjectMove(0,name,0,t1,price);
      ObjectMove(0,name,1,t2,price);
     }
   ObjectSetInteger(0,name,OBJPROP_RAY_LEFT,false);
   ObjectSetInteger(0,name,OBJPROP_RAY_RIGHT,false);
   ObjectSetInteger(0,name,OBJPROP_COLOR,clr);
   ObjectSetInteger(0,name,OBJPROP_STYLE,style);
   ObjectSetInteger(0,name,OBJPROP_WIDTH,width);
   StyleObject(name);
  }

void DrawPriceLine(const string name,const double price,const color clr,const ENUM_LINE_STYLE style,const int width,const string tooltip)
  {
   if(ObjectFind(0,name)<0)
      ObjectCreate(0,name,OBJ_HLINE,0,0,price);
   else
      ObjectSetDouble(0,name,OBJPROP_PRICE,price);
   ObjectSetInteger(0,name,OBJPROP_COLOR,clr);
   ObjectSetInteger(0,name,OBJPROP_STYLE,style);
   ObjectSetInteger(0,name,OBJPROP_WIDTH,width);
   ObjectSetString(0,name,OBJPROP_TOOLTIP,tooltip);
   StyleObject(name);
  }

void DrawText(const string name,const datetime when,const double price,const string text,const color clr,const int size,const ENUM_ANCHOR_POINT anchor)
  {
   if(ObjectFind(0,name)<0)
      ObjectCreate(0,name,OBJ_TEXT,0,when,price);
   else
      ObjectMove(0,name,0,when,price);
   ObjectSetString(0,name,OBJPROP_TEXT,text);
   ObjectSetString(0,name,OBJPROP_FONT,"Arial");
   ObjectSetInteger(0,name,OBJPROP_FONTSIZE,size);
   ObjectSetInteger(0,name,OBJPROP_COLOR,clr);
   ObjectSetInteger(0,name,OBJPROP_ANCHOR,anchor);
   StyleObject(name);
  }

void DrawSignal(const datetime when,const double price,const double atr,const int direction,const string tag,const color clr)
  {
   if(!ShowSignalLabels)
      return;
   string side=direction>0 ? "BUY" : "SELL";
   string name=PREFIX+"SIG_"+tag+"_"+StringFormat("%I64d",(long)when);
   double y=direction>0 ? price-atr*0.18 : price+atr*0.18;
   DrawText(name,when,y,side+" "+tag,clr,9,direction>0 ? ANCHOR_UPPER : ANCHOR_LOWER);
   if(EnableTerminalAlerts)
      Alert("Aurum Guard ",g_symbol," ",TFText(g_signalTf),": ",side," ",tag," confirmed on candle close.");
  }

void ClearPlan()
  {
   string names[]={"PLAN_ENTRY","PLAN_SL","PLAN_TP1","PLAN_TP2","PLAN_TP3"};
   for(int i=0;i<ArraySize(names);i++)
      ObjectDelete(0,PREFIX+names[i]);
  }

void DrawPlan(const int direction,const double entry,const double stop,const string tag)
  {
   if(!ShowTradePlan || entry<=0.0 || stop<=0.0)
      return;
   double risk=MathAbs(entry-stop);
   if(risk<=SymbolInfoDouble(g_symbol,SYMBOL_POINT))
      return;
   double tp1=direction>0 ? entry+risk : entry-risk;
   double tp2=direction>0 ? entry+risk*1.50 : entry-risk*1.50;
   double tp3=direction>0 ? entry+risk*FinalRewardRisk : entry-risk*FinalRewardRisk;
   DrawPriceLine(PREFIX+"PLAN_ENTRY",entry,clrGold,STYLE_SOLID,2,tag+" ENTRY");
   DrawPriceLine(PREFIX+"PLAN_SL",stop,clrRed,STYLE_SOLID,2,"SL");
   DrawPriceLine(PREFIX+"PLAN_TP1",tp1,clrLimeGreen,STYLE_DASH,1,"TP1 · 1R");
   DrawPriceLine(PREFIX+"PLAN_TP2",tp2,clrLimeGreen,STYLE_DASH,1,"TP2 · 1.5R");
   DrawPriceLine(PREFIX+"PLAN_TP3",tp3,clrLime,STYLE_SOLID,2,StringFormat("TP3 · %.2fR",FinalRewardRisk));
  }

void CreatePanelLabel(const string key,const int y,const string text,const color clr,const int size=8)
  {
   string name=PREFIX+"PANEL_"+key;
   if(ObjectFind(0,name)<0)
      ObjectCreate(0,name,OBJ_LABEL,0,0,0);
   ObjectSetInteger(0,name,OBJPROP_CORNER,CORNER_LEFT_LOWER);
   ObjectSetInteger(0,name,OBJPROP_ANCHOR,ANCHOR_LEFT_LOWER);
   ObjectSetInteger(0,name,OBJPROP_XDISTANCE,14);
   // Callers pass rows from top to bottom. Convert that top-based row into
   // a distance from the chart's lower edge so the panel stays bottom-left.
   ObjectSetInteger(0,name,OBJPROP_YDISTANCE,180-y);
   ObjectSetInteger(0,name,OBJPROP_COLOR,clr);
   ObjectSetInteger(0,name,OBJPROP_FONTSIZE,size);
   ObjectSetString(0,name,OBJPROP_FONT,"Consolas");
   ObjectSetString(0,name,OBJPROP_TEXT,text);
   StyleObject(name);
  }

//+------------------------------------------------------------------+
//| Structure, liquidity and Fibonacci                              |
//+------------------------------------------------------------------+
bool IsPivot(const MqlRates &rates[],const int shift,const int length,const bool highPivot)
  {
   double candidate=highPivot ? rates[shift].high : rates[shift].low;
   for(int i=1;i<=length;i++)
     {
      if(highPivot && (candidate<=rates[shift-i].high || candidate<=rates[shift+i].high)) return false;
      if(!highPivot && (candidate>=rates[shift-i].low || candidate>=rates[shift+i].low)) return false;
     }
   return true;
  }

int FindPivot(const MqlRates &rates[],const int count,const int length,const bool highPivot,const int occurrence)
  {
   int found=0;
   for(int shift=length+1;shift<count-length;shift++)
      if(IsPivot(rates,shift,length,highPivot))
        {
         if(found==occurrence) return shift;
         found++;
        }
   return -1;
  }

void UpdateChartMap()
  {
   int count=MathMax(160,PivotLength*8+20);
   MqlRates rates[];
   if(!ReadRates(g_symbol,g_signalTf,count,rates))
      return;
   int newestHigh=FindPivot(rates,count,PivotLength,true,0);
   int priorHigh=FindPivot(rates,count,PivotLength,true,1);
   int newestLow=FindPivot(rates,count,PivotLength,false,0);
   int priorLow=FindPivot(rates,count,PivotLength,false,1);
   if(newestHigh<0 || newestLow<0)
      return;

   g_swingHigh=rates[newestHigh].high;
   g_swingLow=rates[newestLow].low;
   g_swingHighTime=rates[newestHigh].time;
   g_swingLowTime=rates[newestLow].time;
   datetime rightTime=rates[0].time+FibonacciProjectionBars*PeriodSeconds(g_signalTf);

   if(ShowLiquidity)
     {
      DrawSegment(PREFIX+"LIQ_HIGH",g_swingHighTime,rightTime,g_swingHigh,clrMagenta,STYLE_SOLID,2);
      DrawSegment(PREFIX+"LIQ_LOW",g_swingLowTime,rightTime,g_swingLow,clrAqua,STYLE_SOLID,2);
     }
   else
     {
      ObjectDelete(0,PREFIX+"LIQ_HIGH");
      ObjectDelete(0,PREFIX+"LIQ_LOW");
     }

   if(ShowStructure)
     {
      if(priorHigh>=0)
         DrawText(PREFIX+"STRUCT_HIGH",g_swingHighTime,g_swingHigh,g_swingHigh>rates[priorHigh].high ? "HH" : "LH",g_swingHigh>rates[priorHigh].high ? clrLime : clrOrange,8,ANCHOR_LOWER);
      if(priorLow>=0)
         DrawText(PREFIX+"STRUCT_LOW",g_swingLowTime,g_swingLow,g_swingLow>rates[priorLow].low ? "HL" : "LL",g_swingLow>rates[priorLow].low ? clrAqua : clrRed,8,ANCHOR_UPPER);
     }
   else
     {
      ObjectDelete(0,PREFIX+"STRUCT_HIGH");
      ObjectDelete(0,PREFIX+"STRUCT_LOW");
     }

   if(!ShowAutomaticFibonacci || g_swingHigh==g_swingLow)
     {
      DeletePrefix(PREFIX+"FIB_");
      g_fibStatus="OFF";
      return;
     }

   bool bullish=g_swingHighTime>g_swingLowTime;
   double zero=bullish ? g_swingHigh : g_swingLow;
   double one=bullish ? g_swingLow : g_swingHigh;
   datetime startTime=MathMin(g_swingHighTime,g_swingLowTime);
   double levels[]={0.0,0.236,0.382,0.500,0.618,0.705,0.786,1.0};
   string labels[]={"0% SWING","23.6% WEAK","38.2% CONTINUATION","50% REACTION","61.8% GOLDEN","70.5% SNIPER","78.6% DEEP","100% FULL"};
   for(int i=0;i<ArraySize(levels);i++)
     {
      double price=zero+(one-zero)*levels[i];
      bool golden=(i==4 || i==5);
      color lineColor=golden ? clrGold : (i==3 ? clrAqua : (i==0 || i==7 ? clrSilver : clrMediumPurple));
      string base=PREFIX+"FIB_"+IntegerToString(i);
      DrawSegment(base,startTime,rightTime,price,lineColor,(i==0 || i==7) ? STYLE_SOLID : STYLE_DASH,golden || i==3 ? 2 : 1);
      if(ShowFibonacciLabels)
         DrawText(base+"_TXT",rightTime,price,labels[i]+"  "+DoubleToString(price,(int)SymbolInfoInteger(g_symbol,SYMBOL_DIGITS)),lineColor,7,ANCHOR_LEFT);
      else
         ObjectDelete(0,base+"_TXT");
     }
   double fib618=zero+(one-zero)*0.618;
   double fib705=zero+(one-zero)*0.705;
   MqlRates last[];
   if(ReadRates(g_symbol,g_signalTf,3,last) && last[1].low<=MathMax(fib618,fib705) && last[1].high>=MathMin(fib618,fib705))
      g_fibStatus=bullish ? "61.8–70.5 · BULL MAP" : "61.8–70.5 · BEAR MAP";
   else
      g_fibStatus=bullish ? "BULL PULLBACK MAP" : "BEAR PULLBACK MAP";
  }

//+------------------------------------------------------------------+
//| M15 safety                                                       |
//+------------------------------------------------------------------+
void EvaluateSafety()
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
      g_safetyStatus="WAIT · M15 DATA";
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
   double priorHigh=bars[2].high,priorLow=bars[2].low;
   for(int i=3;i<2+LiquidityLookback;i++)
     {
      priorHigh=MathMax(priorHigh,bars[i].high);
      priorLow=MathMin(priorLow,bars[i].low);
     }
   double averageVolume=0.0;
   for(int i=2;i<2+BlowOffVolumeWindow;i++) averageVolume+=(double)bars[i].tick_volume;
   averageVolume/=BlowOffVolumeWindow;
   bool volumeOK=!RequireBlowOffVolume || (averageVolume>0.0 && (double)candle.tick_volume>=averageVolume*BlowOffVolumeMultiple);
   bool buySideSweep=candle.high>priorHigh && candle.close<priorHigh && upperShare>=ManipulationMinimumWickShare && closeLocation<=0.45;
   bool sellSideSweep=candle.low<priorLow && candle.close>priorLow && lowerShare>=ManipulationMinimumWickShare && closeLocation>=0.55;
   bool blowOffTop=candle.high-fast[1]>=atr[1]*BlowOffDistanceATR && range>=atr[1]*BlowOffRangeATR && upperShare>=0.30 && closeLocation<=0.55 && fast[1]>slow[1] && volumeOK;
   bool blowOffBottom=fast[1]-candle.low>=atr[1]*BlowOffDistanceATR && range>=atr[1]*BlowOffRangeATR && lowerShare>=0.30 && closeLocation>=0.45 && fast[1]<slow[1] && volumeOK;
   bool shock=range>=atr[1]*ShockRangeATR || MathAbs(candle.open-bars[2].close)>=atr[1]*ShockGapATR;
   string warning="";
   color warningColor=clrOrange;
   if(blowOffTop) { warning="BLOW-OFF TOP · WAIT"; warningColor=clrMagenta; }
   else if(blowOffBottom) { warning="BLOW-OFF BOTTOM · WAIT"; warningColor=clrMagenta; }
   else if(buySideSweep) warning="MANIPULATION · AVOID LONG";
   else if(sellSideSweep) warning="MANIPULATION · AVOID SHORT";
   else if(shock) { warning="VOLATILITY SHOCK · WAIT"; warningColor=clrMagenta; }
   if(warning!="")
     {
      g_safetyStatus=warning;
      g_safetyPauseUntil=bars[0].time+SafetyPauseBars*PeriodSeconds(SafetyTimeframe);
      DrawText(PREFIX+"SAFE_"+StringFormat("%I64d",(long)candle.time),candle.time,blowOffBottom || sellSideSweep ? candle.low : candle.high,warning,warningColor,8,blowOffBottom || sellSideSweep ? ANCHOR_UPPER : ANCHOR_LOWER);
      if(EnableTerminalAlerts) Alert("Aurum Guard ",g_symbol,": ",warning,". No new setup until a fresh confirmation.");
     }
   else if(TimeCurrent()>=g_safetyPauseUntil)
      g_safetyStatus="CLEAR";
  }

bool SafetyClear()
  {
   return !EnableM15Safety || TimeCurrent()>=g_safetyPauseUntil;
  }

//+------------------------------------------------------------------+
//| Pine-style P1 / P2 / P3 decisions                               |
//+------------------------------------------------------------------+
void SetPending(const int type,const int direction,const double entry,const double stop,const datetime startBar,const int expiry)
  {
   g_pendingType=type;
   g_pendingDirection=direction;
   g_pendingEntry=entry;
   g_pendingStop=stop;
   g_pendingStartBar=startBar;
   g_pendingExpiryBars=expiry;
   g_lastSignal=StringFormat("P%d %s · ARMED",type,direction>0 ? "BUY" : "SELL");
   g_lastAction="WAIT TRIGGER";
   DrawPlan(direction,entry,stop,"P"+IntegerToString(type));
  }

void ClearPending()
  {
   g_pendingType=0;
   g_pendingDirection=0;
   g_pendingEntry=0.0;
   g_pendingStop=0.0;
   g_pendingStartBar=0;
   g_pendingExpiryBars=0;
  }

int BarsSince(const datetime start,const datetime current)
  {
   int seconds=MathMax(1,PeriodSeconds(g_signalTf));
   return (int)MathMax(0,(long)(current-start)/seconds);
  }

bool ProcessPending(const MqlRates &bars[],const double atr)
  {
   if(g_pendingType==0)
      return false;
   int age=BarsSince(g_pendingStartBar,bars[1].time);
   if(age>g_pendingExpiryBars)
     {
      int type=g_pendingType;
      ClearPending();
      ClearPlan();
      g_lastSignal="P"+IntegerToString(type)+" EXPIRED · KEEP WAITING";
      g_lastAction="WAIT";
      return false;
     }
   bool triggered=g_pendingDirection>0 ? bars[1].high>=g_pendingEntry : bars[1].low<=g_pendingEntry;
   if(!triggered || !SafetyClear())
      return false;
   int type=g_pendingType;
   int direction=g_pendingDirection;
   double entry=g_pendingEntry,stop=g_pendingStop;
   DrawSignal(bars[1].time,direction>0 ? bars[1].low : bars[1].high,atr,direction,"P"+IntegerToString(type),direction>0 ? clrLime : clrRed);
   DrawPlan(direction,entry,stop,"P"+IntegerToString(type));
   g_lastSignal=StringFormat("P%d %s · CONFIRMED",type,direction>0 ? "BUY" : "SELL");
   g_lastAction=direction>0 ? "BUY SIGNAL" : "SELL SIGNAL";
   ClearPending();
   if(type==3) g_reentryArmed=false;
   return true;
  }

datetime LatestOwnStopTime(double &exitPrice)
  {
   exitPrice=0.0;
   datetime latest=0;
   if(!HistorySelect(TimeCurrent()-86400*14,TimeCurrent()))
      return 0;
   for(int i=0;i<HistoryDealsTotal();i++)
     {
      ulong ticket=HistoryDealGetTicket(i);
      if(ticket==0 || HistoryDealGetString(ticket,DEAL_SYMBOL)!=g_symbol || (ulong)HistoryDealGetInteger(ticket,DEAL_MAGIC)!=ExpertMagicNumber)
         continue;
      ENUM_DEAL_ENTRY entry=(ENUM_DEAL_ENTRY)HistoryDealGetInteger(ticket,DEAL_ENTRY);
      ENUM_DEAL_REASON reason=(ENUM_DEAL_REASON)HistoryDealGetInteger(ticket,DEAL_REASON);
      datetime when=(datetime)HistoryDealGetInteger(ticket,DEAL_TIME);
      if((entry==DEAL_ENTRY_OUT || entry==DEAL_ENTRY_OUT_BY) && reason==DEAL_REASON_SL && when>latest)
        {
         latest=when;
         exitPrice=HistoryDealGetDouble(ticket,DEAL_PRICE);
        }
     }
   return latest;
  }

void DetectNewStop()
  {
   if(!EnableP3PostStopReset)
      return;
   double price=0.0;
   datetime when=LatestOwnStopTime(price);
   if(when<=0 || when<=g_lastProcessedStopTime)
      return;
   g_lastProcessedStopTime=when;
   g_reentryArmed=true;
   g_reentryRecoveryPrice=price;
   g_reentryStopTime=when;
   g_reentryBarsElapsed=0;
   ClearPending();
   ClearPlan();
   g_lastSignal="P3 RESET · WAIT 1 CLOSE";
   g_lastAction="WAIT";
   DrawText(PREFIX+"STOP_"+StringFormat("%I64d",(long)when),when,price,"SL HIT · P3 RESET",clrMagenta,8,ANCHOR_UPPER);
  }

bool FindOwnPosition(ulong &ticket)
  {
   ticket=0;
   for(int i=PositionsTotal()-1;i>=0;i--)
     {
      ulong candidate=PositionGetTicket(i);
      if(candidate>0 && PositionSelectByTicket(candidate) && PositionGetString(POSITION_SYMBOL)==g_symbol && (ulong)PositionGetInteger(POSITION_MAGIC)==ExpertMagicNumber)
        {
         ticket=candidate;
         return true;
        }
     }
   return false;
  }

void UpdateActiveTradePlan()
  {
   ulong ticket=0;
   if(!FindOwnPosition(ticket) || !PositionSelectByTicket(ticket))
      return;
   ENUM_POSITION_TYPE type=(ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
   int direction=type==POSITION_TYPE_BUY ? 1 : -1;
   double entry=PositionGetDouble(POSITION_PRICE_OPEN);
   double stop=PositionGetDouble(POSITION_SL);
   if(entry<=0.0 || stop<=0.0)
      return;
   DrawPlan(direction,entry,stop,"ACTIVE");
   g_lastAction=direction>0 ? "LONG ACTIVE" : "SHORT ACTIVE";

   double risk=MathAbs(entry-stop);
   double tp1=direction>0 ? entry+risk : entry-risk;
   MqlRates bars[];
   double fast[],rsi[];
   if(!ReadRates(g_symbol,g_signalTf,4,bars) || !ReadBuffer(g_fastHandle,4,fast) || !ReadBuffer(g_rsiHandle,4,rsi))
      return;
   if((direction>0 && bars[1].high>=tp1) || (direction<0 && bars[1].low<=tp1))
     {
      g_tp1Reached=true;
      g_tp1Approached=false;
     }
   if(!g_tp1Reached && ((direction>0 && bars[1].high>=entry+risk*TP1ApproachPercent) || (direction<0 && bars[1].low<=entry-risk*TP1ApproachPercent)))
      g_tp1Approached=true;
   if(!g_halfStopWarned && ((direction>0 && bars[1].low<=entry-risk*HalfStopPercent && bars[1].low>stop) || (direction<0 && bars[1].high>=entry+risk*HalfStopPercent && bars[1].high<stop)))
     {
      g_halfStopWarned=true;
      DrawText(PREFIX+"HEALTH_HALF_"+StringFormat("%I64d",(long)bars[1].time),bars[1].time,direction>0 ? bars[1].low : bars[1].high,"½ TO SL · RISK",clrRed,8,direction>0 ? ANCHOR_UPPER : ANCHOR_LOWER);
     }
   bool failed=!g_tp1Reached && g_tp1Approached && !g_tp1FailureWarned && ((direction>0 && bars[1].close<=entry+risk*TP1GivebackPercent && bars[1].close<bars[1].open && bars[1].close<bars[2].close && (bars[1].close<fast[1] || rsi[1]<50.0)) || (direction<0 && bars[1].close>=entry-risk*TP1GivebackPercent && bars[1].close>bars[1].open && bars[1].close>bars[2].close && (bars[1].close>fast[1] || rsi[1]>50.0)));
   if(failed)
     {
      g_tp1FailureWarned=true;
      DrawText(PREFIX+"HEALTH_FAIL_"+StringFormat("%I64d",(long)bars[1].time),bars[1].time,direction>0 ? bars[1].high : bars[1].low,"TP1 FAILED · REVERSE RISK",clrOrange,8,direction>0 ? ANCHOR_LOWER : ANCHOR_UPPER);
     }
  }

void EvaluateClosedBar()
  {
   int needed=MathMax(80,StructureLookback+PivotLength*2+10);
   MqlRates bars[];
   double fast[],slow[],rsi[],atr[];
   if(!ReadRates(g_symbol,g_signalTf,needed,bars) || !ReadBuffer(g_fastHandle,needed,fast) || !ReadBuffer(g_slowHandle,needed,slow) || !ReadBuffer(g_rsiHandle,needed,rsi) || !ReadBuffer(g_atrHandle,needed,atr))
     {
      g_lastSignal="WAIT · INDICATOR DATA";
      return;
     }
   UpdateChartMap();
   DetectNewStop();
   double correlation=0.0;
   int metals=MetalsState(correlation);
   int higher=0;
   bool higherReady=HigherTrend(higher);
   double atrBaseline=0.0;
   for(int i=2;i<52;i++) atrBaseline+=atr[i];
   atrBaseline/=50.0;
   bool trendVolatility=atr[1]>atrBaseline*0.65;
   bool reversalVolatility=atr[1]>atrBaseline*0.70;
   bool metalLong=!RequireGoldSilverSync || metals==1 || metals==2;
   bool metalShort=!RequireGoldSilverSync || metals==-1 || metals==2;
   bool safety=SafetyClear();

   if(ProcessPending(bars,atr[1]))
      return;

   ulong positionTicket=0;
   bool positionOpen=FindOwnPosition(positionTicket);
   if(positionOpen)
     {
      UpdateActiveTradePlan();
      return;
     }

   g_tp1Approached=false;
   g_tp1Reached=false;
   g_tp1FailureWarned=false;
   g_halfStopWarned=false;
   g_lastAction=safety ? "WAIT" : "NO TRADE";

   double body=MathMax(MathAbs(bars[1].close-bars[1].open),SymbolInfoDouble(g_symbol,SYMBOL_POINT));
   double lowerWick=MathMin(bars[1].open,bars[1].close)-bars[1].low;
   double upperWick=bars[1].high-MathMax(bars[1].open,bars[1].close);
   bool slowUp=slow[1]>slow[1+EMASlopeBars];
   bool slowDown=slow[1]<slow[1+EMASlopeBars];
   bool crossUp=fast[1]>slow[1] && fast[2]<=slow[2];
   bool crossDown=fast[1]<slow[1] && fast[2]>=slow[2];
   bool cooldown=g_lastP1Time==0 || BarsSince(g_lastP1Time,bars[1].time)>TrendCooldownBars;
   bool p1Long=EnableP1Trend && safety && cooldown && higherReady && higher==1 && trendVolatility && metalLong && crossUp && slowUp && rsi[1]>55.0;
   bool p1Short=EnableP1Trend && safety && cooldown && higherReady && higher==-1 && trendVolatility && metalShort && crossDown && slowDown && rsi[1]<45.0;

   bool bullishGuard=higher==1 && fast[1]>slow[1] && slowUp && bars[1].close>slow[1] && rsi[1]>=50.0;
   bool bearishGuard=higher==-1 && fast[1]<slow[1] && slowDown && bars[1].close<slow[1] && rsi[1]<=50.0;
   bool sweptLow=g_swingLow>0.0 && bars[1].low<g_swingLow && bars[1].close>g_swingLow;
   bool sweptHigh=g_swingHigh>0.0 && bars[1].high>g_swingHigh && bars[1].close<g_swingHigh;
   bool avoidShort=bullishGuard && (sweptLow || (bars[1].close<bars[1].open && bars[1].low<=fast[1] && bars[1].close>slow[1]));
   bool avoidLong=bearishGuard && (sweptHigh || (bars[1].close>bars[1].open && bars[1].high>=fast[1] && bars[1].close<slow[1]));
   bool noChaseLong=bullishGuard && bars[1].close>bars[1].open && bars[1].close-fast[1]>atr[1]*NoChaseDistanceATR;
   bool noChaseShort=bearishGuard && bars[1].close<bars[1].open && fast[1]-bars[1].close>atr[1]*NoChaseDistanceATR;
   g_entryGuard=avoidLong ? "AVOID LONG" : avoidShort ? "AVOID SHORT" : noChaseLong ? "NO CHASE LONG" : noChaseShort ? "NO CHASE SHORT" : "CLEAR";
   if(ShowBadEntryWarnings && (avoidLong || avoidShort || noChaseLong || noChaseShort))
      DrawText(PREFIX+"GUARD_"+StringFormat("%I64d",(long)bars[1].time),bars[1].time,avoidLong || noChaseShort ? bars[1].low : bars[1].high,g_entryGuard,clrOrange,7,avoidLong || noChaseShort ? ANCHOR_UPPER : ANCHOR_LOWER);

   if(p1Long || p1Short)
     {
      int direction=p1Long ? 1 : -1;
      double entry=bars[1].close;
      double structure=direction>0 ? bars[1].low : bars[1].high;
      for(int i=2;i<=StructureLookback;i++) structure=direction>0 ? MathMin(structure,bars[i].low) : MathMax(structure,bars[i].high);
      double structureStop=direction>0 ? structure-atr[1]*StopBufferATR : structure+atr[1]*StopBufferATR;
      double atrStop=direction>0 ? entry-atr[1]*TrendStopATR : entry+atr[1]*TrendStopATR;
      double stop=direction>0 ? MathMax(structureStop,atrStop) : MathMin(structureStop,atrStop);
      DrawSignal(bars[1].time,direction>0 ? bars[1].low : bars[1].high,atr[1],direction,"P1",direction>0 ? clrLime : clrRed);
      DrawPlan(direction,entry,stop,"P1");
      g_lastP1Time=bars[1].time;
      g_lastSignal=direction>0 ? "P1 BUY · CONFIRMED" : "P1 SELL · CONFIRMED";
      g_lastAction=direction>0 ? "BUY SIGNAL" : "SELL SIGNAL";
      g_reentryArmed=false;
      return;
     }

   double rsiRecentLow=rsi[1],rsiRecentHigh=rsi[1];
   for(int i=2;i<=4;i++)
     {
      rsiRecentLow=MathMin(rsiRecentLow,rsi[i]);
      rsiRecentHigh=MathMax(rsiRecentHigh,rsi[i]);
     }
   bool p2LongWatch=EnableP2Reversal && safety && reversalVolatility && higherReady && higher==1 && metalLong && sweptLow && bars[1].close>bars[1].open && lowerWick/body>=MinimumReversalWickBody && rsiRecentLow<35.0 && rsi[1]>35.0 && rsi[1]>rsi[2];
   bool p2ShortWatch=EnableP2Reversal && safety && reversalVolatility && higherReady && higher==-1 && metalShort && sweptHigh && bars[1].close<bars[1].open && upperWick/body>=MinimumReversalWickBody && rsiRecentHigh>65.0 && rsi[1]<65.0 && rsi[1]<rsi[2];
   if(p2LongWatch || p2ShortWatch)
     {
      int direction=p2LongWatch ? 1 : -1;
      double entry=direction>0 ? bars[1].high+SymbolInfoDouble(g_symbol,SYMBOL_POINT) : bars[1].low-SymbolInfoDouble(g_symbol,SYMBOL_POINT);
      double stop=direction>0 ? bars[1].low-2.0*SymbolInfoDouble(g_symbol,SYMBOL_POINT) : bars[1].high+2.0*SymbolInfoDouble(g_symbol,SYMBOL_POINT);
      SetPending(2,direction,entry,stop,bars[1].time,ReversalTriggerExpiryBars);
      DrawText(PREFIX+"WATCH_P2_"+StringFormat("%I64d",(long)bars[1].time),bars[1].time,direction>0 ? bars[1].low : bars[1].high,direction>0 ? "P2 BUY · WAIT TRIGGER" : "P2 SELL · WAIT TRIGGER",clrGold,8,direction>0 ? ANCHOR_UPPER : ANCHOR_LOWER);
      return;
     }

   if(g_reentryArmed)
     {
      g_reentryBarsElapsed=BarsSince(g_reentryStopTime,bars[1].time);
      if(g_reentryBarsElapsed>ReentryScanBars)
        {
         g_reentryArmed=false;
         g_lastSignal="P3 RESET EXPIRED";
        }
      else if(g_reentryBarsElapsed>=ReentryWaitBars && safety)
        {
         bool longCandidate=higher==1 && metalLong && bars[1].close>g_reentryRecoveryPrice && bars[1].close>bars[2].close && bars[1].close>fast[1] && fast[1]>fast[2] && rsi[1]>52.0 && bars[1].close>bars[1].open && !avoidLong && !noChaseLong;
         bool shortCandidate=higher==-1 && metalShort && bars[1].close<g_reentryRecoveryPrice && bars[1].close<bars[2].close && bars[1].close<fast[1] && fast[1]<fast[2] && rsi[1]<48.0 && bars[1].close<bars[1].open && !avoidShort && !noChaseShort;
         if(longCandidate || shortCandidate)
           {
            int direction=longCandidate ? 1 : -1;
            double entry=direction>0 ? bars[1].high+SymbolInfoDouble(g_symbol,SYMBOL_POINT) : bars[1].low-SymbolInfoDouble(g_symbol,SYMBOL_POINT);
            double stop=direction>0 ? bars[1].low-atr[1]*StopBufferATR : bars[1].high+atr[1]*StopBufferATR;
            SetPending(3,direction,entry,stop,bars[1].time,ReentryTriggerExpiryBars);
            DrawText(PREFIX+"WATCH_P3_"+StringFormat("%I64d",(long)bars[1].time),bars[1].time,direction>0 ? bars[1].low : bars[1].high,direction>0 ? "P3 BUY · WAIT TRIGGER" : "P3 SELL · WAIT TRIGGER",clrViolet,8,direction>0 ? ANCHOR_UPPER : ANCHOR_LOWER);
            return;
           }
         g_lastSignal="P3 RESET · SCANNING";
        }
     }
   else if(g_pendingType==0)
      g_lastSignal="NONE · KEEP WAITING";
  }

//+------------------------------------------------------------------+
//| Compact panel                                                    |
//+------------------------------------------------------------------+
void UpdatePanel()
  {
   if(!ShowCompactPanel)
     {
      DeletePrefix(PREFIX+"PANEL_");
      return;
     }
   string background=PREFIX+"PANEL_BG";
   if(ObjectFind(0,background)<0)
      ObjectCreate(0,background,OBJ_RECTANGLE_LABEL,0,0,0);
   ObjectSetInteger(0,background,OBJPROP_CORNER,CORNER_LEFT_LOWER);
   ObjectSetInteger(0,background,OBJPROP_ANCHOR,ANCHOR_LEFT_LOWER);
   ObjectSetInteger(0,background,OBJPROP_XDISTANCE,8);
   ObjectSetInteger(0,background,OBJPROP_YDISTANCE,18);
   ObjectSetInteger(0,background,OBJPROP_XSIZE,300);
   ObjectSetInteger(0,background,OBJPROP_YSIZE,154);
   ObjectSetInteger(0,background,OBJPROP_BGCOLOR,clrBlack);
   ObjectSetInteger(0,background,OBJPROP_BORDER_COLOR,clrDimGray);
   ObjectSetInteger(0,background,OBJPROP_BACK,false);
   StyleObject(background);

   ulong ticket=0;
   if(FindOwnPosition(ticket) && PositionSelectByTicket(ticket))
      g_lastAction=(ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY ? "LONG ACTIVE" : "SHORT ACTIVE";
   else if(!SafetyClear())
      g_lastAction="NO TRADE";

   datetime open=iTime(g_symbol,g_signalTf,0);
   int remaining=MathMax(0,PeriodSeconds(g_signalTf)-(int)(TimeCurrent()-open));
   string nextClose=StringFormat("%02d:%02d",remaining/60,remaining%60);
   string health=g_tp1Reached ? "TP1 REACHED" : g_tp1FailureWarned ? "TP1 FAILED" : g_halfStopWarned ? "HALF TO SL" : g_tp1Approached ? "TP1 APPROACHED" : "NORMAL";
   color actionColor=g_lastAction=="BUY SIGNAL" ? clrLime : g_lastAction=="SELL SIGNAL" ? clrRed : g_lastAction=="NO TRADE" ? clrMagenta : clrGold;
   CreatePanelLabel("TITLE",24,"AURUM GUARD · PINE → MT5",clrWhite,9);
   CreatePanelLabel("ACTION",42,"ACTION   "+g_lastAction,actionColor,8);
   CreatePanelLabel("SIGNAL",58,"SIGNAL   "+g_lastSignal,clrWhite,8);
   CreatePanelLabel("CLOCK",74,"CLOSE    "+TFText(g_signalTf)+"  "+nextClose,clrSilver,8);
   CreatePanelLabel("METALS",90,"METALS   "+g_metalsStatus,g_metalsStatus=="FILTER OFF" || StringFind(g_metalsStatus,"GOOD")>=0 ? clrLime : clrOrange,8);
   CreatePanelLabel("RISK",106,"SAFETY   "+g_safetyStatus,SafetyClear() ? clrLime : clrMagenta,8);
   CreatePanelLabel("GUARD",122,"GUARD    "+g_entryGuard,g_entryGuard=="CLEAR" ? clrLime : clrOrange,8);
   CreatePanelLabel("FIB",138,"FIB      "+g_fibStatus,clrGold,8);
   CreatePanelLabel("HEALTH",154,"HEALTH   "+health,health=="NORMAL" ? clrSilver : clrOrange,8);
  }

//+------------------------------------------------------------------+
//| Indicator lifecycle                                              |
//+------------------------------------------------------------------+
int OnInit()
  {
   if(FastEMAPeriod<2 || SlowEMAPeriod<=FastEMAPeriod || PivotLength<2 || ATRPeriod<2 || RSIPeriod<2 || FinalRewardRisk<=1.0)
      return INIT_PARAMETERS_INCORRECT;
   g_symbol=TradeSymbol=="" ? _Symbol : TradeSymbol;
   g_signalTf=SignalTimeframe==PERIOD_CURRENT ? (ENUM_TIMEFRAMES)_Period : SignalTimeframe;
   g_confirmTf=AutoConfirmationTimeframe ? AutoConfirmTimeframe(g_signalTf) : ManualConfirmationTimeframe;
   if(!SymbolSelect(g_symbol,true) || (RequireGoldSilverSync && !SymbolSelect(SilverConfirmationSymbol,true)))
      return INIT_FAILED;

   SetIndexBuffer(0,FastPlot,INDICATOR_DATA);
   SetIndexBuffer(1,SlowPlot,INDICATOR_DATA);
   ArraySetAsSeries(FastPlot,true);
   ArraySetAsSeries(SlowPlot,true);
   PlotIndexSetInteger(0,PLOT_DRAW_TYPE,ShowEMA ? DRAW_LINE : DRAW_NONE);
   PlotIndexSetInteger(1,PLOT_DRAW_TYPE,ShowEMA ? DRAW_LINE : DRAW_NONE);

   g_fastHandle=iMA(g_symbol,g_signalTf,FastEMAPeriod,0,MODE_EMA,PRICE_CLOSE);
   g_slowHandle=iMA(g_symbol,g_signalTf,SlowEMAPeriod,0,MODE_EMA,PRICE_CLOSE);
   g_rsiHandle=iRSI(g_symbol,g_signalTf,RSIPeriod,PRICE_CLOSE);
   g_atrHandle=iATR(g_symbol,g_signalTf,ATRPeriod);
   g_confirmEMAHandle=iMA(g_symbol,g_confirmTf,SlowEMAPeriod,0,MODE_EMA,PRICE_CLOSE);
   g_safetyFastHandle=iMA(g_symbol,SafetyTimeframe,FastEMAPeriod,0,MODE_EMA,PRICE_CLOSE);
   g_safetySlowHandle=iMA(g_symbol,SafetyTimeframe,SlowEMAPeriod,0,MODE_EMA,PRICE_CLOSE);
   g_safetyATRHandle=iATR(g_symbol,SafetyTimeframe,ATRPeriod);
   if(g_fastHandle==INVALID_HANDLE || g_slowHandle==INVALID_HANDLE || g_rsiHandle==INVALID_HANDLE || g_atrHandle==INVALID_HANDLE || g_confirmEMAHandle==INVALID_HANDLE || g_safetyFastHandle==INVALID_HANDLE || g_safetySlowHandle==INVALID_HANDLE || g_safetyATRHandle==INVALID_HANDLE)
      return INIT_FAILED;

   IndicatorSetString(INDICATOR_SHORTNAME,"Aurum Guard Pine Signals ["+TFText(g_signalTf)+"]");
   g_lastSignalBar=iTime(g_symbol,g_signalTf,0);
   g_lastSafetyBar=iTime(g_symbol,SafetyTimeframe,0);
   double lastStopPrice=0.0;
   g_lastProcessedStopTime=LatestOwnStopTime(lastStopPrice);
   EvaluateSafety();
   UpdateChartMap();
   UpdatePanel();
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   DeletePrefix(PREFIX);
   if(g_fastHandle!=INVALID_HANDLE) IndicatorRelease(g_fastHandle);
   if(g_slowHandle!=INVALID_HANDLE) IndicatorRelease(g_slowHandle);
   if(g_rsiHandle!=INVALID_HANDLE) IndicatorRelease(g_rsiHandle);
   if(g_atrHandle!=INVALID_HANDLE) IndicatorRelease(g_atrHandle);
   if(g_confirmEMAHandle!=INVALID_HANDLE) IndicatorRelease(g_confirmEMAHandle);
   if(g_safetyFastHandle!=INVALID_HANDLE) IndicatorRelease(g_safetyFastHandle);
   if(g_safetySlowHandle!=INVALID_HANDLE) IndicatorRelease(g_safetySlowHandle);
   if(g_safetyATRHandle!=INVALID_HANDLE) IndicatorRelease(g_safetyATRHandle);
  }

int OnCalculate(const int rates_total,const int prev_calculated,const datetime &time[],const double &open[],const double &high[],const double &low[],const double &close[],const long &tick_volume[],const long &volume[],const int &spread[])
  {
   if(rates_total<SlowEMAPeriod+60)
      return 0;
   int copiedFast=CopyBuffer(g_fastHandle,0,0,rates_total,FastPlot);
   int copiedSlow=CopyBuffer(g_slowHandle,0,0,rates_total,SlowPlot);
   if(copiedFast<=0 || copiedSlow<=0)
      return prev_calculated;

   datetime safetyBar=iTime(g_symbol,SafetyTimeframe,0);
   if(safetyBar>0 && safetyBar!=g_lastSafetyBar)
     {
      g_lastSafetyBar=safetyBar;
      EvaluateSafety();
     }
   datetime signalBar=iTime(g_symbol,g_signalTf,0);
   if(signalBar>0 && signalBar!=g_lastSignalBar)
     {
      g_lastSignalBar=signalBar;
      EvaluateClosedBar();
     }
   UpdateActiveTradePlan();
   UpdatePanel();
   ChartRedraw(0);
   return rates_total;
  }
//+------------------------------------------------------------------+
