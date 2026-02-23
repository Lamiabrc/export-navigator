import { useNavigate } from "react-router-dom";
import { Bot, BookOpen, CreditCard, MessageCircle, PhoneCall, Radar, Sparkles } from "lucide-react";
import heroExportVideo from "@/assets/hero-export.mp4";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useI18n } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

type MindNode = {
  key: string;
  title: string;
  to: string;
  icon: typeof MessageCircle;
  x: number;
  y: number;
};

export function ArrivalGuide({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { lang } = useI18n();
  const isFr = lang !== "en";

  const mindNodes: MindNode[] = isFr
    ? [
        { key: "faq", title: "FAQ export", to: "/resources", icon: BookOpen, x: 16, y: 28 },
        { key: "chat", title: "Chatbot IA", to: "/copilote", icon: MessageCircle, x: 16, y: 72 },
        { key: "pricing", title: "Abonnement", to: "/pricing", icon: CreditCard, x: 50, y: 12 },
        { key: "tower", title: "Tour de controle", to: "/control-tower", icon: Radar, x: 84, y: 28 },
        { key: "human", title: "Conseil humain", to: "/contact", icon: PhoneCall, x: 84, y: 72 },
      ]
    : [
        { key: "faq", title: "Export FAQ", to: "/resources", icon: BookOpen, x: 16, y: 28 },
        { key: "chat", title: "AI chatbot", to: "/copilote", icon: MessageCircle, x: 16, y: 72 },
        { key: "pricing", title: "Subscription", to: "/pricing", icon: CreditCard, x: 50, y: 12 },
        { key: "tower", title: "Control Tower", to: "/control-tower", icon: Radar, x: 84, y: 28 },
        { key: "human", title: "Human advice", to: "/contact", icon: PhoneCall, x: 84, y: 72 },
      ];

  return (
    <Card className={cn("overflow-hidden border-blue-300/90 bg-gradient-to-br from-blue-100 via-slate-50 to-red-100 text-black", className)}>
      <CardContent className="flex h-full flex-col justify-center space-y-5 p-5 sm:space-y-6 sm:p-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <Avatar className="h-12 w-12 border border-blue-300 bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.6)]">
            <AvatarFallback className="bg-white text-blue-700">
              <Bot className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-black sm:text-2xl">
              {isFr ? "Bienvenue sur MPL Export Navigator" : "Welcome to MPL Export Navigator"}
            </h2>
            <p className="max-w-4xl text-sm text-black/90 sm:text-base">
              {isFr
                ? "Si tu es arrive jusqu'ici, tu cherches des infos sur des operations de commerce international liees a la France. Utilise la carte mentale pour choisir ton prochain pas."
                : "If you are here, you probably need support on international trade operations connected to France. Use the mind map to choose your next step."}
            </p>
            <p className="text-sm font-semibold text-black sm:text-base">
              {isFr ? "Tu veux faire quoi ?" : "What do you want to do?"}
            </p>
          </div>
        </div>

        <div className="relative hidden h-[min(58svh,540px)] overflow-hidden rounded-2xl border border-blue-300/80 bg-blue-950 p-4 lg:block">
          <video
            className="absolute inset-0 h-full w-full object-cover opacity-40"
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
          <div className="absolute inset-0 bg-gradient-to-br from-blue-950/75 via-blue-900/60 to-sky-900/75" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0)_56%)]" />

          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
            <defs>
              <linearGradient id="mindline" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#80a7ff" />
                <stop offset="50%" stopColor="#ecf2ff" />
                <stop offset="100%" stopColor="#d62839" />
              </linearGradient>
            </defs>
            {mindNodes.map((node) => {
              const anchorX = node.x < 50 ? node.x + 8 : node.x > 50 ? node.x - 8 : node.x;
              const elbowX = node.x < 50 ? 34 : node.x > 50 ? 66 : 50;
              const centerY = 50;
              const d =
                node.x === 50
                  ? `M 50 ${centerY} L 50 ${node.y + 8}`
                  : `M 50 ${centerY} L ${elbowX} ${centerY} L ${elbowX} ${node.y} L ${anchorX} ${node.y}`;
              return (
                <path
                  key={`line-${node.key}`}
                  d={d}
                  fill="none"
                  stroke="url(#mindline)"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  opacity="0.9"
                />
              );
            })}
          </svg>

          <div className="pointer-events-none absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2">
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,_rgba(223,239,255,0.9)_0%,_rgba(145,186,255,0.45)_48%,_rgba(214,40,57,0.28)_80%,transparent_100%)] blur-xl" />
            <div className="absolute inset-2 overflow-hidden rounded-full border border-blue-100/80 shadow-[0_0_30px_rgba(131,176,255,0.65)]">
              <video
                className="h-full w-full scale-[1.15] object-cover"
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
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.42)_0%,rgba(255,255,255,0)_45%)]" />
            </div>
            <div className="absolute inset-[-8px] animate-[spin_26s_linear_infinite] rounded-full border border-white/25" />
            <div className="absolute bottom-[-20px] left-1/2 -translate-x-1/2 rounded-full border border-white/45 bg-white/90 px-3 py-1 text-[11px] font-semibold text-blue-900">
              {isFr ? "Planete MPL" : "MPL Planet"}
            </div>
          </div>

          {mindNodes.map((node) => {
            const Icon = node.icon;
            return (
              <button
                key={node.key}
                type="button"
                onClick={() => navigate(node.to)}
                className={cn(
                  "absolute flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-medium shadow-sm transition",
                  "border-blue-200/90 text-black hover:border-blue-500 hover:shadow-md",
                )}
                style={{ left: `${node.x}%`, top: `${node.y}%`, transform: "translate(-50%, -50%)" }}
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 via-white to-red-100 text-blue-700">
                  <Icon className="h-4 w-4" />
                </span>
                <span>{node.title}</span>
              </button>
            );
          })}

          <div className="absolute bottom-4 left-4 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-medium text-black shadow-sm">
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              {isFr ? "Carte mentale interactive" : "Interactive mind map"}
            </span>
          </div>
        </div>

        <div className="relative h-40 overflow-hidden rounded-xl border border-blue-300/80 bg-blue-950 lg:hidden">
          <video
            className="absolute inset-0 h-full w-full object-cover opacity-40"
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
          <div className="absolute inset-0 bg-gradient-to-br from-blue-950/70 via-blue-900/60 to-sky-900/70" />
          <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border border-blue-100/80 shadow-[0_0_20px_rgba(131,176,255,0.65)]">
            <video className="h-full w-full scale-[1.18] object-cover" autoPlay muted loop playsInline preload="metadata" poster="/videos/hero-export.jpg">
              <source src="/videos/hero-export.webm" type="video/webm" />
              <source src={heroExportVideo} type="video/mp4" />
            </video>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 lg:hidden">
          {mindNodes.map((node) => {
            const Icon = node.icon;
            return (
              <Button
                key={`mobile-${node.key}`}
                variant="outline"
                className="justify-start gap-2 border-blue-200 bg-white"
                onClick={() => navigate(node.to)}
              >
                <Icon className="h-4 w-4 text-blue-700" />
                {node.title}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
