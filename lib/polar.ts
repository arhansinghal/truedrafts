import { Polar } from "@polar-sh/sdk";

export const polarClient = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN ?? "placeholder",
  server:
    process.env.NODE_ENV === "production" ? "production" : "sandbox",
});
