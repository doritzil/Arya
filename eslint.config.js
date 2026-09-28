// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', '.expo/*', 'docs/*', 'ios/*', 'src/ui/icons.generated.ts', 'src/theme/tokens.generated.ts'] },
]);
