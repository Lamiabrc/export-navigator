import { MainLayout } from "@/components/layout/MainLayout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PageHeader } from "@/components/PageHeader";

const sections = [
  {
    id: "lpp",
    title: "Remboursement & LPP",
    content: "Placeholder : liste des references, modalites DROM, validations CPAM.",
  },
  {
    id: "coeff",
    title: "Coefficients Outre-mer",
    content: "Placeholder : calculs OM / OMR, seuils, exemples a completer.",
  },
  {
    id: "logistics",
    title: "Schemas logistiques",
    content: "Placeholder : maritime/aerien, lead time, points de controle.",
  },
  {
    id: "invoice",
    title: "Mentions facture & preuves",
    content: "Placeholder : mentions obligatoires, pieces justificatives.",
  },
];

export default function DromPlaybook() {
  return (
    <MainLayout>
      <PageHeader
        title="DROM Playbook"
        subtitle="Checklists operationnelles DROM (structure a completer)."
      />

      <div className="rounded-2xl border border-border bg-card p-4 mt-4 dark:border-white/10 dark:bg-white/5">
        <Accordion type="single" collapsible className="space-y-2">
          {sections.map((section) => (
            <AccordionItem
              key={section.id}
              value={section.id}
              className="border-border dark:border-white/10 rounded-xl overflow-hidden"
            >
              <AccordionTrigger className="px-4 py-3 text-left">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">{section.title}</span>
                  <span className="text-[11px] rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2 py-1 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-400/30">
                    A completer
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-2 text-sm text-muted-foreground space-y-3 bg-muted/30 border-t border-border dark:bg-white/5 dark:border-white/10">
                <p>{section.content}</p>
                <div className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground dark:border-white/10 dark:bg-white/5">
                  Sources / liens (a renseigner)
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </MainLayout>
  );
}
