import type { RssFeedSource } from "./types";

export const DEFAULT_FEEDS: RssFeedSource[] = [
  { id: "economie-gouv-actu", name: "Economie.gouv.fr - Toutes actualites", url: "https://www.economie.gouv.fr/rss/toutesactualites" },
  { id: "service-public-pro", name: "Service-Public Pro - Actualites", url: "https://www.service-public.gouv.fr/abonnements/rss/actu-actu-pro.rss" },

  { id: "tresor-articles-home", name: "DG Tresor - Articles (Tresor Info)", url: "https://www.tresor.economie.gouv.fr/Flux/Atom/Articles/Home" },
  { id: "tresor-articles-tresor-eco", name: "DG Tresor - Articles (tag tresor-eco)", url: "https://www.tresor.economie.gouv.fr/Flux/Atom/Articles/Tags/tresor-eco" },
  { id: "tresor-intl-articles-all", name: "DG Tresor - Reseau international (articles)", url: "https://www.tresor.economie.gouv.fr/Flux/Atom/Articles/PagesInternationales/All" },
  { id: "tresor-intl-events-all", name: "DG Tresor - Reseau international (evenements)", url: "https://www.tresor.economie.gouv.fr/Flux/Atom/Evenements/PagesInternationales/All" },
  { id: "tresor-pagesintl-all", name: "DG Tresor - Pages Internationales (toutes)", url: "https://www.tresor.economie.gouv.fr/Flux/Atom/PagesInternationales" },

  { id: "eu-trade-policy-news", name: "EU DG Trade - News (RSS)", url: "https://policy.trade.ec.europa.eu/node/2/rss_en" },

  { id: "eu-sanctions-ukraine", name: "EU - Sanctions (Ukraine) - RSS", url: "https://finance.ec.europa.eu/single-market-economy/eu-rules-sanctions/russian-invasion-ukraine_en?format=rss" },
  { id: "eu-sanctions-faq", name: "EU - Sanctions FAQs - RSS", url: "https://finance.ec.europa.eu/single-market-economy/eu-rules-sanctions/russian-invasion-ukraine/sanctions-related-faqs_en?format=rss" },

  { id: "wto-latest-en", name: "WTO - Latest News (EN)", url: "https://www.wto.org/library/rss/latest_news_e.xml" },
  { id: "wto-latest-fr", name: "OMC - Dernieres actus (FR)", url: "https://www.wto.org/library/rss/latest_news_f.xml" },

  { id: "uk-ofsi-blog", name: "UK OFSI - Blog (sanctions)", url: "https://ofsi.blog.gov.uk/feed/" },
];

// TRANSPORT & ENERGIE — a ajouter a ton flux
export const TRANSPORT_MARKET_LINKS = [
  // Indices fret conteneurs
  { id: "drewry-trackers", name: "Drewry — Trackers & Indices (WCI etc.)", url: "https://www.drewry.co.uk/trackers-and-indices/latest-trackers-and-indices" },
  { id: "sse-scfi", name: "Shanghai Shipping Exchange — SCFI (index hebdo)", url: "https://en.sse.net.cn/indices/scfinew.jsp" },
  { id: "balticexchange-fbx", name: "Baltic Exchange — FBX (container services)", url: "https://www.balticexchange.com/en/data-services/market-information0/container-services.html" },
  { id: "freightos-fbx", name: "Freightos — Freightos Baltic Index (FBX) infos", url: "https://www.freightos.com/enterprise/terminal/freightos-baltic-index-global-container-pricing-index/" },
  { id: "xeneta-public-index", name: "Xeneta — Public Index (XSI) annonce & contexte", url: "https://www.xeneta.com/blog/xeneta-launches-free-public-index" },

  // Commentaires marche (utile pour “pourquoi ca bouge ?”)
  { id: "freightos-updates", name: "Freightos — Freight Industry Updates", url: "https://www.freightos.com/freight-industry-updates/" },

  // Air cargo (couts + tendances)
  { id: "iata-econ-library", name: "IATA — Economics Report Library (Air Cargo Market Analysis)", url: "https://www.iata.org/en/publications/economics/economics-library/" },

  // Carburants & energie (drivers des couts de transport)
  { id: "ec-weekly-oil-bulletin", name: "Commission europeenne — Weekly Oil Bulletin (prix carburants UE)", url: "https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en" },
  { id: "fr-prix-carburants-opendata", name: "France — Prix des carburants (OpenData)", url: "https://www.prix-carburants.gouv.fr/rubrique/opendata/" },

  // RSS utiles (quand tu veux du “push”)
  { id: "shipandbunker-rss", name: "Ship & Bunker — RSS (bunker / marine fuel & news)", url: "https://feeds.feedburner.com/shipandbunker" },
  { id: "eia-gasdiesel-rss", name: "EIA — Gasoline & Diesel Fuel Update (RSS data)", url: "https://www.eia.gov/petroleum/gasdiesel/includes/gas_diesel_rss.xml" },
];

// COMMODITIES — bourses & cotations
export const COMMODITIES_MARKET_LINKS = [
  // Euronext (France / MATIF)
  { id: "euronext-wheat", name: "Euronext — Blé meunier (EBM-DPAR) cotations", url: "https://live.euronext.com/en/product/commodities-futures/EBM-DPAR" },
  { id: "euronext-corn", name: "Euronext — Maïs (EMA-DPAR) cotations", url: "https://live.euronext.com/en/product/commodities-futures/EMA-DPAR" },
  { id: "euronext-rapeseed", name: "Euronext — Colza (ECO-DPAR) cotations", url: "https://live.euronext.com/en/product/commodities-futures/ECO-DPAR" },
  { id: "euronext-commodities-snapshot", name: "Euronext — Commodities (vue d’ensemble)", url: "https://live.euronext.com/en/products/commodities" },

  // CME (benchmarks mondiaux grains)
  { id: "cme-wheat", name: "CME — Chicago SRW Wheat (quotes)", url: "https://www.cmegroup.com/markets/agriculture/grains/wheat.quotes.html" },
  { id: "cme-corn", name: "CME — Corn (quotes)", url: "https://www.cmegroup.com/markets/agriculture/grains/corn.quotes.html" },

  // Métaux
  { id: "lme-copper", name: "LME — Copper (référence mondiale)", url: "https://www.lme.com/metals/non-ferrous/lme-copper" },

  // Énergie (bourse)
  { id: "ice-brent", name: "ICE — Brent Crude Futures (page produit)", url: "https://www.ice.com/products/219/Brent-Crude-Futures" },
];

// FX — ECB RSS
export const FX_RSS_ECB = [
  { id: "ecb-fx-usd-rss", name: "ECB — EUR/USD (RSS)", url: "https://www.ecb.europa.eu/rss/fxref-usd.html" },
  { id: "ecb-fx-gbp-rss", name: "ECB — EUR/GBP (RSS)", url: "https://www.ecb.europa.eu/rss/fxref-gbp.html" },
  { id: "ecb-fx-chf-rss", name: "ECB — EUR/CHF (RSS)", url: "https://www.ecb.europa.eu/rss/fxref-chf.html" },
  { id: "ecb-fx-cny-rss", name: "ECB — EUR/CNY (RSS)", url: "https://www.ecb.europa.eu/rss/fxref-cny.html" },
];
