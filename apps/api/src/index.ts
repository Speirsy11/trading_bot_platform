import Fastify from "fastify";

const server = Fastify({
  logger: true,
});

server.get("/health", async () => {
  return { status: "ok" };
});

server.get("/", async () => {
  return { message: "Trading Bot API" };
});

const start = async () => {
  const port = Number(process.env["API_PORT"] || 3001);
  const host = process.env["API_HOST"] || "0.0.0.0";

  try {
    await server.listen({ port, host });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
