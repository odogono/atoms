import { resolve } from 'node:path';

import {
  configs as reactThreeConfigs,
  rules as reactThreeRules
} from '@react-three/eslint-plugin';

import nkzw from '@nkzw/eslint-config';

export default [
  {
    ignores: ['**/dist/*']
  },
  {
    plugins: {
      '@react-three': {
        rules: reactThreeRules
      }
    },
    rules: reactThreeConfigs.recommended.rules
  },
  ...nkzw,
  {
    rules: {
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      'arrow-body-style': ['error', 'as-needed'],
      'arrow-parens': ['error', 'as-needed'],
      'arrow-spacing': ['error', { after: true, before: true }],
      'func-style': ['error', 'expression'],
      'no-var': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-const': 'error',
      'react/no-unknown-property': 'off'
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: resolve(process.cwd(), './tsconfig.json')
        }
      }
    }
  }
];
