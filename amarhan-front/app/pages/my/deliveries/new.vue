<script setup lang="ts">
import { Truck, Landmark, AlertTriangle, ArrowLeft, Copy, Check } from 'lucide-vue-next'
import { formatCurrency } from '~/utils/currency'
import type { DeliverableForDelivery } from '~/composables/useCustomerPortal'

/**
 * Харилцагч өөрөө хүргэлт захиалах — introduction.md §5, roadmap 5.8
 *
 * Нийт төлөх дүн = сонгосон ачааны ҮЛДЭГДЭЛ (бүрэн) + `feeAmount` (7000₮,
 * `DELIVERY_FEE_AMOUNT`, backend бодно — client талд ХЭЗЭЭ Ч дахин
 * тооцоолохгүй, зөвхөн ХАРУУЛНА).
 *
 * Төлбөрийн хэлбэр одоохондоо ЗӨВХӨН Данс — QPay мерчант эрх сонгогдоогүй
 * тул (roadmap 5.6/5.7 ⛔) огт харуулахгүй (сонголт биш, тогтмол).
 *
 * Илгээхэд backend `pending` төлбөр үүсгэнэ (банкны шилжүүлгийг систем
 * автоматаар шалгаж чадахгүй) — ажилтан бодит гүйлгээ ирснийг харж
 * баталгаажуулсны дараа л хүргэлтэнд гарна (BR-21c).
 */
definePageMeta({ middleware: 'customer' })
useHead({ title: 'Хүргэлт захиалах — Ивээлт Карго' })

const route = useRoute()
const portal = useCustomerPortal()
const customerStore = useCustomerStore()
const toast = useToast()
const { style, label } = usePackageStatus()

const loading = ref(true)
const submitting = ref(false)
const data = ref<DeliverableForDelivery | null>(null)
const selected = ref<string[]>([])
const copied = ref(false)

const form = reactive({
  address: '',
  phone: '',
  note: '',
})

const result = ref<{ deliveryNumber: string; payment: { amount: number } } | null>(null)

async function load() {
  loading.value = true
  try {
    data.value = await portal.deliverableForDelivery()

    /**
     * Ачааны дэлгэрэнгүй хуудаснаас `?packageId=`-аар ирвэл ЗӨВХӨН тэр ачааг
     * сонгоно — хэрэглэгчийн тодорхой хүсэл. Заагаагүй бол хамгийн түгээмэл
     * тохиолдол (бүгдийг захиалах). Query-д заасан ID жагсаалтад байхгүй бол
     * (аль хэдийн өөр хүргэлтэд орсон гэх мэт) энгийн "бүгдийг сонгох" руу
     * чимээгүй буцна.
     */
    const preselect = String(route.query.packageId ?? '')
    const hasPreselect = preselect && data.value.packages.some(p => p.id === preselect)
    selected.value = hasPreselect
      ? [preselect]
      : data.value.packages.map(p => p.id)
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

const selectedPackages = computed(
  () => data.value?.packages.filter(p => selected.value.includes(p.id)) ?? []
)

const packagesTotal = computed(() =>
  selectedPackages.value.reduce((sum, p) => sum + Math.max(p.balance, 0), 0)
)

const feeAmount = computed(() => data.value?.feeAmount ?? 0)
const grandTotal = computed(() => packagesTotal.value + feeAmount.value)

const bankAccount = computed(() => data.value?.bankAccount ?? null)
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
    // Clipboard эрх өгөөгүй ч захиалгад саад болохгүй
  }
}

const canSubmit = computed(
  () => !submitting.value && selected.value.length > 0 && form.address.trim().length >= 3
)

async function submit() {
  if (!canSubmit.value) return

  submitting.value = true
  try {
    const delivery = await portal.createDelivery({
      packageIds: selected.value,
      address: form.address.trim(),
      phone: form.phone.trim() || undefined,
      note: form.note.trim() || undefined,
    })
    result.value = delivery
  } catch (e: any) {
    toast.error('Хүргэлт захиалагдсангүй', {
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
        to="/my/deliveries"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn border border-surface-border text-content-secondary hover:bg-surface-hover"
      >
        <ArrowLeft :size="18" />
      </NuxtLink>
      <div>
        <h1 class="text-h1 font-bold text-content">Хүргэлт захиалах</h1>
        <p class="mt-0.5 text-body text-content-secondary">
          Бэлэн ачаагаа сонгож, хаягаа бичээд захиална
        </p>
      </div>
    </div>

    <!-- ── Амжилттай захиалсны дараах баталгаажуулах дэлгэц ─────────────── -->
    <div v-if="result" class="card space-y-4 text-center">
      <Truck :size="40" class="mx-auto text-success" :stroke-width="1.6" />
      <div>
        <p class="text-h3 font-semibold text-content">
          Хүсэлт {{ result.deliveryNumber }} бүртгэгдлээ
        </p>
        <p class="mx-auto mt-2 max-w-md text-body text-content-secondary">
          Доорх дансанд <strong class="tabular text-content">{{
            formatCurrency(result.payment.amount)
          }}</strong>
          шилжүүлнэ үү. Ажилтан гүйлгээг баталгаажуулмагц хүргэлтэнд гарна.
        </p>
      </div>
      <div
        v-if="bankAccount"
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
      <UiBtn to="/my/deliveries">Хүргэлтийн жагсаалт руу очих</UiBtn>
    </div>

    <!-- ── Захиалгын маягт ───────────────────────────────────────────────── -->
    <template v-else>
      <p v-if="loading" class="py-10 text-center text-body text-content-secondary">
        Ачаалж байна…
      </p>

      <div
        v-else-if="!data?.packages.length"
        class="rounded-card border border-surface-border bg-surface-card px-5 py-14 text-center"
      >
        <Truck :size="34" class="mx-auto text-content-disabled" :stroke-width="1.6" />
        <p class="mt-3 text-body text-content">Хүргэх боломжтой ачаа алга байна</p>
        <p class="mx-auto mt-1 max-w-sm text-body-sm text-content-secondary">
          Ачаа Улаанбаатарт ирж, бүртгэгдсэний дараа энд харагдана.
        </p>
      </div>

      <template v-else>
        <div class="card space-y-3">
          <p class="text-body-sm font-medium text-content-secondary">
            Хүргэх ачаа ({{ selected.length }}/{{ data.packages.length }})
          </p>
          <ul class="space-y-2">
            <li
              v-for="p in data.packages"
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
                <span
                  class="text-body-sm"
                  :style="{ color: style(p.status).color }"
                >
                  {{ label(p.status) }}
                </span>
              </div>
              <p
                class="tabular shrink-0 text-body font-semibold"
                :class="p.balance > 0 ? 'text-warning' : 'text-success'"
              >
                {{ p.balance > 0 ? formatCurrency(p.balance) : 'Төлөгдсөн' }}
              </p>
            </li>
          </ul>
        </div>

        <div class="card space-y-4">
          <UiField label="Хүргэх хаяг" required>
            <UiTextArea
              v-model="form.address"
              :rows="2"
              placeholder="ХУД, 3-р хороо, 12-р байр, 34 тоот"
            />
          </UiField>

          <UiField
            label="Хүлээн авагчийн утас"
            :hint="`Хоосон орхивол таны утас (${customerStore.customer?.phone ?? ''}) ашиглагдана`"
          >
            <UiTextInput v-model="form.phone" type="tel" placeholder="99112233" tabular />
          </UiField>

          <UiField label="Тэмдэглэл" hint="Заавал биш">
            <UiTextArea v-model="form.note" :rows="2" placeholder="Оройн 6-аас хойш" />
          </UiField>
        </div>

        <!-- Төлбөрийн хэлбэр — одоохондоо ЗӨВХӨН Данс (QPay нуугдсан) -->
        <div class="card space-y-3">
          <p class="text-body-sm font-medium text-content-secondary">Төлбөрийн хэлбэр</p>
          <div class="flex items-center gap-2 rounded-btn border border-primary-300 bg-primary-50 px-3 py-2.5 text-body font-medium text-primary-700">
            <Landmark :size="18" />
            Дансаар шилжүүлэх
          </div>

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

          <div
            class="flex items-start gap-2.5 rounded-card border border-warning/30 bg-warning/5 px-3.5 py-3"
          >
            <AlertTriangle :size="17" class="mt-0.5 shrink-0 text-warning" />
            <p class="text-body-sm text-content-secondary">
              Захиалгын дараа дансанд шилжүүлнэ үү. Ажилтан гүйлгээг баталгаажуулмагц хүргэлтэнд
              гарна.
            </p>
          </div>
        </div>

        <!-- ── Нийт дүн ────────────────────────────────────────────────── -->
        <div class="card space-y-2">
          <div class="flex items-center justify-between text-body">
            <span class="text-content-secondary">Сонгосон ачааны үлдэгдэл</span>
            <span class="tabular font-medium text-content">{{ formatCurrency(packagesTotal) }}</span>
          </div>
          <div class="flex items-center justify-between text-body">
            <span class="text-content-secondary">Хүргэлтийн хураамж</span>
            <span class="tabular font-medium text-content">{{ formatCurrency(feeAmount) }}</span>
          </div>
          <div
            class="flex items-center justify-between border-t border-surface-border pt-2 text-h4 font-bold"
          >
            <span class="text-content">Нийт төлөх</span>
            <span class="tabular text-content">{{ formatCurrency(grandTotal) }}</span>
          </div>
        </div>

        <UiBtn
          class="w-full"
          :loading="submitting"
          :disabled="!canSubmit"
          :icon="Truck"
          @click="submit"
        >
          Хүргэлт захиалах
        </UiBtn>
      </template>
    </template>
  </div>
</template>
