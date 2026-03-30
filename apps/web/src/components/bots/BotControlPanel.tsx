"use client";

import { Play, Pause, Square } from "lucide-react";

import { trpc } from "@/lib/trpc";

interface BotControlPanelProps {
  botId: string;
  status: string;
}

export function BotControlPanel({ botId, status }: BotControlPanelProps) {
  const utils = trpc.useUtils();
  const startBot = trpc.bots.start.useMutation({
    onMutate: async () => {
      await utils.bots.getById.cancel({ botId });
      const previousBot = utils.bots.getById.getData({ botId });

      utils.bots.getById.setData({ botId }, (old) =>
        old ? { ...old, status: "running" as const } : old
      );

      return { previousBot };
    },
    onError: (_error, _variables, context) => {
      utils.bots.getById.setData({ botId }, context?.previousBot);
    },
    onSettled: () => {
      void utils.bots.getById.invalidate({ botId });
      void utils.bots.list.invalidate();
    },
  });
  const pauseBot = trpc.bots.pause.useMutation({
    onSettled: () => {
      void utils.bots.getById.invalidate({ botId });
      void utils.bots.list.invalidate();
    },
  });
  const stopBot = trpc.bots.stop.useMutation({
    onSettled: () => {
      void utils.bots.getById.invalidate({ botId });
      void utils.bots.list.invalidate();
    },
  });

  return (
    <div className="glass-panel flex items-center gap-3 p-4">
      <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        Controls
      </span>

      <div className="flex gap-2 ml-auto">
        <button
          onClick={() => startBot.mutate({ botId })}
          disabled={status === "running" || startBot.isPending}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
          style={{
            background: "rgba(74, 222, 128, 0.15)",
            color: "var(--profit)",
          }}
        >
          <Play size={12} /> Start
        </button>
        <button
          onClick={() => pauseBot.mutate({ botId })}
          disabled={status !== "running" || pauseBot.isPending}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
          style={{
            background: "var(--accent-dim)",
            color: "var(--accent)",
          }}
        >
          <Pause size={12} /> Pause
        </button>
        <button
          onClick={() => stopBot.mutate({ botId })}
          disabled={status === "stopped" || status === "idle" || stopBot.isPending}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
          style={{
            background: "rgba(248, 113, 113, 0.15)",
            color: "var(--loss)",
          }}
        >
          <Square size={12} /> Stop
        </button>
      </div>
    </div>
  );
}
