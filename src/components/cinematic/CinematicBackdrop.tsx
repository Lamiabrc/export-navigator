import * as React from "react";
import { cn } from "@/lib/utils";
import worldMap from "@/assets/world-map.svg";

type CinematicBackdropProps = {
  variant?: "public" | "app";
  showMap?: boolean;
  className?: string;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
};

export function CinematicBackdrop({ variant = "public", showMap = true, className }: CinematicBackdropProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const particlesRef = React.useRef<Particle[]>([]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = canvas.offsetWidth;
    let height = canvas.offsetHeight;

    const init = () => {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = Math.max(1, Math.floor(width * window.devicePixelRatio));
      canvas.height = Math.max(1, Math.floor(height * window.devicePixelRatio));
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      const count = variant === "public" ? 60 : 40;
      particlesRef.current = Array.from({ length: count }).map(() => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: 1 + Math.random() * 2,
        a: 0.25 + Math.random() * 0.4,
      }));
    };

    const step = () => {
      ctx.clearRect(0, 0, width, height);

      const particles = particlesRef.current;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;

        ctx.beginPath();
        ctx.fillStyle = `rgba(148, 197, 255, ${p.a})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 120) {
            ctx.strokeStyle = `rgba(100, 160, 255, ${0.08})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      rafRef.current = window.requestAnimationFrame(step);
    };

    init();
    step();

    const resizeObserver = new ResizeObserver(() => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      init();
    });
    resizeObserver.observe(canvas);

    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      resizeObserver.disconnect();
    };
  }, [variant]);

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="absolute inset-0 cinematic-gradient" />
      <div className="absolute inset-0 cinematic-sweep" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-70" />
      {showMap ? (
        <img
          src={worldMap}
          alt=""
          className={cn(
            "absolute right-[-8%] top-[-6%] w-[820px] opacity-20 blur-[0.5px]",
            variant === "app" && "opacity-15"
          )}
        />
      ) : null}
      <div className="absolute inset-0 cinematic-grid opacity-30" />
    </div>
  );
}
