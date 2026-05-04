# Google SSO Setup Guide — ARC Intelligence

This guide covers the full setup for enabling Google Single Sign-On for the Entravision workspace.

## How Auth Gating Works

SSO sits in front of **everything**. No page, sidebar, or API endpoint is accessible without authenticating first:

- **Frontend** (`App.tsx`): If not authenticated, only the login page renders — no sidebar, no routes, no admin.
- **Backend** (`routes.ts`): Every API endpoint uses `requireAuth` middleware — unauthenticated requests get `401`.
- **Production**: The dev email-click login is hidden. Only the Google SSO button appears.

---

## Google Cloud Console Setup

> **Prerequisite:** You need access to a GCP project under the Entravision organization. A Google Workspace super admin or someone with GCP project-creation rights needs to do this.

### Step 1: Create or select a GCP project

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Click the project dropdown (top-left, next to "Google Cloud")
3. Click **New Project**
   - Project name: `ARC Intelligence` (or similar)
   - Organization: Select **entravision.com** (this is critical — it must be under the Entravision org to use "Internal" user type)
   - Location: Choose the appropriate folder or leave at organization root
4. Click **Create**, then switch to the new project

### Step 2: Configure the OAuth consent screen

1. In the left sidebar: **APIs & Services > OAuth consent screen**
2. Click **Get Started** or **Configure Consent Screen**
3. User type: Select **Internal**
   - This is the key setting — "Internal" means only `@entravision.com` Google Workspace accounts can sign in. External users will never see the consent screen.
   - If the GCP project is NOT under the Entravision org, you'll have to use "External" and the code's domain check (`GOOGLE_ALLOWED_DOMAIN`) becomes the primary enforcement
4. Fill in the required fields:
   - App name: `ARC Intelligence`
   - User support email: pick an appropriate admin email
   - Developer contact email: same or a team alias
5. Scopes: Click **Add or Remove Scopes**, select:
   - `email` — to read the user's email address
   - `profile` — to read the user's name
   - These are non-sensitive scopes, so no verification is needed
6. Click **Save and Continue** through the remaining steps

### Step 3: Create OAuth 2.0 credentials

1. In the left sidebar: **APIs & Services > Credentials**
2. Click **+ Create Credentials > OAuth client ID**
3. Application type: **Web application**
4. Name: `ARC Intelligence Web Client`
5. **Authorized JavaScript origins:** Add your app URL
   - Production: `https://[your-app-domain]` (or your custom domain)
   - Development: `http://localhost:5000`
6. **Authorized redirect URIs:** Add callback URLs for each environment
   - Production: `https://[your-app-domain]/api/auth/google/callback`
   - Development: `http://localhost:5000/api/auth/google/callback`
7. Click **Create**
8. A dialog shows your **Client ID** and **Client Secret** — copy both. You can also download the JSON for safekeeping.

> **Important:** The redirect URI must match **exactly** what the app sends. Mismatches cause `redirect_uri_mismatch` errors. Include the protocol (`https://`), the full domain, and the path `/api/auth/google/callback`.

### Step 4: (Optional) Enable the People API

1. In the left sidebar: **APIs & Services > Library**
2. Search for **Google People API**
3. Click **Enable**
   - This is usually auto-enabled when using Google Sign-In scopes, but enabling it explicitly avoids issues

---

## Environment Variables

The app is deployed on Replit. Environment variables are set via **Replit Secrets** (not `.env` files).

### Where to set them

1. Open your Repl in the Replit dashboard
2. Click the **Secrets** tab (lock icon in the left sidebar, or Tools > Secrets)
3. Add each variable as a key-value pair

### Variables to add

| Variable | Value | Required? | Notes |
|----------|-------|-----------|-------|
| `GOOGLE_CLIENT_ID` | `123456789-abcdef.apps.googleusercontent.com` | Yes (for SSO) | From GCP Step 3 above |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-...` | Yes (for SSO) | From GCP Step 3 above — treat as a password |
| `GOOGLE_CALLBACK_URL` | `https://[your-app-url]/api/auth/google/callback` | Recommended | Full URL including protocol. If omitted, defaults to relative path which works but explicit is safer |
| `GOOGLE_ALLOWED_DOMAIN` | `entravision.com,smadex.com,adwake.ai` | Recommended | Defense-in-depth domain check in code. Comma-separated for multiple domains. Even if GCP consent screen is set to Internal, this adds a second layer |
| `SESSION_SECRET` | `a-long-random-string-at-least-32-chars` | Yes (for production) | Currently defaults to a dev value which is insecure for production |

### Variables already set (no changes needed)

| Variable | Notes |
|----------|-------|
| `DATABASE_URL` | Already provisioned by Replit's PostgreSQL module |
| `PORT` | Set to `5000` in `.replit` config |

### How the app uses these variables

- **If `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are both set:** Google SSO is enabled. The login page shows a "Sign in with Google" button.
- **If either is missing:** Google SSO is silently disabled. The app works as before (email-click only in dev). This means you can safely deploy without Google credentials and add them later.
- **`GOOGLE_ALLOWED_DOMAIN`:** Checked after Google returns the user's email. Accepts a single domain or a comma-separated list (e.g. `entravision.com,smadex.com,adwake.ai`). If the email's domain matches none of them, login is rejected. When more than one domain is configured, the Google `hd` account-picker hint is dropped so users from any allowed domain can pick the right account.
- **`NODE_ENV`:** In production, the email-click dev login is hidden. Only the Google button appears.

### Generating a strong SESSION_SECRET

```bash
# Option 1: OpenSSL
openssl rand -base64 32

# Option 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Data Consideration

Current seed users have `@arc.io` emails. For production, user emails must match real Entravision Google Workspace emails (e.g., `jorge.domingo@entravision.com`). Users must exist in the database before they can sign in — there is no auto-registration.

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `redirect_uri_mismatch` error from Google | Callback URL doesn't exactly match GCP config | Verify `GOOGLE_CALLBACK_URL` matches "Authorized redirect URIs" exactly (protocol, domain, path) |
| "Access blocked: app has not been verified" | GCP project not under Entravision org | Move GCP project under the org, add test users, or submit for verification |
| "Sign-in failed" after Google auth | Google email doesn't match any user in the DB | Add the user with their `@entravision.com` email |
| No "Sign in with Google" button | `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` not set | Check Replit Secrets — both must be present. Restart the app after adding. |
| Session lost on app restart | Using in-memory session store | Ensure `connect-pg-simple` is configured for production |

---

## Quick-Reference Checklist

- [ ] GCP project created under Entravision organization
- [ ] OAuth consent screen configured as **Internal**
- [ ] OAuth 2.0 Web Client credentials created
- [ ] Authorized redirect URI added: `https://[app-url]/api/auth/google/callback`
- [ ] `GOOGLE_CLIENT_ID` set in Replit Secrets
- [ ] `GOOGLE_CLIENT_SECRET` set in Replit Secrets
- [ ] `GOOGLE_CALLBACK_URL` set in Replit Secrets
- [ ] `GOOGLE_ALLOWED_DOMAIN` set to the allowed domain(s), e.g. `entravision.com,smadex.com,adwake.ai`
- [ ] `SESSION_SECRET` set to a strong random value
- [ ] User emails in database updated to match real `@entravision.com` addresses
- [ ] Tested sign-in flow end-to-end
- [ ] Tested that non-Entravision accounts are rejected
