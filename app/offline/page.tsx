export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">You&apos;re offline</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Please check your internet connection and try again.
        </p>
      </section>
    </main>
  );
}
