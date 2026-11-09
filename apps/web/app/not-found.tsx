import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="font-serif text-3xl">Not found</h1>
      <Link href="/" className="mt-4 inline-block text-accent underline">
        Back to the dashboard
      </Link>
    </div>
  );
}
