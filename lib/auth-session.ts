export type SessionIdentity = {
  id?: string;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  app_metadata?: { provider?: string; providers?: string[] };
  identities?: Array<{ provider?: string }>;
};

export function sessionIsVerified(session: { user?: SessionIdentity | null } | null | undefined) {
  if (!session?.user) return false;
  const u = session.user;

  // Confirmed via timestamp
  if (u.email_confirmed_at || u.confirmed_at) return true;

  // Anonymous or OAuth providers (Google, Apple, etc.) are verified by external provider
  const provider = u.app_metadata?.provider;
  if (provider && provider !== "email") return true;

  // Check identities array for OAuth providers
  if (Array.isArray(u.identities) && u.identities.some((i) => i.provider && i.provider !== "email")) {
    return true;
  }

  return false;
}

/**
 * A persisted access token is not enough to open the app. Supabase must return
 * the same current user and that user must still meet Aniraku's confirmation rule.
 */
export function serverUserCanStartSession(
  session: { user?: SessionIdentity | null } | null | undefined,
  serverUser: SessionIdentity | null | undefined,
) {
  return Boolean(
    session?.user?.id
      && serverUser?.id
      && session.user.id === serverUser.id
      && sessionIsVerified({ user: serverUser }),
  );
}
