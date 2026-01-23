import * as React from "react";
import { MainLayout } from "@/components/layout/MainLayout";

type AppLayoutProps = React.ComponentProps<typeof MainLayout>;

export function AppLayout(props: AppLayoutProps) {
  return <MainLayout {...props} />;
}
