import { PublicLayout } from "@/components/layout/PublicLayout";
import { ArrivalGuide } from "@/components/home/ArrivalGuide";
import { VideoBanner } from "@/components/home/VideoBanner";
import { HomeCtas } from "@/components/home/HomeCtas";
import { HomeRssFeed } from "@/components/home/HomeRssFeed";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentDossiers } from "@/components/dashboard/RecentDossiers";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useI18n } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

export default function Home() {
  const { lang } = useI18n();
  const { isAuthenticated } = useAuth();
  const isEn = lang === "en";

  usePageMeta("meta.home.title", "meta.home.description", {
    brandSuffix: "Export Navigator",
    canonicalUrl: "https://www.exportfrancefacile.com/",
    socialImageUrl: "https://www.exportfrancefacile.com/images/og-home.jpg",
    socialImageAlt: "Page d'accueil Export Navigator",
  });

  return (
    <PublicLayout>
      <main className="w-full overflow-x-clip pb-8 pt-0">
        <section className="w-full" style={{ height: "min(70vh, 760px)", minHeight: "520px" }}>
          <ArrivalGuide className="h-full rounded-none border-x-0 border-t-0" />
        </section>

        <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-4 pt-6 sm:gap-8 sm:px-6 lg:gap-10 lg:px-10">
          <QuickActions isEn={isEn} />
          {isAuthenticated ? <RecentDossiers isEn={isEn} /> : null}
          <HomeRssFeed isEn={isEn} />
          <VideoBanner isEn={isEn} />
          <HomeCtas isEn={isEn} />
        </div>
      </main>
    </PublicLayout>
  );
}
