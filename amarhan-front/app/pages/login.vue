<script setup lang="ts">
import { Truck } from 'lucide-vue-next'

/**
 * Харилцагчийн нэвтрэх хуудас — introduction.md §3
 *
 * АЖИЛТНЫ `/admin/login`-ООС ТУСДАА: өөр store, өөр endpoint, өөр токен
 * (`aud: 'customer'`). Хоёрыг нэгтгэвэл нэг формоос хоёр өөр эрхийн
 * систем рүү нэвтрэх болж, аль нь ажилласныг ялгах боломжгүй болно.
 */
const customer = useCustomerStore()
const route = useRoute()
const config = useRuntimeConfig()

const identifier = ref('')
const password = ref('')
const error = ref<string | null>(null)

const redirect = computed(() => (route.query.redirect as string) || '/my')

// Google-ээр нэвтрэх нь браузерын бүтэн шилжилт — backend нь OAuth-ийн
// урсгалыг хөтөлж, дуусахад `/auth/google` руу токентой буцаана.
const googleUrl = computed(
  () => `${config.public.apiBase || 'http://localhost:4000'}/api/v1/customer/auth/google`
)

async function submit() {
  error.value = null
  try {
    await customer.login(identifier.value.trim(), password.value)
    await navigateTo(redirect.value)
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Нэвтэрч чадсангүй. Дахин оролдоно уу'
  }
}

// Аль хэдийн нэвтэрсэн бол нэвтрэх формыг харуулах шаардлагагүй
onMounted(async () => {
  if (await customer.checkAuth()) await navigateTo(redirect.value)
})

useHead({ title: 'Нэвтрэх — Ивээл Карго' })
</script>

<template>
  <div class="mx-auto max-w-sm py-8 sm:py-14">
    <div class="text-center">
      <div
        class="mx-auto flex h-11 w-11 items-center justify-center rounded-btn bg-primary text-content-inverse"
      >
        <Truck :size="22" :stroke-width="2.2" />
      </div>
      <h1 class="mt-4 text-h1 font-bold text-content">Нэвтрэх</h1>
      <p class="mt-1.5 text-body text-content-secondary">
        Утасны дугаар эсвэл имэйлээрээ нэвтэрнэ үү
      </p>
    </div>

    <form class="mt-7 space-y-4" @submit.prevent="submit">
      <UiField label="Утас эсвэл имэйл" for="identifier" required>
        <UiTextInput
          id="identifier"
          v-model="identifier"
          placeholder="99112233"
          autofocus
          :invalid="Boolean(error)"
        />
      </UiField>

      <UiField label="Нууц үг" for="password" required :error="error">
        <UiTextInput
          id="password"
          v-model="password"
          type="password"
          placeholder="••••••••"
          :invalid="Boolean(error)"
        />
      </UiField>

      <UiBtn
        type="submit"
        block
        :loading="customer.loading"
        :disabled="!identifier.trim() || !password"
      >
        Нэвтрэх
      </UiBtn>
    </form>

    <div class="my-5 flex items-center gap-3">
      <span class="h-px flex-1 bg-surface-border" />
      <span class="text-body-sm text-content-secondary">эсвэл</span>
      <span class="h-px flex-1 bg-surface-border" />
    </div>

    <!--
      `<a>` тагаар, `NuxtLink`-ээр БИШ: энэ нь Nuxt-ийн дотоод route биш,
      backend руу хийх БҮТЭН браузерын шилжилт (OAuth). NuxtLink нь client
      талын навигац хийх гэж оролдоод унана.
    -->
    <a
      :href="googleUrl"
      class="flex h-control w-full items-center justify-center gap-2 rounded-btn border border-surface-border bg-surface-card text-body font-semibold text-content transition-colors duration-200 hover:bg-surface-hover"
    >
      <svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z"
        />
        <path
          fill="#EA4335"
          d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.14 6.16-4.14z"
        />
      </svg>
      Google-ээр нэвтрэх
    </a>

    <p class="mt-6 text-center text-body text-content-secondary">
      Бүртгэлгүй юу?
      <NuxtLink to="/register" class="font-semibold text-primary-600 hover:underline">
        Бүртгүүлэх
      </NuxtLink>
    </p>
  </div>
</template>
