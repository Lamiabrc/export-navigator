import { publicNav } from "@/config/navigation";

export type NavLinkConfig = {
  key: string;
  to: string;
  fallback: string;
};

export const navLinks: NavLinkConfig[] = publicNav.map((item) => ({
  key: item.tKey || `header.menu.${item.id}`,
  to: item.to,
  fallback: item.labels.fr,
}));
