"use client";

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: "danger" | "default";
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  confirmVariant = "default",
  isOpen,
  onConfirm,
  onCancel,
  isPending = false,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const isDanger = confirmVariant === "danger";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="glass-panel w-full max-w-[400px] p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {title}
          </h2>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {description}
          </p>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="rounded-lg px-4 py-2 text-xs font-medium transition-colors disabled:opacity-40"
            style={{
              background: "var(--bg-input)",
              color: "var(--text-muted)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-colors disabled:opacity-40"
            style={
              isDanger
                ? {
                    background: "rgba(248, 113, 113, 0.12)",
                    color: "var(--loss)",
                    border: "1px solid rgba(248, 113, 113, 0.25)",
                  }
                : {
                    background: "var(--accent-dim)",
                    color: "var(--accent)",
                  }
            }
          >
            {isPending && (
              <span
                className="inline-block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
                aria-hidden="true"
              />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
