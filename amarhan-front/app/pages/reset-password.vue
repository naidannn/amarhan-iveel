<script setup lang="ts">
/**
 * Харилцагч шинэ нууц үг тохируулах — `forgot-password.vue`-с ирсэн
 * имэйлийн холбоосоор нээгдэнэ (`?token=...`).
 */
const customer = useCustomerStore()
const route = useRoute()

const token = computed(() => String(route.query.token ?? ''))
const password = ref('')
const confirmPassword = ref('')
const done = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)

const canSubmit = computed(
  () => password.value.length >= 8 && password.value === confirmPassword.value
)

async function submit() {
  error.value = null

  if (password.value !== confirmPassword.value) {
    error.value = 'Нууц үг таарахгүй байна'
    return
  }

  loading.value = true
  try {
    await customer.resetPassword(token.value, password.value)
    done.value = true
  } catch (e: any) {
    error.value =
      e?.response?.data?.message ?? 'Нууц үг сэргээхэд алдаа гарлаа. Дахин оролдоно уу'
  } finally {
    loading.value = false
  }
}

useHead({ title: 'Шинэ нууц үг — Ивээлт Карго' })
</script>

<template>
  <div class="mx-auto max-w-sm py-8 sm:py-14">
    <div class="text-center">
      <h1 class="text-h1 font-bold text-content">Шинэ нууц үг</h1>
      <p class="mt-1.5 text-body text-content-secondary">Шинэ нууц үгээ тохируулна уу</p>
    </div>

    <div v-if="!token" class="mt-7 rounded-card border border-surface-border bg-surface-card p-5 text-center">
      <p class="text-body text-content">Холбоос буруу байна. Сэргээх хүсэлтээ дахин илгээнэ үү.</p>
      <NuxtLink to="/forgot-password" class="mt-4 inline-block font-semibold text-primary-600 hover:underline">
        Дахин илгээх
      </NuxtLink>
    </div>

    <div v-else-if="done" class="mt-7 rounded-card border border-surface-border bg-surface-card p-5 text-center">
      <p class="text-body text-content">Нууц үг амжилттай солигдлоо.</p>
      <NuxtLink to="/login" class="mt-4 inline-block font-semibold text-primary-600 hover:underline">
        Нэвтрэх
      </NuxtLink>
    </div>

    <form v-else class="mt-7 space-y-4" @submit.prevent="submit">
      <UiField label="Шинэ нууц үг" for="password" required>
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

      <UiBtn type="submit" block :loading="loading" :disabled="!canSubmit">
        Нууц үг солих
      </UiBtn>
    </form>
  </div>
</template>
