export default function TaxesOM() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6 py-16 text-center">
      <div className="max-w-2xl space-y-3 rounded-3xl border border-white/10 bg-black/60 p-8 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.5em] text-white/60">Protected area</p>
        <h1 className="text-3xl font-semibold">Taxes & OM overview</h1>
        <p className="text-sm text-white/80">
          This page is part of the authenticated cockpit. The Command Center app renders a rich dashboard here
          with Supabase data once you are signed in.
        </p>
      </div>
    </div>
  );
}
