"use client";

import { Bot } from "lucide-react";
import Link from "next/link";

import { trpc } from "@/lib/trpc";

export function BotStatusCards() {
  const { data: bots, isLoading } = trpc.bots.list.useQuery({ status: "running" });

  if (isLoading) {
    return (
      <div className="glass-panel p-5">
        <h2 className="text-lg mb-4">Active Bots</h2>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-panel-sm animate-pulse p-4 h-20" />
          ))}
        </div>
      </div>
    );
  }

  const botList = bots ?? [];

  return (
    <div className="glass-panel p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg">Active Bots</h2>
        <Link href="/bots" className="text-xs transition-colors" style={{ color: "var(--accent)" }}>
          View all →
        </Link>
      </div>

      {botList.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 py-8"
          style={{ color: "var(--text-muted)" }}
        >
          <Bot size={24} />
          <p className="text-sm">No active bots</p>
          <Link
            href="/bots/new"
            className="rounded-lg px-4 py-1.5 text-xs"
            style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
          >
            Create one
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {botList.map((bot) => (
            <Link
              key={bot.id}
              href={`/bots/${bot.id}`}
              className="glass-panel-sm flex items-center justify-between p-4 transition-colors"
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-card)")}
            >
              <div>
                <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {bot.name}
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {bot.strategy} · {bot.symbol}
                </div>
              </div>
              <div className="text-right">
                <div
                  className="flex items-center gap-1.5 text-xs"
                  style={{ color: "var(--profit)" }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                  Running
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
