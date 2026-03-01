import * as React from "react";
import { Copy, Mail, MessageSquare, Phone } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";

type Template = {
  id: string;
  channel: "email" | "linkedin" | "call";
  subjectFr: string;
  subjectEn: string;
  bodyFr: string;
  bodyEn: string;
};

const templates: Template[] = [
  {
    id: "intro-email",
    channel: "email",
    subjectFr: "Export France -> {{country}} : proposition en 20 min",
    subjectEn: "France export -> {{country}}: proposal in 20 minutes",
    bodyFr:
      "Bonjour {{name}},\n\nNous accompagnons des flux export {{product}} vers {{country}} avec pilotage cout/marge + conformite.\n\nSi utile, je vous partage un mini-plan en 3 points (Incoterm, docs, risques) adapte a votre cas.\n\nDisponible pour un echange de 20 min ?\n\nCordialement,\n{{sender}}",
    bodyEn:
      "Hello {{name}},\n\nWe support {{product}} export flows to {{country}} with cost/margin control and compliance.\n\nIf useful, I can send a short 3-point plan (Incoterm, docs, risks) tailored to your case.\n\nOpen to a 20-minute call?\n\nBest regards,\n{{sender}}",
  },
  {
    id: "follow-up-linkedin",
    channel: "linkedin",
    subjectFr: "Relance courte",
    subjectEn: "Short follow-up",
    bodyFr:
      "Bonjour {{name}}, je me permets une courte relance: on peut vous aider a securiser vos deals export {{country}} (checklist courte + risques + actions). Souhaitez-vous un exemple concret sur 1 deal ?",
    bodyEn:
      "Hi {{name}}, quick follow-up: we can help secure your {{country}} export deals (short checklist + risks + actions). Would you like a concrete example on one deal?",
  },
  {
    id: "call-script",
    channel: "call",
    subjectFr: "Script appel 5 minutes",
    subjectEn: "5-minute call script",
    bodyFr:
      "1) Contexte: destination + produit principal.\n2) Point douleur: marge, documents, delais, sanctions.\n3) Valeur: cockpit ventes/prospection/conformite en FR/EN.\n4) CTA: creer un deal test puis clic 'Securiser le deal'.",
    bodyEn:
      "1) Context: destination + core product.\n2) Pain point: margin, docs, lead time, sanctions.\n3) Value: bilingual sales/prospecting/compliance cockpit.\n4) CTA: create a test deal then click 'Secure deal'.",
  },
];

function channelLabel(channel: Template["channel"], lang: "fr" | "en") {
  if (channel === "email") return lang === "en" ? "Email" : "Email";
  if (channel === "linkedin") return "LinkedIn";
  return lang === "en" ? "Call" : "Appel";
}

function channelIcon(channel: Template["channel"]) {
  if (channel === "email") return Mail;
  if (channel === "linkedin") return MessageSquare;
  return Phone;
}

export default function LeadTemplates() {
  const { lang } = useI18n();
  const uiLang = lang === "en" ? "en" : "fr";
  const { toast } = useToast();

  const copy = React.useMemo(
    () =>
      uiLang === "en"
        ? {
            title: "Lead Finder Templates",
            subtitle: "FR/EN templates and 3-step outbound sequence for export prospecting.",
            sequence: "Recommended sequence",
            step1: "D1: Intro email with destination/product context",
            step2: "D3: LinkedIn follow-up with one concrete value point",
            step3: "D6: 5-minute discovery call and test deal setup",
            subject: "Subject",
            body: "Message",
            copy: "Copy",
            copied: "Template copied.",
            fr: "FR",
            en: "EN",
          }
        : {
            title: "Templates Lead Finder",
            subtitle: "Templates FR/EN + sequence outbound en 3 etapes pour la prospection export.",
            sequence: "Sequence recommandee",
            step1: "J1: Email intro avec contexte destination/produit",
            step2: "J3: Relance LinkedIn avec une valeur concrete",
            step3: "J6: Appel decouverte 5 min + creation deal test",
            subject: "Objet",
            body: "Message",
            copy: "Copier",
            copied: "Template copie.",
            fr: "FR",
            en: "EN",
          },
    [uiLang]
  );

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: copy.copied });
    } catch {
      toast({
        title: uiLang === "en" ? "Copy failed" : "Copie impossible",
        variant: "destructive",
      });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <Card className="border-blue-100 bg-white/95">
          <CardHeader>
            <CardTitle>{copy.title}</CardTitle>
            <CardDescription>{copy.subtitle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <h3 className="font-semibold">{copy.sequence}</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>{copy.step1}</li>
              <li>{copy.step2}</li>
              <li>{copy.step3}</li>
            </ul>
          </CardContent>
        </Card>

        <div className="grid gap-3 xl:grid-cols-3">
          {templates.map((template) => {
            const Icon = channelIcon(template.channel);
            return (
              <Card key={template.id} className="border-blue-100 bg-white/95">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {channelLabel(template.channel, uiLang)}
                    </CardTitle>
                    <Badge variant="outline">{template.id}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue={uiLang} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="fr">{copy.fr}</TabsTrigger>
                      <TabsTrigger value="en">{copy.en}</TabsTrigger>
                    </TabsList>

                    <TabsContent value="fr" className="space-y-2 pt-2">
                      <p className="text-xs font-semibold">{copy.subject}</p>
                      <p className="text-sm rounded-lg border border-border p-2">{template.subjectFr}</p>
                      <p className="text-xs font-semibold">{copy.body}</p>
                      <pre className="whitespace-pre-wrap text-sm rounded-lg border border-border p-2 font-sans">{template.bodyFr}</pre>
                      <Button size="sm" variant="outline" onClick={() => copyToClipboard(`${template.subjectFr}\n\n${template.bodyFr}`)}>
                        <Copy className="mr-2 h-4 w-4" />
                        {copy.copy}
                      </Button>
                    </TabsContent>

                    <TabsContent value="en" className="space-y-2 pt-2">
                      <p className="text-xs font-semibold">{copy.subject}</p>
                      <p className="text-sm rounded-lg border border-border p-2">{template.subjectEn}</p>
                      <p className="text-xs font-semibold">{copy.body}</p>
                      <pre className="whitespace-pre-wrap text-sm rounded-lg border border-border p-2 font-sans">{template.bodyEn}</pre>
                      <Button size="sm" variant="outline" onClick={() => copyToClipboard(`${template.subjectEn}\n\n${template.bodyEn}`)}>
                        <Copy className="mr-2 h-4 w-4" />
                        {copy.copy}
                      </Button>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}

