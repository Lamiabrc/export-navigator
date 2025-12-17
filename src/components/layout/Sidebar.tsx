import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  FileText,
  Truck,
  Calculator,
  BookOpen,
  Upload,
  Settings,
  LogOut,
} from 'lucide-react';
import logoOrliman from '@/assets/logo-orliman.png';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Flux Export', href: '/flows', icon: FileText },
  { name: 'Logistique', href: '/logistics', icon: Truck },
  { name: 'Charges & Finance', href: '/finance', icon: Calculator },
  { name: 'Guide Destinations', href: '/guide', icon: BookOpen },
  { name: 'Contrôle Factures', href: '/invoices', icon: Upload },
];

const adminNavigation = [
  { name: 'Paramètres', href: '/settings', icon: Settings },
];

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

  const handleLogout = () => {
    signOut();
    navigate('/auth');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-sidebar-border">
        <img src={logoOrliman} alt="ORLIMAN" className="h-8 w-auto" />
        <div>
          <p className="text-xs text-sidebar-foreground/60">La Mézière, France</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          Menu principal
        </div>
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn('nav-item', isActive && 'nav-item-active')}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}

        <div className="mt-8 mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          Administration
        </div>
        {adminNavigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn('nav-item', isActive && 'nav-item-active')}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground">
            <span className="text-sm font-medium">
              {user ? getInitials(user.name) : '??'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.name || 'Utilisateur'}
            </p>
            <p className="text-xs text-sidebar-foreground/60">
              {user?.role ? roleLabels[user.role] : ''}
            </p>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-sidebar-accent transition-smooth"
            title="Déconnexion"
          >
            <LogOut className="h-4 w-4 text-sidebar-foreground/60" />
          </button>
        </div>
        <p className="mt-2 text-[10px] text-sidebar-foreground/40 text-center">
          🔒 Mode local
        </p>
      </div>
    </aside>
  );
}
