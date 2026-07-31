<script setup lang="ts">
import { Search, PackageCheck, Wallet, Landmark, CreditCard, Smartphone, User } from 'lucide-vue-next'
import { usePayments, type PaymentMethodValue, type Invoice } from '~/composables/usePayments'
import { useCustomers, type CustomerSummary } from '~/composables/useCustomers'
import type { CargoPackage } from '~/composables/usePackages'

/**
 * Ачааны жагсаалт хуудаснаас НЭГ цонхонд хийх хүлээлгэн өгөх урсгал —
 * introduction.md §1.9.
 *
 * ХЭРЭГЦЭЭ: хэрэглэгч биечлэн ирэхэд ажилтан "Ачаа" хуудаснаас гарч Төлбөрийн
 * цэс рүү шилжиж, дахин утсаар хайх шаардлагатай байсан (3 удаагийн хайлт).
 * Энд утас, ачааны дугаар, эсвэл нэрээр НЭГ удаа хайгаад бэлэн ачааг сонгож,
 * шаардлагатай бол төлбөр төлүүлээд шууд хүлээлгэн өгнө.
 *
 * Ачаа `paid` төлөвт байх ёстой `picked_up` рүү шилжихээс өмнө (BR-19,
 * package-state.js). Үлдэгдэлтэй ачааг сонговол эхлээд нэхэмжлэх үүсгэж,
 * бүтэн дүнг тухайн нэг хэлбэрээр төлүүлнэ — дараа нь ачаа автоматаар `paid`
 * болж, `picked_up` рүү шилжинэ. Аль хэдийн бүрэн төлөгдсөн ачааг сонговол
 * төлбөр алгасаад шууд шилжинэ.
 */
const props = defineProps<{
  modelValue: boolean
  /** Ачааны жагсаалтын утасны шүүлтээс ирсэн эхлэл утга — байвал шууд хайна */
  initialQuery?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'handed-over': []
}>()

const packageApi = usePackages()
const paymentApi = usePayments()
const customerApi = useCustomers()
const toast = useToast()

// Эдгээр төлөвөөс л ачаа хүлээлгэн өгөхөд бэлэн: `in_erlian` ирээгүй,
// `out_for_delivery`/`picked_up`/`delivered`/`returned`/`cancelled` аль
// хэдийн явсан эсвэл дуусгавар (package-state.js).
const READY_STATUSES = ['registered', 'notified', 'awaiting_payment', 'paid']

const METHODS: Array<{ value: PaymentMethodValue; label: string; icon: any }> = [
  { value: 'cash', label: 'Бэлэн', icon: Wallet },
  { value: 'bank', label: 'Данс', icon: Landmark },
  { value: 'card', label: 'Карт', icon: CreditCard },
  { value: 'qpay', label: 'QPay', icon: Smartphone },
]

const query = ref('')
const searching = ref(false)
const busy = ref(false)

const customer = ref<{ id: string; phone: string; name: string | null } | null>(null)
const packages = ref<CargoPackage[]>([])
const selected = ref<string[]>([])
const method = ref<PaymentMethodValue>('cash')
const invoice = ref<Invoice | null>(null)

// Нэрээр хайхад олон харилцагч таарвал сонгуулна
const candidates = ref<CustomerSummary[]>([])

const selectedPackages = computed(() => packages.value.filter(p => selected.value.includes(p.id)))
const selectedTotal = computed(() => selectedPackages.value.reduce((s, p) => s + p.balance, 0))
const allSelected = computed(
  () => packages.value.length > 0 && selected.value.length === packages.value.length
)

// Модал онгойх бүрт цэвэрлээд, ачааны жагсаалтын утасны шүүлт байвал шууд хайна
watch(
  () => props.modelValue,
  open => {
    if (!open) return
    reset()
    query.value = props.initialQuery?.trim() || ''
    if (query.value) search()
  }
)

function toggleAll() {
  selected.value = allSelected.value ? [] : packages.value.map(p => p.id)
}

function toggle(id: string) {
  selected.value = selected.value.includes(id)
    ? selected.value.filter(x => x !== id)
    : [...selected.value, id]
  // Сонголт өөрчлөгдвөл өмнөх нэхэмжлэх дүн зөрнө — дахин үүсгэнэ
  invoice.value = null
}

/**
 * НЭГ талбар — утас, ачааны дугаар, харилцагчийн нэрийг ялгаж таньна:
 *   - зөвхөн тоо (6+) → утас
 *   - латин үсэг/тоо/зураас (tracking-number.js-ийн формат) → ачааны дугаар
 *   - бусад (жишээ: кирилл нэр) → харилцагчийн нэрээр хайлт
 */
/**
 * `domain/phone.js`-ийн нормчлолтой ижил дүрэм: 8 оронтой (976/00976 угтвар
 * авч болно), эхний орон 5–9. Зөвхөн "6+ цифр" гэж шалгавал 10 оронтой
 * ачааны дугаар (жишээ: "2342342342") утас гэж андуурагдана.
 */
function looksLikePhone(digitsOnly: string): boolean {
  let d = digitsOnly
  if (d.startsWith('00976')) d = d.slice(5)
  else if (d.startsWith('976') && d.length === 11) d = d.slice(3)
  return /^[5-9]\d{7}$/.test(d)
}

async function search() {
  const value = query.value.trim()
  if (!value) {
    toast.error('Утас, ачааны дугаар эсвэл нэрээр хайна уу')
    return
  }

  const digitsOnly = value.replace(/[\s+()-]/g, '')
  const isPhoneLike = /^\d+$/.test(digitsOnly) && looksLikePhone(digitsOnly)
  const isTrackingLike = !isPhoneLike && /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/.test(value.replace(/\s+/g, ''))

  searching.value = true
  candidates.value = []
  try {
    if (isPhoneLike) {
      await loadByPhone(digitsOnly)
    } else if (isTrackingLike) {
      await loadByTracking(value)
    } else {
      await loadByName(value)
    }
  } finally {
    searching.value = false
  }
}

async function loadByPhone(phone: string) {
  try {
    const result = await packageApi.byPhone(phone)
    applyCustomerPackages(result.customer, result.packages)
  } catch (e: any) {
    toast.error('Харилцагч олдсонгүй', { description: e.message })
    clearResult()
  }
}

/**
 * Тодорхой ачааны дугаараар хайхад ЗӨВХӨН тухайн ачааг харуулна — харилцагчийн
 * бусад ачааг автоматаар нэмбэл ажилтан "ганц ачаа хайсан" гэдгээ мэдэхгүй
 * олон ачаа нэг дор хүлээлгэх эрсдэлтэй. Олноор авахыг хүсвэл утсаар хайна.
 */
async function loadByTracking(trackingNumber: string) {
  try {
    const pkg = await packageApi.getByTracking(trackingNumber)
    if (!READY_STATUSES.includes(pkg.status)) {
      toast.info('Энэ ачаа хүлээлгэн өгөхөд бэлэн бус', {
        description: `Одоогийн төлөв: ${pkg.status}`,
      })
      clearResult()
      return
    }
    customer.value = { id: '', phone: pkg.customerPhone, name: null }
    packages.value = [pkg]
    selected.value = [pkg.id]
    invoice.value = null
  } catch (e: any) {
    toast.error('Ачаа олдсонгүй', { description: e.message })
    clearResult()
  }
}

async function loadByName(name: string) {
  try {
    const found = await customerApi.search(name, 5)
    if (found.length === 0) {
      toast.error('Харилцагч олдсонгүй', { description: `"${name}" нэртэй харилцагч алга` })
      clearResult()
    } else if (found.length === 1) {
      await loadByPhone(found[0].phone)
    } else {
      // Олон таарц — ажилтан өөрөө сонгоно
      candidates.value = found
      clearResult()
    }
  } catch (e: any) {
    toast.error('Хайлт амжилтгүй', { description: e.message })
    clearResult()
  }
}

async function pickCandidate(c: CustomerSummary) {
  candidates.value = []
  searching.value = true
  try {
    await loadByPhone(c.phone)
  } finally {
    searching.value = false
  }
}

function applyCustomerPackages(c: { id: string; phone: string; name: string | null }, pkgs: CargoPackage[]) {
  customer.value = c
  packages.value = pkgs.filter(p => READY_STATUSES.includes(p.status))
  selected.value = packages.value.map(p => p.id)
  invoice.value = null

  if (packages.value.length === 0) {
    toast.info('Хүлээлгэн өгөх боломжтой ачаа алга', {
      description: 'Бүх ачаа аль хэдийн хүлээлгэгдсэн эсвэл бүртгэгдээгүй байна',
    })
  }
}

function clearResult() {
  customer.value = null
  packages.value = []
  selected.value = []
  invoice.value = null
}

/**
 * Нэг товчлол: шаардлагатай бол нэхэмжлэх үүсгэж бүтэн дүнг нэг хэлбэрээр
 * төлүүлээд, дараа нь сонгосон бүх ачааг `picked_up` рүү шилжүүлнэ.
 */
async function handOver() {
  if (selected.value.length === 0) {
    toast.error('Ачаа сонгоно уу')
    return
  }

  busy.value = true
  try {
    if (selectedTotal.value > 0) {
      if (!invoice.value) {
        invoice.value = await paymentApi.createInvoice(selected.value)
      }

      // Модал онгойсноос хойш өөр ажилтан төлбөр авсан байж болно — үлдэгдлийг
      // ДАХИН уншиж бодно (BR-16), client талд таамаглахгүй
      const detail = await paymentApi.invoiceDetail(invoice.value.id)
      if (detail.balance > 0) {
        await paymentApi.create({
          amount: detail.balance,
          method: method.value,
          invoiceId: invoice.value.id,
        })
      }
    }

    const result = await packageApi.changeStatusBulk(selected.value, 'picked_up')

    if (result.succeeded.length) {
      toast.success(`${result.succeeded.length} ачаа хүлээлгэн өгөгдлөө`)
    }
    // Бүтэлгүйтсэнийг чимээгүй алгасахгүй — ажилтан аль ачаа гараагүйг мэдэх ёстой
    if (result.failed.length) {
      toast.warning(`${result.failed.length} ачаа шилжсэнгүй`, {
        description: result.failed[0]?.message,
        duration: 9000,
      })
    }

    emit('handed-over')
    close()
  } catch (e: any) {
    toast.error('Хүлээлгэн өгөх боломжгүй', { description: e.message, duration: 9000 })
  } finally {
    busy.value = false
  }
}

function reset() {
  query.value = ''
  searching.value = false
  candidates.value = []
  method.value = 'cash'
  clearResult()
}

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <UiModal
    :model-value="modelValue"
    title="Хүлээлгэн өгөх"
    subtitle="Утас, ачааны дугаар эсвэл нэрээр хайж, бэлэн ачааг сонгоод нэг дор хүлээлгэнэ"
    size="lg"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="space-y-4">
      <UiField label="Утас / ачааны дугаар / нэр" required>
        <UiTextInput
          v-model="query"
          :icon="Search"
          placeholder="99112233, IV20260731-0001 эсвэл нэр"
          tabular
          autofocus
          @enter="search"
        />
      </UiField>
      <UiBtn variant="secondary" :loading="searching" :icon="Search" @click="search">
        Хайх
      </UiBtn>

      <!-- Нэрээр хайхад олон харилцагч таарвал сонгуулна -->
      <div v-if="candidates.length" class="rounded-card border border-surface-border">
        <p class="border-b border-surface-border px-4 py-2.5 text-body-sm text-content-secondary">
          {{ candidates.length }} харилцагч таарлаа — сонгоно уу
        </p>
        <ul class="divide-y divide-surface-border">
          <li v-for="c in candidates" :key="c.id">
            <button
              type="button"
              class="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-hover"
              @click="pickCandidate(c)"
            >
              <User :size="16" class="shrink-0 text-content-secondary" />
              <span class="text-body text-content">{{ c.name || 'Нэргүй' }}</span>
              <span class="tabular ml-auto text-body-sm text-content-secondary">{{ c.phone }}</span>
            </button>
          </li>
        </ul>
      </div>

      <template v-if="customer">
        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-surface-border pt-4">
          <p class="tabular text-h4 font-semibold text-content">
            {{ customer.phone }}
            <span v-if="customer.name" class="font-normal text-content-secondary">
              · {{ customer.name }}
            </span>
          </p>
          <p v-if="packages.length" class="text-body-sm text-content-secondary">
            {{ packages.length }} ачаа бэлэн
          </p>
        </div>

        <div
          v-if="packages.length"
          class="overflow-hidden rounded-card border border-surface-border"
        >
          <table class="w-full border-collapse text-left">
            <thead>
              <tr class="border-b border-surface-border bg-surface-hover">
                <th class="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    class="h-4 w-4 cursor-pointer rounded border-surface-border text-primary focus:ring-2 focus:ring-primary-200"
                    :checked="allSelected"
                    aria-label="Бүгдийг сонгох"
                    @change="toggleAll"
                  />
                </th>
                <th class="px-4 py-3 text-body-sm font-medium text-content-secondary">
                  Ачааны дугаар
                </th>
                <th class="px-4 py-3 text-body-sm font-medium text-content-secondary">Төлөв</th>
                <th class="px-4 py-3 text-right text-body-sm font-medium text-content-secondary">
                  Үлдэгдэл
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="p in packages"
                :key="p.id"
                class="cursor-pointer border-b border-surface-border last:border-0 hover:bg-surface-hover"
                @click="toggle(p.id)"
              >
                <td class="px-4 py-3" @click.stop>
                  <input
                    type="checkbox"
                    class="h-4 w-4 cursor-pointer rounded border-surface-border text-primary focus:ring-2 focus:ring-primary-200"
                    :checked="selected.includes(p.id)"
                    :aria-label="`${p.trackingNumber} сонгох`"
                    @change="toggle(p.id)"
                  />
                </td>
                <td class="tabular px-4 py-3 text-body font-medium text-content">
                  {{ p.trackingNumber }}
                </td>
                <td class="px-4 py-3">
                  <UiStatusBadge :status="p.status" size="sm" />
                </td>
                <td
                  class="tabular px-4 py-3 text-right text-body font-semibold"
                  :class="p.balance > 0 ? 'text-error' : 'text-content-secondary'"
                >
                  {{ formatCurrency(p.balance) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <template v-if="packages.length">
          <UiField v-if="selectedTotal > 0" label="Төлбөрийн хэлбэр" required>
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

          <div class="flex items-center justify-between rounded-card border border-surface-border px-4 py-3">
            <span class="text-body text-content-secondary">
              {{ selected.length }} ачаа · Нийт төлөх
            </span>
            <span
              class="tabular text-h3 font-bold"
              :class="selectedTotal > 0 ? 'text-error' : 'text-success'"
            >
              {{ formatCurrency(selectedTotal) }}
            </span>
          </div>
        </template>
      </template>
    </div>

    <template #footer>
      <UiBtn variant="ghost" :disabled="busy" @click="close">Болих</UiBtn>
      <UiBtn
        v-if="customer && packages.length"
        variant="success"
        :icon="PackageCheck"
        :loading="busy"
        :disabled="selected.length === 0"
        @click="handOver"
      >
        {{ selected.length }} ачааг хүлээлгэн өгөх
      </UiBtn>
    </template>
  </UiModal>
</template>
