import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

import { pages, themes } from "./shared/theme-meta";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = join(__dirname, "screenshots");
const baseUrl = "http://127.0.0.1:4173";

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function run(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: __dirname,
      stdio: "inherit",
      shell: false,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) {
        return;
      }
    } catch {
      await sleep(250);
    }
  }

  throw new Error("Timed out waiting for Vite preview server.");
}

function catalogHtml() {
  const groups = themes
    .map((theme) => {
      const cards = pages
        .map((page) => {
          const fileName = `${theme.id}-${page}.png`;
          return `
            <figure class="shot">
              <figcaption>${page}</figcaption>
              <img src="./${fileName}" alt="${theme.name} ${page}" />
            </figure>
          `;
        })
        .join("");

      return `
        <section class="theme-group">
          <header>
            <p class="eyebrow">${theme.id}</p>
            <h2>${theme.name}</h2>
          </header>
          <div class="shots">${cards}</div>
        </section>
      `;
    })
    .join("");

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Wireframe Screenshot Catalog</title>
      <style>
        :root { color-scheme: dark; }
        body {
          margin: 0;
          font-family: "Instrument Sans", sans-serif;
          background: #040711;
          color: #f8fafc;
          padding: 40px;
        }
        h1, h2, p { margin: 0; }
        h1 { font-size: 32px; }
        .intro { max-width: 860px; margin-bottom: 32px; color: #cbd5e1; line-height: 1.6; }
        .legend { display: flex; gap: 10px; flex-wrap: wrap; margin: 18px 0 40px; }
        .legend span { border: 1px solid rgba(148,163,184,0.24); border-radius: 999px; padding: 8px 12px; color: #cbd5e1; }
        .theme-group {
          margin-bottom: 40px;
          border: 1px solid rgba(148,163,184,0.18);
          border-radius: 28px;
          padding: 24px;
          background: rgba(15, 23, 42, 0.4);
        }
        .theme-group header p { color: #94a3b8; }
        .eyebrow { text-transform: uppercase; letter-spacing: 0.2em; font-size: 12px; }
        .shots {
          display: grid;
          gap: 18px;
          margin-top: 20px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .shot {
          margin: 0;
          border-radius: 20px;
          overflow: hidden;
          background: rgba(15, 23, 42, 0.66);
          border: 1px solid rgba(148,163,184,0.18);
        }
        .shot figcaption {
          padding: 14px 16px;
          text-transform: capitalize;
          color: #cbd5e1;
          border-bottom: 1px solid rgba(148,163,184,0.12);
        }
        .shot img { display: block; width: 100%; height: auto; }
        @media (max-width: 1200px) { .shots { grid-template-columns: 1fr; } }
      </style>
    </head>
    <body>
      <h1>Wireframe Screenshot Catalog</h1>
      <p class="intro">This catalog is generated automatically from the standalone Vite wireframes app.</p>
      <div class="legend">
        <span>homepage: marketing or landing page</span>
        <span>dashboard: portfolio, bots, recent trades</span>
        <span>trading: chart, order book, order form</span>
        <span>bots: filters, inventory, metrics</span>
      </div>
      ${groups}
    </body>
  </html>`;
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  await run("pnpm", ["build"]);

  const server = spawn("pnpm", ["preview"], {
    cwd: __dirname,
    stdio: "inherit",
    shell: false,
  });

  try {
    await waitForServer();

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

    for (const theme of themes) {
      for (const route of pages) {
        await page.goto(`${baseUrl}/${theme.id}/${route}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(700);
        await page.screenshot({
          path: join(outputDir, `${theme.id}-${route}.png`),
          fullPage: true,
        });
      }
    }

    await browser.close();
    await writeFile(join(outputDir, "catalog.html"), catalogHtml(), "utf8");
  } finally {
    server.kill("SIGTERM");
    await sleep(250);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
