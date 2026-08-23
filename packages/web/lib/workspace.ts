import { prisma } from '@flowbuddy/db';
import { hashPassword } from '@/lib/password';

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  return base || 'workspace';
}

/** Create a user and auto-create their workspace (single-user = single-workspace).
 *  `password` null = an OAuth-only user (Google); they can set one later via "Forgot password".
 *  `verified` = stamp `emailVerified` immediately (used when email delivery isn't configured —
 *  the verification requirement only exists where a verification email can actually be sent —
 *  and for OAuth users, whose provider already verified the address). */
export async function createUserWithWorkspace(
  email: string,
  password: string | null,
  opts: { verified?: boolean; name?: string | null; image?: string | null } = {},
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error('An account with this email already exists.');

  const passwordHash = password === null ? null : await hashPassword(password);
  const local = email.split('@')[0] ?? 'workspace';
  const slug = `${slugify(local)}-${Math.random().toString(36).slice(2, 7)}`;

  return prisma.user.create({
    data: {
      email,
      passwordHash,
      name: opts.name ?? undefined,
      image: opts.image ?? undefined,
      emailVerified: opts.verified ? new Date() : null,
      ownedWorkspaces: { create: { name: `${local}'s workspace`, slug } },
    },
    include: { ownedWorkspaces: true },
  });
}
