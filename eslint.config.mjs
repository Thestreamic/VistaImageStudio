import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

// Next.js 16 removed `next lint`; this is the ESLint CLI setup from the
// Next.js docs (eslint-config-next, flat config).
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // React Compiler readiness rules (eslint-plugin-react-hooks 7). This app
    // does not use the React Compiler, and the flagged patterns (setState in
    // a mount effect, "latest ref" assignment during render) are deliberate.
    // Keep them visible as warnings rather than failing CI.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Build output, packaged app, and generated or vendored files:
    'out-web/**',
    'dist/**',
    'dist-electron/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'public/ort/**',
    'public/models/**',
    'public/music/**',
    'resources/**',
    'docs/**',
  ]),
])

export default eslintConfig
