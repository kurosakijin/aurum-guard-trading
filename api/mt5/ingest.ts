import { authorizeBridgeAccount } from '../../lib/bridge-token.js';
import { ingestJournal, type BridgePayload } from '../../lib/hosted-journal.js';

export default {
  async fetch(request: Request) {
    if (request.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 });
    const length = Number(request.headers.get('content-length') ?? 0);
    if (length > 2 * 1024 * 1024) return Response.json({ error: 'payload_too_large' }, { status: 413 });
    try {
      const payload = await request.json() as BridgePayload;
      const account = payload.account;
      const authorization = await authorizeBridgeAccount(request.headers.get('x-asheparte-bridge-token'), {
        provider: String(payload.provider ?? 'MT5'),
        server: String(account?.server ?? ''),
        login: String(account?.login ?? ''),
      });
      const result = await ingestJournal(payload, authorization.ownerUserId);
      return Response.json({ ok: true, syncCode: authorization.syncCode, acceptedDeals: result.accepted }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'invalid_payload';
      const status = message === 'invalid_bridge_token' ? 401 :
        message === 'demo_accounts_only' ? 403 :
        ['pairing_approval_required','account_binding_mismatch','account_already_linked'].includes(message) ? 409 :
        message === 'journal_storage_unavailable' ? 503 : 400;
      return Response.json({ error: message }, { status });
    }
  },
};
