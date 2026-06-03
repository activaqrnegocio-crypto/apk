import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aquatech.crm',
  appName: 'Aquatech CRM',
  webDir: '.next',
  
  // LOCAL DEV - apuntando a Next.js local
  server: {
    url: 'http://10.0.2.2:3000',
    cleartext: true,  // HTTP OK para local
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
  },
};

export default config;
