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

// Read-only authorization for personalized downloads. Never accepts the legacy token.
export async function personalBridgeTokenMatches(userId: string, token: string) {
  const sql = database();
  const rows = await sql`SELECT user_id FROM journal_bridge_tokens
    WHERE user_id=${userId} AND token_hash=${hashBridgeToken(token)} LIMIT 1`;
  return rows.length === 1;
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
  await sql`CREATE TABLE IF NOT EXISTS journal_bridge_accounts (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, provider TEXT NOT NULL,
    server TEXT NOT NULL, login TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')),
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), sync_code TEXT,
    UNIQUE(user_id,provider,server,login)
  )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS journal_approved_identity_unique
    ON journal_bridge_accounts(provider,server,login) WHERE status='approved'`;
  // Existing approvals survive the additive migration. Never approve old pending rows.
  await sql`INSERT INTO journal_bridge_accounts(id,user_id,provider,server,login,status,sync_code)
    SELECT 'legacy-' || user_id,user_id,LOWER(bound_provider),LOWER(bound_server),bound_login,'approved',sync_code
    FROM journal_bridge_tokens WHERE bound_login IS NOT NULL
    ON CONFLICT DO NOTHING`;
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
  const sql = await ensureBridgeTokens();
  const rows = await sql`SELECT token_last_four, created_at, rotated_at,
      bound_provider,bound_server,bound_login,pending_provider,pending_server,pending_login,pending_at,sync_code
    FROM journal_bridge_tokens WHERE user_id=${userId} LIMIT 1`;
  if (!rows.length) return { hasToken: false };
  const bindings = await sql`SELECT * FROM journal_bridge_accounts WHERE user_id=${userId} ORDER BY detected_at,id`;
  const present = (row: typeof bindings[number]) => ({ id: String(row.id), provider: String(row.provider), server: String(row.server), loginMasked: maskedLogin(String(row.login)), login: String(row.login) });
  const approved = bindings.filter(row => row.status === 'approved');
  const pending = bindings.filter(row => row.status === 'pending');
  return {
    hasToken: true,
    lastFour: String(rows[0].token_last_four),
    createdAt: rows[0].created_at,
    rotatedAt: rows[0].rotated_at,
    bindingStatus: approved.length ? 'linked' : pending.length ? 'pending' : 'unpaired',
    account: approved[0] ? present(approved[0]) : pending[0] ? present(pending[0]) : undefined,
    accounts: approved.map(present),
    pendingAccounts: pending.map(present),
    syncCode: approved[0]?.sync_code,
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

export async function approveBridgeAccount(userId: string, accountId: string) {
  const sql = await ensureBridgeTokens();
  const syncCode = `SYNC-${randomBytes(8).toString('hex').toUpperCase()}`;
  try {
    const updated = await sql`UPDATE journal_bridge_accounts SET status='approved',sync_code=${syncCode}
      WHERE user_id=${userId} AND id=${accountId} AND status='pending' RETURNING id`;
    if (!updated.length) throw new Error('no_pending_account');
  } catch (error) {
    if ((error as { code?: string }).code === '23505') throw new Error('account_already_linked');
    throw error;
  }
  return bridgeTokenStatus(userId);
}

export async function rejectPendingBridgeAccount(userId: string, accountId: string) {
  const sql = await ensureBridgeTokens();
  const updated = await sql`UPDATE journal_bridge_accounts SET status='rejected'
    WHERE user_id=${userId} AND id=${accountId} AND status='pending' RETURNING id`;
  if (!updated.length) throw new Error('no_pending_account');
  return bridgeTokenStatus(userId);
}

export async function resetUserJournal(userId: string) {
  const sql = await ensureBridgeTokens();
  const token = `ash_live_${randomBytes(32).toString('base64url')}`;
  const tokenHash = hashBridgeToken(token);
  const lastFour = token.slice(-4);
  const rows = await sql`WITH deleted_bindings AS (
      DELETE FROM journal_bridge_accounts WHERE user_id=${userId} RETURNING 1
    ), deleted_deals AS (
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
  const provider = identity.provider.toLowerCase();
  const server = identity.server.toLowerCase();
  const bindings = await sql`SELECT status,sync_code FROM journal_bridge_accounts
    WHERE user_id=${String(row.user_id)} AND provider=${provider} AND server=${server} AND login=${identity.login}`;
  if (bindings[0]?.status === 'approved') return { ownerUserId: String(row.user_id), syncCode: String(bindings[0].sync_code ?? '') };
  if (bindings[0]?.status === 'rejected') throw new Error('pairing_rejected');
  const conflicts = await sql`SELECT user_id FROM journal_bridge_accounts
    WHERE login=${identity.login} AND provider=${provider}
      AND server=${server} AND status='approved' AND user_id<>${String(row.user_id)} LIMIT 1`;
  if (conflicts.length) throw new Error('account_already_linked');
  await sql`INSERT INTO journal_bridge_accounts(id,user_id,provider,server,login,status)
    VALUES (${randomBytes(16).toString('hex')},${String(row.user_id)},${provider},${server},${identity.login},'pending')
    ON CONFLICT (user_id,provider,server,login) DO NOTHING`;
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
