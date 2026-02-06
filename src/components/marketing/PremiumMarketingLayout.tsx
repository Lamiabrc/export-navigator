import type { ReactNode } from "react";
import { MarketingHeader } from "./MarketingHeader";
import { MarketingFooter } from "./MarketingFooter";
import "@/styles/marketing.css";

type PremiumMarketingLayoutProps = {
  children: ReactNode;
  hideHeader?: boolean;
  hideFooter?: boolean;
};

export function PremiumMarketingLayout({
  children,
  hideHeader = false,
  hideFooter = false,
}: PremiumMarketingLayoutProps) {
  return (
    <div className="mkt-shell min-h-screen flex flex-col">
      {!hideHeader && <MarketingHeader />}
      <main className="flex-1">{children}</main>
      {!hideFooter && <MarketingFooter />}
    </div>
  );
}
