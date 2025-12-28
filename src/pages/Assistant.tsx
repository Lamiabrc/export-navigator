import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Bot, Send } from "lucide-react";

export default function Assistant() {
  const [message, setMessage] = useState("");

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">IA Export (Edge Function)</p>
            <h1 className="text-2xl font-bold">Assistant DROM / UE / Hors UE</h1>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Conversation
            </CardTitle>
            <CardDescription>
              À connecter à la fonction edge <code>export-assistant</code> (message + contexte client/destination/HS/incoterm).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex: Propose un HS code pour une attelle de cheville livrée en Guadeloupe (DAP, aérien)."
              className="min-h-[120px]"
            />
            <Button className="gap-2" disabled>
              <Send className="h-4 w-4" />
              Envoyer (connexion edge à faire)
            </Button>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
