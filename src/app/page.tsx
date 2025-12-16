import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-xl space-y-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Multi-tenant document processing
        </h1>
        <p className="text-sm text-gray-600">
          Upload, process, and audit documents per organization. Use API keys to
          integrate secure document processing into your own systems.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/login"
            className="rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
          >
            Log in
          </Link>
        </div>
      </div>
    </main>
  );
}
