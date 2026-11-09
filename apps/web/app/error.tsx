"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-xl border border-warn bg-warn-soft p-6 text-warn">
      <h1 className="font-serif text-2xl">Something went wrong</h1>
      <p className="mt-2 text-sm">
        The server returned an error. {error.digest && <span className="font-mono">Reference: {error.digest}</span>}
      </p>
      <button onClick={reset} className="mt-4 rounded-lg border border-warn px-3 py-1.5 text-sm">
        Try again
      </button>
    </div>
  );
}
