import { Link } from "react-router-dom";
import { Mail, Phone } from "lucide-react";

import { useI18n } from "@/contexts/LanguageContext";
import { footerNav } from "@/config/navigation";

type FooterProps = {
  className?: string;
};

export function MarketingFooter({ className = "" }: FooterProps) {
  const { lang } = useI18n();
  const isFr = lang === "fr";

  const navLinks = footerNav.filter((item) => !item.legal);
  const legalLinks = footerNav.filter((item) => item.legal);

  const socialLinks = [
    {
      label: "Facebook",
      href: "https://www.facebook.com/profile.php?id=61587254986176",
      icon: "/facebook.svg",
    },
    {
      label: "YouTube",
      href: "https://www.youtube.com/channel/UCxRRjAnotPJahv9SzaPJsAw",
      icon: "/youtube.svg",
    },
    {
      label: "LinkedIn",
      href: "https://www.linkedin.com/company/mpl-conseil-export/?viewAsMember=true",
      icon: "/linkedin.svg",
    },
  ];

  return (
    <footer className={`border-t border-[hsl(var(--mkt-blue-100))] bg-white ${className}`}>
      <div className="mkt-container py-16">
        <div className="grid gap-12 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link to="/" className="inline-block">
              <h3 className="mkt-display text-xl font-semibold text-[hsl(var(--mkt-ink))]">
                MPL Export Navigator
              </h3>
            </Link>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-[hsl(var(--mkt-ink-muted))]">
              {isFr
                ? "Cockpit export pour PME. Couts rendus, documents, risques et veille reglementaire dans un outil unifie."
                : "Export cockpit for SMEs. Landed cost, documents, risks, and regulatory watch in a unified tool."}
            </p>

            <div className="mt-6 space-y-3">
              <a
                href="mailto:contact@exportfrancefacile.com"
                className="flex items-center gap-3 text-sm text-[hsl(var(--mkt-ink-muted))] transition hover:text-[hsl(var(--mkt-ink))]"
              >
                <Mail className="h-4 w-4" />
                contact@exportfrancefacile.com
              </a>
              <a
                href="tel:+33676435551"
                className="flex items-center gap-3 text-sm text-[hsl(var(--mkt-ink-muted))] transition hover:text-[hsl(var(--mkt-ink))]"
              >
                <Phone className="h-4 w-4" />
                06 76 43 55 51
              </a>
            </div>
          </div>

          <div>
            <h4 className="mkt-label mb-4">{isFr ? "Navigation" : "Navigation"}</h4>
            <ul className="space-y-2">
              {navLinks.map((link) => (
                <li key={link.id}>
                  <Link
                    to={link.to}
                    className="text-sm text-[hsl(var(--mkt-ink-muted))] transition hover:text-[hsl(var(--mkt-ink))]"
                  >
                    {link.labels[lang]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mkt-label mb-4">{isFr ? "Legal" : "Legal"}</h4>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.id}>
                  <Link
                    to={link.to}
                    className="text-sm text-[hsl(var(--mkt-ink-muted))] transition hover:text-[hsl(var(--mkt-ink))]"
                  >
                    {link.labels[lang]}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <h4 className="mkt-label mb-4">{isFr ? "Reseaux" : "Social"}</h4>
              <ul className="space-y-2">
                {socialLinks.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-3 text-sm text-[hsl(var(--mkt-ink-muted))] transition hover:text-[hsl(var(--mkt-ink))]"
                    >
                      <img src={link.icon} alt={link.label} className="h-4 w-4" />
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[hsl(var(--mkt-blue-100))]">
        <div className="mkt-container flex flex-col items-center justify-between gap-4 py-6 sm:flex-row">
          <p className="text-xs text-[hsl(var(--mkt-ink-muted))]">
            © {new Date().getFullYear()} MPL Export Conseil. {isFr ? "Tous droits reserves." : "All rights reserved."}
          </p>
          <p className="text-xs text-[hsl(var(--mkt-ink-muted))]">
            {isFr
              ? "Cet outil aide a structurer vos decisions export. Il ne remplace pas un conseil reglementaire."
              : "This tool helps structure your export decisions. It does not replace regulatory advice."}
          </p>
        </div>
      </div>
    </footer>
  );
}
