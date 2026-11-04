"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
      <h2 className="text-xl font-bold tracking-tight">Something went wrong</h2>
      <p className="mt-2 text-sm text-neutral-500">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={() => reset()}
        className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        Try again
      </button>
    </div>
  );
}
