"use client";

import { Webhook } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/Toaster";
import { trpc } from "@/lib/trpc";

const ALL_EVENTS = ["bot.started", "bot.stopped", "bot.error", "trade.placed"] as const;
type WebhookEvent = (typeof ALL_EVENTS)[number];

export default function WebhooksPage() {
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvent[]>([]);
  const [secret, setSecret] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const { data: webhooks = [] } = trpc.webhooks.list.useQuery();

  const createMutation = trpc.webhooks.create.useMutation({
    onSuccess: () => {
      void utils.webhooks.list.invalidate();
      setUrl("");
      setSelectedEvents([]);
      setSecret("");
      toast.success("Webhook added.");
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = trpc.webhooks.delete.useMutation({
    onSuccess: () => {
      void utils.webhooks.list.invalidate();
      toast.success("Webhook removed.");
    },
    onError: (error) => toast.error(error.message),
  });

  const testMutation = trpc.webhooks.test.useMutation({
    onMutate: ({ id }) => setTestingId(id),
    onSuccess: () => toast.success("Test payload delivered."),
    onError: (error) => toast.error(error.message),
    onSettled: () => setTestingId(null),
  });

  function toggleEvent(event: WebhookEvent) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  }

  const canSubmit = url.trim().length > 0 && selectedEvents.length > 0;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl" style={{ color: "var(--text-primary)" }}>
          Webhooks
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Receive HTTP POST notifications for bot events
        </p>
      </div>

      {/* Add webhook form */}
      <div className="glass-panel p-6 space-y-4">
        <h2 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Add Webhook
        </h2>

        <div className="space-y-1">
          <label htmlFor="webhook-url" className="text-xs" style={{ color: "var(--text-muted)" }}>
            Endpoint URL
          </label>
          <input
            id="webhook-url"
            type="url"
            placeholder="https://example.com/webhook"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Events
          </p>
          <div className="grid grid-cols-2 gap-2">
            {ALL_EVENTS.map((event) => (
              <label key={event} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedEvents.includes(event)}
                  onChange={() => toggleEvent(event)}
                  className="rounded"
                  style={{ accentColor: "var(--accent)" }}
                />
                <span className="text-sm font-mono" style={{ color: "var(--text-primary)" }}>
                  {event}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="webhook-secret"
            className="text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            Secret <span style={{ opacity: 0.6 }}>(optional — used to sign payloads)</span>
          </label>
          <input
            id="webhook-secret"
            type="password"
            placeholder="whsec_…"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
          />
        </div>

        <button
          onClick={() =>
            createMutation.mutate({
              url: url.trim(),
              events: selectedEvents,
              secret: secret.trim() || undefined,
            })
          }
          disabled={!canSubmit || createMutation.isPending}
          className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--primary-foreground)" }}
        >
          {createMutation.isPending ? "Adding…" : "Add Webhook"}
        </button>
      </div>

      {/* Webhook list */}
      <div className="space-y-2">
        {webhooks.map((webhook) => (
          <div key={webhook.id} className="glass-panel p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: webhook.active ? "var(--profit)" : "var(--text-muted)" }}
                  />
                  <p
                    className="text-sm font-mono truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {webhook.url}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1 pl-4">
                  {(webhook.events as string[]).map((event) => (
                    <span
                      key={event}
                      className="rounded px-1.5 py-0.5 text-xs font-mono"
                      style={{
                        background: "var(--accent-dim)",
                        color: "var(--accent)",
                      }}
                    >
                      {event}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => testMutation.mutate({ id: webhook.id })}
                  disabled={testingId === webhook.id}
                  className="rounded-lg px-3 py-1.5 text-xs transition-colors disabled:opacity-50"
                  style={{ background: "var(--bg-input)", color: "var(--text-primary)" }}
                >
                  {testingId === webhook.id ? "Sending…" : "Test"}
                </button>
                <button
                  onClick={() => setDeleteConfirmId(webhook.id)}
                  className="rounded-lg px-3 py-1.5 text-xs transition-colors"
                  style={{ color: "var(--loss)" }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}

        {webhooks.length === 0 && (
          <div className="glass-panel flex flex-col items-center justify-center py-20 text-center">
            <Webhook
              size={48}
              style={{ color: "var(--text-muted)", opacity: 0.4 }}
              className="mb-4"
            />
            <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              No webhooks configured
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
              Add an endpoint above to start receiving event notifications
            </p>
          </div>
        )}
      </div>

      <ConfirmDialog
        title="Delete webhook?"
        description="This endpoint will stop receiving notifications immediately. This cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
        isOpen={deleteConfirmId !== null}
        onConfirm={() => {
          if (deleteConfirmId) deleteMutation.mutate({ id: deleteConfirmId });
          setDeleteConfirmId(null);
        }}
        onCancel={() => setDeleteConfirmId(null)}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
