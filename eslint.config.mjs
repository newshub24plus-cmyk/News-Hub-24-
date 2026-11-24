import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'server/**', 'src/**', 'node_modules/**', '*.ts', '*.tsx'],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];
