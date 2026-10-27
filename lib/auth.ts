import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db/connect";
import { User } from "@/models/User";
import { UserRole } from "@/types";

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

// Verified platform owners and super administrators
const SUPER_ADMIN_EMAILS = [
  "waqasahmad21103@gmail.com",
  "ahmadsyedwaqas4@gmail.com",
  "ali@ali.com",
];

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
          console.log("[AUTH] FAIL: User not found for email:", cleanEmail);
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          console.log("[AUTH] FAIL: Invalid password for email:", cleanEmail);
          return null;
        }

        const isSuperAdminEmail = SUPER_ADMIN_EMAILS.includes(cleanEmail);
        const resolvedRole = isSuperAdminEmail ? "super_admin" : (user.role || "customer");

        console.log("[AUTH] SUCCESS:", user.email, "| RESOLVED ROLE:", resolvedRole);

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: resolvedRole,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET || "ox-shoes-super-secret-key-2026",
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        try {
          await connectToDatabase();
          const email = user.email?.toLowerCase().trim();
          if (!email) return false;

          const isSuperAdminEmail = SUPER_ADMIN_EMAILS.includes(email);
          const defaultRole = isSuperAdminEmail ? UserRole.SUPER_ADMIN : UserRole.CUSTOMER;

          let dbUser = (await User.findOne({ email }).lean()) as any;
          if (!dbUser) {
            const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
            const myReferralCode = `USR-${randomHex}`;
            const created = await User.create({
              name: user.name || "Google User",
              email: email,
              image: user.image || undefined,
              googleId: profile?.sub || account.providerAccountId,
              role: defaultRole,
              isEmailVerified: true,
              referralCode: myReferralCode,
            });
            dbUser = created;
            console.log("[GOOGLE AUTH] Created new user:", email, "| ROLE:", defaultRole);
          } else {
            if (isSuperAdminEmail && dbUser.role !== UserRole.SUPER_ADMIN) {
              await User.updateOne({ _id: dbUser._id }, { $set: { role: UserRole.SUPER_ADMIN } });
              dbUser.role = UserRole.SUPER_ADMIN;
            }
            console.log("[GOOGLE AUTH] Existing user:", email, "| ROLE:", dbUser.role);
          }

          user.id = dbUser._id.toString();
          (user as any).role = dbUser.role || defaultRole;
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
        token.role = (user as any).role || "customer";
      }

      // Safeguard: Ensure token.role is NEVER undefined or null
      if (!token.role && token.email) {
        try {
          await connectToDatabase();
          const cleanEmail = token.email.toLowerCase().trim();
          const isSuper = SUPER_ADMIN_EMAILS.includes(cleanEmail);
          const dbUser = (await User.findOne({ email: cleanEmail }).lean()) as any;
          token.role = isSuper ? "super_admin" : (dbUser?.role || "customer");
          if (dbUser?._id) token.id = dbUser._id.toString();
        } catch {
          token.role = "customer";
        }
      }

      console.log("[JWT CALLBACK] Email:", token.email, "| Role:", token.role);
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) || "customer";
      }
      console.log("[SESSION CALLBACK] User:", session.user?.email, "| Role:", session.user?.role);
      return session;
    },
  },
  pages: { signIn: "/login" },
};