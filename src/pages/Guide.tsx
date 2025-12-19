import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { destinationProfiles } from '@/data/mockData';
import type { Destination, DestinationProfile } from '@/types';
import { 
  MapPin, 
  FileCheck, 
  AlertTriangle, 
  Lightbulb, 
  Info,
  CheckCircle,
  XCircle,
} from 'lucide-react';

const destinations: Destination[] = [
  'Guadeloupe', 'Martinique', 'Guyane', 'Reunion', 'Mayotte',
  'Belgique', 'Espagne', 'Luxembourg', 'Suisse'
];

export default function Guide() {
  const [selectedDestination, setSelectedDestination] = useState<Destination>('Reunion');
  
  const profile = destinationProfiles.find(p => p.destination === selectedDestination);

  if (!profile) return null;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Guide Destinations</h1>
            <p className="mt-1 text-muted-foreground">Référentiel des bonnes pratiques par destination</p>
          </div>
          <Select value={selectedDestination} onValueChange={(v) => setSelectedDestination(v as Destination)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {destinations.map(dest => (
                <SelectItem key={dest} value={dest}>{dest}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Destination Card */}
        <div className="bg-card rounded-xl border p-6 animate-fade-in">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
              <MapPin className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-foreground">{profile.destination}</h2>
                <StatusBadge status={profile.zone} type="zone" />
              </div>
              <p className="mt-1 text-muted-foreground">
                Zone {profile.zone} - {profile.zone === 'DROM' ? 'Département et Région d\'Outre-Mer' : 
                  profile.zone === 'UE' ? 'Union Européenne' : 'Pays tiers'}
              </p>
            </div>
          </div>
        </div>

        {/* Grid of Info Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* TVA */}
          <div className="bg-card rounded-xl border p-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-1/10">
                <Info className="h-5 w-5 text-chart-1" />
              </div>
              <h3 className="font-semibold text-foreground">TVA</h3>
            </div>
            <div className="flex items-center gap-2 mb-3">
              {profile.tva_applicable ? (
                <CheckCircle className="h-5 w-5 text-status-ok" />
              ) : (
                <XCircle className="h-5 w-5 text-status-risk" />
              )}
              <span className="font-medium">
                {profile.tva_applicable ? 'Applicable' : 'Non applicable'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{profile.tva_notes}</p>
          </div>

          {/* Octroi de Mer */}
          <div className="bg-card rounded-xl border p-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10">
                <Info className="h-5 w-5 text-chart-4" />
              </div>
              <h3 className="font-semibold text-foreground">Octroi de Mer (OM/OMR)</h3>
            </div>
            <div className="flex items-center gap-2 mb-3">
              {profile.om_applicable ? (
                <CheckCircle className="h-5 w-5 text-status-warning" />
              ) : (
                <XCircle className="h-5 w-5 text-muted-foreground" />
              )}
              <span className="font-medium">
                {profile.om_applicable ? 'Applicable' : 'Non applicable'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {profile.om_notes || 'Pas d\'octroi de mer pour cette destination.'}
            </p>
          </div>

          {/* Documents Requis */}
          <div className="bg-card rounded-xl border p-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10">
                <FileCheck className="h-5 w-5 text-chart-2" />
              </div>
              <h3 className="font-semibold text-foreground">Documents requis</h3>
            </div>
            <ul className="space-y-2">
              {profile.documents_required.map((doc, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="text-foreground">{doc}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Risques Courants */}
          <div className="bg-card rounded-xl border p-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-warning/10">
                <AlertTriangle className="h-5 w-5 text-status-warning" />
              </div>
              <h3 className="font-semibold text-foreground">Risques courants</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {profile.common_risks}
            </p>
          </div>
        </div>

        {/* Best Practices */}
        <div className="bg-card rounded-xl border p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10">
              <Lightbulb className="h-5 w-5 text-chart-2" />
            </div>
            <h3 className="font-semibold text-foreground">Bonnes pratiques</h3>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            {profile.best_practices}
          </p>
        </div>

        {/* Quick Navigation */}
        <div className="bg-muted/50 rounded-xl p-6">
          <h3 className="font-semibold text-foreground mb-4">Destinations par zone</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Union Européenne</p>
              <div className="flex flex-wrap gap-2">
                {destinations.filter(d => 
                  destinationProfiles.find(p => p.destination === d)?.zone === 'UE'
                ).map(dest => (
                  <Button
                    key={dest}
                    variant={selectedDestination === dest ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedDestination(dest)}
                  >
                    {dest}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">DROM</p>
              <div className="flex flex-wrap gap-2">
                {destinations.filter(d => 
                  destinationProfiles.find(p => p.destination === d)?.zone === 'DROM'
                ).map(dest => (
                  <Button
                    key={dest}
                    variant={selectedDestination === dest ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedDestination(dest)}
                  >
                    {dest}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Hors UE</p>
              <div className="flex flex-wrap gap-2">
                {destinations.filter(d => 
                  destinationProfiles.find(p => p.destination === d)?.zone === 'Hors UE'
                ).map(dest => (
                  <Button
                    key={dest}
                    variant={selectedDestination === dest ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedDestination(dest)}
                  >
                    {dest}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
