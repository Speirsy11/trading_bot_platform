"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// ─── Types ──────────────────────────────────────────────────────────────────

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastAPI {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

// ─── Context ────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastAPI | null>(null);

let _counter = 0;

// ─── Module-level singleton so toast() can be called outside React ───────────

let _dispatch: ((item: Omit<ToastItem, "id">) => void) | null = null;

function enqueue(item: Omit<ToastItem, "id">) {
  if (_dispatch) {
    _dispatch(item);
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export const toast: ToastAPI = {
  success: (message) => enqueue({ message, variant: "success" }),
  error: (message) => enqueue({ message, variant: "error" }),
  info: (message) => enqueue({ message, variant: "info" }),
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useToast(): ToastAPI {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <Toaster>");
  return ctx;
}

// ─── Individual Toast ────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<ToastVariant, React.CSSProperties> = {
  success: {
    borderLeft: "3px solid var(--profit)",
    color: "var(--profit)",
  },
  error: {
    borderLeft: "3px solid var(--loss)",
    color: "var(--loss)",
  },
  info: {
    borderLeft: "3px solid var(--accent)",
    color: "var(--accent)",
  },
};

function ToastCard({ item, onRemove }: { item: ToastItem; onRemove: (id: number) => void }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Animate in
    const raf = requestAnimationFrame(() => setVisible(true));

    // Auto-dismiss after 4 s
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(item.id), 300);
    }, 4000);

    return () => {
      cancelAnimationFrame(raf);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [item.id, onRemove]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      onClick={() => {
        setVisible(false);
        setTimeout(() => onRemove(item.id), 300);
      }}
      style={{
        ...VARIANT_STYLES[item.variant],
        background: "var(--bg-card)",
        border: "1px solid var(--border-hard)",
        borderRadius: "var(--radius)",
        padding: "12px 16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        cursor: "pointer",
        userSelect: "none",
        maxWidth: "360px",
        fontSize: "0.8125rem",
        lineHeight: "1.4",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        transition: "opacity 300ms ease, transform 300ms ease",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        // Override the border-left set above — it's added as shorthand so we
        // need borderColor from variant styles. Already handled by VARIANT_STYLES.
      }}
    >
      {item.message}
    </div>
  );
}

// ─── Toaster Container ───────────────────────────────────────────────────────

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  const add = useCallback((item: Omit<ToastItem, "id">) => {
    const id = ++_counter;
    setToasts((prev) => [...prev, { ...item, id }]);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Register the module-level dispatcher
  useEffect(() => {
    _dispatch = add;
    return () => {
      _dispatch = null;
    };
  }, [add]);

  // Wait until after hydration to portal
  useEffect(() => {
    setMounted(true);
  }, []);

  const api: ToastAPI = {
    success: (message) => add({ message, variant: "success" }),
    error: (message) => add({ message, variant: "error" }),
    info: (message) => add({ message, variant: "info" }),
  };

  const container = (
    <ToastContext.Provider value={api}>
      <div
        role="status"
        aria-live="polite"
        aria-label="Notifications"
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          alignItems: "flex-end",
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: "auto" }}>
            <ToastCard item={t} onRemove={remove} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );

  if (!mounted) return null;
  return createPortal(container, document.body);
}
