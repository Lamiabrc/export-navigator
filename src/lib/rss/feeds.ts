import type { RssFeedSource } from "./types";

export const DEFAULT_FEEDS: RssFeedSource[] = [
  {
    id: "economie-gouv-actu",
    name: "Economie.gouv.fr - Actualites",
    url: "https://www.economie.gouv.fr/rss/toutesactualites",
  },
  {
    id: "service-public-pro",
    name: "Service-Public Pro - Actualites",
    url: "https://www.service-public.gouv.fr/abonnements/rss/actu-actu-pro.rss",
  },
  {
    id: "wto-news",
    name: "WTO - Latest News",
    url: "http://www.wto.org/library/rss/latest_news_e.xml",
  },
];
