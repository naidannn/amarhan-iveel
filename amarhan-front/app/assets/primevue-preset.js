import { definePreset } from '@primevue/themes';
import Aura from '@primevue/themes/aura';
import tokens from './design-tokens.js';

/**
 * Ивээл Карго — PrimeVue custom theme
 *
 * Aura-г СУУРЬ болгон авч, брэндийн токеноор бүрэн дарж бичнэ. Preset-ийг
 * шууд ашиглахгүй гэсэн шаардлагын дагуу өнгө, радиус, өндөр, сүүдэр бүгд
 * `design-tokens.js`-ээс ирнэ.
 *
 * Aura-г бүрмөсөн орхиж тэглээс theme бичих боломжтой ч, тэгвэл PrimeVue-ийн
 * 80+ компонентын бүх төлөвийг (disabled, invalid, focus ring, checked …)
 * гараар тодорхойлох шаардлагатай болно. Суурь preset-ийг дарж бичих нь
 * брэндийн дүр төрхийг бүрэн хянахын зэрэгцээ засвар үйлчилгээг хөнгөвчилнө.
 */
export default definePreset(Aura, {
  primitive: {
    borderRadius: {
      none: '0',
      xs: '4px',
      sm: '6px',
      md: tokens.radius.input, // 10px — input
      lg: tokens.radius.button, // 12px — button
      xl: tokens.radius.card, // 16px — card
    },
  },

  semantic: {
    primary: tokens.primary,

    // v1-д dark mode идэвхгүй — бүтэц нь бэлэн байлгахын тулд light-ыг л тодорхойлно
    colorScheme: {
      light: {
        primary: {
          color: tokens.primary[500],
          contrastColor: '#FFFFFF',
          hoverColor: tokens.primary[600],
          activeColor: tokens.primary[700],
        },

        surface: {
          0: '#FFFFFF',
          50: tokens.surface.background,
          100: '#F1F5F9',
          200: tokens.surface.border,
          300: '#D1D5DB',
          400: tokens.text.disabled,
          500: tokens.text.secondary,
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: tokens.text.primary,
          950: '#030712',
        },

        content: {
          background: tokens.surface.card,
          hoverBackground: tokens.surface.hover,
          borderColor: tokens.surface.border,
          color: tokens.text.primary,
          hoverColor: tokens.text.primary,
        },

        text: {
          color: tokens.text.primary,
          hoverColor: tokens.text.primary,
          mutedColor: tokens.text.secondary,
          hoverMutedColor: tokens.text.primary,
        },

        formField: {
          background: tokens.surface.card,
          disabledBackground: tokens.surface.hover,
          filledBackground: tokens.surface.hover,
          borderColor: tokens.surface.border,
          hoverBorderColor: tokens.primary[300],
          focusBorderColor: tokens.primary[500],
          invalidBorderColor: tokens.semantic.error,
          color: tokens.text.primary,
          disabledColor: tokens.text.disabled,
          placeholderColor: tokens.text.disabled,
          invalidPlaceholderColor: tokens.semantic.error,
          floatLabelColor: tokens.text.secondary,
          floatLabelFocusColor: tokens.primary[500],
          floatLabelInvalidColor: tokens.semantic.error,
          shadow: 'none',
        },

        overlay: {
          select: {
            background: tokens.surface.card,
            borderColor: tokens.surface.border,
            color: tokens.text.primary,
            shadow: tokens.shadow.dropdown,
          },
          popover: {
            background: tokens.surface.card,
            borderColor: tokens.surface.border,
            color: tokens.text.primary,
            shadow: tokens.shadow.dropdown,
          },
          modal: {
            background: tokens.surface.card,
            borderColor: tokens.surface.border,
            color: tokens.text.primary,
            shadow: tokens.shadow.dropdown,
          },
        },

        list: {
          option: {
            focusBackground: tokens.surface.hover,
            selectedBackground: tokens.primary[50],
            selectedFocusBackground: tokens.primary[100],
            color: tokens.text.primary,
            focusColor: tokens.text.primary,
            selectedColor: tokens.primary[700],
            selectedFocusColor: tokens.primary[700],
          },
        },

        navigation: {
          item: {
            focusBackground: tokens.surface.hover,
            activeBackground: tokens.primary[50],
            color: tokens.text.secondary,
            focusColor: tokens.text.primary,
            activeColor: tokens.primary[600],
            icon: {
              color: tokens.text.secondary,
              focusColor: tokens.text.primary,
              activeColor: tokens.primary[600],
            },
          },
        },
      },
    },

    // Бүх интерактив элемент 40px өндөр байх шаардлагын дагуу.
    // 1px хүрээ хоёр талд байгааг тооцож paddingY-г 9px болгов (9+9+20+2 = 40).
    formField: {
      paddingX: '12px',
      paddingY: '9px',
      borderRadius: tokens.radius.input,
      focusRing: {
        width: '2px',
        style: 'solid',
        color: tokens.primary[200],
        offset: '0',
        shadow: 'none',
      },
      transitionDuration: tokens.motion.duration,
    },

    content: {
      borderRadius: tokens.radius.card,
    },

    overlay: {
      select: { borderRadius: tokens.radius.input },
      popover: { borderRadius: tokens.radius.card, padding: '16px' },
      modal: { borderRadius: tokens.radius.card, padding: tokens.sizing.cardPadding },
    },

    transitionDuration: tokens.motion.duration,
  },

  components: {
    button: {
      root: {
        borderRadius: tokens.radius.button,
        paddingX: '16px',
        paddingY: '9px',
        gap: '8px',
        label: { fontWeight: '600' },
      },
    },

    card: {
      root: {
        borderRadius: tokens.radius.card,
        shadow: tokens.shadow.card,
      },
      body: { padding: tokens.sizing.cardPadding },
    },

    datatable: {
      // Хүснэгтийн мөр өндөр, zebra байхгүй, hover өнгөтэй
      headerCell: {
        background: tokens.surface.card,
        borderColor: tokens.surface.border,
        color: tokens.text.secondary,
        padding: '14px 16px',
      },
      bodyCell: {
        borderColor: tokens.surface.border,
        padding: '16px',
      },
      row: {
        background: tokens.surface.card,
        hoverBackground: tokens.surface.hover,
        color: tokens.text.primary,
      },
    },

    tag: {
      root: {
        borderRadius: tokens.radius.badge,
        fontWeight: '600',
        padding: '4px 10px',
      },
    },

    dialog: {
      root: {
        borderRadius: tokens.radius.card,
        shadow: tokens.shadow.dropdown,
      },
    },
  },
});
