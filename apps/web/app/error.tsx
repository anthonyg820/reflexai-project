"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-[14px] border border-warn bg-warn-soft p-6 text-warn">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm">
        The server returned an error. {error.digest && <span className="font-mono">Reference: {error.digest}</span>}
      </p>
      <button onClick={reset} className="mt-4 min-h-11 rounded-lg border border-warn px-4 text-sm font-medium">
        Try again
      </button>
    </div>
  );
}
