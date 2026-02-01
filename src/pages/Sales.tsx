export default function Sales() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900 px-6 py-16 text-center">
      <p className="rounded-full border border-white/30 px-5 py-1 text-xs uppercase tracking-[0.45em] text-white/60">Protected</p>
      <h1 className="mt-6 text-3xl font-semibold text-white">Sales & Operations</h1>
      <p className="mt-4 max-w-2xl text-sm text-white/80">
        This section is part of the authenticated suite. Please use the command center for dashboards and custom data.
      </p>
    </div>
  );
}
