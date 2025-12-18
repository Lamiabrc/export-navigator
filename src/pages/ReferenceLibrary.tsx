import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search, Plus, FileText, Download, ExternalLink, Trash2, 
  Edit2, Tag, Calendar, MapPin, Library, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { useReferenceDocuments } from '@/hooks/useReferenceDocuments';
import { categoryLabels, categoryColors, type DocumentCategory, type ReferenceDocument } from '@/types/referenceDocument';
import { cn } from '@/lib/utils';

const categories: DocumentCategory[] = ['octroi_mer', 'douane', 'tva', 'reglementation', 'transport', 'autre'];

export default function ReferenceLibrary() {
  const { 
    documents, 
    isLoading, 
    addDocument, 
    deleteDocument, 
    searchDocuments,
    customDocumentsCount,
    builtInDocumentsCount
  } = useReferenceDocuments();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | 'all'>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newDoc, setNewDoc] = useState<Partial<ReferenceDocument>>({
    title: '',
    category: 'autre',
    description: '',
    territory: '',
    tags: [],
    textContent: ''
  });
  const [tagInput, setTagInput] = useState('');

  // Filter documents
  const filteredDocuments = useMemo(() => {
    const category = selectedCategory === 'all' ? undefined : selectedCategory;
    return searchDocuments(searchQuery, category);
  }, [searchQuery, selectedCategory, searchDocuments]);

  // Group by category for display
  const groupedDocuments = useMemo(() => {
    const groups: Record<DocumentCategory, ReferenceDocument[]> = {
      octroi_mer: [],
      douane: [],
      tva: [],
      reglementation: [],
      transport: [],
      autre: []
    };
    
    filteredDocuments.forEach(doc => {
      groups[doc.category].push(doc);
    });
    
    return groups;
  }, [filteredDocuments]);

  const handleAddTag = () => {
    if (tagInput.trim() && !newDoc.tags?.includes(tagInput.trim())) {
      setNewDoc(prev => ({
        ...prev,
        tags: [...(prev.tags || []), tagInput.trim().toLowerCase()]
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setNewDoc(prev => ({
      ...prev,
      tags: prev.tags?.filter(t => t !== tag)
    }));
  };

  const handleAddDocument = () => {
    if (!newDoc.title?.trim()) {
      toast.error('Le titre est requis');
      return;
    }

    addDocument({
      title: newDoc.title.trim(),
      category: newDoc.category as DocumentCategory || 'autre',
      description: newDoc.description || '',
      territory: newDoc.territory || undefined,
      year: newDoc.year || undefined,
      tags: newDoc.tags || [],
      textContent: newDoc.textContent || undefined,
      sourceUrl: newDoc.sourceUrl || undefined
    });

    toast.success('Document ajouté à la bibliothèque');
    setIsAddDialogOpen(false);
    setNewDoc({
      title: '',
      category: 'autre',
      description: '',
      territory: '',
      tags: [],
      textContent: ''
    });
  };

  const handleDeleteDocument = (doc: ReferenceDocument) => {
    if (doc.isBuiltIn) {
      toast.error('Les documents intégrés ne peuvent pas être supprimés');
      return;
    }
    deleteDocument(doc.id);
    toast.success('Document supprimé');
  };

  const handleDownload = (doc: ReferenceDocument) => {
    if (doc.fileUrl) {
      window.open(doc.fileUrl, '_blank');
    } else if (doc.textContent) {
      const blob = new Blob([doc.textContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.title.replace(/[^a-z0-9]/gi, '_')}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Chargement de la bibliothèque...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Library className="h-6 w-6" />
              Base Documentaire
            </h1>
            <p className="mt-1 text-muted-foreground">
              {builtInDocumentsCount} documents de référence intégrés • {customDocumentsCount} documents ajoutés
            </p>
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un texte
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Ajouter un document de référence</DialogTitle>
                <DialogDescription>
                  Ajoutez un texte réglementaire ou un document de référence à votre bibliothèque
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Titre *</Label>
                    <Input
                      id="title"
                      value={newDoc.title || ''}
                      onChange={(e) => setNewDoc(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Ex: Décret n° 2024-xxx"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="category">Catégorie</Label>
                    <Select
                      value={newDoc.category || 'autre'}
                      onValueChange={(v) => setNewDoc(prev => ({ ...prev, category: v as DocumentCategory }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat} value={cat}>
                            {categoryLabels[cat]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="territory">Territoire concerné</Label>
                    <Input
                      id="territory"
                      value={newDoc.territory || ''}
                      onChange={(e) => setNewDoc(prev => ({ ...prev, territory: e.target.value }))}
                      placeholder="Ex: Martinique, UE, France"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="year">Année</Label>
                    <Input
                      id="year"
                      type="number"
                      value={newDoc.year || ''}
                      onChange={(e) => setNewDoc(prev => ({ ...prev, year: parseInt(e.target.value) || undefined }))}
                      placeholder="Ex: 2024"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newDoc.description || ''}
                    onChange={(e) => setNewDoc(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Décrivez brièvement le contenu et l'utilité du document..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sourceUrl">URL source (optionnel)</Label>
                  <Input
                    id="sourceUrl"
                    type="url"
                    value={newDoc.sourceUrl || ''}
                    onChange={(e) => setNewDoc(prev => ({ ...prev, sourceUrl: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tags</Label>
                  <div className="flex gap-2">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="Ajouter un tag..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={handleAddTag}>
                      <Tag className="h-4 w-4" />
                    </Button>
                  </div>
                  {newDoc.tags && newDoc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {newDoc.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => handleRemoveTag(tag)}>
                          {tag} ×
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="textContent">Contenu textuel (optionnel)</Label>
                  <Textarea
                    id="textContent"
                    value={newDoc.textContent || ''}
                    onChange={(e) => setNewDoc(prev => ({ ...prev, textContent: e.target.value }))}
                    placeholder="Collez ici le texte du document ou les extraits importants..."
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleAddDocument}>
                  Ajouter le document
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search & Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un document, un territoire, un tag..."
                  className="pl-10"
                />
              </div>
              
              <Select
                value={selectedCategory}
                onValueChange={(v) => setSelectedCategory(v as DocumentCategory | 'all')}
              >
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les catégories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {categoryLabels[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Documents List */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">Tous ({filteredDocuments.length})</TabsTrigger>
            {categories.map(cat => {
              const count = groupedDocuments[cat].length;
              if (count === 0) return null;
              return (
                <TabsTrigger key={cat} value={cat}>
                  {categoryLabels[cat]} ({count})
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="all">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDocuments.map(doc => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onDelete={() => handleDeleteDocument(doc)}
                  onDownload={() => handleDownload(doc)}
                />
              ))}
            </div>
            
            {filteredDocuments.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Aucun document trouvé</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {categories.map(cat => (
            <TabsContent key={cat} value={cat}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groupedDocuments[cat].map(doc => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    onDelete={() => handleDeleteDocument(doc)}
                    onDownload={() => handleDownload(doc)}
                  />
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </MainLayout>
  );
}

interface DocumentCardProps {
  document: ReferenceDocument;
  onDelete: () => void;
  onDownload: () => void;
}

function DocumentCard({ document, onDelete, onDownload }: DocumentCardProps) {
  const hasFile = !!document.fileUrl;
  const hasText = !!document.textContent;

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className={cn("text-xs", categoryColors[document.category])}>
                {categoryLabels[document.category]}
              </Badge>
              {document.isBuiltIn && (
                <Badge variant="secondary" className="text-xs">Intégré</Badge>
              )}
            </div>
            <CardTitle className="text-base line-clamp-2">{document.title}</CardTitle>
          </div>
          
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {(hasFile || hasText) && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDownload}>
                <Download className="h-4 w-4" />
              </Button>
            )}
            {document.sourceUrl && (
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                <a href={document.sourceUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
            {!document.isBuiltIn && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible. Le document sera supprimé de votre bibliothèque.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground">
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {document.description}
        </p>
        
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {document.territory && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {document.territory}
            </span>
          )}
          {document.year && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {document.year}
            </span>
          )}
          {hasFile && (
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {document.fileName}
            </span>
          )}
        </div>
        
        {document.tags && document.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {document.tags.slice(0, 4).map(tag => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {document.tags.length > 4 && (
              <Badge variant="outline" className="text-xs">
                +{document.tags.length - 4}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
