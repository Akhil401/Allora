/*
 * Service worker — app-shell precache (M1 shell only).
 *
 * Strategy for now:
 *  - On install: precache the shell (the root document + offline fallback).
 *  - On fetch: network-first for navigations, falling back to cache when offline.
 *
 * The richer offline conversation cache uses IndexedDB (Dexie) inside the app
 * and arrives in a later milestone; this SW only makes the shell load offline.
 */

const CACHE = "pingo-shell-v1";
const SHELL = ["/", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Network-first for page navigations; fall back to cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((r) => r || caches.match("/"))),
    );
  }
});
