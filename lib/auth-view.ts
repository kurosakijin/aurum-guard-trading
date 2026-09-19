export type ResolvedAuthView = 'signed-in' | 'signed-out' | null;

// Clerk can temporarily unset isLoaded while SignIn is completing setActive.
// Keep the public login UI mounted, but never retain private UI on uncertain auth.
export function authView(loaded: boolean, signedIn: boolean | undefined, previous: ResolvedAuthView) {
  if (loaded) return signedIn ? 'workspace' : 'login';
  return previous === 'signed-out' ? 'login' : 'loading';
}
