# Quorum

**Your team, plus the intelligence it needs — exactly when it needs it.**

Quorum is a real-time collaborative team workspace with an on-demand AI assistant. Team members chat in real-time across rooms, and an AI assistant joins conversations when explicitly summoned via `@ai` mention. The AI reads the full conversation context and responds like a participant, not a chatbot.

Built as a technical assessment for Kochanet.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | Supabase (Postgres) |
| Real-time | Supabase Realtime + Presence |
| Auth | BetterAuth (GitHub OAuth + email/password) |
| AI | OpenAI GPT-4o-mini via Vercel AI SDK |
| Voice | Web Speech API (browser-native) |
| State | Zustand |
| Deployment | Netlify |

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project
- An OpenAI API key
- A GitHub OAuth app (for social login)

### Setup

1. Clone the repository and install dependencies:

```bash
git clone <repo-url>
cd quorum
npm install
```

2. Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DATABASE_URL=
OPENAI_API_KEY=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
BETTER_AUTH_SECRET=       # generate with: openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

3. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the app.

### Test Accounts

| User | Email | Password |
|------|-------|----------|
| Alice | alice@test.com | TestPass123! |
| Bob | bob@test.com | TestPass123! |

## Features

- **Real-time messaging** — Messages appear instantly for all room members via Supabase Realtime
- **AI assistant** — Type `@ai` in any message to get a contextual AI response streamed in real-time
- **GitHub OAuth + email/password auth** — Secure session-based authentication via BetterAuth
- **Voice input** — Dictate messages using browser-native speech recognition
- **AI text-to-speech** — Have AI responses read aloud
- **Typing indicators** — See who's typing via ephemeral Supabase Presence
- **Online status** — See who's currently in the room
- **Message search** — Full-text search powered by Postgres
- **Dark mode** — Toggle between light and dark themes
- **Mobile-first responsive design** — Works on phones, tablets, and desktops
- **Virtual scrolling** — Smooth performance even with thousands of messages

## Learn More

**[Architecture Decisions](./DECISIONS.md)** — A comprehensive, plain-English walkthrough of every major technical decision in this project: why we chose each technology, how the key systems work behind the scenes, what tradeoffs we made, and when we might need to reconsider. Start here if you want to deeply understand how Quorum is built.

## Deployment

Deployed on Netlify. See `netlify.toml` for configuration.

Post-deploy checklist:
- Update `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to your Netlify URL
- Add the production callback URL to your GitHub OAuth app
- Add the Netlify URL to Supabase's allowed redirect URLs
- Enable Supabase Realtime on the `messages`, `rooms`, and `room_members` tables