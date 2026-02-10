import * as React from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { cn } from "@/lib/utils";

type AppLayoutProps = React.ComponentProps<typeof MainLayout>;

export function AppLayout({ wrapperClassName, ...props }: AppLayoutProps) {
  return (
    <MainLayout
      {...props}
      backdropVariant="app"
      wrapperClassName={cn("control-tower-world", wrapperClassName)}
    />
  );
}
