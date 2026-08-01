<script setup lang="ts">
/**
 * Нүүр хуудас — introduction.md §3
 *
 * Premium landing дизайн (`layouts/landing.vue`): цагаан, glass, том типографи.
 * Бусад нээлттэй хуудсууд (`/track`, `/address`, `/help`) `layouts/default.vue`-ийн
 * нягт, ажлын дэлгэцийн дизайныг хэвээр ашиглана — энэ хуудас л онцгой.
 *
 * Хятадаас ирдэг мэдээлэл ЗӨВХӨН ачааны дугаар ба утасны дугаар (§1.1) тул
 * бүх агуулга үүнийг тусгав: "замд явж байгаа" төлөв ХАЙГГҮЙ, ачаа Монголд
 * ирсний ДАРАА бүртгэгддэг гэдгийг Hero/HowItWorks-д тодорхой бичив.
 */
definePageMeta({ layout: 'landing' })

const { content, pricing } = usePublicContent()

const { data: site } = await useAsyncData('public-content', () => content(), {
  // Backend унтарсан үед нүүр хуудас БҮХЭЛДЭЭ унах ёсгүй
  default: () => null,
})

const { data: tariff } = await useAsyncData('public-pricing', () => pricing(), {
  default: () => null,
})

const address = computed(() => site.value?.erenhot_address ?? null)
const contact = computed(() => site.value?.contact ?? null)
const faq = computed(() => site.value?.faq ?? [])
const notice = computed(() => site.value?.home_notice ?? null)

useHead({
  title: 'Ивээлт Карго — Хятадаас Монгол руу ачаа тээвэрлэлт',
  meta: [
    {
      name: 'description',
      content:
        'Ивээлт Карго — Хятадаас Монгол руу ачаа тээвэрлэх үйлчилгээ. Ачаагаа онлайнаар хянаж, төлбөрөө төлж, хүргэлт захиална.',
    },
  ],
})
</script>

<template>
  <div>
    <LandingHero :notice="notice" />
    <LandingFeatures />
    <LandingChinaAddress :address="address" />
    <LandingPricing :tariff="tariff" />
    <LandingHowItWorks />
    <LandingTrackingDemo />
    <LandingTrust />
    <LandingMongoliaWarehouse :contact="contact" />
    <LandingFaq :faq="faq" />
  </div>
</template>
