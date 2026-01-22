/**
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: 'com.mpl.export-manager',
  productName: 'MPL Export Manager',
  directories: {
    buildResources: 'electron',
    output: 'release'
  },
  files: [
    'dist/**/*',
    'electron/**/*'
  ],
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64']
      }
    ],
    icon: 'electron/icon.ico',
    artifactName: '${productName}-Setup-${version}.${ext}'
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'MPL Export Manager',
    installerIcon: 'electron/icon.ico',
    uninstallerIcon: 'electron/icon.ico',
    installerHeaderIcon: 'electron/icon.ico',
    license: null
  },
  publish: {
    provider: 'github',
    releaseType: 'release'
  }
};
