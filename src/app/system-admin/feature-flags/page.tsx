"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Flag, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const FLAG_KEYS = ["hostel", "transport", "library", "inventory", "health", "certificates", "homework", "timetable"] as const;

export default function FeatureFlagsPage() {
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<Record<string, Record<string, boolean>>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["feature-flags"],
    queryFn: async () => {
      const res = await fetch("/api/system-admin/feature-flags", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const tenants: any[] = data?.data?.tenants ?? [];
  const defaults: Record<string, boolean> = data?.data?.defaults ?? {};

  const mutation = useMutation({
    mutationFn: async ({ tenantId, flags }: { tenantId: string; flags: Record<string, boolean> }) => {
      const res = await fetch("/api/system-admin/feature-flags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tenantId, featureFlags: flags }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Update failed");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
      toast.success("Feature flags updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getFlags = (tenant: any) => edits[tenant.tenantId] ?? tenant.featureFlags ?? defaults;

  const toggleFlag = (tenant: any, key: string, value: boolean) => {
    const current = getFlags(tenant);
    setEdits((prev) => ({ ...prev, [tenant.tenantId]: { ...current, [key]: value } }));
  };

  const hasEdits = (tenantId: string) => !!edits[tenantId];

  const handleSave = (tenant: any) => {
    const flags = getFlags(tenant);
    mutation.mutate({ tenantId: tenant.tenantId, flags });
    setEdits((prev) => { const n = { ...prev }; delete n[tenant.tenantId]; return n; });
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2"><Flag className="h-5 w-5 text-indigo-600" /> Feature Flags</h1>
        <p className="text-xs text-muted-foreground">Per-tenant module toggles — disable hostel/transport/library etc without code deploy</p>
      </div>

      {isLoading ? (
        <div className="text-xs text-muted-foreground">Loading tenants...</div>
      ) : tenants.length === 0 ? (
        <div className="text-xs text-muted-foreground">No tenants</div>
      ) : (
        <div className="grid gap-4">
          {tenants.map((tenant) => {
            const flags = getFlags(tenant);
            return (
              <Card key={tenant.tenantId} className="border border-border/80 shadow-xs">
                <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">{tenant.name} <Badge variant="outline" className="text-[10px] font-mono">{tenant.tenantId}</Badge></CardTitle>
                    <p className="text-[11px] text-muted-foreground">{tenant.subscriptionStatus}</p>
                  </div>
                  {hasEdits(tenant.tenantId) && (
                    <Button size="sm" onClick={() => handleSave(tenant)} disabled={mutation.isPending} className="h-7 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white">
                      <Save className="h-3.5 w-3.5" /> Save
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {FLAG_KEYS.map((key) => (
                      <label key={key} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 p-2.5 cursor-pointer hover:bg-muted/30">
                        <span className="text-xs font-medium capitalize">{key}</span>
                        <Switch checked={!!flags[key]} onCheckedChange={(v) => toggleFlag(tenant, key, !!v)} />
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
