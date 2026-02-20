export type NavLinkConfig = {
  key: string;
  to: string;
  fallback: string;
};

export const navLinks: NavLinkConfig[] = [
  { key: "header.menu.copilot", to: "/copilote", fallback: "Copilote IA (gratuit)" },
  { key: "header.menu.controlTower", to: "/tour-de-controle", fallback: "Tour de contrôle (pro)" },
  { key: "header.menu.guides", to: "/guides", fallback: "Guides" },
  { key: "header.menu.contact", to: "/contact", fallback: "Contact" },
];
