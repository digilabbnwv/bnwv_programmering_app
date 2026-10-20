import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import tseslint from 'typescript-eslint'

// HTML-sinks die met gebruikersinvoer tot XSS leiden. De sessie staat in de
// browser, dus deze zijn in de hele codebase verboden.
const xssSinks = [
  {
    selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
    message: 'dangerouslySetInnerHTML is niet toegestaan (XSS-risico).',
  },
  {
    selector: "MemberExpression[property.name=/^(innerHTML|outerHTML)$/]",
    message: 'innerHTML/outerHTML is niet toegestaan (XSS-risico).',
  },
  {
    selector: "CallExpression[callee.property.name=/^(insertAdjacentHTML|write|writeln)$/]",
    message: 'HTML-strings in de DOM schrijven is niet toegestaan (XSS-risico).',
  },
  {
    selector: "CallExpression[callee.property.name='createContextualFragment']",
    message: 'createContextualFragment is niet toegestaan (XSS-risico).',
  },
]

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'node_bin', 'coverage', 'docs', 'supabase/functions'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strict, jsxA11y.flatConfigs.strict],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-restricted-syntax': ['error', ...xssSinks],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
    },
  },
  {
    files: ['**/*.{js,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.node,
    },
  },
)
