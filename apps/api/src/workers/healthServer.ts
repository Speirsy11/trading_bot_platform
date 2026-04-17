import { createServer } from "http";

/**
 * Minimal HTTP health server for the workers process.
 * Docker can use: HEALTHCHECK CMD curl -f http://localhost:3002/health || exit 1
 */
export function startHealthServer(port = 3002): void {
  const server = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", pid: process.pid, uptime: process.uptime() }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  server.listen(port, () => {
    console.info(`Worker health server listening on :${port}`);
  });
}
