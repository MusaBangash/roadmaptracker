import NextAuth, { CredentialsSignin } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { clientIp, loginLockFor, recordLogin } from "@/lib/login-guard";

/** Thrown when too many wrong passwords were tried; loginAction shows the wait time. */
export class LoginLocked extends CredentialsSignin {
  code = "locked";
}

const credentialsSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  password: z.string().min(8),
});

export const googleEnabled = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  // JWT sessions are required for email/password sign-in and keep Neon queries low.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login" },
  providers: [
    ...(googleEnabled
      ? [Google({ allowDangerousEmailAccountLinking: true })] // Google verifies email ownership
      : []),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        // Story 1: checked here too, so calling the sign-in endpoint directly can't skip the limit.
        const ip = clientIp(request?.headers);
        if ((await loginLockFor(email, ip)).locked) throw new LoginLocked();
        const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
        const ok = !!user?.passwordHash && await bcrypt.compare(password, user.passwordHash);
        // Recorded whether or not the email exists, so the limit never reveals which emails do.
        await recordLogin(email, ip, ok);
        return ok && user ? { id: user.id, name: user.name, email: user.email, image: user.image } : null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.uid = user.id;
        // A password reset raises session_version; logins made before it then stop working (getUser).
        const row = await db.query.users.findFirst({ where: eq(schema.users.id, user.id), columns: { sessionVersion: true } });
        token.sv = row?.sessionVersion ?? 0;
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      (session.user as { sv?: number }).sv = (token.sv as number | undefined) ?? 0;
      return session;
    },
  },
});
