export const validPersonalToken = (token: unknown): token is string => typeof token === 'string' && /^ash_live_[A-Za-z0-9_-]{43}$/.test(token);
const endpoint = 'https://asheparte-ai.vercel.app/api/mt5/ingest';

export function personalSettings(token: string) {
  if (!validPersonalToken(token)) throw new Error('invalid_token');
  // MT5 preset files use UTF-16LE; BOM included for reliable import on Windows.
  return Buffer.from('\ufeff; PRIVATE: contains your journal credential. Do not share.\r\nEnableJournalSync=true\r\nJournalEndpoint=' + endpoint + '\r\nJournalBridgeToken=' + token + '\r\nJournalSyncSeconds=60\r\n', 'utf16le');
}

export function personalSource(template: string, token: string) {
  if (!validPersonalToken(token)) throw new Error('invalid_token');
  const target = /^input string JournalBridgeToken\s*=\s*"";/gm;
  if ((template.match(target) ?? []).length !== 1) throw new Error('invalid_template');
  return '// PRIVATE: embedded journal credential. Do not share this file or compiled copies.\r\n' + template.replace(target, `input string JournalBridgeToken = "${token}";`);
}

// Small uncompressed ZIP writer. Entry names are fixed by the server, never user input.
export function zipFiles(files: { name: string; data: Uint8Array }[]) {
  const parts: Buffer[] = [], directory: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    if (!/^[A-Za-z0-9_.-]+$/.test(file.name)) throw new Error('invalid_filename');
    const name = Buffer.from(file.name), data = Buffer.from(file.data);
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4);
    local.writeUInt16LE(33, 12); // 1980-01-01 DOS date
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    parts.push(local, name, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    directory.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const centralData = Buffer.concat(directory), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralData.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, centralData, end]);
}

export const advisorReadme = `ASHEPARTE PERSONAL ADVISOR - ANALYSIS ONLY

PRIVATE: the .set file contains your journal bridge token. Do not share it.
1. Extract this ZIP. In MT5: File > Open Data Folder.
2. Copy AurumGuardAnalysisAdvisor.ex5 into MQL5/Experts and refresh Navigator.
3. Attach it to your Gold chart. In Inputs, click Load and select Asheparte-personal.set.
4. Check your broker's Gold/Silver symbol names and JournalProvider.
5. Tools > Options > Expert Advisors: allow WebRequest for https://asheparte-ai.vercel.app.
6. Keep MT5 open; approve the detected pairing in the site's Manage account.

Algo Trading is not required. This advisor does not place or manage trades.
Loading an MT5 chart template or another preset may override the token: load this preset last.
Rotating/revoking your token makes this preset stop syncing. Download again with the new key.
The preset is user-specific, but the standard .ex5 binary does not embed your key.
For the optional .mq5 download: compile with F7 in MetaEditor and check its Inputs on attachment.
Do not treat an embedded token as copy protection. Anyone holding it holds a credential.
`;
