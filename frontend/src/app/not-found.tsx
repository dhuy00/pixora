import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
      <h2 className="text-2xl font-bold tracking-tight">Page Not Found</h2>
      <p className="mt-2 text-sm text-neutral-500">
        Could not find the requested resource.
      </p>
      <Link
        href="/"
        className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        Return Home
      </Link>
    </div>
  );
}
