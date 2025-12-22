import { Sidebar } from './Sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-white text-[hsl(var(--foreground))] relative overflow-hidden">
      <Sidebar />
      <main className="pl-64 relative z-10">
        <div className="p-6 md:p-10">
          <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-emerald-100 shadow-sm">
            <div className="p-6 md:p-8">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
