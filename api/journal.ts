import { authenticatedUserId } from '../lib/auth.js';
import { readJournal } from '../lib/hosted-journal.js';

export default {
  async fetch(request: Request) {
    if (request.method !== 'GET') return Response.json({ error: 'method_not_allowed' }, { status: 405 });
    const userId = await authenticatedUserId(request);
    if (!userId) return Response.json({ error: 'authentication_required' }, { status: 401 });
    try {
      return Response.json(await readJournal(userId), {
        headers: { 'Cache-Control': 'no-store, max-age=0', 'CDN-Cache-Control': 'no-store' },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'journal_unavailable';
      return Response.json({ connected: false, error: message }, { status: 503 });
    }
  },
};
