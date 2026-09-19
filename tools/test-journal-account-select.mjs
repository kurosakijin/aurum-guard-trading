import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const source = readFileSync('components/journal-account-select.tsx', 'utf8').replaceAll('export ', '');
const js = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText;
const Select = new Function('React', `${js}; return JournalAccountSelect;`)(React);
const accounts = [
  {id:'first111111',provider:'MT5',server:'Broker',loginMasked:'123•••',mode:'live'},
  {id:'second222222',provider:'MT5',server:'Broker',loginMasked:'123•••',mode:'demo'},
];
const render = props => renderToStaticMarkup(React.createElement(Select, {id:'test-account',accounts,value:accounts[1].id,onChange:()=>{},...props}));

test('dropdown is visible for one account and omitted when unlinked',()=>{
  assert.match(render({accounts:accounts.slice(0,1),value:accounts[0].id}), /<select/);
  assert.equal(render({accounts:[]}), '');
});
test('both placements reflect the same selected account with distinct labels',()=>{
  for (const id of ['journal-account','connection-account']) {
    const html=render({id});
    assert.ok(html.includes(`for="${id}"`));
    assert.match(html, /value="second222222" selected=""/);
    assert.ok(html.includes('MT5 Real 123*** - Offline') && html.includes('MT5 Demo 123*** - Offline'));
    assert.ok(!html.includes(' · Broker · '));
  }
});

test('Live denotes a fresh heartbeat, not a real-money account',()=>{
  const fresh={...accounts[1],updatedAt:new Date().toISOString()};
  assert.ok(render({accounts:[fresh]}).includes('MT5 Demo 123*** - Live'));
  assert.ok(render({accounts:[{...fresh,updatedAt:'invalid'}]}).includes(' - Offline'));
  assert.ok(render({accounts:[{...fresh,updatedAt:new Date(Date.now()-180_000).toISOString()}]}).includes(' - Offline'));
});
test('switching exposes loading status and safe theme-aware styles',()=>{
  const html=render({loading:true});
  assert.ok(html.includes('aria-busy="true"'));
  assert.ok(html.includes('Loading selected account'));
  assert.ok(html.includes('bg-background') && html.includes('text-foreground'));
});
