/** Minimal offline fallback precached by the service worker. */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold">You&apos;re offline</h1>
      <p className="text-muted-foreground">
        Reconnect to keep practicing. Saved conversations will be available offline in a later
        version.
      </p>
    </main>
  );
}
