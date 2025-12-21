import { Sidebar } from './Sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden">
      {/* Futuristic glow + grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(circle at 20% 20%, rgba(56,189,248,0.18), transparent 35%), radial-gradient(circle at 80% 0%, rgba(99,102,241,0.15), transparent 30%), radial-gradient(circle at 50% 60%, rgba(14,165,233,0.12), transparent 40%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <Sidebar />
      <main className="pl-64 relative z-10">
        <div className="p-6 md:p-10">
          <div className="glass rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl shadow-primary/10">
            <div className="p-6 md:p-8">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
