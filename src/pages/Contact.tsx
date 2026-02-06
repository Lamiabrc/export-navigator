import type { ComponentType } from "react";
import { Link } from "react-router-dom";

import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, FileCheck2, BookOpen, BellRing, Target } from "lucide-react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";

type ActionItem = {
  title: string;
  description: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
  cta: string;
};

const ACTIONS: ActionItem[] = [
  {
    title: "Vérifier une facture",
    description: "Contrôle rapide : cohérence facture, Incoterm, HS code, taxes.",
    to: "/app/invoice-check",
    icon: FileCheck2,
    cta: "Ouvrir le contrôle",
  },
  {
    title: "Veille réglementaire",
    description: "Sanctions, douanes, contraintes pays et signaux utiles.",
    to: "/app/centre-veille/reglementation",
    icon: BellRing,
    cta: "Voir la veille",
  },
  {
    title: "Guides pratiques",
    description: "Incoterms, documents, TVA/taxes import, risques & bonnes pratiques.",
    to: "/guides/incoterms-ddp",
    icon: BookOpen,
    cta: "Parcourir les guides",
  },
];

export default fun
