import heroExportVideo from "@/assets/hero-export.mp4";

type Props = {
  isEn: boolean;
};

export function VideoBanner({ isEn }: Props) {
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
