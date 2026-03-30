#!/usr/bin/env node

/* global clearTimeout, console, process, setTimeout */

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { dirname, join, resolve } from "node:path";
import { URL, fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(__dirname, "..");
const defaultBaseUrl = process.env.UI_SCREENSHOT_BASE_URL ?? "http://127.0.0.1:3000";
const defaultOutputRoot = join(appDir, ".artifacts", "ui-screenshots");

const helpText = `Capture one or more Next.js routes with Playwright.

Usage:
  pnpm --filter web ui:screenshot -- --path /dashboard [--path /trading] [options]
  pnpm --filter web ui:verify -- --path /dashboard [--path /trading] [options]

Options:
  --path <route>          Route to capture. Repeat for multiple pages.
  --label <name>          Optional label for the output folder.
  --base-url <url>        Base URL to capture. Default: ${defaultBaseUrl}
  --wait-for <selector>   Wait for a selector before taking each screenshot.
  --delay-ms <number>     Extra wait after the page settles. Default: 500
  --width <number>        Viewport width. Default: 1440
  --height <number>       Viewport height. Default: 1024
  --timeout-ms <number>   Timeout for navigation and waits. Default: 30000
  --output-dir <path>     Override the output directory.
  --launch-dev-server     Start the local Next dev server if no server is already responding.
  --help                  Show this message.

Examples:
  pnpm --filter web ui:verify -- --path /dashboard --label dashboard-refresh
  pnpm --filter web ui:screenshot -- --path /dashboard --path /trading --wait-for "main"
`;

function printHelp() {
  console.log(helpText);
}

function parseInteger(value, flagName) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flagName} must be a positive integer.`);
  }

  return parsed;
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function timestampLabel() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function sanitizeSegment(value) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "capture";
}

function normalizeRoute(route) {
  if (!route || route === "/") {
    return "/";
  }

  return route.startsWith("/") ? route : `/${route}`;
}

function fileNameForRoute(route) {
  if (!route || route === "/") {
    return "root";
  }

  const [pathname, queryString = ""] = route.split("?");
  const pathPart = pathname.replace(/^\/+|\/+$/g, "").replace(/\//g, "--");
  const queryPart = queryString ? `--${sanitizeSegment(queryString)}` : "";

  return `${sanitizeSegment(pathPart)}${queryPart}`;
}

async function isUrlReady(url) {
  return await new Promise((resolvePromise) => {
    const targetUrl = new URL(url);
    const request = (targetUrl.protocol === "https:" ? httpsRequest : httpRequest)(
      targetUrl,
      {
        method: "GET",
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        response.resume();
        resolvePromise(statusCode >= 200 && statusCode < 400);
      }
    );

    request.on("error", () => {
      resolvePromise(false);
    });
    request.end();
  });
}

async function waitForUrl(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await isUrlReady(url)) {
      return;
    }

    await sleep(500);
  }

  throw new Error(`Timed out waiting for ${url}.`);
}

function nextExecutable() {
  return process.platform === "win32"
    ? join(appDir, "node_modules", ".bin", "next.cmd")
    : join(appDir, "node_modules", ".bin", "next");
}

function startDevServer(baseUrl) {
  const serverUrl = new URL(baseUrl);
  const port = serverUrl.port || (serverUrl.protocol === "https:" ? "443" : "80");

  return spawn(nextExecutable(), ["dev", "--hostname", serverUrl.hostname, "--port", port], {
    cwd: appDir,
    detached: process.platform !== "win32",
    stdio: "inherit",
    shell: false,
  });
}

function isMissingProcessError(error) {
  return error instanceof Error && "code" in error && error.code === "ESRCH";
}

async function waitForExit(server, timeoutMs) {
  if (!server || server.exitCode !== null || server.signalCode !== null) {
    return true;
  }

  return await new Promise((resolvePromise) => {
    const timer = setTimeout(() => {
      server.off("exit", handleExit);
      resolvePromise(false);
    }, timeoutMs);

    const handleExit = () => {
      clearTimeout(timer);
      resolvePromise(true);
    };

    server.once("exit", handleExit);
  });
}

async function stopWindowsProcessTree(server) {
  if (!server?.pid || server.exitCode !== null || server.signalCode !== null) {
    return;
  }

  await new Promise((resolvePromise, rejectPromise) => {
    const killer = spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], {
      stdio: "ignore",
      shell: false,
    });

    killer.on("error", rejectPromise);
    killer.on("exit", (code) => {
      if (code === 0 || code === 128) {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`taskkill exited with code ${code}`));
    });
  });

  await waitForExit(server, 2_000);
}

function signalProcessGroup(server, signal) {
  if (!server?.pid) {
    return;
  }

  try {
    process.kill(-server.pid, signal);
  } catch (error) {
    if (!isMissingProcessError(error)) {
      throw error;
    }
  }
}

async function stopServer(server) {
  if (!server || server.exitCode !== null || server.signalCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    await stopWindowsProcessTree(server);
    return;
  }

  signalProcessGroup(server, "SIGTERM");

  if (await waitForExit(server, 2_000)) {
    return;
  }

  signalProcessGroup(server, "SIGKILL");
  await waitForExit(server, 2_000);
}

async function captureRoute(browser, config, route) {
  const page = await browser.newPage({
    viewport: { width: config.width, height: config.height },
  });
  const issues = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      issues.push({ kind: "console", message: message.text() });
    }
  });

  page.on("pageerror", (error) => {
    issues.push({ kind: "pageerror", message: error.message });
  });

  page.on("requestfailed", (request) => {
    issues.push({
      kind: "requestfailed",
      message: `${request.method()} ${request.url()} ${request.failure()?.errorText ?? "Unknown error"}`,
    });
  });

  const normalizedRoute = normalizeRoute(route);
  const url = new URL(normalizedRoute, config.baseUrl).toString();
  const screenshotPath = join(config.outputDir, `${fileNameForRoute(normalizedRoute)}.png`);

  console.log(`Capturing ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: config.timeoutMs });
  await page.waitForLoadState("networkidle", { timeout: config.timeoutMs });

  if (config.waitFor) {
    await page.waitForSelector(config.waitFor, { timeout: config.timeoutMs });
  }

  await page.waitForFunction(
    `!('fonts' in document) || document.fonts.status === 'loaded'`,
    { timeout: config.timeoutMs }
  );
  await page.waitForTimeout(config.delayMs);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await page.close();

  return {
    route: normalizedRoute,
    url,
    screenshotPath,
    issues,
  };
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const separatorIndex = rawArgs.indexOf("--");
  const args =
    separatorIndex === -1
      ? rawArgs
      : [...rawArgs.slice(0, separatorIndex), ...rawArgs.slice(separatorIndex + 1)];

  const { values } = parseArgs({
    args,
    options: {
      path: { type: "string", multiple: true },
      label: { type: "string" },
      "base-url": { type: "string" },
      "wait-for": { type: "string" },
      "delay-ms": { type: "string" },
      width: { type: "string" },
      height: { type: "string" },
      "timeout-ms": { type: "string" },
      "output-dir": { type: "string" },
      "launch-dev-server": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
    strict: true,
  });

  if (values.help) {
    printHelp();
    return;
  }

  const routes = values.path ?? [];

  if (routes.length === 0) {
    printHelp();
    throw new Error("At least one --path value is required.");
  }

  const baseUrl = values["base-url"] ?? defaultBaseUrl;
  const width = parseInteger(values.width ?? "1440", "--width");
  const height = parseInteger(values.height ?? "1024", "--height");
  const delayMs = parseInteger(values["delay-ms"] ?? "500", "--delay-ms");
  const timeoutMs = parseInteger(values["timeout-ms"] ?? "30000", "--timeout-ms");
  const runLabel = sanitizeSegment(values.label ?? timestampLabel());
  const outputDir = values["output-dir"]
    ? resolve(values["output-dir"])
    : join(defaultOutputRoot, runLabel);

  await mkdir(outputDir, { recursive: true });

  let server;
  const launchDevServer = values["launch-dev-server"] ?? false;

  if (launchDevServer) {
    if (await isUrlReady(baseUrl)) {
      console.log(`Using existing server at ${baseUrl}`);
    } else {
      server = startDevServer(baseUrl);
      await waitForUrl(baseUrl, timeoutMs);
    }
  } else if (!(await isUrlReady(baseUrl))) {
    throw new Error(
      `No app server is responding at ${baseUrl}. Start one first or rerun with --launch-dev-server.`
    );
  }

  const config = {
    baseUrl,
    delayMs,
    height,
    outputDir,
    timeoutMs,
    waitFor: values["wait-for"],
    width,
  };

  const browser = await chromium.launch({ headless: true });

  try {
    const captures = [];

    for (const route of routes) {
      captures.push(await captureRoute(browser, config, route));
    }

    const manifestPath = join(outputDir, "manifest.json");
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          baseUrl,
          captures,
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    console.log(`Saved ${captures.length} screenshot(s) to ${outputDir}`);
    console.log(`Wrote manifest to ${manifestPath}`);

    const issueCount = captures.reduce((total, capture) => total + capture.issues.length, 0);
    if (issueCount > 0) {
      console.warn(`Observed ${issueCount} browser issue(s) during capture:`);
      for (const capture of captures) {
        for (const issue of capture.issues) {
          console.warn(`- ${capture.route} [${issue.kind}] ${issue.message}`);
        }
      }
    }
  } finally {
    await browser.close();
    await stopServer(server);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);

  if (
    error instanceof Error &&
    error.message.includes("Executable doesn't exist")
  ) {
    console.error("Run `pnpm --filter web playwright:install` to install Chromium.");
  }

  process.exitCode = 1;
});