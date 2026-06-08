import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aquatech.crm',
  appName: 'Aquatech CRM',
  webDir: '.next',
  
  // PRODUCTION - apuntando a Vercel
  server: {
    url: 'https://apk-ten-pi.vercel.app',
    cleartext: false,
    appStartPath: '/admin',
  },
  
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    backgroundColor: '#036BB2',
  },
  
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#036BB2',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    // v418: Plugin nativo para deep linking desde notificaciones
    PendingNavPlugin: {
      // No necesita configuración - se registra en MainActivity
    },
  },
};

export default config;
