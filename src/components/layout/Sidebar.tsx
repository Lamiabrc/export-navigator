import type { ElementType } from "react";
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Activity, BookOpen, Bot, Calculator, LogOut, Package, Receipt, Scale, Settings, ShieldCheck, Target, TrendingUp, Users } from "lucide-react";

type NavItem = {
  name: string;
  href: string;
  icon: ElementType;
  badge?: string;
  featured?: boolean;
  aliases?: string[];
  adminOnly?: boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const navigation: NavSection[] = [
  {
    title: "Pilotage & Ventes",
    items: [
      {
        name: "Control Tower",
        href: "/control-tower",
        icon: Activity,
        badge: "Live",
        featured: true,
        aliases: ["/dashboard"],
      },
      {
        name: "Command Center",
        href: "/command-center",
        icon: ShieldCheck,
      },
      {
        name: "Analyse des ventes",
        href: "/explore",
        icon: TrendingUp,
        aliases: ["/sales"],
      },
    ],
  },
  {
    title: "Concurrence",
    items: [
      {
        name: "Concurrence",
        href: "/concurrence",
        icon: Target,
        aliases: ["/competition", "/watch/commercial", "/watch/competitive"],
      },
    ],
  },
  {
    title: "Couts & Pricing",
    items: [
      {
        name: "Costs (charges)",
        href: "/costs",
        icon: Receipt,
      },
      {
        name: "Simulator",
        href: "/simulator",
        icon: Calculator,
      },
      {
        name: "Taxes/OM",
        href: "/taxes-om",
        icon: Scale,
      },
    ],
  },
  {
    title: "Référentiels & Veille",
    items: [
      {
        name: "Produits",
        href: "/products",
        icon: Package,
      },
      {
        name: "Clients",
        href: "/clients",
        icon: Users,
      },
      {
        name: "Veille reglementaire",
        href: "/watch/regulatory",
        icon: BookOpen,
      },
    ],
  },
  {
    title: "IA & Assistance",
    items: [{ name: "Assistant", href: "/assistant", icon: Bot }],
  },
  {
    title: "Admin",
    items: [{ name: "Admin", href: "/admin", icon: Settings, adminOnly: true }],
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
          "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all border",
          "focus:outline-none focus:ring-2 focus:ring-primary/30",
          active
            ? "bg-primary/10 text-foreground border-primary/30 shadow-sm"
            : "bg-transparent text-muted-foreground border-transparent hover:bg-muted hover:text-foreground hover:border-border",
          item.featured && !active && "border-border bg-card",
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
        "bg-card/95 backdrop-blur-xl border-r border-border shadow-xl",
        className,
      )}
      aria-label="Navigation principale"
    >
      {/* Nav */}
      <nav className="flex-1 space-y-4 px-3 py-4 overflow-y-auto">
        {navigation.map((section) => {
          const visibleItems = section.items.filter((it) => {
            if (it.adminOnly && user?.email !== "lamia.brechetighil@orliman.fr") return false;
            return true;
          });
          if (!visibleItems.length) return null;
          return (
            <div key={section.title}>
              <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </div>
              <div className="space-y-1.5">{visibleItems.map(renderLink)}</div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-4 bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20">
            <span className="text-sm font-medium">{getInitials(safeName)}</span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{safeName}</p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-muted transition focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label="Deconnexion"
            title="Deconnexion"
          >
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          <Bot className="h-4 w-4" />
          IA Export via Edge Function (cle cote serveur uniquement)
        </div>
      </div>
    </aside>
  );
}
