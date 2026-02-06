export type BannerContent = {
  title: string;
  question: string;
};

const DEFAULT_CONTENT: BannerContent = {
  title: "MPL Export Navigator",
  question: "Quelle decision export devez-vous securiser ?",
};

function cleanPathname(pathname: string) {
  const raw = (pathname || "").split("?")[0].split("#")[0];
  if (!raw || raw === "/") return "/";
  return raw.replace(/\/+$/, "");
}

function humanizeSlug(slug: string) {
  const base = slug
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!base) return "Guide";
  return base.replace(/\b\w/g, (m) => m.toUpperCase());
}

export function getBannerContent(pathname: string): BannerContent {
  const path = cleanPathname(pathname).toLowerCase();

  if (path === "/") {
    return { title: "Accueil", question: "Par ou commencer pour securiser un export ?" };
  }

  if (path.startsWith("/tool")) {
    return { title: "Outil", question: "Quel cout export et quel risque principal ?" };
  }

  if (path.startsWith("/services")) {
    return { title: "Offre", question: "Quelle option d'accompagnement vous convient ?" };
  }

  if (path.startsWith("/veille")) {
    return { title: "Veille", question: "Quelles nouvelles regles impactent vos expeditions ?" };
  }

  if (path.startsWith("/guides")) {
    const parts = path.split("/");
    const slug = parts.length > 2 ? parts[2] : "";
    const title = slug ? `Guide: ${humanizeSlug(slug)}` : "Guides";
    return { title, question: "Quel incoterm utiliser pour cette vente ?" };
  }

  if (path.startsWith("/methodologie")) {
    return { title: "Methodologie", question: "Comment est calculee votre estimation ?" };
  }

  if (path.startsWith("/about")) {
    return { title: "A propos", question: "Pourquoi MPL Export Conseil ?" };
  }

  if (path.startsWith("/contact")) {
    return { title: "Contact", question: "Quel dossier export faut-il securiser ?" };
  }

  if (path.startsWith("/pricing") || path.startsWith("/tarifs")) {
    return { title: "Offres & tarifs", question: "Quel plan est adapte a votre volume ?" };
  }

  if (path.startsWith("/analyse")) {
    return { title: "Analyse", question: "Quels couts et risques faut-il valider ?" };
  }

  if (path.startsWith("/newsletter")) {
    return { title: "Newsletter", question: "Souhaitez-vous recevoir la veille export ?" };
  }

  if (path.startsWith("/legal") || path.startsWith("/mentions-legales") || path.startsWith("/confidentialite") || path.startsWith("/cookies") || path.startsWith("/cgu") || path.startsWith("/cgv")) {
    return { title: "Informations legales", question: "Que faut-il verifier avant usage ?" };
  }

  if (path.startsWith("/app")) {
    if (path.includes("centre-veille")) {
      return { title: "Centre de veille", question: "Quel signal doit-on traiter maintenant ?" };
    }
    if (path.includes("analyse") || path.includes("simulator")) {
      return { title: "Analyse", question: "Quel arbitrage prendre sur vos couts ?" };
    }
    if (path.includes("invoice")) {
      return { title: "Controle facture", question: "La facture est-elle coherent(e) ?" };
    }
    if (path.includes("assistant")) {
      return { title: "Assistant export", question: "Quelle question export voulez-vous clarifier ?" };
    }
    return { title: "Espace client", question: "Quel point de decision traiter aujourd'hui ?" };
  }

  return DEFAULT_CONTENT;
}
