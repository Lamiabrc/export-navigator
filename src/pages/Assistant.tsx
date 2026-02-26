import * as React from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import { GuidedAssistantWizard } from "@/components/WizardEntry";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/contexts/LanguageContext";

export default function Assistant() {
  const { lang } = useI18n();
  const isEn = lang === "en";

  return (
    <AppLayout>
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>{isEn ? "Export Expert Assistant" : "Assistant Export Expert"}</CardTitle>
            <CardDescription>
              {isEn
                ? "Guided workflow only: controlled selections, one question at a time, then structured recommendation."
                : "Flux guide uniquement : selections controlees, une question a la fois, puis recommandation structuree."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {isEn
              ? "This assistant avoids open-ended chat and collects all required slots with dropdowns for better decision quality."
              : "Cet assistant evite le chat libre et collecte les informations critiques via menus deroulants pour une meilleure qualite de decision."}
          </CardContent>
        </Card>

        <GuidedAssistantWizard inApp />
      </div>
    </AppLayout>
  );
}
