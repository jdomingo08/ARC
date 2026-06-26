# ARC Intelligence

## Overview
Internal AI governance application for managing AI tool requests, approvals, platform inventory, and vendor risk monitoring.

## Architecture
- **Frontend**: React + Vite + Shadcn UI + TanStack Query + Wouter routing
- **Backend**: Express.js + PostgreSQL + Drizzle ORM
- **Auth**: Session-based with user selector (no passwords for MVP)

## Data Model
- **Users**: Committee members (Jeff, Kirun, LeaAnna, Josh, Jorge), requesters (Sarah, Mike), admin
- **Requests**: AI tool intake submissions with 4-section form data
- **ReviewDecisions**: Pass/Fail/NeedsMoreInfo decisions linked to requests
- **Platforms**: System of record for all AI tools (with extensible JSON attributes)
- **Tiers**: Classification levels (Tier 0 Experimental, Tier 1 Approved, Tier 2 Enterprise)
- **PlatformAttributeDefinitions**: Admin-defined custom attributes
- **RiskFindings**: Vendor risk/breach findings linked to platforms
- **AgentRunLogs**: Risk monitoring agent execution history
- **AuditLogs**: Immutable change tracking
- **ApiUsageSnapshots**: Daily per-provider usage & spend snapshots (API Command Center)
- **ApiUsageSchedules**: Cron config for the daily usage sync + Slack digest
- **ApiSyncLogs**: Audit trail of each usage sync run (manual/scheduled)
- **SkillScans**: Skill Inspector scan results (NVIDIA SkillSpector verdicts + findings)

## Approval Workflow
1. Requester submits intake form -> Request + Platform created
2. Security (Josh) + Tech/Financial (Jorge) reviews required (parallel)
3. Strategic (LeaAnna) review is advisory
4. Both Chairs (Jeff + Kirun) must approve after Security + Tech pass
5. "Needs More Info" pauses workflow, returns to requester

## Key Files
- `shared/schema.ts` - All Drizzle schemas, Zod types, enums
- `server/db.ts` - Database connection
- `server/storage.ts` - Data access layer with DatabaseStorage class
- `server/routes.ts` - All API endpoints
- `client/src/App.tsx` - Main app with routing and auth gate
- `client/src/hooks/use-auth.ts` - Auth hook
- `client/src/components/app-sidebar.tsx` - Navigation sidebar
- `client/src/components/status-badge.tsx` - Status/role/risk badges
- `client/src/components/review-panel.tsx` - Review submission form
- `server/skill-inspector/*` - SkillSpector integration (inspector pipeline, input validation, output parser, venv CLI path)

## Pages
- `/` - Dashboard with stats and recent requests
- `/requests/new` - 4-step intake form wizard
- `/requests` - My Requests list
- `/requests/:id` - Request detail with review status
- `/reviews` - Reviewer inbox
- `/platforms` - Platform inventory list
- `/platforms/:id` - Platform detail with findings
- `/admin` - Attribute definitions, tiers, user roles
- `/risk` - Risk monitoring agent console
- `/integrations` - API Command Center: OpenAI org-wide usage & spend dashboard (extensible to more providers)
- `/skill-inspector` - Skill Inspector: scan a GitHub repo URL or uploaded skill file with NVIDIA SkillSpector for security risks

## Seed Data
Automatically seeds on first run: 8 users, 4 platforms, 2 requests, 3 tiers, 3 risk findings, 3 attribute definitions

## Auth Env Vars
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — enables Google SSO
- `GOOGLE_CALLBACK_URL` — override the OAuth callback (defaults to `/api/auth/google/callback`)
- `GOOGLE_ALLOWED_DOMAIN` — restricts SSO to one or more Workspace domains. Comma-separated for multiple (e.g. `entravision.com,smadex.com,adwake.ai`). When more than one domain is configured, the `hd` account-picker hint is dropped and the server-side verify enforces access.
- `GOOGLE_ALLOWED_EXTRA_EMAILS` — comma-separated emails that bypass `GOOGLE_ALLOWED_DOMAIN`. When set, the `hd` account-picker hint is dropped so personal Gmail accounts can appear. Server-side verify still rejects anything not on the domain or this list.
- `ADMIN_EMAILS` — comma-separated emails auto-promoted to admin on first SSO login
- `ADMIN_REVIEWER_ROLE` — reviewerRole assigned when auto-promoting admins (default `technical_financial`)

## AI / Integrations Env Vars
- `OPENAI_API_KEY` — inference key used by the Risk Agent / tool insights (chat + responses APIs)
- `OPENAI_MODEL` — inference model override (default `gpt-4o`)
- `AI_PROVIDER` — LLM provider selector (default `openai`)

### API Command Center (multi-provider usage monitoring)
Providers are defined in `server/integrations/registry.ts`; routes/scheduler iterate over it. Snapshots are stored per provider per UTC day in `api_usage_snapshots`, using a generic `units`/`unit_label` pair (OpenAI → tokens; ElevenLabs → characters) plus cost for providers that expose it.

- `OPENAI_ADMIN_KEY` — **Organization Admin key** (`sk-admin-…`), separate from `OPENAI_API_KEY`. Pulls org-wide usage (`/v1/organization/usage/completions`) and spend (`/v1/organization/costs`).
- `ELEVENLABS_API_KEY` — ElevenLabs API key. Pulls character usage (`/v1/usage/character-stats`) and plan quota (`/v1/user/subscription`) via the `xi-api-key` header. ElevenLabs reports characters/credits, not USD, so the dashboard shows credit usage + plan quota instead of dollar spend.
- `SLACK_WEBHOOK_URL` — Slack Incoming Webhook for the morning usage digest (simplest option)
- `SLACK_BOT_TOKEN` + `SLACK_USAGE_CHANNEL` — alternative to the webhook; posts via `chat.postMessage` (takes precedence over the webhook when both are set)
- `APP_BASE_URL` (or `PUBLIC_URL`) — public base URL used to add a dashboard link to the Slack digest (optional)

A single module-wide cron (`server/integrations/usage-scheduler.ts`, default `0 6 * * *` UTC, configurable in the UI by admins) syncs every configured provider each morning and posts one combined Slack digest. Each provider degrades gracefully when its key is unset.

### Skill Inspector
Wraps NVIDIA SkillSpector (Python 3.12), installed into a `.venv` baked into the Replit build (see `replit.nix` + `script/build.ts`). The scanner is invoked as a child process and streams live progress to the client over SSE. Scan results are persisted to the `skill_scans` table and surfaced in "My scans".

**Live scan progress:** progress is streamed from SkillSpector's LangGraph workflow via `server/skill-inspector/skillspector_stream.py` (run by the venv's Python), which emits one NDJSON event per finished graph node. The inspector drives a pure step state machine (`server/skill-inspector/step-machine.ts`) over the fixed 25-node catalog (`shared/skill-inspector-types.ts`) to derive pending/running/done/failed, persists per-step state on `skill_scans.steps` (jsonb) + `skill_scans.current_step`, and forwards it over the existing SSE as `step` events. The client renders a phase-grouped checklist live (`client/src/components/skill-inspector/scan-progress.tsx`); if the SSE stream drops mid-scan it falls back to polling the scan row, and "My scans" auto-polls while any scan is running.

- `OPENAI_API_KEY` — reused from the main AI config; passed to SkillSpector for its LLM analysis stage
- `SKILLSPECTOR_PROVIDER` — set to `openai` by the server when spawning the scanner (not required in `.env`)
- `SKILLSPECTOR_MODEL` — optional model override forwarded to SkillSpector (e.g. `gpt-4o-mini`). Strongly recommended: the AI analyzer stage makes per-node LLM calls, so a fast model keeps scans well under the timeout
- `SKILLSPECTOR_TIMEOUT_MS` — optional scan timeout in milliseconds (default 10 min); raise for very large repos or slow models

If the `.venv` is absent the feature degrades gracefully: `GET /api/skill-inspector/status` returns `scannerAvailable: false` and scan requests return a friendly 503 without crashing the app.
