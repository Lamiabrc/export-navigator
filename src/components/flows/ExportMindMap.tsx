import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Truck, Ship, Plane, FileText, Euro, Receipt, 
  ZoomIn, ZoomOut, RotateCcw, Info, MapPin
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LayerNode {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  documents: string[];
  taxes: string[];
  description: string;
}

interface DestinationNode {
  id: string;
  name: string;
  zone: 'UE' | 'Hors UE' | 'DROM';
  angle: number;
  layers: {
    transport: { active: boolean; cost: string };
    customs: { active: boolean; taxes: string[] };
    tva: { active: boolean; rate: string };
  };
}

const destinations: DestinationNode[] = [
  {
    id: 'martinique',
    name: 'Martinique',
    zone: 'DROM',
    angle: -60,
    layers: {
      transport: { active: true, cost: 'Maritime 4-7%' },
      customs: { active: true, taxes: ['OM 0-60%', 'OMR 0-2.5%'] },
      tva: { active: true, rate: '8.5%' }
    }
  },
  {
    id: 'guadeloupe',
    name: 'Guadeloupe',
    zone: 'DROM',
    angle: -30,
    layers: {
      transport: { active: true, cost: 'Maritime 4-7%' },
      customs: { active: true, taxes: ['OM 0-60%', 'OMR 0-2.5%'] },
      tva: { active: true, rate: '8.5%' }
    }
  },
  {
    id: 'reunion',
    name: 'Réunion',
    zone: 'DROM',
    angle: 0,
    layers: {
      transport: { active: true, cost: 'Maritime 5-8%' },
      customs: { active: true, taxes: ['OM 0-60%', 'OMR 0-2.5%'] },
      tva: { active: true, rate: '8.5%' }
    }
  },
  {
    id: 'guyane',
    name: 'Guyane',
    zone: 'DROM',
    angle: 30,
    layers: {
      transport: { active: true, cost: 'Maritime/Aérien' },
      customs: { active: true, taxes: ['OM 0-60%'] },
      tva: { active: false, rate: '0%' }
    }
  },
  {
    id: 'belgique',
    name: 'Belgique',
    zone: 'UE',
    angle: 60,
    layers: {
      transport: { active: true, cost: 'Routier 2-3%' },
      customs: { active: false, taxes: [] },
      tva: { active: true, rate: 'Autoliquidation' }
    }
  },
  {
    id: 'suisse',
    name: 'Suisse',
    zone: 'Hors UE',
    angle: 90,
    layers: {
      transport: { active: true, cost: 'Routier 2-4%' },
      customs: { active: true, taxes: ['Droits 0-5%', 'EUR.1'] },
      tva: { active: true, rate: '8.1%' }
    }
  },
  {
    id: 'espagne',
    name: 'Espagne',
    zone: 'UE',
    angle: 120,
    layers: {
      transport: { active: true, cost: 'Routier 3-4%' },
      customs: { active: false, taxes: [] },
      tva: { active: true, rate: 'Autoliquidation' }
    }
  },
  {
    id: 'maroc',
    name: 'Maroc',
    zone: 'Hors UE',
    angle: 150,
    layers: {
      transport: { active: true, cost: 'Maritime/Routier' },
      customs: { active: true, taxes: ['Droits 0-40%'] },
      tva: { active: true, rate: '20%' }
    }
  }
];

const layerInfo: LayerNode[] = [
  {
    id: 'transport',
    label: 'Transport & Frais',
    icon: <Truck className="h-5 w-5" />,
    color: 'hsl(var(--chart-1))',
    documents: ['CMR/BL/AWB', 'Packing List', 'Facture commerciale'],
    taxes: ['Fret', 'Surcharge carburant', 'Manutention'],
    description: 'Coûts d\'acheminement de la marchandise'
  },
  {
    id: 'customs',
    label: 'Douanes & Taxes DDP',
    icon: <Receipt className="h-5 w-5" />,
    color: 'hsl(var(--chart-2))',
    documents: ['DAU', 'EUR.1/FORM A', 'Certificat origine'],
    taxes: ['Droits de douane', 'Octroi de Mer', 'OMR'],
    description: 'Taxes non récupérables à l\'import'
  },
  {
    id: 'tva',
    label: 'TVA Import',
    icon: <Euro className="h-5 w-5" />,
    color: 'hsl(var(--chart-3))',
    documents: ['Facture TVA', 'Déclaration import'],
    taxes: ['TVA import 2.1-20%', 'TVA DROM 8.5%'],
    description: 'TVA récupérable (sauf exceptions)'
  }
];

const zoneColors = {
  'UE': 'badge-ue',
  'Hors UE': 'badge-hors-ue',
  'DROM': 'badge-drom'
};

export function ExportMindMap() {
  const [zoom, setZoom] = useState(1);
  const [selectedDest, setSelectedDest] = useState<DestinationNode | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);

  const handleZoomIn = useCallback(() => setZoom(z => Math.min(z + 0.2, 2)), []);
  const handleZoomOut = useCallback(() => setZoom(z => Math.max(z - 0.2, 0.5)), []);
  const handleReset = useCallback(() => {
    setZoom(1);
    setSelectedDest(null);
    setSelectedLayer(null);
  }, []);

  const getDestPosition = (angle: number, radius: number) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: Math.cos(rad) * radius,
      y: Math.sin(rad) * radius
    };
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Layer Legend */}
        <div className="flex gap-4">
          {layerInfo.map(layer => (
            <button
              key={layer.id}
              onClick={() => setSelectedLayer(selectedLayer === layer.id ? null : layer.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all",
                selectedLayer === layer.id 
                  ? "ring-2 ring-offset-2 ring-primary" 
                  : "hover:opacity-80"
              )}
              style={{ 
                backgroundColor: `${layer.color}20`,
                color: layer.color
              }}
            >
              {layer.icon}
              <span className="hidden sm:inline">{layer.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mind Map Container */}
      <div className="relative bg-muted/30 rounded-xl border overflow-hidden" style={{ height: '500px' }}>
        <div 
          className="absolute inset-0 flex items-center justify-center transition-transform duration-300"
          style={{ transform: `scale(${zoom})` }}
        >
          {/* Concentric circles for layers */}
          <svg className="absolute inset-0 w-full h-full" viewBox="-300 -250 600 500">
            {/* Layer rings */}
            <circle cx="0" cy="0" r="80" fill="none" stroke="hsl(var(--chart-1))" strokeWidth="2" strokeDasharray="4 4" opacity="0.3" />
            <circle cx="0" cy="0" r="130" fill="none" stroke="hsl(var(--chart-2))" strokeWidth="2" strokeDasharray="4 4" opacity="0.3" />
            <circle cx="0" cy="0" r="180" fill="none" stroke="hsl(var(--chart-3))" strokeWidth="2" strokeDasharray="4 4" opacity="0.3" />
            
            {/* Connection lines to destinations */}
            {destinations.map(dest => {
              const pos = getDestPosition(dest.angle, 220);
              return (
                <line 
                  key={dest.id}
                  x1="0" y1="0" 
                  x2={pos.x} y2={pos.y}
                  stroke="hsl(var(--border))"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
              );
            })}
          </svg>

          {/* France Center */}
          <div 
            className="absolute z-10 flex flex-col items-center justify-center w-24 h-24 rounded-full bg-primary text-primary-foreground shadow-lg cursor-pointer hover:scale-110 transition-transform"
            style={{ transform: 'translate(-50%, -50%)', left: '50%', top: '50%' }}
          >
            <MapPin className="h-6 w-6 mb-1" />
            <span className="text-sm font-bold">FRANCE</span>
            <span className="text-xs opacity-80">ORLIMAN</span>
          </div>

          {/* Layer labels on rings */}
          {layerInfo.map((layer, i) => {
            const radius = 80 + i * 50;
            return (
              <div
                key={layer.id}
                className="absolute text-xs font-medium px-2 py-0.5 rounded-full"
                style={{
                  left: `calc(50% + ${radius}px)`,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  backgroundColor: `${layer.color}20`,
                  color: layer.color
                }}
              >
                {layer.label}
              </div>
            );
          })}

          {/* Destination nodes */}
          {destinations.map(dest => {
            const pos = getDestPosition(dest.angle, 220);
            const isSelected = selectedDest?.id === dest.id;
            
            return (
              <button
                key={dest.id}
                onClick={() => setSelectedDest(isSelected ? null : dest)}
                className={cn(
                  "absolute flex flex-col items-center p-2 rounded-lg transition-all hover:scale-110",
                  isSelected ? "bg-card shadow-lg ring-2 ring-primary" : "bg-card/80 hover:bg-card shadow"
                )}
                style={{
                  left: `calc(50% + ${pos.x}px)`,
                  top: `calc(50% + ${pos.y}px)`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <span className="text-sm font-semibold">{dest.name}</span>
                <Badge variant="outline" className={cn("text-xs mt-1", zoneColors[dest.zone])}>
                  {dest.zone}
                </Badge>
                
                {/* Layer indicators */}
                <div className="flex gap-1 mt-1">
                  {dest.layers.transport.active && (
                    <div 
                      className={cn(
                        "w-2 h-2 rounded-full",
                        selectedLayer === 'transport' ? "ring-2 ring-offset-1" : ""
                      )}
                      style={{ backgroundColor: layerInfo[0].color }}
                    />
                  )}
                  {dest.layers.customs.active && (
                    <div 
                      className={cn(
                        "w-2 h-2 rounded-full",
                        selectedLayer === 'customs' ? "ring-2 ring-offset-1" : ""
                      )}
                      style={{ backgroundColor: layerInfo[1].color }}
                    />
                  )}
                  {dest.layers.tva.active && (
                    <div 
                      className={cn(
                        "w-2 h-2 rounded-full",
                        selectedLayer === 'tva' ? "ring-2 ring-offset-1" : ""
                      )}
                      style={{ backgroundColor: layerInfo[2].color }}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Details Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Selected destination details */}
        {selectedDest && (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{selectedDest.name}</CardTitle>
                <Badge className={zoneColors[selectedDest.zone]}>{selectedDest.zone}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {/* Transport */}
                <div className={cn(
                  "p-3 rounded-lg border",
                  selectedDest.layers.transport.active ? "bg-[hsl(var(--chart-1)/0.1)] border-[hsl(var(--chart-1)/0.3)]" : "bg-muted/30 opacity-50"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <Truck className="h-4 w-4" style={{ color: 'hsl(var(--chart-1))' }} />
                    <span className="font-medium text-sm">Transport</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedDest.layers.transport.active ? selectedDest.layers.transport.cost : 'N/A'}
                  </p>
                </div>

                {/* Customs */}
                <div className={cn(
                  "p-3 rounded-lg border",
                  selectedDest.layers.customs.active ? "bg-[hsl(var(--chart-2)/0.1)] border-[hsl(var(--chart-2)/0.3)]" : "bg-muted/30 opacity-50"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <Receipt className="h-4 w-4" style={{ color: 'hsl(var(--chart-2))' }} />
                    <span className="font-medium text-sm">Douanes</span>
                  </div>
                  {selectedDest.layers.customs.active ? (
                    <div className="space-y-1">
                      {selectedDest.layers.customs.taxes.map((tax, i) => (
                        <p key={i} className="text-xs text-muted-foreground">{tax}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Pas de douane (UE)</p>
                  )}
                </div>

                {/* TVA */}
                <div className={cn(
                  "p-3 rounded-lg border",
                  selectedDest.layers.tva.active ? "bg-[hsl(var(--chart-3)/0.1)] border-[hsl(var(--chart-3)/0.3)]" : "bg-muted/30 opacity-50"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <Euro className="h-4 w-4" style={{ color: 'hsl(var(--chart-3))' }} />
                    <span className="font-medium text-sm">TVA</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedDest.layers.tva.active ? selectedDest.layers.tva.rate : 'Pas de TVA'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Layer info panel */}
        {selectedLayer && (
          <Card className={selectedDest ? "" : "lg:col-span-3"}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                {layerInfo.find(l => l.id === selectedLayer)?.icon}
                {layerInfo.find(l => l.id === selectedLayer)?.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {layerInfo.find(l => l.id === selectedLayer)?.description}
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Documents requis
                  </h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {layerInfo.find(l => l.id === selectedLayer)?.documents.map((doc, i) => (
                      <li key={i}>• {doc}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Euro className="h-4 w-4" /> Taxes applicables
                  </h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {layerInfo.find(l => l.id === selectedLayer)?.taxes.map((tax, i) => (
                      <li key={i}>• {tax}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!selectedDest && !selectedLayer && (
          <Card className="lg:col-span-3">
            <CardContent className="flex items-center justify-center py-8">
              <div className="text-center text-muted-foreground">
                <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Cliquez sur une destination ou une couche pour voir les détails</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
