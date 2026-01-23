import * as React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Action = {
  label: string;
  to?: string;
  onClick?: () => void;
  variant?: "default" | "secondary" | "outline";
};

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  primaryAction?: Action;
  secondaryAction?: Action;
  className?: string;
};

export function EmptyState({
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
  className,
}: EmptyStateProps) {
  const renderAction = (action?: Action) => {
    if (!action) return null;
    const content = (
      <Button variant={action.variant ?? "default"} onClick={action.onClick}>
        {action.label}
      </Button>
    );
    return action.to ? (
      <Button asChild variant={action.variant ?? "default"}>
        <Link to={action.to}>{action.label}</Link>
      </Button>
    ) : (
      content
    );
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card/80 p-6 text-center shadow-sm",
        className
      )}
    >
      {icon ? <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-primary">{icon}</div> : null}
      <h3 className="text-lg font-semibold">{title}</h3>
      {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
      {(primaryAction || secondaryAction) ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {renderAction(primaryAction)}
          {renderAction(secondaryAction)}
        </div>
      ) : null}
    </div>
  );
}
