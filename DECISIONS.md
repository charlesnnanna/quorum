# Quorum — Architecture Decisions Explained

> This document walks through every major technical decision we made while
> building Quorum, why we made it, what we gave up, and when we might need
> to revisit. If you want to understand how this project works behind the
> scenes, start here.

---

## Table of Contents

1. [Why Supabase Instead of Firebase](#1-why-supabase-instead-of-firebase)
2. [Why OpenAI GPT-4o-mini for the AI Assistant](#2-why-openai-gpt-4o-mini-for-the-ai-assistant)
3. [Why BetterAuth Instead of NextAuth or Clerk](#3-why-betterauth-instead-of-nextauth-or-clerk)
4. [Why Tailwind CSS v4 (and No Config File)](#4-why-tailwind-css-v4-and-no-config-file)
5. [Why Browser-Native Voice Instead of Cloud APIs](#5-why-browser-native-voice-instead-of-cloud-apis)
6. [Why Ephemeral Presence Instead of a Database Table](#6-why-ephemeral-presence-instead-of-a-database-table)
7. [Why Netlify Instead of Vercel](#7-why-netlify-instead-of-vercel)
8. [Why Zustand for State Management](#8-why-zustand-for-state-management)
9. [The Server-First Rendering Strategy](#9-the-server-first-rendering-strategy)
10. [How Real-Time Messaging Actually Works](#10-how-real-time-messaging-actually-works)
11. [How AI Streaming Works End-to-End](#11-how-ai-streaming-works-end-to-end)
12. [The Optimistic Update Pattern](#12-the-optimistic-update-pattern)
13. [Context Windowing for AI Conversations](#13-context-windowing-for-ai-conversations)
14. [Rate Limiting on Two Layers](#14-rate-limiting-on-two-layers)
15. [Why Virtual Scrolling for Messages](#15-why-virtual-scrolling-for-messages)
16. [The Mobile-First Layout Strategy](#16-the-mobile-first-layout-strategy)

---

## 1. Why Supabase Instead of Firebase

**The short version:** Chat data is relational. Supabase gives us a real
Postgres database with JOINs, row-level security, and built-in real-time —
all in one package.

**The longer explanation:**

When you build a chat app, you're working with data that has clear
relationships. A room has members. Members send messages. Messages belong to
rooms. This is textbook relational data — the kind of thing SQL databases
were designed for.

Firebase Firestore is a document database. It's great for many things, but
relational data isn't one of them. To answer a question like "show me all
messages in rooms where this user is a member," Firestore requires you to
denormalize your data — basically, store copies of the same information in
multiple places and keep them in sync yourself. That's extra code, extra bugs,
and extra headaches.

With Supabase (which runs Postgres under the hood), we just write a JOIN:

```sql
SELECT messages.*
FROM messages
JOIN room_members ON messages.room_id = room_members.room_id
WHERE room_members.user_id = 'some-user-id'
```

We also get Row Level Security (RLS), which is a Postgres feature that lets us
define access rules directly in the database. For example, we have a policy
that says "a user can only read messages from rooms they're a member of." This
rule is enforced at the database layer — even if our application code has a
bug, the database won't leak messages to unauthorized users.

Supabase Realtime uses Postgres logical replication. When a new message row is
inserted, Postgres itself notifies all subscribers. We don't need a separate
real-time service — it's the same database connection.

**What we gave up:**

- Firebase has better global edge infrastructure. If our users were spread
  across continents, Firebase's CDN would serve data faster from nearby edge
  locations. For a team workspace where most users are in the same region,
  this doesn't matter much.
- Firebase has more mature offline persistence for mobile. If a user's
  internet drops, Firebase can queue writes and sync later. Supabase doesn't
  have this built in. Since Quorum is a desktop-first team tool (not a mobile
  messaging app), this tradeoff is acceptable.

**When to reconsider:** If Quorum needed to work reliably offline (like a
field team tool with spotty internet), we'd need to either build our own
offline queue or switch to Firebase.

---

## 2. Why OpenAI GPT-4o-mini for the AI Assistant

**The short version:** We started with Google Gemini (free tier), switched to
OpenAI because the response quality was noticeably better, and the cost is
low enough to not matter for this project.

**The longer explanation:**

The AI assistant in Quorum isn't a standalone chatbot — it's a team member
that reads the full conversation context and responds like a participant.
This means the model needs to understand nuance: who said what, what the
team is discussing, and what kind of help would actually be useful.

We initially chose Google Gemini 1.5 Flash because it has a generous free
tier. But in practice, the responses were less consistent. GPT-4o-mini
produces better reasoning, follows instructions more reliably, and costs
roughly $0.15 per million input tokens — which is almost nothing.

The key technical detail: we use the Vercel AI SDK (`ai` package) with the
`@ai-sdk/openai` provider. The AI SDK is provider-agnostic, meaning the
streaming logic, token handling, and response formatting are all the same
regardless of which model we use. Switching from Gemini to OpenAI was a
two-line change:

```typescript
// Before
import { google } from '@ai-sdk/google';
const model = google('gemini-1.5-flash');

// After
import { openai } from '@ai-sdk/openai';
const model = openai('gpt-4o-mini');
```

Everything else — the streaming, the context building, the message updates —
stayed identical. That's the power of using a provider-agnostic SDK.

**What we gave up:**

- No free tier. OpenAI charges per token (though GPT-4o-mini is very cheap).
- We're dependent on OpenAI's API availability. If their service goes down,
  our AI feature goes down.

**When to reconsider:** If OpenAI's pricing increases significantly, or if a
newer model (like a future Claude or Gemini version) offers better quality at
the same price, swapping is trivial thanks to the AI SDK abstraction.

---

## 3. Why BetterAuth Instead of NextAuth or Clerk

**The short version:** BetterAuth is simpler to configure, self-hosted, and
does everything we need (GitHub OAuth + email/password) without the
complexity of NextAuth v5 or the vendor lock-in of Clerk.

**The longer explanation:**

Authentication in a web app has a lot of moving parts: session management,
cookie security, OAuth flows, password hashing, CSRF protection. You really
don't want to build this yourself.

**NextAuth (Auth.js) v5** is the most popular choice in the Next.js world, but
it went through a major rewrite from v4 to v5. The migration path is rough,
the documentation is fragmented between versions, and the configuration
surface is large. For our needs (two auth methods, session cookies, one OAuth
provider), NextAuth felt like bringing a Swiss Army knife to cut a piece of
bread.

**Clerk** is a hosted authentication service. It's polished and easy to use,
but it means your users' auth data lives on Clerk's servers, and you pay per
monthly active user. For an assessment project, adding a paid external
dependency didn't make sense.

**BetterAuth** hits the sweet spot:

- Single file configuration (`lib/auth/auth.ts`)
- Works directly with our Supabase Postgres database — sessions and accounts
  are stored in tables BetterAuth manages automatically
- GitHub OAuth and email/password work out of the box
- Session cookies with sensible defaults (7-day expiry, httpOnly, secure)
- Self-hosted — all auth data stays in our database

Here's our actual setup:

```typescript
export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.SUPABASE_DATABASE_URL }),
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
});
```

That's it. Compare that to a NextAuth v5 setup with adapters, callbacks,
providers, pages configuration, and JWT/session strategy choices.

**What we gave up:**

- BetterAuth has a smaller community. If we hit a weird edge case, there are
  fewer Stack Overflow answers and blog posts to reference.
- Fewer pre-built providers. If we needed to add Apple Sign-In or SAML,
  NextAuth has more out-of-the-box options.

**When to reconsider:** If the project grows to need enterprise SSO (SAML,
OIDC with corporate identity providers), we'd likely need to switch to
NextAuth or a dedicated enterprise auth service.

---

## 4. Why Tailwind CSS v4 (and No Config File)

**The short version:** Tailwind v4 moved all configuration into CSS itself.
No more `tailwind.config.ts`. Design tokens live in `globals.css` via the
`@theme` directive. It's faster, produces smaller output, and keeps
everything in one place.

**The longer explanation:**

Tailwind v3 required a JavaScript/TypeScript config file where you defined
your colors, spacing, fonts, and so on. Tailwind v4 fundamentally changed
this — configuration now happens in CSS:

```css
/* globals.css */
@import "tailwindcss";

@theme {
  --color-primary: oklch(0.65 0.24 265);
  --radius-lg: 0.625rem;
  --font-sans: 'Inter', sans-serif;
}
```

This means:
- **No `tailwind.config.ts` file** — if you see one in the project, something
  went wrong. Delete it.
- **Design tokens are co-located with CSS** — you don't have to jump between
  a JS file and your stylesheets to understand the theme.
- **Custom utilities use `@utility`** instead of the old `@layer components`
  hack.

We also use shadcn/ui for our component library. shadcn v2 supports Tailwind
v4 natively and uses CSS variables for theming, which aligns perfectly with
our `@theme` approach.

One important detail: Next.js 14 doesn't have built-in Tailwind v4 support
(that came in Next.js 15). So we had to add `@tailwindcss/postcss` as a
PostCSS plugin and be careful about CSS import ordering. It works fine, it
just required a bit of manual wiring.

**What we gave up:**

- Some Tailwind v3 community plugins aren't compatible with v4 yet.
- The `@apply` directive works differently — some v3 patterns don't translate
  directly.
- Next.js 14 requires the PostCSS plugin workaround mentioned above.

**When to reconsider:** This isn't really a "reconsider" situation — Tailwind
v4 is the future. When we upgrade to Next.js 15, the PostCSS workaround goes
away and everything gets even simpler.

---

## 5. Why Browser-Native Voice Instead of Cloud APIs

**The short version:** The Web Speech API is free, runs entirely in the
browser, and is good enough for an MVP. No API keys, no server calls, no
usage costs.

**The longer explanation:**

Quorum has two voice features:

1. **Speech-to-Text (STT):** Dictate a message instead of typing it
2. **Text-to-Speech (TTS):** Have the AI's response read aloud

For both, we use browser-native APIs:

```typescript
// Speech to Text
const recognition = new window.webkitSpeechRecognition();
recognition.continuous = false;
recognition.interimResults = true;
recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
};

// Text to Speech
const utterance = new SpeechSynthesisUtterance(aiResponse);
window.speechSynthesis.speak(utterance);
```

The alternatives were cloud services: OpenAI Whisper for STT, OpenAI TTS or
Google Cloud TTS for speech synthesis. These produce better quality output,
but they cost money per request, require API keys, and add server round-trip
latency.

For a team workspace where voice is a convenience feature (not the primary
interaction mode), browser-native quality is perfectly fine. The STT
understands normal speech well. The TTS sounds robotic but readable.

We did set up server-side route placeholders (`/api/voice/transcribe` and
`/api/voice/synthesize`) as a fallback path. If browser support proves
insufficient, we can wire those up to cloud APIs without changing the client
code.

**What we gave up:**

- **Browser compatibility:** Web Speech API works best in Chrome. Firefox and
  Safari have limited or inconsistent support.
- **Quality:** Cloud TTS (especially OpenAI's) sounds dramatically more
  natural. Cloud STT handles accents and background noise better.
- **Offline STT:** Doesn't work — requires an internet connection even though
  it's "browser-native" (Chrome sends audio to Google's servers).

**When to reconsider:** If voice becomes a core feature (not just a
convenience), or if users complain about quality/compatibility, switch to
cloud APIs using the existing route handler placeholders.

---

## 6. Why Ephemeral Presence Instead of a Database Table

**The short version:** "User is typing..." is temporary information that
should disappear the moment someone stops typing or disconnects. Storing it
in a database table would be wasteful and create cleanup headaches.

**The longer explanation:**

Some chat apps store typing indicators in a database table:

```sql
-- This is what we did NOT do
INSERT INTO typing_indicators (room_id, user_id, started_at) VALUES (...)
-- Then poll or subscribe, then delete when they stop typing
```

This approach has problems:
- You're writing to the database every time someone presses a key
- If a user closes their browser without "stopping" typing, you get ghost
  indicators that say "Alice is typing..." forever until a cleanup job runs
- The database becomes a bottleneck for something that's purely ephemeral

Instead, we use **Supabase Realtime Presence**, which is a feature designed
exactly for this kind of thing. Presence is an in-memory system — it's not
stored in the database at all.

Here's how it works in our code (`usePresence` hook):

```typescript
// When user starts typing
channel.track({
  userId: currentUser.id,
  username: currentUser.username,
  isTyping: true,
});

// When user stops typing (2-second debounce)
channel.track({
  userId: currentUser.id,
  username: currentUser.username,
  isTyping: false,
});
```

The key advantage: **if a user closes their browser, their presence state
vanishes automatically.** No ghost "typing" indicators. No cleanup cron jobs.
No stale data. The system just works.

We also use the same presence channel for online/offline status — when a user
joins a room, they show as online. When they leave (or their connection
drops), they disappear from the presence list.

**What we gave up:**

- We can't look back at historical typing data ("who was typing at 3pm?").
  But nobody needs that — typing indicators are inherently ephemeral.

**When to reconsider:** Never, honestly. This is the right pattern for
typing indicators. The only reason to change would be if Supabase Realtime
itself had reliability issues.

---

## 7. Why Netlify Instead of Vercel

**The short version:** Netlify's free tier is sufficient, it supports Next.js
14 with streaming, and deploying here avoids vendor lock-in to Vercel's
proprietary features.

**The longer explanation:**

Vercel is the company that makes Next.js. Deploying a Next.js app on Vercel
is seamless — they optimize for it. So why not use Vercel?

A few reasons:

1. **No vendor lock-in.** Some Vercel features (like their edge middleware
   optimizations and proprietary caching) don't work on other platforms. If
   we built on those, we'd be stuck on Vercel forever.

2. **The `ai` package isn't Vercel-specific.** Despite being called "Vercel
   AI SDK," the `ai` npm package works on any Node.js server. We confirmed
   this — streaming AI responses work fine on Netlify's serverless functions.

3. **Free tier is sufficient.** Netlify gives us enough build minutes,
   bandwidth, and serverless function invocations for a demo/assessment
   project.

4. **Streaming support.** Our AI route handler streams tokens back to the
   client. Netlify's serverless functions support this, with a 26-second
   timeout on the free tier. We set `maxDuration: 26` in our route handler
   to match.

The deployment config is straightforward:

```toml
# netlify.toml
[build]
  command = "next build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

**What we gave up:**

- **ISR (Incremental Static Regeneration)** works better on Vercel. But we
  don't use ISR — our pages are either fully static or fully dynamic.
- **Edge middleware** is more optimized on Vercel. Our middleware just checks
  a session cookie, so the performance difference is negligible.
- **Vercel's analytics and speed insights** are nice developer tools we don't
  get on Netlify. Not essential for this project.

**When to reconsider:** If the app needed ISR for content-heavy pages, or if
Netlify's cold start times became a problem for serverless functions, Vercel
would be the obvious migration target.

---

## 8. Why Zustand for State Management

**The short version:** Zustand is small, fast, and doesn't require wrapping
your app in providers. It pairs naturally with Supabase Realtime — hooks push
data into stores, components read from stores.

**The longer explanation:**

In Quorum, client-side state falls into three categories:

| Category | Examples | Where it lives |
|----------|----------|---------------|
| Server state | Messages, rooms, members | Supabase → Zustand stores |
| UI state | Sidebar open, active modal, mobile screen | Zustand uiStore |
| Form state | Input text, validation errors | Local `useState` |

We considered four options:

**React Context + useReducer:** The built-in React approach. Problem: every
state update re-renders every component that consumes the context. For a chat
app receiving messages every second, this causes noticeable lag.

**Redux Toolkit:** Powerful and well-structured, but heavy. Redux requires
actions, reducers, slices, and a store configuration. For our three simple
stores, that's a lot of ceremony for not much benefit.

**Jotai:** Atom-based state management. Elegant for certain patterns, but our
state is organized by domain (messages, UI, AI), not by individual atoms.
Zustand's store pattern maps more naturally to our architecture.

**Zustand:** Minimal API, no providers, fine-grained subscriptions. A
component that reads `messages` won't re-render when `isSidebarOpen` changes.

Here's our actual message store:

```typescript
// lib/stores/messageStore.ts
export const useMessageStore = create<MessageStore>((set, get) => ({
  messagesByRoom: {},

  addMessage: (roomId, message) => {
    // Deduplication: skip if message already exists
    const existing = get().messagesByRoom[roomId] ?? [];
    if (existing.some(m => m.id === message.id)) return;
    set(state => ({
      messagesByRoom: {
        ...state.messagesByRoom,
        [roomId]: [...(state.messagesByRoom[roomId] ?? []), message],
      },
    }));
  },

  updateMessage: (roomId, messageId, updates) => {
    // Used for AI streaming — update content as tokens arrive
    set(state => ({
      messagesByRoom: {
        ...state.messagesByRoom,
        [roomId]: (state.messagesByRoom[roomId] ?? []).map(m =>
          m.id === messageId ? { ...m, ...updates } : m
        ),
      },
    }));
  },
}));
```

The flow is: Supabase Realtime sends an event → the `useMessages` hook
receives it → the hook calls `addMessage()` or `updateMessage()` on the store
→ only components subscribed to that specific room's messages re-render.

The UI store uses Zustand's `persist` middleware to save state to
localStorage, so things like sidebar preferences survive page refreshes.

**What we gave up:**

- Redux DevTools is more powerful than Zustand's devtools middleware. For
  complex debugging with time-travel, Redux is better.
- Redux enforces a strict action/reducer pattern that prevents spaghetti
  state updates. Zustand trusts you to be disciplined. For a small team and
  a focused app, that's fine.

**When to reconsider:** If the app grew to have dozens of stores with complex
inter-dependencies, Redux Toolkit's structured approach would prevent the
codebase from becoming hard to reason about.

---

## 9. The Server-First Rendering Strategy

**The short version:** Pages and layouts are Server Components that fetch data
and check auth. Interactive pieces are Client Components that receive data as
props. This gives us fast initial loads, secure auth, and no loading spinners.

**The longer explanation:**

This is probably the most important architectural decision in the entire app,
and the one most likely to confuse someone new to Next.js App Router.

Next.js 14 has four types of code that runs in different places:

| Type | Runs on | Triggered by | Used for |
|------|---------|--------------|----------|
| Server Component | Server only | Page load | Data fetching, auth checks |
| Client Component | Browser (+ SSR) | User interaction | Clicks, typing, animations |
| Server Action | Server only | Client Component calls it | Database writes |
| Route Handler | Server only | HTTP request | Streaming responses |

**The core rule:** Data flows from server to client, never the other way
(except through Server Actions).

Here's exactly what happens when you open a room page:

```
1. Browser requests /rooms/abc123
2. Next.js runs the Server Component: rooms/[roomId]/page.tsx
   a. Checks if you have a valid session (redirects to /login if not)
   b. Checks if you're a member of this room (redirects to /rooms if not)
   c. Fetches the room details from Supabase
   d. Fetches the room members from Supabase
   e. Fetches the most recent 50 messages from Supabase
3. The Server Component renders, passing all this data as props to
   Client Components:
   - <RoomShell room={room} members={members} messages={messages} />
4. The Client Components hydrate in the browser with data already present
   - No loading spinner. No "fetching..." state. Data is just there.
5. Client Components start Supabase Realtime subscriptions for new messages
6. From here on, new messages arrive via real-time, not page refreshes
```

**Why this matters:**

- **Security:** Auth and authorization happen on the server. A clever user
  can't bypass the "are you a member?" check by modifying JavaScript — that
  check runs on our server before any HTML is sent.
- **Performance:** The initial page load includes all the data. There's no
  waterfall of "render page → fetch data → show spinner → render data."
- **SEO/SSR:** The initial HTML includes real content, not an empty shell.
  (Less important for a chat app, but good practice.)
- **Simplicity:** Client Components don't need to worry about loading states
  for initial data — they just receive it as props and start rendering.

**The common mistakes we avoid:**

1. **Never make a page a Client Component.** If you put `'use client'` on
   `page.tsx`, you lose the ability to check auth on the server, fetch data
   directly, and redirect — all the things that make the pattern work.

2. **Never fetch initial data in useEffect.** The classic React pattern of
   `useEffect(() => { fetch('/api/data') }, [])` creates a waterfall and a
   loading spinner. We fetch on the server instead.

3. **Never use the Supabase browser client for initial data.** The browser
   client (`createBrowserClient()`) is only for real-time subscriptions after
   the page loads. Initial data comes from the server client.

**What we gave up:**

- More files. Each interactive piece needs its own Client Component file.
  A room page that's a single Client Component would be fewer files (but
  worse in every other way).
- Mental overhead. You have to think about "where does this code run?" for
  every file. Once you internalize the pattern, it becomes second nature.

**When to reconsider:** This isn't really a "reconsider" situation — this is
how the Next.js App Router is designed to work. Going against it would mean
fighting the framework.

---

## 10. How Real-Time Messaging Actually Works

**The short version:** When someone sends a message, it's inserted into
Postgres. Supabase Realtime detects the insert and broadcasts it to all
connected clients via WebSocket. Everyone sees the new message instantly.

**The longer explanation:**

Real-time in Quorum works through three layers:

### Layer 1: Supabase Realtime (Database → Clients)

When you enable Realtime on a table in Supabase, it uses Postgres logical
replication to watch for changes. Every INSERT, UPDATE, or DELETE on the
`messages` table generates an event that's broadcast to subscribers.

In our code, the `useMessages` hook subscribes to a room's messages:

```typescript
const channel = supabase
  .channel(`messages:${roomId}`)
  .on(
    'postgres_changes',
    {
      event: '*',  // INSERT and UPDATE
      schema: 'public',
      table: 'messages',
      filter: `room_id=eq.${roomId}`,
    },
    (payload) => {
      if (payload.eventType === 'INSERT') {
        messageStore.addMessage(roomId, payload.new);
      } else if (payload.eventType === 'UPDATE') {
        messageStore.updateMessage(roomId, payload.new.id, payload.new);
      }
    }
  )
  .subscribe();
```

### Layer 2: Presence (Ephemeral State)

Presence runs on the same WebSocket connection but doesn't touch the database.
It's used for:
- **Online status:** Who's currently in this room?
- **Typing indicators:** Who's currently typing?

Both are tracked via `channel.track()` and automatically cleaned up on
disconnect.

### Layer 3: Connection Monitoring

The `useConnection` hook watches for connection drops (browser going offline,
WebSocket disconnecting). When the connection comes back, it triggers a
reconciliation — re-fetching any messages that might have been sent while
disconnected.

**The channels we use:**

| Channel | Purpose | Events |
|---------|---------|--------|
| `messages:{roomId}` | New and updated messages | INSERT, UPDATE |
| `presence:{roomId}` | Online status, typing indicators | Presence sync |
| `connection-monitor-{ts}` | Heartbeat for disconnect detection | System |

**What we gave up:**

- Supabase Realtime has some latency compared to a dedicated WebSocket
  server (like Socket.io on a custom backend). For a chat app, the difference
  is usually under 100ms — imperceptible.
- No built-in message ordering guarantee across multiple rapid inserts.
  We handle this by sorting messages by `created_at` in the store.

**When to reconsider:** If we needed sub-50ms latency (like a multiplayer
game) or complex pub/sub patterns (like presence across hundreds of rooms),
we might need a dedicated WebSocket server.

---

## 11. How AI Streaming Works End-to-End

**The short version:** When someone types `@ai`, we create a placeholder
message in the database, stream tokens from OpenAI, and update that placeholder
message every 150ms. Supabase Realtime broadcasts each update, so all clients
see the AI "typing" in real-time.

**The longer explanation:**

This is one of the most complex flows in the app. Here's every step:

### Step 1: User triggers AI

A user types a message containing `@ai`. The `MessageInput` component detects
this with a regex match.

### Step 2: Human message is saved

The `sendMessage()` Server Action inserts the user's message into the database
with `sender_type: 'human'` and `status: 'delivered'`.

### Step 3: AI placeholder is created

The `createAIPlaceholder()` Server Action inserts a new row:
```sql
INSERT INTO messages (room_id, sender_type, content, status)
VALUES ('room-id', 'ai', '', 'sending')
```

This empty message with `status: 'sending'` tells all clients "the AI is
thinking." The `MessageList` component renders a typing animation for
messages with this status.

### Step 4: Client calls the streaming endpoint

The `useAIStream` hook sends a POST request to `/api/ai/chat`:
```typescript
const response = await fetch('/api/ai/chat', {
  method: 'POST',
  body: JSON.stringify({ roomId, aiMessageId, currentMessage }),
});
```

### Step 5: Route Handler builds context and streams

The route handler (`/app/api/ai/chat/route.ts`):

1. Verifies the user's session and room membership
2. Checks the server-side rate limit (10-second cooldown per user)
3. Builds the AI context (see [Context Windowing](#13-context-windowing-for-ai-conversations))
4. Calls OpenAI via the Vercel AI SDK:
   ```typescript
   const result = await streamText({
     model: openai('gpt-4o-mini'),
     messages: contextMessages,
     system: 'You are Quorum AI, a helpful team assistant...',
   });
   ```
5. Reads the stream token by token
6. Every 150ms, flushes the accumulated content to Supabase:
   ```sql
   UPDATE messages SET content = 'accumulated text so far...'
   WHERE id = 'ai-message-id'
   ```

### Step 6: Realtime broadcasts to all clients

Each UPDATE triggers a Supabase Realtime event. The `useMessages` hook in
every connected client receives it and updates the message store. The
`MessageList` re-renders with the new content. Everyone sees the same
streaming text.

### Step 7: Completion

When the stream ends, the route handler does a final update:
```sql
UPDATE messages SET content = 'full response', status = 'delivered'
WHERE id = 'ai-message-id'
```

The message stops showing the streaming cursor and becomes a normal message.
Users can now click the TTS button to have it read aloud.

**Why 150ms flush interval?**

Token-by-token database updates would be too frequent (GPT-4o-mini can
produce 20+ tokens per second). Updating the database 20 times per second
per AI response would be expensive and create unnecessary Realtime traffic.
150ms is a good balance — the streaming looks smooth but we're only doing
~6-7 database writes per second.

**Why not stream directly to clients via WebSocket?**

Because then only the user who asked would see the response. By routing
through the database, Supabase Realtime broadcasts the update to ALL clients
in the room. Everyone sees the AI responding, not just the person who asked.

**What we gave up:**

- There's a ~150ms delay between the AI generating a token and it appearing
  on screen (due to the flush interval). Users don't notice this.
- We're doing many rapid UPDATEs to the same row, which creates write
  amplification in Postgres. For a moderate number of concurrent AI requests,
  this is fine. At massive scale, we'd need a different approach.

**When to reconsider:** If hundreds of AI responses were streaming
simultaneously, the database would struggle with the write load. At that
scale, we'd want to stream directly via WebSocket and only write the final
message to the database.

---

## 12. The Optimistic Update Pattern

**The short version:** When you send a message, it appears instantly in your
chat — before the server confirms it was saved. If the server write fails,
we show an error state on that message.

**The longer explanation:**

In a naive implementation, sending a message would look like:

1. User clicks send
2. POST to server
3. Server inserts into database
4. Supabase Realtime broadcasts INSERT
5. Client receives event, shows message
6. User sees their own message (200-500ms delay)

That half-second delay makes the chat feel sluggish. Every message has a
noticeable pause. Not good for a real-time experience.

With optimistic updates:

1. User clicks send
2. Message appears immediately in the UI (with a temporary ID)
3. Meanwhile, the Server Action inserts into the database
4. When the Realtime INSERT arrives, we swap the temporary message for the
   confirmed one
5. If the insert failed, we mark the message with `status: 'error'` and
   show a retry button

The message store handles this with a deduplication set:

```typescript
// When we send a message, we track its real ID
confirmedIds.add(realMessageId);

// When a Realtime INSERT arrives, we skip it if already confirmed
// (because we already showed it optimistically)
if (confirmedIds.has(payload.new.id)) return;
```

This prevents the message from appearing twice — once from the optimistic
update and once from the Realtime event.

**What we gave up:**

- Complexity. Deduplication logic, temporary IDs, and error recovery make
  the message store more complex than a simple "append on receive" approach.
- Edge case handling. What if the user sends a message, goes offline, and
  the Realtime event never arrives? The optimistic message stays in the UI
  as if it was sent. The `useConnection` hook handles this by reconciling
  when the connection comes back.

**When to reconsider:** This is the standard pattern for chat apps. You
wouldn't want to remove it.

---

## 13. Context Windowing for AI Conversations

**The short version:** We can't send the entire conversation history to OpenAI
(it would exceed token limits and cost too much). Instead, we send the most
recent messages and summarize older ones.

**The longer explanation:**

When the AI is invoked, it needs conversation context — but how much? A room
could have thousands of messages. Sending all of them would:

1. Exceed GPT-4o-mini's context window
2. Cost a lot in input tokens
3. Be slow (more tokens = more processing time)

Our approach (`lib/ai/context.ts`):

1. **Fetch the last 50 messages** from the room
2. **Estimate tokens** using a rough formula: `content.length / 4` characters
   per token. This isn't precise, but it's fast and close enough.
3. **If under 6,000 tokens:** Send everything. Done.
4. **If over 6,000 tokens:** Keep the most recent messages that fit within
   the budget. For the older messages that were dropped, generate a brief
   summary using a separate (non-streaming) GPT-4o-mini call.
5. **Prepend the summary** to the system prompt so the AI has context about
   the earlier conversation without needing all the raw messages.

The result: the AI always knows what the recent conversation is about, has a
summary of older context, and stays within token limits.

**Why 6,000 tokens?**

GPT-4o-mini has a large context window, but more input tokens = more cost
and latency. 6,000 tokens gives us roughly 30-40 messages of context, which
is usually enough for the AI to understand what's being discussed. The
summary fills in the rest.

**Why not use exact tokenization?**

Libraries like `tiktoken` can count tokens precisely, but they're relatively
slow and add a dependency. Our `length / 4` estimate is within 10-15% of the
actual count, which is good enough for a budget check. We're not trying to
fill the context window to the byte — we're trying to stay comfortably under
the limit.

**What we gave up:**

- The AI might miss important context from very early in a long conversation
  if the summary doesn't capture it. The summary is generated by GPT-4o-mini
  itself, so it's usually good, but it's lossy by nature.
- The summary generation adds one extra API call before the actual response.
  This adds ~1-2 seconds of latency when there's a lot of history to
  summarize.

**When to reconsider:** If conversations routinely get very long and users
expect the AI to remember details from hundreds of messages ago, we'd need
a more sophisticated approach — perhaps RAG (Retrieval-Augmented Generation)
with embeddings and a vector database to find relevant historical messages.

---

## 14. Rate Limiting on Two Layers

**The short version:** We rate-limit AI invocations both on the client (for
instant feedback) and on the server (for actual security). 10-second cooldown
per user.

**The longer explanation:**

Without rate limiting, a user could spam `@ai` and rack up OpenAI API costs.
We limit this to one AI invocation per user per 10 seconds.

But where do you enforce this? Both places:

### Client-side (Zustand store — `aiStore.ts`)

When the user clicks send with `@ai`, the `useAIStream` hook checks:

```typescript
const canInvoke = aiStore.canInvoke(userId);
if (!canInvoke) {
  // Show "Please wait before invoking AI again" message
  return;
}
aiStore.recordInvocation(userId);
```

This gives instant feedback — no network round-trip needed to tell the user
"slow down." The button disables, a message appears, and the request never
leaves the browser.

### Server-side (In-memory Map — `ratelimit.ts`)

The route handler also checks:

```typescript
const limiter = getRateLimiter();
if (!limiter.canProceed(userId)) {
  return new Response('Rate limited', { status: 429 });
}
limiter.recordRequest(userId);
```

This is the authoritative check. A clever user could bypass the client-side
limit (it's just JavaScript), but they can't bypass the server check.

**Why both?**

- Client-only: Insecure. Anyone with browser DevTools can bypass it.
- Server-only: Slow. The user sends the request, waits for the server
  response, and only then sees "rate limited." Bad UX.
- Both: Instant feedback for normal users, security against abuse.

**Why in-memory instead of Redis?**

We use a simple `Map<string, number>` on the server. This resets if the
server restarts, but that's fine — rate limits are short (10 seconds), and
a restart takes longer than that. Adding Redis for a 10-second cooldown
would be over-engineering.

**What we gave up:**

- If the app runs on multiple serverless function instances, each instance
  has its own Map. A user could theoretically hit different instances and
  bypass the limit. At our scale (one Netlify function), this isn't a problem.

**When to reconsider:** If running multiple server instances (e.g., Kubernetes
pods), use Redis or Upstash for distributed rate limiting.

---

## 15. Why Virtual Scrolling for Messages

**The short version:** A room could have thousands of messages. Rendering all
of them as DOM elements would make the browser slow. Virtual scrolling only
renders the messages currently visible on screen.

**The longer explanation:**

We use `@tanstack/react-virtual` for the message list. Here's why:

A chat room with 500 messages means 500+ DOM elements — each with avatars,
text, timestamps, and potentially markdown content. On a mid-range phone,
rendering all 500 at once causes:
- Slow initial render (hundreds of milliseconds)
- Janky scrolling (browser struggles to composite that many layers)
- High memory usage (each DOM node costs memory)

Virtual scrolling solves this by only rendering the ~15-20 messages visible
in the viewport, plus a few above and below as a buffer. As the user scrolls,
messages are added at one end and removed at the other. The browser only ever
has ~25 DOM elements, regardless of whether the room has 50 or 5,000 messages.

Our `MessageList` component also handles:
- **Date separators:** "Today", "Yesterday", "March 15" inserted between
  message groups
- **Scroll-to-bottom on new messages:** When a new message arrives while
  you're at the bottom, auto-scroll. If you've scrolled up to read history,
  don't auto-scroll (show a "new messages" pill instead).
- **Pagination:** When you scroll to the top, load older messages via cursor-
  based pagination (fetch messages where `created_at < oldest visible
  message`).

**What we gave up:**

- Complexity. Virtual scrolling introduces edge cases: variable-height rows,
  scroll position preservation when prepending old messages, measuring
  elements before they're visible. `@tanstack/react-virtual` handles most of
  this, but it's still more complex than a simple `messages.map()`.
- Search highlighting. When the user searches for a message and clicks a
  result, we need to scroll to that message. With virtual scrolling, that
  message might not be in the DOM yet. We handle this by loading it into view
  first, then highlighting it.

**When to reconsider:** If messages were always short (no markdown, no images)
and rooms never exceeded a few hundred messages, simple rendering would be
fine and simpler. But chat rooms tend to grow, so virtual scrolling is the
right default.

---

## 16. The Mobile-First Layout Strategy

**The short version:** We write styles for mobile first, then add complexity
for larger screens. On mobile, you see either the room list OR the chat — not
both. On tablet, you get a narrow icon sidebar. On desktop, you get the full
sidebar with room names.

**The longer explanation:**

The layout adapts across three breakpoints:

| Screen | Width | Layout |
|--------|-------|--------|
| Mobile | < 768px | One screen at a time: room list OR chat. Sidebar is a drawer that slides in from the left. |
| Tablet | 768px–1023px | Icon-only sidebar (72px wide) + chat area. No room names, just icons. |
| Desktop | 1024px+ | Full sidebar with room names + chat area + optional member panel on the right. |

**Why mobile-first?**

In CSS, "mobile-first" means you write the base styles for mobile, then use
`md:` and `xl:` prefixes to add styles for larger screens. The alternative
("desktop-first") writes desktop styles first and uses `max-width` media
queries to override for mobile.

Mobile-first is better because:

1. **The base case is the simplest.** Mobile layouts are typically single-
   column. Adding complexity for wider screens is easier than removing
   complexity for narrower ones.
2. **Mobile is the harder constraint.** If it works on a 375px-wide phone
   screen, it definitely works on a 1440px desktop. The reverse isn't true.
3. **Tailwind is designed for it.** Unprefixed utilities are mobile, `md:`
   is tablet, `xl:` is desktop. Going against this fights the framework.

**Specific mobile considerations:**

- **Touch targets: 44x44px minimum.** Every button, link, and interactive
  element is at least 44x44 pixels. Apple's Human Interface Guidelines
  recommend this as the minimum for comfortable touch interaction.
- **`h-dvh` not `h-screen`.** On mobile browsers, `100vh` (`h-screen`)
  doesn't account for the browser's address bar. `100dvh` (`h-dvh`) does —
  it uses the "dynamic viewport height" that adjusts when the address bar
  shows or hides.
- **Input font size: 16px minimum.** On iOS Safari, if an input's font size
  is below 16px, the browser zooms in when the user taps the input. We use
  `text-base` (16px) on mobile and `md:text-sm` (14px) on desktop.
- **Safe area insets.** On phones with notches or home indicators, content
  needs to avoid the system UI areas. We use `safe-top` and `safe-bottom`
  utilities that map to `env(safe-area-inset-*)`.

**What we gave up:**

- Desktop users don't get a maximally optimized desktop experience. The
  layout works great on desktop, but it wasn't designed for desktop first.
  Since most modern web apps are used on a mix of devices, this is the right
  tradeoff.

**When to reconsider:** If analytics showed that 95%+ of users were on
desktop, we might design the desktop layout first and simplify for mobile.
But for a general-purpose team workspace, mobile-first is the right call.

---

## Summary: The Philosophy Behind These Decisions

Every decision in this project follows a few core principles:

1. **Use the platform.** Browser APIs for voice, Postgres for relational
   data, CSS for configuration. Don't add layers when the platform already
   provides what you need.

2. **Optimize for the common case.** A 10-second rate limit in memory instead
   of Redis. A token estimate instead of exact tokenization. 150ms flush
   intervals instead of per-token database writes. Good enough beats perfect
   when perfect costs much more.

3. **Security at the boundary.** Auth checks happen on the server, before any
   data is sent. RLS policies enforce access at the database layer. Rate
   limits live on both client (for UX) and server (for enforcement).

4. **Data flows down.** Server Components fetch data, Client Components
   receive it as props. Real-time updates flow from database → Supabase →
   Zustand → React. Never the reverse (except through Server Actions).

5. **Ship, then optimize.** Web Speech API instead of cloud TTS. In-memory
   rate limiting instead of Redis. Rough token estimation instead of
   tiktoken. Every "when to reconsider" section tells you when the simple
   approach stops being sufficient.

---

*Last updated: 2026-04-05*
*This document reflects the current state of the codebase.*
