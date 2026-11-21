import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { GdprGuarantee } from "@/components/GdprGuarantee";
import { getBannerContent } from "@/config/bannerContent";

type MarketingLayoutProps = {
  children: ReactNode;
  hideBanner?: boolean;
  hideFooter?: boolean;
};

export const MarketingLayout = ({
  children,
  hideBanner = false,
  hideFooter = false,
}: MarketingLayoutProps) => {
  const location = useLocation();
  const banner = getBannerContent(location.pathname);


  return (
    <PublicLayout hideBanner={hideBanner} hideFooter={hideFooter}>
      <div className="flex min-h-[40vh] flex-col bg-white text-slate-900">
        <main className="flex-1">{children}</main>

        {!hideFooter ? (
          <div className="border-t border-blue-100 bg-white/85 px-6 py-8">
            <div className="mx-auto max-w-6xl">
              <GdprGuarantee />

            </div>
          </div>
        ) : null}
      </div>
    </PublicLayout>
  );
};
