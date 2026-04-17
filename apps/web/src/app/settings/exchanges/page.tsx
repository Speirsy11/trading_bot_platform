"use client";

import { Key } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/Toaster";
import { formatDateShort } from "@/lib/format";
import { trpc } from "@/lib/trpc";

interface ExchangeKey {
  id: string;
  exchange: string;
  name: string;
  enabled: boolean;
  testnet: boolean;
  hasCredentials: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export default function ExchangesPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [newExchange, setNewExchange] = useState("binance");
  const [newLabel, setNewLabel] = useState("");
  const [newApiKey, setNewApiKey] = useState("");
  const [newSecret, setNewSecret] = useState("");
  const [testingExchangeId, setTestingExchangeId] = useState<string | null>(null);
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const { data: keys = [] } = trpc.exchanges.list.useQuery();

  const addMutation = trpc.exchanges.add.useMutation({
    onSuccess: () => {
      void utils.exchanges.list.invalidate();
      setShowAdd(false);
      setNewLabel("");
      setNewApiKey("");
      setNewSecret("");
      toast.success("Exchange credentials saved.");
    },
    onError: (error) => toast.error(error.message),
  });

  const removeMutation = trpc.exchanges.remove.useMutation({
    onSuccess: () => {
      void utils.exchanges.list.invalidate();
      toast.success("Exchange connection removed.");
    },
    onError: (error) => toast.error(error.message),
  });

  const testMutation = trpc.exchanges.testConnection.useMutation({
    onMutate: ({ exchangeId }) => {
      setTestingExchangeId(exchangeId);
    },
    onSuccess: (result) => {
      toast.success(`Connection verified. ${result.balance.totalAssets} asset balances available.`);
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => setTestingExchangeId(null),
  });

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl" style={{ color: "var(--text-primary)" }}>
          Exchange API Keys
        </h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          style={{ background: "var(--accent)", color: "var(--primary-foreground)" }}
        >
          {showAdd ? "Cancel" : "Add Exchange"}
        </button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="glass-panel p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label
                htmlFor="exchange-name"
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                Exchange
              </label>
              <select
                id="exchange-name"
                value={newExchange}
                onChange={(e) => setNewExchange(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
              >
                <option value="binance">Binance</option>
                <option value="bybit">Bybit</option>
                <option value="kraken">Kraken</option>
              </select>
            </div>
            <div className="space-y-1">
              <label
                htmlFor="exchange-label"
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                Label
              </label>
              <input
                id="exchange-label"
                type="text"
                placeholder="e.g. Main Trading"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="exchange-api-key"
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                API Key
              </label>
              <input
                id="exchange-api-key"
                type="password"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="exchange-secret"
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                Secret
              </label>
              <input
                id="exchange-secret"
                type="password"
                value={newSecret}
                onChange={(e) => setNewSecret(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
              />
            </div>
          </div>
          <button
            onClick={() =>
              addMutation.mutate({
                exchange: newExchange,
                name: newLabel || newExchange,
                apiKey: newApiKey,
                apiSecret: newSecret,
              })
            }
            disabled={addMutation.isPending || !newApiKey || !newSecret}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--primary-foreground)" }}
          >
            {addMutation.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      )}

      {/* Key List */}
      <div className="space-y-2">
        {(keys as ExchangeKey[]).map((k) => (
          <div key={k.id} className="glass-panel p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: k.enabled ? "var(--profit)" : "var(--text-muted)" }}
              />
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {k.name}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {k.exchange}
                  {k.testnet ? " (testnet)" : ""} ·{" "}
                  {k.createdAt ? `added ${formatDateShort(k.createdAt)}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => testMutation.mutate({ exchangeId: k.id })}
                disabled={testingExchangeId === k.id}
                className="rounded-lg px-3 py-1.5 text-xs transition-colors"
                style={{ background: "var(--bg-input)", color: "var(--text-primary)" }}
              >
                {testingExchangeId === k.id ? "Testing…" : "Test"}
              </button>
              <button
                onClick={() => setRemoveConfirmId(k.id)}
                className="rounded-lg px-3 py-1.5 text-xs transition-colors"
                style={{ color: "var(--loss)" }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}

        {(keys as ExchangeKey[]).length === 0 && (
          <div className="glass-panel flex flex-col items-center justify-center py-20 text-center">
            <Key size={48} style={{ color: "var(--text-muted)", opacity: 0.4 }} className="mb-4" />
            <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              No exchange keys configured
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
              Add your API keys above to connect an exchange
            </p>
          </div>
        )}
      </div>

      <ConfirmDialog
        title="Remove exchange key?"
        description="This cannot be undone."
        confirmLabel="Remove"
        confirmVariant="danger"
        isOpen={removeConfirmId !== null}
        onConfirm={() => {
          if (removeConfirmId) removeMutation.mutate({ exchangeId: removeConfirmId });
          setRemoveConfirmId(null);
        }}
        onCancel={() => setRemoveConfirmId(null)}
        isPending={removeMutation.isPending}
      />
    </div>
  );
}
