import { neon } from '@neondatabase/serverless';

let schema: Promise<unknown> | undefined;
async function policyDatabase() {
  if (!process.env.DATABASE_URL) throw new Error('journal_storage_unavailable');
  const sql = neon(process.env.DATABASE_URL);
  schema ??= sql`CREATE TABLE IF NOT EXISTS journal_account_policies (
    user_id TEXT PRIMARY KEY, demo_only BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`.catch(error => { schema = undefined; throw error; });
  await schema;
  return sql;
}

export function validateTrainingMode(demoOnly: boolean, tradeMode: unknown) {
  if (typeof tradeMode !== 'number' || ![0, 1, 2].includes(tradeMode)) throw new Error('invalid_account_trade_mode');
  if (demoOnly && tradeMode !== 0) throw new Error('training_account_demo_only');
}

export async function assertTrainingAccountMode(userId: string, tradeMode: unknown) {
  const sql = await policyDatabase();
  const rows = await sql`SELECT demo_only FROM journal_account_policies WHERE user_id=${userId} LIMIT 1`;
  validateTrainingMode(rows[0]?.demo_only === true, tradeMode);
}

// Administrative provisioning only. Not exposed through an HTTP endpoint.
export async function provisionTrainingPolicy(userId: string) {
  const sql = await policyDatabase();
  await sql`INSERT INTO journal_account_policies (user_id,demo_only) VALUES (${userId},TRUE)
    ON CONFLICT (user_id) DO UPDATE SET demo_only=TRUE`;
}
