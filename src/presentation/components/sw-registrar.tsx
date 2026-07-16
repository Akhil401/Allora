"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (public/sw.js) once, in production, in browsers
 * that support it. Rendered near the root layout. The SW itself only precaches
 * the app shell for now (see public/sw.js) — the offline conversation cache
 * (IndexedDB) arrives in a later milestone.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        // Non-fatal: the app still works without the SW.
        console.warn("Service worker registration failed:", err);
      });
    };

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
