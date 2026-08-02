<script setup lang="ts">
import { Info } from 'lucide-vue-next'

/**
 * Харилцагч бүртгүүлэх — introduction.md §3
 *
 * Утас ЗААВАЛ: ачаа зөвхөн утасны дугаараар харилцагчтай холбогддог (BR-26).
 * Бүртгүүлмэгц тухайн дугаараар өмнө бүртгэгдсэн БҮХ ачаа шууд харагдана
 * (BR-29) — үүнийг хэрэглэгчид тайлбарлаж өгнө.
 */
const customer = useCustomerStore()

const form = reactive({
  phone: '',
  name: '',
  email: '',
  password: '',
})

const error = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})

const canSubmit = computed(() => form.phone.trim().length >= 8 && form.password.length >= 8)

async function submit() {
  error.value = null
  fieldErrors.value = {}

  try {
    await customer.register({
      phone: form.phone.trim(),
      password: form.password,
      ...(form.name.trim() ? { name: form.name.trim() } : {}),
      ...(form.email.trim() ? { email: form.email.trim() } : {}),
    })
    await navigateTo('/my')
  } catch (e: any) {
    const data = e?.response?.data
    // Backend-ийн Joi алдааг талбар тус бүрт нь буулгана
    if (Array.isArray(data?.errors)) {
      for (const item of data.errors) fieldErrors.value[item.field] = item.message
    }
    error.value = data?.message ?? 'Бүртгүүлж чадсангүй. Дахин оролдоно уу'
  }
}

useHead({
  title: 'Бүртгүүлэх — Ивээлт Карго',
  meta: [
    {
      name: 'description',
      content: 'Ивээлт Карго-д харилцагчаар бүртгүүлж, ачаагаа онлайнаар хянаж эхлээрэй.',
    },
  ],
})
</script>

<template>
  <div class="mx-auto max-w-sm py-8 sm:py-12">
    <div class="text-center">
      <h1 class="text-h1 font-bold text-content">Бүртгүүлэх</h1>
    </div>

    <div
      class="mt-5 flex items-start gap-2.5 rounded-card border border-primary-200 bg-primary-50 px-4 py-3"
    >
      <Info :size="17" class="mt-0.5 shrink-0 text-primary-600" />
      <p class="text-body-sm text-content">
        Ачаа тань утасны дугаараар холбогддог. Тиймээс бүртгүүлмэгц тухайн
        дугаараар бүртгэгдсэн бүх ачаа тань шууд харагдана.
      </p>
    </div>

    <form class="mt-6 space-y-4" @submit.prevent="submit">
      <UiField
        label="Утасны дугаар"
        for="phone"
        required
        :error="fieldErrors.phone"
        hint="Карго дээр ачаа бүртгүүлэхдээ өгсөн дугаараа бичнэ үү"
      >
        <UiTextInput
          id="phone"
          v-model="form.phone"
          type="tel"
          placeholder="99112233"
          autofocus
          tabular
          :invalid="Boolean(fieldErrors.phone)"
        />
      </UiField>

      <UiField label="Нэр" for="name" :error="fieldErrors.name">
        <UiTextInput id="name" v-model="form.name" placeholder="Таны нэр" />
      </UiField>

      <UiField label="Имэйл" for="email" :error="fieldErrors.email" hint="Сонголтоор">
        <UiTextInput id="email" v-model="form.email" type="email" placeholder="name@example.mn" />
      </UiField>

      <UiField
        label="Нууц үг"
        for="password"
        required
        :error="fieldErrors.password"
        hint="Хамгийн багадаа 8 тэмдэгт"
      >
        <UiTextInput
          id="password"
          v-model="form.password"
          type="password"
          placeholder="••••••••"
          :invalid="Boolean(fieldErrors.password)"
        />
      </UiField>

      <p v-if="error && !Object.keys(fieldErrors).length" class="text-body-sm text-error">
        {{ error }}
      </p>

      <UiBtn type="submit" block :loading="customer.loading" :disabled="!canSubmit">
        Бүртгүүлэх
      </UiBtn>
    </form>

    <p class="mt-6 text-center text-body text-content-secondary">
      Бүртгэлтэй юу?
      <NuxtLink to="/login" class="font-semibold text-primary-600 hover:underline">
        Нэвтрэх
      </NuxtLink>
    </p>
  </div>
</template>
