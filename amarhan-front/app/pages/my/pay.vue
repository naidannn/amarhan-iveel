<script setup lang="ts">
import { Landmark, Smartphone, Copy, Check, ArrowLeft, Wallet } from 'lucide-vue-next'
import { formatCurrency } from '~/utils/currency'
import type { CreatedPackagePayment } from '~/composables/useCustomerPortal'

/**
 * Ачааны үлдэгдлийг шууд төлөх — хүргэлт захиалахгүйгээр.
 *
 * Ачааны дэлгэрэнгүй хуудаснаас `?packageId=`-аар ирвэл ЗӨВХӨН тэр ачааг
 * сонгоно (нэгээр нь төлөх), эс тэгвээс бүх төлбөртэй ачаа автоматаар
 * сонгогдоно (олноор нь төлөх) — `deliveries/new.vue`-ийн ижил хэв маяг.
 */
definePageMeta({ middleware: 'customer' })
useHead({ title: 'Төлбөр төлөх — Ивээлт Карго' })

const route = useRoute()
const portal = useCustomerPortal()
const toast = useToast()
const { style, label } = usePackageStatus()

const loading = ref(true)
const submitting = ref(false)
const packages = ref<Awaited<ReturnType<typeof portal.payablePackages>>['packages']>([])
const bankAccount = ref<Awaited<ReturnType<typeof portal.payablePackages>>['bankAccount']>(null)
const selected = ref<string[]>([])
const copied = ref(false)
const method = ref<'bank' | 'qpay'>('bank')

const result = ref<CreatedPackagePayment | null>(null)

// ── QPay төлбөрийн байдлыг polling хийх (deliveries/new.vue-тэй ижил) ─────
const qpayStatus = ref<'pending' | 'completed' | 'timeout'>('pending')
let pollTimer: ReturnType<typeof setInterval> | null = null
let pollStartedAt = 0
const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 10 * 60 * 1000

function stopPolling() {
  if (pollTimer) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }
}

function startPolling(paymentId: string) {
  qpayStatus.value = 'pending'
  pollStartedAt = Date.now()
  pollTimer = window.setInterval(async () => {
    if (Date.now() - pollStartedAt > POLL_TIMEOUT_MS) {
      qpayStatus.value = 'timeout'
      stopPolling()
      return
    }
    try {
      const payment = await portal.getPayment(paymentId)
      if (payment.status === 'completed') {
        qpayStatus.value = 'completed'
        stopPolling()
      }
    } catch {
      // Сүлжээний түр алдаа — дараагийн интервалд дахин оролдоно
    }
  }, POLL_INTERVAL_MS)
}

onBeforeUnmount(stopPolling)

async function load() {
  loading.value = true
  try {
    const data = await portal.payablePackages()
    packages.value = data.packages
    bankAccount.value = data.bankAccount

    const preselect = String(route.query.packageId ?? '')
    const hasPreselect = preselect && data.packages.some(p => p.id === preselect)
    selected.value = hasPreselect ? [preselect] : data.packages.map(p => p.id)
  } catch (e: any) {
    toast.error('Ачаа ачаалагдсангүй', {
      description: e?.response?.data?.message ?? e.message,
    })
  } finally {
    loading.value = false
  }
}

onMounted(load)

function toggle(id: string) {
  selected.value = selected.value.includes(id)
    ? selected.value.filter(x => x !== id)
    : [...selected.value, id]
}

const selectedPackages = computed(() => packages.value.filter(p => selected.value.includes(p.id)))
const total = computed(() => selectedPackages.value.reduce((sum, p) => sum + Math.max(p.balance, 0), 0))

const bankAccountText = computed(() => {
  const b = bankAccount.value
  if (!b) return ''
  return [b.bankName, b.accountNumber, b.accountHolder].filter(Boolean).join('\n')
})

async function copyBankAccount() {
  if (!bankAccountText.value) return
  try {
    await navigator.clipboard.writeText(bankAccountText.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    // Clipboard эрх өгөөгүй ч төлбөрт саад болохгүй
  }
}

const canSubmit = computed(() => !submitting.value && selected.value.length > 0)

async function submit() {
  if (!canSubmit.value) return

  submitting.value = true
  try {
    const payment = await portal.payPackages({
      packageIds: selected.value,
      method: method.value,
    })
    result.value = payment
    if (payment.method === 'qpay') {
      startPolling(payment.id)
    }
  } catch (e: any) {
    toast.error('Төлбөр үүсгэж чадсангүй', {
      description: e?.response?.data?.message ?? e.message,
      duration: 9000,
    })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-5">
    <div class="flex items-center gap-3">
      <NuxtLink
        to="/my/packages"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn border border-surface-border text-content-secondary hover:bg-surface-hover"
      >
        <ArrowLeft :size="18" />
      </NuxtLink>
      <div>
        <h1 class="text-h1 font-bold text-content">Төлбөр төлөх</h1>
        <p class="mt-0.5 text-body text-content-secondary">
          Үлдэгдэлтэй ачаагаа сонгоод Данс эсвэл QPay-ээр төлнө
        </p>
      </div>
    </div>

    <!-- ── Үүсгэсний дараах баталгаажуулах дэлгэц ────────────────────────── -->
    <div v-if="result" class="card space-y-4 text-center">
      <Wallet
        v-if="result.method === 'bank' || qpayStatus === 'completed'"
        :size="40"
        class="mx-auto text-success"
        :stroke-width="1.6"
      />
      <Smartphone v-else :size="40" class="mx-auto text-primary" :stroke-width="1.6" />
      <div>
        <p v-if="result.method === 'bank'" class="mx-auto max-w-md text-body text-content-secondary">
          Доорх дансанд <strong class="tabular text-content">{{ formatCurrency(result.amount) }}</strong>
          шилжүүлнэ үү. Ажилтан гүйлгээг баталгаажуулмагц үлдэгдэл барагдана.
        </p>
        <template v-else>
          <p v-if="qpayStatus === 'completed'" class="mx-auto max-w-md text-body font-medium text-success">
            Төлбөр амжилттай хийгдлээ!
          </p>
          <p v-else-if="qpayStatus === 'timeout'" class="mx-auto max-w-md text-body text-content-secondary">
            Төлбөр хараахан батлагдаагүй байна. «Миний төлбөр» хуудаснаас дараа дахин шалгана уу.
          </p>
          <p v-else class="mx-auto max-w-md text-body text-content-secondary">
            <strong class="tabular text-content">{{ formatCurrency(result.amount) }}</strong>
            дүнгээр доорх QR кодыг банкны апп-аараа уншуулж төлнө үү.
          </p>
        </template>
      </div>

      <div
        v-if="result.method === 'bank' && bankAccount"
        class="mx-auto max-w-sm rounded-card border border-surface-border bg-surface-hover px-4 py-3.5 text-left"
      >
        <div class="flex items-center justify-between gap-3">
          <p class="text-body-sm font-semibold text-content">Дансны мэдээлэл</p>
          <button
            type="button"
            class="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-body-sm font-medium transition-colors"
            :class="
              copied
                ? 'bg-primary-600 text-white'
                : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
            "
            @click="copyBankAccount"
          >
            <component :is="copied ? Check : Copy" :size="13" />
            {{ copied ? 'Хуулагдлаа' : 'Хуулах' }}
          </button>
        </div>
        <dl class="mt-2 space-y-1 text-body-sm">
          <div v-if="bankAccount.bankName" class="flex justify-between gap-3">
            <dt class="text-content-secondary">Банк</dt>
            <dd class="font-medium text-content">{{ bankAccount.bankName }}</dd>
          </div>
          <div v-if="bankAccount.accountNumber" class="flex justify-between gap-3">
            <dt class="text-content-secondary">Дансны дугаар</dt>
            <dd class="tabular font-medium text-content">{{ bankAccount.accountNumber }}</dd>
          </div>
          <div v-if="bankAccount.accountHolder" class="flex justify-between gap-3">
            <dt class="text-content-secondary">Эзэмшигч</dt>
            <dd class="font-medium text-content">{{ bankAccount.accountHolder }}</dd>
          </div>
        </dl>
      </div>

      <template v-if="result.method === 'qpay' && qpayStatus === 'pending' && result.qpay">
        <img
          v-if="result.qpay.qrImage"
          :src="`data:image/png;base64,${result.qpay.qrImage}`"
          alt="QPay QR код"
          class="mx-auto h-48 w-48 rounded-card border border-surface-border bg-white p-2"
        />
        <div v-if="result.qpay.urls?.length" class="flex flex-wrap justify-center gap-2">
          <a
            v-for="u in result.qpay.urls"
            :key="u.name"
            :href="u.link"
            class="rounded-full border border-surface-border px-3 py-1.5 text-body-sm text-content hover:bg-surface-hover"
          >
            {{ u.description }}
          </a>
        </div>
        <p class="text-body-sm text-content-secondary">Хүлээгдэж байна…</p>
      </template>

      <UiBtn to="/my/packages">Ачааны жагсаалт руу очих</UiBtn>
    </div>

    <!-- ── Төлбөрийн маягт ────────────────────────────────────────────────── -->
    <template v-else>
      <p v-if="loading" class="py-10 text-center text-body text-content-secondary">
        Ачаалж байна…
      </p>

      <div
        v-else-if="!packages.length"
        class="rounded-card border border-surface-border bg-surface-card px-5 py-14 text-center"
      >
        <Wallet :size="34" class="mx-auto text-content-disabled" :stroke-width="1.6" />
        <p class="mt-3 text-body text-content">Төлөх үлдэгдэлтэй ачаа алга байна</p>
      </div>

      <template v-else>
        <div class="card space-y-3">
          <p class="text-body-sm font-medium text-content-secondary">
            Төлөх ачаа ({{ selected.length }}/{{ packages.length }})
          </p>
          <ul class="space-y-2">
            <li
              v-for="p in packages"
              :key="p.id"
              class="flex cursor-pointer items-center gap-3 rounded-card border border-surface-border px-3 py-2.5 transition-colors hover:bg-surface-hover"
              :class="selected.includes(p.id) ? 'border-primary-300 bg-primary-50/40' : ''"
              @click="toggle(p.id)"
            >
              <input
                type="checkbox"
                class="h-4 w-4 shrink-0 cursor-pointer rounded border-surface-border text-primary focus:ring-2 focus:ring-primary-200"
                :checked="selected.includes(p.id)"
                :aria-label="`${p.trackingNumber} сонгох`"
                @click.stop
                @change="toggle(p.id)"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold tabular text-content">{{ p.trackingNumber }}</p>
                <span class="text-body-sm" :style="{ color: style(p.status).color }">
                  {{ label(p.status) }}
                </span>
              </div>
              <p class="tabular shrink-0 text-body font-semibold text-warning">
                {{ formatCurrency(p.balance) }}
              </p>
            </li>
          </ul>
        </div>

        <!-- Төлбөрийн хэлбэр -->
        <div class="card space-y-3">
          <p class="text-body-sm font-medium text-content-secondary">Төлбөрийн хэлбэр</p>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="flex items-center justify-center gap-2 rounded-btn border px-3 py-2.5 text-body font-medium transition-colors"
              :class="
                method === 'bank'
                  ? 'border-primary-300 bg-primary-50 text-primary-700'
                  : 'border-surface-border text-content-secondary hover:bg-surface-hover'
              "
              @click="method = 'bank'"
            >
              <Landmark :size="18" />
              Дансаар шилжүүлэх
            </button>
            <button
              type="button"
              class="flex items-center justify-center gap-2 rounded-btn border px-3 py-2.5 text-body font-medium transition-colors"
              :class="
                method === 'qpay'
                  ? 'border-primary-300 bg-primary-50 text-primary-700'
                  : 'border-surface-border text-content-secondary hover:bg-surface-hover'
              "
              @click="method = 'qpay'"
            >
              <Smartphone :size="18" />
              QPay
            </button>
          </div>

          <template v-if="method === 'bank'">
            <div
              v-if="bankAccount"
              class="rounded-card border border-surface-border bg-surface-hover px-4 py-3.5"
            >
              <dl class="space-y-1 text-body-sm">
                <div v-if="bankAccount.bankName" class="flex justify-between gap-3">
                  <dt class="text-content-secondary">Банк</dt>
                  <dd class="font-medium text-content">{{ bankAccount.bankName }}</dd>
                </div>
                <div v-if="bankAccount.accountNumber" class="flex justify-between gap-3">
                  <dt class="text-content-secondary">Дансны дугаар</dt>
                  <dd class="tabular font-medium text-content">{{ bankAccount.accountNumber }}</dd>
                </div>
                <div v-if="bankAccount.accountHolder" class="flex justify-between gap-3">
                  <dt class="text-content-secondary">Эзэмшигч</dt>
                  <dd class="font-medium text-content">{{ bankAccount.accountHolder }}</dd>
                </div>
              </dl>
              <p v-if="bankAccount.note" class="mt-2 text-body-sm text-content-secondary">
                {{ bankAccount.note }}
              </p>
            </div>
            <p class="text-body-sm text-content-secondary">
              Захиалгын дараа дансанд шилжүүлнэ үү. Ажилтан гүйлгээг баталгаажуулмагц үлдэгдэл
              барагдана.
            </p>
          </template>

          <p v-else class="text-body-sm text-content-secondary">
            Төлбөр үүсгэсний дараа QR код гарч ирнэ — банкны апп-аараа уншуулж төлмөгц үлдэгдэл
            автоматаар барагдана.
          </p>
        </div>

        <div class="card flex items-center justify-between text-h4 font-bold">
          <span class="text-content">Нийт төлөх</span>
          <span class="tabular text-content">{{ formatCurrency(total) }}</span>
        </div>

        <UiBtn class="w-full" :loading="submitting" :disabled="!canSubmit" :icon="Wallet" @click="submit">
          Төлбөр төлөх
        </UiBtn>
      </template>
    </template>
  </div>
</template>
