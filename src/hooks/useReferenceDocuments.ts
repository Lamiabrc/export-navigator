import { useState, useEffect, useCallback } from 'react';
import type { ReferenceDocument, DocumentCategory } from '@/types/referenceDocument';
import { builtInDocuments, generateDocumentId } from '@/data/referenceDocuments';

const STORAGE_KEY = 'mpl_reference_documents';

export function useReferenceDocuments() {
  const [documents, setDocuments] = useState<ReferenceDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load documents from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const customDocs = JSON.parse(stored) as ReferenceDocument[];
        // Merge built-in with custom, ensuring built-in are always present
        const builtInIds = new Set(builtInDocuments.map(d => d.id));
        const filteredCustom = customDocs.filter(d => !builtInIds.has(d.id));
        setDocuments([...builtInDocuments, ...filteredCustom]);
      } else {
        setDocuments(builtInDocuments);
      }
    } catch (error) {
      console.error('Error loading reference documents:', error);
      setDocuments(builtInDocuments);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save custom documents to localStorage
  const saveToStorage = useCallback((docs: ReferenceDocument[]) => {
    const customDocs = docs.filter(d => !d.isBuiltIn);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customDocs));
  }, []);

  // Add a new document
  const addDocument = useCallback((doc: Omit<ReferenceDocument, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn'>) => {
    const now = new Date().toISOString();
    const newDoc: ReferenceDocument = {
      ...doc,
      id: generateDocumentId(),
      createdAt: now,
      updatedAt: now,
      isBuiltIn: false
    };
    
    setDocuments(prev => {
      const updated = [...prev, newDoc];
      saveToStorage(updated);
      return updated;
    });
    
    return newDoc;
  }, [saveToStorage]);

  // Update an existing document
  const updateDocument = useCallback((id: string, updates: Partial<Omit<ReferenceDocument, 'id' | 'createdAt' | 'isBuiltIn'>>) => {
    setDocuments(prev => {
      const updated = prev.map(doc => {
        if (doc.id === id && !doc.isBuiltIn) {
          return {
            ...doc,
            ...updates,
            updatedAt: new Date().toISOString()
          };
        }
        return doc;
      });
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // Delete a document (only custom documents)
  const deleteDocument = useCallback((id: string) => {
    setDocuments(prev => {
      const doc = prev.find(d => d.id === id);
      if (doc?.isBuiltIn) {
        console.warn('Cannot delete built-in documents');
        return prev;
      }
      const updated = prev.filter(d => d.id !== id);
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // Search documents
  const searchDocuments = useCallback((query: string, category?: DocumentCategory) => {
    const normalizedQuery = query.toLowerCase().trim();
    
    return documents.filter(doc => {
      // Category filter
      if (category && doc.category !== category) return false;
      
      // Text search
      if (!normalizedQuery) return true;
      
      const searchFields = [
        doc.title,
        doc.description,
        doc.territory,
        ...(doc.tags || []),
        doc.textContent
      ].filter(Boolean).join(' ').toLowerCase();
      
      return searchFields.includes(normalizedQuery);
    });
  }, [documents]);

  // Get documents by category
  const getByCategory = useCallback((category: DocumentCategory) => {
    return documents.filter(d => d.category === category);
  }, [documents]);

  // Get documents by territory
  const getByTerritory = useCallback((territory: string) => {
    return documents.filter(d => d.territory?.toLowerCase() === territory.toLowerCase());
  }, [documents]);

  return {
    documents,
    isLoading,
    addDocument,
    updateDocument,
    deleteDocument,
    searchDocuments,
    getByCategory,
    getByTerritory,
    customDocumentsCount: documents.filter(d => !d.isBuiltIn).length,
    builtInDocumentsCount: documents.filter(d => d.isBuiltIn).length
  };
}
