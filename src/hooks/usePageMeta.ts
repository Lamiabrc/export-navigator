import { useEffect } from "react";

import { useI18n } from "@/contexts/LanguageContext";

export const usePageMeta = (titleKey: string, descriptionKey: string) => {
  const { t, lang } = useI18n();

  useEffect(() => {
    const title = t(titleKey);
    if (typeof title === "string" && title.length > 0) {
      document.title = title;
    }

    const description = t(descriptionKey);
    if (typeof description === "string") {
      let metaElement = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
      if (!metaElement) {
        metaElement = document.createElement("meta");
        metaElement.setAttribute("name", "description");
        document.head.appendChild(metaElement);
      }

      metaElement.setAttribute("content", description);
    }
  }, [descriptionKey, lang, t, titleKey]);
};
