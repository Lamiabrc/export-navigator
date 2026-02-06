import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

type FooterLink = {
  label: string;
  to: string;
};

type FooterProps = {
  brand: {
    title: string;
    description?: string;
  };
  contact: {
    email: string;
    phone: string;
    phoneRaw: string;
  };
  links: FooterLink[];
  legalLinks: FooterLink[];
  className?: string;
};

export function Footer({ brand, contact, links, legalLinks, className }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className={cn("border-t border-slate-200 bg-white", className)}>
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">{brand.title}</div>
            {brand.description && <p className="mt-3 text-sm text-slate-600">{brand.description}</p>}
            <div className="mt-6 flex flex-col gap-2 text-sm text-slate-600">
              <a
                href={`mailto:${contact.email}`}
                className="underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-400"
              >
                {contact.email}
              </a>
              <a
                href={`tel:${contact.phoneRaw}`}
                className="underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-400"
              >
                {contact.phone}
              </a>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Navigation</div>
            <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-400"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Legal</div>
            <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600">
              {legalLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-400"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-slate-200 pt-6 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
          <span>© {year} MPL Export Navigator. Tous droits reserves.</span>
          <span>Veille personnalisee dans l'outil = reservee VIP.</span>
        </div>
      </div>
    </footer>
  );
}
