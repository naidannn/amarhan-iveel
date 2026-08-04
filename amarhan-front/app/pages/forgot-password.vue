<script setup lang="ts">
/**
 * Харилцагч нууц үг сэргээх хүсэлт — имэйлээр (Resend).
 *
 * Backend ЯГ АДИЛ хариу буцаадаг эсэхээс үл хамааран (user enumeration-оос
 * сэргийлэх) тул энд ч мөн бүртгэл олдсон эсэхийг ялгаж харуулахгүй.
 */
const customer = useCustomerStore()

const email = ref('')
const sent = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)

async function submit() {
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

useHead({ title: 'Нууц үг сэргээх — Ивээлт Карго' })
</script>

<template>
  <div class="mx-auto max-w-sm py-8 sm:py-14">
    <div class="text-center">
      <h1 class="text-h1 font-bold text-content">Нууц үг сэргээх</h1>
      <p class="mt-1.5 text-body text-content-secondary">
        Бүртгэлтэй имэйл хаягаа оруулна уу, сэргээх холбоос илгээх болно
      </p>
    </div>

    <div v-if="sent" class="mt-7 rounded-card border border-surface-border bg-surface-card p-5 text-center">
      <p class="text-body text-content">
        Хэрэв энэ имэйл бүртгэлтэй бол сэргээх холбоос илгээгдлээ. Имэйлээ шалгана уу.
      </p>
      <NuxtLink to="/login" class="mt-4 inline-block font-semibold text-primary-600 hover:underline">
        Нэвтрэх хуудас руу буцах
      </NuxtLink>
    </div>

    <form v-else class="mt-7 space-y-4" @submit.prevent="submit">
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

    <p class="mt-6 text-center text-body text-content-secondary">
      <NuxtLink to="/login" class="font-semibold text-primary-600 hover:underline">
        Нэвтрэх хуудас руу буцах
      </NuxtLink>
    </p>
  </div>
</template>
