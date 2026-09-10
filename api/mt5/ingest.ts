import { ownerForBridgeToken } from '../../lib/bridge-token.js';
import { ingestJournal, type BridgePayload } from '../../lib/hosted-journal.js';

export default {
  async fetch(request: Request) {
    if (request.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 });
    const ownerUserId = await ownerForBridgeToken(request.headers.get('x-asheparte-bridge-token'));
    if (!ownerUserId) {
      return Response.json({ error: 'invalid_bridge_token' }, { status: 401 });
    }
    const length = Number(request.headers.get('content-length') ?? 0);
    if (length > 2 * 1024 * 1024) return Response.json({ error: 'payload_too_large' }, { status: 413 });
    try {
      const payload = await request.json() as BridgePayload;
      const result = await ingestJournal(payload, ownerUserId);
      return Response.json({ ok: true, acceptedDeals: result.accepted }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'invalid_payload';
      const status = message === 'demo_accounts_only' ? 403 : message === 'journal_storage_unavailable' ? 503 : 400;
      return Response.json({ error: message }, { status });
    }
  },
};
