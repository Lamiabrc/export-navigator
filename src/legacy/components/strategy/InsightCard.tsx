type InsightCardProps = {
  title: string;
  bullets: string[];
  accent?: "primary" | "default";
};

export function InsightCard({ title, bullets, accent = "default" }: InsightCardProps) {
  const accentClass =
    accent === "primary"
      ? "border-primary/40 bg-primary/10 text-primary"
      : "border-border bg-card text-foreground dark:border-white/10 dark:bg-white/5";

  return (
    <div className={`rounded-xl border ${accentClass} p-4 space-y-2`}>
      <div className="font-semibold flex items-center gap-2">
        <span className="text-lg" aria-hidden>
          🧠
        </span>
        <span>{title}</span>
      </div>
      <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
        {bullets.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
