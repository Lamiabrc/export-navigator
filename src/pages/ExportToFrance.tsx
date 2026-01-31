import { Link } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";

const complianceSections = [
  {
    title: "Duties & VAT",
    description:
      "France shares the EU customs code, which means import duties follow the common external tariff. VAT is assessed on the CIF value and can be deferred through monthly declarations once the importer is registered.",
    items: [
      "Declare customs value, origin and tariff code (CN/HS) for every shipment.",
      "Pay duties at the border or use a bonded warehouse to delay payment.",
      "Register for TVA intracommunity reporting and choose the right VAT regime for your services or goods.",
    ],
  },
  {
    title: "Required documents",
    description:
      "French customs expect a consistent dossier. Digital filings (DELTA/Electronic Transit) are standard and the border authorities verify supporting paperwork.",
    items: [
      "Commercial invoice with buyer, seller and payment terms.",
      "Packing list + transport document (CMR, AWB, B/L).",
      "Certificates of origin, EUR.1 or ATR when preferential tariff applies.",
      "Import licenses or health certificates for regulated goods (food, pharma, chemicals).",
    ],
  },
  {
    title: "Sanctions & restricted goods",
    description:
      "France enforces EU sanctions lists and maintains extra controls on dual-use items, defense products and tech. Screening importers/customers prevents costly blocks.",
    items: [
      "Cross-check with EU, OFAC and French sanctions registers before shipping.",
      "Classify sensitive goods under the dual-use or strategic export regime and secure authorization.",
      "Document the chain of custody in case customs or police ask for explanations.",
    ],
  },
  {
    title: "HS classification & controls",
    description:
      "Correct CN/HS codes unlock accurate duties, safeguards and quotas. France runs targeted controls on high-risk sectors such as electronics, cosmetics and machinery.",
    items: [
      "Use the TARIC database to confirm CN code, duties and any anti-dumping measures.",
      "Document technical sheets, material composition and use-case at the border.",
      "Prepare for selective controls or physical inspections with full traceability.",
    ],
  },
];

export default function ExportToFrance() {
  return (
    <PublicLayout>
      <div className="space-y-10">
        <section className="rounded-3xl border border-border bg-white/80 p-8 shadow-sm shadow-foreground/10">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Export to France</p>
            <h1 className="text-4xl font-semibold text-foreground">Export to France — Sell compliantly</h1>
            <p className="text-base text-foreground/80">
              France is a gateway to the EU single market. Getting compliance right at entry
              prevents delays, fines and blocked shipments. We prepare the duties, VAT,
              documentation and risk checks so you can focus on your customers.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <Link to="/contact?offer=audit&direction=to-france">Request an audit</Link>
            </Button>
            <Button asChild variant="outline" className="border-border text-foreground hover:border-primary hover:text-primary">
              <Link to="/contact?offer=express&direction=to-france">Express validation</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          {complianceSections.map((section) => (
            <article key={section.title} className="rounded-2xl border border-border bg-card/70 p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-foreground">{section.title}</h2>
              <p className="mt-2 text-sm text-foreground/70">{section.description}</p>
              <ul className="mt-4 space-y-2 text-sm text-foreground/80">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      </div>
    </PublicLayout>
  );
}
