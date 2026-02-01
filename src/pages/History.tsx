import { useEffect, useState } from "react";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { useI18n } from "@/contexts/LanguageContext";
import { loadHistory, type HistoryEntry } from "@/lib/history";

export default function HistoryPage() {
  const { t } = useI18n();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setEntries(loadHistory());
  }, []);

  return (
    <MarketingLayout>
      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <p className="text-xs uppercase tracking-[0.5em] text-slate-500">
            {t("history.title")}
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-slate-900">{t("history.title")}</h1>
          <p className="mt-2 text-sm text-slate-600">{t("history.empty")}</p>
        </div>

        <div className="mx-auto mt-10 max-w-6xl px-6">
          {entries.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200/80 bg-slate-50 p-10 text-center text-sm text-slate-500">
              {t("history.empty")}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {entries.map((entry) => (
                <article
                  key={entry.id}
                  className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{new Date(entry.createdAt).toLocaleString()}</span>
                    <span className="uppercase tracking-[0.3em]">{entry.plan}</span>
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900">{entry.title}</h2>
                  <p className="text-sm text-slate-600">{entry.summary}</p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    {entry.score !== undefined && (
                      <span className="rounded-full border border-[#1E3A8A] px-3 py-1 text-[#1E3A8A]">
                        Score {entry.score}
                      </span>
                    )}
                    {entry.landedCost !== undefined && (
                      <span className="rounded-full border border-[#DC2626] px-3 py-1 text-[#DC2626]">
                        Coût réel {entry.landedCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} €
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </MarketingLayout>
  );
}
