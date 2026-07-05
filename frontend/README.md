# 🎨 Déjà — Frontend App (React & Vite)

This directory contains the user interface for the **Déjà Memory Recovery Engine**. It is a modern React application built on Vite, designed with a premium, responsive glassmorphism design system to deliver an immersive and intuitive memory recovery experience.

---

## 🏛️ Directory Layout

The frontend codebase is modularized into dedicated folders separating pages, layout engines, context states, and style specifications:

```bash
frontend/
├── index.html        # HTML entry point (loads Outfit & Inter Google Fonts)
├── vite.config.js    # Vite builder and oxlint plugins config
├── package.json      # Node dependency registry (React 19, Supabase JS, Vite)
├── src/
│   ├── App.jsx       # App shell loading providers and routing
│   ├── main.jsx      # DOM mounting script
│   ├── tokens.css    # Global CSS Design Tokens (spacing, colors, font families)
│   ├── index.css     # General style rules (custom scrollbars, animations, layout)
│   ├── context/      # Context providers managing global application state
│   │   ├── AuthContext.jsx       # User sign-ins, JWTs, and Supabase integration
│   │   ├── ThemeContext.jsx      # Light/Dark mode state
│   │   ├── NavigationContext.jsx # Section routes (Slate, Timeline, Oracle, etc.)
│   │   ├── MemoryContext.jsx     # Controls journal entries, sync timers, and fetches
│   │   └── BookmarksContext.jsx  # Manages pinned insights and bookmarks
│   ├── components/   # Interface component modules
│   │   ├── Chassis/              # Premium frame and sidebar/bottom nav layout
│   │   ├── AuthModal/            # Supabase authentication interface
│   │   ├── BookmarksModal/       # Bookmarked insights overlay
│   │   ├── MemorySafeguardModal/ # Pruning and graph forget triggers
│   │   ├── MicOrb/               # Voice visualizer animation for journal entry
│   │   ├── ParadoxAlert/         # Visual prompt warning users of contradictions
│   │   ├── DailyPrompt/          # Rotating journaling prompts for memory recovery
│   │   └── sections/             # Primary app tabs
│   │       ├── SlateSection/     # Daily journal writer (Markdown-enabled)
│   │       ├── HistorySection/   # Visual interactive memory timeline
│   │       ├── OracleSection/    # Deep semantic Q&A input and chat log
│   │       └── BlindspotSection/ # Semantic gap and contradiction analysis
│   ├── hooks/        # Reusable custom React hooks
│   ├── lib/          # Database client initiators (Supabase)
│   └── utils/        # General formatters and helper scripts
```

---

## 🎨 Premium Design System

The application styling follows advanced modern web principles to create a polished, state-of-the-art layout:
* **Typography**: Outfitted with *Outfit* (for sharp, futuristic headers) and *Inter* (for clean, readable body text).
* **Glassmorphism**: Leverages subtle background filters (`backdrop-filter: blur(12px)`) combined with thin, high-contrast borders and translucent gradients to give components a glass-like aesthetic.
* **Theme Engine**: Integrated with CSS Custom Properties (`tokens.css`). Transitions between Dark and Light mode are animated smoothly using CSS transitions (`transition: all 0.3s ease`).
* **Micro-Animations**:
  * **MicOrb**: Interactive circular gradient animations designed to respond to microphone interactions or loading states during semantic ingestion.
  * **Timeline Entries**: Fade-in and slide-up animations as the user scrolls or adds memories.

---

## 🔌 Integrating the Gateway API

The frontend interacts with the Express API Gateway via standard authorization headers.

Whenever a user is logged in:
1. `AuthContext` retrieves the active session's JsonWebToken (JWT).
2. The user profile ID is set using the header key `x-user-profile` (maps to their Supabase UUID).
3. The auth token is set using `x-user-token`.
4. API calls to `/api/memory/ingest` and `/api/memory/recover` automatically forward these headers to ensure secure, isolated tenant spaces on both Supabase and Cognee Cloud.

---

## 🚀 Local Development

To run the frontend locally:

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Configure variables in .env
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
VITE_API_URL="http://localhost:5051"

# 3. Install packages
npm install

# 4. Start Vite development server
npm run dev
```
The application will launch on `http://localhost:5173`. Ensure your backend gateway is running on port `5051`.
