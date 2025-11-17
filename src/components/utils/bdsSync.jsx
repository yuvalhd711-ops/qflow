import React from "react";

export function broadcastBdsUpdate(payload = {}) {
  try {
    localStorage.setItem(
      "bds_update",
      JSON.stringify({
        ts: Date.now(),
        scope: payload.scope || "all", // "all" | "branch"
        branchId: payload.branchId ? String(payload.branchId) : null,
      })
    );
  } catch {}
}

export function useBdsSubscription(callback) {
  React.useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "bds_update" && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          callback?.(data);
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [callback]);
}