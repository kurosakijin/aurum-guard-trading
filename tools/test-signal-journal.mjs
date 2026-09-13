import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSignalJournal, signalSummary } from '../lib/signal-journal.ts';

const created=(id='p1', fields={})=>({schema:1,type:'CREATED',planId:id,eventId:id+'/CREATED',version:'3.28',recordedAt:1700000000000,
  symbol:'XAUUSD',timeframe:'PERIOD_H1',strategy:'POC',direction:1,entry:100,stop:95,tp1:105,tp2:107.5,tp3:110.7,
  ruleScore:92,mtfScore:8,aiOpinion:'WAIT - NO CANDIDATE',explanation:'Rules passed; AI remains separate.',...fields});
const progress=(id,targets,outcome)=>({schema:1,type:'PROGRESS',planId:id,eventId:`${id}/${targets}/${outcome}`,recordedAt:1700000001000,targets,outcome});
const parse=(...rows)=>parseSignalJournal(rows.map(row=>JSON.stringify(row)).join('\n'));
test('preserves original plan and records SL after TP2 without counting TP3',()=>{
  const result=parse(created(),progress('p1',1,'ACTIVE'),progress('p1',2,'ACTIVE'),progress('p1',2,'SL'));
  assert.equal(result.plans[0].stop,95); assert.equal(result.plans[0].aiOpinion,'WAIT - NO CANDIDATE');
  assert.deepEqual(signalSummary(result.plans),{total:1,tp1:1,tp2:1,tp3:0,sl:1,unknown:0,unresolved:0});
});
test('retries and repeated imports do not inflate counts',()=>{
  const result=parse(created(),created('p1',{recordedAt:1700000000999}),progress('p1',3,'TP3'),progress('p1',3,'TP3'));
  assert.equal(result.duplicates,2); assert.equal(result.plans.length,1); assert.equal(signalSummary(result.plans).tp3,1);
});
test('unknown and unfinished plans are separate from completed outcomes',()=>{
  const result=parse(created(),progress('p1',1,'UNKNOWN'),created('p2'));
  assert.deepEqual(signalSummary(result.plans),{total:2,tp1:0,tp2:0,tp3:0,sl:0,unknown:1,unresolved:1});
});
test('truncated records and orphaned outcomes are reported, not invented',()=>{
  const result=parseSignalJournal(JSON.stringify(progress('missing',3,'TP3'))+'\n{"schema":\n'+JSON.stringify(created()));
  assert.equal(result.rejected,1); assert.equal(result.orphaned,1); assert.equal(result.plans[0].outcome,'ACTIVE');
});
test('conflicting snapshots cannot rewrite the original levels',()=>{
  const result=parse(created(),created('p1',{stop:96}));
  assert.equal(result.plans[0].stop,95); assert.equal(result.plans[0].outcome,'UNKNOWN');
});
test('invalid direction, levels, nonfinite prices and impossible outcomes are rejected',()=>{
  for(const patch of [{direction:0},{stop:101},{entry:Infinity},{tp2:104},{timeframe:'bad'},{ruleScore:101}]) assert.equal(parse(created('x',patch)).plans.length,0);
  assert.equal(parse(created(),progress('p1',1,'TP3')).plans[0].outcome,'UNKNOWN');
  assert.equal(parse(created(),progress('p1',3,'TP3'),progress('p1',2,'SL')).plans[0].outcome,'UNKNOWN');
  assert.throws(()=>parseSignalJournal('x'.repeat(10_000_001)));
});
test('sell plans and distinct chart IDs stay independent',()=>{
  const result=parse(created('chart1'),created('chart2',{direction:-1,stop:105,tp1:95,tp2:92.5,tp3:89.3}),progress('chart2',3,'TP3'));
  assert.equal(result.plans.length,2); assert.equal(signalSummary(result.plans).tp3,1);
});
test('imported text remains inert and no broker or storage APIs are used',()=>{
  const malicious='<img src=x onerror=alert(1)>';
  assert.equal(parse(created('p1',{aiOpinion:malicious})).plans[0].aiOpinion,malicious);
  const ui=readFileSync('components/signal-journal.tsx','utf8');
  assert.doesNotMatch(ui,/dangerouslySetInnerHTML|localStorage|sessionStorage|fetch\(/);
});
test('advisor journal is append-only, retry-safe, and not a broker upload',()=>{
  const source=readFileSync('advisor-templates/AurumGuardAnalysisAdvisor.mq5','utf8');
  const journal=source.slice(source.indexOf('string SignalJournalPath()'),source.indexOf('void PublishManualSetup('));
  assert.match(journal,/FILE_READ\|FILE_WRITE\|FILE_TXT\|FILE_ANSI\|FILE_SHARE_READ/);
  assert.match(journal,/FileSeek\(file,0,SEEK_END\)/); assert.match(journal,/FileFlush\(file\)/);
  assert.match(journal,/if\(!AppendSignalRecord\(record\)\) \{ SaveManualPlanState\(\); return false; \}/);
  assert.doesNotMatch(journal,/JournalBridgeToken|WebRequest|JournalPostPayload/);
  assert.match(source,/g_recordedPlanBar=\(datetime\)GlobalVariableGet/);
  assert.match(source,/TimeLocal\(\)>=g_planRemovalAt && FlushSignalProgress\(\)/);
});
test('actual advisor record format imports correctly and failed progress writes retry',()=>{
  const source=readFileSync('advisor-templates/AurumGuardAnalysisAdvisor.mq5','utf8');
  function extract(name) {
    const start=source.indexOf('{',source.indexOf(name+'(')); let end=start+1,depth=1;
    for(;depth;end++){if(source[end]==='{')depth++;if(source[end]==='}')depth--;}
    return source.slice(start+1,end-1).replace(/"\s*\r?\n\s*"/g,'" + "').replace(/\bstring\s+record\b/g,'let record').replace(/\bstring\s+outcome\b/g,'let outcome').replace(/\(long\)/g,'');
  }
  const run=new Function(`
    const records=[]; let fail=false, g_recordedPlanBar=0,g_recordedTargets=0,g_recordedOutcome=0,g_planOutcomeCode=0,g_manualTargets=0;
    const g_lastPublishedSignalBar=1,g_symbol='XAUUSD',POCSetupTimeframe='PERIOD_H1',SignalTimeframe='PERIOD_M1',UsePOCSweepSequence=true;
    const g_signalRoute='POC',g_lastSetupScore=92,g_lastMTFScore=8,g_aiPanelStatus='WAIT - NO CANDIDATE';
    const TimeGMT=()=>1700000000,JournalJsonString=JSON.stringify,SignalPlanId=bar=>'p'+bar,EnumToString=String,IntegerToString=String;
    const SaveManualPlanState=()=>{},AppendSignalRecord=record=>{if(fail)return false;records.push(record);return true;};
    const StringFormat=(format,...args)=>{let i=0;return format.replace(/%(?:I64d|d|s|\\.10f)/g,()=>String(args[i++]));};
    function begin(bar,direction,entry,stop,tp1,tp2,tp3){${extract('BeginSignalRecord')}}
    function flush(){${extract('FlushSignalProgress')}}
    begin(1,1,100,95,105,107.5,110.7);
    g_manualTargets=2; fail=true; const failed=flush(),cursorAfterFailure=g_recordedTargets;
    fail=false; const retried=flush(); flush();
    g_planOutcomeCode=1; flush();
    return {records,failed,cursorAfterFailure,retried};
  `);
  const result=run();
  assert.equal(result.failed,false); assert.equal(result.cursorAfterFailure,0); assert.equal(result.retried,true);
  assert.equal(result.records.length,3);
  const imported=parseSignalJournal(result.records.join('\n'));
  assert.equal(imported.rejected,0); assert.equal(imported.plans[0].outcome,'SL');
  assert.equal(imported.plans[0].targets,2);
});
