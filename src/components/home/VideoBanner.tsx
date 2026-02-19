import * as React from "react";
import heroExportVideo from "@/assets/hero-export.mp4";

type Props = {
  isEn: boolean;
};

export function VideoBanner({ isEn }: Props) {
  const [useImageFallback, setUseImageFallback] = React.useState(false);

  return (
    <section className="w-full">
      <div className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-sm">
        <div className="relative h-[220px] w-full max-h-[260px] sm:h-[240px] lg:h-[320px]">
          {useImageFallback ? (
            <img
              src="/videos/hero-export.jpg"
              alt={isEn ? "Export operations overview" : "Vue panoramique des opérations export"}
              className="h-full w-full object-cover"
              loading="eager"
            />
          ) : (
            <video
              className="h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster="/videos/hero-export.jpg"
              onError={() => setUseImageFallback(true)}
            >
              <source src="/videos/hero-export.webm" type="video/webm" />
              <source src={heroExportVideo} type="video/mp4" />
            </video>
          )}

          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/75 via-slate-950/35 to-transparent" />

  return (
    <section className="w-full px-4 sm:px-6 lg:px-10">
      <div className="mx-auto w-full max-w-[1400px] overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-sm">
        <div className="relative h-[240px] w-full sm:h-[260px] lg:h-[300px]">
          <video
            className="h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/videos/hero-export.jpg"
          >
            <source src="/videos/hero-export.webm" type="video/webm" />
            <source src={heroExportVideo} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-slate-950/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 lg:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200/95">
              {isEn ? "Export Copilot" : "Copilote export"}
            </p>
            <h1 className="mt-1 max-w-5xl text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
              {isEn
                ? "Ask your export question now. Get actionable guidance in under 60 seconds."
                : "Posez votre question export maintenant. Obtenez une réponse actionnable en moins de 60 secondes."}
            <h1 className="mt-1 max-w-4xl text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
              {isEn
                ? "Ask your export question now. Get concrete guidance in under 60 seconds."
                : "Posez votre question export maintenant. Obtenez une réponse concrète en moins de 60 secondes."}
            </h1>
          </div>
        </div>
      </div>
    </section>
  );
}
