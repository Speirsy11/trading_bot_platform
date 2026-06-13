import { type NextRequest } from "next/server";

const DEFAULT_API_URL = "http://localhost:3001";
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

type RouteContext = {
  params: Promise<{ trpc: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyTrpc(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyTrpc(request, context);
}

async function proxyTrpc(request: NextRequest, context: RouteContext) {
  const { trpc } = await context.params;
  const upstreamUrl = new URL(`/trpc/${trpc}`, getApiBaseUrl());
  upstreamUrl.search = request.nextUrl.search;

  const headers = buildForwardHeaders(request);
  const token = process.env["WEB_API_AUTH_TOKEN"]?.trim() ?? process.env["API_AUTH_TOKEN"]?.trim();
  if (token) headers.set("authorization", `Bearer ${token}`);

  const response = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
    cache: "no-store",
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: buildResponseHeaders(response),
  });
}

function getApiBaseUrl() {
  return (
    process.env["API_INTERNAL_URL"]?.trim() ??
    process.env["NEXT_PUBLIC_API_URL"]?.trim() ??
    DEFAULT_API_URL
  );
}

function buildForwardHeaders(request: NextRequest) {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  return headers;
}

function buildResponseHeaders(response: Response) {
  const headers = new Headers();
  response.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  headers.set("cache-control", "no-store");
  return headers;
}
