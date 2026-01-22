# Guide de compilation MPL Export Manager

## Prérequis

- Node.js v18 ou supérieur
- npm ou yarn
- Git

## Configuration initiale (IMPORTANT)

### 1. Ajouter les scripts Electron dans package.json

Ouvrez `package.json` et ajoutez ces scripts dans la section `"scripts"` :

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:dev": "vite build --mode development",
    "lint": "eslint .",
    "preview": "vite preview",
    "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:8080 && electron electron/main.js\"",
    "electron:build": "npm run build && npx electron-builder --win --config electron-builder.config.js"
  }
}
```

### 2. Mettre à jour la version

Dans `package.json`, changez la version de `"0.0.0"` à `"1.0.0"` :

```json
{
  "version": "1.0.0"
}
```

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

### Méthode 1 : Release automatique (recommandée)

1. Mettre à jour la version dans `package.json`
2. Commiter vos changements :
```bash
git add .
git commit -m "Version 1.0.0"
```

3. Créer et pousser un tag :
```bash
git tag v1.0.0
git push origin main
git push origin v1.0.0
```

4. GitHub Actions va automatiquement :
   - Compiler l'application
   - Créer l'installateur .exe
   - Publier une Release sur GitHub

### Méthode 2 : Déclencher manuellement

1. Aller sur GitHub → Actions → "Build and Release Electron App"
2. Cliquer sur "Run workflow"
3. Sélectionner la branche et lancer

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
