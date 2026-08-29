"use client";

import { useState, useEffect } from "react";
import { Megaphone, X, AlertTriangle } from "lucide-react";

export function GlobalBroadcastBanner() {
  const [broadcast, setBroadcast] = useState<any>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    async function checkBroadcasts() {
      try {
        const res = await fetch("/api/notices?priority=URGENT&activeOnly=true");
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
          const urgentGlobal = json.data.find((n: any) => n.scope === "GLOBAL" || n.priority === "URGENT");
          if (urgentGlobal) {
            const dismissedKey = `dismissed_broadcast_${urgentGlobal.id}`;
            if (!sessionStorage.getItem(dismissedKey)) {
              setBroadcast(urgentGlobal);
            }
          }
        }
      } catch {
        // Silent catch for banner
      }
    }
    checkBroadcasts();
  }, []);

  if (!broadcast || isDismissed) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem(`dismissed_broadcast_${broadcast.id}`, "true");
  };

  const isUrgent = broadcast.priority === "URGENT";

  return (
    <div
      className={`px-4 py-2 text-xs flex items-center justify-between transition-colors border-b ${
        isUrgent
          ? "bg-rose-600 text-white border-rose-700"
          : "bg-primary text-primary-foreground border-primary"
      }`}
    >
      <div className="flex items-center gap-2 overflow-hidden mr-3">
        {isUrgent ? (
          <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse" />
        ) : (
          <Megaphone className="h-4 w-4 shrink-0" />
        )}
        <div className="flex items-center gap-1.5 overflow-hidden">
          <span className="font-semibold tracking-wide text-[10px] bg-black/20 px-1.5 py-0.5 rounded shrink-0">
            {broadcast.scope === "GLOBAL" ? "Platform Alert" : "Campus Notice"}
          </span>
          <span className="font-bold shrink-0">{broadcast.title}:</span>
          <span className="opacity-90 truncate">{broadcast.content}</span>
        </div>
      </div>

      <button
        onClick={handleDismiss}
        className="p-1 hover:bg-white/20 rounded-md transition-colors shrink-0 cursor-pointer"
        title="Dismiss announcement"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
