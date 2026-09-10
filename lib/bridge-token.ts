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

async function initializeBridgeTokens() {
  const sql = database();
  await sql`CREATE TABLE IF NOT EXISTS journal_bridge_tokens (
    user_id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    token_last_four TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rotated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`ALTER TABLE journal_bridge_tokens ADD COLUMN IF NOT EXISTS bound_provider TEXT`;
  await sql`ALTER TABLE journal_bridge_tokens ADD COLUMN IF NOT EXISTS bound_server TEXT`;
  await sql`ALTER TABLE journal_bridge_tokens ADD COLUMN IF NOT EXISTS bound_login TEXT`;
  await sql`ALTER TABLE journal_bridge_tokens ADD COLUMN IF NOT EXISTS pending_provider TEXT`;
  await sql`ALTER TABLE journal_bridge_tokens ADD COLUMN IF NOT EXISTS pending_server TEXT`;
  await sql`ALTER TABLE journal_bridge_tokens ADD COLUMN IF NOT EXISTS pending_login TEXT`;
  await sql`ALTER TABLE journal_bridge_tokens ADD COLUMN IF NOT EXISTS pending_at TIMESTAMPTZ`;
  await sql`ALTER TABLE journal_bridge_tokens ADD COLUMN IF NOT EXISTS sync_code TEXT`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS journal_bridge_account_identity_unique
    ON journal_bridge_tokens (LOWER(bound_provider),LOWER(bound_server),bound_login)
    WHERE bound_login IS NOT NULL`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS journal_bridge_sync_code_unique
    ON journal_bridge_tokens (sync_code) WHERE sync_code IS NOT NULL`;
  return sql;
}

let bridgeSchemaPromise: ReturnType<typeof initializeBridgeTokens> | null = null;

function ensureBridgeTokens() {
  if (!bridgeSchemaPromise) {
    bridgeSchemaPromise = initializeBridgeTokens().catch((error) => {
      bridgeSchemaPromise = null;
      throw error;
    });
  }
  return bridgeSchemaPromise;
}

export type BridgeAccountIdentity = { provider: string; server: string; login: string };

function cleanIdentity(identity: BridgeAccountIdentity) {
  return {
    provider: identity.provider.trim().slice(0, 24),
    server: identity.server.trim().slice(0, 160),
    login: identity.login.trim().slice(0, 64),
  };
}

function maskedLogin(login: string) {
  return login.length <= 3 ? '•••' : `${login.slice(0, 3)}•••`;
}

export async function bridgeTokenStatus(userId: string) {
  const sql = database();
  const rows = await sql`SELECT token_last_four, created_at, rotated_at,
      bound_provider,bound_server,bound_login,pending_provider,pending_server,pending_login,pending_at,sync_code
    FROM journal_bridge_tokens WHERE user_id=${userId} LIMIT 1`;
  if (!rows.length) return { hasToken: false };
  return {
    hasToken: true,
    lastFour: String(rows[0].token_last_four),
    createdAt: rows[0].created_at,
    rotatedAt: rows[0].rotated_at,
    bindingStatus: rows[0].bound_login ? 'linked' : rows[0].pending_login ? 'pending' : 'unpaired',
    account: rows[0].bound_login ? {
      provider: String(rows[0].bound_provider),
      server: String(rows[0].bound_server),
      loginMasked: maskedLogin(String(rows[0].bound_login)),
    } : rows[0].pending_login ? {
      provider: String(rows[0].pending_provider),
      server: String(rows[0].pending_server),
      loginMasked: maskedLogin(String(rows[0].pending_login)),
    } : undefined,
    syncCode: rows[0].sync_code ? String(rows[0].sync_code) : undefined,
    pendingAt: rows[0].pending_at ?? undefined,
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

export async function approveBridgeAccount(userId: string) {
  const sql = await ensureBridgeTokens();
  const rows = await sql`SELECT pending_provider,pending_server,pending_login,sync_code
    FROM journal_bridge_tokens WHERE user_id=${userId} LIMIT 1`;
  if (!rows.length || !rows[0].pending_login) throw new Error('no_pending_account');
  const syncCode = rows[0].sync_code ? String(rows[0].sync_code) :
    `SYNC-${randomBytes(4).toString('hex').toUpperCase().slice(0, 4)}-${randomBytes(4).toString('hex').toUpperCase().slice(0, 4)}`;
  try {
    await sql`UPDATE journal_bridge_tokens SET
      bound_provider=pending_provider,bound_server=pending_server,bound_login=pending_login,
      pending_provider=NULL,pending_server=NULL,pending_login=NULL,pending_at=NULL,sync_code=${syncCode}
      WHERE user_id=${userId}`;
  } catch {
    throw new Error('account_already_linked');
  }
  return bridgeTokenStatus(userId);
}

export async function rejectPendingBridgeAccount(userId: string) {
  const sql = await ensureBridgeTokens();
  const token = `ash_live_${randomBytes(32).toString('base64url')}`;
  const tokenHash = hashBridgeToken(token);
  const lastFour = token.slice(-4);
  await sql`UPDATE journal_bridge_tokens SET
    token_hash=${tokenHash},token_last_four=${lastFour},rotated_at=NOW(),
    pending_provider=NULL,pending_server=NULL,pending_login=NULL,pending_at=NULL
    WHERE user_id=${userId} AND bound_login IS NULL`;
  return { ...(await bridgeTokenStatus(userId)), token, lastFour };
}

export async function resetUserJournal(userId: string) {
  const sql = await ensureBridgeTokens();
  const token = `ash_live_${randomBytes(32).toString('base64url')}`;
  const tokenHash = hashBridgeToken(token);
  const lastFour = token.slice(-4);
  const rows = await sql`WITH deleted_deals AS (
      DELETE FROM journal_deals WHERE owner_user_id=${userId} RETURNING 1
    ), deleted_accounts AS (
      DELETE FROM journal_accounts WHERE owner_user_id=${userId} RETURNING 1
    ), reset_token AS (
      INSERT INTO journal_bridge_tokens
        (user_id,token_hash,token_last_four,created_at,rotated_at,bound_provider,bound_server,bound_login,
         pending_provider,pending_server,pending_login,pending_at,sync_code)
      VALUES (${userId},${tokenHash},${lastFour},NOW(),NOW(),NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)
      ON CONFLICT (user_id) DO UPDATE SET
        token_hash=EXCLUDED.token_hash,token_last_four=EXCLUDED.token_last_four,
        created_at=NOW(),rotated_at=NOW(),bound_provider=NULL,bound_server=NULL,bound_login=NULL,
        pending_provider=NULL,pending_server=NULL,pending_login=NULL,pending_at=NULL,sync_code=NULL
      RETURNING 1
    ) SELECT
      (SELECT COUNT(*) FROM deleted_deals) AS deleted_deals,
      (SELECT COUNT(*) FROM deleted_accounts) AS deleted_accounts,
      (SELECT COUNT(*) FROM reset_token) AS reset_tokens`;
  return {
    token,
    lastFour,
    deletedDeals: Number(rows[0]?.deleted_deals ?? 0),
    deletedAccounts: Number(rows[0]?.deleted_accounts ?? 0),
  };
}

export async function authorizeBridgeAccount(token: string | null, identityInput: BridgeAccountIdentity) {
  if (!token || token.length < 32) throw new Error('invalid_bridge_token');
  const identity = cleanIdentity(identityInput);
  if (!identity.provider || !identity.server || !identity.login) throw new Error('account_identity_required');
  const legacy = process.env.ASHEPARTE_BRIDGE_TOKEN ?? '';
  if (legacy && token.length === legacy.length && timingSafeEqual(Buffer.from(token), Buffer.from(legacy))) {
    return { ownerUserId: 'legacy-demo', syncCode: 'LEGACY-DEMO' };
  }
  const sql = await ensureBridgeTokens();
  const rows = await sql`SELECT user_id,bound_provider,bound_server,bound_login,sync_code
    FROM journal_bridge_tokens WHERE token_hash=${hashBridgeToken(token)} LIMIT 1`;
  if (!rows.length) throw new Error('invalid_bridge_token');
  const row = rows[0];
  if (row.bound_login) {
    const matches = String(row.bound_provider).toLowerCase() === identity.provider.toLowerCase() &&
      String(row.bound_server).toLowerCase() === identity.server.toLowerCase() &&
      String(row.bound_login) === identity.login;
    if (!matches) throw new Error('account_binding_mismatch');
    return { ownerUserId: String(row.user_id), syncCode: String(row.sync_code ?? '') };
  }
  const conflicts = await sql`SELECT user_id FROM journal_bridge_tokens
    WHERE bound_login=${identity.login} AND LOWER(bound_provider)=LOWER(${identity.provider})
      AND LOWER(bound_server)=LOWER(${identity.server}) AND user_id<>${String(row.user_id)} LIMIT 1`;
  if (conflicts.length) throw new Error('account_already_linked');
  await sql`UPDATE journal_bridge_tokens SET
    pending_provider=${identity.provider},pending_server=${identity.server},pending_login=${identity.login},pending_at=NOW()
    WHERE user_id=${String(row.user_id)} AND bound_login IS NULL`;
  throw new Error('pairing_approval_required');
}

export async function ownerForBridgeToken(token: string | null) {
  if (!token || token.length < 32) return null;
  const legacy = process.env.ASHEPARTE_BRIDGE_TOKEN ?? '';
  if (legacy && token.length === legacy.length && timingSafeEqual(Buffer.from(token), Buffer.from(legacy))) return 'legacy-demo';
  const sql = await ensureBridgeTokens();
  const rows = await sql`SELECT user_id FROM journal_bridge_tokens WHERE token_hash=${hashBridgeToken(token)} LIMIT 1`;
  return rows.length ? String(rows[0].user_id) : null;
}
