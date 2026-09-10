import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('journal_storage_unavailable');
  return neon(url);
}

export function hashBridgeToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

async function ensureBridgeTokens() {
  const sql = database();
  await sql`CREATE TABLE IF NOT EXISTS journal_bridge_tokens (
    user_id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    token_last_four TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rotated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  return sql;
}

export async function bridgeTokenStatus(userId: string) {
  const sql = await ensureBridgeTokens();
  const rows = await sql`SELECT token_last_four, created_at, rotated_at
    FROM journal_bridge_tokens WHERE user_id=${userId} LIMIT 1`;
  if (!rows.length) return { hasToken: false };
  return {
    hasToken: true,
    lastFour: String(rows[0].token_last_four),
    createdAt: rows[0].created_at,
    rotatedAt: rows[0].rotated_at,
  };
}

export async function rotateBridgeToken(userId: string) {
  const sql = await ensureBridgeTokens();
  const token = `ash_live_${randomBytes(32).toString('base64url')}`;
  const tokenHash = hashBridgeToken(token);
  const lastFour = token.slice(-4);
  await sql`INSERT INTO journal_bridge_tokens (user_id,token_hash,token_last_four,created_at,rotated_at)
    VALUES (${userId},${tokenHash},${lastFour},NOW(),NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      token_hash=EXCLUDED.token_hash,token_last_four=EXCLUDED.token_last_four,rotated_at=NOW()`;
  return { token, lastFour };
}

export async function ownerForBridgeToken(token: string | null) {
  if (!token || token.length < 32) return null;
  const legacy = process.env.ASHEPARTE_BRIDGE_TOKEN ?? '';
  if (legacy && token.length === legacy.length && timingSafeEqual(Buffer.from(token), Buffer.from(legacy))) return 'legacy-demo';
  const sql = await ensureBridgeTokens();
  const rows = await sql`SELECT user_id FROM journal_bridge_tokens WHERE token_hash=${hashBridgeToken(token)} LIMIT 1`;
  return rows.length ? String(rows[0].user_id) : null;
}
