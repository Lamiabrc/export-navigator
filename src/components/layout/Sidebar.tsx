import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  Truck,
  Calculator,
  BookOpen,
  Upload,
  Settings,
  LogOut,
  Package,
} from 'lucide-react';

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

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
          <Package className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-sidebar-foreground">ExportPilot</h1>
          <p className="text-xs text-sidebar-foreground/60">Gestion des flux</p>
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
            <span className="text-sm font-medium">JD</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">Jean Dupont</p>
            <p className="text-xs text-sidebar-foreground/60">ADV Export</p>
          </div>
          <button className="p-2 rounded-lg hover:bg-sidebar-accent transition-smooth">
            <LogOut className="h-4 w-4 text-sidebar-foreground/60" />
          </button>
        </div>
      </div>
    </aside>
  );
}
