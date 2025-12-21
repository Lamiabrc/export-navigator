import { Sidebar } from './Sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] relative overflow-hidden">
      {/* Futuristic glow + grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(circle at 20% 20%, rgba(56,189,248,0.15), transparent 35%), radial-gradient(circle at 80% 0%, rgba(99,102,241,0.12), transparent 32%), radial-gradient(circle at 50% 60%, rgba(14,165,233,0.10), transparent 45%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-12"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <Sidebar />
      <main className="pl-64 relative z-10">
        <div className="p-6 md:p-10">
          <div className="glass rounded-2xl">
            <div className="p-6 md:p-8">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
