import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Sales() {
  return (
    <AppLayout contentClassName="md:p-6">
      <Card className="border-blue-100 bg-white/95 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Espace Sales & Operations</CardTitle>
          <CardDescription>
            Cet espace sera bientôt enrichi avec votre pipeline commercial, les opportunités par marché et le suivi des
            actions terrain.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/app/control-tower">Retour à la tour de contrôle</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/app/simulator">Ouvrir le simulateur</Link>
          </Button>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
