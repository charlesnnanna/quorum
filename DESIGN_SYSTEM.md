# Quorum Design System

### Tailwind v4 · Mobile-First · Responsive across Mobile, Tablet, Desktop

---

## Critical Notes for Claude Code

1. **This project uses Tailwind v4** — there is NO `tailwind.config.ts` file.
   All theme configuration lives in `globals.css` using the `@theme` directive.
   Never generate a `tailwind.config.ts` or `tailwind.config.js` file.

2. **Build mobile-first** — every component starts with the mobile layout.
   Tablet and desktop layouts are added with `md:` and `xl:` prefixes.
   Never write desktop styles first and try to override for mobile.

3. **Tailwind v4 syntax** — use `@import "tailwindcss"` not the three
   `@tailwind base/components/utilities` directives. Custom utilities use
   `@utility`, custom variants use `@variant`, theme values use `@theme`.

---

## 1. Color Palette

### Primary Colors

```
--color-primary:         #2D00F7   Deep electric blue — CTAs, active states, accents
--color-primary-hover:   #2400CC   Darker on hover
--color-primary-light:   #EEF0FF   Light blue tint — backgrounds, hover fills
--color-primary-muted:   #6366F1   Softer purple-blue — typing indicators, secondary
```

### Background Colors

```
--color-bg-app:          #0A0A2E   Dark navy — page background (behind white panels)
--color-bg-panel:        #FFFFFF   White — all panel surfaces
--color-bg-input:        #F4F5F7   Light gray — search bars, message input field
--color-bg-hover:        #F8F9FF   Near-white blue — hover on list items
--color-bg-active:       #EEF0FF   Light blue — selected item background
```

### Text Colors

```
--color-text-primary:    #111827   Near-black — names, main content
--color-text-secondary:  #6B7280   Medium gray — previews, subtitles
--color-text-muted:      #9CA3AF   Light gray — timestamps, placeholders
--color-text-on-primary: #FFFFFF   White — on blue backgrounds
--color-text-link:       #2D00F7   Links
```

### Semantic Colors

```
--color-online:          #22C55E   Green — online presence
--color-offline:         #D1D5DB   Gray — offline
--color-error:           #EF4444   Red — errors, delete
--color-border:          #E5E7EB   Panel borders, dividers
--color-border-active:   #2D00F7   Active tab underline, selected room
```

### Message Bubble Colors

```
--color-bubble-received: #FFFFFF   White — received bubbles
--color-bubble-sent:     #FFFFFF   White — sent bubbles (right-aligned)
--color-bubble-ai:       #F0F0FF   Very light blue — AI messages
--color-bubble-ai-border:#C7D2FE   Soft blue border on AI messages
```

---

## 2. globals.css (Complete File — Tailwind v4)

This is the COMPLETE globals.css. Replace the default Next.js file entirely.

```css
@import 'tailwindcss';

/* ============================================================
   THEME — Tailwind v4 uses @theme instead of tailwind.config
   ============================================================ */
@theme {
  /* Colors */
  --color-primary: #2d00f7;
  --color-primary-hover: #2400cc;
  --color-primary-light: #eef0ff;
  --color-primary-muted: #6366f1;

  --color-bg-app: #0a0a2e;
  --color-bg-panel: #ffffff;
  --color-bg-input: #f4f5f7;
  --color-bg-hover: #f8f9ff;
  --color-bg-active: #eef0ff;

  --color-text-primary: #111827;
  --color-text-secondary: #6b7280;
  --color-text-muted: #9ca3af;
  --color-text-on-primary: #ffffff;
  --color-text-link: #2d00f7;

  --color-online: #22c55e;
  --color-offline: #d1d5db;
  --color-error: #ef4444;
  --color-border: #e5e7eb;
  --color-border-active: #2d00f7;

  --color-bubble-received: #ffffff;
  --color-bubble-sent: #ffffff;
  --color-bubble-ai: #f0f0ff;
  --color-bubble-ai-border: #c7d2fe;

  /* Typography */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;

  /* Border Radius */
  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.25rem;

  /* Shadows */
  --shadow-bubble: 0 1px 3px rgba(0, 0, 0, 0.06);
  --shadow-panel: 0 20px 60px rgba(0, 0, 0, 0.2);
  --shadow-popup: 0 10px 30px rgba(0, 0, 0, 0.12);
  --shadow-card: 0 4px 12px rgba(0, 0, 0, 0.08);

  /* Breakpoints */
  --breakpoint-xs: 375px;
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1536px;
}

/* ============================================================
   KEYFRAMES
   ============================================================ */
@keyframes messageIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes typingBounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

@keyframes onlinePulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes popIn {
  from {
    opacity: 0;
    transform: translateY(-12px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes slideInRight {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

@keyframes slideInLeft {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}

@keyframes slideInUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* ============================================================
   BASE STYLES
   ============================================================ */
@layer base {
  *,
  *::before,
  *::after {
    box-sizing: border-box;
    -webkit-tap-highlight-color: transparent;
  }

  html {
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
  }

  body {
    background-color: var(--color-bg-app);
    background-image:
      radial-gradient(
        ellipse at 20% 50%,
        rgba(45, 0, 247, 0.15) 0%,
        transparent 60%
      ),
      radial-gradient(
        ellipse at 80% 20%,
        rgba(99, 102, 241, 0.1) 0%,
        transparent 50%
      );
    color: var(--color-text-primary);
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    height: 100dvh;
    overflow: hidden;
  }

  /* Custom scrollbar — desktop only */
  @media (min-width: 768px) {
    ::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: #e5e7eb;
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #d1d5db;
    }
  }

  /* Mobile: hide scrollbars visually but keep scrolling */
  @media (max-width: 767px) {
    * {
      scrollbar-width: none;
    }
    *::-webkit-scrollbar {
      display: none;
    }
  }
}

/* ============================================================
   UTILITIES — Tailwind v4 uses @utility for custom classes
   ============================================================ */

/* App shell — white container. Full screen on mobile, floating card on desktop */
@utility app-shell {
  background-color: var(--color-bg-panel);
  overflow: hidden;
  width: 100%;
  height: 100dvh;

  @media (min-width: 768px) {
    border-radius: 1.25rem;
    box-shadow: var(--shadow-panel);
    margin: 1.5rem auto;
    height: calc(100dvh - 3rem);
    max-width: 1400px;
  }
}

/* Message bubbles */
@utility bubble-base {
  padding: 0.625rem 0.875rem;
  font-size: 0.875rem;
  line-height: 1.5;
  max-width: 80%;
  word-break: break-word;
  box-shadow: var(--shadow-bubble);

  @media (min-width: 768px) {
    max-width: 65%;
  }
}

@utility bubble-received {
  background-color: var(--color-bubble-received);
  border: 1px solid #f3f4f6;
  border-radius: 4px 16px 16px 16px;
}

@utility bubble-sent {
  background-color: var(--color-bubble-sent);
  border: 1px solid #f3f4f6;
  border-radius: 16px 4px 16px 16px;
  margin-left: auto;
}

@utility bubble-ai {
  background-color: var(--color-bubble-ai);
  border: 1px solid var(--color-bubble-ai-border);
  border-radius: 4px 16px 16px 16px;
}

/* Navigation items */
@utility nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition:
    background-color 150ms,
    color 150ms;
  user-select: none;
  -webkit-user-select: none;

  &:hover {
    background-color: var(--color-bg-hover);
    color: var(--color-text-primary);
  }
}

@utility nav-item-active {
  background-color: var(--color-bg-active);
  color: var(--color-primary);
}

/* Minimum 44x44px touch target — wrap icon buttons in this */
@utility tap-target {
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Safe area insets for mobile (notch / home indicator) */
@utility safe-top {
  padding-top: env(safe-area-inset-top);
}
@utility safe-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
@utility safe-left {
  padding-left: env(safe-area-inset-left);
}
@utility safe-right {
  padding-right: env(safe-area-inset-right);
}

/* Presence dot */
@utility presence-dot {
  width: 10px;
  height: 10px;
  border-radius: 9999px;
  border: 2px solid white;
  flex-shrink: 0;
}
```

---

## 3. Responsive Layout Architecture (Mobile-First)

### The Core Principle

Mobile is NOT a scaled-down desktop. It is a completely different layout
that shares the same data, colors, and components.

```
MOBILE  (<768px)   Single column. One screen at a time. Stack navigation.
TABLET  (768px+)   Two columns. Room list + chat side by side.
DESKTOP (1280px+)  Four columns. Full layout as in the reference screenshots.
```

### Mobile Layout (Write This First — No Prefix)

```
┌─────────────────────┐
│  Status Bar         │  ← safe-area-inset-top
├─────────────────────┤
│  Screen Header      │  ← 56px — back button + title + action icons
├─────────────────────┤
│                     │
│   Main Content      │  ← flex-1, overflow-y-auto
│   (Room list OR     │
│    Chat messages)   │
│                     │
├─────────────────────┤
│  Input / Bottom Nav │  ← Fixed, 56px
│  Home Indicator     │  ← safe-area-inset-bottom
└─────────────────────┘
```

Mobile uses a **stack navigation model**:

- `/rooms` — Room list screen (base)
- `/rooms/[id]` — Chat screen (pushed on top, back button returns to list)
- User info — Full-screen sheet or bottom sheet on top of chat

### Tablet Layout (md: — 768px+)

```
┌──────────────────┬──────────────────────────┐
│  Room List 280px │   Chat Area flex-1        │
│                  │   Header                  │
│  Search + Tabs   │   Messages                │
│  + Conv List     │   Input bar               │
└──────────────────┴──────────────────────────┘
```

### Desktop Layout (xl: — 1280px+)

```
┌──────┬────────────┬──────────────┬─────────────────────┐
│ Rail │  Sidebar   │  Room List   │   Chat Area         │
│ 72px │  220px     │  280px       │   flex-1            │
└──────┴────────────┴──────────────┴─────────────────────┘
```

---

## 4. Component Specifications (Mobile-First)

### 4.1 Bottom Navigation (Mobile Only — hidden md:hidden)

```
Fixed bottom, full width
Height: 56px + safe-area-inset-bottom
Background: white
Border-top: 1px solid #E5E7EB
z-index: 50
4 tabs: Chats | Search | Notifications | Profile
Each tab: icon 22px + label text-[10px] below, tap-target minimum
Active: text + icon in #2D00F7
Inactive: text + icon in #9CA3AF
```

### 4.2 Mobile Chat Header

```
Height: 56px + safe-area-inset-top
Sticky top-0, z-10
Background: white, border-bottom 1px #E5E7EB

Left:   ChevronLeft (back, md:hidden) + Avatar 36px + Name + "Online"
Right:  Video icon + Phone icon + MoreVertical icon
        Each in tap-target wrapper (44x44px)

Name:   text-[15px] font-semibold
Status: text-xs text-green-500
```

### 4.3 Room List

```
MOBILE (base):
  Full screen, stacks under header
  Search: mx-4 mt-3, bg-bg-input, rounded-xl, h-10
  Tabs: px-4, border-bottom border-border
  List: overflow-y-auto, pb-14 (space for bottom nav)
  Conversation item: h-[72px] px-4, touch-friendly

TABLET+ (md:):
  Fixed panel, w-[280px], border-r border-border
  Always visible alongside chat

Conversation item anatomy:
  Avatar:   44px rounded-full (slightly larger than desktop for touch)
  Name:     text-[15px] font-semibold
  Preview:  text-sm text-text-secondary truncate
  Time:     text-xs text-text-muted
  Badge:    18px circle bg-primary text-white text-[10px]
  Height:   72px (touch-safe)
```

### 4.4 Message Bubbles

```
Bubble max-width:
  Mobile:   80%    (base, no prefix)
  Tablet:   70%    (md:max-w-[70%])
  Desktop:  65%    (xl:max-w-[65%])

Avatar in received messages:
  Mobile:   28px
  Desktop:  32px   (md:w-8 md:h-8)

Timestamp placement:
  Mobile:   Inside bubble, bottom-right (space-saving — like WhatsApp)
  Desktop:  Below bubble, outside     (md:outside pattern)

Message padding:
  Mobile:   px-4 py-3
  Desktop:  px-5 py-4   (md:px-5 md:py-4)
```

### 4.5 Message Input Bar

```
MOBILE (base):
  Sticky bottom-0, safe-bottom
  Height: auto, min 56px
  px-3 py-2
  Layout: [Textarea flex-1] [Mic when empty | Send when has text]
  Font size: text-base (16px) — REQUIRED to prevent iOS Safari zoom
  Mic: tap-target, visible when input empty (hidden when text present)
  Send: 40px circle bg-primary

DESKTOP (md:):
  Layout: [Attach] [Textarea flex-1] [Emoji] [Mic] [Send]
  Textarea: text-sm (14px is fine on desktop)
  More action icons visible
  Input does not need to be sticky (it's in a flex column)
```

### 4.6 User Info Panel

```
MOBILE:
  Bottom sheet, slides up from bottom (slideInUp animation)
  border-radius: 20px 20px 0 0
  height: 85dvh
  Has drag handle at top (pill shape, 4px × 40px, bg-gray-300)
  Backdrop: fixed inset-0 bg-black/40 z-40

TABLET (md:):
  Right drawer, slides in from right (slideInRight)
  width: 320px
  Overlays chat area with backdrop

DESKTOP (xl:):
  Pushes chat area (no overlay)
  width: 320px
  Part of the flex row
```

---

## 5. Mobile-Specific UX Rules

### Keyboard and Viewport

```
ALWAYS use h-dvh not h-screen for full-height containers.
dvh = dynamic viewport height = accounts for browser chrome + soft keyboard.

Add to root layout <head>:
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />

viewport-fit=cover enables safe-area-inset values on notched/punch-hole devices.
```

### Touch Targets

```
Minimum 44×44px for ALL interactive elements.
Use the tap-target utility class on icon button wrappers.
List items minimum 56px height.
Never rely on hover states for functionality — hover doesn't exist on touch.
```

### Font Size in Inputs

```
ALL <input>, <textarea>, <select> elements must be text-base (16px) on mobile.
Use: className="text-base md:text-sm"
Reason: iOS Safari auto-zooms when input font-size < 16px, breaking the layout.
```

### Swipe & Touch Gestures

```
MVP: skip custom swipe gestures
Do: use long-press context menu on messages (copy, reply)
Do: ensure scroll momentum feels native (overflow-y-auto, not overflow-y-scroll)
Avoid: blocking default touch behavior with event.preventDefault() unnecessarily
```

---

## 6. Screens Not in the Reference Screenshots

Build these with the same tokens, mobile-first:

### Login / Register

```
MOBILE (base):
  Full dark screen (bg-bg-app)
  Logo centered, top 20% of viewport
  "Quorum" brand text-2xl font-bold text-white below logo
  Form fills screen px-6 py-8
  Inputs: bg-white/10 backdrop-blur text-white rounded-xl
          OR: bg-white text-text-primary rounded-xl
  Submit: w-full h-12 bg-primary text-white rounded-xl text-base
  OAuth:  w-full h-12 bg-white border border-border text-text-primary rounded-xl
  Tagline: "Your team, plus the intelligence it needs" text-sm text-white/60

DESKTOP (md:):
  Same dark background
  Floating white card: max-w-md mx-auto rounded-2xl shadow-panel p-8
  Inputs revert to standard light style inside the card
```

### Empty States

```
No room selected (tablet/desktop right panel):
  Centered icon (MessageSquare 64px text-primary-light)
  "Select a conversation" text-lg font-semibold
  "Choose a channel from the sidebar" text-sm text-text-muted

No messages in room:
  Centered icon (Sparkles 48px text-primary)
  "Start the conversation" text-base font-semibold
  "Type @ai to summon Quorum AI" — small blue pill badge below

No rooms at all:
  "Create your first channel" + button (full width mobile, auto desktop)
```

### Error/Offline Banner

```
Fixed top of screen, below header
Height: 36px
Background: #EF4444
Text: white text-sm text-center
"You're offline — reconnecting..."
Slide down when shown, slide up when resolved
```

### Create Room Modal/Sheet

```
Mobile:   Bottom sheet (75dvh, rounded top 20px)
Desktop:  shadcn Dialog modal, max-w-md
Fields:   Room name (required), description (optional)
Toggle:   Private room switch (shadcn Switch, active color: primary)
Submit:   "Create Channel" — full width mobile, auto desktop
```

---

## 7. AI Message Visual Identity

```
Avatar (all sizes):
  Gradient circle: linear-gradient(135deg, #2D00F7, #6366F1)
  Mobile:  28px
  Desktop: 32px
  Icon:    Sparkles (lucide-react), white, 12-14px

Sender label above bubble:
  "Quorum AI"
  text-xs font-semibold text-primary
  Only on first message of an AI sequence

Bubble:
  bg-bubble-ai border border-bubble-ai-border
  border-radius: 4px 16px 16px 16px (same as received)
  Left-aligned with avatar (same as human received)

Streaming state:
  Three bouncing dots in primary color
  animate-typing (staggered: delay 0ms, 150ms, 300ms)
  Replace with text as it streams in

TTS button (after complete):
  Mobile:  🔊 icon only, text-primary, tap-target
  Desktop: "🔊 Play response" text-xs text-primary

Error state:
  border-error (red border)
  Content: "I'm having trouble responding. Please try again."
  "Retry" link in text-primary
```

---

## 8. Claude Code Prompt Template (Mobile-First Version)

Use this at the start of EVERY component prompt:

```
Build [component name] for Quorum.

References: DESIGN_SYSTEM.md, CLAUDE.md

This project uses Tailwind v4. There is NO tailwind.config.ts.
All custom tokens are defined in globals.css using @theme.
Use CSS variable names like text-[--color-primary] or bg-[--color-bg-input].

MOBILE-FIRST RULES (non-negotiable):
- Write mobile styles FIRST (no breakpoint prefix)
- Use md: for tablet (768px+), xl: for desktop (1280px+)
- All touch targets: minimum 44×44px using the tap-target utility
- All text inputs: text-base on mobile (16px prevents iOS zoom), md:text-sm on desktop
- Full-height containers: use h-dvh not h-screen
- Safe areas: use safe-top / safe-bottom utilities on fixed elements

Design tokens to use:
- Primary: #2D00F7 (or bg-[--color-primary])
- Input bg: #F4F5F7 (or bg-[--color-bg-input])
- Border: #E5E7EB (or border-[--color-border])
- [Add component-specific tokens from Section 1]

Component behavior:
- Mobile: [describe mobile behavior]
- Tablet (md:): [describe tablet layout]
- Desktop (xl:): [describe desktop layout]

Technical requirements:
- TypeScript, explicit prop interfaces named [ComponentName]Props
- Tailwind v4 utility classes only — no inline styles
- Use cn() for conditional classes
- shadcn/ui primitives where appropriate
- aria-labels on all icon-only buttons
- No hover-only interactions (hover doesn't exist on touch)
```

---

_This is the single visual source of truth for Quorum._
_Place in project root alongside CLAUDE.md and DECISIONS.md._
_Last updated: Project initialization — Tailwind v4, mobile-first._
