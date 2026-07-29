'use strict';

const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');

/**
 * ESLint нь ЗӨВХӨН алдаа хайна — форматлалтыг Prettier хариуцна.
 * (Өмнө нь "standard" тохиргоо ашиглаж байсан нь .prettierrc-тэй зөрчилддөг байсан:
 * standard нь semicolon хориглодог, Prettier "semi": true гэж заасан.)
 */
module.exports = [
  {
    ignores: ['node_modules/**', 'coverage/**'],
  },

  js.configs.recommended,

  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Ашиглагдаагүй хувьсагч — алдаа хайхад тустай
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      // Backend-д console хориотой, logger ашиглана (docs/coding-style.md §2.6)
      'no-console': 'error',
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },

  {
    // Скриптүүд нь CLI хэрэгсэл — терминалд хэвлэх нь зөв
    files: ['scripts/**/*.js'],
    rules: {
      'no-console': 'off',
    },
  },

  {
    // logger.js өөрөө console дээр тулгуурладаг — цорын ганц зөвшөөрөгдсөн газар
    files: ['src/utils/logger.js'],
    rules: {
      'no-console': 'off',
    },
  },

  {
    files: ['test/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.mocha,
      },
    },
    rules: {
      'no-console': 'off',
      'no-unused-expressions': 'off',
    },
  },

  // Форматлалтын дүрмийг унтраана — Prettier-тэй зөрчихгүйн тулд ХАМГИЙН СҮҮЛД
  prettier,
];
