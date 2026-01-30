export type ImpactLevel = "LOW" | "MED" | "HIGH";

export type RssImpact = {
  impact: ImpactLevel;
  reasons: string[];
  tags: string[];
};

export type RssItem = {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  sourceName: string;
  sourceUrl: string;
  summary: string;
  impact: ImpactLevel;
  reasons: string[];
  tags: string[];
};

export type RssFeedSource = {
  id: string;
  name: string;
  url: string;
};
