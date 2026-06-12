import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-slate-950 p-8 text-slate-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Free Dispatcher</h1>
        <p className="mt-2 text-slate-400">
          Train operations for modular Free-moN sessions
        </p>
      </div>
      <div className="flex gap-4">
        <Link
          href="/admin"
          className="rounded-lg bg-sky-600 px-6 py-3 font-semibold text-white hover:bg-sky-500"
        >
          Admin console
        </Link>
        <Link
          href="/join"
          className="rounded-lg border border-slate-700 px-6 py-3 font-semibold text-slate-200 hover:bg-slate-800"
        >
          Join as operator
        </Link>
      </div>
    </main>
  );
}
