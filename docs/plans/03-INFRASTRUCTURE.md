# Infrastructure & DevOps — Development Plan

## Agent System Prompt

```
You are a senior DevOps/infrastructure engineer specialising in TypeScript monorepos,
Docker containerisation, and developer experience tooling. You have deep expertise with
Turborepo, pnpm workspaces, Docker Compose, CI/CD pipelines, and production deployment
of Node.js applications. You prioritise developer ergonomics (fast feedback loops, hot
reload, one-command setup) while building a foundation that scales to production. You
follow test-driven development practices and ensure all tooling supports TDD workflows.
```

---

## Task Prompt

```
Your task is to scaffold the entire monorepo foundation for the crypto trading bot platform
from scratch. This is Phase 1 — nothing exists yet except this planning document and the
architecture overview (00-ARCHITECTURE.md). Every other agent depends on the output of your
work.

Specifically, you must:

1. Initialise the Turborepo + pnpm monorepo with the exact directory structure defined in
   Section 2. Create all root config files (turbo.json, pnpm-workspace.yaml, package.json,
   .prettierrc.json, .gitignore, .env.example) as specified in Sections 3.1–3.7.

2. Create ALL shared config packages:
   - @tb/tsconfig (base.json, node.json, react.json) — Section 4
   - @tb/eslint-config (base.js, react.js) — Section 5
   - @tb/config (Zod env validation + Pino logger factory) — Sections 11 & 12

3. Create stub packages with correct package.json, tsconfig.json, and vitest.config.ts for:
   - @tb/types (empty index.ts with a placeholder export)
   - @tb/utils (empty index.ts with a placeholder export)
   - @tb/db (empty structure with drizzle.config.ts)
   - @tb/trading-core (empty structure)
   - @tb/data-pipeline (empty structure)
   - @tb/indicators (empty structure)
   Each stub must have the correct package.json pattern from Section 10, referencing
   @tb/tsconfig and @tb/eslint-config as workspace dependencies.

4. Create stub apps with minimal working entrypoints:
   - apps/api — minimal Fastify "hello world" that starts on port 3001
   - apps/web — minimal Next.js app with "Hello World" page

5. Set up Docker Compose (Section 6) with TimescaleDB + Redis for local development.
   Include the init-db/01-extensions.sql file.

6. Set up Vitest workspace config (Section 8) — root vitest.workspace.ts plus per-package
   configs so `pnpm test` works across the monorepo.

7. Set up Husky + lint-staged pre-commit hooks (Section 9).

8. Create production Dockerfiles for API and Web (Section 7).

9. Create the GitHub Actions CI workflow (Section 13).

10. Verify everything works:
    - `pnpm install` succeeds
    - `pnpm lint` passes
    - `pnpm type-check` passes
    - `pnpm test` runs (even if no tests exist yet, it should not error)
    - `pnpm build` succeeds for all packages
    - `pnpm docker:up` starts Postgres and Redis containers
    - `pnpm dev` starts the API and Web apps

Do NOT implement any business logic — only scaffold the structure and tooling. Other agents
will fill in the packages. Focus on getting the developer experience right: fast hot reload,
one-command setup, all tools wired correctly.

Follow TDD practices: set up the Vitest infrastructure so tests can be written from day one.
Every package should have a working `pnpm test` script, even if it only runs a trivial
placeholder test.

Refer to 00-ARCHITECTURE.md for the overall vision and tech stack decisions.
```

---

## 1. Overview

Set up the **monorepo foundation**, **Docker infrastructure**, **development tooling**, and **CI/CD pipeline** for the crypto trading bot platform. This is the first thing that needs to be built — all other agents depend on this foundation.

Priority order:

1. Turborepo + pnpm workspace structure
2. Shared TypeScript/ESLint/Prettier configuration
3. Docker Compose for local development (PostgreSQL + TimescaleDB, Redis)
4. Vitest workspace configuration for TDD
5. Husky + lint-staged pre-commit hooks
6. Dockerfiles for API and Web
7. CI/CD pipeline (GitHub Actions)

---

## 2. Monorepo Structure

```
trading-bot-platform/
├── apps/
│   ├── web/                        # Next.js dashboard
│   │   ├── src/
│   │   ├── public/
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── vitest.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── api/                        # Fastify API server + workers
│       ├── src/
│       ├── nodemon.json
│       ├── vitest.config.ts
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   ├── types/                      # @tb/types — shared TypeScript types
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── utils/                      # @tb/utils — shared utility functions
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── vitest.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── db/                         # @tb/db — Drizzle schemas, migrations, queries
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── schema/
│   │   │   ├── migrations/
│   │   │   └── client.ts
│   │   ├── drizzle.config.ts
│   │   ├── vitest.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── trading-core/               # @tb/trading-core — backtesting, strategies, orders
│   │   ├── src/
│   │   ├── vitest.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── data-pipeline/              # @tb/data-pipeline — market data collection
│   │   ├── src/
│   │   ├── vitest.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── indicators/                 # @tb/indicators — technical indicator calculations
│   │   ├── src/
│   │   ├── vitest.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── config/                     # @tb/config — Zod-validated env config
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── eslint-config/              # @tb/eslint-config — shared ESLint flat config
│   │   ├── base.js
│   │   ├── react.js
│   │   └── package.json
│   └── tsconfig/                   # @tb/tsconfig — shared TypeScript configs
│       ├── base.json
│       ├── node.json
│       ├── react.json
│       └── package.json
│
├── docker/
│   ├── docker-compose.yml          # Local dev services
│   ├── docker-compose.prod.yml     # Production overrides
│   ├── Dockerfile.api              # Multi-stage API build
│   ├── Dockerfile.web              # Multi-stage Web build
│   └── init-db/
│       └── 01-extensions.sql       # TimescaleDB extension setup
│
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Test + lint on PR
│       └── deploy.yml              # Build + deploy on merge to main
│
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .gitignore
├── .prettierrc.json
├── .prettierignore
├── .env.example
├── vitest.workspace.ts
└── README.md
```

---

## 3. Root Configuration Files

### 3.1 `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### 3.2 `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env.local", ".env"],
  "globalEnv": ["NODE_ENV", "CI"],
  "tasks": {
    "dev": {
      "cache": false,
      "interactive": true,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"],
      "inputs": ["src/**", "tsconfig.json"]
    },
    "lint": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "eslint.config.*", "tsconfig.json"]
    },
    "type-check": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tsconfig.json"]
    },
    "test": {
      "cache": false
    },
    "test:ci": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "clean": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    },
    "db:generate": {
      "cache": false
    }
  }
}
```

### 3.3 Root `package.json`

```json
{
  "name": "trading-bot-platform",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "type-check": "turbo type-check",
    "test": "turbo test",
    "test:ci": "turbo test:ci",
    "test:watch": "turbo test -- --watch",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md,yaml,yml}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,md,yaml,yml}\"",
    "clean": "turbo clean && rm -rf node_modules",
    "db:migrate": "turbo db:migrate --filter=@tb/db",
    "db:generate": "turbo db:generate --filter=@tb/db",
    "docker:up": "docker compose -f docker/docker-compose.yml up -d",
    "docker:down": "docker compose -f docker/docker-compose.yml down",
    "docker:logs": "docker compose -f docker/docker-compose.yml logs -f",
    "docker:reset": "docker compose -f docker/docker-compose.yml down -v && docker compose -f docker/docker-compose.yml up -d",
    "prepare": "husky"
  },
  "devDependencies": {
    "husky": "^9.x",
    "lint-staged": "^15.x",
    "prettier": "^3.x",
    "turbo": "^2.x",
    "typescript": "^5.x"
  },
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

### 3.4 `.prettierrc.json`

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": false,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "bracketSpacing": true,
  "endOfLine": "lf"
}
```

### 3.5 `.prettierignore`

```
node_modules
dist
build
.next
coverage
pnpm-lock.yaml
*.min.js
```

### 3.6 `.gitignore`

```
node_modules/
dist/
build/
.next/
coverage/
*.tsbuildinfo
.turbo/
.env
.env.local
.env.production
!.env.example
exports/
*.db
```

### 3.7 `.env.example`

```bash
# ──────────────────────────────────────────────
# Database (PostgreSQL + TimescaleDB)
# ──────────────────────────────────────────────
DATABASE_URL=postgresql://trading_bot:changeme@localhost:5432/trading_bot_dev

# ──────────────────────────────────────────────
# Redis
# ──────────────────────────────────────────────
REDIS_URL=redis://localhost:6379/0

# ──────────────────────────────────────────────
# API Server
# ──────────────────────────────────────────────
API_PORT=3001
API_HOST=0.0.0.0

# ──────────────────────────────────────────────
# Dashboard
# ──────────────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=http://localhost:3001

# ──────────────────────────────────────────────
# Security
# ──────────────────────────────────────────────
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=

# ──────────────────────────────────────────────
# Logging
# ──────────────────────────────────────────────
LOG_LEVEL=debug

# ──────────────────────────────────────────────
# Trading (leave empty for backtest-only mode)
# ──────────────────────────────────────────────
TRADING_ENABLED=false
```

---

## 4. Shared TypeScript Configuration

### 4.1 `packages/tsconfig/base.json`

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true
  },
  "exclude": ["node_modules", "dist", "build", "coverage"]
}
```

### 4.2 `packages/tsconfig/node.json`

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "module": "ESNext",
    "target": "ES2022",
    "moduleResolution": "bundler"
  }
}
```

### 4.3 `packages/tsconfig/react.json`

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "target": "ES2022",
    "moduleResolution": "bundler"
  }
}
```

### 4.4 Package `tsconfig.json` Pattern

Each package/app extends from the shared configs:

```json
// packages/trading-core/tsconfig.json
{
  "extends": "@tb/tsconfig/node.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

---

## 5. Shared ESLint Configuration

### 5.1 `packages/eslint-config/base.js`

```javascript
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";

export default [
  { ignores: ["dist/**", "build/**", ".next/**", "coverage/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { import: importPlugin },
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "warn",
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "always",
          alphabetize: { order: "asc" },
        },
      ],
    },
  },
];
```

### 5.2 `packages/eslint-config/react.js`

```javascript
import baseConfig from "./base.js";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

export default [
  ...baseConfig,
  {
    files: ["**/*.{tsx,jsx}"],
    plugins: { react: reactPlugin, "react-hooks": reactHooksPlugin },
    settings: { react: { version: "detect" } },
    rules: {
      "react/react-in-jsx-scope": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
```

---

## 6. Docker Compose — Local Development

### 6.1 `docker/docker-compose.yml`

```yaml
services:
  postgres:
    image: timescale/timescaledb:latest-pg16
    container_name: tb-postgres
    environment:
      POSTGRES_USER: trading_bot
      POSTGRES_PASSWORD: changeme
      POSTGRES_DB: trading_bot_dev
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-db:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U trading_bot"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: tb-redis
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

### 6.2 `docker/init-db/01-extensions.sql`

```sql
-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable trigram similarity (for text search)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

### Notes on Docker setup

- Use `timescale/timescaledb:latest-pg16` image — it's PostgreSQL with TimescaleDB pre-installed.
- The API and Web apps run **natively** on the host machine during development (not in Docker containers) for fastest hot reload. Only infrastructure services (Postgres, Redis) run in Docker.
- For production, the API and Web get their own Dockerfiles (multi-stage builds).

---

## 7. Dockerfiles (Production)

### 7.1 `docker/Dockerfile.api`

```dockerfile
# ── Dependencies ──
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/db/package.json ./packages/db/
COPY packages/config/package.json ./packages/config/
COPY packages/trading-core/package.json ./packages/trading-core/
COPY packages/data-pipeline/package.json ./packages/data-pipeline/
COPY packages/indicators/package.json ./packages/indicators/

RUN pnpm install --frozen-lockfile

# ── Build ──
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .

RUN pnpm turbo build --filter=api...

# ── Production ──
FROM node:20-alpine AS runner
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 appuser

COPY --from=builder --chown=appuser:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=appuser:nodejs /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=appuser:nodejs /app/packages ./packages
COPY --from=builder --chown=appuser:nodejs /app/package.json ./
COPY --from=builder --chown=appuser:nodejs /app/pnpm-lock.yaml ./
COPY --from=builder --chown=appuser:nodejs /app/pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile --prod
ENV NODE_ENV=production
USER appuser
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "apps/api/dist/index.js"]
```

### 7.2 `docker/Dockerfile.web`

```dockerfile
# ── Dependencies ──
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/config/package.json ./packages/config/

RUN pnpm install --frozen-lockfile

# ── Build ──
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo build --filter=web...

# ── Production ──
FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000 || exit 1

CMD ["node", "apps/web/server.js"]
```

---

## 8. Vitest Workspace Configuration

### 8.1 `vitest.workspace.ts` (Root)

```typescript
import { defineWorkspace } from "vitest/config";

export default defineWorkspace(["apps/*/vitest.config.ts", "packages/*/vitest.config.ts"]);
```

### 8.2 Package Vitest Config Pattern

```typescript
// packages/trading-core/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "dist/", "**/*.test.ts"],
    },
  },
});
```

### 8.3 Dashboard Vitest Config

```typescript
// apps/web/vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
```

---

## 9. Pre-commit Hooks

### 9.1 Husky Setup

```bash
# Initialised via `pnpm prepare` which runs `husky`
# Creates .husky/ directory
```

### 9.2 `.husky/pre-commit`

```bash
pnpm lint-staged
```

### 9.3 lint-staged config in root `package.json`

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yaml,yml}": ["prettier --write"]
  }
}
```

---

## 10. Package Configuration Pattern

Every internal package follows this pattern:

### 10.1 `package.json`

```json
{
  "name": "@tb/trading-core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "import": "./src/index.ts",
      "types": "./src/index.ts"
    }
  },
  "scripts": {
    "dev": "tsup src/index.ts --watch",
    "build": "tsup src/index.ts --format esm --dts",
    "lint": "eslint src/",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest watch",
    "clean": "rm -rf dist .turbo"
  },
  "devDependencies": {
    "@tb/eslint-config": "workspace:*",
    "@tb/tsconfig": "workspace:*",
    "tsup": "^8.x",
    "typescript": "^5.x",
    "vitest": "^2.x"
  }
}
```

### 10.2 Internal Package Cross-References

Packages reference each other via workspace protocol:

```json
{
  "dependencies": {
    "@tb/types": "workspace:*",
    "@tb/utils": "workspace:*"
  }
}
```

Turborepo's `"dependsOn": ["^build"]` ensures packages are built in dependency order.

---

## 11. Environment Variable Validation

The `@tb/config` package provides type-safe environment variable access:

```typescript
// packages/config/src/index.ts
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  API_PORT: z.coerce.number().default(3001),
  API_HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  ENCRYPTION_KEY: z.string().min(64).optional(), // 32 bytes hex-encoded
  TRADING_ENABLED: z.coerce.boolean().default(false),
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_WS_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment variables:");
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}
```

---

## 12. Logging Configuration

Standardised Pino logging across the monorepo:

```typescript
// packages/config/src/logger.ts
import pino from "pino";

export function createLogger(name: string) {
  return pino({
    name,
    level: process.env.LOG_LEVEL || "info",
    redact: ["apiKey", "apiSecret", "secret", "password", "*.apiKey", "*.apiSecret"],
    transport:
      process.env.NODE_ENV === "development"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  });
}
```

---

## 13. CI/CD — GitHub Actions

### 13.1 `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: pnpm format:check
      - run: pnpm lint
      - run: pnpm type-check

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: timescale/timescaledb:latest-pg16
        env:
          POSTGRES_USER: trading_bot
          POSTGRES_PASSWORD: changeme
          POSTGRES_DB: trading_bot_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd="pg_isready -U trading_bot"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd="redis-cli ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=5

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:ci
        env:
          DATABASE_URL: postgresql://trading_bot:changeme@localhost:5432/trading_bot_test
          REDIS_URL: redis://localhost:6379/0
          NODE_ENV: test

  build:
    runs-on: ubuntu-latest
    needs: [lint-and-typecheck, test]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

---

## 14. Deployment Options (Future)

When ready to deploy, here are the recommended options ranked by simplicity and cost:

| Option                   | Monthly Cost | Pros                                        | Cons                                     |
| ------------------------ | ------------ | ------------------------------------------- | ---------------------------------------- |
| **Hetzner VPS** (CX22)   | ~€4-8        | Cheapest, full Docker Compose, EU servers   | Self-managed, no auto-scaling            |
| **DigitalOcean Droplet** | $6-12        | Simple, good docs, backup snapshots         | Self-managed                             |
| **Railway**              | $5-20        | Git push deploy, managed Postgres/Redis     | Can get expensive with multiple services |
| **Fly.io**               | $5-15        | Edge deployment, auto-sleep for low traffic | Learning curve, config complexity        |

**Recommended path:**

1. Develop locally with `docker compose up` + `pnpm dev`
2. When ready, deploy to a Hetzner VPS with Docker Compose (same setup as local)
3. Use a GitHub Actions workflow to SSH + deploy on merge to main

### Database Hosting

- **Self-hosted on VPS** (recommended for cost) — same Docker Compose with persistent volumes
- **Supabase** (free tier: 500MB) — if you want managed Postgres
- **Neon** (free tier: 512MB) — serverless Postgres (no TimescaleDB support)

---

## 15. Development Workflow

```bash
# ─── First Time Setup ───
git clone <repo>
cd trading-bot-platform
cp .env.example .env.local
pnpm install
pnpm docker:up           # Start Postgres + Redis
pnpm db:migrate           # Run database migrations

# ─── Daily Development ───
pnpm dev                  # Start all apps + packages in watch mode

# ─── Testing ───
pnpm test                 # Run all tests once
pnpm test:watch           # Watch mode
pnpm test -- --filter=@tb/trading-core  # Single package

# ─── Code Quality ───
pnpm lint                 # ESLint across monorepo
pnpm format               # Prettier format all files
pnpm type-check           # TypeScript check across monorepo

# ─── Database ───
pnpm db:generate          # Generate Drizzle migration from schema changes
pnpm db:migrate           # Apply pending migrations

# ─── Docker ───
pnpm docker:up            # Start infrastructure
pnpm docker:down          # Stop infrastructure
pnpm docker:logs          # Tail logs
pnpm docker:reset         # Nuke volumes and restart fresh
```
