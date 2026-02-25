# Export Navigator

**Propriete exclusive de Lamia Brechet**
*Tous droits reserves*

---

## Description

**Export Navigator** est un outil professionnel de controle et de coherence pour les operations d'export a l'international. Il permet de gerer, suivre et analyser l'ensemble des flux d'exportation avec une vision complete sur les couts, marges et conformite reglementaire.

---

## Mission

Assurer la maitrise et la coherence des operations d'export en centralisant :
- La gestion des **Incoterms** (EXW, FCA, CIF, DAP, DDP, etc.)
- Le controle **TVA import/DDP** et taxes de douane
- Le suivi des **couts** (transport, douane, transit, assurance)
- L'analyse des **marges** et de la rentabilite
- La verification de la **conformite documentaire**

---

## Fonctionnalites principales

### Dashboard directionnelle
- KPIs en temps reel (flux actifs, valeur marchandise, couts totaux, flux a risque)
- Graphiques de repartition par Incoterm et destination
- Tableau des flux recents avec statuts

### Catalogue des circuits d'export
- Visualisation en mind-map des circuits par zone geographique
- Detail des etapes et jalons par circuit
- Export de la cartographie

### Suivi logistique
- Checklists documentaires par flux
- Suivi des etapes (commande, douane, transport, livraison)
- Gestion des transitaires et prestataires

### Analyse financiere
- Calcul automatique du prix de revient
- Analyse de marge estimee vs realisee
- Suivi de la deductibilite TVA
- Rapprochement factures et couts reels

### Verification factures PDF
- Upload et analyse de factures PDF
- Extraction des donnees (montant, reference, fournisseur)
- Controle de coherence avec les documents de cout
- Alertes sur ecarts de marge

### Simulateur de couts
- Simulation complete par destination et Incoterm
- Calcul des frais de transport, douane, droits de douane
- Estimation du prix de vente et marge previsionnelle

### Bibliotheque de reference
- Taux de change, taux de droits de douane par zone
- Documents reglementaires (CDU, guides douane, DEB)
- Donnees de reference (destinations, Incoterms)

---

## Technologies

| Technologie | Usage |
|-------------|-------|
| **React 18** | Framework UI |
| **TypeScript** | Typage statique |
| **Vite** | Build et developpement |
| **Tailwind CSS** | Styles et design system |
| **shadcn/ui** | Composants UI |
| **Recharts** | Graphiques et visualisations |
| **Electron** | Application desktop |
| **localStorage** | Persistance locale des donnees |

---

## Installation et lancement

### Mode Web (Developpement)

```bash
# Installer les dependances (registre npm public force via .npmrc pour eviter les 403)
npm install

# Lancer le serveur de developpement
npm run dev
```

### Mode Desktop (Electron)

```bash
# Lancer l'application desktop
npm run electron:dev

# Construire l'application pour distribution
npm run electron:build
```

---

## Structure du projet

```
src/
|-- components/        # Composants React reutilisables
|   |-- dashboard/     # Composants du tableau de bord
|   |-- flows/         # Gestion des flux
|   |-- layout/        # Layout et navigation
|   `-- ui/            # Composants UI (shadcn)
|-- data/              # Donnees de reference et mock
|-- hooks/             # Hooks personnalises
|-- lib/               # Logique metier pure
|-- pages/             # Pages de l'application
|-- types/             # Types TypeScript
`-- utils/             # Utilitaires
```

---

## Export Expert Chatbot (FR/EN)

### Variables d'environnement (serveur)

Necessaires pour `api/chat.ts` et scripts seed :

```bash
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Migration et seed minimal

```bash
# appliquer les migrations Supabase (inclut export_expert_v1)
supabase db push

# seed minimal referentiels/playbooks/documents
node scripts/seed-export-expert.mjs
```

### Endpoint backend

- `POST /api/chat`
- body: `{ message, thread_id?, lang?, overrides? }`
- response: `{ assistant_message, entities, dossier, thread_id }`

### Tests d'acceptation rapides

1. Hors sujet: `recette de cuisine`
   - attendu: recadrage + liste de capacites import/export.
2. Cas simple: `export fraises chili`
   - attendu: questions manquantes simples + docs + risques + contrat + fiscalite.
3. EN: `export strawberries to chile`
   - attendu: meme logique en anglais.
4. RLS:
   - un utilisateur A ne voit pas les `chat_threads/chat_messages` de B.

---

## Avertissement legal

**Export Navigator** est un outil d'aide a la decision et de controle de coherence. Il ne remplace en aucun cas :
- Un conseil fiscal ou juridique professionnel
- Une validation par un commissionnaire en douane agree
- Les obligations declaratives officielles

Les calculs et controles effectues sont indicatifs et doivent etre verifies aupres des autorites competentes.

---

## Licence

**Propriete exclusive et confidentielle**

(c) 2024 Lamia Brechet - Tous droits reserves

Ce logiciel et sa documentation sont la propriete exclusive de Lamia Brechet. Toute reproduction, distribution, modification ou utilisation non autorisee est strictement interdite.

---

## Contact

Pour toute question relative a cet outil, veuillez contacter directement la proprietaire.

---

*Export Navigator - Maitrisez vos exports en toute confiance*
