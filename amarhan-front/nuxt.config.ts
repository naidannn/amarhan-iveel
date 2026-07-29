// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/google-fonts',
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@nuxt/image',
    '@formkit/auto-animate/nuxt',
    '@nuxtjs/mdc',
  ],

  // main.css-ийг ЭНД бүртгэхгүй — @nuxtjs/tailwindcss-ийн `cssPath` хариуцна.
  // Хоёуланд нь бүртгэвэл Tailwind-ын preflight ХОЁР удаа ачаалагдана.

  devServer: {
    port: 3000,
  },

  app: {
    head: {
      htmlAttrs: { lang: 'mn' },
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
      ],
      meta: [
        { name: 'theme-color', content: '#355DFF' },
        { name: 'msapplication-TileColor', content: '#355DFF' },
        {
          name: 'description',
          content:
            'Ивээл Карго — Хятадаас Монгол руу ачаа тээвэрлэх үйлчилгээ. Ачаагаа онлайнаар хянаж, төлбөрөө төлж, хүргэлт захиална.',
        },
        { property: 'og:title', content: 'Ивээл Карго' },
        {
          property: 'og:description',
          content: 'Олон улсын карго тээврийг илүү хялбар, илүү ил тод.',
        },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
    },
  },

  googleFonts: {
    // Монгол кирилл дээр Inter/Noto Sans хамгийн уншигдахуйц
    families: {
      Inter: [400, 500, 600, 700],
      'Noto+Sans': [400, 500, 600, 700],
    },
    display: 'swap',
    download: true,
  },

  tailwindcss: {
    cssPath: '~/assets/css/main.css',
    exposeConfig: true,
    viewer: false,
  },

  runtimeConfig: {
    public: {
      apiBase:
        process.env.NUXT_PUBLIC_API_URL ||
        (process.env.NODE_ENV === 'production'
          ? 'https://rest.amarhan.mn'
          : 'http://localhost:4000'),
    },
  },

  nitro: {
    minify: true,
    compressPublicAssets: true,
  },
})
