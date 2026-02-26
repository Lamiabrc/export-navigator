import type { ReactNode } from "react";

import { PublicLayout } from "@/components/layout/PublicLayout";
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
    <PublicLayout hideBanner={!hideHeader} hideFooter={hideFooter}>
      <div className="mkt-shell min-h-[40vh] flex flex-col">
        <main className="flex-1">{children}</main>
      </div>
    </PublicLayout>
  );
}
