import globals from 'globals'
import neostandard from 'neostandard'

export default [
  ...neostandard(), {

    languageOptions: {
      ecmaVersion: 2018,
      globals: {
        ...globals.browser,
        ...globals.commonjs,
        ...globals.jquery,
        Atomics: 'readonly',
        Plotly: true,
        SharedArrayBuffer: 'readonly',
        bootstrap: true,
        d3: true,
        moment: true,
        __dirname: true
      }
    },

    rules: {
      '@stylistic/space-before-function-paren': ['error', {anonymous: 'always', named: 'never', asyncArrow: 'always'}],
      '@stylistic/object-curly-spacing': ['error', 'never'],
    }

  }
]
