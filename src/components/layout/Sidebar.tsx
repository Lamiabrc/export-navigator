import type { ElementType } from "react";
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  ShieldCheck,
  LayoutDashboard,
  FileText,
  Truck,
  Users,
  Upload,
  FileInput,
  Library,
  Calculator,
  TrendingUp,
  BookOpen,
  Settings,
  LogOut,
} from "lucide-react";
import logoOrliman from "@/assets/logo-orliman.png";

type NavItem = {
  name: string;
  href: string;
  icon: ElementType;
  badge?: string;
  featured?: boolean;
  aliases?: string[];
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const navigation: NavSection[] = [
  {
    title: "Pilotage",
    items: [
      {
        name: "Tour de controle",
        href: "/control-tower",
        icon: ShieldCheck,
        badge: "NEW",
        featured: true,
      },
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Donnees",
    items: [
      { name: "Imports", href: "/imports", icon: Upload },
      { name: "Base documentaire", href: "/reference-library", icon: Library },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        name: "Circuits export",
        href: "/flows",
        icon: FileText,
        aliases: ["/circuits"],
      },
      { name: "Logistique", href: "/logistics", icon: Truck },
      { name: "Clients", href: "/clients", icon: Users },
    ],
  },
  {
    title: "Facturation & conformite",
    items: [
      { name: "Factures", href: "/invoices", icon: FileInput },
      { name: "Verification PDF", href: "/invoice-verification", icon: FileInput },
    ],
  },
  {
    title: "Finance",
    items: [
      { name: "Finance", href: "/finance", icon: Calculator },
      { name: "Analyse marges", href: "/margin-analysis", icon: TrendingUp },
      { name: "Simulateur", href: "/simulator", icon: Calculator },
    ],
  },
  {
    title: "Support",
    items: [{ name: "Guide", href: "/guide", icon: BookOpen }],
  },
];

const adminNavigation: NavSection = {
  title: "Systeme",
  items: [{ name: "Parametres", href: "/settings", icon: Settings }],
};

const roleLabels: Record<string, string> = {
  direction: "Direction",
  adv_export: "ADV Export",
  logistique: "Logistique",
  finance: "Finance/Compta",
  admin: "Administrateur",
};

export type SidebarProps = {
  /** Optional: useful when Sidebar is displayed in a mobile drawer */
  onNavigate?: () => void;
  /** Optional: extra classes when needed */
  className?: string;
};

export function Sidebar({ onNavigate, className }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const safeName = user?.name?.trim() || "Utilisateur";
  const safeRoleLabel = user?.role ? roleLabels[user.role] ?? user.role : "";

  const getInitials = (name: string) => {
    const parts = name.split(" ").filter(Boolean);
    const initials = parts.map((p) => p[0]).join("").toUpperCase();
    return (initials || "??").slice(0, 2);
  };

  const isItemActive = (item: NavItem) => {
    const matchesAlias = item.aliases?.some(
      (alias) =>
        location.pathname === alias || location.pathname.startsWith(`${alias}/`)
    );
    return (
      matchesAlias ||
      location.pathname === item.href ||
      location.pathname.startsWith(`${item.href}/`)
    );
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } finally {
      onNavigate?.();
      navigate("/auth");
    }
  };

  const renderLink = (item: NavItem) => {
    const active = isItemActive(item);

    return (
      <Link
        key={item.name}
        to={item.href}
        onClick={() => onNavigate?.()}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
          "hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary/50",
          active
            ? "bg-gradient-to-r from-primary/30 via-primary/20 to-transparent text-white shadow-lg shadow-primary/20 border border-primary/40"
            : "text-sidebar-foreground/80 border border-transparent",
          item.featured && !active && "border border-primary/30 bg-primary/5"
        )}
        aria-current={active ? "page" : undefined}
      >
        <item.icon className="h-5 w-5" />
        <span className="truncate">{item.name}</span>

        {item.badge && (
          <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-[70] flex w-64 flex-col",
        "bg-slate-900/80 backdrop-blur-xl border-r border-white/10 shadow-xl shadow-primary/10",
        className
      )}
      aria-label="Navigation principale"
    >
      <div className="flex h-16 items-center gap-3 px-6 border-b border-white/10">
        <img src={logoOrliman} alt="ORLIMAN" className="h-8 w-auto" />
        <div className="min-w-0">
          <p className="text-xs text-sidebar-foreground/60 truncate">
            La Meziere, France
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-4 px-3 py-4 text-sidebar-foreground overflow-y-auto">
        {navigation.map((section) => (
          <div key={section.title}>
            <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
              {section.title}
            </div>
            <div className="space-y-1.5">{section.items.map(renderLink)}</div>
          </div>
        ))}

        {user?.role === "admin" && (
          <div>
            <div className="mt-4 mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
              {adminNavigation.title}
            </div>
            <div className="space-y-1.5">
              {adminNavigation.items.map(renderLink)}
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-white/10 p-4 bg-black/30">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary-foreground border border-primary/40">
            <span className="text-sm font-medium">{getInitials(safeName)}</span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{safeName}</p>
            <p className="text-xs text-sidebar-foreground/70 truncate">
              {safeRoleLabel}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-white/10 transition focus:outline-none focus:ring-2 focus:ring-primary/50"
            aria-label="Deconnexion"
            title="Deconnexion"
          >
            <LogOut className="h-4 w-4 text-sidebar-foreground/70" />
          </button>
        </div>

        <p className="mt-2 text-[10px] text-sidebar-foreground/40 text-center">
          Mode local
        </p>
      </div>
    </aside>
  );
}
