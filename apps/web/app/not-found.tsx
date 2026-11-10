import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl font-semibold">Not found</h1>
      <Link href="/" className="mt-4 inline-block font-medium text-accent underline">
        Back to the dashboard
      </Link>
    </div>
  );
}
