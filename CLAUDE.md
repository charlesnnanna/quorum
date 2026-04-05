# Quorum — Claude Code Project Context

> Read this file completely before writing any code.
> This is the single source of truth for how this project is built.

---

## What Is Quorum

Quorum is a real-time collaborative team workspace with an on-demand AI
assistant. Team members chat in real-time. An AI assistant joins conversations
when explicitly summoned via @ai mention. The AI understands full conversation
context and responds like a participant, not a chatbot.

Built as a technical assessment for Kochanet.

**Tagline:** "Your team, plus the intelligence it needs — exactly when it needs it."

---

## Technology Stack

| Layer         | Technology                 | Why                                                                 |
| ------------- | -------------------------- | ------------------------------------------------------------------- |
| Framework     | Next.js 14 (App Router)    | Required by spec                                                    |
| Language      | TypeScript (strict mode)   | Required by spec                                                    |
| Styling       | Tailwind CSS v4            | v4 — NO tailwind.config.ts exists                                   |
| Database      | Supabase (Postgres)        | Relational model fits chat data, RLS for DB-layer auth              |
| Real-time     | Supabase Realtime          | Postgres logical replication, built-in Presence                     |
| Auth          | BetterAuth                 | Session cookies, OAuth — manages GitHub OAuth flow                  |
| AI Chat       | OpenAI GPT-4o-mini         | Fast, affordable, high-quality responses                            |
| AI SDK Core   | `ai` (Vercel AI SDK)       | Provider-agnostic streaming — works on Netlify, not Vercel-specific |
| AI Provider   | `@ai-sdk/openai`           | OpenAI adapter for Vercel AI SDK                                    |
| Voice STT     | Web Speech API             | Browser-native, completely free, no API key needed                  |
| Voice TTS     | Web Speech SynthesisAPI    | Browser-native, completely free, no API key needed                  |
| State         | Zustand                    | Lightweight, works well with Supabase realtime subscriptions        |
| UI Components | shadcn/ui (new-york style) | Accessible, composable, owned not npm-boxed                         |
| Validation    | Zod                        | Schema validation on all inputs, server and client                  |
| Deployment    | Netlify                    | Next.js runtime supported, free tier sufficient                     |

---

## CRITICAL: What NOT to Install or Generate

```
✗ Do NOT install the `openai` npm package (use `@ai-sdk/openai` instead)
✗ Do NOT install `@ai-sdk/google`
✗ Do NOT generate tailwind.config.ts or tailwind.config.js — Tailwind v4 has NO config file
✗ Do NOT use `@tailwind base/components/utilities` — Tailwind v4 uses `@import "tailwindcss"`
✗ Do NOT use `h-screen` for full-height containers — use `h-dvh`
✗ Do NOT set font-size below 16px on inputs/textareas — iOS Safari zooms in
✗ Do NOT use the `google` import or `@ai-sdk/google` anywhere in the codebase
✗ Do NOT make a page or layout a Client Component unless it absolutely requires
  browser APIs — auth checks and initial data fetching belong in Server Components
```

---

## ═══════════════════════════════════════════════════

## RENDERING STRATEGY — READ THIS BEFORE EVERY FILE

## ═══════════════════════════════════════════════════

This is the most important architectural decision in the app.
Getting this wrong means broken auth, slow pages, and security issues.
Follow these rules for EVERY file you create.

---

### The Four Rendering Types

**Server Component (SC)**

- Default in Next.js App Router — NO directive needed
- Runs ONLY on the server, never in the browser
- Can access database, environment variables, file system directly
- Cannot use: useState, useEffect, onClick, browser APIs, hooks
- Use for: pages, layouts, data fetching, auth checks, redirects

**Client Component (CC)**

- Requires `'use client'` directive at the very top of the file
- Runs in the browser (and also SSR'd on server for first paint)
- Can use: useState, useEffect, onClick, all hooks, browser APIs
- Cannot: directly access database or secret env variables
- Use for: interactive UI, real-time subscriptions, animations, forms

**Server Action**

- Marked with `'use server'` inside the function or at top of file
- Runs exclusively on the server
- Called FROM Client Components but executes on server
- Use for: all database mutations (INSERT, UPDATE, DELETE)
- Must: verify auth, validate with Zod, check authorization

**Route Handler**

- Files named `route.ts` in the app directory
- Runs on the server, handles HTTP requests
- Use ONLY for: streaming responses (AI chat), BetterAuth handler
- Server Actions cannot stream — that is the only reason to use Route Handlers
  over Server Actions for mutations

---

### The Decision Tree — Ask This Before Every File

```
Are you creating a page, layout, or data-fetching component
with NO interactivity (no clicks, no state, no hooks)?
  └── YES → Server Component (no directive)
        - Fetch data directly with Supabase server client
        - Check auth, redirect if needed
        - Pass data DOWN as props to child Client Components

Does it need useState, useEffect, onClick, or any browser API?
  └── YES → Client Component ('use client' at top)
        - Receive initial data as props from Server Component parent
        - Subscribe to real-time updates via hooks
        - Call Server Actions for mutations

Does it write to the database or need server-only secrets?
  └── YES → Server Action ('use server')
        - Always verify session first
        - Always validate input with Zod
        - Always check authorization (can this user do this?)
        - Return { data, error } — never throw

Does it need to stream a response (AI tokens)?
  └── YES → Route Handler (route.ts)
        - Only use for streaming — everything else is Server Actions
```

---

### Rendering Strategy Per File

Every file in this project has a predetermined rendering strategy.
Do not deviate from this table.

```
FILE                                    STRATEGY          REASON
────────────────────────────────────────────────────────────────────────
src/app/layout.tsx                      Server Component  Font load, metadata
src/app/(auth)/login/page.tsx           Server Component  Redirect if authed
src/app/(auth)/register/page.tsx        Server Component  Redirect if authed
src/app/(app)/layout.tsx                Server Component  Auth gate, redirect
src/app/(app)/page.tsx                  Server Component  Redirect to first room
src/app/(app)/rooms/[roomId]/page.tsx   Server Component  Auth + membership check
                                                          Fetch initial 50 messages
                                                          Fetch room + members
                                                          Pass as props to children

src/app/api/auth/[...all]/route.ts      Route Handler     BetterAuth (required)
src/app/api/ai/chat/route.ts            Route Handler     Streaming (Actions cant)

src/components/auth/LoginForm.tsx       Client Component  Form state, validation
src/components/auth/SocialAuthButton    Client Component  onClick handler

src/components/rooms/RoomListPanel      Client Component  useRooms subscription
src/components/rooms/ConversationItem   Client Component  onClick, active state
src/components/rooms/IconRail           Client Component  Active nav state
src/components/rooms/NamedSidebar       Client Component  Active nav state
src/components/rooms/BottomNav          Client Component  Active tab state
src/components/rooms/MobileDrawer       Client Component  Open/close state
src/components/rooms/CreateRoomModal    Client Component  Form state
src/components/rooms/InviteUserModal    Client Component  Search state

src/components/chat/ChatHeader          Client Component  Presence, onClick
src/components/chat/MessageList         Client Component  Realtime subscription
src/components/chat/MessageBubble       Client Component  Animations, onRetry
src/components/chat/MessageInput        Client Component  onChange, typing broadcast
src/components/chat/TypingIndicator     Client Component  Presence hook
src/components/chat/PresenceDot         Client Component  Receives isOnline prop
src/components/chat/VoiceMessageBubble  Client Component  Audio playback state
src/components/chat/ImageGridMessage    Client Component  Lightbox state

src/components/ai/AIMessage             Client Component  Streaming state, TTS
src/components/ai/TypingDots            Client Component  Animation only

src/components/rooms/UserInfoPanel      Client Component  Open/close, tab state
src/components/ui/NotificationPopup     Client Component  Timer, dismiss state
src/components/ui/OfflineBanner         Client Component  navigator.onLine events
src/components/ui/SearchBar             Client Component  Controlled input
src/components/ui/ErrorState            Server Component  Pure presentational
src/components/ui/DateSeparator         Server Component  Pure presentational

src/hooks/useMessages.ts                Client only       Supabase realtime
src/hooks/usePresence.ts                Client only       Supabase presence
src/hooks/useRooms.ts                   Client only       Supabase realtime
src/hooks/useVoice.ts                   Client only       Web Speech API
src/hooks/useAIStream.ts                Client only       Streaming state

src/lib/actions/messages.ts             Server Actions    DB mutations
src/lib/actions/rooms.ts                Server Actions    DB mutations
src/lib/actions/auth.ts                 Server Actions    Profile upsert
src/lib/supabase/client.ts              Client only       Browser Supabase client
src/lib/supabase/server.ts              Server only       Server Supabase client
src/lib/ai/context.ts                   Server only       Token counting
src/lib/ai/stream.ts                    Server only       Streaming utilities
src/lib/stores/messageStore.ts          Client only       Zustand store
src/lib/stores/uiStore.ts               Client only       Zustand store
src/lib/utils.ts                        Both              Pure functions, no APIs
src/lib/validations/message.ts          Both              Zod schemas
src/lib/validations/room.ts             Both              Zod schemas
src/middleware.ts                       Server only       Session refresh
```

---

### The Server → Client Data Flow Pattern

This is the pattern used on EVERY authenticated page.
Never invert it. Data always flows server → client, never client → server
(except through Server Actions).

```
app/(app)/rooms/[roomId]/page.tsx   ← SERVER COMPONENT
│  1. Verify session (redirect if none)
│  2. Verify room membership (redirect if not member)
│  3. Fetch initial messages from Supabase
│  4. Fetch room details
│  5. Fetch room members
│  6. Render client components, passing data as props
│
├── <ChatHeader                     ← CLIENT COMPONENT
│     room={room}                     receives server-fetched data
│     initialMembers={members} />     as props
│
├── <MessageList                    ← CLIENT COMPONENT
│     roomId={roomId}                 uses server data as initial state
│     initialMessages={messages}      then subscribes to realtime
│     currentUser={user} />
│
└── <MessageInput                   ← CLIENT COMPONENT
      roomId={roomId}                 calls Server Actions on send
      currentUser={user} />
```

**Why this pattern?**

- Server does auth check once — no client-side route guards needed
- Initial data is available immediately — no loading spinner on first paint
- Client components get fresh real-time data after the initial render
- Secret credentials (Supabase service role, API keys) never reach browser

---

### Server Component Rules

```typescript
// Server Component — correct pattern
// NO 'use client' directive
// NO useState, useEffect, onClick

import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function RoomPage({ params }: { params: { roomId: string } }) {
  const supabase = await createServerClient()

  // 1. Auth check
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  // 2. Authorization check
  const { data: membership } = await supabase
    .from('room_members')
    .select()
    .eq('room_id', params.roomId)
    .eq('user_id', session.user.id)
    .single()

  if (!membership) redirect('/rooms')

  // 3. Fetch initial data
  const { data: messages } = await supabase
    .from('messages')
    .select('*, sender:profiles(*)')
    .eq('room_id', params.roomId)
    .order('created_at', { ascending: false })
    .limit(50)

  // 4. Pass to client components as props
  return (
    <MessageList
      roomId={params.roomId}
      initialMessages={messages?.reverse() ?? []}
    />
  )
}
```

---

### Client Component Rules

```typescript
'use client' // ← REQUIRED at the very top, before any imports

import { useState, useEffect } from 'react'
import { useMessages } from '@/hooks/useMessages'

interface MessageListProps {
  roomId: string
  initialMessages: Message[]  // ← received from Server Component
  currentUser: Profile
}

export default function MessageList({
  roomId,
  initialMessages,  // ← used as initial Zustand state
  currentUser
}: MessageListProps) {
  // Real-time subscription takes over from initial data
  const { messages, loadMore } = useMessages(roomId, initialMessages)

  // Interactive behavior here
  return (...)
}
```

---

### Server Action Rules

```typescript
'use server'; // ← at top of file marks ALL exports as server actions

import { createServerClient } from '@/lib/supabase/server';
import { messageSchema } from '@/lib/validations/message';

export async function sendMessage(input: unknown) {
  // 1. ALWAYS verify auth first
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { data: null, error: 'Unauthorized' };

  // 2. ALWAYS validate input with Zod
  const result = messageSchema.safeParse(input);
  if (!result.success) return { data: null, error: 'Invalid input' };

  // 3. ALWAYS check authorization
  const { data: membership } = await supabase
    .from('room_members')
    .select()
    .eq('room_id', result.data.room_id)
    .eq('user_id', session.user.id)
    .single();

  if (!membership) return { data: null, error: 'Not a member of this room' };

  // 4. Execute the mutation
  const { data, error } = await supabase
    .from('messages')
    .insert({
      ...result.data,
      sender_id: session.user.id,
      sender_type: 'human',
    })
    .select()
    .single();

  // 5. ALWAYS return { data, error } — never throw
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}
```

---

### Route Handler Rules (AI Streaming Only)

```typescript
// app/api/ai/chat/route.ts
// Route Handler — used ONLY because Server Actions cannot stream

export const maxDuration = 26; // Netlify free tier limit

export async function POST(req: Request) {
  // Still verify auth — Route Handlers are not automatically protected
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return new Response('Unauthorized', { status: 401 });

  const { messages, roomId } = await req.json();

  const result = await streamText({
    model: openai('gpt-4o-mini'),
    messages,
    system: 'You are Quorum AI...',
  });

  return result.toDataStreamResponse();
}
```

---

### Common Mistakes to Avoid

```
MISTAKE 1: Making a page a Client Component
  ✗ 'use client' on page.tsx or layout.tsx
  ✓ Keep pages as Server Components, put interactivity in child components

MISTAKE 2: Fetching data in useEffect
  ✗ useEffect(() => { fetch('/api/messages') }, [])
  ✓ Fetch in Server Component, pass as initialMessages prop
  ✓ For real-time updates: use Supabase subscription in custom hook

MISTAKE 3: Calling Supabase directly from a Client Component
  ✗ const supabase = createBrowserClient() in a page component to fetch initial data
  ✓ Fetch initial data in Server Component
  ✓ Browser client is ONLY for real-time subscriptions in hooks

MISTAKE 4: Using server-only env variables in Client Components
  ✗ process.env.SUPABASE_SERVICE_ROLE_KEY in a component
  ✓ Only access secret env vars in Server Components, Actions, Route Handlers

MISTAKE 5: Putting 'use client' at the top of a hooks file
  ✗ 'use client' in useMessages.ts
  ✓ Hooks don't need the directive — they are implicitly client-side
     because they use useState/useEffect. Only component FILES need 'use client'.

MISTAKE 6: Calling a Server Action from a Server Component
  ✗ const result = await sendMessage(data) inside a Server Component
  ✓ Server Actions are for Client Components calling server-side mutations
  ✓ In Server Components: call Supabase directly

MISTAKE 7: Nesting a Server Component inside a Client Component
  ✗ Client Component that imports and renders a Server Component
  ✓ Server Components can contain Client Components
  ✓ Client Components cannot contain Server Components
     (they can receive them as children props — but that is advanced)
```

---

## Package Dependencies

```json
{
  "dependencies": {
    "next": "^14",
    "react": "^18",
    "react-dom": "^18",
    "typescript": "^5",
    "@supabase/supabase-js": "latest",
    "@supabase/ssr": "latest",
    "better-auth": "latest",
    "ai": "latest",
    "@ai-sdk/openai": "latest",
    "zustand": "latest",
    "zod": "latest",
    "clsx": "latest",
    "tailwind-merge": "latest",
    "@tanstack/react-virtual": "latest",
    "date-fns": "latest",
    "lucide-react": "latest",
    "react-markdown": "latest",
    "remark-gfm": "latest"
  },
  "devDependencies": {
    "@netlify/plugin-nextjs": "latest"
  }
}
```

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=           # Server-side ONLY — never NEXT_PUBLIC_

# AI — OpenAI
OPENAI_API_KEY=                      # Server-side ONLY — never NEXT_PUBLIC_

# GitHub OAuth (github.com → Settings → Developer settings → OAuth Apps)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=                # Server-side ONLY

# BetterAuth
# BETTER_AUTH_SECRET: generate with → openssl rand -base64 32
BETTER_AUTH_SECRET=
# BETTER_AUTH_URL: your app's base URL — update after Netlify deploy
BETTER_AUTH_URL=http://localhost:3000

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Hard rule:** Variables without `NEXT_PUBLIC_` are server-only.
Never access `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`,
or `GITHUB_CLIENT_SECRET` in any Client Component or hook.

---

## AI Integration

### Correct Import Pattern

```typescript
// CORRECT — use this in all AI route handlers
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = await streamText({
  model: openai('gpt-4o-mini'),
  messages: conversationHistory,
  system: 'You are Quorum AI, a helpful team assistant...',
});
```

```typescript
// WRONG — never write these
import { google } from '@ai-sdk/google'; // ← not installed
import OpenAI from 'openai'; // ← use @ai-sdk/openai instead
```

### Voice Features — Web Speech API (Client-Side Only)

```typescript
// Speech to Text — no API key, no cost, browser only
const recognition = new window.webkitSpeechRecognition();
recognition.continuous = false;
recognition.interimResults = true;
recognition.lang = 'en-US';
recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
};
recognition.start();

// Text to Speech — no API key, no cost, browser only
const utterance = new SpeechSynthesisUtterance(text);
utterance.rate = 1.0;
window.speechSynthesis.speak(utterance);
```

### AI Invocation Flow

```
User sends message containing "@ai"
  → Server Action: INSERT user message (status: delivered)
  → Server Action: INSERT AI placeholder (status: sending, content: '')
  → Placeholder triggers Supabase Realtime → all clients show "AI typing..."
  → POST to /api/ai/chat with conversation context
  → Route Handler streams OpenAI response token by token
  → Each token: UPDATE AI message content in Supabase
  → Supabase Realtime pushes each UPDATE to all clients
  → All clients see streaming response simultaneously
  → Final: set AI message status to 'delivered'
```

### Netlify Timeout — Required on AI Route

```typescript
// app/api/ai/chat/route.ts
export const maxDuration = 26;
```

---

## Tailwind v4 Rules

```
NO tailwind.config.ts — do not create this file ever
NO @tailwind directives — use @import "tailwindcss" instead
Configuration: @theme in globals.css
Custom utilities: @utility in globals.css
Custom variants: @variant in globals.css
```

---

## Mobile-First Rules (Non-Negotiable)

1. Write mobile styles first — no breakpoint prefix
2. `md:` for tablet (768px+), `xl:` for desktop (1280px+)
3. All touch targets minimum 44×44px — use `tap-target` utility
4. All `<input>` and `<textarea>`: `text-base md:text-sm` (prevents iOS zoom)
5. Full-height containers: `h-dvh` never `h-screen`
6. Fixed elements: `safe-top` / `safe-bottom` utilities
7. Root layout viewport meta: `viewport-fit=cover`

---

## Database Schema

```sql
profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    text UNIQUE NOT NULL,
  full_name   text,
  avatar_url  text,
  is_online   boolean DEFAULT false,
  last_seen   timestamptz DEFAULT now(),
  created_at  timestamptz DEFAULT now()
)

rooms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  is_private  boolean DEFAULT false,
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now()
)

room_members (
  room_id   uuid REFERENCES rooms(id) ON DELETE CASCADE,
  user_id   uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role      text DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
)

messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     uuid REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id   uuid REFERENCES profiles(id),  -- NULL for AI messages
  sender_type text NOT NULL CHECK (sender_type IN ('human', 'ai')),
  content     text NOT NULL DEFAULT '',
  status      text DEFAULT 'delivered' CHECK (status IN ('sending','delivered','error')),
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
)

-- Typing indicators: NOT a table — Supabase Realtime Presence only
```

---

## Architectural Rules

### Supabase Clients

- `lib/supabase/client.ts` → Client Components and hooks ONLY
- `lib/supabase/server.ts` → Server Components, Server Actions, Route Handlers ONLY
- Service role key → Route Handlers only (AI message inserts bypass RLS)

### Real-Time

- Subscriptions only in hooks, never in components directly
- Hooks write to Zustand — components read from Zustand
- Always unsubscribe in useEffect cleanup function

### State Management

- Server state (messages, rooms): Supabase → Zustand cache
- UI state (modals, sidebar open): Zustand uiStore
- Form state: local useState

### Error Handling

- Server Actions return `{ data: T | null, error: string | null }` — never throw
- Route Handlers return correct HTTP status codes
- Client components show friendly messages, never raw error strings

---

## Netlify Deployment

### netlify.toml

```toml
[build]
  command = "next build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[functions]
  included_files = ["**"]

[functions."api/ai/chat"]
  timeout = 26
```

### Post-Deploy Checklist

- [ ] Update `BETTER_AUTH_URL` to Netlify URL
- [ ] Update `NEXT_PUBLIC_APP_URL` to Netlify URL
- [ ] Add production callback to GitHub OAuth App
- [ ] Add Netlify URL to Supabase allowed URLs
- [ ] Enable Supabase Realtime on messages, rooms, room_members tables

---

## BetterAuth Configuration

```typescript
// lib/auth/auth.ts
import { betterAuth } from 'better-auth'
import { github } from 'better-auth/providers'

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  database: ...,
  providers: [
    github({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    })
  ],
  emailAndPassword: { enabled: true }
})
```

GitHub OAuth callback URLs:

- Dev: `http://localhost:3000/api/auth/callback/github`
- Prod: `https://your-site.netlify.app/api/auth/callback/github`

---

## Coding Conventions

- Components: PascalCase (`MessageList.tsx`)
- Hooks: camelCase with `use` prefix (`useMessages.ts`)
- Booleans: `is` prefix (`isLoading`, `isOnline`)
- Event handlers: `handle` prefix (`handleSend`)
- Zustand actions: verb-first (`addMessage`, `setRooms`)
- JSDoc on every hook and every Server Action
- No `console.log` in production code
- No commented-out code in commits

---

## Linting & Type Safety Rules

ESLint is configured via `.eslintrc.json` extending `next/core-web-vitals` and
`next/typescript`. The build **fails** on any lint error or type error.

### Rules to follow in all new code

```
✗ No unused variables or imports — remove them, don't comment them out
✗ No `any` types — use specific types or `unknown` with narrowing
✓ Prefix intentionally unused function params with `_` (e.g. `_req`, `_event`)
✓ Always include all dependencies in React hook dep arrays, or add an
  `// eslint-disable-next-line react-hooks/exhaustive-deps` comment with
  a reason when intentionally omitting
✓ Supabase generated types use `string | null` for columns with DB defaults
  (created_at, status, etc.) — our `Message` type in `src/types/index.ts`
  overrides these to non-nullable. If adding new Supabase types, override
  nullable DB-default columns the same way.
✓ Use `z.record(z.string(), z.unknown())` not `z.record(z.unknown())` —
  Zod requires explicit key schema
✓ Guard array index access (`arr[i]`) with a null check when TS is strict
```

---

## Test Credentials

| User  | Email          | Password     |
| ----- | -------------- | ------------ |
| Alice | alice@test.com | TestPass123! |
| Bob   | bob@test.com   | TestPass123! |

---

## Out of Scope

End-to-end encryption · File/image sharing · Message threading ·
Message reactions · Push notifications · PWA · Unit tests ·
Multiple workspaces · Admin panel

---

## The Checklist Before Writing Any File

- [ ] What is the rendering strategy for this file? (SC / CC / Action / Route Handler)
- [ ] If Server Component: am I checking auth and authorization?
- [ ] If Client Component: am I receiving initial data as props from a Server Component?
- [ ] If Server Action: auth check → Zod validation → authorization → mutation → return {data, error}?
- [ ] If Route Handler: is this genuinely needed for streaming, or should it be a Server Action?
- [ ] Mobile styles written FIRST?
- [ ] Touch targets 44×44px minimum?
- [ ] Using h-dvh not h-screen?
- [ ] Text inputs text-base on mobile?
- [ ] No Tailwind config file generated?
- [ ] No Google/Gemini imports?

---

_Last updated: Project initialization_
_AI: OpenAI GPT-4o-mini via @ai-sdk/openai_
_Voice: Web Speech API browser-native (no cloud TTS/STT)_
_Hosting: Netlify (not Vercel) — ai package works fine on Netlify_
_Tailwind: v4 — @theme in globals.css, no config file_
_Responsive: Mobile-first — h-dvh, 44px touch targets, 16px inputs_
_Rendering: SC for pages/layouts/data, CC for interactive UI,_

-           Server Actions for mutations, Route Handlers for streaming only*
