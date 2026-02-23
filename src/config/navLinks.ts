export type NavLinkConfig = {
  key: string;
  to: string;
  fallback: string;
};

export const navLinks: NavLinkConfig[] = [
  { key: "header.menu.copilot", to: "/copilote", fallback: "Copilote IA (gratuit)" },
  { key: "header.menu.products", to: "/services", fallback: "Produits" },
  { key: "header.menu.about", to: "/about", fallback: "A propos" },
  { key: "header.menu.contact", to: "/contact", fallback: "Contact" },
];
