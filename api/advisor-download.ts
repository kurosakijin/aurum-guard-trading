import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { authenticatedUserId } from '../lib/auth.js';
import { personalBridgeTokenMatches } from '../lib/bridge-token.js';
import { advisorReadme, personalSettings, personalSource, validPersonalToken, zipFiles } from '../lib/advisor-package.js';

const privateHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
const failure = (error: string, status: number) => Response.json({ error }, { status, headers: privateHeaders });

export default {
  async fetch(request: Request) {
    if (request.method !== 'POST') return failure('method_not_allowed', 405);
    const userId = await authenticatedUserId(request);
    if (!userId) return failure('authentication_required', 401);
    try {
      if (Number(request.headers.get('content-length')) > 4096) return failure('invalid_request', 400);
      const raw = await request.text();
      if (raw.length > 4096) return failure('invalid_request', 400);
      let body: { token?: unknown; format?: unknown };
      try { body = JSON.parse(raw); } catch { return failure('invalid_request', 400); }
      if (!body || !validPersonalToken(body.token) || !['package', 'source'].includes(String(body.format))) return failure('invalid_request', 400);
      if (!await personalBridgeTokenMatches(userId, body.token)) return failure('token_mismatch_or_revoked', 403);
      const templateRoot = join(process.cwd(), 'advisor-templates');
      let content: Uint8Array;
      let filename: string;
      if (body.format === 'source') {
        const source = await readFile(join(templateRoot, 'AurumGuardAnalysisAdvisor.mq5'), 'utf8');
        content = Buffer.from(personalSource(source, body.token), 'utf8');
        filename = 'AurumGuardAnalysisAdvisor-personal.mq5';
      } else {
        const binary = await readFile(join(templateRoot, 'AurumGuardAnalysisAdvisor.ex5'));
        content = zipFiles([
          { name: 'AurumGuardAnalysisAdvisor.ex5', data: binary },
          { name: 'Asheparte-personal.set', data: personalSettings(body.token) },
          { name: 'INSTALL.txt', data: Buffer.from(advisorReadme, 'utf8') },
        ]);
        filename = 'Asheparte-personal-advisor.zip';
      }
      return new Response(new Uint8Array(content).buffer, { headers: { ...privateHeaders,
        'Content-Type': body.format === 'source' ? 'application/octet-stream' : 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      } });
    } catch {
      // Never reflect a token, file contents, database errors or credential-bearing payloads.
      return failure('download_unavailable', 503);
    }
  },
};
