import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import { advisorReadme, personalSettings, personalSource, validPersonalToken, zipFiles } from '../lib/advisor-package.ts';

// Synthetic credentials only; no network, production accounts or database writes.
const keyA = 'ash_live_' + 'a'.repeat(43), keyB = 'ash_live_' + 'b'.repeat(43);
const raw = await readFile(new URL('../api/advisor-download.ts', import.meta.url), 'utf8');
const executable = ts.transpileModule(raw.replace(/^import .*;\r?\n/gm, '').replace('export default', 'return'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
let templateReads = 0;
const handler = new Function('authenticatedUserId', 'personalBridgeTokenMatches', 'readFile', 'join', 'advisorReadme', 'personalSettings', 'personalSource', 'validPersonalToken', 'zipFiles', executable)(
  async request => request.headers.get('authorization') === 'Bearer session-a' ? 'user-a' : request.headers.get('authorization') === 'Bearer session-b' ? 'user-b' : null,
  async (user, token) => user === 'user-a' && token === keyA || user === 'user-b' && token === keyB,
  async (...args) => { templateReads++; return readFile(...args); }, join, advisorReadme, personalSettings, personalSource, validPersonalToken, zipFiles,
);
const request = (session, token, format = 'package') => new Request('https://local.test/api/advisor-download', { method: 'POST', headers: { Authorization: session ? 'Bearer ' + session : '', 'Content-Type': 'application/json' }, body: JSON.stringify({ token, format }) });
test('anonymous requests fail without loading advisor files', async () => {
  const before = templateReads;
  const response = await handler.fetch(request('', keyA));
  assert.equal(response.status, 401); assert.equal(templateReads, before);
  assert.match(response.headers.get('cache-control'), /no-store/);
});
test('wrong-owner and revoked keys fail before loading files', async () => {
  const before = templateReads;
  assert.equal((await handler.fetch(request('session-a', keyB))).status, 403);
  assert.equal((await handler.fetch(request('session-a', 'ash_live_' + 'x'.repeat(43)))).status, 403);
  assert.equal(templateReads, before);
});
test('malformed token, source injection and invalid formats are rejected', async () => {
  assert.equal((await handler.fetch(request('session-a', '\"; malicious();'))).status, 400);
  assert.equal((await handler.fetch(request('session-a', keyA, '../secret'))).status, 400);
  assert.throws(() => personalSource('input string JournalBridgeToken = "";', keyA + '\n'));
});
test('personalized source changes only the empty token declaration plus private warning', async () => {
  const template = await readFile('advisor-templates/AurumGuardAnalysisAdvisor.mq5', 'utf8');
  const response = await handler.fetch(request('session-a', keyA, 'source'));
  assert.equal(response.status, 200);
  const source = await response.text();
  assert.equal(source.split(keyA).length, 2);
  assert.ok(!source.includes(keyB));
  assert.equal(source, personalSource(template, keyA));
  assert.equal(response.headers.get('vercel-cdn-cache-control'), 'no-store');
  assert.match(response.headers.get('content-disposition'), /attachment/);
  assert.throws(() => personalSource('no token input', keyA));
});
test('MT5 preset is BOM-marked UTF16LE with exact inputs and CRLF', () => {
  const settings = personalSettings(keyA);
  assert.equal(settings.readUInt16LE(), 0xfeff);
  const text = settings.toString('utf16le');
  assert.ok(text.includes('JournalBridgeToken=' + keyA + '\r\n'));
  assert.ok(text.includes('EnableJournalSync=true\r\n'));
});
test('ZIP contains original binary, private preset and instructions with valid CRCs', async () => {
  const response = await handler.fetch(request('session-a', keyA));
  assert.equal(response.status, 200);
  const zip = Buffer.from(await response.arrayBuffer());
  const contents = new Map();
  let offset = 0;
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    const length = zip.readUInt32LE(offset + 18), nameLength = zip.readUInt16LE(offset + 26);
    const name = zip.subarray(offset + 30, offset + 30 + nameLength).toString();
    const data = zip.subarray(offset + 30 + nameLength, offset + 30 + nameLength + length);
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ ((crc & 1) * 0xedb88320);
    }
    assert.equal((crc ^ 0xffffffff) >>> 0, zip.readUInt32LE(offset + 14));
    contents.set(name, data); offset += 30 + nameLength + length;
  }
  assert.equal(zip.readUInt32LE(offset), 0x02014b50);
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
  assert.equal(zip.readUInt16LE(zip.length - 12), 3);
  assert.equal(contents.size, 3);
  assert.deepEqual(contents.get('AurumGuardAnalysisAdvisor.ex5'), await readFile('advisor-templates/AurumGuardAnalysisAdvisor.ex5'));
  assert.deepEqual(contents.get('Asheparte-personal.set'), personalSettings(keyA));
  assert.equal(contents.get('INSTALL.txt').toString(), advisorReadme);
});
test('no token retrieval, rotation or public advisor template during downloads', async () => {
  assert.doesNotMatch(raw, /rotateBridgeToken|console\./);
  const bridge = await readFile('lib/bridge-token.ts', 'utf8');
  assert.match(bridge, /WHERE user_id=\$\{userId\} AND token_hash=\$\{hashBridgeToken\(token\)\}/);
  await assert.rejects(readFile('public/downloads/AurumGuardAnalysisAdvisor.ex5'));
  await assert.rejects(readFile('public/downloads/AurumGuardAnalysisAdvisor.mq5'));
});
