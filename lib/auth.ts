import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./db/schema";
import { sendForgotPasswordEmail, sendVerifyEmail } from "./email";

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
      polarCustomerId: {
        type: "string",
        input: false,
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
