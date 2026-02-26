import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { useI18n } from "@/contexts/LanguageContext";
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
  const { t } = useI18n();
  const location = useLocation();
  const banner = getBannerContent(location.pathname);

  const heroDisclaimers = (t("heroLanding.disclaimers") as string[]) ?? [];
  const globalDisclaimers = (t("disclaimers") as string[]) ?? [];

  return (
    <PublicLayout hideBanner={hideBanner} hideFooter={hideFooter}>
      <div className="flex min-h-[40vh] flex-col bg-white text-slate-900">
        <main className="flex-1">{children}</main>

        {!hideFooter ? (
          <div className="border-t border-blue-100 bg-white/85 px-6 py-8">
            <div className="mx-auto max-w-6xl">
              <GdprGuarantee />

              {globalDisclaimers.length > 0 || heroDisclaimers.length > 0 ? (
                <div className="mt-6 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                  {[...heroDisclaimers, ...globalDisclaimers]
                    .filter(Boolean)
                    .map((text, index) => (
                      <p key={`${banner.title}-${index}`} className="text-xs text-slate-500">
                        {text}
                      </p>
                    ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </PublicLayout>
  );
};
