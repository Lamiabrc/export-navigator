import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import * as React from "react";

export default function Newsletter() {
  const { toast } = useToast();
  const [email, setEmail] = React.useState("");

  const subscribe = () => {
    if (!email.trim()) {
      toast({ title: "Email requis", description: "Ajoute un email pour recevoir la veille." });
      return;
    }
    toast({ title: "Inscription enregistree", description: "La veille sera envoyee des l'activation." });
  };

  return (
    <PublicLayout>
      <div className="space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-blue-200">Newsletter export</p>
          <h1 className="text-3xl font-semibold text-white">Veille export hebdo + brief marche</h1>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border border-white/15 bg-white/10 text-white shadow-lg backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white">Alerte export hebdo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-200">
              <p>Sanctions, evolution docs, taxes et controles par pays/HS.</p>
              <p>Resume actionnable, 5 minutes de lecture.</p>
            </CardContent>
          </Card>
          <Card className="border border-white/15 bg-white/10 text-white shadow-lg backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white">Brief mensuel marche</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-200">
              <p>Tendances export France, top destinations, signaux concurrentiels.</p>
              <p>Focus sur vos pays et HS prioritaire.</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border border-white/15 bg-white/10 text-white shadow-lg backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">Recevoir la newsletter</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email professionnel"
              className="border-white/20 bg-white/90 text-slate-900 placeholder:text-slate-500"
            />
            <Button onClick={subscribe}>S'inscrire</Button>
          </CardContent>
        </Card>

        <Card className="border border-white/15 bg-white/10 text-white shadow-lg backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">Sources officielles utilisees</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-200">
            <p>OFAC Sanctions List Service - ONU Consolidated List - EU Sanctions Map</p>
            <p>WITS / UNCTAD TRAINS (tarifs douaniers)</p>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
