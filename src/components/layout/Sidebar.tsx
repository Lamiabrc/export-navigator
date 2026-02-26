import type { ElementType } from "react";
import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/LanguageContext";
import { isAdminUser } from "@/lib/authz";
import { appNav, isPathActive, type AppNavItem } from "@/config/navigation";

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

export type SidebarProps = {
  onNavigate?: () => void;
  className?: string;
};

export function Sidebar({ onNavigate, className }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { lang } = useI18n();

  const safeName = (user?.email || "Utilisateur").split("@")[0];

  const getInitials = (name: string) => {
    const parts = name.split(/[.\s_-]+/).filter(Boolean);
    const initials = parts.map((p) => p[0]).join("").toUpperCase();
    return (initials || "??").slice(0, 2);
  };

  const isAdmin = isAdminUser(user);

  const navigation: NavSection[] = React.useMemo(
    () =>
      appNav.map((section) => ({
        title: section.labels[lang],
        items: section.items.map((item: AppNavItem) => ({
          name: item.labels[lang],
          href: item.to,
          icon: item.icon,
          badge: item.badge,
          featured: item.featured,
          aliases: item.aliases,
          adminOnly: item.adminOnly,
        })),
      })),
    [lang]
  );

  const isItemActive = (item: NavItem) => {
    const path = location.pathname;
    const matchesAlias = item.aliases?.some((alias) => path === alias || path.startsWith(`${alias}/`));
    return matchesAlias || isPathActive(path, item.href);
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
      aria-label={lang === "en" ? "Main navigation" : "Navigation principale"}
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
            <p className="text-xs text-muted-foreground truncate">{isAdmin ? "Admin" : lang === "en" ? "User" : "Utilisateur"}</p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-muted transition focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label={lang === "en" ? "Sign out" : "Deconnexion"}
            title={lang === "en" ? "Sign out" : "Deconnexion"}
          >
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </aside>
  );
}
