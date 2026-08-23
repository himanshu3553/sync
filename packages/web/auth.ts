import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { z } from 'zod';
import { prisma } from '@flowbuddy/db';
import { verifyPassword } from '@/lib/password';
import { emailEnabled, emailField } from '@/lib/email';
import { createUserWithWorkspace } from '@/lib/workspace';

const credsSchema = z.object({
  // Canonicalised in the parse — the lookup below is `findUnique` on a case-SENSITIVE column, so an
  // un-normalised address here is an account that exists and can never be signed into.
  email: emailField,
  password: z.string().min(1),
});

/** Google sign-in is on only when the OAuth client is configured; the button hides otherwise. */
export const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

// Sessions are JWTs with no Auth.js adapter, so OAuth identities are reconciled to OUR User rows
// by hand in `signIn` (create-or-link) and `jwt` (swap the provider's id for ours in `sub`).
// Linking by email is deliberate and safe: Google only returns addresses it has verified, and the
// product decision is one user, both ways in — a password account and its Google login are the
// same person, never two accounts.
async function reconcileGoogleUser(profile: {
  email: string;
  providerAccountId: string;
  name?: string | null;
  image?: string | null;
}) {
  const email = emailField.parse(profile.email);
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await createUserWithWorkspace(email, null, {
      verified: true,
      name: profile.name,
      image: profile.image,
    });
  } else if (!user.emailVerified) {
    // Google vouches for the address — an unverified password account becomes verified by linking.
    user = await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
  }
  await prisma.account.upsert({
    where: {
      provider_providerAccountId: { provider: 'google', providerAccountId: profile.providerAccountId },
    },
    create: { userId: user.id, type: 'oauth', provider: 'google', providerAccountId: profile.providerAccountId },
    update: { userId: user.id },
  });
  return user;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' }, // required for the Credentials provider
  pages: { signIn: '/signin', error: '/signin' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (raw) => {
        const parsed = credsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        if (!user?.passwordHash) return null;
        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        // Verified-email gate (§3.6 Cut 3) — enforced ONLY when email delivery is configured
        // (RESEND_API_KEY set); keyless local dev auto-verifies at signup so nothing changes
        // there. signInAction pre-checks this case to show a friendly message; this is the
        // backstop that makes every sign-in path honor it.
        if (emailEnabled && !user.emailVerified) return null;
        return { id: user.id, email: user.email ?? undefined, name: user.name ?? undefined };
      },
    }),
    ...(googleEnabled ? [Google] : []),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== 'google') return true;
      if (!profile?.email || profile.email_verified === false) return false;
      await reconcileGoogleUser({
        email: profile.email,
        providerAccountId: account.providerAccountId,
        name: profile.name,
        image: typeof profile.picture === 'string' ? profile.picture : null,
      });
      return true;
    },
    async jwt({ token, account, profile }) {
      // First sign-in via Google: `sub` is Google's id at this point — replace it with our user id.
      if (account?.provider === 'google' && profile?.email) {
        const user = await prisma.user.findUnique({ where: { email: emailField.parse(profile.email) } });
        if (user) token.sub = user.id;
      }
      return token;
    },
    // Auth.js stores the user id in the standard JWT `sub` claim by default.
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
