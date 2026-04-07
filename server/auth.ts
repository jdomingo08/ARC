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

            // Check for existing user first
            let user = await storage.getUserByEmail(email);

            // Determine if this email should be an admin
            const adminEmails = (process.env.ADMIN_EMAILS || "")
              .split(",")
              .map((e) => e.trim().toLowerCase())
              .filter(Boolean);
            const isAdmin = adminEmails.includes(email.toLowerCase());

            // Auto-provision new users with allowed domain
            if (!user && allowedDomain && email.endsWith(`@${allowedDomain}`)) {
              const displayName = profile.displayName || email.split("@")[0];
              const adminReviewerRole = process.env.ADMIN_REVIEWER_ROLE || "technical_financial";
              user = await storage.createUser({
                name: displayName,
                email,
                department: "General",
                role: isAdmin ? "admin" : "requester",
                reviewerRole: isAdmin ? adminReviewerRole : undefined,
              });
            }

            // Promote existing user to admin if they're in the admin list but aren't admin yet
            if (user && isAdmin && user.role !== "admin") {
              const adminReviewerRole = process.env.ADMIN_REVIEWER_ROLE || "technical_financial";
              user = await storage.updateUserRole(user.id, "admin", adminReviewerRole) || user;
            }

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
