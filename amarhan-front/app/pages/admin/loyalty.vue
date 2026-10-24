<script setup lang="ts">
import { Coins, Users, TrendingUp, ShoppingBag, Save } from 'lucide-vue-next'
import { formatCurrency } from '~/utils/currency'
import { formatRate } from '~/utils/loyalty'

/**
 * Урамшууллын хөтөлбөр — §4 "Админ тохируулах боломж" + хөтөлбөрийн самбар.
 *
 * Эргэлтэд буй кредит = компанийн ӨР (харилцагч хүссэн үедээ ачааны төлбөрт
 * хэрэглэнэ) — тиймээс самбарын эхэнд. Тохиргоо зөвхөн Админ (backend
 * `PUT /settings/loyalty.program`); хувь өөрчлөхөд ӨМНӨ олгосон кредит
 * хөдлөхгүй (олголт бүр snapshot-тай).
 */
definePageMeta({ layout: 'admin', middleware: 'auth' })
useHead({ title: 'Урамшуулал — Ивээл Карго' })

const KEY = 'loyalty.program'

const auth = useAuthStore()
const settings = useSettings()
const toast = useToast()
const { $axios } = useNuxtApp()
const { style } = useLoyaltyTier()

interface TierRow {
  code: string
  name: string
  minSpent: number
  /** UI-д хувиар (3.5), backend-д bps (350) */
  ratePercent: number
}

const stats = ref<any>(null)
const loading = ref(true)
const saving = ref(false)
const form = reactive({
  enabled: true,
  windowDays: 365,
  maxRedeemPercent: 100,
  tiers: [] as TierRow[],
})

const canEdit = computed(() => auth.isAdmin)

function fill(program: any) {
  form.enabled = program.enabled
  form.windowDays = program.windowDays
  form.maxRedeemPercent = program.maxRedeemPercent
  form.tiers = program.tiers.map((t: any) => ({
    code: t.code,
    name: t.name,
    minSpent: t.minSpent,
    ratePercent: t.rateBps / 100,
  }))
}

async function load() {
  loading.value = true
  try {
    const { data } = await $axios.get('/api/v1/loyalty/stats')
    stats.value = data.data
    fill(data.data.program)
  } catch (e: any) {
    toast.error(e?.response?.data?.message ?? 'Мэдээлэл уншиж чадсангүй')
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function save() {
  saving.value = true
  try {
    await settings.update(KEY, {
      enabled: form.enabled,
      windowDays: Number(form.windowDays),
      maxRedeemPercent: Number(form.maxRedeemPercent),
      tiers: form.tiers.map(t => ({
        code: t.code,
        name: t.name.trim(),
        minSpent: Number(t.minSpent),
        // 3.5% → 350 bps; float-ийн 349.99… алдаанаас сэргийлж дугуйруулна
        rateBps: Math.round(Number(t.ratePercent) * 100),
      })),
    })
    toast.success('Урамшууллын тохиргоо хадгалагдлаа', {
      description: 'Шинэ хувь зөвхөн цаашдын олголтод үйлчилнэ',
    })
    await load()
  } catch (e: any) {
    toast.error(e?.response?.data?.message ?? 'Хадгалж чадсангүй', { duration: 9000 })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-5">
    <UiPageHeader
      title="Урамшуулал"
      subtitle="Харилцагчийн түвшин, кредитийн хөтөлбөр — ачааны төлбөрийн хувиар кредит буцаан олгоно"
    />

    <p v-if="loading" class="py-10 text-center text-body text-content-secondary">Ачаалж байна…</p>

    <template v-else-if="stats">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <UiStatCard
          label="Эргэлтэд буй кредит"
          :value="formatCurrency(stats.outstanding, { showSymbol: false })"
          :icon="Coins"
          accent="#B45309"
          hint="Харилцагчдын ашиглаагүй үлдэгдэл (= ₮)"
        />
        <UiStatCard label="Кредиттэй харилцагч" :value="stats.holders" :icon="Users" />
        <UiStatCard
          label="Энэ сард олгосон"
          :value="formatCurrency(stats.thisMonth.earned, { showSymbol: false })"
          :icon="TrendingUp"
          accent="#16A34A"
        />
        <UiStatCard
          label="Энэ сард ашигласан"
          :value="formatCurrency(stats.thisMonth.redeemed, { showSymbol: false })"
          :icon="ShoppingBag"
          :hint="`${stats.thisMonth.redemptions} удаа`"
        />
      </div>

      <section class="rounded-card border border-surface-border bg-surface-card p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="font-semibold text-content">Хөтөлбөрийн тохиргоо</h2>
            <p class="mt-1 text-body-sm text-content-secondary">
              Түвшин нь сүүлийн {{ form.windowDays }} хоногт бодит мөнгөөр төлсөн ачааны төлбөрөөр
              тодорхойлогдоно. 1 кредит = 1₮.
            </p>
          </div>
          <label class="flex items-center gap-2 text-body font-medium text-content">
            <input
              v-model="form.enabled"
              type="checkbox"
              class="h-4 w-4 rounded border-surface-border text-primary"
              :disabled="!canEdit"
            />
            Идэвхтэй
          </label>
        </div>

        <div
          v-if="!canEdit"
          class="mt-4 rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-body text-content"
        >
          Тохиргоог зөвхөн Админ засварлана.
        </div>

        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <UiField label="Түвшин тооцох хугацаа" hint="30–730 хоног (365 = сүүлийн 12 сар)">
            <UiTextInput v-model.number="form.windowDays" type="number" suffix="хоног" tabular :disabled="!canEdit" />
          </UiField>
          <UiField label="Кредитээр хааж болох дээд хувь" hint="Ачааны үлдэгдлийн хэдэн % хүртэл">
            <UiTextInput v-model.number="form.maxRedeemPercent" type="number" suffix="%" tabular :disabled="!canEdit" />
          </UiField>
        </div>

        <div class="mt-5 overflow-x-auto">
          <table class="w-full min-w-[560px] text-body">
            <thead>
              <tr class="border-b border-surface-border text-left text-body-sm text-content-secondary">
                <th class="py-2 pr-3 font-medium">Түвшин</th>
                <th class="py-2 pr-3 font-medium">Нэр</th>
                <th class="py-2 pr-3 font-medium">Босго (жилд, ₮)</th>
                <th class="py-2 font-medium">Кредит %</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(tier, i) in form.tiers" :key="tier.code" class="border-b border-surface-border last:border-0">
                <td class="py-2.5 pr-3">
                  <span class="inline-flex items-center gap-2">
                    <LoyaltyTierEmblem :code="tier.code" :size="28" />
                    <span class="font-medium" :style="{ color: style(tier.code).color }">{{ tier.code }}</span>
                  </span>
                </td>
                <td class="py-2.5 pr-3">
                  <UiTextInput v-model="tier.name" :disabled="!canEdit" />
                </td>
                <td class="py-2.5 pr-3">
                  <UiTextInput
                    v-model.number="tier.minSpent"
                    type="number"
                    suffix="₮"
                    tabular
                    :disabled="!canEdit || i === 0"
                  />
                </td>
                <td class="py-2.5">
                  <UiTextInput v-model.number="tier.ratePercent" type="number" suffix="%" tabular :disabled="!canEdit" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="mt-2 text-body-sm text-content-secondary">
          Жишээ: {{ form.tiers.map(t => `${t.name} ${formatRate(Math.round(t.ratePercent * 100))}`).join(' · ') }}.
          Хүрэл үргэлж 0₮-өөс эхэлнэ.
        </p>

        <div class="mt-4 flex justify-end">
          <UiBtn :icon="Save" :disabled="!canEdit" :loading="saving" @click="save">Хадгалах</UiBtn>
        </div>
      </section>

      <section class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="rounded-card border border-surface-border bg-surface-card p-4">
          <p class="text-body-sm text-content-secondary">Нийт олгосон (бүх цаг)</p>
          <p class="mt-1 text-h3 font-bold tabular text-content">
            {{ formatCurrency(stats.allTime.earned, { showSymbol: false }) }}
          </p>
        </div>
        <div class="rounded-card border border-surface-border bg-surface-card p-4">
          <p class="text-body-sm text-content-secondary">Нийт ашигласан (бүх цаг)</p>
          <p class="mt-1 text-h3 font-bold tabular text-content">
            {{ formatCurrency(stats.allTime.redeemed, { showSymbol: false }) }}
          </p>
        </div>
      </section>
    </template>
  </div>
</template>
