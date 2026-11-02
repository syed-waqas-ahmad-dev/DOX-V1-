import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db/connect";
import { User } from "@/models/User";
import { UserRole } from "@/types";

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

if (process.env.NODE_ENV === "production" && !process.env.NEXTAUTH_SECRET?.trim()) {
  throw new Error("[SECURITY FATAL] NEXTAUTH_SECRET environment variable is missing in production.");
}

export const authOptions: NextAuthOptions = {
  providers: [
    ...(googleClientId && googleClientSecret
      ? [
          GoogleProvider({
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        await connectToDatabase();
        const cleanEmail = credentials.email.toLowerCase().trim();

        const user = await User.findOne({ email: cleanEmail }).select("+password +role");

        if (!user || !user.password) {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          return null;
        }

        const resolvedRole = user.role || UserRole.CUSTOMER;

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: resolvedRole,
          isEmailVerified: user.isEmailVerified || false,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        try {
          await connectToDatabase();
          const email = user.email?.toLowerCase().trim();
          if (!email) return false;

          // Validate trusted Google OIDC email_verified claim
          const isGoogleEmailVerified = Boolean((profile as any)?.email_verified);
          if (!isGoogleEmailVerified) {
            console.warn("[GOOGLE AUTH] Rejected Google sign-in: email_verified claim is missing or false.");
            return false;
          }

          let dbUser = (await User.findOne({ email }).lean()) as any;
          if (!dbUser) {
            const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
            const myReferralCode = `USR-${randomHex}`;
            const created = await User.create({
              name: user.name || "Google User",
              email: email,
              image: user.image || undefined,
              googleId: profile?.sub || account.providerAccountId,
              role: UserRole.CUSTOMER,
              isEmailVerified: true,
              referralCode: myReferralCode,
            });
            dbUser = created;
          }

          user.id = dbUser._id.toString();
          (user as any).role = dbUser.role || UserRole.CUSTOMER;
          (user as any).isEmailVerified = Boolean(dbUser.isEmailVerified);
          return true;
        } catch (err) {
          console.error("[GOOGLE AUTH] Error during signIn callback:", err);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || UserRole.CUSTOMER;
        token.isEmailVerified = (user as any).isEmailVerified || false;
      }

      // Safeguard: Ensure token.role is verified against database
      if (!token.role && token.email) {
        try {
          await connectToDatabase();
          const cleanEmail = token.email.toLowerCase().trim();
          const dbUser = (await User.findOne({ email: cleanEmail }).lean()) as any;
          token.role = dbUser?.role || UserRole.CUSTOMER;
          token.isEmailVerified = Boolean(dbUser?.isEmailVerified);
          if (dbUser?._id) token.id = dbUser._id.toString();
        } catch {
          token.role = UserRole.CUSTOMER;
          token.isEmailVerified = false;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) || UserRole.CUSTOMER;
        (session.user as any).isEmailVerified = !!token.isEmailVerified;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
};