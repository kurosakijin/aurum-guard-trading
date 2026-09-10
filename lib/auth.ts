import { verifyToken } from '@clerk/backend';

export async function authenticatedUserId(request: Request) {
  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!token || !secretKey) return null;
  try {
    const claims = await verifyToken(token, { secretKey });
    return typeof claims.sub === 'string' && claims.sub ? claims.sub : null;
  } catch {
    return null;
  }
}
