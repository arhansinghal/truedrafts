import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./db/schema";
import { sendForgotPasswordEmail, sendVerifyEmail, sendWelcomeEmail } from "./email";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),

  socialProviders: {
    google:
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ? {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            // Google sign-in does NOT auto-create accounts. Only the signup flow
            // passes requestSignUp:true. So an unknown Google account on /login is
            // rejected (→ "sign up instead") rather than silently registered —
            // and a deleted account can't quietly come back.
            disableImplicitSignUp: true,
          }
        : undefined,
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }: { user: { email: string; name: string }; url: string }) => {
      await sendForgotPasswordEmail(user.email, user.name, url);
    },
  },

  // Send a welcome email once, right after any account is created (email or
  // OAuth). sendWelcomeEmail is role-aware and idempotent per address, so a
  // provider retry won't double-send. Wrapped so an email failure never blocks
  // account creation.
  databaseHooks: {
    user: {
      create: {
        after: async (user: { email: string; name: string; role?: string | null }) => {
          try {
            await sendWelcomeEmail(user.email, user.name, user.role);
          } catch (e) {
            console.error("[welcome email]", e);
          }
        },
      },
    },
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "reader",
        input: true,
      },
      username: {
        type: "string",
        input: true,
      },
      bio: {
        type: "string",
        input: true,
      },
      profilePhoto: {
        type: "string",
        input: true,
      },
      verifiedAdmit: {
        type: "boolean",
        defaultValue: false,
        input: false,
      },
      referralCode: {
        type: "string",
        input: true,
      },
      satScore: {
        type: "number",
        input: true,
      },
      actScore: {
        type: "number",
        input: true,
      },
      gpa: {
        type: "string",
        input: true,
      },
      extracurriculars: {
        type: "string",
        input: true,
      },
      graduationYear: {
        type: "number",
        input: true,
      },
      country: {
        type: "string",
        input: true,
      },
      activities: {
        type: "string",
        input: true,
      },
    },
  },

  trustedOrigins: [
    process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000",
    "https://truedrafts.com",
    "https://admin.truedrafts.com",
  ],
});

export type Session = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
