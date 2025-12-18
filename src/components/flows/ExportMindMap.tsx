import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { 
  Truck, Ship, Plane, FileText, Euro, Receipt, 
  ZoomIn, ZoomOut, RotateCcw, Plus, Trash2, Edit2,
  MapPin, Layers, Settings2, Save, X, Building2, Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Types
export interface CostLayer {
  id: string;
  label: string;
  color: string;
  icon: 'truck' | 'receipt' | 'euro' | 'building' | 'users';
  description: string;
  isCustom: boolean;
}

export interface DestinationCost {
  layerId: string;
  value: number;
  rate?: string;
  payerType: 'obligatoire' | 'ddp_client' | 'na';
  notes?: string;
}

export interface DestinationNode {
  id: string;
  name: string;
  zone: 'UE' | 'Hors UE' | 'DROM';
  angle: number;
  costs: DestinationCost[];
  isCustom: boolean;
}

// Default layers
const defaultLayers: CostLayer[] = [
  {
    id: 'transport',
    label: 'Transport & Frais',
    color: 'hsl(217, 91%, 50%)',
    icon: 'truck',
    description: 'Fret, manutention, assurance',
    isCustom: false
  },
  {
    id: 'douane_obligatoire',
    label: 'Douane Obligatoire',
    color: 'hsl(280, 67%, 50%)',
    icon: 'building',
    description: 'Droits import/export que NOUS payons (obligatoire)',
    isCustom: false
  },
  {
    id: 'douane_ddp',
    label: 'Douane DDP Client',
    color: 'hsl(25, 95%, 53%)',
    icon: 'users',
    description: 'Droits/taxes payés POUR le client (DDP)',
    isCustom: false
  },
  {
    id: 'tva',
    label: 'TVA Import',
    color: 'hsl(142, 71%, 45%)',
    icon: 'euro',
    description: 'TVA récupérable ou autoliquidée',
    isCustom: false
  }
];

// Default destinations
const defaultDestinations: DestinationNode[] = [
  {
    id: 'martinique',
    name: 'Martinique',
    zone: 'DROM',
    angle: -60,
    isCustom: false,
    costs: [
      { layerId: 'transport', value: 5, rate: '4-7%', payerType: 'obligatoire' },
      { layerId: 'douane_obligatoire', value: 0, payerType: 'na', notes: 'Pas de droits export' },
      { layerId: 'douane_ddp', value: 45, rate: 'OM 0-60%', payerType: 'ddp_client' },
      { layerId: 'tva', value: 8.5, rate: '8.5%', payerType: 'ddp_client' }
    ]
  },
  {
    id: 'guadeloupe',
    name: 'Guadeloupe',
    zone: 'DROM',
    angle: -30,
    isCustom: false,
    costs: [
      { layerId: 'transport', value: 5, rate: '4-7%', payerType: 'obligatoire' },
      { layerId: 'douane_obligatoire', value: 0, payerType: 'na' },
      { layerId: 'douane_ddp', value: 45, rate: 'OM 0-60%', payerType: 'ddp_client' },
      { layerId: 'tva', value: 8.5, rate: '8.5%', payerType: 'ddp_client' }
    ]
  },
  {
    id: 'reunion',
    name: 'Réunion',
    zone: 'DROM',
    angle: 0,
    isCustom: false,
    costs: [
      { layerId: 'transport', value: 6, rate: '5-8%', payerType: 'obligatoire' },
      { layerId: 'douane_obligatoire', value: 0, payerType: 'na' },
      { layerId: 'douane_ddp', value: 50, rate: 'OM 0-60%', payerType: 'ddp_client' },
      { layerId: 'tva', value: 8.5, rate: '8.5%', payerType: 'ddp_client' }
    ]
  },
  {
    id: 'guyane',
    name: 'Guyane',
    zone: 'DROM',
    angle: 30,
    isCustom: false,
    costs: [
      { layerId: 'transport', value: 7, rate: 'Maritime/Aérien', payerType: 'obligatoire' },
      { layerId: 'douane_obligatoire', value: 0, payerType: 'na' },
      { layerId: 'douane_ddp', value: 30, rate: 'OM variable', payerType: 'ddp_client' },
      { layerId: 'tva', value: 0, rate: '0%', payerType: 'na', notes: 'Pas de TVA en Guyane' }
    ]
  },
  {
    id: 'belgique',
    name: 'Belgique',
    zone: 'UE',
    angle: 60,
    isCustom: false,
    costs: [
      { layerId: 'transport', value: 2.5, rate: '2-3%', payerType: 'obligatoire' },
      { layerId: 'douane_obligatoire', value: 0, payerType: 'na', notes: 'Pas de douane UE' },
      { layerId: 'douane_ddp', value: 0, payerType: 'na' },
      { layerId: 'tva', value: 0, rate: 'Autoliquidation', payerType: 'na' }
    ]
  },
  {
    id: 'suisse',
    name: 'Suisse',
    zone: 'Hors UE',
    angle: 90,
    isCustom: false,
    costs: [
      { layerId: 'transport', value: 3, rate: '2-4%', payerType: 'obligatoire' },
      { layerId: 'douane_obligatoire', value: 0.5, rate: 'EX1 + EUR.1', payerType: 'obligatoire' },
      { layerId: 'douane_ddp', value: 3, rate: '0-5% (EUR.1)', payerType: 'ddp_client' },
      { layerId: 'tva', value: 8.1, rate: '8.1%', payerType: 'ddp_client' }
    ]
  },
  {
    id: 'espagne',
    name: 'Espagne',
    zone: 'UE',
    angle: 120,
    isCustom: false,
    costs: [
      { layerId: 'transport', value: 3.5, rate: '3-4%', payerType: 'obligatoire' },
      { layerId: 'douane_obligatoire', value: 0, payerType: 'na' },
      { layerId: 'douane_ddp', value: 0, payerType: 'na' },
      { layerId: 'tva', value: 0, rate: 'Autoliquidation', payerType: 'na' }
    ]
  },
  {
    id: 'maroc',
    name: 'Maroc',
    zone: 'Hors UE',
    angle: 150,
    isCustom: false,
    costs: [
      { layerId: 'transport', value: 5, rate: 'Maritime/Routier', payerType: 'obligatoire' },
      { layerId: 'douane_obligatoire', value: 1, rate: 'EX1', payerType: 'obligatoire' },
      { layerId: 'douane_ddp', value: 25, rate: '0-40%', payerType: 'ddp_client' },
      { layerId: 'tva', value: 20, rate: '20%', payerType: 'ddp_client' }
    ]
  }
];

const STORAGE_KEY = 'orliman_mindmap_data';

const iconComponents = {
  truck: Truck,
  receipt: Receipt,
  euro: Euro,
  building: Building2,
  users: Users
};

const zoneColors = {
  'UE': 'badge-ue',
  'Hors UE': 'badge-hors-ue',
  'DROM': 'badge-drom'
};

const payerColors = {
  'obligatoire': 'bg-purple-500',
  'ddp_client': 'bg-orange-500',
  'na': 'bg-gray-300'
};

const payerLabels = {
  'obligatoire': 'Nous (obligatoire)',
  'ddp_client': 'Pour client (DDP)',
  'na': 'N/A'
};

export function ExportMindMap() {
  const [zoom, setZoom] = useState(1);
  const [layers, setLayers] = useState<CostLayer[]>(defaultLayers);
  const [destinations, setDestinations] = useState<DestinationNode[]>(defaultDestinations);
  const [selectedDest, setSelectedDest] = useState<DestinationNode | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [isAddDestOpen, setIsAddDestOpen] = useState(false);
  const [isAddLayerOpen, setIsAddLayerOpen] = useState(false);
  const [editingDest, setEditingDest] = useState<DestinationNode | null>(null);
  const [goodsValue, setGoodsValue] = useState(10000);

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.layers) setLayers(data.layers);
        if (data.destinations) setDestinations(data.destinations);
        if (data.goodsValue) setGoodsValue(data.goodsValue);
      }
    } catch (error) {
      console.error('Error loading mindmap data:', error);
    }
  }, []);

  // Save to localStorage
  const saveData = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ layers, destinations, goodsValue }));
    toast.success('Données sauvegardées');
  }, [layers, destinations, goodsValue]);

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

  // Add destination
  const addDestination = useCallback((dest: Omit<DestinationNode, 'id' | 'angle' | 'costs' | 'isCustom'>) => {
    const newAngle = destinations.length * (360 / (destinations.length + 1));
    const newDest: DestinationNode = {
      ...dest,
      id: `dest-${Date.now()}`,
      angle: newAngle,
      isCustom: true,
      costs: layers.map(l => ({
        layerId: l.id,
        value: 0,
        payerType: 'na' as const
      }))
    };
    
    // Recalculate angles
    const updatedDests = [...destinations, newDest].map((d, i, arr) => ({
      ...d,
      angle: -90 + (i * (360 / arr.length))
    }));
    
    setDestinations(updatedDests);
    toast.success(`${dest.name} ajouté`);
    setIsAddDestOpen(false);
  }, [destinations, layers]);

  // Delete destination
  const deleteDestination = useCallback((id: string) => {
    setDestinations(prev => {
      const filtered = prev.filter(d => d.id !== id);
      // Recalculate angles
      return filtered.map((d, i, arr) => ({
        ...d,
        angle: -90 + (i * (360 / arr.length))
      }));
    });
    setSelectedDest(null);
    toast.success('Destination supprimée');
  }, []);

  // Update destination costs
  const updateDestinationCost = useCallback((destId: string, layerId: string, updates: Partial<DestinationCost>) => {
    setDestinations(prev => prev.map(d => {
      if (d.id !== destId) return d;
      return {
        ...d,
        costs: d.costs.map(c => {
          if (c.layerId !== layerId) return c;
          return { ...c, ...updates };
        })
      };
    }));
  }, []);

  // Add layer
  const addLayer = useCallback((layer: Omit<CostLayer, 'id' | 'isCustom'>) => {
    const newLayer: CostLayer = {
      ...layer,
      id: `layer-${Date.now()}`,
      isCustom: true
    };
    setLayers(prev => [...prev, newLayer]);
    
    // Add this layer to all destinations
    setDestinations(prev => prev.map(d => ({
      ...d,
      costs: [...d.costs, { layerId: newLayer.id, value: 0, payerType: 'na' as const }]
    })));
    
    toast.success(`Couche "${layer.label}" ajoutée`);
    setIsAddLayerOpen(false);
  }, []);

  // Delete layer
  const deleteLayer = useCallback((id: string) => {
    setLayers(prev => prev.filter(l => l.id !== id));
    setDestinations(prev => prev.map(d => ({
      ...d,
      costs: d.costs.filter(c => c.layerId !== id)
    })));
    setSelectedLayer(null);
    toast.success('Couche supprimée');
  }, []);

  // Calculate costs for a destination
  const calculateTotalCosts = useCallback((dest: DestinationNode) => {
    let totalObligatoire = 0;
    let totalDDP = 0;
    
    dest.costs.forEach(cost => {
      const amount = (cost.value / 100) * goodsValue;
      if (cost.payerType === 'obligatoire') {
        totalObligatoire += amount;
      } else if (cost.payerType === 'ddp_client') {
        totalDDP += amount;
      }
    });
    
    return { totalObligatoire, totalDDP, total: totalObligatoire + totalDDP };
  }, [goodsValue]);

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <div className="h-6 w-px bg-border mx-2" />
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">Valeur HT:</Label>
            <Input
              type="number"
              value={goodsValue}
              onChange={(e) => setGoodsValue(parseFloat(e.target.value) || 0)}
              className="w-28 h-8"
            />
            <span className="text-sm text-muted-foreground">€</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Dialog open={isAddDestOpen} onOpenChange={setIsAddDestOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <MapPin className="h-4 w-4 mr-2" />
                Ajouter pays
              </Button>
            </DialogTrigger>
            <AddDestinationDialog onAdd={addDestination} onClose={() => setIsAddDestOpen(false)} />
          </Dialog>
          
          <Dialog open={isAddLayerOpen} onOpenChange={setIsAddLayerOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Layers className="h-4 w-4 mr-2" />
                Ajouter couche
              </Button>
            </DialogTrigger>
            <AddLayerDialog onAdd={addLayer} onClose={() => setIsAddLayerOpen(false)} />
          </Dialog>
          
          <Button size="sm" onClick={saveData}>
            <Save className="h-4 w-4 mr-2" />
            Sauvegarder
          </Button>
        </div>
      </div>

      {/* Layer Legend */}
      <div className="flex flex-wrap gap-2">
        {layers.map(layer => {
          const IconComponent = iconComponents[layer.icon];
          return (
            <button
              key={layer.id}
              onClick={() => setSelectedLayer(selectedLayer === layer.id ? null : layer.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all border",
                selectedLayer === layer.id 
                  ? "ring-2 ring-offset-2 ring-primary" 
                  : "hover:opacity-80"
              )}
              style={{ 
                backgroundColor: `${layer.color}20`,
                borderColor: `${layer.color}40`,
                color: layer.color
              }}
            >
              <IconComponent className="h-4 w-4" />
              <span>{layer.label}</span>
              {layer.isCustom && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteLayer(layer.id);
                  }}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </button>
          );
        })}
      </div>

      {/* Payer Legend */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">Qui paie :</span>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500" />
          <span>Nous (obligatoire)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500" />
          <span>Pour client (DDP)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-300" />
          <span>N/A</span>
        </div>
      </div>

      {/* Mind Map Container */}
      <div className="relative bg-muted/30 rounded-xl border overflow-hidden" style={{ height: '550px' }}>
        <div 
          className="absolute inset-0 flex items-center justify-center transition-transform duration-300"
          style={{ transform: `scale(${zoom})` }}
        >
          {/* Layer rings */}
          <svg className="absolute inset-0 w-full h-full" viewBox="-350 -275 700 550">
            {layers.map((layer, i) => {
              const radius = 70 + i * 40;
              return (
                <circle 
                  key={layer.id}
                  cx="0" cy="0" r={radius} 
                  fill="none" 
                  stroke={layer.color} 
                  strokeWidth="2" 
                  strokeDasharray="4 4" 
                  opacity={selectedLayer === layer.id ? 0.8 : 0.3}
                  className="transition-opacity"
                />
              );
            })}
            
            {/* Connection lines */}
            {destinations.map(dest => {
              const pos = getDestPosition(dest.angle, 70 + layers.length * 40 + 30);
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
            className="absolute z-10 flex flex-col items-center justify-center w-20 h-20 rounded-full bg-primary text-primary-foreground shadow-lg"
            style={{ transform: 'translate(-50%, -50%)', left: '50%', top: '50%' }}
          >
            <MapPin className="h-5 w-5 mb-0.5" />
            <span className="text-xs font-bold">FRANCE</span>
          </div>

          {/* Layer labels on rings */}
          {layers.map((layer, i) => {
            const radius = 70 + i * 40;
            return (
              <div
                key={layer.id}
                className="absolute text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap"
                style={{
                  left: `calc(50% + ${radius}px + 5px)`,
                  top: 'calc(50% - 8px)',
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
            const pos = getDestPosition(dest.angle, 70 + layers.length * 40 + 50);
            const isSelected = selectedDest?.id === dest.id;
            const totals = calculateTotalCosts(dest);
            
            return (
              <Popover key={dest.id}>
                <PopoverTrigger asChild>
                  <button
                    onClick={() => setSelectedDest(isSelected ? null : dest)}
                    className={cn(
                      "absolute flex flex-col items-center p-2 rounded-lg transition-all hover:scale-110",
                      isSelected ? "bg-card shadow-lg ring-2 ring-primary z-20" : "bg-card/90 hover:bg-card shadow z-10"
                    )}
                    style={{
                      left: `calc(50% + ${pos.x}px)`,
                      top: `calc(50% + ${pos.y}px)`,
                      transform: 'translate(-50%, -50%)'
                    }}
                  >
                    <span className="text-xs font-semibold">{dest.name}</span>
                    <Badge variant="outline" className={cn("text-[10px] mt-0.5 px-1", zoneColors[dest.zone])}>
                      {dest.zone}
                    </Badge>
                    
                    {/* Layer cost indicators */}
                    <div className="flex gap-0.5 mt-1">
                      {dest.costs.map(cost => {
                        const layer = layers.find(l => l.id === cost.layerId);
                        if (!layer) return null;
                        return (
                          <div
                            key={cost.layerId}
                            className={cn(
                              "w-2 h-2 rounded-full border",
                              selectedLayer === cost.layerId ? "ring-1 ring-offset-1" : ""
                            )}
                            style={{ 
                              backgroundColor: cost.payerType === 'na' ? '#e5e5e5' : layer.color,
                              borderColor: layer.color
                            }}
                            title={`${layer.label}: ${cost.value}%`}
                          />
                        );
                      })}
                    </div>
                    
                    {/* Total preview */}
                    <div className="text-[9px] text-muted-foreground mt-1">
                      {totals.total > 0 ? `${totals.total.toLocaleString('fr-FR')}€` : '-'}
                    </div>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <DestinationEditor
                    destination={dest}
                    layers={layers}
                    goodsValue={goodsValue}
                    onUpdateCost={(layerId, updates) => updateDestinationCost(dest.id, layerId, updates)}
                    onDelete={dest.isCustom ? () => deleteDestination(dest.id) : undefined}
                    totals={totals}
                  />
                </PopoverContent>
              </Popover>
            );
          })}
        </div>
      </div>

      {/* Summary Cards */}
      {selectedDest && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-purple-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4 text-purple-500" />
                Coûts Obligatoires (nous)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-purple-600">
                {calculateTotalCosts(selectedDest).totalObligatoire.toLocaleString('fr-FR')} €
              </p>
              <p className="text-xs text-muted-foreground">
                {((calculateTotalCosts(selectedDest).totalObligatoire / goodsValue) * 100).toFixed(1)}% de la valeur
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-orange-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-orange-500" />
                Coûts DDP Client
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-600">
                {calculateTotalCosts(selectedDest).totalDDP.toLocaleString('fr-FR')} €
              </p>
              <p className="text-xs text-muted-foreground">
                {((calculateTotalCosts(selectedDest).totalDDP / goodsValue) * 100).toFixed(1)}% de la valeur
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Euro className="h-4 w-4" />
                Total {selectedDest.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {calculateTotalCosts(selectedDest).total.toLocaleString('fr-FR')} €
              </p>
              <p className="text-xs text-muted-foreground">
                Valeur + frais = {(goodsValue + calculateTotalCosts(selectedDest).total).toLocaleString('fr-FR')} €
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Layer Info */}
      {selectedLayer && !selectedDest && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {(() => {
                const layer = layers.find(l => l.id === selectedLayer);
                if (!layer) return null;
                const IconComponent = iconComponents[layer.icon];
                return <IconComponent className="h-5 w-5" style={{ color: layer.color }} />;
              })()}
              {layers.find(l => l.id === selectedLayer)?.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {layers.find(l => l.id === selectedLayer)?.description}
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {destinations.map(dest => {
                const cost = dest.costs.find(c => c.layerId === selectedLayer);
                if (!cost) return null;
                const amount = (cost.value / 100) * goodsValue;
                
                return (
                  <div key={dest.id} className="p-3 rounded-lg border bg-muted/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{dest.name}</span>
                      <div className={cn("w-2 h-2 rounded-full", payerColors[cost.payerType])} />
                    </div>
                    <p className="text-lg font-bold">{cost.value}%</p>
                    <p className="text-xs text-muted-foreground">{amount.toLocaleString('fr-FR')} €</p>
                    {cost.rate && <p className="text-xs text-muted-foreground">{cost.rate}</p>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Destination Editor Component
interface DestinationEditorProps {
  destination: DestinationNode;
  layers: CostLayer[];
  goodsValue: number;
  onUpdateCost: (layerId: string, updates: Partial<DestinationCost>) => void;
  onDelete?: () => void;
  totals: { totalObligatoire: number; totalDDP: number; total: number };
}

function DestinationEditor({ destination, layers, goodsValue, onUpdateCost, onDelete, totals }: DestinationEditorProps) {
  return (
    <div>
      <div className="p-3 border-b flex items-center justify-between">
        <div>
          <h4 className="font-semibold">{destination.name}</h4>
          <Badge variant="outline" className={cn("text-xs", zoneColors[destination.zone])}>
            {destination.zone}
          </Badge>
        </div>
        {onDelete && (
          <Button variant="ghost" size="sm" className="text-destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <div className="p-3 space-y-3 max-h-80 overflow-y-auto">
        {destination.costs.map(cost => {
          const layer = layers.find(l => l.id === cost.layerId);
          if (!layer) return null;
          const IconComponent = iconComponents[layer.icon];
          const amount = (cost.value / 100) * goodsValue;
          
          return (
            <div key={cost.layerId} className="space-y-2 p-2 rounded-lg border">
              <div className="flex items-center gap-2">
                <IconComponent className="h-4 w-4" style={{ color: layer.color }} />
                <span className="text-sm font-medium flex-1">{layer.label}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Taux %</Label>
                  <Input
                    type="number"
                    value={cost.value}
                    onChange={(e) => onUpdateCost(cost.layerId, { value: parseFloat(e.target.value) || 0 })}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">Qui paie</Label>
                  <Select
                    value={cost.payerType}
                    onValueChange={(v) => onUpdateCost(cost.layerId, { payerType: v as DestinationCost['payerType'] })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="obligatoire">Nous (obligatoire)</SelectItem>
                      <SelectItem value="ddp_client">Pour client (DDP)</SelectItem>
                      <SelectItem value="na">N/A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <Input
                  placeholder="Taux/notes..."
                  value={cost.rate || ''}
                  onChange={(e) => onUpdateCost(cost.layerId, { rate: e.target.value })}
                  className="h-6 text-xs"
                />
                <span className="ml-2 whitespace-nowrap font-medium">
                  {amount.toLocaleString('fr-FR')} €
                </span>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="p-3 border-t bg-muted/30 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-purple-600">Obligatoire (nous):</span>
          <span className="font-medium">{totals.totalObligatoire.toLocaleString('fr-FR')} €</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-orange-600">DDP (client):</span>
          <span className="font-medium">{totals.totalDDP.toLocaleString('fr-FR')} €</span>
        </div>
        <div className="flex justify-between text-sm font-bold pt-1 border-t">
          <span>Total:</span>
          <span>{totals.total.toLocaleString('fr-FR')} €</span>
        </div>
      </div>
    </div>
  );
}

// Add Destination Dialog
interface AddDestinationDialogProps {
  onAdd: (dest: Omit<DestinationNode, 'id' | 'angle' | 'costs' | 'isCustom'>) => void;
  onClose: () => void;
}

function AddDestinationDialog({ onAdd, onClose }: AddDestinationDialogProps) {
  const [name, setName] = useState('');
  const [zone, setZone] = useState<'UE' | 'Hors UE' | 'DROM'>('UE');

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('Le nom est requis');
      return;
    }
    onAdd({ name: name.trim(), zone });
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Ajouter un pays/destination</DialogTitle>
        <DialogDescription>
          Ajoutez un nouveau pays à votre carte des flux export
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label>Nom du pays/territoire</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Italie, Canada, Mayotte..."
          />
        </div>
        
        <div className="space-y-2">
          <Label>Zone</Label>
          <Select value={zone} onValueChange={(v) => setZone(v as typeof zone)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UE">UE (Union Européenne)</SelectItem>
              <SelectItem value="Hors UE">Hors UE</SelectItem>
              <SelectItem value="DROM">DROM</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Annuler</Button>
        <Button onClick={handleSubmit}>Ajouter</Button>
      </DialogFooter>
    </DialogContent>
  );
}

// Add Layer Dialog
interface AddLayerDialogProps {
  onAdd: (layer: Omit<CostLayer, 'id' | 'isCustom'>) => void;
  onClose: () => void;
}

function AddLayerDialog({ onAdd, onClose }: AddLayerDialogProps) {
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<CostLayer['icon']>('receipt');
  const [color, setColor] = useState('#6366f1');

  const handleSubmit = () => {
    if (!label.trim()) {
      toast.error('Le nom est requis');
      return;
    }
    onAdd({ label: label.trim(), description, icon, color });
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Ajouter une couche de coûts</DialogTitle>
        <DialogDescription>
          Ajoutez une nouvelle catégorie de frais à votre carte
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label>Nom de la couche</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex: Frais bancaires, Assurance..."
          />
        </div>
        
        <div className="space-y-2">
          <Label>Description</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description de cette catégorie de coûts"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Icône</Label>
            <Select value={icon} onValueChange={(v) => setIcon(v as typeof icon)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="truck">Transport</SelectItem>
                <SelectItem value="receipt">Taxes</SelectItem>
                <SelectItem value="euro">Financier</SelectItem>
                <SelectItem value="building">Institution</SelectItem>
                <SelectItem value="users">Client</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Couleur</Label>
            <Input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 p-1"
            />
          </div>
        </div>
      </div>
      
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Annuler</Button>
        <Button onClick={handleSubmit}>Ajouter</Button>
      </DialogFooter>
    </DialogContent>
  );
}
