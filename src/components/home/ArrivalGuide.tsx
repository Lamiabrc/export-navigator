import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, Info, MessageCircle, Package, PhoneCall, Sparkles } from "lucide-react";
import heroExportVideo from "@/assets/hero-export.mp4";
import { useI18n } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

type ActionItem = {
  key: string;
  title: string;
  subtitle: string;
  to: string;
  icon: typeof MessageCircle;
};

export function ArrivalGuide({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { lang } = useI18n();
  const isFr = lang !== "en";
  const [menuExpanded, setMenuExpanded] = useState(true);
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);
  const orbVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoTailLoopSeconds = 5;
  const videoLoopEndPadding = 0.08;
  const actionsPanelId = "arrival-guide-actions";

  const actions: ActionItem[] = isFr
    ? [
        {
          key: "products",
          title: "Voir nos produits",
          subtitle: "Services et solutions export",
          to: "/services",
          icon: Package,
        },
        {
          key: "about",
          title: "A propos de MPL",
          subtitle: "Vision, mission et methodologie",
          to: "/about",
          icon: Info,
        },
        {
          key: "contact",
          title: "Contact",
          subtitle: "Parler a un expert export",
          to: "/contact",
          icon: PhoneCall,
        },
      ]
    : [
        {
          key: "products",
          title: "Discover our products",
          subtitle: "Export services and solutions",
          to: "/services",
          icon: Package,
        },
        {
          key: "about",
          title: "About MPL",
          subtitle: "Vision, mission and method",
          to: "/about",
          icon: Info,
        },
        {
          key: "contact",
          title: "Contact",
          subtitle: "Talk to an export expert",
          to: "/contact",
          icon: PhoneCall,
        },
      ];

  const bubbleText = isFr
    ? {
        top: "Question export ?",
        left: "Incoterms | Douane | HS",
        right: "Reponse rapide",
        hi: "Salut !",
      }
    : {
        top: "Export question?",
        left: "Incoterms | Customs | HS",
        right: "Fast answer",
        hi: "Hi!",
      };

  useEffect(() => {
    const seekLater = (video: HTMLVideoElement | null) => {
      if (!video) return () => {};
      let loopStart = 0;

      const applyOffset = () => {
        const duration = video.duration;
        if (!Number.isFinite(duration) || duration <= 0) return;
        loopStart = Math.max(duration - videoTailLoopSeconds, 0);
        try {
          video.currentTime = loopStart;
        } catch {
          // Some browsers can block seek before metadata; event listener handles retry.
        }
      };
      const keepTailLoop = () => {
        const duration = video.duration;
        if (!Number.isFinite(duration) || duration <= 0) return;
        if (video.currentTime >= duration - videoLoopEndPadding) {
          video.currentTime = loopStart;
          if (video.paused) {
            void video.play().catch(() => {
              // Ignore autoplay/play rejection; next user interaction will resume.
            });
          }
        }
      };

      if (video.readyState >= 1) {
        applyOffset();
      } else {
        video.addEventListener("loadedmetadata", applyOffset, { once: true });
      }
      video.addEventListener("timeupdate", keepTailLoop);

      return () => {
        video.removeEventListener("loadedmetadata", applyOffset);
        video.removeEventListener("timeupdate", keepTailLoop);
      };
    };

    const cleanupBg = seekLater(bgVideoRef.current);
    const cleanupOrb = seekLater(orbVideoRef.current);
    return () => {
      cleanupBg();
      cleanupOrb();
    };
  }, []);

  return (
    <section className={cn("relative isolate h-full overflow-hidden border-0 text-white", className)}>
      <style>
        {`
          @keyframes heroBackdropDrift {
            0%, 45% { transform: scale(1) translate3d(0, 0, 0); }
            100% { transform: scale(1.006) translate3d(0, -0.3%, 0); }
          }
          @keyframes heroOrbZoom {
            0%, 55% { transform: scale(1); }
            100% { transform: scale(1.04); }
          }
          @keyframes heroOrbFloat {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-14px); }
          }
          @keyframes heroHaloPulse {
            0%, 100% { opacity: 0.42; filter: blur(36px); }
            50% { opacity: 0.92; filter: blur(56px); }
          }
          @keyframes heroRingSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes heroTagPulse {
            0%, 100% { box-shadow: 0 0 0 rgba(56, 189, 248, 0); }
            50% { box-shadow: 0 0 22px rgba(56, 189, 248, 0.35); }
          }
          @keyframes heroPanelShimmer {
            0% { transform: translateX(-35%); opacity: 0; }
            18% { opacity: 0.15; }
            40% { opacity: 0.22; }
            100% { transform: translateX(110%); opacity: 0; }
          }
        `}
      </style>

      <video
        ref={bgVideoRef}
        className="absolute inset-0 h-full w-full object-cover opacity-100 [transform:translateZ(0)]"
        style={{ animation: "heroBackdropDrift 34s linear infinite", filter: "contrast(1.08) saturate(1.08)" }}
        autoPlay
        muted
        playsInline
        preload="auto"
        poster="/videos/hero-export.jpg"
      >
        <source src={heroExportVideo} type="video/mp4" />
      </video>

      <div className="absolute inset-0 bg-[url('/videos/hero-export.jpg')] bg-cover bg-center opacity-20 mix-blend-soft-light" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#020814]/16 via-[#030812]/26 to-[#02060f]/42" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_41%,rgba(24,78,148,0.16)_0%,rgba(3,7,15,0)_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_78%,rgba(168,52,78,0.08)_0%,rgba(0,0,0,0)_48%)]" />

      <div className="relative z-10 flex h-full flex-col justify-between px-4 py-4 sm:px-8 sm:py-6">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-300/35 bg-[#050b16]/72 px-3 py-1 text-xs font-semibold tracking-wide text-white backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-sky-200" />
          MPL EXPORT NAVIGATOR
        </div>

        <div className="relative mx-auto flex w-full max-w-6xl flex-1 items-center justify-center">
          <div className="absolute top-[10%] rounded-2xl border border-slate-300/30 bg-[#040b17]/76 px-4 py-2 text-sm font-semibold text-white shadow-xl backdrop-blur md:px-5">
            {bubbleText.top}
          </div>

          <div
            className="absolute left-[13%] top-[30%] hidden rounded-2xl border border-slate-300/30 bg-[#040b17]/74 px-4 py-2 text-sm font-medium text-white shadow-xl backdrop-blur md:block"
            style={{ animation: "heroTagPulse 5s ease-in-out infinite" }}
          >
            {bubbleText.left}
          </div>
          <div
            className="absolute right-[13%] top-[28%] hidden rounded-2xl border border-slate-300/30 bg-[#040b17]/74 px-4 py-2 text-sm font-medium text-white shadow-xl backdrop-blur md:block"
            style={{ animation: "heroTagPulse 5s ease-in-out infinite 1.3s" }}
          >
            {bubbleText.right}
          </div>

          <div className="absolute left-[30%] top-[48%] hidden h-px w-[14%] bg-gradient-to-r from-transparent via-sky-300/70 to-transparent md:block" />
          <div className="absolute right-[30%] top-[46%] hidden h-px w-[14%] bg-gradient-to-r from-transparent via-sky-300/70 to-transparent md:block" />
          <div className="absolute top-[23%] hidden h-[13%] w-px bg-gradient-to-b from-transparent via-sky-300/70 to-transparent md:block" />

          <div className="relative h-52 w-52 sm:h-64 sm:w-64" style={{ animation: "heroOrbFloat 7s ease-in-out infinite" }}>
            <div
              className="absolute -inset-14 rounded-full bg-[radial-gradient(circle,rgba(35,108,188,0.72)_0%,rgba(26,63,108,0.42)_42%,rgba(0,0,0,0)_74%)]"
              style={{ animation: "heroHaloPulse 4.8s ease-in-out infinite" }}
            />
            <div className="absolute inset-0 rounded-full border border-slate-200/30 shadow-[0_0_45px_rgba(46,128,218,0.45)]" />
            <div className="absolute -inset-4 rounded-full border border-sky-300/35" style={{ animation: "heroRingSpin 22s linear infinite" }} />
            <div className="absolute -inset-9 rounded-full border border-red-300/24" style={{ animation: "heroRingSpin 30s linear infinite reverse" }} />

            <div className="absolute inset-[11px] overflow-hidden rounded-full border border-slate-300/30 bg-[#020916]">
              <video
                ref={orbVideoRef}
                className="h-full w-full object-cover"
                style={{ animation: "heroOrbZoom 10.8s ease-in-out infinite" }}
                autoPlay
                muted
                playsInline
                preload="metadata"
                poster="/videos/hero-export.jpg"
              >
                <source src={heroExportVideo} type="video/mp4" />
              </video>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_20%,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0)_42%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_72%,rgba(0,0,0,0.22)_0%,rgba(0,0,0,0.06)_35%,rgba(0,0,0,0.36)_100%)]" />
            </div>

            <div className="absolute -right-7 -top-5 rounded-full border border-slate-300/35 bg-[#040b16]/88 px-4 py-1 text-lg font-semibold text-white shadow-2xl backdrop-blur">
              {bubbleText.hi}
            </div>
          </div>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-5xl overflow-hidden rounded-[26px] border border-slate-600/60 bg-[#040b15]/78 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.58)] backdrop-blur-xl sm:p-6">
          <div
            className="pointer-events-none absolute inset-y-0 left-[-45%] w-[52%] bg-[linear-gradient(115deg,rgba(69,145,229,0)_0%,rgba(69,145,229,0.5)_50%,rgba(69,145,229,0)_100%)]"
            style={{ animation: "heroPanelShimmer 8.4s linear infinite" }}
          />

          <div className="relative">
            <h2 className="text-lg font-semibold text-white sm:text-2xl">
              {isFr ? "Bienvenue sur MPL Export Navigator" : "Welcome to MPL Export Navigator"}
            </h2>
            <p className="mt-2 text-sm text-white sm:text-base">
              {isFr
                ? "Tu veux des informations sur des operations de commerce international liees a la France. Choisis ton point de depart."
                : "You need guidance on international trade operations connected to France. Choose your starting point."}
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white sm:text-base">{isFr ? "Tu veux faire quoi ?" : "What do you want to do?"}</p>
              <button
                type="button"
                aria-expanded={menuExpanded}
                aria-controls={actionsPanelId}
                onClick={() => setMenuExpanded((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-400/35 bg-[#071124]/78 px-3 py-1 text-xs font-semibold text-white transition hover:border-sky-300/55 hover:bg-[#0b1f3c]/84"
              >
                {menuExpanded ? (isFr ? "Replier le menu" : "Collapse menu") : (isFr ? "Deplier le menu" : "Expand menu")}
                {menuExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            </div>

            <div
              id={actionsPanelId}
              className={cn(
                "overflow-hidden transition-all duration-300",
                menuExpanded ? "mt-4 max-h-96 opacity-100" : "max-h-0 opacity-0"
              )}
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {actions.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => navigate(item.to)}
                      className="group flex items-center rounded-2xl border border-slate-600/70 bg-[#081326]/72 px-3 py-3 text-left transition duration-300 hover:-translate-y-0.5 hover:border-sky-300/55 hover:bg-[#0b1f3c]/84"
                    >
                      <span className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-500/70 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-sky-100">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="flex flex-col">
                        <span className="text-sm font-semibold text-white">{item.title}</span>
                        <span className="text-xs font-normal text-white group-hover:text-white">{item.subtitle}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
