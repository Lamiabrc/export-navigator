import { useState } from 'react';
import type { ElementType } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  ShieldCheck,
  FileText,
  Truck,
  Calculator,
  BookOpen,
  Upload,
  Settings,
  LogOut,
  TrendingUp,
  Library,
  FileInput,
  Home as HomeIcon,
  ChevronDown,
  Users,
  LineChart,
} from 'lucide-react';
import logoOrliman from '@/assets/logo-orliman.png';

const essentialNav = [
  { name: 'Tour de controle', href: '/control-tower', icon: ShieldCheck, badge: 'NEW', featured: true },
  { name: 'Accueil', href: '/home', icon: HomeIcon },
  { name: 'Circuits export', href: '/flows', icon: FileText, aliases: ['/circuits'] },
  { name: 'Flux & marges', href: '/flow-manager', icon: LineChart },
  { name: 'Clients', href: '/clients', icon: Users },
  { name: 'Controle factures', href: '/invoices', icon: Upload },
  { name: 'Finance', href: '/finance', icon: Calculator },
  { name: 'Guide', href: '/guide', icon: BookOpen },
];

const advancedNav = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Logistique', href: '/logistics', icon: Truck },
  { name: 'Simulateur', href: '/simulator', icon: Calculator },
  { name: 'Analyse Marges', href: '/margin-analysis', icon: TrendingUp },
  { name: 'Verif Facture PDF', href: '/invoice-verification', icon: FileInput },
  { name: 'Imports CSV', href: '/imports', icon: FileInput },
  { name: 'Base Documentaire', href: '/reference-library', icon: Library },
  { name: 'Dashboard Export', href: '/export-dashboard', icon: LayoutDashboard },
];

const adminNavigation = [{ name: 'Parametres', href: '/settings', icon: Settings }];

const roleLabels: Record<string, string> = {
  direction: 'Direction',
  adv_export: 'ADV Export',
  logistique: 'Logistique',
  finance: 'Finance/Compta',
  admin: 'Administrateur',
};

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [advancedOpen, setAdvancedOpen] = useState(true);

  const handleLogout = () => {
    signOut();
    navigate('/auth');
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const renderLink = (item: { name: string; href: string; icon: ElementType; badge?: string; featured?: boolean; aliases?: string[] }) => {
    const matchesAlias = item.aliases?.some((alias) => location.pathname === alias || location.pathname.startsWith(`${alias}/`));
    const isActive = matchesAlias || location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.name}
        to={item.href}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
          'hover:bg-white/10 hover:text-white',
          isActive
            ? 'bg-gradient-to-r from-primary/30 via-primary/20 to-transparent text-white shadow-lg shadow-primary/20 border border-primary/40'
            : 'text-sidebar-foreground/80 border border-transparent',
          item.featured && !isActive && 'border border-primary/30 bg-primary/5'
        )}
      >
        <item.icon className="h-5 w-5" />
        <span>{item.name}</span>
        {item.badge && (
          <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-900/80 backdrop-blur-xl border-r border-white/10 shadow-xl shadow-primary/10">
      <div className="flex h-16 items-center gap-3 px-6 border-b border-white/10">
        <img src={logoOrliman} alt="ORLIMAN" className="h-8 w-auto" />
        <div>
          <p className="text-xs text-sidebar-foreground/60">La Meziere, France</p>
        </div>
      </div>

      <nav className="flex-1 space-y-4 px-3 py-4 text-sidebar-foreground">
        <div>
          <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
            Essentiel
          </div>
          <div className="space-y-1.5">{essentialNav.map(renderLink)}</div>
        </div>

        <div>
          <button
            onClick={() => setAdvancedOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60 hover:text-white transition-colors"
          >
            <span>Outils avances</span>
            <ChevronDown className={cn('h-4 w-4 transition-transform', advancedOpen ? 'rotate-180' : 'rotate-0')} />
          </button>
          {advancedOpen && <div className="mt-2 space-y-1.5">{advancedNav.map(renderLink)}</div>}
        </div>

        {user?.role === 'admin' && (
          <div>
            <div className="mt-4 mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
              Administration
            </div>
            <div className="space-y-1.5">{adminNavigation.map(renderLink)}</div>
          </div>
        )}
      </nav>

      <div className="border-t border-white/10 p-4 bg-black/30">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary-foreground border border-primary/40">
            <span className="text-sm font-medium">{user ? getInitials(user.name) : '??'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name || 'Utilisateur'}</p>
            <p className="text-xs text-sidebar-foreground/70">{user?.role ? roleLabels[user.role] : ''}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-white/10 transition-smooth"
            title="Deconnexion"
          >
            <LogOut className="h-4 w-4 text-sidebar-foreground/70" />
          </button>
        </div>
        <p className="mt-2 text-[10px] text-sidebar-foreground/40 text-center">Mode local</p>
      </div>
    </aside>
  );
}
