# Export Navigator

**Propriété exclusive de Lamia Brechet**  
*Tous droits réservés*

---

## 📋 Description

**Export Navigator** est un outil professionnel de contrôle et de cohérence pour les opérations d'export vers les DOM-TOM et l'international. Il permet de gérer, suivre et analyser l'ensemble des flux d'exportation avec une vision complète sur les coûts, marges et conformité réglementaire.

---

## 🎯 Mission

Assurer la maîtrise et la cohérence des opérations d'export en centralisant :
- La gestion des **Incoterms** (EXW, FCA, CIF, DAP, DDP, etc.)
- Le contrôle **TVA DOM/DDP** et taxes d'octroi de mer
- Le suivi des **coûts** (transport, douane, transit, assurance)
- L'analyse des **marges** et de la rentabilité
- La vérification de la **conformité documentaire**

---

## ✨ Fonctionnalités Principales

### 📊 Dashboard Directionnelle
- KPIs en temps réel (flux actifs, valeur marchandise, coûts totaux, flux à risque)
- Graphiques de répartition par Incoterm et destination
- Tableau des flux récents avec statuts

### 🗺️ Catalogue des Circuits d'Export
- Visualisation en mind-map des circuits par zone géographique
- Détail des étapes et jalons par circuit
- Export de la cartographie

### 📦 Suivi Logistique
- Checklists documentaires par flux
- Suivi des étapes (commande, douane, transport, livraison)
- Gestion des transitaires et prestataires

### 💰 Analyse Financière
- Calcul automatique du prix de revient
- Analyse de marge estimée vs réalisée
- Suivi de la déductibilité TVA
- Rapprochement factures Sage / coûts réels

### 📄 Vérification Factures PDF
- Upload et analyse de factures PDF
- Extraction des données (montant, référence, fournisseur)
- Contrôle de cohérence avec les documents de coût
- Alertes sur écarts de marge

### 🧮 Simulateur de Coûts
- Simulation complète par destination et Incoterm
- Calcul des frais de transport, douane, octroi de mer
- Estimation du prix de vente et marge prévisionnelle

### 📚 Bibliothèque de Référence
- Taux de change, taux d'octroi de mer par zone
- Documents réglementaires (CDU, guides douane, DEB)
- Données de référence (destinations, Incoterms)

### 📥 Import de Données
- Import CSV des factures Sage
- Import des coûts réels (transport, douane)
- Mapping automatique des colonnes

### 👥 Gestion des Clients
- Fiches clients avec historique des flux
- Suivi des commandes par client
- Analyse de rentabilité par client

---

## 🛠️ Technologies

| Technologie | Usage |
|-------------|-------|
| **React 18** | Framework UI |
| **TypeScript** | Typage statique |
| **Vite** | Build et développement |
| **Tailwind CSS** | Styles et design system |
| **shadcn/ui** | Composants UI |
| **Recharts** | Graphiques et visualisations |
| **Electron** | Application desktop |
| **localStorage** | Persistance locale des données |

---

## 🚀 Installation et Lancement

### Mode Web (Développement)

```bash
# Installer les dépendances (registre npm public forcé via .npmrc pour éviter les 403)
npm install

# Lancer le serveur de développement
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

## 📁 Structure du Projet

```
src/
├── components/        # Composants React réutilisables
│   ├── dashboard/     # Composants du tableau de bord
│   ├── flows/         # Gestion des flux
│   ├── layout/        # Layout et navigation
│   └── ui/            # Composants UI (shadcn)
├── data/              # Données de référence et mock
├── hooks/             # Hooks personnalisés
├── lib/               # Logique métier pure
│   ├── imports/       # Parsing et mapping CSV
│   ├── kpi/           # Calculs KPI
│   ├── reco/          # Rapprochement
│   └── rules/         # Moteur de règles
├── pages/             # Pages de l'application
├── types/             # Types TypeScript
└── utils/             # Utilitaires
```

---

## ⚠️ Avertissement Légal

**Export Navigator** est un outil d'aide à la décision et de contrôle de cohérence. Il ne remplace en aucun cas :
- Un conseil fiscal ou juridique professionnel
- Une validation par un commissionnaire en douane agréé
- Les obligations déclaratives officielles

Les calculs et contrôles effectués sont indicatifs et doivent être vérifiés auprès des autorités compétentes.

---

## 📜 Licence

**Propriété exclusive et confidentielle**

© 2024 Lamia Brechet - Tous droits réservés

Ce logiciel et sa documentation sont la propriété exclusive de Lamia Brechet. Toute reproduction, distribution, modification ou utilisation non autorisée est strictement interdite.

---

## 📞 Contact

Pour toute question relative à cet outil, veuillez contacter directement la propriétaire.

---

*Export Navigator - Maîtrisez vos exports en toute confiance*
