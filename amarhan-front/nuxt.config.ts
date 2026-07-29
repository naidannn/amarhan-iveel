// https://nuxt.com/docs/api/configuration/nuxt-config

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: [
    '@nuxtjs/google-fonts',
    '@nuxtjs/tailwindcss',
    'nuxt-gtag',
    '@pinia/nuxt',
    '@nuxt/image',
    '@formkit/auto-animate/nuxt',
    '@nuxtjs/mdc',
  ],

  devServer: {
    port: 3000,
  },
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' }
      ],
      meta: [
        { name: 'msapplication-TileColor', content: '#000000' },
        { name: 'theme-color', content: '#00C27A' },
        { name: 'description', content: 'Таны бизнест тохирсон вэб ба мобайл системийг — хурдан, хямд, амархан бүтээнэ. 7 хоногийн дотор вэб эсвэл мобайл системээ ашиглаж эхэлнэ.' },
        { property: 'og:title', content: 'Amarhan.mn - Вэб ба мобайл системийн хөгжүүлэгч' },
        { property: 'og:description', content: 'Таны бизнест тохирсон вэб ба мобайл системийг — хурдан, хямд, амархан бүтээнэ.' },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: 'https://amarhan.mn' },
        { property: 'og:image', content: 'https://amarhan.mn/og-image.jpg' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Amarhan.mn - Вэб ба мобайл системийн хөгжүүлэгч' },
        { name: 'twitter:description', content: 'Таны бизнест тохирсон вэб ба мобайл системийг — хурдан, хямд, амархан бүтээнэ.' }
      ]
    }
  },
  googleFonts: {
    families: {
      'Noto+Sans': [400, 500, 600, 700],
      'Comfortaa': [400, 500, 600, 700],
      'Inter': [400, 500, 600, 700],
      'Poppins': [400, 500, 600, 700],
    },
    display: 'swap', // Optional: Use 'swap' to improve loading performance
  },
  tailwindcss: {
    exposeConfig: true,
    viewer: true,
    // and more...
  },
  // gtag: {
  //   id: 'G-H6W6F3BHKT'
  // },
  runtimeConfig: {
    // Private keys
    // FACEBOOK_ACCESS_TOKEN: "EAAYXyIAMGt4BPUsQyuV1hEQYrlAwIlknp31KauFNlhMA0asAWSVVtJfdMoroHpZCJ4tpaZA41VWr1dQFFoCtMwhRW5igVQZBjT7TrP5AIeDegbokp6CPU1RUWa0MOXcSq0jIOHZAewhsXFrOcLt5DSBt2DqZAyAGvkTIdONlWCGsKWosdp0djXr9EMZBZABWgZDZD",
    
    public: {
      // Public keys
      // FACEBOOK_PIXEL_ID: '790014570168098',
      apiBase: process.env.NUXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? 'https://rest.amarhan.mn' : 'http://localhost:4000')
    }
  },
  nitro: {
    minify: true,
    compressPublicAssets: true,
    experimental: {
      wasm: true
    }
  },
})