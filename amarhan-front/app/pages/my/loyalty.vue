<script setup lang="ts">
import {
  Wallet,
  Check,
  Lock,
  PackageCheck,
  Coins,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
  RotateCcw,
  Gift,
  History,
  Info,
} from 'lucide-vue-next'
import { formatCurrency } from '~/utils/currency'
import { formatRate, transactionCopy } from '~/utils/loyalty'
import type { LoyaltyOverview, LoyaltyTransaction, LoyaltyTier } from '~/composables/useCustomerPortal'

/**
 * Харилцагчийн урамшууллын хуудас — introduction.md §4, roadmap 7.5.
 *
 * "Хэрэглэгч өөрийн түвшин, оноо, дараагийн түвшин хүртэл хэд үлдсэн болон
 * ашиглаж болох бонусаа ойлгомжтой график дизайнтайгаар харна." Дараалал нь
 * харилцагчийн асуух асуултын дараалал:
 *   1. Хэдэн кредиттэй вэ, сүүлд юу болсон бэ?  → hero (Faceit маягийн +delta)
 *   2. Дараагийн шат хүртэл хэд вэ?            → прогресс
 *   3. Шат бүрт юу авах вэ?                    → түвшний шат
 *   4. Яаж ашиглах вэ?                         → 3 алхам + "Кредитээ ашиглах"
 *   5. Юунаас ирсэн бэ?                        → түүх
 */
definePageMeta({ middleware: 'customer' })
useHead({ title: 'Урамшуулал — Ивээлт Карго' })

const portal = useCustomerPortal()
const toast = useToast()
const { style, gradient } = useLoyaltyTier()

const data = ref<LoyaltyOverview | null>(null)
const loading = ref(true)
const payableTotal = ref(0)

const history = ref<LoyaltyTransaction[]>([])
const historyPage = ref(1)
const historyPages = ref(1)
const historyLoading = ref(false)

async function loadHistory(page = 1) {
  historyLoading.value = true
  try {
    const res = await portal.loyaltyTransactions({ page, limit: 15 })
    history.value = page === 1 ? res.data : [...history.value, ...res.data]
    historyPage.value = res.pagination.page
    historyPages.value = res.pagination.pages
  } finally {
    historyLoading.value = false
  }
}

onMounted(async () => {
  try {
    const [overview, summary] = await Promise.all([portal.loyalty(), portal.summary()])
    data.value = overview
    payableTotal.value = summary.balance
    await loadHistory(1)
  } catch (e: any) {
    toast.error('Урамшууллын мэдээлэл ачаалагдсангүй', {
      description: e?.response?.data?.message ?? e.message,
    })
  } finally {
    loading.value = false
  }
})

const tierStyle = computed(() => style(data.value?.tier.code))
const currentIndex = computed(() =>
  data.value ? data.value.tiers.findIndex(t => t.code === data.value!.tier.code) : 0
)
// Кредитээр хааж болох одоогийн үлдэгдэл — "одоо ашиглах" товчны дүн
const usableNow = computed(() => {
  if (!data.value) return 0
  const cap = Math.floor((payableTotal.value * data.value.maxRedeemPercent) / 100)
  return Math.max(0, Math.min(data.value.credits, cap))
})

function tierRange(tier: LoyaltyTier, index: number) {
  const next = data.value?.tiers[index + 1]
  if (!next) return `${formatCurrency(tier.minSpent)}-өөс дээш`
  if (tier.minSpent === 0) return `${formatCurrency(next.minSpent)} хүртэл`
  return `${formatCurrency(tier.minSpent)} – ${formatCurrency(next.minSpent)}`
}

/** "100,000₮ төлбөрт → 3,000 кредит" — хувийг бодит тоогоор ойлгуулна */
function exampleCredit(tier: LoyaltyTier) {
  return Math.floor((100000 * tier.rateBps) / 10000)
}

function txIcon(tx: LoyaltyTransaction) {
  switch (tx.type) {
    case 'earn':
      return ArrowUpRight
    case 'earn_reversal':
      return ArrowDownRight
    case 'redeem':
      return ShoppingBag
    case 'redeem_refund':
      return RotateCcw
    default:
      return Gift
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STEPS = [
  {
    icon: PackageCheck,
    title: 'Ачаагаа төлнө',
    body: 'Ачааны төлбөр бүрэн төлөгдмөгц таны түвшний хувиар кредит автоматаар орно.',
  },
  {
    icon: Coins,
    title: 'Кредит цуглуулна',
    body: '1 кредит = 1₮. Хугацаа дуусахгүй — хүссэн үедээ ашиглана.',
  },
  {
    icon: Wallet,
    title: 'Төлбөртөө ашиглана',
    body: 'Төлбөр төлөх, хүргэлт захиалах үед ачааны дүнгийн 100% хүртэлх хэсгийг кредитээр хаана.',
  },
]
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-h1 font-bold text-content">Урамшуулал</h1>
      <p class="mt-1 text-body text-content-secondary">
        Ачаагаа төлөх бүрт кредит цуглуулж, дараагийн ачааны төлбөртөө ашиглаарай
      </p>
    </div>

    <p v-if="loading" class="py-16 text-center text-body text-content-secondary">Ачаалж байна…</p>

    <template v-else-if="data">
      <div
        v-if="!data.enabled"
        class="flex items-start gap-2 rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-body text-content"
      >
        <Info :size="18" class="mt-0.5 shrink-0 text-warning" />
        Урамшууллын хөтөлбөр түр зогссон байна. Цуглуулсан кредит тань хадгалагдана.
      </div>

      <!-- ── 1. Hero: түвшин + кредит ──────────────────────────────────── -->
      <section
        class="relative overflow-hidden rounded-card p-5 text-white shadow-raised sm:p-7"
        :style="{ background: gradient(data.tier.code) }"
      >
        <!-- Чимэглэлийн тойрог -->
        <span class="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10" />
        <span class="pointer-events-none absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-white/5" />

        <div class="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-4">
            <LoyaltyTierEmblem :code="data.tier.code" :size="68" />
            <div>
              <p class="text-body-sm font-medium uppercase tracking-wider text-white/80">
                Таны түвшин
              </p>
              <p class="text-h2 font-extrabold leading-tight">{{ data.tier.name }}</p>
              <p class="mt-0.5 text-body text-white/90">
                Төлбөр бүрийн <strong>{{ formatRate(data.tier.rateBps) }}</strong> кредитээр буцна
              </p>
            </div>
          </div>

          <div class="sm:text-right">
            <p class="text-body-sm font-medium text-white/80">Кредитийн үлдэгдэл</p>
            <LoyaltyCreditBadge
              size="xl"
              inverse
              :credits="data.credits"
              :delta="data.lastTransaction?.amount ?? null"
            />
            <p class="mt-1 text-body-sm text-white/80">
              ≈ {{ formatCurrency(Math.max(data.credits, 0)) }}-ийн ачааны төлбөр
            </p>
          </div>
        </div>

        <div class="relative mt-6 flex flex-wrap gap-2">
          <NuxtLink
            v-if="usableNow > 0"
            to="/my/pay"
            class="inline-flex h-control items-center gap-2 rounded-btn bg-white px-4 text-body font-semibold shadow-sm transition hover:bg-white/90"
            :style="{ color: tierStyle.color }"
          >
            <Wallet :size="17" />
            {{ formatCurrency(usableNow, { showSymbol: false }) }} кредитээ одоо ашиглах
          </NuxtLink>
          <a
            href="#history"
            class="inline-flex h-control items-center gap-2 rounded-btn bg-white/15 px-4 text-body font-medium text-white backdrop-blur transition hover:bg-white/25"
          >
            <History :size="17" />
            Түүх
          </a>
        </div>
      </section>

      <!-- ── 2. Дараагийн шат ──────────────────────────────────────────── -->
      <section class="card">
        <LoyaltyTierProgress :data="data" />
        <p v-if="data.manualTier" class="mt-3 text-body-sm text-content-secondary">
          Таны түвшинг Ивээлт Карго тусгайлан тогтоосон — зарцуулалт буурсан ч энэ түвшнээс доош
          буухгүй.
        </p>
      </section>

      <!-- ── 3. Түвшний шат ────────────────────────────────────────────── -->
      <section>
        <h2 class="mb-3 text-h4 font-semibold text-content">Түвшнүүд</h2>
        <div class="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
          <article
            v-for="(tier, index) in data.tiers"
            :key="tier.code"
            class="relative flex flex-col rounded-card border bg-surface-card p-3.5 transition-shadow sm:p-4"
            :class="
              index === currentIndex
                ? 'border-transparent shadow-raised ring-2'
                : 'border-surface-border'
            "
            :style="index === currentIndex ? { '--tw-ring-color': style(tier.code).from } : undefined"
          >
            <span
              v-if="index === currentIndex"
              class="absolute right-2.5 top-2.5 rounded-full px-2 py-0.5 text-[10px] font-bold text-white sm:text-[11px]"
              :style="{ background: gradient(tier.code) }"
            >
              Та энд
            </span>
            <span
              v-else-if="index < currentIndex"
              class="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-success/10 text-success"
              aria-label="Нээгдсэн"
            >
              <Check :size="14" :stroke-width="3" />
            </span>

            <LoyaltyTierEmblem :code="tier.code" :size="40" :locked="index > currentIndex" />

            <p class="mt-3 text-h4 font-bold" :style="{ color: style(tier.code).color }">
              {{ tier.name }}
            </p>
            <p class="text-body-sm text-content-secondary">{{ tierRange(tier, index) }} / жил</p>

            <p class="mt-3 flex items-baseline gap-1">
              <span class="text-h3 font-extrabold tabular text-content sm:text-h2">{{ formatRate(tier.rateBps) }}</span>
              <span class="text-body-sm text-content-secondary">кредит</span>
            </p>
            <p class="mt-1 text-body-sm text-content-secondary">
              100,000₮ төлбөрт →
              <strong class="tabular text-content">{{ formatCurrency(exampleCredit(tier), { showSymbol: false }) }}</strong>
              кредит
            </p>

            <p
              v-if="index > currentIndex"
              class="mt-3 flex items-center gap-1.5 border-t border-surface-border pt-3 text-body-sm text-content-secondary"
            >
              <Lock :size="13" />
              Дахиад {{ formatCurrency(Math.max(tier.minSpent - data.spent, 0)) }}
            </p>
          </article>
        </div>
      </section>

      <!-- ── 4. Яаж ажилладаг вэ ───────────────────────────────────────── -->
      <section class="card">
        <h2 class="text-h4 font-semibold text-content">Яаж ажилладаг вэ?</h2>
        <ol class="mt-4 grid gap-4 sm:grid-cols-3">
          <li v-for="(step, i) in STEPS" :key="step.title" class="flex gap-3">
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
            >
              <component :is="step.icon" :size="19" />
            </span>
            <div>
              <p class="font-semibold text-content">{{ i + 1 }}. {{ step.title }}</p>
              <p class="mt-0.5 text-body-sm text-content-secondary">{{ step.body }}</p>
            </div>
          </li>
        </ol>
        <p class="mt-4 border-t border-surface-border pt-3 text-body-sm text-content-secondary">
          Түвшин сүүлийн {{ Math.round(data.windowDays / 30) }} сард бодит мөнгөөр төлсөн ачааны
          төлбөрөөр тооцогдоно (кредитээр төлсөн хэсэг, хүргэлтийн хураамж орохгүй). Кредит зөвхөн
          ачаа бүрэн төлөгдсөний дараа орно.
        </p>
      </section>

      <!-- ── Нийт дүн ─────────────────────────────────────────────────── -->
      <section class="grid grid-cols-3 gap-2.5 sm:gap-3">
        <div class="rounded-card border border-surface-border bg-surface-card p-3 sm:p-4">
          <p class="text-[12px] text-content-secondary sm:text-body-sm">Нийт цуглуулсан</p>
          <p class="mt-1 text-body-lg font-bold tabular sm:text-h3 text-success">
            +{{ formatCurrency(data.totals.earned, { showSymbol: false }) }}
          </p>
        </div>
        <div class="rounded-card border border-surface-border bg-surface-card p-3 sm:p-4">
          <p class="text-[12px] text-content-secondary sm:text-body-sm">Нийт ашигласан</p>
          <p class="mt-1 text-body-lg font-bold tabular sm:text-h3 text-content">
            {{ formatCurrency(data.totals.redeemed, { showSymbol: false }) }}
          </p>
        </div>
        <div class="rounded-card border border-surface-border bg-surface-card p-3 sm:p-4">
          <p class="text-[12px] text-content-secondary sm:text-body-sm">
            Сүүлийн {{ Math.round(data.windowDays / 30) }} сарын төлбөр
          </p>
          <p class="mt-1 text-body-lg font-bold tabular sm:text-h3 text-content">{{ formatCurrency(data.spent) }}</p>
        </div>
      </section>

      <!-- ── 5. Түүх ──────────────────────────────────────────────────── -->
      <section id="history" class="scroll-mt-20 rounded-card border border-surface-border bg-surface-card">
        <div class="border-b border-surface-border px-5 py-4">
          <h2 class="text-h4 font-semibold text-content">Кредитийн түүх</h2>
        </div>

        <div v-if="!history.length && !historyLoading" class="px-5 py-12 text-center">
          <Coins :size="32" class="mx-auto text-content-disabled" :stroke-width="1.6" />
          <p class="mt-2.5 text-body text-content-secondary">Кредитийн гүйлгээ хараахан алга</p>
          <p class="mx-auto mt-1 max-w-sm text-body-sm text-content-secondary">
            Ачааныхаа төлбөрийг бүрэн төлмөгц энд анхны кредит тань харагдана.
          </p>
        </div>

        <ul v-else class="divide-y divide-surface-border">
          <li v-for="tx in history" :key="tx.id" class="flex items-center gap-3 px-5 py-3.5">
            <span
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              :class="tx.amount > 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'"
            >
              <component :is="txIcon(tx)" :size="17" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="font-medium text-content">{{ transactionCopy(tx).title }}</p>
              <p class="truncate text-body-sm text-content-secondary">
                <span v-if="transactionCopy(tx).subtitle">{{ transactionCopy(tx).subtitle }} · </span>
                {{ formatDate(tx.createdAt) }}
              </p>
            </div>
            <div class="shrink-0 text-right">
              <p class="font-bold tabular" :class="tx.amount > 0 ? 'text-success' : 'text-error'">
                {{ tx.amount > 0 ? '+' : '−' }}{{ formatCurrency(Math.abs(tx.amount), { showSymbol: false }) }}
              </p>
              <p v-if="tx.balanceAfter != null" class="text-[11px] tabular text-content-secondary">
                Үлдэгдэл {{ formatCurrency(tx.balanceAfter, { showSymbol: false }) }}
              </p>
            </div>
          </li>
        </ul>

        <div v-if="historyPage < historyPages" class="border-t border-surface-border p-3 text-center">
          <UiBtn variant="ghost" size="sm" :loading="historyLoading" @click="loadHistory(historyPage + 1)">
            Цааш үзэх
          </UiBtn>
        </div>
      </section>
    </template>
  </div>
</template>
