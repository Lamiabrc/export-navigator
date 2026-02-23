import { PublicLayout } from "@/components/layout/PublicLayout";
import { ArrivalGuide } from "@/components/home/ArrivalGuide";
import { VideoBanner } from "@/components/home/VideoBanner";
import { HomeCtas } from "@/components/home/HomeCtas";
import { WizardEntry } from "@/components/WizardEntry";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useI18n } from "@/contexts/LanguageContext";

export default function Home() {
  const { lang } = useI18n();
  const isEn = lang === "en";

  usePageMeta("meta.home.title", "meta.home.description", {
    brandSuffix: "Export Navigator",
  });

  return (
    <PublicLayout>
      <main className="w-full overflow-x-clip pb-8 pt-4 sm:pt-6 lg:pt-8">
        <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-4 sm:gap-8 sm:px-6 lg:gap-10 lg:px-10">
          <ArrivalGuide />
          <WizardEntry />
          <VideoBanner isEn={isEn} />
          <HomeCtas isEn={isEn} />
        </div>
      </main>
    </PublicLayout>
  );
}
