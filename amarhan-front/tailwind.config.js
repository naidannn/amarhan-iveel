import tokens from './app/assets/design-tokens.js'
import typography from '@tailwindcss/typography'

/**
 * Ивээл Карго — Tailwind тохиргоо
 *
 * Өнгө, radius, shadow бүгд `app/assets/design-tokens.js`-ээс ирнэ.
 * Энд hex код ШУУД бичихгүй — токен файлыг л засна.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  // Nuxt 4-т бүх эх код `app/` дотор байна
  content: [
    './app/components/**/*.{js,vue,ts}',
    './app/layouts/**/*.vue',
    './app/pages/**/*.vue',
    './app/plugins/**/*.{js,ts}',
    './app/composables/**/*.{js,ts}',
    './app/app.vue',
    './app/error.vue',
  ],

  // Dark mode-ийн бүтэц бэлэн, гэхдээ v1-д идэвхгүй
  darkMode: 'class',

  theme: {
    screens: tokens.breakpoints,

    extend: {
      colors: {
        primary: { ...tokens.primary, DEFAULT: tokens.primary[500] },
        secondary: { ...tokens.secondary, DEFAULT: tokens.secondary[500] },

        success: tokens.semantic.success,
        warning: tokens.semantic.warning,
        error: tokens.semantic.error,
        info: tokens.semantic.info,

        surface: {
          bg: tokens.surface.background,
          card: tokens.surface.card,
          border: tokens.surface.border,
          hover: tokens.surface.hover,
        },

        content: {
          DEFAULT: tokens.text.primary,
          secondary: tokens.text.secondary,
          disabled: tokens.text.disabled,
          inverse: tokens.text.inverse,
        },
      },

      fontFamily: {
        sans: tokens.font.sans,
      },

      fontSize: {
        // Heading
        'h1': ['32px', { lineHeight: '40px', fontWeight: '700' }],
        'h2': ['28px', { lineHeight: '36px', fontWeight: '700' }],
        'h3': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'h4': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        // Body
        'body-lg': ['16px', { lineHeight: '24px' }],
        'body': ['14px', { lineHeight: '20px' }],
        'body-sm': ['13px', { lineHeight: '18px' }],
      },

      borderRadius: {
        card: tokens.radius.card,
        btn: tokens.radius.button,
        input: tokens.radius.input,
      },

      boxShadow: {
        card: tokens.shadow.card,
        raised: tokens.shadow.raised,
        dropdown: tokens.shadow.dropdown,
      },

      spacing: {
        control: tokens.sizing.controlHeight,
        card: tokens.sizing.cardPadding,
        sidebar: tokens.sizing.sidebarWidth,
        navbar: tokens.sizing.navbarHeight,
      },

      height: {
        control: tokens.sizing.controlHeight,
        navbar: tokens.sizing.navbarHeight,
      },

      width: {
        sidebar: tokens.sizing.sidebarWidth,
      },

      transitionDuration: {
        DEFAULT: tokens.motion.duration,
      },

      scale: {
        hover: tokens.motion.hoverScale,
      },
    },
  },

  plugins: [typography],
};
