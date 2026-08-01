<script setup lang="ts">
import { Wallet, Landmark, CreditCard, Smartphone, Copy, Check } from 'lucide-vue-next'
import { usePayments, type PaymentMethodValue } from '~/composables/usePayments'
import type { CargoPackage } from '~/composables/usePackages'

/**
 * Төлбөр авах модал — introduction.md §1.8, §2.3
 *
 * Хоёр урсгалд НЭГ компонент: ачааны дэлгэрэнгүй хуудас (нэг ачаа) ба
 * нэгтгэсэн нэхэмжлэх (олон ачаа). Хуулбарлавал хуваасан төлбөрийн логик
 * хоёр газар зөрөх эрсдэлтэй.
 *
 * ХУВААРИЛАЛТЫГ CLIENT ТАЛД БОДОХГҮЙ (BR-17). Ажилтан зөвхөн НИЙТ дүн ба
 * хэлбэрийг заана; ачаа тус бүрд хэрхэн ногдохыг backend шийднэ. Client талд
 * бодвол хоёр газар зөрөх ба мөнгө "үүсэх/устах" эрсдэлтэй.
 */
const props = defineProps<{
  modelValue: boolean
  /** Төлбөр ногдох ачаанууд — дүнг харуулах, хуваарилалтыг таамаглахад */
  packages: CargoPackage[]
  /** Нэхэмжлэхээр төлж байгаа бол — backend түүний ачааг өөрөө уншина */
  invoiceId?: string | null
  /** Нэхэмжлэхийн үлдэгдэл (байвал) — эс тэгвээс ачаануудаас бодогдоно */
  invoiceBalance?: number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  paid: []
}>()

const api = usePayments()
const settings = useSettings()
const toast = useToast()

/**
 * "Данс" хэлбэр сонгоход харилцагчид өгөх дансны мэдээлэл. Зөвхөн энэ
 * модал ажилтанд харагдана — public БИШ (`payment.bank_account`, ЗӨВХӨН
 * дотоод, `general.vue`-с засварлагдана).
 */
const bankAccount = ref<{
  bankName: string
  accountNumber: string
  accountHolder: string
  note: string
} | null>(null)
const bankAccountLoaded = ref(false)
const copied = ref(false)

async function loadBankAccount() {
  if (bankAccountLoaded.value) return
  bankAccountLoaded.value = true
  try {
    const data = await settings.list()
    bankAccount.value = data['payment.bank_account'] ?? null
  } catch {
    // Ачаалагдаагүй ч төлбөр бүртгэхэд саад болохгүй
  }
}

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
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    // Clipboard эрх өгөөгүй — ажилтан гараар сонгож хуулна
  }
}

const METHODS: Array<{ value: PaymentMethodValue; label: string; icon: any }> = [
  { value: 'cash', label: 'Бэлэн', icon: Wallet },
  { value: 'bank', label: 'Данс', icon: Landmark },
  { value: 'card', label: 'Карт', icon: CreditCard },
  { value: 'qpay', label: 'QPay', icon: Smartphone },
]

const method = ref<PaymentMethodValue>('cash')
const amount = ref<number | null>(null)
const note = ref('')
const busy = ref(false)

/** Төлөх ёстой дүн. Нэхэмжлэхтэй бол түүний үлдэгдэл давуу эрхтэй */
const totalBalance = computed(() => {
  if (props.invoiceBalance != null) return props.invoiceBalance
  return props.packages.reduce((sum, p) => sum + p.balance, 0)
})

/**
 * ХАСАГДАХ дүн — ажилтан хэсэгчилсэн төлбөр авахад үлдэх дүнг харуулна.
 * Хуваасан төлбөрийн үед (§1.8) ажилтан "дараа хэд авах вэ"-г шууд харна.
 */
const remaining = computed(() => {
  const paid = amount.value ?? 0
  return Math.max(totalBalance.value - paid, 0)
})

const isOverpaying = computed(() => (amount.value ?? 0) > totalBalance.value)

const canSubmit = computed(
  () => !busy.value && (amount.value ?? 0) > 0 && !isOverpaying.value
)

// Модал онгойх бүрт бүрэн дүнг санал болгоно — хамгийн түгээмэл тохиолдол
watch(
  () => props.modelValue,
  open => {
    if (!open) return
    amount.value = totalBalance.value
    method.value = 'cash'
    note.value = ''
    loadBankAccount()
  }
)

function close() {
  emit('update:modelValue', false)
}

async function submit() {
  if (!canSubmit.value) return

  busy.value = true
  try {
    await api.create({
      amount: amount.value as number,
      method: method.value,
      ...(props.invoiceId
        ? { invoiceId: props.invoiceId }
        : { packageIds: props.packages.map(p => p.id) }),
      ...(note.value.trim() ? { note: note.value.trim() } : {}),
    })

    const paidAll = remaining.value === 0
    toast.success(paidAll ? 'Төлбөр бүрэн бүртгэгдлээ' : 'Хэсэгчилсэн төлбөр бүртгэгдлээ', {
      description: paidAll ? undefined : `Үлдэгдэл: ${formatCurrency(remaining.value)}`,
    })

    emit('paid')
    close()
  } catch (e: any) {
    toast.error('Төлбөр бүртгэгдсэнгүй', { description: e.message, duration: 9000 })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UiModal
    :model-value="modelValue"
    title="Төлбөр авах"
    :subtitle="`${packages.length} ачаа · Үлдэгдэл ${formatCurrency(totalBalance)}`"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="space-y-5">
      <!-- Хэлбэр (§1.8). Хуваасан төлбөр = хэлбэр бүрт ТУСДАА бүртгэл (BR-13) -->
      <UiField label="Төлбөрийн хэлбэр" required>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            v-for="option in METHODS"
            :key="option.value"
            type="button"
            class="flex flex-col items-center gap-1.5 rounded-btn border px-3 py-3 text-body-sm font-medium transition-all duration-200"
            :class="
              method === option.value
                ? 'border-primary bg-primary-50 text-primary-700'
                : 'border-surface-border text-content-secondary hover:bg-surface-hover'
            "
            @click="method = option.value"
          >
            <component :is="option.icon" :size="19" :stroke-width="2" />
            {{ option.label }}
          </button>
        </div>
      </UiField>

      <!-- "Данс" сонгоход харилцагчид өгөх дансны мэдээллийг ажилтан
           энд шууд хуулж авна (`payment.bank_account`, зөвхөн дотоод) -->
      <div
        v-if="method === 'bank' && bankAccount && bankAccountText"
        class="rounded-card border border-surface-border bg-surface-hover px-4 py-3.5"
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
        <p v-if="bankAccount.note" class="mt-2 text-body-sm text-content-secondary">
          {{ bankAccount.note }}
        </p>
      </div>

      <UiField
        label="Дүн"
        required
        :error="isOverpaying ? 'Үлдэгдлээс их дүн бүртгэх боломжгүй' : null"
        hint="Хэсэгчилсэн дүн бичвэл үлдсэнийг дараа нь өөр хэлбэрээр авч болно"
      >
        <UiTextInput
          v-model="amount"
          type="number"
          suffix="₮"
          tabular
          :invalid="isOverpaying"
          @enter="submit"
        />
      </UiField>

      <!-- Хэсэгчилсэн төлбөрт үлдэх дүнг ТОДООР харуулна — ажилтан хэрэглэгчид
           хэлэх шаардлагатай тоо -->
      <div
        v-if="amount != null && remaining > 0 && !isOverpaying"
        class="flex items-center justify-between rounded-card border border-warning/30 bg-warning/5 px-4 py-3"
      >
        <span class="text-body text-content-secondary">Төлбөрийн дараах үлдэгдэл</span>
        <span class="tabular text-body font-bold text-warning">
          {{ formatCurrency(remaining) }}
        </span>
      </div>

      <UiField label="Тэмдэглэл" hint="Заавал биш">
        <UiTextArea v-model="note" :rows="2" placeholder="Жишээ: дансны гүйлгээний дугаар" />
      </UiField>

      <!-- Ачаанууд. Хуваарилалтыг backend бодох тул ЭНД дүн харуулахгүй —
           таамаглал бичвэл бодит хуваарилалттай зөрж, ажилтныг төөрөгдүүлнэ. -->
      <div v-if="packages.length > 1" class="rounded-card border border-surface-border">
        <p class="border-b border-surface-border px-4 py-2.5 text-body-sm text-content-secondary">
          Дүн эдгээр ачаанд үлдэгдлийн харьцаагаар хуваарилагдана
        </p>
        <ul class="max-h-40 divide-y divide-surface-border overflow-y-auto">
          <li
            v-for="p in packages"
            :key="p.id"
            class="flex items-center justify-between px-4 py-2 text-body-sm"
          >
            <span class="tabular text-content">{{ p.trackingNumber }}</span>
            <span class="tabular text-content-secondary">{{ formatCurrency(p.balance) }}</span>
          </li>
        </ul>
      </div>
    </div>

    <template #footer>
      <UiBtn variant="ghost" :disabled="busy" @click="close">Болих</UiBtn>
      <UiBtn :loading="busy" :disabled="!canSubmit" @click="submit">
        {{ formatCurrency(amount ?? 0) }} бүртгэх
      </UiBtn>
    </template>
  </UiModal>
</template>
