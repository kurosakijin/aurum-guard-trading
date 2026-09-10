import { authenticatedUserId } from '../lib/auth.js';
import { bridgeTokenStatus, rotateBridgeToken } from '../lib/bridge-token.js';

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
      return Response.json({ error: 'method_not_allowed' }, { status: 405 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'token_service_unavailable';
      return Response.json({ error: message }, { status: 503 });
    }
  },
};
