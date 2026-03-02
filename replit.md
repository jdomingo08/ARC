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

## Seed Data
Automatically seeds on first run: 8 users, 4 platforms, 2 requests, 3 tiers, 3 risk findings, 3 attribute definitions
