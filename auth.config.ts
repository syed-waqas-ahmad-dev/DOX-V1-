import type { NextAuthOptions } from 'next-auth';

export const authConfig: Partial<NextAuthOptions> = {
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.email = user.email;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        if (!session.user) {
          session.user = {} as any;
        }
        (session.user as any).role = token.role;
        (session.user as any).email = token.email;
      }
      return session;
    },
  },
};

export default authConfig;
