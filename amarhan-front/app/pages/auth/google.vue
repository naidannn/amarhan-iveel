<script setup lang="ts">
import { Loader2, AlertCircle } from 'lucide-vue-next'
import type { PhoneVerification } from '~/stores/customer'

/**
 * Google OAuth-ийн буцах хуудас — introduction.md §3
 *
 * Backend нь URL-ийн FRAGMENT (`#`)-д хариу тавьж энэ хуудас руу
 * чиглүүлнэ. Query (`?`)-д БИШ байгаа шалтгаан: fragment нь HTTP хүсэлтэд
 * илгээгддэггүй тул токен серверийн access log, proxy, referrer-т үлдэхгүй.
 *
 * Гурван төгсгөл:
 *   `#token=…`    бүртгэлтэй   → шууд нэвтэрнэ
 *   `#pending=…`  бүртгэлгүй   → утсаа өгнө (BR-26 — утасгүй бүртгэл байхгүй)
 *   `#error=…`    амжилтгүй
 */
definePageMeta({ layout: 'default' })

const customer = useCustomerStore()

const state = ref<'loading' | 'needPhone' | 'verify' | 'error'>('loading')
const pendingToken = ref('')
const errorMessage = ref('')

const phone = ref('')
const name = ref('')
const formError = ref<string | null>(null)

const ERRORS: Record<string, string> = {
  blocked: 'Таны бүртгэл хаагдсан байна. Ажилтантай холбогдоно уу.',
  google_failed: 'Google-ээс мэдээлэл авч чадсангүй. Дахин оролдоно уу.',
}

onMounted(async () => {
  // `useRoute().hash` нь `#`-тэй хамт ирнэ
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))

  const token = params.get('token')
  const pending = params.get('pending')
  const error = params.get('error')

  // Токеныг хаягийн мөрөнд үлдээхгүй — хэрэглэгч линкээ хуваалцвал
  // нэвтрэлт нь хамт явахгүй байх ёстой
  history.replaceState(null, '', window.location.pathname)

  if (error || (!token && !pending)) {
    state.value = 'error'
    errorMessage.value = ERRORS[error ?? ''] ?? 'Нэвтрэлт амжилтгүй боллоо.'
    return
  }

  if (token) {
    try {
      await customer.adoptToken(token)
      await navigateTo('/my')
    } catch {
      state.value = 'error'
      errorMessage.value = 'Нэвтрэлтийг баталгаажуулж чадсангүй.'
    }
    return
  }

  pendingToken.value = pending!
  state.value = 'needPhone'
})

const checking = ref(false)
let firstSession: PhoneVerification | null = null

/**
 * Roadmap 5.2 — утсаа баталгаажуулсны дараа л бүртгэл дуусна. Verify.MN
 * тохируулаагүй орчинд (`PHONE_VERIFICATION_DISABLED`) шууд дуусгана.
 */
async function complete() {
  formError.value = null
  checking.value = true
  try {
    firstSession = await customer.startVerification(phone.value.trim(), 'register')
    state.value = 'verify'
  } catch (e: any) {
    if (e?.response?.data?.code === 'PHONE_VERIFICATION_DISABLED') {
      await finish()
    } else {
      formError.value = e?.response?.data?.message ?? 'Бүртгэлээ дуусгаж чадсангүй'
    }
  } finally {
    checking.value = false
  }
}

async function startSession() {
  if (firstSession) {
    const session = firstSession
    firstSession = null
    return session
  }
  return customer.startVerification(phone.value.trim(), 'register')
}

async function finish(verificationToken?: string) {
  try {
    await customer.completeGoogle(
      pendingToken.value,
      phone.value.trim(),
      name.value.trim(),
      verificationToken
    )
    await navigateTo('/my')
  } catch (e: any) {
    state.value = 'needPhone'
    formError.value = e?.response?.data?.message ?? 'Бүртгэлээ дуусгаж чадсангүй'
  }
}

useHead({ title: 'Google-ээр нэвтрэх — Ивээлт Карго' })
</script>

<template>
  <div class="mx-auto max-w-sm py-10 sm:py-16">
    <!-- Токен солилцож байна -->
    <div v-if="state === 'loading'" class="text-center">
      <Loader2 :size="28" class="mx-auto animate-spin text-primary" />
      <p class="mt-3 text-body text-content-secondary">Нэвтэрч байна…</p>
    </div>

    <!-- Утас шаардлагатай (BR-26) -->
    <div v-else-if="state === 'needPhone'">
      <h1 class="text-h1 font-bold text-content">Бараг боллоо</h1>
      <p class="mt-2 text-body text-content-secondary">
        Ачаа тань утасны дугаараар холбогддог. Карго дээр ачаа бүртгүүлэхдээ
        өгсөн дугаараа бичээд бүртгэлээ дуусгана уу.
      </p>

      <form class="mt-6 space-y-4" @submit.prevent="complete">
        <UiField label="Утасны дугаар" for="phone" required :error="formError">
          <UiTextInput
            id="phone"
            v-model="phone"
            type="tel"
            placeholder="99112233"
            autofocus
            tabular
            :invalid="Boolean(formError)"
          />
        </UiField>

        <UiField label="Нэр" for="name">
          <UiTextInput id="name" v-model="name" placeholder="Таны нэр" />
        </UiField>

        <UiBtn
          type="submit"
          block
          :loading="checking || customer.loading"
          :disabled="phone.trim().length < 8"
        >
          Үргэлжлүүлэх
        </UiBtn>
      </form>
    </div>

    <!-- Утас баталгаажуулах (roadmap 5.2) -->
    <div v-else-if="state === 'verify'">
      <h1 class="text-h1 font-bold text-content">Утсаа баталгаажуулна уу</h1>
      <div class="mt-6">
        <CustomerPhoneVerification
          :start="startSession"
          :check="customer.checkVerification"
          @verified="finish"
        />
      </div>
      <button
        type="button"
        class="mt-4 w-full text-center text-body-sm font-medium text-content-secondary hover:text-content"
        @click="state = 'needPhone'"
      >
        ← Дугаар засах
      </button>
    </div>

    <!-- Алдаа -->
    <div v-else class="text-center">
      <AlertCircle :size="34" class="mx-auto text-error" :stroke-width="1.7" />
      <h1 class="mt-3 font-semibold text-content">Нэвтэрч чадсангүй</h1>
      <p class="mt-1.5 text-body-sm text-content-secondary">{{ errorMessage }}</p>
      <UiBtn to="/login" class="mt-5">Буцах</UiBtn>
    </div>
  </div>
</template>
