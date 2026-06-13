export default function CommsScreen() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Comms</h1>
      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center text-sm text-slate-400">
        <p className="text-2xl">🎙</p>
        <p className="mt-2 font-medium text-slate-200">Voice is being rebuilt</p>
        <p className="mt-1">
          Push-to-talk is moving to in-app WebRTC (channels stay local to the
          session, no external account). Coming in a future update.
        </p>
      </section>
    </div>
  );
}
