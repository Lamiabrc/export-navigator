import type { ElementType } from "react";
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Home, BookOpen, ShieldCheck, LogOut, Bot } from "lucide-react";

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
    title: "Navigation",
    items: [
      {
        name: "Check rapide",
        href: "/hub",
        icon: ShieldCheck,
        badge: "HUB",
        featured: true,
        aliases: ["/control-tower", "/dashboard"],
      },
      { name: "Veille commerciale", href: "/watch/commercial", icon: Home },
      { name: "Veille réglementaire", href: "/watch/regulatory", icon: BookOpen },
      { name: "Admin", href: "/admin", icon: Home },
    ],
  },
];

export type SidebarProps = {
  onNavigate?: () => void;
  className?: string;
};

export function Sidebar({ onNavigate, className }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const safeName = (user?.email || "Utilisateur").split("@")[0];

  const getInitials = (name: string) => {
    const parts = name.split(" ").filter(Boolean);
    const initials = parts.map((p) => p[0]).join("").toUpperCase();
    return (initials || "??").slice(0, 2);
  };

  const isItemActive = (item: NavItem) => {
    const matchesAlias = item.aliases?.some(
      (alias) => location.pathname === alias || location.pathname.startsWith(`${alias}/`),
    );

    return matchesAlias || location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } finally {
      onNavigate?.();
      navigate("/login");
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
          "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all border border-transparent",
          "hover:bg-sidebar-accent hover:text-sidebar-foreground hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-sidebar-ring/40",
          active
            ? "bg-sidebar-primary/20 text-sidebar-foreground shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)] ring-1 ring-sidebar-primary/40 border border-sidebar-primary/30"
            : "text-sidebar-foreground/80",
          item.featured && !active && "border border-sidebar-primary/30 bg-sidebar-primary/5",
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
        "bg-[hsl(var(--sidebar-background))]/95 backdrop-blur-xl border-r border-[hsl(var(--sidebar-border))] shadow-2xl shadow-black/30",
        className,
      )}
      aria-label="Navigation principale"
    >
      <div className="flex h-16 items-center gap-3 px-6 border-b border-[hsl(var(--sidebar-border))]">
        <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary-foreground font-semibold">
          OR
        </div>
        <div className="min-w-0">
          <p className="text-xs text-sidebar-foreground/60 truncate">Export Navigator</p>
          <p className="text-xs text-sidebar-foreground/40 truncate">DROM / UE / Hors UE</p>
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
      </nav>

      <div className="border-t border-[hsl(var(--sidebar-border))] p-4 bg-[hsl(var(--sidebar-accent))/0.4]">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary-foreground border border-primary/40">
            <span className="text-sm font-medium">{getInitials(safeName)}</span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{safeName}</p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-white/10 transition focus:outline-none focus:ring-2 focus:ring-primary/50"
            aria-label="Déconnexion"
            title="Déconnexion"
          >
            <LogOut className="h-4 w-4 text-sidebar-foreground/70" />
          </button>
        </div>

        <div className="flex items-center gap-2 mt-3 text-xs text-sidebar-foreground/60">
          <Bot className="h-4 w-4" />
          IA Export via Edge Function (clé côté serveur uniquement)
        </div>
      </div>
    </aside>
  );
}
