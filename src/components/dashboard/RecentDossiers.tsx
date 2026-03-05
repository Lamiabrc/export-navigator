import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type RecentDossiersProps = {
  isEn: boolean;
};

type DossierRow = {
  title: string;
  destination: string;
  value: string;
  status: "in_progress" | "confirmed";
};

const DOSSIERS: DossierRow[] = [
  { title: "Export machines Canada", destination: "Canada", value: "75 000€", status: "in_progress" },
  { title: "Export agroalimentaire UK", destination: "Royaume-Uni", value: "50 000€", status: "in_progress" },
  { title: "Export composants Brésil", destination: "Brésil", value: "120 000$", status: "confirmed" },
];

function statusLabel(status: DossierRow["status"], isEn: boolean) {
  if (status === "confirmed") return isEn ? "Confirmed" : "Confirmé";
  return isEn ? "In progress" : "En cours";
}

function statusClass(status: DossierRow["status"]) {
  return status === "confirmed"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-blue-50 text-blue-700 border-blue-200";
}

export function RecentDossiers({ isEn }: RecentDossiersProps) {
  const copy = isEn
    ? {
        title: "My Latest Export Files",
        colTitle: "Title",
        colDestination: "Destination",
        colValue: "Value",
        colStatus: "Status",
        cta: "View all files",
      }
    : {
        title: "Mes derniers dossiers",
        colTitle: "Titre",
        colDestination: "Destination",
        colValue: "Valeur",
        colStatus: "Statut",
        cta: "Voir tous les dossiers",
      };

  return (
    <section>
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-lg text-slate-900">{copy.title}</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/dossiers">{copy.cta}</Link>
          </Button>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="py-2 font-medium">{copy.colTitle}</th>
                  <th className="py-2 font-medium">{copy.colDestination}</th>
                  <th className="py-2 font-medium">{copy.colValue}</th>
                  <th className="py-2 font-medium">{copy.colStatus}</th>
                </tr>
              </thead>
              <tbody>
                {DOSSIERS.map((row) => (
                  <tr key={row.title} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-3 text-slate-900">{row.title}</td>
                    <td className="py-3 text-slate-700">{row.destination}</td>
                    <td className="py-3 text-slate-700">{row.value}</td>
                    <td className="py-3">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${statusClass(row.status)}`}>
                        {statusLabel(row.status, isEn)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
