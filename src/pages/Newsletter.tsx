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
          <p className="text-sm text-muted-foreground">Newsletter export</p>
          <h1 className="text-3xl font-semibold">Veille export hebdo + brief marche</h1>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Alerte export hebdo</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Sanctions, evolution docs, taxes et contrÃ´les par pays/HS.</p>
              <p>Resume actionnable, 5 minutes de lecture.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Brief mensuel marche</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Tendances export France, top destinations, signaux concurrentiels.</p>
              <p>Focus sur vos pays et HS prioritaire.</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border border-slate-200">
          <CardHeader>
            <CardTitle>Recevoir la newsletter</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email professionnel" />
            <Button onClick={subscribe}>S'inscrire</Button>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-slate-50">
          <CardHeader>
            <CardTitle>Sources officielles utilisees</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>OFAC Sanctions List Service • ONU Consolidated List • EU Sanctions Map</p>
            <p>WITS / UNCTAD TRAINS (tarifs douaniers)</p>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
