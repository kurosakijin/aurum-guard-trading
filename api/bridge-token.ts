import { authenticatedUserId } from '../lib/auth.js';
import { approveBridgeAccount, bridgeTokenStatus, rejectPendingBridgeAccount, resetUserJournal, rotateBridgeToken } from '../lib/bridge-token.js';

export default {
  async fetch(request: Request) {
    const userId = await authenticatedUserId(request);
    if (!userId) return Response.json({ error: 'authentication_required' }, { status: 401 });
    try {
      if (request.method === 'GET') {
        return Response.json(await bridgeTokenStatus(userId), { headers: { 'Cache-Control': 'no-store' } });
      }
      if (request.method === 'POST') {
        return Response.json(await rotateBridgeToken(userId), { headers: { 'Cache-Control': 'no-store' } });
      }
      if (request.method === 'PATCH') {
        const body = await request.json().catch(() => ({})) as { action?: string };
        if (body.action === 'approve') return Response.json(await approveBridgeAccount(userId), { headers: { 'Cache-Control': 'no-store' } });
        if (body.action === 'reject') return Response.json(await rejectPendingBridgeAccount(userId), { headers: { 'Cache-Control': 'no-store' } });
        return Response.json({ error: 'invalid_action' }, { status: 400 });
      }
      if (request.method === 'DELETE') {
        const body = await request.json().catch(() => ({})) as { confirmation?: string };
        if (body.confirmation !== 'RESET JOURNAL') return Response.json({ error: 'confirmation_required' }, { status: 400 });
        return Response.json(await resetUserJournal(userId), { headers: { 'Cache-Control': 'no-store' } });
      }
      return Response.json({ error: 'method_not_allowed' }, { status: 405 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'token_service_unavailable';
      const status = ['no_pending_account'].includes(message) ? 400 : message === 'account_already_linked' ? 409 : 503;
      return Response.json({ error: message }, { status });
    }
  },
};
