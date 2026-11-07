<script setup lang="ts">
import { ShieldCheck } from 'lucide-vue-next'

/**
 * Нэг удаагийн утас баталгаажуулалт — BR-28, roadmap 5.2.
 *
 * Verify.MN нэвтрэхээс ӨМНӨ бүртгүүлсэн харилцагчийн утас баталгаажаагүй —
 * өөрийн бус дугаараар бүртгүүлсэн байж болзошгүй тул ачаа/төлбөр/хүргэлт
 * хаалттай (backend `require-verified-phone.js`). `middleware/customer.ts`
 * бүх `/my/*`-ийг энд чиглүүлнэ; баталгаажмагц буцаана. Ганц л удаа.
 *
 * Утас нь токены харилцагчийнх — энд дугаар асуухгүй (дүрэм 13, 14).
 */
definePageMeta({ middleware: 'customer' })

const customer = useCustomerStore()
const route = useRoute()

const redirectTo = computed(() => {
  const target = String(route.query.redirect ?? '/my')
  // Нээлттэй redirect-ээс сэргийлнэ — зөвхөн өөрийн `/my*` зам
  return target.startsWith('/my') && !target.startsWith('/my/verify-phone') ? target : '/my'
})

onMounted(() => {
  if (customer.customer && !customer.customer.phoneVerificationRequired) {
    navigateTo(redirectTo.value, { replace: true })
  }
})

async function onVerified() {
  await customer.refresh()
  await navigateTo(redirectTo.value, { replace: true })
}

useHead({ title: 'Утас баталгаажуулах — Ивээлт Карго' })
</script>

<template>
  <div class="mx-auto max-w-sm py-8 sm:py-12">
    <div class="text-center">
      <ShieldCheck :size="34" class="mx-auto text-primary-600" :stroke-width="1.7" />
      <h1 class="mt-3 text-h2 font-bold text-content">Утсаа баталгаажуулна уу</h1>
      <p class="mt-2 text-body text-content-secondary">
        Ачаа тань утасны дугаараар холбогддог. Таны ачааг зөвхөн та харахын тулд дугаараа
        <span class="font-semibold text-content">нэг удаа</span> баталгаажуулна уу.
      </p>
    </div>

    <div class="mt-6">
      <CustomerPhoneVerification
        v-if="customer.customer?.phoneVerificationRequired"
        :start="customer.startSelfVerification"
        :check="customer.checkSelfVerification"
        @verified="onVerified"
      />
    </div>

    <p class="mt-5 text-center text-body-sm text-content-secondary">
      Дугаар буруу бүртгэгдсэн бол карго ажилтантай холбогдоно уу.
    </p>
  </div>
</template>
