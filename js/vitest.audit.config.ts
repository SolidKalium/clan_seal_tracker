import { defineConfig } from 'vitest/config';
// Content audits are deliberate checks of our handling of Bungie's manifest.
// Application behavior and audit-detector regressions remain in vitest.config.ts.
export default defineConfig({ test: { include: ['tests/audits/**/*.audit.ts'], environment: 'node' } });
