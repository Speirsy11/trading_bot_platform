# Frontend Theme Exploration — Styled React Prototypes

## Agent System Prompt

```xml
<role>
You are an elite UI/UX designer and frontend engineer with extraordinary taste. You
specialise in dark-themed financial dashboards and have deep expertise in React,
Tailwind CSS, component composition, motion design, and trading terminal aesthetics.

You create production-quality React prototypes that demonstrate bold, distinctive visual
identities. You never produce generic "AI slop" — every design decision is intentional,
opinionated, and memorable. You treat each theme as a unique aesthetic philosophy with
its own typographic voice, colour psychology, spatial rhythm, and atmospheric character.
</role>

<constraints>
- You MUST produce 5 completely unique theme prototypes — each with a fundamentally
  different aesthetic direction, colour system, typographic personality, and mood.
- You own ALL creative decisions: theme names, colour palettes, typography, layout
  variations, animation styles, and atmospheric background treatments. No guidance is provided —
  demonstrate your range.
- Themes must feel like they were crafted by 5 different world-class design studios,
  not 5 variations from the same template.
- Verbosity: Low — focus on code output, not explanation.
- Tone: Technical and creative.
</constraints>

<output_format>
Structure your work as follows:
1. For each theme: a brief design rationale (2-3 sentences max)
2. The React component code
3. Proceed to the next theme
4. After all 5 themes: the Playwright screenshot script
</output_format>
```

---

## Task Prompt

```xml
<context>
You are building theme prototypes for a crypto trading bot dashboard. The final app is
a Next.js 15 + Tailwind CSS + shadcn/ui application (apps/web). These prototypes will
be evaluated visually — the chosen theme will later be implemented in the full app by
a separate agent.

The prototypes must be REAL styled React applications — not static HTML. They should
look exactly as the final dashboard would look, using the same component patterns,
Tailwind classes, and visual density that a production trading app would have.

All data is mocked — no backend connection is needed.

IMPORTANT REFERENCES — read these before starting:
- 01b-FRONTEND-IMPLEMENTATION.md Sections 3-4: Page structure and component hierarchy
  the wireframes should approximate.
- 00-ARCHITECTURE.md: Overall platform vision and what the dashboard needs to support.
</context>

<task>
Create 5 visually distinct, production-quality React theme prototypes for the crypto
trading bot dashboard. Each theme is a standalone React app with mocked data, viewable
in a browser and screenshotted via Playwright for comparison.

The existing scaffold is intentionally minimal and unopinionated. Do not treat any
existing blank files, generic labels, or neutral wrappers as design guidance.

YOU decide everything about each theme's identity:
- Name and aesthetic philosophy
- Colour palette (backgrounds, accents, profit/loss, text hierarchy)
- Typography (font pairings — use distinctive, non-generic Google Fonts choices; NEVER
  use Inter, Roboto, Arial, or system fonts across themes)
- Layout variations (sidebar width, card density, spacing rhythm, grid structure)
- Animation and motion style (subtle vs dramatic, what triggers transitions)
- Background and atmospheric treatment (see Section 5 below)
- Card/border/shadow treatment
- Chart placeholder styling
- Overall mood and personality

The ONLY hard requirement is that the 5 themes must be MEANINGFULLY DIFFERENT from
each other — different enough that comparing them is an interesting choice, not a
question of "slightly warmer blue vs slightly cooler blue."

Think across the full aesthetic spectrum: brutalist, luxury-minimal, retro-terminal,
neo-futurist, organic, editorial, industrial, art-deco, hyper-clean, maximalist,
warm analog, cool digital, etc. Use these as inspiration — don't feel bound to them.
</task>

<final_instruction>
Before starting each theme, pause to articulate (in 2-3 sentences) the design
philosophy — what makes this theme distinctive, what mood it creates, and what kind
of trader it's designed for. Then execute that vision with precision and craft.

After completing all 5 themes, validate your work by running the Playwright screenshot
script and generating the comparison catalog.
</final_instruction>
```

---

## 1. Directory Structure

```
apps/web/wireframes/
├── shared/
│   ├── mock-data.ts              ← Shared realistic mock data (all themes import this)
│   └── types.ts                  ← Minimal types for mock data
├── theme-1/
│   ├── index.tsx                 ← Entry point (renders the 4 pages)
│   ├── Homepage.tsx
│   ├── Dashboard.tsx
│   ├── Trading.tsx
│   ├── Bots.tsx
│   ├── components/               ← Theme-specific components (sidebar, cards, tables, etc.)
│   └── theme.css                 ← Theme-specific Tailwind overrides / CSS variables
├── theme-2/
│   └── ... (same structure)
├── theme-3/
│   └── ...
├── theme-4/
│   └── ...
├── theme-5/
│   └── ...
├── vite.config.ts                ← Vite config for building/serving the wireframes
├── index.html                    ← Root HTML with mount point
├── main.tsx                      ← Router to switch between themes/pages
├── screenshot.ts                 ← Playwright script to capture all pages
├── package.json                  ← Standalone deps (react, vite, tailwind, playwright, etc.)
└── screenshots/                  ← Playwright-generated output
    ├── theme-1-homepage.png
    ├── theme-1-dashboard.png
    ├── theme-1-trading.png
    ├── theme-1-bots.png
    ├── theme-2-dashboard.png
    ├── ...
    └── catalog.html              ← Single comparison page with all screenshots
```

## 2. Technical Setup

The wireframe app is a **standalone Vite + React project** inside `apps/web/wireframes/`.
It does NOT use the Next.js app or its config — it's fully self-contained with its own
`package.json`, `vite.config.ts`, and `tailwind.config.ts`.

The setup and tooling are already scaffolded. The design task should focus on styling
and page composition inside the existing theme/page files rather than package setup.

**Dependencies** (install in `apps/web/wireframes/`):

- `react`, `react-dom` — UI framework
- `react-router-dom` — Client-side routing between themes/pages
- `vite`, `@vitejs/plugin-react` — Build tooling
- `tailwindcss`, `postcss`, `autoprefixer` — Styling
- `lightweight-charts` — TradingView chart placeholders (use real chart lib with mock data)
- `framer-motion` or `motion` — Animations and transitions
- `@playwright/test` — Screenshots
- Google Fonts loaded via `<link>` tags in `index.html` (each theme picks its own fonts)

**Routing structure** (react-router-dom):

```
/theme-1/homepage
/theme-1/dashboard
/theme-1/trading
/theme-1/bots
/theme-2/dashboard
... etc
```

This allows Playwright to navigate directly to each page by URL.

## 3. Page Requirements

Each theme must render 4 pages. All pages use the same mock data but styled according
to the theme's visual identity. Pages should approximate the layout described in
01b-FRONTEND-IMPLEMENTATION.md Sections 4.1, 4.2, and 4.5.

### Homepage / Landing Page

- Marketing or brand-forward landing page for the platform
- Hero section, positioning, social proof, product highlights, and call-to-action
- May be more expressive than the application pages while still belonging to the theme

### Dashboard Page

- Sidebar navigation with theme-appropriate styling and active state
- Header bar with page title or breadcrumbs
- Portfolio summary cards (total value, 24h change, PnL) with profit/loss colour coding
- Chart area with a REAL candlestick chart (use `lightweight-charts` with mock OHLCV data)
- Active bots grid (cards with name, strategy, status indicator, PnL)
- Recent trades table with realistic mock data and alternating row styling

### Trading Terminal Page

- Large candlestick chart (multi-timeframe tabs, `lightweight-charts` with mock data)
- Order book panel (bid/ask levels with depth visualisation bars)
- Order form (market/limit tabs, buy/sell buttons, input fields)
- Open orders table
- Positions table with unrealised PnL

### Bot Management Page

- Bot list table with status indicators (running/stopped/paused dot colours)
- Filter bar (status, exchange, strategy dropdowns)
- Action buttons (start, stop, configure, delete)
- Bot detail panel showing performance metrics (Sharpe, win rate, max drawdown, etc.)
- Mini equity curve chart for the selected bot

### UI Elements Every Theme Must Demonstrate

- Background layering (page bg → card bg → input bg → hover state)
- Full text hierarchy (h1, h2, h3, body, muted, monospace numbers)
- Profit/loss colour coding on financial numbers
- Button styles (primary, secondary, destructive, ghost)
- Table styling (header, body, hover, selected)
- Card/panel borders, shadows, or other framing treatment
- Form elements (inputs, selects, toggles)
- Status indicators with semantic colours
- Loading/skeleton states (at least one example per page)

## 4. Mock Data

Create a shared `mock-data.ts` with realistic data that all themes import:

- **Portfolio**: Total value ~$127,450.83, 24h change +3.2%, asset allocations (BTC 45%, ETH 30%, SOL 15%, etc.)
- **OHLCV candles**: ~200 candles of realistic crypto price data (use a simple random walk generator with seed)
- **Bots**: 6-8 bots with varied statuses (3 running, 2 stopped, 1 paused, 1 error), different strategies (SMA Crossover, RSI Mean Reversion, Bollinger Breakout, etc.), varied PnL
- **Order book**: 15-20 levels each side with realistic bid/ask spread
- **Recent trades**: 15-20 trades with timestamps, symbols, sides, prices, amounts
- **Open orders**: 3-5 pending orders
- **Positions**: 2-4 open positions with entry prices and unrealised PnL
- **Bot metrics**: Sharpe ratio, win rate, max drawdown, profit factor, total return

Use seeded randomness so the data is deterministic across themes.

## 5. Visual Atmosphere & Surface Treatment

Each theme MUST establish a distinctive atmospheric layer through layout, colour,
surface treatment, gradients, texture, shadow, borders, and motion. These decisions
should be integral to the theme's identity, adding depth that makes the dashboard feel
crafted rather than stamped from a template.

### How to Integrate

Use the existing React structure and theme CSS files to layer gradients, translucent
panels, subtle textures, patterned fills, and other lightweight treatments behind or
within the interface. Keep the atmosphere subordinate to the trading data and ensure it
supports readability.

### Visual Direction Philosophy

Before implementing each theme, conceive a brief (2-3 sentence) statement of what the
visual system expresses and how it connects to the theme's aesthetic. The atmosphere
should feel native to the interface, not like decoration bolted onto a generic layout.

**Principles**:

- **Subtlety over spectacle**: Atmospheric treatments should enhance the UI, not compete
  with it. Low-opacity layering, controlled contrast, and disciplined accent usage win.
- **Performance**: Prefer CSS and lightweight React techniques that do not drag down the
  dashboard. Visual richness should not come at the cost of responsiveness.
- **Variety**: Each theme should use a DIFFERENT visual language. Vary pattern density,
  panel framing, gradient logic, border style, spacing rhythm, and motion personality.

### Direction Examples (for inspiration — do NOT copy these literally)

- A restrained gradient field that changes spatial emphasis between sidebar and content
- Subtle paper-grain or brushed-metal texture achieved with CSS overlays and blending
- Decorative linework or geometric framing embedded into cards and section dividers
- Editorial blocks of colour that create depth without obscuring data density
- Carefully paced hover and load animations that reinforce the theme's character

The visual treatment should make someone look at the dashboard and think "this feels
different" because the entire interface language is cohesive, not because a special
effect is drawing attention to itself.

## 6. Playwright Screenshots & Catalog

After creating all 5 themes, write a Playwright script (`apps/web/wireframes/screenshot.ts`)
that:

1. Starts the Vite dev server (or uses a pre-built version)
2. Opens each theme's 4 pages in Chromium at 1920×1080 viewport
3. Waits for the page to fully render (including chart rendering — use `domcontentloaded`,
   wait for `#root`, await `document.fonts.ready`, then add a small settle delay)

4. Takes a full-page screenshot of each page
5. Saves to `apps/web/wireframes/screenshots/` as `theme-{n}-{page}.png`
6. Generates `catalog.html` — a single dark-background page that:
   - Groups screenshots by theme
   - Shows the theme name and design rationale as a heading

- Displays the 4 page screenshots (homepage, dashboard, trading, bots) in a comparison grid
- Uses relative paths to the PNG files
- Includes a legend explaining what each page type represents

7. Runs the screenshot script after creation

## 7. Design Quality Standards

These prototypes must meet the standard described in the `frontend-design` skill
(skills/frontend-design/SKILL.md). Key points:

### Typography

Choose fonts that are beautiful, unique, and interesting. NEVER use generic fonts like
Arial, Inter, Roboto, or system fonts. Opt for distinctive choices — unexpected,
characterful font pairings. Each theme should have completely different typography.
Pair a distinctive display font with a refined body font. Use Google Fonts.

### Colour & Theme

Commit to a cohesive aesthetic per theme. Use CSS variables for consistency. Dominant
colours with sharp accents outperform timid, evenly-distributed palettes. Each theme
needs its own profit/loss colour coding that fits its palette — not every theme must
use green/red.

### Motion

Use animations for micro-interactions. Prioritise CSS transitions for simple effects;
use framer-motion for orchestrated sequences. One well-timed staggered reveal on page
load creates more delight than scattered animations everywhere. Each theme should have
a different animation personality (snappy vs fluid vs dramatic vs minimal vs playful).

### Spatial Composition

Vary layouts between themes. Try asymmetry, overlap, diagonal flow, grid-breaking
elements, generous negative space OR controlled density. Not every sidebar needs to be
the same width. Not every card grid needs to be 3 columns.

### Backgrounds & Visual Details

Use gradient treatments, noise textures via CSS, layered transparencies, dramatic
shadows, decorative borders, and grain overlays where appropriate. Each theme should
have depth — not flat solid colours.

### Anti-Patterns (NEVER do these)

- Generic purple-gradient-on-white "AI look"
- Cookie-cutter card grids with identical spacing everywhere
- The same font across multiple themes
- Predictable, safe colour choices
- Decorative elements that feel bolted on rather than integrated
- Placeholder grey boxes where charts should be (use real `lightweight-charts`)

---

## Notes

- This plan runs **before** the main frontend implementation (01b).
- The output is a set of styled React prototypes + screenshots for the user to evaluate.
- Once the user picks a theme, that choice is communicated to the 01b implementation agent via a note in the wireframes directory.
- The wireframe app under `apps/web/wireframes/` can be deleted after the theme is chosen.
- The wireframe app is disposable — optimise for visual quality and speed, not code reuse.
