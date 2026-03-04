import * as React from "react";
import heroExportVideo from "@/assets/hero-export.mp4";

type Props = {
  isEn: boolean;
};

export function VideoBanner({ isEn }: Props) {
  const [useImageFallback, setUseImageFallback] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || useImageFallback) return;

    let loopStart = 0;
    const tailLoopSeconds = 5;
    const loopEndPadding = 0.08;

    const applyTailOffset = () => {
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;
      loopStart = Math.max(duration - tailLoopSeconds, 0);
      try {
        video.currentTime = loopStart;
      } catch {
        // Metadata not available yet or seek blocked momentarily.
      }
    };

    const keepTailLoop = () => {
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;
      if (video.currentTime >= duration - loopEndPadding) {
        video.currentTime = loopStart;
      }
    };

    if (video.readyState >= 1) {
      applyTailOffset();
    } else {
      video.addEventListener("loadedmetadata", applyTailOffset, { once: true });
    }
    video.addEventListener("timeupdate", keepTailLoop);

    return () => {
      video.removeEventListener("loadedmetadata", applyTailOffset);
      video.removeEventListener("timeupdate", keepTailLoop);
    };
  }, [useImageFallback]);

  return (
    <section className="w-full">
      <div className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-sm">
        <div className="relative h-[170px] w-full max-h-[220px] sm:h-[190px] lg:h-[240px]">
          {useImageFallback ? (
            <img
              src="/videos/hero-export.jpg"
              alt={isEn ? "Export operations overview" : "Vue panoramique des opérations export"}
              className="h-full w-full object-cover"
              loading="eager"
            />
          ) : (
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              autoPlay
              muted
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

          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 lg:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200/95">
              {isEn ? "Export Copilot" : "Copilote export"}
            </p>
            <h1 className="mt-1 max-w-5xl text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
              {isEn
                ? "Ask your export question now. Get actionable guidance in under 60 seconds."
                : "Posez votre question export maintenant. Obtenez une réponse actionnable en moins de 60 secondes."}
            </h1>
          </div>
        </div>
      </div>
    </section>
  );
}
