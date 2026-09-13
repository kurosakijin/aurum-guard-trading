import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { validateTrainingMode } from '../lib/training-account.ts';

test('training account allows demo only; regular accounts retain live support',()=>{
  assert.doesNotThrow(()=>validateTrainingMode(true,0));
  for (const mode of [1,2]) assert.throws(()=>validateTrainingMode(true,mode),/training_account_demo_only/);
  for (const mode of [0,1,2]) assert.doesNotThrow(()=>validateTrainingMode(false,mode));
  for (const mode of [undefined,null,'0',false,3]) assert.throws(()=>validateTrainingMode(true,mode),/invalid_account_trade_mode/);
});
const raw=readFileSync('api/mt5/ingest.ts','utf8');
const compiled=ts.transpileModule(raw.replace(/^import .*;\r?\n/gm,'').replace('export default','return'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
test('live training input is rejected before pending pairing or journal mutations',async()=>{
  let pairings=0, writes=0;
  const api=new Function('authorizeBridgeAccount','ownerForBridgeToken','assertTrainingAccountMode','ingestJournal',compiled)(
    async()=>{pairings++;return {ownerUserId:'training',syncCode:'test'};},
    async token=>token==='test-token'?'training':null,
    async(_user,mode)=>validateTrainingMode(true,mode),async()=>{writes++;return {accepted:0};});
  const request=(tradeMode,token='test-token')=>new Request('https://local.test/api/mt5/ingest',{method:'POST',headers:{'x-asheparte-bridge-token':token,'Content-Type':'application/json'},body:JSON.stringify({account:{tradeMode},deals:[]})});
  assert.equal((await api.fetch(request(2))).status,403);
  assert.equal((await api.fetch(request(0,'wrong'))).status,401);
  assert.equal(pairings,0); assert.equal(writes,0);
  assert.equal((await api.fetch(request(0))).status,200);
  assert.equal(pairings,1); assert.equal(writes,1);
});
