# Guide de compilation ORLIMAN Export Manager

## Prérequis

- Node.js v18 ou supérieur
- npm ou yarn
- Git

## Installation des dépendances

```bash
npm install
```

## Développement

### Lancer l'application en mode développement (navigateur)
```bash
npm run dev
```

### Lancer l'application en mode développement (Electron)
```bash
npm run electron:dev
```

## Compilation

### Compiler l'application React
```bash
npm run build
```

### Créer l'installateur Windows (.exe)
```bash
npm run electron:build
```

L'installateur sera créé dans le dossier `release/`.

## Distribution via GitHub

### Créer une release automatique

1. Créer un tag avec la version :
```bash
git tag v1.0.0
git push origin v1.0.0
```

2. GitHub Actions va automatiquement :
   - Compiler l'application
   - Créer l'installateur .exe
   - Publier une Release sur GitHub

### Télécharger l'installateur

Les utilisateurs peuvent télécharger l'installateur depuis :
`https://github.com/VOTRE_USERNAME/VOTRE_REPO/releases/latest`

## Structure des fichiers Electron

```
electron/
├── main.js              # Point d'entrée principal Electron
├── preload.js           # Script de préchargement (sécurité)
└── icon.ico             # Icône de l'application (256x256 pixels)

electron-builder.config.js  # Configuration de l'installateur
```

## Personnalisation de l'icône

Remplacez `electron/icon.ico` par votre propre icône :
- Format : ICO
- Taille recommandée : 256x256 pixels
- Inclure plusieurs tailles : 16, 32, 48, 64, 128, 256 pixels

## Notes importantes

- Les données utilisateur sont stockées dans le localStorage du navigateur Chromium embarqué
- L'application fonctionne 100% hors-ligne après installation
- Taille approximative de l'installateur : 80-100 Mo
