"use client";

import { useState } from "react";

interface ConfirmLiveModalProps {
  botName: string;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
}

export function ConfirmLiveModal({
  botName,
  isOpen,
  onConfirm,
  onCancel,
  isPending = false,
}: ConfirmLiveModalProps) {
  const [inputValue, setInputValue] = useState("");

  if (!isOpen) return null;

  const isMatch = inputValue === botName;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.7)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl p-6 space-y-4"
        style={{ background: "var(--bg-panel)", border: "1px solid var(--border)" }}
      >
        <div className="space-y-1">
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Enable Live Trading
          </h2>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            This action cannot be undone without stopping the bot.
          </p>
        </div>

        <div
          className="rounded-lg p-3 text-xs"
          style={{
            background: "rgba(248, 113, 113, 0.1)",
            border: "1px solid rgba(248, 113, 113, 0.3)",
            color: "var(--loss)",
          }}
        >
          You are about to enable LIVE trading. Real money will be placed on exchanges.
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="confirm-bot-name"
            className="block text-xs font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            Type the bot name to confirm:
          </label>
          <input
            id="confirm-bot-name"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={botName}
            autoComplete="off"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              background: "var(--bg-input)",
              border: `1px solid ${isMatch ? "rgba(74, 222, 128, 0.5)" : "var(--border)"}`,
              color: "var(--text-primary)",
            }}
          />
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="rounded-lg px-4 py-2 text-xs font-medium transition-colors disabled:opacity-40"
            style={{
              background: "var(--bg-input)",
              color: "var(--text-secondary)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!isMatch || isPending}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-colors disabled:opacity-40"
            style={{
              background: isMatch && !isPending ? "rgba(248, 113, 113, 0.2)" : "var(--bg-input)",
              color: "var(--loss)",
              border: "1px solid rgba(248, 113, 113, 0.3)",
            }}
          >
            {isPending && (
              <span
                className="inline-block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
                aria-hidden="true"
              />
            )}
            Enable Live Trading
          </button>
        </div>
      </div>
    </div>
  );
}
