import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import ts from 'typescript';

function load(path, names, dependencies) {
  const source = readFileSync(path, 'utf8').replace(/^import .*;\r?\n/gm, '').replaceAll('export ', '');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return new Function(...Object.keys(dependencies), `${js}; return {${names.join(',')}}`)(...Object.values(dependencies));
}

function bridgeFixture() {
  const bindings = [];
  const queries = [];
  const sql = async (strings, ...values) => {
    const query = strings.join('?').replace(/\s+/g, ' ').trim();
    queries.push({ query, values });
    if (/^(CREATE|ALTER)/.test(query) || query.includes("SELECT 'legacy-'")) return [];
    if (query.startsWith('SELECT user_id,bound_provider')) return [{ user_id: 'owner' }];
    if (query.startsWith('SELECT status,sync_code')) return bindings.filter(b => b.user === values[0] && b.provider === values[1] && b.server === values[2] && b.login === values[3]);
    if (query.startsWith('SELECT user_id FROM journal_bridge_accounts')) return bindings.filter(b => b.login === values[0] && b.provider === values[1] && b.server === values[2] && b.status === 'approved' && b.user !== values[3]);
    if (query.startsWith('INSERT INTO journal_bridge_accounts')) {
      const [id,user,provider,server,login] = values;
      if (!bindings.some(b => b.user===user && b.provider===provider && b.server===server && b.login===login)) bindings.push({id,user,provider,server,login,status:'pending'});
      return [];
    }
    if (query.startsWith('UPDATE journal_bridge_accounts')) {
      const approved = query.includes("status='approved'");
      const [user,id] = approved ? values.slice(1) : values;
      const row = bindings.find(b => b.user === user && b.id === id && b.status === 'pending');
      if (!row) return [];
      row.status = approved ? 'approved' : 'rejected';
      row.sync_code = approved ? values[0] : '';
      return [{id}];
    }
    if (query.startsWith('SELECT token_last_four')) return [{token_last_four:'test'}];
    if (query.startsWith('SELECT * FROM journal_bridge_accounts')) return bindings.filter(b=>b.user===values[0]).map(b=>({...b,user_id:b.user}));
    throw new Error(`Unexpected query: ${query}`);
  };
  process.env.DATABASE_URL = 'mock-database';
  const api = load('lib/bridge-token.ts', ['authorizeBridgeAccount','approveBridgeAccount','rejectPendingBridgeAccount','bridgeTokenStatus'], {createHash,randomBytes,timingSafeEqual,neon:()=>sql});
  return {api,bindings,queries};
}
const token = 'test'.repeat(16);
const identity = login => ({provider:'MT5',server:'Broker-Demo',login});

test('accounts queue independently; only the exact accepted identity is authorized',async()=>{
  const {api,bindings} = bridgeFixture();
  for(const login of ['12345','67890']) await assert.rejects(api.authorizeBridgeAccount(token,identity(login)),/pairing_approval_required/);
  assert.equal(bindings.length,2);
  await api.approveBridgeAccount('owner',bindings[0].id);
  assert.equal((await api.authorizeBridgeAccount(token,identity('12345'))).ownerUserId,'owner');
  await assert.rejects(api.authorizeBridgeAccount(token,identity('67890')),/pairing_approval_required/);
  await api.approveBridgeAccount('owner',bindings[1].id);
  assert.equal((await api.bridgeTokenStatus('owner')).accounts.length,2);
  assert.equal((await api.authorizeBridgeAccount(token,identity('67890'))).ownerUserId,'owner');
});

test('owner and stale request checks prevent accepting a different account',async()=>{
  const {api,bindings} = bridgeFixture();
  await assert.rejects(api.authorizeBridgeAccount(token,identity('12345')));
  await assert.rejects(api.approveBridgeAccount('other',bindings[0].id),/no_pending_account/);
  await assert.rejects(api.approveBridgeAccount('owner','missing'),/no_pending_account/);
  assert.equal(bindings[0].status,'pending');
});

test('rejection is durable and does not revoke other approved accounts',async()=>{
  const {api,bindings,queries} = bridgeFixture();
  for(const login of ['12345','67890']) await assert.rejects(api.authorizeBridgeAccount(token,identity(login)));
  await api.approveBridgeAccount('owner',bindings[0].id);
  await api.rejectPendingBridgeAccount('owner',bindings[1].id);
  await assert.rejects(api.authorizeBridgeAccount(token,identity('67890')),/pairing_rejected/);
  assert.equal((await api.authorizeBridgeAccount(token,identity('12345'))).ownerUserId,'owner');
  assert.ok(!queries.some(q=>q.query.startsWith('UPDATE journal_bridge_tokens')));
});

test('identities cannot be claimed across users; repeated detections are deduplicated',async()=>{
  const {api,bindings} = bridgeFixture();
  for(let i=0;i<2;i++) await assert.rejects(api.authorizeBridgeAccount(token,identity('12345')));
  assert.equal(bindings.length,1);
  bindings[0].user='other'; bindings[0].status='approved';
  await assert.rejects(api.authorizeBridgeAccount(token,identity('12345')),/account_already_linked/);
});

test('journal selection never falls back to another account when key is unauthorized',async()=>{
  let dealQueries=0;
  const sql=async(strings,...values)=>{
    const query=strings.join('?');
    if(query.includes('FROM journal_accounts')) { assert.equal(values[0],'owner'); return [{account_key:'owned',trade_mode:0}]; }
    dealQueries++; assert.equal(values[0],'owned'); assert.equal(values[1],'owner'); return [];
  };
  const {readJournal}=load('lib/hosted-journal.ts',['readJournal'],{createHash,neon:()=>sql});
  await assert.rejects(readJournal('owner','foreign'),/account_not_found/);
  assert.equal(dealQueries,0);
  const result=await readJournal('owner','owned');
  assert.equal(result.selectedAccountId,'owned'); assert.equal(result.accounts.length,1);
});
