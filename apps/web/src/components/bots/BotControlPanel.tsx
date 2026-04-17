"use client";

import { Play, Pause, Square, Zap } from "lucide-react";
import { useState } from "react";

import { ConfirmLiveModal } from "./ConfirmLiveModal";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/Toaster";
import { trpc } from "@/lib/trpc";
interface BotControlPanelProps {
  botId: string;
  status: string;
  mode?: string;
  botName?: string;
}

export function BotControlPanel({ botId, status, mode, botName = "" }: BotControlPanelProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isStopConfirmOpen, setIsStopConfirmOpen] = useState(false);
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
    onError: (error, _variables, context) => {
      utils.bots.getById.setData({ botId }, context?.previousBot);
      toast.error(`Failed to start bot: ${error.message}`);
    },
    onSettled: () => {
      void utils.bots.getById.invalidate({ botId });
      void utils.bots.list.invalidate();
    },
  });

  const pauseBot = trpc.bots.pause.useMutation({
    onError: (error) => toast.error(`Failed to pause bot: ${error.message}`),
    onSettled: () => {
      void utils.bots.getById.invalidate({ botId });
      void utils.bots.list.invalidate();
    },
  });

  const stopBot = trpc.bots.stop.useMutation({
    onError: (error) => toast.error(`Failed to stop bot: ${error.message}`),
    onSettled: () => {
      void utils.bots.getById.invalidate({ botId });
      void utils.bots.list.invalidate();
    },
  });

  const goLive = trpc.bots.update.useMutation({
    onError: (error) => toast.error(`Failed to go live: ${error.message}`),
    onSettled: () => {
      void utils.bots.getById.invalidate({ botId });
      void utils.bots.list.invalidate();
    },
    onSuccess: () => {
      setIsConfirmOpen(false);
    },
  });

  function handleGoLiveConfirm() {
    goLive.mutate({ botId, config: { mode: "live" } });
  }

  return (
    <>
      <div className="glass-panel flex items-center gap-3 p-4">
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Controls
        </span>

        <div className="flex gap-2 ml-auto">
          {mode === "paper" && (
            <button
              onClick={() => setIsConfirmOpen(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: "rgba(248, 113, 113, 0.12)",
                color: "var(--loss)",
                border: "1px solid rgba(248, 113, 113, 0.25)",
              }}
            >
              <Zap size={12} /> Go Live
            </button>
          )}

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
            onClick={() => setIsStopConfirmOpen(true)}
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

      <ConfirmLiveModal
        botName={botName}
        isOpen={isConfirmOpen}
        onConfirm={handleGoLiveConfirm}
        onCancel={() => setIsConfirmOpen(false)}
        isPending={goLive.isPending}
      />

      <ConfirmDialog
        title="Stop bot?"
        description="This will stop the bot and close all positions."
        confirmLabel="Stop"
        confirmVariant="danger"
        isOpen={isStopConfirmOpen}
        onConfirm={() => {
          stopBot.mutate({ botId });
          setIsStopConfirmOpen(false);
        }}
        onCancel={() => setIsStopConfirmOpen(false)}
        isPending={stopBot.isPending}
      />
    </>
  );
}
