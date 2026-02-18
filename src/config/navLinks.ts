export type NavLinkConfig = {
  key: string;
  to: string;
  fallback: string;
};

export const navLinks: NavLinkConfig[] = [
  { key: "header.menu.home", to: "/", fallback: "Accueil" },
  { key: "header.menu.tool", to: "/tool", fallback: "Outil" },
  { key: "header.menu.services", to: "/services", fallback: "Offre" },
  { key: "header.menu.prospection", to: "/prospection", fallback: "Prospection" },
  { key: "header.menu.watch", to: "/veille", fallback: "Veille" },
  { key: "header.menu.guides", to: "/resources", fallback: "Guides" },
  { key: "header.menu.incoterms", to: "/guides/incoterms", fallback: "Incoterms" },
  { key: "header.menu.methodologie", to: "/methodologie", fallback: "Méthodologie" },
  { key: "header.menu.about", to: "/about", fallback: "À propos" },
  { key: "header.menu.contact", to: "/contact", fallback: "Contact" },
];
