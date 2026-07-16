"use client";

import { useEffect } from "react";

/**
 * Tracks real time spent in the app. Once a minute, if the tab is visible AND
 * the learner has interacted recently, it posts a heartbeat that adds a minute
 * to today's `minutes_practiced` (which drives the dashboard time stat, the daily
 * goal, and the streak). Idle/backgrounded time is not counted.
 *
 * Renders nothing; mounted once in the authenticated layout.
 */
const TICK_MS = 60_000; // one minute
const IDLE_MS = 2 * 60_000; // stop counting after 2 min without interaction

export function ActivityTracker() {
  useEffect(() => {
    let lastActive = Date.now();
    const markActive = () => {
      lastActive = Date.now();
    };

    const events = ["pointerdown", "keydown", "mousemove", "scroll", "touchstart"];
    for (const e of events) window.addEventListener(e, markActive, { passive: true });

    const beat = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastActive > IDLE_MS) return;
      fetch("/api/progress/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: 1 }),
        keepalive: true,
      }).catch(() => {});
    };

    beat(); // opening the app counts today immediately (registers the streak)
    const id = window.setInterval(beat, TICK_MS);
    return () => {
      window.clearInterval(id);
      for (const e of events) window.removeEventListener(e, markActive);
    };
  }, []);

  return null;
}
