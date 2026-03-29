# Frontend Wireframes — UI Theme Exploration

## Agent System Prompt

```
You are a senior UI/UX designer and frontend developer specialising in dark-themed
financial dashboards. You have deep expertise in Tailwind CSS, component layout, and
trading terminal aesthetics. Your job is to rapidly prototype visual themes as static
HTML pages so stakeholders can evaluate look-and-feel before committing to full
implementation. You produce clean, self-contained wireframe pages that demonstrate
colour palettes, typography, spacing, and component styling.
```

---

## Task Prompt

```
Your task is to create 5 distinct UI theme wireframes for the crypto trading bot
dashboard. Each wireframe should be a self-contained static HTML page (or small set of
pages) that demonstrates the visual identity of that theme across the key views of the
application. These wireframes are for evaluation purposes only — the chosen theme will
later be implemented by a separate agent in the full Next.js app.

After creating all 5 wireframes, you must use Playwright to open each one in a browser
and take full-page screenshots, saving them to a catalog directory for review.

Specifically, you must:

1. Create the wireframe directory structure:
```

apps/web/wireframes/
├── theme-1-midnight-terminal/
│ ├── dashboard.html
│ ├── trading.html
│ ├── bots.html
│ └── styles.css
├── theme-2-arctic-blue/
│ ├── dashboard.html
│ ├── trading.html
│ ├── bots.html
│ └── styles.css
├── theme-3-cyberpunk-neon/
│ ├── dashboard.html
│ ├── trading.html
│ ├── bots.html
│ └── styles.css
├── theme-4-slate-minimal/
│ ├── dashboard.html
│ ├── trading.html
│ ├── bots.html
│ └── styles.css
├── theme-5-warm-carbon/
│ ├── dashboard.html
│ ├── trading.html
│ ├── bots.html
│ └── styles.css
└── screenshots/ ← Playwright-generated catalog
├── theme-1-dashboard.png
├── theme-1-trading.png
├── theme-1-bots.png
├── theme-2-dashboard.png
├── ...
└── catalog.html ← Single page showing all screenshots side-by-side

```

2. For each of the 5 themes, create 3 wireframe pages (dashboard, trading terminal,
bot management). Each page must be a self-contained HTML file that uses either
inline styles or a shared CSS file — no build step required (they should open
directly in a browser via file:// or a simple HTTP server).

Each wireframe page should include:
- **Dashboard page**: Sidebar navigation, header bar, portfolio summary cards,
  a placeholder chart area, active bots grid, recent trades table.
- **Trading terminal page**: Large chart placeholder, order book panel, order form,
  open orders table, positions table.
- **Bot management page**: Bot list table with status indicators, filter bar,
  action buttons, a bot detail section showing metrics and controls.

The wireframes should use realistic placeholder data (mock numbers, coin names,
percentages) so the visual density feels authentic.

3. The 5 themes should be meaningfully different from each other:

**Theme 1 — Midnight Terminal**: Deep black/charcoal backgrounds (#0a0a0f, #12121a),
bright green (#00ff88) for profits, red (#ff3366) for losses, monospace-heavy
typography, terminal-like aesthetic. Inspired by Bloomberg Terminal.

**Theme 2 — Arctic Blue**: Dark navy/slate backgrounds (#0f172a, #1e293b), ice-blue
accents (#38bdf8, #7dd3fc), clean sans-serif typography (Inter or similar),
frosted-glass card effects (backdrop-blur). Modern and cool-toned.

**Theme 3 — Cyberpunk Neon**: Very dark backgrounds (#0d0d0d) with vibrant neon
accents — cyan (#00f0ff), magenta (#ff00ff), electric yellow (#f0ff00). Glowing
borders, subtle gradients, bold typography. High energy and distinctive.

**Theme 4 — Slate Minimal**: Muted grey palette (#18181b, #27272a, #3f3f46),
understated blue accent (#60a5fa), generous whitespace, clean borders, subtle
shadows. Professional and distraction-free. Closest to a traditional SaaS dashboard.

**Theme 5 — Warm Carbon**: Dark warm-grey backgrounds (#1a1a1a, #262626) with amber/
gold accents (#f59e0b, #fbbf24), warm green (#4ade80) for profit, soft red (#f87171)
for loss. Slightly warmer feel than typical trading UIs.

4. Each wireframe should demonstrate these UI elements with the theme's styling:
- Background colours and layering (page bg → card bg → input bg)
- Text hierarchy (headings, body, muted/secondary text, numbers)
- Profit/loss colour coding on numbers
- Button styles (primary, secondary, destructive)
- Table styling (header, rows, hover states, alternating rows if applicable)
- Card/panel borders and shadows
- Sidebar navigation with active state
- Status indicators (running = green dot, stopped = red, paused = yellow)
- Input fields and form elements
- A consistent header with breadcrumbs or page title

5. After all wireframes are created, write a Playwright script
(apps/web/wireframes/screenshot.ts) that:
- Starts a simple HTTP server to serve the wireframe files (use a basic Node.js
  http server or similar).
- Opens each HTML file in a Chromium browser at 1920x1080 viewport.
- Takes a full-page screenshot of each page.
- Saves screenshots to apps/web/wireframes/screenshots/ with the naming convention
  theme-{n}-{page}.png.
- Generates a catalog.html file that displays all screenshots in a grid layout,
  grouped by theme, with theme names as headings — so the user can open one file
  and compare all 5 themes at a glance.
- Run the screenshot script after creating it.

6. The catalog.html should:
- Use a simple dark background.
- Show each theme as a section with the theme name and a brief description.
- Display the 3 screenshots (dashboard, trading, bots) side by side for each theme.
- Use the screenshot images via relative paths.
- Include a brief legend/key explaining what each page represents.

Do NOT install Next.js, React, or any heavy framework for the wireframes. Use plain
HTML + CSS (with Tailwind CDN if you like, or hand-written CSS). The goal is speed and
visual exploration, not production code. These files will be discarded after a theme is
chosen.

Refer to 01b-FRONTEND-IMPLEMENTATION.md Sections 3-4 for the pages and component
structure that these wireframes should approximate, and Section 8 for the base colour
values.
```

---

## Notes

- This plan runs **before** the main frontend implementation (01b).
- The output is a set of static wireframes + screenshots for the user to evaluate.
- Once the user picks a theme, that choice is communicated to the 01b implementation agent.
- The wireframe files under `apps/web/wireframes/` can be deleted after the theme is chosen.
