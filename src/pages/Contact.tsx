import * as React from "react";
import { useLocation } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const offerLabels: Record<string, string> = {
  express: "Validation express",
  pricing: "Offre tarifaire",
  audit: "Audit complet",
};

export default function Contact() {
  const location = useLocation();
  const { toast } = useToast();

  const params = new URLSearchParams(location.search);
  const offerParam = params.get("offer") || "audit";
  const offerType = offerLabels[offerParam] ? offerParam : "audit";

  const [company, setCompany] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const submit = async () => {
    if (!email.trim()) {
      toast({ title: "Email requis", description: "Merci de renseigner un email de contact." });
      return;
    }
    try {
      setSending(true);
      await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          offer_type: offerType,
          message,
          context: { company },
        }),
      });
      toast({ title: "Demande envoyee", description: "Nous revenons vers vous rapidement." });
      setMessage("");
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.message || "Impossible d'envoyer la demande." });
    } finally {
      setSending(false);
    }
  };

  return (
    <PublicLayout>
      <div className="space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-blue-700">Contact</p>
          <h1 className="text-4xl font-semibold text-slate-900">Parlons de votre projet export.</h1>
          <p className="text-lg text-slate-600">
            Offre selectionnee: <span className="font-semibold">{offerLabels[offerType]}</span>.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 max-w-2xl">
          <div className="space-y-2">
            <Label>Entreprise</Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nom de l'entreprise" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Besoin, pays, HS, urgence..." />
          </div>
          <Button onClick={submit} disabled={sending}>
            {sending ? "Envoi..." : "Envoyer la demande"}
          </Button>
        </div>
      </div>
    </PublicLayout>
  );
}
