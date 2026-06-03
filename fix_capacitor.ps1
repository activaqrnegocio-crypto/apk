$content = "import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aquatech.crm',
  appName: 'AquaTech CRM',
  webDir: 'out',
  server: {
    url: 'https://178.238.238.158.sslip.io',
    cleartext: false,
  },
  plugins: {
    BackgroundRunner: {
      label: 'com.aquatech.crm.outbox-sync',
      src: 'runners/background.js',
      event: 'outboxSync',
      repeat: true,
      interval: 15,
      autoStart: true,
    },
  },
};

export default config;
"
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText("d:\Abel paginas\Aquatech\crm mayo\aquatech-render-main\capacitor.config.ts", $content, $utf8)
Write-Host "Done"