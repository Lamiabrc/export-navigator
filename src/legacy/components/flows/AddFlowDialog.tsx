import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { useFlows } from '@/hooks/useFlows';
import { useReferenceRates } from '@/hooks/useReferenceRates';
import { calculateCosts, type ProductType } from '@/utils/costCalculator';
import { getZoneFromDestination } from '@/data/referenceRates';
import type { Destination, Incoterm, TransportMode, FlowStatus, ChecklistStatus, Zone } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Calculator, Package, MapPin, Truck, Euro, TrendingUp, Check, AlertCircle } from 'lucide-react';

const destinations: Destination[] = [
  'Guadeloupe',
  'Martinique',
  'Guyane',
  'Reunion',
  'Mayotte',
  'Belgique',
  'Espagne',
  'Luxembourg',
  'Suisse',
];

const incoterms: Incoterm[] = ['EXW', 'FCA', 'DAP', 'DDP'];
const transportModes: TransportMode[] = ['Routier', 'Maritime', 'Aerien', 'Express', 'Ferroviaire'];

const formSchema = z.object({
  client_name: z.string().min(1, 'Nom du client requis').max(100),
  destination: z.string(),
  incoterm: z.enum(['EXW', 'FCA', 'DAP', 'DDP']),
  incoterm_place: z.string().min(1, 'Lieu Incoterm requis').max(100),
  transport_mode: z.enum(['Routier', 'Maritime', 'Aerien', 'Express', 'Ferroviaire']),
  departure_date: z.string().min(1, 'Date de départ requise'),
  delivery_date: z.string().min(1, 'Date de livraison requise'),
  goods_value: z.coerce.number().min(0, 'Valeur positive requise'),
  weight: z.coerce.number().min(0).optional(),
  product_type: z.enum(["regulated", "standard"]),
  margin: z.coerce.number().min(0).max(100).optional(),
  comment: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AddFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddFlowDialog({ open, onOpenChange }: AddFlowDialogProps) {
  const { user } = useAuth();
  const { addFlow } = useFlows();
  const { vatRates, octroiMerRates, transportCosts, serviceCharges } = useReferenceRates();
  const [step, setStep] = useState<'form' | 'preview'>('form');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client_name: '',
      destination: 'Martinique',
      incoterm: 'DAP',
      incoterm_place: '',
      transport_mode: 'Maritime',
      departure_date: '',
      delivery_date: '',
      goods_value: 0,
      weight: 100,
      product_type: "regulated",
      margin: 25,
      comment: '',
    },
  });

  const watchedValues = form.watch();
  const zone = watchedValues.destination ? getZoneFromDestination(watchedValues.destination as Destination) : 'UE';

  const costBreakdown = useMemo(() => {
    if (!watchedValues.destination || !watchedValues.incoterm || !watchedValues.transport_mode || !watchedValues.goods_value) {
      return null;
    }

    return calculateCosts({
      goodsValue: watchedValues.goods_value,
      destination: watchedValues.destination as Destination,
      incoterm: watchedValues.incoterm as Incoterm,
      productType: (watchedValues.product_type || "regulated") as ProductType,
      transportMode: watchedValues.transport_mode as TransportMode,
      weight: watchedValues.weight || 100,
      margin: watchedValues.margin || 25,
      customRates: { vatRates, octroiMerRates, transportCosts, serviceCharges },
    });
  }, [
    watchedValues.destination,
    watchedValues.incoterm,
    watchedValues.transport_mode,
    watchedValues.goods_value,
    watchedValues.product_type,
    watchedValues.weight,
    watchedValues.margin,
    vatRates,
    octroiMerRates,
    transportCosts,
    serviceCharges,
  ]);

  const onSubmit = (data: FormValues) => {
    if (step === 'form') {
      setStep('preview');
      return;
    }

    const costs = costBreakdown;
    const flowData = {
      created_by: user?.id || 'unknown',
      client_name: data.client_name,
      destination: data.destination as Destination,
      zone: zone as Zone,
      incoterm: data.incoterm as Incoterm,
      incoterm_place: data.incoterm_place,
      transport_mode: data.transport_mode as TransportMode,
      weight: data.weight || 0,
      product_type: data.product_type,
      margin: data.margin,
      departure_date: data.departure_date,
      delivery_date: data.delivery_date,
      goods_value: data.goods_value,
      cost_transport: costs?.lines.find((l) => l.label.toLowerCase().includes('fret'))?.amount || 0,
      cost_customs_clearance:
        (costs?.lines.find((l) => l.label.toLowerCase().includes('export'))?.amount || 0) +
        (costs?.lines.find((l) => l.label.toLowerCase().includes('import'))?.amount || 0),
      cost_duties: costs?.lines.find((l) => l.label.toLowerCase().includes('droits'))?.amount || 0,
      cost_import_vat: costs?.lines.find((l) => l.label.toLowerCase().includes('tva import'))?.amount || 0,
      cost_octroi_mer: costs?.lines.find((l) => l.label === 'Octroi de Mer')?.amount || 0,
      cost_octroi_mer_regional: costs?.lines.find((l) => l.label.toLowerCase().includes('régional'))?.amount || 0,
      cost_other:
        (costs?.lines.find((l) => l.label.toLowerCase().includes('surcharge'))?.amount || 0) +
        (costs?.lines.find((l) => l.label.toLowerCase().includes('manutention'))?.amount || 0) +
        (costs?.lines.find((l) => l.label.toLowerCase().includes('carbone'))?.amount || 0) +
        (costs?.lines.find((l) => l.label.toLowerCase().includes('assurance'))?.amount || 0),
      prix_revient_estime: costs?.prixDeRevient,
      prix_vente_conseille: costs?.prixVenteHT,
      charges_fournisseur_estimees: costs?.totalFournisseur,
      charges_client_estimees: costs?.totalClient,
      status_order: 'non_demarre' as FlowStatus,
      status_incoterm_validated: 'non_demarre' as FlowStatus,
      status_export: 'non_demarre' as FlowStatus,
      status_transport: 'non_demarre' as FlowStatus,
      status_customs: zone === 'UE' ? ('na' as any) : ('non_demarre' as FlowStatus),
      status_invoicing: 'non_demarre' as FlowStatus,
      chk_invoice: 'a_faire' as ChecklistStatus,
      chk_packing_list: 'a_faire' as ChecklistStatus,
      chk_transport_doc: 'a_faire' as ChecklistStatus,
      chk_certificate_origin: zone === 'UE' ? ('na' as ChecklistStatus) : ('a_faire' as ChecklistStatus),
      chk_insurance: 'a_faire' as ChecklistStatus,
      comment: data.comment || '',
      risk_level: 'a_surveiller' as const,
    };

    addFlow(flowData);
    toast.success('Flux créé avec succès');
    form.reset();
    setStep('form');
    onOpenChange(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setStep('form');
          form.reset();
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'form' ? (
              <>
                <Package className="h-5 w-5 text-primary" />
                Nouveau flux export
              </>
            ) : (
              <>
                <Calculator className="h-5 w-5 text-accent" />
                Estimation des coûts
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {step === 'form' ? 'Renseignez les informations du flux export' : "Vérifiez l'estimation avant de créer le flux"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {step === 'form' ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="client_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom du client</FormLabel>
                        <FormControl>
                          <Input placeholder="Nom du client" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="destination"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Destination
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {destinations.map((d) => (
                              <SelectItem key={d} value={d}>
                                {d}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2 mt-1">
                          <Badge variant={zone === 'UE' ? 'default' : zone === 'DROM' ? 'secondary' : 'outline'}>{zone}</Badge>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="incoterm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Incoterm</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {incoterms.map((i) => (
                              <SelectItem key={i} value={i}>
                                {i}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="incoterm_place"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lieu Incoterm</FormLabel>
                        <FormControl>
                          <Input placeholder="Ville de livraison" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="transport_mode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Truck className="h-4 w-4" />
                          Mode de transport
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {transportModes.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="departure_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date de départ</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="delivery_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date de livraison prévue</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="goods_value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Euro className="h-4 w-4" />
                          Valeur marchandise HT
                        </FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" min="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="weight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Poids (kg)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="product_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type de produit</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="regulated">Tarif reglemente</SelectItem>
                            <SelectItem value="standard">Standard</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="margin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          Marge (%)
                        </FormLabel>
                        <FormControl>
                          <Input type="number" min="0" max="100" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="comment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Commentaire (optionnel)</FormLabel>
                      <FormControl>
                        <Input placeholder="Notes ou instructions spéciales" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {costBreakdown && (
                  <Card className="border-accent/30 bg-accent/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Calculator className="h-4 w-4 text-accent" />
                        Estimation en temps réel
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Prix de revient</p>
                        <p className="font-semibold text-lg">{formatCurrency(costBreakdown.prixDeRevient)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Prix vente HT conseillé</p>
                        <p className="font-semibold text-lg text-primary">{formatCurrency(costBreakdown.prixVenteHT)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Charges fournisseur</p>
                        <p className="font-medium">{formatCurrency(costBreakdown.totalFournisseur)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">TVA récupérable</p>
                        <p className="font-medium text-[hsl(var(--status-ok))]">{formatCurrency(costBreakdown.totalTvaRecuperablePrestations)}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={!costBreakdown}>
                    Voir l'estimation détaillée
                  </Button>
                </div>
              </>
            ) : (
              <>
                {costBreakdown && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-xs text-muted-foreground">Valeur marchandise</p>
                          <p className="text-xl font-bold">{formatCurrency(costBreakdown.params.goodsValue)}</p>
                        </CardContent>
                      </Card>
                      <Card className="border-primary/30 bg-primary/5">
                        <CardContent className="p-4">
                          <p className="text-xs text-muted-foreground">Prix de revient</p>
                          <p className="text-xl font-bold text-primary">{formatCurrency(costBreakdown.prixDeRevient)}</p>
                        </CardContent>
                      </Card>
                      <Card className="border-accent/30 bg-accent/5">
                        <CardContent className="p-4">
                          <p className="text-xs text-muted-foreground">Prix vente conseillé</p>
                          <p className="text-xl font-bold text-accent">{formatCurrency(costBreakdown.prixVenteHT)}</p>
                          <p className="text-xs text-muted-foreground">Marge {costBreakdown.margeAppliquee}%</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-xs text-muted-foreground">TVA récupérable</p>
                          <p className="text-xl font-bold text-[hsl(var(--status-ok))]">{formatCurrency(costBreakdown.totalTvaRecuperablePrestations)}</p>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Détail des charges</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                              <Check className="h-4 w-4 text-[hsl(var(--status-ok))]" />
                              Prestations avec TVA récupérable
                            </h4>
                            <div className="space-y-1">
                              {costBreakdown.lines
                                .filter((l) => l.category === 'prestation' && l.isRecoverable)
                                .map((line, i) => (
                                  <div key={i} className="flex justify-between text-sm py-1 border-b border-border/50">
                                    <span className="flex items-center gap-2">
                                      {line.label}
                                      <Badge variant="outline" className="text-xs">
                                        {line.payer}
                                      </Badge>
                                    </span>
                                    <div className="text-right">
                                      <span className="font-medium">{formatCurrency(line.amount)}</span>
                                      {line.tvaAmount > 0 && (
                                        <span className="text-xs text-[hsl(var(--status-ok))] ml-2">
                                          (TVA: {formatCurrency(line.tvaAmount)})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>

                          {costBreakdown.lines.filter((l) => l.category === 'taxe').length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-[hsl(var(--status-risk))]" />
                                Taxes non récupérables
                              </h4>
                              <div className="space-y-1">
                                {costBreakdown.lines
                                  .filter((l) => l.category === 'taxe')
                                  .map((line, i) => (
                                    <div key={i} className="flex justify-between text-sm py-1 border-b border-border/50">
                                      <span className="flex items-center gap-2">
                                        {line.label}
                                        <Badge variant="destructive" className="text-xs">
                                          {line.payer}
                                        </Badge>
                                      </span>
                                      <span className="font-medium text-[hsl(var(--status-risk))]">{formatCurrency(line.amount)}</span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}

                          {costBreakdown.lines.filter((l) => l.category === 'tva_import').length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-2">TVA Import</h4>
                              <div className="space-y-1">
                                {costBreakdown.lines
                                  .filter((l) => l.category === 'tva_import')
                                  .map((line, i) => (
                                    <div key={i} className="flex justify-between text-sm py-1 border-b border-border/50">
                                      <span className="flex items-center gap-2">
                                        {line.label}
                                        <Badge variant={line.isRecoverable ? 'default' : 'secondary'} className="text-xs">
                                          {line.isRecoverable ? 'Autoliquidée' : line.payer}
                                        </Badge>
                                      </span>
                                      <span className={`font-medium ${line.isRecoverable ? 'text-[hsl(var(--status-ok))]' : ''}`}>
                                        {formatCurrency(line.amount)}
                                        {line.isRecoverable && ' (récup.)'}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <Separator className="my-4" />
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Total charges fournisseur</p>
                            <p className="font-bold text-lg">{formatCurrency(costBreakdown.totalFournisseur)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Total charges client</p>
                            <p className="font-bold text-lg">{formatCurrency(costBreakdown.totalClient)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="flex justify-between">
                      <Button type="button" variant="outline" onClick={() => setStep('form')}>
                        Modifier
                      </Button>
                      <Button type="submit">Créer le flux</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
