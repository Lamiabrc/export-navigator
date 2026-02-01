import { FormEvent, useState } from "react";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { useI18n } from "@/contexts/LanguageContext";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function Contact() {
  const { t } = useI18n();
  usePageMeta("meta.contact.title", "meta.contact.description");

  const formCopy = (t("contactPage.form") as {
    name: string;
    email: string;
    message: string;
    submit: string;
  }) ?? {
    name: "Nom / société",
    email: "Email professionnel",
    message: "Votre demande",
    submit: "Envoyer et réserver",
  };

  const blockCopy = (t("contactPage.bookBlock") as {
    title: string;
    body: string;
    cta: string;
  }) ?? {
    title: "Réserver un appel 20 min",
    body: "Je vous rappelle pour valider vos risques TVA, douane et DDP avant toute expédition.",
    cta: "Choisir un créneau",
  };

  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <MarketingLayout>
      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.5em] text-slate-400">{t("contactPage.headline")}</p>
              <h1 className="mt-3 text-4xl font-semibold text-slate-900">{t("contactPage.headline")}</h1>
              <p className="mt-4 text-base text-slate-700">{t("contactPage.body")}</p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <label className="flex flex-col gap-2 text-sm text-slate-700">
                  <span className="font-semibold">{formCopy.name}</span>
                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-sm focus:border-slate-900 focus:outline-none"
                    placeholder={formCopy.name}
                    required
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm text-slate-700">
                  <span className="font-semibold">{formCopy.email}</span>
                  <input
                    type="email"
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-sm focus:border-slate-900 focus:outline-none"
                    placeholder={formCopy.email}
                    required
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm text-slate-700">
                  <span className="font-semibold">{formCopy.message}</span>
                  <textarea
                    rows={4}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-sm focus:border-slate-900 focus:outline-none"
                    placeholder={formCopy.message}
                    required
                  />
                </label>

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold uppercase tracking-[0.4em] text-white transition hover:bg-slate-800"
                >
                  {formCopy.submit}
                </button>

                {submitted && (
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                    {t("contactPage.body")}
                  </p>
                )}
              </form>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 shadow-lg">
              <h2 className="text-xl font-semibold text-slate-900">{blockCopy.title}</h2>
              <p className="mt-3 text-sm text-slate-600">{blockCopy.body}</p>
              <button
                type="button"
                className="mt-6 rounded-full border border-slate-900/20 bg-white px-5 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-slate-900 transition hover:bg-slate-100"
              >
                {blockCopy.cta}
              </button>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
