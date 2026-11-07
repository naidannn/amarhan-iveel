<script setup lang="ts">
import type { PhoneVerification } from '~/stores/customer'

/**
 * Харилцагч нууц үг сэргээх.
 *
 * Үндсэн зам — УТСААР (roadmap 5.2, Verify.MN): дугаар → өөрийн утаснаас
 * SMS илгээх → шинэ нууц үг → шууд нэвтэрнэ. Бүх харилцагчид утас байдаг
 * (BR-26), имэйл байхгүй нь олон.
 *
 * Нөөц зам — ИМЭЙЛЭЭР (Resend). Backend бүртгэл олдсон эсэхээс үл хамааран
 * ЯГ АДИЛ хариу буцаадаг (user enumeration) тул энд ч ялгаж харуулахгүй.
 */
const customer = useCustomerStore()

const mode = ref<'phone' | 'email'>('phone')

// ── Утсаар ──────────────────────────────────────────────────────────────
const phone = ref('')
const phoneStep = ref<'phone' | 'verify' | 'password'>('phone')
const verificationToken = ref('')
const password = ref('')
const confirmPassword = ref('')
let firstSession: PhoneVerification | null = null

// ── Имэйлээр ────────────────────────────────────────────────────────────
const email = ref('')
const sent = ref(false)

const loading = ref(false)
const error = ref<string | null>(null)

const canReset = computed(
  () => password.value.length >= 8 && password.value === confirmPassword.value
)

async function startPhone() {
  error.value = null
  loading.value = true
  // Бүртгэлгүй дугаарт SMS дэмий илгээгдэхээс өмнө backend `404` буцаана
  try {
    firstSession = await customer.startVerification(phone.value.trim(), 'reset_password')
    phoneStep.value = 'verify'
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Хүсэлт илгээхэд алдаа гарлаа. Дахин оролдоно уу'
    // Verify.MN тохируулаагүй орчинд имэйлийн зам л үлдэнэ
    if (e?.response?.data?.code === 'PHONE_VERIFICATION_DISABLED') mode.value = 'email'
  } finally {
    loading.value = false
  }
}

async function startSession() {
  if (firstSession) {
    const session = firstSession
    firstSession = null
    return session
  }
  return customer.startVerification(phone.value.trim(), 'reset_password')
}

function onVerified(token: string) {
  verificationToken.value = token
  phoneStep.value = 'password'
}

async function resetWithPhone() {
  error.value = null
  if (password.value !== confirmPassword.value) {
    error.value = 'Нууц үг таарахгүй байна'
    return
  }

  loading.value = true
  try {
    await customer.resetPasswordWithPhone(
      phone.value.trim(),
      verificationToken.value,
      password.value
    )
    await navigateTo('/my')
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Нууц үг сэргээхэд алдаа гарлаа. Дахин оролдоно уу'
    // Баталгаажуулалт хүчингүй болсон (30 минут өнгөрсөн гэх мэт) — дахин эхэлнэ
    if (e?.response?.data?.code === 'PHONE_VERIFICATION_REQUIRED') phoneStep.value = 'phone'
  } finally {
    loading.value = false
  }
}

async function submitEmail() {
  error.value = null
  loading.value = true
  try {
    await customer.forgotPassword(email.value.trim())
    sent.value = true
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Хүсэлт илгээхэд алдаа гарлаа. Дахин оролдоно уу'
  } finally {
    loading.value = false
  }
}

function switchMode(next: 'phone' | 'email') {
  mode.value = next
  error.value = null
}

useHead({ title: 'Нууц үг сэргээх — Ивээлт Карго' })
</script>

<template>
  <div class="mx-auto max-w-sm py-8 sm:py-14">
    <div class="text-center">
      <h1 class="text-h1 font-bold text-content">Нууц үг сэргээх</h1>
      <p class="mt-1.5 text-body text-content-secondary">
        {{
          mode === 'phone'
            ? 'Бүртгэлтэй утасны дугаараа баталгаажуулж шинэ нууц үг тохируулна'
            : 'Бүртгэлтэй имэйл хаягаа оруулна уу, сэргээх холбоос илгээх болно'
        }}
      </p>
    </div>

    <!-- ── Утсаар ─────────────────────────────────────────────────────── -->
    <template v-if="mode === 'phone'">
      <form v-if="phoneStep === 'phone'" class="mt-7 space-y-4" @submit.prevent="startPhone">
        <UiField label="Утасны дугаар" for="phone" required :error="error">
          <UiTextInput
            id="phone"
            v-model="phone"
            type="tel"
            placeholder="99112233"
            autofocus
            tabular
            :invalid="Boolean(error)"
          />
        </UiField>

        <UiBtn type="submit" block :loading="loading" :disabled="phone.trim().length < 8">
          Үргэлжлүүлэх
        </UiBtn>
      </form>

      <div v-else-if="phoneStep === 'verify'" class="mt-7">
        <CustomerPhoneVerification
          :start="startSession"
          :check="customer.checkVerification"
          @verified="onVerified"
        />
        <button
          type="button"
          class="mt-4 w-full text-center text-body-sm font-medium text-content-secondary hover:text-content"
          @click="phoneStep = 'phone'"
        >
          ← Дугаар засах
        </button>
      </div>

      <form v-else class="mt-7 space-y-4" @submit.prevent="resetWithPhone">
        <UiField label="Шинэ нууц үг" for="password" required hint="Хамгийн багадаа 8 тэмдэгт">
          <UiTextInput
            id="password"
            v-model="password"
            type="password"
            placeholder="••••••••"
            autofocus
            :invalid="Boolean(error)"
          />
        </UiField>

        <UiField label="Нууц үг давтах" for="confirmPassword" required :error="error">
          <UiTextInput
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            placeholder="••••••••"
            :invalid="Boolean(error)"
          />
        </UiField>

        <UiBtn type="submit" block :loading="loading" :disabled="!canReset"> Нууц үг солих </UiBtn>
      </form>

      <p v-if="phoneStep === 'phone'" class="mt-4 text-center text-body-sm text-content-secondary">
        <button
          type="button"
          class="font-medium text-primary-600 hover:underline"
          @click="switchMode('email')"
        >
          Имэйлээр сэргээх
        </button>
      </p>
    </template>

    <!-- ── Имэйлээр ───────────────────────────────────────────────────── -->
    <template v-else>
      <div
        v-if="sent"
        class="mt-7 rounded-card border border-surface-border bg-surface-card p-5 text-center"
      >
        <p class="text-body text-content">
          Хэрэв энэ имэйл бүртгэлтэй бол сэргээх холбоос илгээгдлээ. Имэйлээ шалгана уу.
        </p>
      </div>

      <form v-else class="mt-7 space-y-4" @submit.prevent="submitEmail">
        <UiField label="Имэйл" for="email" required :error="error">
          <UiTextInput
            id="email"
            v-model="email"
            type="email"
            placeholder="taniy@mail.com"
            autofocus
            :invalid="Boolean(error)"
          />
        </UiField>

        <UiBtn type="submit" block :loading="loading" :disabled="!email.trim()">
          Сэргээх холбоос илгээх
        </UiBtn>
      </form>

      <p class="mt-4 text-center text-body-sm text-content-secondary">
        <button
          type="button"
          class="font-medium text-primary-600 hover:underline"
          @click="switchMode('phone')"
        >
          Утсаар сэргээх
        </button>
      </p>
    </template>

    <p class="mt-6 text-center text-body text-content-secondary">
      <NuxtLink to="/login" class="font-semibold text-primary-600 hover:underline">
        Нэвтрэх хуудас руу буцах
      </NuxtLink>
    </p>
  </div>
</template>
