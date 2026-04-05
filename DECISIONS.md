# Quorum — Architecture Decision Records

> Track key architectural decisions and the reasoning behind them.

---

## ADR-001: Supabase over Firebase

**Date:** 2026-04-04
**Status:** Accepted

**Context:**
The spec requires a real-time backend. Two options were given: Firebase and Supabase.

**Options Considered:**
1. Firebase Firestore + Realtime Database
2. Supabase (Postgres + Realtime)

**Decision:** Supabase

**Reasons:**
- Chat data is inherently relational: rooms → members → messages.
  Postgres handles this with proper JOINs; Firestore requires denormalization.
- Row Level Security lets us enforce "users can only read messages from rooms
  they're members of" at the database layer — not in application code.
  This is more secure and easier to audit.
- Supabase Realtime uses Postgres logical replication — when a row is INSERTed,
  all subscribers receive it. No separate real-time infrastructure.
- Supabase is open source and self-hostable. Not locked into Google's ecosystem.

**Tradeoffs:**
- Supabase has less global edge infrastructure than Firebase.
- Firebase's offline persistence is more mature for mobile clients.
  Acceptable tradeoff for a team workspace (desktop-first) use case.

---

## ADR-002: Google Gemini 1.5 Flash over OpenAI

**Date:** 2026-04-04
**Status:** Accepted

**Context:**
Need an AI model for the @ai assistant feature. OpenAI requires a credit card
and has per-token usage costs even for development.

**Options Considered:**
1. OpenAI GPT-4o / GPT-3.5 via `@ai-sdk/openai`
2. Google Gemini 1.5 Flash via `@ai-sdk/google`

**Decision:** Google Gemini 1.5 Flash

**Reasons:**
- Free tier at aistudio.google.com — no credit card required.
- Generous rate limits (15 RPM, 1M TPM) sufficient for development and demo.
- Vercel AI SDK provides provider-agnostic streaming via the `ai` package,
  so switching to OpenAI or Claude later requires changing one import — not
  rewriting the streaming logic.
- The `ai` package works on Netlify; it is not Vercel-specific.

**Tradeoffs:**
- GPT-4o has stronger reasoning on complex tasks.
- Gemini's API is newer and has less community tooling.
  Acceptable because the AI assistant handles straightforward Q&A, not
  multi-step agentic workflows.

---

## ADR-003: BetterAuth over NextAuth/Auth.js

**Date:** 2026-04-04
**Status:** Accepted

**Context:**
Need authentication with GitHub OAuth and email/password support.
NextAuth (Auth.js) v5 is the most common choice but has a complex migration
story and configuration surface.

**Options Considered:**
1. NextAuth (Auth.js) v5
2. BetterAuth
3. Clerk (hosted)

**Decision:** BetterAuth

**Reasons:**
- Session cookies with built-in OAuth flow management out of the box.
- Simpler configuration than NextAuth v5 — single file setup with providers.
- Works directly with Supabase Postgres as the database backend.
- Supports both OAuth (GitHub) and email/password without extra adapters.
- Self-hosted — no external dependency like Clerk.

**Tradeoffs:**
- Smaller community and ecosystem than NextAuth.
- Fewer pre-built adapters for edge cases.
  Acceptable because our auth needs are straightforward: GitHub OAuth +
  email/password + session management.

---

## ADR-004: Tailwind CSS v4 (CSS-first configuration)

**Date:** 2026-04-04
**Status:** Accepted

**Context:**
Tailwind v4 was released with a fundamentally different configuration model.
The project needs a styling approach that works with Next.js 14 and shadcn/ui.

**Options Considered:**
1. Tailwind v3 with `tailwind.config.ts`
2. Tailwind v4 with `@theme` in `globals.css`

**Decision:** Tailwind v4

**Reasons:**
- No `tailwind.config.ts` needed — all theme tokens live in `globals.css`
  via `@theme`, keeping design tokens co-located with CSS.
- `@utility` directive for custom utility classes (e.g., `app-shell`,
  `bubble-base`, `tap-target`) replaces the old `@layer components` pattern.
- New engine is faster and produces smaller output.
- shadcn/ui supports v4 via `shadcn/tailwind.css` import.

**Tradeoffs:**
- Next.js 14 doesn't have native v4 support (Next.js 15 does). Required
  `@tailwindcss/postcss` plugin and careful CSS import ordering.
- Some v3 patterns (like `@apply` in config) don't translate directly.
  Manageable with the `@theme` + `@utility` approach.

---

## ADR-005: Web Speech API for Voice Features

**Date:** 2026-04-04
**Status:** Accepted

**Context:**
Need speech-to-text (dictate messages) and text-to-speech (read AI responses
aloud) capabilities. Options range from browser-native to cloud APIs.

**Options Considered:**
1. OpenAI Whisper (STT) + OpenAI TTS
2. Google Cloud Speech-to-Text + Text-to-Speech
3. Browser-native Web Speech API

**Decision:** Web Speech API (browser-native, client-side only)

**Reasons:**
- Zero cost — no API key, no server calls, no usage limits.
- `webkitSpeechRecognition` handles STT with interim results.
- `SpeechSynthesisUtterance` handles TTS with voice selection.
- Entirely client-side — no latency from server round-trips.
- Good enough quality for an MVP demo.

**Tradeoffs:**
- Browser support varies: best in Chrome, limited in Firefox/Safari.
- Quality is lower than cloud APIs (especially for TTS naturalness).
- No offline STT support.
  Acceptable for MVP. Server-side route placeholders (`/api/voice/*`) exist
  as fallback if browser support proves insufficient.

---

## ADR-006: Supabase Realtime Presence for Typing Indicators

**Date:** 2026-04-04
**Status:** Accepted

**Context:**
Need to show "User is typing..." indicators in real-time. Could use a
database table with polling, or an ephemeral presence system.

**Options Considered:**
1. `typing_indicators` database table with polling/realtime
2. Supabase Realtime Presence (ephemeral)

**Decision:** Supabase Realtime Presence

**Reasons:**
- Typing state is ephemeral — persisting it to a table is wasteful.
- Auto-cleans on disconnect: if a user closes their browser, their typing
  state disappears immediately. No stale "typing" ghosts.
- Lower latency than database INSERT → realtime broadcast → cleanup.
- Reuses the same Supabase Realtime connection used for message subscriptions.

**Tradeoffs:**
- Presence data is not persisted — cannot query "who was typing when."
  This is a feature, not a bug, for typing indicators.

---

## ADR-007: Netlify over Vercel for Deployment

**Date:** 2026-04-04
**Status:** Accepted

**Context:**
Need a hosting platform for the Next.js 14 app with streaming AI support.

**Options Considered:**
1. Vercel
2. Netlify
3. Self-hosted (Docker)

**Decision:** Netlify

**Reasons:**
- Free tier sufficient for demo and assessment.
- Next.js runtime supported via `@netlify/plugin-nextjs`.
- Serverless functions support streaming responses (26-second timeout on
  free tier — sufficient for AI responses with `maxDuration: 26`).
- No vendor lock-in to Vercel's proprietary features.

**Tradeoffs:**
- Vercel has deeper Next.js integration (they maintain Next.js).
- Vercel's edge runtime and ISR support is more mature.
  Acceptable because this project doesn't use ISR or edge middleware
  in ways that would benefit from Vercel-specific optimizations.

---

## ADR-008: Zustand for Client State Management

**Date:** 2026-04-04
**Status:** Accepted

**Context:**
Need client-side state management for messages, rooms, UI state, and
real-time data flowing from Supabase subscriptions.

**Options Considered:**
1. React Context + useReducer
2. Zustand
3. Jotai
4. Redux Toolkit

**Decision:** Zustand

**Reasons:**
- Lightweight — minimal boilerplate, no provider wrapping needed.
- Natural fit with Supabase Realtime: hooks write to stores, components
  read from stores. Clean separation of concerns.
- Simple API for optimistic updates: `addMessage()` immediately, reconcile
  when server confirms.
- Separate stores by domain (messageStore, uiStore) without complexity.

**Tradeoffs:**
- Less structured than Redux — no enforced action/reducer pattern.
- Devtools support is less mature than Redux DevTools.
  Acceptable for a project of this scale. The store logic is simple enough
  that the lack of enforced structure is a benefit, not a risk.