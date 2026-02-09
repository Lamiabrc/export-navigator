import type { ElementType } from "react";
import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  Activity,
  BookOpen,
  Bot,
  Calculator,
  FileCheck2,
  Home,
  LogOut,
  Package,
  Scale,
  Settings,
  ShieldCheck,
} from "lucide-react";

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
    title: "Site public",
    items: [
      {
        name: "Accueil public",
        href: "/",
        icon: Home,
        aliases: ["/home", "/public"],
      },
    ],
  },
  {
    title: "Accueil",
    items: [
      {
        name: "Tour de controle",
        href: "/app/control-tower",
        icon: Activity,
        badge: "Live",
        featured: true,
        aliases: ["/dashboard", "/command-center", "/hub", "/app", "/app/command-center", "/app/control-tower"],
      },
    ],
  },

  {
    title: "Décider vite",
    items: [
      {
        name: "Analyse coûts (simulateur)",
        href: "/app/simulator",
        icon: Calculator,
        aliases: ["/analyse", "/app/analyse", "/app/export/costing"],
      },
      {
        name: "Contrôle facture",
        href: "/app/invoice-check",
        icon: FileCheck2,
        aliases: ["/app/import/check-invoice"],
      },
      {
        name: "Taxes & OM",
        href: "/app/taxes-om",
        icon: Scale,
        aliases: ["/app/taxes", "/app/om", "/app/octroi-mer"],
      },
    ],
  },

  {
    title: "Conformité",
    items: [
      {
        name: "Centre conformité",
        href: "/app/compliance",
        icon: ShieldCheck,
        aliases: ["/app/centre-conformite", "/app/controls", "/app/sanctions"],
      },
      {
        name: "Guides (Incoterms, TVA…)",
        href: "/guides/incoterms-ddp",
        icon: BookOpen,
        aliases: ["/guides", "/guides/incoterms", "/guides/tva", "/methodologie"],
      },
    ],
  },

  {
    title: "Veille",
    items: [
      {
        name: "Veille réglementaire",
        href: "/app/centre-veille/reglementation",
        icon: BookOpen,
        aliases: ["/veille", "/watch", "/app/centre-veille"],
      },
    ],
  },

  {
    title: "Référentiels",
    items: [
      {
        name: "Produits (HS code)",
        href: "/app/produits",
        icon: Package,
        aliases: ["/app/products", "/app/hs", "/app/hs-codes"],
      },
    ],
  },

  {
    title: "IA & Assistance",
    items: [{ name: "IA Export", href: "/app/assistant", icon: Bot, aliases: ["/assistant"] }],
  },

  {
    title: "Admin",
    items: [{ name: "Admin", href: "/app/admin", icon: Settings, adminOnly: true }],
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
    const parts = name.split(/[.\s_-]+/).filter(Boolean);
    const initials = parts.map((p) => p[0]).join("").toUpperCase();
    return (initials || "??").slice(0, 2);
  };

  const isItemActive = (item: NavItem) => {
    const path = location.pathname;

    const matchesAlias = item.aliases?.some(
      (alias) => path === alias || path.startsWith(`${alias}/`)
    );

    return (
      matchesAlias ||
      path === item.href ||
      path.startsWith(`${item.href}/`)
    );
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } finally {
      onNavigate?.();
      navigate("/login");
    }
  };

  const isAdmin =
    user?.email?.toLowerCase() === "lamia.brechet@outlook.fr" ||
    user?.role === "admin";

  const renderLink = (item: NavItem) => {
    if (item.adminOnly && !isAdmin) return null;

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
          item.featured && !active && "border-border bg-card"
        )}
        aria-current={active ? "page" : undefined}
      >
        <item.icon className="h-5 w-5" />
        <span className="truncate">{item.name}</span>

        {item.badge ? (
          <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
            {item.badge}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-[70] flex w-64 flex-col",
        "bg-card/95 backdrop-blur-xl border-r border-border shadow-xl",
        className
      )}
      aria-label="Navigation principale"
    >
      <nav className="flex-1 space-y-4 px-3 py-4 overflow-y-auto">
        {navigation.map((section) => {
          const visibleItems = section.items.filter((it) => !(it.adminOnly && !isAdmin));
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

      <div className="border-t border-border p-4 bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20">
            <span className="text-sm font-medium">{getInitials(safeName)}</span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{safeName}</p>
            <p className="text-xs text-muted-foreground truncate">
              {isAdmin ? "Admin" : "Utilisateur"}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-muted transition focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label="Déconnexion"
            title="Déconnexion"
          >
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          <Bot className="h-4 w-4" />
          IA Export — traitements côté serveur uniquement
        </div>
      </div>
    </aside>
  );
}
