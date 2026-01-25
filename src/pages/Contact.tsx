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
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          offer_type: offerType,
          message,
          context: { company },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || data?.mailWarning || "Impossible d'envoyer la demande.");
      }
      if (data?.mailWarning) {
        toast({
          title: "Envoi partiel",
          description: "Demande enregistree, mais l'envoi email n'est pas configure.",
        });
      } else {
        toast({ title: "Demande envoyee", description: "Nous revenons vers vous rapidement." });
      }
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
          <p className="text-xs uppercase tracking-[0.35em] text-blue-200">Contact</p>
          <h1 className="text-4xl font-semibold text-white">Parlons de votre projet export.</h1>
          <p className="text-lg text-slate-200">
            Offre selectionnee: <span className="font-semibold text-white">{offerLabels[offerType]}</span>.
          </p>
        </div>

        <div className="rounded-2xl border border-white/15 bg-white/10 p-6 shadow-lg backdrop-blur space-y-4 max-w-2xl">
          <div className="space-y-2">
            <Label className="text-slate-200">Entreprise</Label>
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Nom de l'entreprise"
              className="border-white/20 bg-white/90 text-slate-900 placeholder:text-slate-500"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-200">Email</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              className="border-white/20 bg-white/90 text-slate-900 placeholder:text-slate-500"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-200">Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Besoin, pays, HS, urgence..."
              className="border-white/20 bg-white/90 text-slate-900 placeholder:text-slate-500"
            />
          </div>
          <Button onClick={submit} disabled={sending}>
            {sending ? "Envoi..." : "Envoyer la demande"}
          </Button>
        </div>
      </div>
    </PublicLayout>
  );
}
