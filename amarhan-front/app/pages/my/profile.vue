<script setup lang="ts">
import { Plus, Trash2, ShieldCheck, Info } from 'lucide-vue-next'

/**
 * Профайл — introduction.md §3
 *
 * УТАСНЫ ДУГААР ЗАСВАРЛАГДАХГҮЙ. Ачаа зөвхөн утсаар харилцагчтай
 * холбогддог (BR-26) тул баталгаажуулалтгүйгээр утсаа солих боломж нь
 * өөр хүний ачааг харах зам болно. Backend талд ч энэ талбар хаалттай
 * (`customer-auth.validation.js`). Солих шаардлагатай бол ажилтан
 * хийж, audit-д бүртгэгдэнэ.
 */
definePageMeta({ middleware: 'customer' })

const customer = useCustomerStore()
const { $axios } = useNuxtApp()
const toast = useToast()

const profile = reactive({ name: '', email: '' })
const addresses = ref<{ label?: string; address: string; note?: string }[]>([])
const passwords = reactive({ currentPassword: '', newPassword: '' })

const savingProfile = ref(false)
const savingAddresses = ref(false)
const savingPassword = ref(false)
const passwordError = ref<string | null>(null)

const TIER_LABELS: Record<string, string> = {
  bronze: 'Хүрэл',
  silver: 'Мөнгө',
  gold: 'Алт',
}

onMounted(() => {
  const data = customer.customer
  if (!data) return
  profile.name = data.name ?? ''
  profile.email = data.email ?? ''
  addresses.value = data.addresses?.map(a => ({ ...a })) ?? []
})

async function saveProfile() {
  savingProfile.value = true
  try {
    await $axios.put('/api/v1/customer/me', {
      name: profile.name.trim(),
      email: profile.email.trim(),
    })
    await customer.refresh()
    toast.success('Профайл хадгалагдлаа')
  } catch (e: any) {
    toast.error(e?.response?.data?.message ?? 'Хадгалж чадсангүй')
  } finally {
    savingProfile.value = false
  }
}

async function saveAddresses() {
  savingAddresses.value = true
  try {
    await $axios.put('/api/v1/customer/me/addresses', {
      addresses: addresses.value.filter(a => a.address?.trim()),
    })
    await customer.refresh()
    toast.success('Хаяг хадгалагдлаа')
  } catch (e: any) {
    toast.error(e?.response?.data?.message ?? 'Хадгалж чадсангүй')
  } finally {
    savingAddresses.value = false
  }
}

async function savePassword() {
  passwordError.value = null
  savingPassword.value = true
  try {
    await $axios.post('/api/v1/customer/auth/change-password', {
      currentPassword: passwords.currentPassword,
      newPassword: passwords.newPassword,
    })
    passwords.currentPassword = ''
    passwords.newPassword = ''
    await customer.refresh()
    toast.success('Нууц үг солигдлоо')
  } catch (e: any) {
    passwordError.value = e?.response?.data?.message ?? 'Нууц үг солиж чадсангүй'
  } finally {
    savingPassword.value = false
  }
}

useHead({ title: 'Профайл — Ивээл Карго' })
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-4">
    <h1 class="text-h1 font-bold text-content">Профайл</h1>

    <!-- Үндсэн мэдээлэл -->
    <section class="rounded-card border border-surface-border bg-surface-card p-5">
      <h2 class="font-semibold text-content">Хувийн мэдээлэл</h2>

      <div class="mt-4 space-y-4">
        <UiField label="Утасны дугаар" hint="Утас солих бол ажилтантай холбогдоно уу">
          <UiTextInput :model-value="customer.customer?.phone" readonly tabular />
        </UiField>

        <UiField label="Нэр" for="name">
          <UiTextInput id="name" v-model="profile.name" placeholder="Таны нэр" />
        </UiField>

        <UiField label="Имэйл" for="email">
          <UiTextInput id="email" v-model="profile.email" type="email" placeholder="name@example.mn" />
        </UiField>

        <UiBtn :loading="savingProfile" @click="saveProfile">Хадгалах</UiBtn>
      </div>
    </section>

    <!-- Урамшуулал (§4) -->
    <section class="rounded-card border border-surface-border bg-surface-card p-5">
      <h2 class="font-semibold text-content">Урамшуулал</h2>
      <dl class="mt-3 grid grid-cols-2 gap-3">
        <div>
          <dt class="text-body-sm text-content-secondary">Түвшин</dt>
          <dd class="font-semibold text-content">
            {{ TIER_LABELS[customer.customer?.loyaltyTier ?? 'bronze'] }}
          </dd>
        </div>
        <div>
          <dt class="text-body-sm text-content-secondary">Оноо</dt>
          <dd class="font-semibold tabular text-content">
            {{ customer.customer?.loyaltyPoints ?? 0 }}
          </dd>
        </div>
      </dl>
    </section>

    <!-- Хүргэлтийн хаяг (§5) -->
    <section class="rounded-card border border-surface-border bg-surface-card p-5">
      <div class="flex items-center justify-between">
        <h2 class="font-semibold text-content">Хүргэлтийн хаяг</h2>
        <UiBtn
          size="sm"
          variant="secondary"
          :icon="Plus"
          :disabled="addresses.length >= 10"
          @click="addresses.push({ label: '', address: '', note: '' })"
        >
          Нэмэх
        </UiBtn>
      </div>

      <p v-if="!addresses.length" class="mt-4 text-body-sm text-content-secondary">
        Хаяг бүртгээгүй байна. Хүргэлт захиалахад ашиглагдана.
      </p>

      <div v-else class="mt-4 space-y-4">
        <div
          v-for="(address, index) in addresses"
          :key="index"
          class="space-y-3 rounded-btn border border-surface-border p-3.5"
        >
          <div class="flex gap-2">
            <UiTextInput v-model="address.label" placeholder="Нэр (Гэр, Ажил)" class="flex-1" />
            <UiBtn
              variant="ghost"
              size="sm"
              :icon="Trash2"
              aria-label="Хаяг устгах"
              @click="addresses.splice(index, 1)"
            />
          </div>
          <UiTextArea v-model="address.address" placeholder="Дүүрэг, хороо, байр, тоот" :rows="2" />
          <UiTextInput v-model="address.note" placeholder="Нэмэлт тайлбар (сонголтоор)" />
        </div>

        <UiBtn :loading="savingAddresses" @click="saveAddresses">Хаяг хадгалах</UiBtn>
      </div>
    </section>

    <!-- Нууц үг -->
    <section class="rounded-card border border-surface-border bg-surface-card p-5">
      <h2 class="font-semibold text-content">
        {{ customer.customer?.hasPassword ? 'Нууц үг солих' : 'Нууц үг тавих' }}
      </h2>

      <div
        v-if="!customer.customer?.hasPassword"
        class="mt-3 flex items-start gap-2.5 rounded-btn bg-primary-50 px-3.5 py-2.5"
      >
        <Info :size="16" class="mt-0.5 shrink-0 text-primary-600" />
        <p class="text-body-sm text-content">
          Та Google-ээр нэвтэрсэн байна. Нууц үг тавибал утсаараа ч нэвтрэх боломжтой болно.
        </p>
      </div>

      <div class="mt-4 space-y-4">
        <UiField v-if="customer.customer?.hasPassword" label="Одоогийн нууц үг" for="current">
          <UiTextInput id="current" v-model="passwords.currentPassword" type="password" />
        </UiField>

        <UiField
          label="Шинэ нууц үг"
          for="new-password"
          required
          :error="passwordError"
          hint="Хамгийн багадаа 8 тэмдэгт"
        >
          <UiTextInput
            id="new-password"
            v-model="passwords.newPassword"
            type="password"
            :invalid="Boolean(passwordError)"
          />
        </UiField>

        <UiBtn
          :icon="ShieldCheck"
          :loading="savingPassword"
          :disabled="passwords.newPassword.length < 8"
          @click="savePassword"
        >
          Хадгалах
        </UiBtn>
      </div>
    </section>
  </div>
</template>
