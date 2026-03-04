import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.patentado.app',
  appName: 'Patentado',
  webDir: 'dist',
  plugins: {
    Camera: {
      permissions: ['camera', 'photos'],
    },
  },
};

export default config;