<script setup lang="ts">
import { Save } from 'lucide-vue-next'
import { formatCurrency } from '~/utils/currency'
import { formatRate, transactionCopy } from '~/utils/loyalty'
import type { AdminCustomer, StaffLoyalty } from '~/composables/useCustomers'

/**
 * Харилцагчийн урамшуулал — ажилтны харагдац (§4).
 *
 * Ажилтан: кредит, түвшин, түүхийг харна (төлбөр авахдаа харилцагчид хэлэх).
 * Админ: BR-33 — кредитийн үлдэгдэл (зорилтот утга → ledger `adjust`) болон
 * доод түвшнийг гараар тогтооно, шалтгаан ЗААВАЛ (audit).
 */
const props = defineProps<{
  modelValue: boolean
  customer: AdminCustomer | null
  canAdjust: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean]; changed: [] }>()

const api = useCustomers()
const toast = useToast()
const { style } = useLoyaltyTier()

const data = ref<StaffLoyalty | null>(null)
const loading = ref(false)
const saving = ref(false)
const form = reactive({ credits: 0 as number | null, tier: 'auto' as string, reason: '' })

const TIER_OPTIONS = [
  { value: 'auto', label: 'Автомат (12 сарын төлбөрөөр)' },
  { value: 'bronze', label: 'Хүрэл' },
  { value: 'silver', label: 'Мөнгө' },
  { value: 'gold', label: 'Алт' },
  { value: 'platinum', label: 'Платинум' },
]

async function load() {
  if (!props.customer) return
  loading.value = true
  try {
    data.value = await api.loyalty(props.customer.id, { limit: 10 })
    form.credits = data.value.credits
    form.tier = data.value.manualTier ?? 'auto'
    form.reason = ''
  } catch (e: any) {
    toast.error('Урамшуулал ачаалагдсангүй', { description: e.message })
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.modelValue, props.customer?.id],
  ([open]) => {
    if (open) load()
    else data.value = null
  },
  { immediate: true }
)

const dirty = computed(() => {
  if (!data.value) return false
  return form.credits !== data.value.credits || form.tier !== (data.value.manualTier ?? 'auto')
})
const canSave = computed(
  () => dirty.value && form.reason.trim().length >= 3 && (form.credits ?? -1) >= 0 && !saving.value
)

async function save() {
  if (!props.customer || !data.value || !canSave.value) return
  saving.value = true
  try {
    const payload: { loyaltyPoints?: number; loyaltyTier?: any; reason: string } = {
      reason: form.reason.trim(),
    }
    if (form.credits !== data.value.credits) payload.loyaltyPoints = Number(form.credits)
    if (form.tier !== (data.value.manualTier ?? 'auto')) {
      payload.loyaltyTier = form.tier === 'auto' ? null : form.tier
    }
    await api.adjustLoyalty(props.customer.id, payload)
    toast.success('Урамшуулал шинэчлэгдлээ')
    emit('changed')
    await load()
  } catch (e: any) {
    toast.error('Хадгалагдсангүй', { description: e.message })
  } finally {
    saving.value = false
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('mn-MN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <UiModal
    :model-value="modelValue"
    title="Урамшуулал"
    :subtitle="customer ? `${customer.name || ''} ${customer.phone}`.trim() : ''"
    size="lg"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p v-if="loading && !data" class="py-8 text-center text-body text-content-secondary">Ачаалж байна…</p>

    <div v-else-if="data" class="space-y-5">
      <!-- Тойм -->
      <div class="flex flex-wrap items-center gap-4 rounded-card border border-surface-border p-4">
        <LoyaltyTierEmblem :code="data.tier.code" :size="48" />
        <div class="min-w-0 flex-1">
          <p class="font-semibold" :style="{ color: style(data.tier.code).color }">
            {{ data.tier.name }} · {{ formatRate(data.tier.rateBps) }}
            <span v-if="data.manualTier" class="ml-1 rounded-full bg-surface-hover px-2 py-0.5 text-[11px] text-content-secondary">
              гараар
            </span>
          </p>
          <p class="text-body-sm text-content-secondary">
            12 сард {{ formatCurrency(data.spent) }}
            <template v-if="data.nextTier">
              · {{ data.nextTier.name }} хүртэл {{ formatCurrency(data.remainingToNext) }}
            </template>
          </p>
        </div>
        <LoyaltyCreditBadge
          size="lg"
          :credits="data.credits"
          :delta="data.history.data[0]?.amount ?? null"
        />
      </div>

      <!-- Түүх -->
      <div>
        <p class="mb-2 text-body-sm font-semibold text-content-secondary">Сүүлийн гүйлгээ</p>
        <p v-if="!data.history.data.length" class="text-body-sm text-content-secondary">Гүйлгээ алга</p>
        <ul v-else class="divide-y divide-surface-border rounded-card border border-surface-border">
          <li v-for="tx in data.history.data" :key="tx.id" class="flex items-center gap-3 px-3 py-2">
            <div class="min-w-0 flex-1">
              <p class="text-body font-medium text-content">{{ transactionCopy(tx).title }}</p>
              <p class="truncate text-body-sm text-content-secondary">
                {{ formatDate(tx.createdAt) }}
                <template v-if="tx.label"> · {{ tx.label }}</template>
                <template v-if="tx.actorName"> · {{ tx.actorName }}</template>
                <template v-if="tx.reason"> · «{{ tx.reason }}»</template>
              </p>
            </div>
            <span class="font-bold tabular" :class="tx.amount > 0 ? 'text-success' : 'text-error'">
              {{ tx.amount > 0 ? '+' : '−' }}{{ formatCurrency(Math.abs(tx.amount), { showSymbol: false }) }}
            </span>
          </li>
        </ul>
      </div>

      <!-- BR-33 — Админы засвар -->
      <div v-if="canAdjust" class="space-y-3 rounded-card border border-surface-border bg-surface-hover/40 p-4">
        <p class="text-body-sm font-semibold text-content">Гараар засах (зөвхөн Админ)</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <UiField label="Кредитийн үлдэгдэл" hint="Шинэ үлдэгдэл — зөрүү нь түүхэнд «засвар» болно">
            <UiTextInput v-model.number="form.credits" type="number" suffix="кредит" tabular />
          </UiField>
          <UiField label="Доод түвшин" hint="Зарцуулалт буурсан ч үүнээс доош буухгүй">
            <UiSelectInput v-model="form.tier" :options="TIER_OPTIONS" />
          </UiField>
        </div>
        <UiField label="Шалтгаан" required>
          <UiTextArea v-model="form.reason" :rows="2" placeholder="Жишээ: гомдлын нөхөн олговор" />
        </UiField>
      </div>
    </div>

    <template v-if="canAdjust && data" #footer>
      <UiBtn variant="secondary" :disabled="saving" @click="emit('update:modelValue', false)">Хаах</UiBtn>
      <UiBtn :icon="Save" :loading="saving" :disabled="!canSave" @click="save">Хадгалах</UiBtn>
    </template>
  </UiModal>
</template>
