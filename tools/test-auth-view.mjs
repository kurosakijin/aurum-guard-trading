import test from 'node:test';
import assert from 'node:assert/strict';
import { authView } from '../lib/auth-view.ts';

test('initial auth never shows private workspace', () => {
  assert.equal(authView(false, undefined, null), 'loading');
  assert.equal(authView(false, true, null), 'loading');
});
test('login stays mounted through transient activation loading', () => {
  assert.equal(authView(true, false, null), 'login');
  assert.equal(authView(false, undefined, 'signed-out'), 'login');
  assert.equal(authView(false, false, 'signed-out'), 'login');
  assert.equal(authView(true, true, 'signed-out'), 'workspace');
});
test('failed login returns to login without opening workspace', () => {
  assert.equal(authView(true, false, 'signed-out'), 'login');
});
test('uncertain auth after a signed-in session hides private UI', () => {
  assert.equal(authView(false, undefined, 'signed-in'), 'loading');
  assert.equal(authView(false, true, 'signed-in'), 'loading');
  assert.equal(authView(true, false, 'signed-in'), 'login');
});
