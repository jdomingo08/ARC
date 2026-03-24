import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { storage } from "./storage";
import type { User } from "@shared/schema";

export function configurePassport() {
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user || false);
    } catch (err) {
      done(err, false);
    }
  });

  // Only register Google strategy if credentials are configured
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback",
          scope: ["email", "profile"],
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
              return done(null, false, { message: "No email from Google" });
            }

            // Domain restriction (defense in depth — also set at GCP level)
            const allowedDomain = process.env.GOOGLE_ALLOWED_DOMAIN;
            if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
              return done(null, false, { message: "Email domain not allowed" });
            }

            // Must match an existing pre-seeded user
            const user = await storage.getUserByEmail(email);
            if (!user) {
              return done(null, false, { message: "No account for this email" });
            }

            return done(null, user);
          } catch (err) {
            return done(err as Error, false);
          }
        }
      )
    );
  }
}
