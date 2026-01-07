import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.supaconnect.app',
  appName: 'SupaConnect Hub',
  webDir: 'dist',
  server: {
    // ⚠️ REPLACE WITH YOUR VERCEL URL
    url: 'https://supaconnect-hub.vercel.app',
    cleartext: true,
    androidScheme: 'https'
  }
};

export default config;
