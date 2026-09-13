import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('advisor-templates/AurumGuardAnalysisAdvisor.mq5', 'utf8');
// Execute selected production MQL function bodies with only type/math syntax
// adapted to JS. These are logic regressions, not MT5 market/backtest results.
function body(name) {
  const start = source.indexOf('{', source.indexOf(name + '('));
  let depth = 1, end = start + 1;
  for (; depth; end++) { if (source[end] === '{') depth++; if (source[end] === '}') depth--; }
  return source.slice(start + 1, end - 1);
}
function js(text) {
  return text.replace('items[(left+right)/2]', 'items[Math.floor((left+right)/2)]')
    .replace(/\((?:int|double|ENUM_DEAL_TYPE)\)/g, '')
    .replace(/\bconst\s+(?:int|double|long|ulong|bool|ENUM_DEAL_TYPE)\s+/g, 'const ')
    .replace(/\b(?:int|double|long|ulong|bool|string|JournalCursorDeal)\s+(?=\w)/g, 'let ')
    .replace(/MathMax/g, 'Math.max').replace(/MathMin/g, 'Math.min');
}
const sort = new Function(`function JournalDealBefore(a,b){${js(body('JournalDealBefore'))}}
function SortJournalDeals(items,left,right){${js(body('SortJournalDeals'))}}
return items=>{if(items.length>1) SortJournalDeals(items,0,items.length-1); return items;};`)();
const batchCode = source.slice(source.indexOf('   const int safeLimit='), source.indexOf('   dealsJson+="]";') + '   dealsJson+="]";'.length);
const batch = new Function('ordered', 'lastTimeMsc', 'lastTicket', 'JournalMaxDeals', `
const total=ordered.length, DEAL_TYPE=0;
const HistoryDealGetInteger=()=>1, IsJournalTradeDeal=()=>true, JournalDealJson=t=>JSON.stringify(t);
${js(batchCode)}
return {tickets:JSON.parse(dealsJson), time:newestTimeMsc, ticket:newestTicket};`);

test('oldest unsent deals drain without skipping across batch boundaries', () => {
  const deals=sort(Array.from({length:501},(_,i)=>({ticket:i+1,time:1000+i})).reverse());
  let time=0, ticket=0, all=[];
  for(let i=0;i<3;i++) { const result=batch(deals,time,ticket,250); all.push(...result.tickets); time=result.time; ticket=result.ticket; }
  assert.deepEqual(all,Array.from({length:501},(_,i)=>i+1));
});
test('same-millisecond tickets are sorted and resume at the correct cursor', () => {
  const deals=sort([9,2,7,1,6].map(ticket=>({ticket,time:1000})));
  const first=batch(deals,0,0,2), next=batch(deals,first.time,first.ticket,2);
  assert.deepEqual(first.tickets,[1,2]); assert.deepEqual(next.tickets,[6,7]);
  assert.match(source,/newestTimeMsc==lastTimeMsc && newestTicket>lastTicket/);
});
test('failed uploads cannot advance the cursor', () => {
  assert.match(source,/if\(JournalPostPayload\(payload\) &&[\s\S]*?GlobalVariableSet\(g_journalTimeKey/);
  const deals=[{ticket:1,time:1000}]; assert.deepEqual(batch(deals,0,0,250),batch(deals,0,0,250));
});
test('structural stops are preserved or rejected, never clamped', () => {
  const code=body('PublishManualSetup');
  const fragment=code.slice(code.indexOf('   double stop='),code.indexOf('   double tp1='));
  const risk=new Function('entry','structureStop','signalATR','direction',`const NormalizePrice=x=>x, MinimumStopDistanceATR=.35; let g_lastDecision=''; ${js(fragment)} return {stop,risk};`);
  assert.deepEqual(risk(100,98,2,1),{stop:98,risk:2});
  assert.equal(risk(100,95,2,1),undefined);
  assert.equal(risk(100,101,2,1),undefined);
  assert.deepEqual(risk(100,102,2,-1),{stop:102,risk:2});
});
function observe(prices,direction=1) {
  const code=js(body('ObserveManualPlanTick'));
  return new Function('prices','direction',`
    let g_manualActive=true,g_manualDirection=direction,g_manualStop=direction>0?95:105;
    let g_manualTP1=direction>0?105:95,g_manualTP2=direction>0?107.5:92.5,g_manualTP3=direction>0?110:90;
    let g_manualTargets=0,g_manualOutcome='',g_planRemovalAt=0;
    const PrintFormat=()=>{},TimeLocal=()=>100,PeriodSeconds=()=>3600,PostSLPlanDisplayTimeframe=0,PostSLPlanDisplayBars=1;
    const StartPostSLPlanDisplay=()=>{g_manualActive=false;g_manualOutcome='SL';};
    function step(tick){${code}}
    for(const price of prices) step({bid:price,ask:price});
    return {active:g_manualActive,targets:g_manualTargets,outcome:g_manualOutcome};`)(prices,direction);
}
test('TP touches accumulate; TP3 retires the plan for both directions',()=>{
  assert.deepEqual(observe([105,107.5,110]),{active:false,targets:3,outcome:'TP3 OBSERVED'});
  assert.deepEqual(observe([95,92.5,90],-1),{active:false,targets:3,outcome:'TP3 OBSERVED'});
});
test('SL after TP1 preserves partial progress and later prices cannot revive it',()=>{
  assert.deepEqual(observe([105,95,110]),{active:false,targets:1,outcome:'SL'});
});
test('all routes share final validation and active plans cannot be replaced',()=>{
  assert.match(body('PublishManualSetup'),/if\(g_manualActive/);
  assert.match(body('PublishManualSetup'),/SharedSignalQuality\(direction,true/);
  assert.match(body('EvaluateSignal'),/SharedSignalQuality\(direction,false/);
  assert.doesNotMatch(body('EvaluateNewEntry'),/if\(g_planRemovalAt>TimeCurrent\(\)\)/);
  assert.match(body('MonitorManualPlanOutcome'),/UNKNOWN - DATA GAP/);
  assert.match(body('OnInit'),/RestoreManualPlanState/);
});
test('analysis-only entry exits before compiled-out legacy order code',()=>{
  const entry=body('OpenSignalTrade');
  assert.match(entry,/PublishManualSetup\([^;]+;\s*return;\s*#ifdef AURUM_GUARD_AUTO_TRADING_DISABLED/);
  assert.doesNotMatch(source,/#define\s+AURUM_GUARD_AUTO_TRADING_DISABLED/);
  assert.doesNotMatch(body('OnTick'),/ManageOpenPosition/);
});
test('metals and AI fail closed on mismatched or stale data',()=>{
  const metals=body('MetalsConfirmDirection'), ai=body('RefreshAIAnalysisContext');
  assert.match(metals,/gold\[i\].time!=silver\[i\].time/);
  assert.match(metals,/primaryBase!="XAU" \|\| confirmationBase!="XAG"/);
  assert.match(ai,/latestClosedBar-scoredBar>120/);
  assert.match(ai,/INVALID PROBABILITIES/);
});
test('delivery reclaim tracks the opposing leg origin through partial retracements',()=>{
  const detector=body('DetectDeliveryState');
  assert.match(detector,/bars\[i\].close>legOrigin && bars\[i\+1\].close<=legOrigin/);
  assert.match(detector,/patternLow=\(bullishDelivery \|\| bearishDelivery\) \? shiftedLow/);
  assert.doesNotMatch(detector,/bars\[1\].close>bars\[2\].high/);
});
