import { PublicLayout } from "@/components/layout/PublicLayout";
import { VideoBanner } from "@/components/home/VideoBanner";
import { CopilotChatWide } from "@/components/home/CopilotChatWide";
import { HomeCtas } from "@/components/home/HomeCtas";
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
      <main className="w-full space-y-6 pb-2 pt-4 sm:space-y-8 sm:pt-6 lg:space-y-10 lg:pt-8">
        <VideoBanner isEn={isEn} />
        <CopilotChatWide isEn={isEn} />
        <HomeCtas isEn={isEn} />
      </main>
    </PublicLayout>
  );
}
