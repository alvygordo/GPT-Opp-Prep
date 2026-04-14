# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start Next.js dev server (Turbopack)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint (flat config, Next.js preset)
```

No test framework is configured.

## Architecture

**GPT-Opp-Prep** is a Next.js 16 (React 19) internal sales ops tool that helps the Core Renewals team prepare Salesforce opportunity reports. Users search for a Salesforce opportunity, upload supporting documents (PDFs, images), and receive a structured GPT-4o-generated report formatted for pasting into Google Sheets.

### Key flow

1. **Auth** (`app/login/page.tsx`): Salesforce OAuth with PKCE (`/api/auth/salesforce` + `/api/auth/callback/salesforce`) or email allowlist check (`/api/login` against Supabase `allowed_users` table). Session is a simple `opp_prep_user` cookie (24h TTL). Middleware in `proxy.ts` redirects unauthenticated users.

2. **Opp search** (`/api/salesforce`): Uses `jsforce` with username+password+token auth to SOQL-query opportunities by name.

3. **Document analysis** (`/api/analyze`): Sends uploaded files (images as base64 via vision API, PDFs as text references) plus customer context to OpenAI GPT-4o with a detailed system prompt that enforces a 6-section report format with strict table output rules.

4. **Storage**: Supabase for persistence — `opportunities` and `reports` tables, `documents` storage bucket.

### File layout

- `app/page.tsx` — Main UI (client component). Handles opp search, file upload, report display. All state via React hooks.
- `app/login/page.tsx` — Login page (SF SSO + email).
- `app/api/` — All API routes (analyze, salesforce, login, auth flows).
- `lib/supabase.ts` — Shared Supabase client instance.
- `proxy.ts` — Session middleware (cookie-based auth gate).

### External services

| Service | Purpose | Key env vars |
|---------|---------|-------------|
| Supabase | DB + file storage | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| OpenAI | GPT-4o document analysis | `OPENAI_API_KEY` |
| Salesforce (jsforce) | Opportunity queries | `SALESFORCE_USERNAME`, `SALESFORCE_PASSWORD`, `SALESFORCE_TOKEN` |
| Salesforce (OAuth) | SSO login | `SF_CONSUMER_KEY`, `SF_CONSUMER_SECRET`, `SF_CALLBACK_URL` |

### Tech stack notes

- **Next.js 16.2.3** — Read `node_modules/next/dist/docs/` before using any Next.js APIs; breaking changes from prior versions.
- **Tailwind CSS v4** via PostCSS (not the older config-file approach).
- **Styling is mixed** — inline styles and Tailwind classes coexist.
- **No state management library** — plain `useState`/`useRef` throughout.
- **No test suite** — there are no test files or test runner configured.
- `@anthropic-ai/sdk` and `next-auth` are installed but not actively used in application code.
