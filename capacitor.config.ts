import type { CapacitorConfig } from '@capacitor/cli'

// Android app (Tier 1): the same editor engine as web/desktop, served from
// out-mobile/ (see `npm run build:mobile`). The app ID is permanent once the
// app is on Google Play; change it only before the first upload.
const config: CapacitorConfig = {
  appId: 'in.thestreamic.vistaimagestudio',
  appName: 'Vista Image Studio',
  webDir: 'out-mobile',
  android: {
    // The WebView only loads the bundled app (https://localhost).
    allowMixedContent: false,
    // Release builds must not be debuggable from Chrome DevTools.
    webContentsDebuggingEnabled: false,
  },
}

export default config
