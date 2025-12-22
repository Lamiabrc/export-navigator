import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  ShieldCheck,
  FileText,
  Calculator,
  Upload,
  Settings,
  LogOut,
  Library,
  Home as HomeIcon,
} from 'lucide-react';
import logoOrliman from '@/assets/logo-orliman.png';

const navItems = [
  { name: 'Accueil', href: '/home', icon: HomeIcon },
  { name: 'Tour de contrôle', href: '/control-tower', icon: ShieldCheck },
  { name: 'Flux & dossiers', href: '/flows', icon: FileText },
  { name: 'Factures', href: '/invoices', icon: Upload },
  { name: 'Imports', href: '/imports', icon: Upload },
  { name: 'Référentiel', href: '/reference-library', icon: Library },
  { name: 'Finance', href: '/finance', icon: Calculator },
];

const adminNavigation = [{ name: 'Paramètres', href: '/settings', icon: Settings }];

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
  const [collapsed, setCollapsed] = useState(false);

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

  const renderLink = (item: { name: string; href: string; icon: React.ElementType; badge?: string; featured?: boolean }) => {
    const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.name}
        to={item.href}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
          'hover:bg-emerald-50 hover:text-emerald-900',
          isActive
            ? 'bg-emerald-100 text-emerald-900 border border-emerald-200 shadow-sm'
            : 'text-slate-600 border border-transparent',
          item.featured && !isActive && 'border border-emerald-100 bg-emerald-50'
        )}
      >
        <item.icon className="h-5 w-5" />
        {!collapsed && <span>{item.name}</span>}
        {item.badge && (
          <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside className={cn('fixed inset-y-0 left-0 z-50 flex flex-col bg-white/90 border-r border-emerald-100 shadow-md transition-all duration-200', collapsed ? 'w-20' : 'w-64')}>
      <div className="flex h-16 items-center justify-between px-4 border-b border-emerald-100">
        <div className="flex items-center gap-3">
          <img src={logoOrliman} alt="ORLIMAN" className="h-8 w-auto" />
          {!collapsed && (
            <div>
              <p className="text-xs text-slate-500">Navigation apaisée</p>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="text-xs text-emerald-700 hover:bg-emerald-100 rounded px-2 py-1 transition-colors"
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      <nav className="flex-1 space-y-3 px-3 py-4 text-slate-700">
        <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Essentiel
        </div>
        <div className="space-y-1.5">{navItems.map(renderLink)}</div>

        {user?.role === 'admin' && (
          <div>
            <div className="mt-4 mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Administration
            </div>
            <div className="space-y-1.5">{adminNavigation.map(renderLink)}</div>
          </div>
        )}
      </nav>

      <div className="border-t border-emerald-100 p-4 bg-emerald-50/60">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200">
            <span className="text-sm font-medium">{user ? getInitials(user.name) : '??'}</span>
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{user?.name || 'Utilisateur'}</p>
                <p className="text-xs text-slate-500">{user?.role ? roleLabels[user.role] : ''}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-emerald-100 transition-smooth"
                title="Deconnexion"
              >
                <LogOut className="h-4 w-4 text-slate-500" />
              </button>
            </>
          )}
        </div>
        {!collapsed && <p className="mt-2 text-[10px] text-slate-500 text-center">Mode local</p>}
      </div>
    </aside>
  );
}
