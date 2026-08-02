<script setup lang="ts">
import {
  ArrowLeft,
  Truck,
  PackageCheck,
  Undo2,
  Ban,
  Printer,
  History,
  ShieldCheck,
  AlertTriangle,
  Pencil,
  MapPin,
  User,
  Landmark,
  Check,
} from 'lucide-vue-next'
import {
  useDeliveries,
  DELIVERY_ERROR_CODE,
  type Delivery,
  type UnpaidPackage,
  type DeliveryFeePayment,
} from '~/composables/useDeliveries'
import { usePayments } from '~/composables/usePayments'
import type { DeliveryStatus } from '~/composables/useStatus'

/**
 * Хүргэлтийн дэлгэрэнгүй — introduction.md §5.1, §5.2 (roadmap 4.4)
 *
 * §5.2-ЫН UI ШААРДЛАГА: «Төлбөр дутуу бол статус өөрчлөх товч ИДЭВХГҮЙ болж,
 * "Төлбөр дутуу байна: XXX₮" гэсэн мэдэгдэл харуулна.»
 *
 * Товч нуух нь ХАМГААЛАЛТ БИШ — backend нь эрхээс үл хамааран хаадаг
 * (`delivery-state.js`). Энд идэвхгүй болгож байгаа шалтгаан нь зөвхөн
 * ажилтныг дэмий дарж 422 авахаас сэргийлэх.
 *
 * `unpaidTotal`-ыг BACKEND бодно — client талд ачаанаас нэмж бодвол хоёр
 * газар зөрөх эрсдэлтэй.
 */
definePageMeta({ layout: 'admin', middleware: 'auth' })

const route = useRoute()
const api = useDeliveries()
const payments = usePayments()
const toast = useToast()
const auth = useAuthStore()
const deliveryStatus = useDeliveryStatus()

const id = computed(() => String(route.params.id))

const delivery = ref<Delivery | null>(null)
const auditLogs = ref<any[]>([])
const unpaidPackages = ref<UnpaidPackage[]>([])
const unpaidTotal = ref(0)
// Roadmap 5.8 — харилцагчийн захиалсан хүргэлтийн хураамж
const unpaidFee = ref(0)
const feePayments = ref<DeliveryFeePayment[]>([])
const confirmingPaymentId = ref<string | null>(null)
const allowedTransitions = ref<DeliveryStatus[]>([])
const loading = ref(true)
const busy = ref(false)

const isManagement = computed(() => ['admin', 'manager'].includes(auth.user?.role ?? ''))

useHead(() => ({
  title: delivery.value ? `${delivery.value.deliveryNumber} — Ивээл Карго` : 'Хүргэлт',
}))

async function load() {
  loading.value = true
  try {
    const result = await api.detail(id.value)
    delivery.value = result.delivery
    auditLogs.value = result.auditLogs ?? []
    unpaidPackages.value = result.unpaidPackages ?? []
    unpaidTotal.value = result.unpaidTotal ?? 0
    unpaidFee.value = result.unpaidFee ?? 0
    feePayments.value = result.feePayments ?? []
    allowedTransitions.value = result.allowedTransitions ?? []
    driverForm.name = result.delivery.driverName ?? ''
    driverForm.phone = result.delivery.driverPhone ?? ''
  } catch (e: any) {
    toast.error('Хүргэлт ачаалагдсангүй', { description: e.message })
  } finally {
    loading.value = false
  }
}

onMounted(load)

// ── Харуулах туслахууд ───────────────────────────────────────────────────

const customer = computed(() => {
  const c = delivery.value?.customerId
  return typeof c === 'object' && c !== null ? c : null
})

/** Багц дотор ачаа бүрийн дугаар, үлдэгдэл (populate хийгдсэн байна) */
const packages = computed(() =>
  (delivery.value?.packageIds ?? []).filter(
    (p): p is { id: string; trackingNumber: string; balance: number; status: string } =>
      typeof p === 'object' && p !== null
  )
)

const driverLabel = computed(() => {
  const d = delivery.value
  if (!d) return '—'
  if (d.driverName) return d.driverPhone ? `${d.driverName} · ${d.driverPhone}` : d.driverName
  return 'Тодорхойгүй'
})

/** Товчны дүр төрх — «гаргах» нь үндсэн үйлдэл, «буцаах» нь сэрэмжлүүлэг */
const ACTION_META: Record<
  string,
  { label: string; icon: any; variant: 'primary' | 'success' | 'secondary' }
> = {
  dispatched: { label: 'Хүргэлтэнд гаргах', icon: Truck, variant: 'primary' },
  delivered: { label: 'Хүргэгдсэн гэж тэмдэглэх', icon: PackageCheck, variant: 'success' },
  returned: { label: 'Буцаагдсан', icon: Undo2, variant: 'secondary' },
}

/**
 * §5.2 — гаргах товч ЗӨВХӨН төлбөр бүрэн үед идэвхтэй.
 * Roadmap 5.8 — харилцагчийн захиалсан хүргэлтийн хураамж дутуу байсан ч мөн
 * блоклоно (`unpaidFee`, зөвхөн тухайн төрлийн хүргэлтэд 0-ээс их).
 */
function isBlocked(status: DeliveryStatus) {
  return status === 'dispatched' && (unpaidTotal.value > 0 || unpaidFee.value > 0)
}

const AUDIT_LABELS: Record<string, string> = {
  'delivery.create': 'Хүргэлт үүсгэв',
  'delivery.update': 'Мэдээлэл засав',
  'delivery.status_change': 'Төлөв өөрчлөв',
  'delivery.cancel': 'Цуцлав',
}

function auditLabel(action: string) {
  return AUDIT_LABELS[action] ?? action
}

function formatDateTime(value: string | Date | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('mn-MN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(value: string | Date | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

// ── Төлөв өөрчлөх (BR-21) ────────────────────────────────────────────────

async function changeStatus(next: DeliveryStatus) {
  busy.value = true
  try {
    await api.changeStatus(id.value, next)
    toast.success(`Хүргэлт "${deliveryStatus.label(next)}" боллоо`)
    await load()
  } catch (e: any) {
    // §5.2 — төлбөрийн хаалтыг ЯЛГАЖ харуулна: ажилтан юу хийхээ мэдэх ёстой
    if (e.code === DELIVERY_ERROR_CODE.UNPAID_PACKAGES) {
      toast.error(e.message, {
        description: 'Төлбөрийг бүрэн авсны дараа хүргэлтэнд гарна. Тойрох эрх байхгүй.',
        duration: 10000,
      })
      await load()
      return
    }
    // Roadmap 5.8 — хүргэлтийн хураамжийн хаалт
    if (e.code === DELIVERY_ERROR_CODE.UNPAID_DELIVERY_FEE) {
      toast.error(e.message, {
        description: 'Харилцагчийн шилжүүлгийг доор баталгаажуулсны дараа хүргэлтэнд гарна.',
        duration: 10000,
      })
      await load()
      return
    }
    toast.error('Төлөв өөрчлөгдсөнгүй', { description: e.message, duration: 9000 })
  } finally {
    busy.value = false
  }
}

// ── Roadmap 5.8 — хүргэлтийн хураамжийн pending төлбөр ──────────────────

async function confirmFeePayment(payment: DeliveryFeePayment) {
  confirmingPaymentId.value = payment.id
  try {
    await payments.confirmPending(payment.id)
    toast.success('Гүйлгээ баталгаажлаа', { description: 'Хураамж, ачааны үлдэгдэл шинэчлэгдлээ' })
    await load()
  } catch (e: any) {
    toast.error('Баталгаажсангүй', { description: e.message, duration: 9000 })
  } finally {
    confirmingPaymentId.value = null
  }
}

const rejectOpen = ref(false)
const rejectTarget = ref<DeliveryFeePayment | null>(null)
const rejectReason = ref('')

function openReject(payment: DeliveryFeePayment) {
  rejectTarget.value = payment
  rejectReason.value = ''
  rejectOpen.value = true
}

async function applyReject() {
  if (!rejectTarget.value || rejectReason.value.trim().length < 3) {
    toast.error('Татгалзах шалтгааныг бичнэ үү')
    return
  }
  busy.value = true
  try {
    await payments.voidPayment(rejectTarget.value.id, rejectReason.value.trim())
    toast.success('Хүсэлт татгалзагдлаа')
    rejectOpen.value = false
    await load()
  } catch (e: any) {
    toast.error('Татгалзсангүй', { description: e.message, duration: 9000 })
  } finally {
    busy.value = false
  }
}

// ── Цуцлах ───────────────────────────────────────────────────────────────

const cancelOpen = ref(false)
const cancelReason = ref('')

async function applyCancel() {
  if (cancelReason.value.trim().length < 3) {
    toast.error('Цуцлах шалтгааныг бичнэ үү')
    return
  }
  busy.value = true
  try {
    await api.cancel(id.value, cancelReason.value.trim())
    toast.success('Хүргэлт цуцлагдлаа', { description: 'Ачаа дахин багцлагдах боломжтой' })
    cancelOpen.value = false
    await load()
  } catch (e: any) {
    toast.error('Цуцлагдсангүй', { description: e.message, duration: 9000 })
  } finally {
    busy.value = false
  }
}

// ── Засах (зөвхөн `created`) ─────────────────────────────────────────────

const editOpen = ref(false)
const edit = reactive({ address: '', phone: '', scheduledDate: '', note: '' })

// Жолоочийн мэдээллийг дэлгэрэнгүй хуудаснаас шууд шинэчилнэ.
// Ингэснээр ажилтан бүх хүргэлтийн формыг дахин нээх шаардлагагүй.
const driverForm = reactive({ name: '', phone: '' })
const driverSaving = ref(false)

const driverChanged = computed(() => {
  const d = delivery.value
  return !!d && (driverForm.name.trim() !== (d.driverName ?? '') || driverForm.phone.trim() !== (d.driverPhone ?? ''))
})

async function saveDriver() {
  if (!driverChanged.value) return

  const name = driverForm.name.trim()
  const phone = driverForm.phone.trim()

  if (phone && !name) {
    toast.error('Жолоочийн нэрийг оруулна уу')
    return
  }

  driverSaving.value = true
  try {
    await api.update(id.value, {
      driverName: name || null,
      driverPhone: phone || null,
    })
    toast.success('Жолоочийн мэдээлэл хадгалагдлаа')
    await load()
  } catch (e: any) {
    toast.error('Жолоочийн мэдээлэл хадгалагдсангүй', { description: e.message, duration: 9000 })
  } finally {
    driverSaving.value = false
  }
}

function openEdit() {
  const d = delivery.value
  if (!d) return
  edit.address = d.address
  edit.phone = d.phone
  edit.scheduledDate = d.scheduledDate ? d.scheduledDate.slice(0, 10) : ''
  edit.note = d.note ?? ''
  editOpen.value = true
}

async function applyEdit() {
  busy.value = true
  try {
    await api.update(id.value, {
      address: edit.address.trim(),
      phone: edit.phone.trim() || undefined,
      scheduledDate: edit.scheduledDate || null,
      note: edit.note.trim() || null,
    })
    toast.success('Хүргэлт шинэчлэгдлээ')
    editOpen.value = false
    await load()
  } catch (e: any) {
    toast.error('Хадгалагдсангүй', { description: e.message, duration: 9000 })
  } finally {
    busy.value = false
  }
}

const printOpen = ref(false)
</script>

<template>
  <div>
    <UiPageHeader
      :title="delivery?.deliveryNumber ?? 'Хүргэлт'"
      :subtitle="delivery ? `${packages.length} ачаа · ${delivery.customerPhone}` : ''"
    >
      <template #actions>
        <UiBtn variant="ghost" :icon="ArrowLeft" to="/admin/deliveries">Жагсаалт</UiBtn>
        <UiBtn
          v-if="delivery && delivery.status === 'created'"
          variant="secondary"
          :icon="Pencil"
          @click="openEdit"
        >
          Засах
        </UiBtn>
        <UiBtn v-if="delivery" variant="secondary" :icon="Printer" @click="printOpen = true">
          Маршрут хэвлэх
        </UiBtn>
      </template>
    </UiPageHeader>

    <div v-if="loading" class="card">
      <div class="space-y-3">
        <div v-for="n in 5" :key="n" class="h-5 animate-pulse rounded bg-surface-hover" />
      </div>
    </div>

    <div v-else-if="!delivery" class="card text-center">
      <p class="text-body text-content-secondary">Хүргэлт олдсонгүй</p>
    </div>

    <div v-else class="grid gap-6 lg:grid-cols-[1fr_360px]">
      <!-- ── Зүүн багана ─────────────────────────────────────────────── -->
      <div class="space-y-6">
        <!--
          §5.2 — «Төлбөр дутуу байна: XXX₮». Хамгийн ДЭЭР, тодоор:
          ажилтан гаргах товч дарахаас ӨМНӨ шалтгааныг харах ёстой.
        -->
        <div
          v-if="unpaidTotal > 0 && delivery.status === 'created'"
          class="card border-error/40 bg-error/5"
        >
          <div class="flex gap-3">
            <AlertTriangle :size="22" class="shrink-0 text-error" />
            <div class="min-w-0">
              <p class="text-h4 font-bold text-error">
                Төлбөр дутуу байна: {{ formatCurrency(unpaidTotal) }}
              </p>
              <p class="mt-1 text-body-sm text-content-secondary">
                Төлбөр бүрэн төлөгдтөл хүргэлтэнд гарахгүй (§5.2).
                <strong>Энэ шалгалтыг тойрох эрх байхгүй — Админ ч чадахгүй.</strong>
              </p>

              <ul class="mt-3 space-y-1">
                <li
                  v-for="p in unpaidPackages"
                  :key="p.id"
                  class="flex items-center justify-between gap-3 text-body-sm"
                >
                  <NuxtLink
                    :to="`/admin/packages/${p.id}`"
                    class="tabular font-medium text-primary hover:underline"
                  >
                    {{ p.trackingNumber }}
                  </NuxtLink>
                  <span class="tabular font-semibold text-error">
                    {{ formatCurrency(p.balance) }}
                  </span>
                </li>
              </ul>

              <UiBtn class="mt-3" size="sm" to="/admin/payments/collect">Төлбөр авах</UiBtn>
            </div>
          </div>
        </div>

        <!--
          Roadmap 5.8 — харилцагчийн ӨӨРИЙН захиалсан хүргэлтийн хураамж.
          Ажилтны гар бичилтийн хуучин хүргэлтэд `feePayments` үргэлж хоосон.
        -->
        <div v-if="feePayments.length" class="card space-y-3">
          <div class="flex items-center gap-2">
            <Landmark :size="18" class="text-content-secondary" />
            <p class="text-body font-semibold text-content">Хүргэлтийн хураамжийн төлбөр</p>
          </div>

          <p v-if="unpaidFee > 0" class="text-body-sm font-semibold text-error">
            Хураамж төлөгдөөгүй: {{ formatCurrency(unpaidFee) }}
          </p>

          <ul class="space-y-2">
            <li
              v-for="p in feePayments"
              :key="p.id"
              class="flex flex-wrap items-center justify-between gap-2 rounded-card border border-surface-border px-3 py-2.5"
            >
              <div>
                <p class="tabular text-body font-medium text-content">
                  {{ formatCurrency(p.amount) }}
                </p>
                <p class="text-body-sm text-content-secondary">
                  {{ formatDateTime(p.createdAt) }}
                </p>
              </div>

              <UiStatusBadge v-if="p.status !== 'pending'" :status="p.status" kind="record" size="sm" />

              <div v-else class="flex items-center gap-1.5">
                <UiBtn
                  size="sm"
                  :icon="Check"
                  :loading="confirmingPaymentId === p.id"
                  @click="confirmFeePayment(p)"
                >
                  Баталгаажуулах
                </UiBtn>
                <UiBtn
                  v-if="isManagement"
                  size="sm"
                  variant="ghost"
                  :icon="Ban"
                  @click="openReject(p)"
                >
                  Татгалзах
                </UiBtn>
              </div>
            </li>
          </ul>
        </div>

        <!-- Багц доторх ачаа -->
        <div class="card">
          <p class="mb-3 text-body font-semibold text-content">Багц доторх ачаа</p>
          <table class="w-full border-collapse text-left">
            <thead>
              <tr class="border-b border-surface-border">
                <th class="py-2 text-body-sm font-medium text-content-secondary">
                  Ачааны дугаар
                </th>
                <th class="py-2 text-body-sm font-medium text-content-secondary">Төлөв</th>
                <th class="py-2 text-right text-body-sm font-medium text-content-secondary">
                  Үлдэгдэл
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="p in packages"
                :key="p.id"
                class="border-b border-surface-border last:border-0"
              >
                <td class="tabular py-2.5">
                  <NuxtLink
                    :to="`/admin/packages/${p.id}`"
                    class="text-body font-medium text-primary hover:underline"
                  >
                    {{ p.trackingNumber }}
                  </NuxtLink>
                </td>
                <td class="py-2.5">
                  <UiStatusBadge :status="p.status" size="sm" />
                </td>
                <td
                  class="tabular py-2.5 text-right text-body font-semibold"
                  :class="p.balance > 0 ? 'text-error' : 'text-success'"
                >
                  {{ formatCurrency(p.balance) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Төлөвийн түүх -->
        <div class="card">
          <p class="mb-3 flex items-center gap-2 text-body font-semibold text-content">
            <History :size="17" /> Төлөвийн түүх
          </p>
          <ol class="space-y-3">
            <li
              v-for="(h, index) in delivery.statusHistory"
              :key="index"
              class="flex flex-wrap items-center gap-2 text-body-sm"
            >
              <span class="tabular w-32 shrink-0 text-content-secondary">
                {{ formatDateTime(h.at) }}
              </span>
              <UiStatusBadge :status="h.to" kind="delivery" size="sm" />
              <span class="text-content-secondary">{{ h.byName ?? 'Систем' }}</span>
              <span v-if="h.reason" class="text-content-secondary">· {{ h.reason }}</span>
            </li>
          </ol>
        </div>

        <!-- §9.2 — Audit Log -->
        <div class="card">
          <p class="mb-3 flex items-center gap-2 text-body font-semibold text-content">
            <ShieldCheck :size="17" /> Хяналтын бүртгэл
          </p>
          <ul class="space-y-2">
            <li
              v-for="log in auditLogs"
              :key="log.id ?? log._id"
              class="flex flex-wrap items-center gap-2 text-body-sm"
            >
              <span class="tabular w-32 shrink-0 text-content-secondary">
                {{ formatDateTime(log.createdAt) }}
              </span>
              <span class="font-medium text-content">{{ auditLabel(log.action) }}</span>
              <span class="text-content-secondary">{{ log.actorName }}</span>
              <span v-if="log.reason" class="text-content-secondary">· {{ log.reason }}</span>
            </li>
            <li v-if="auditLogs.length === 0" class="text-body-sm text-content-secondary">
              Бүртгэл алга
            </li>
          </ul>
        </div>
      </div>

      <!-- ── Баруун багана ───────────────────────────────────────────── -->
      <div class="space-y-4">
        <div class="card">
          <div class="mb-4 flex items-center justify-between gap-3">
            <UiStatusBadge :status="delivery.status" kind="delivery" />
            <span v-if="delivery.fee > 0" class="tabular text-body-sm text-content-secondary">
              Хүргэлт {{ formatCurrency(delivery.fee) }}
            </span>
          </div>

          <!--
            Ямар товч харагдахыг BACKEND шийднэ (`allowedTransitions`).
            UI өөрөө тооцвол шилжилтийн дүрэм хоёр газар байж зөрнө (BR-21).
          -->
          <div class="space-y-2">
            <UiBtn
              v-for="next in allowedTransitions"
              :key="next"
              :variant="ACTION_META[next]?.variant ?? 'secondary'"
              :icon="ACTION_META[next]?.icon"
              :disabled="isBlocked(next)"
              :loading="busy"
              block
              @click="changeStatus(next)"
            >
              {{ ACTION_META[next]?.label ?? deliveryStatus.label(next) }}
            </UiBtn>

            <p v-if="unpaidTotal > 0 && isBlocked('dispatched')" class="text-body-sm text-error">
              Төлбөр дутуу байна: {{ formatCurrency(unpaidTotal) }}
            </p>
            <p v-if="unpaidFee > 0 && isBlocked('dispatched')" class="text-body-sm text-error">
              Хүргэлтийн хураамж төлөгдөөгүй: {{ formatCurrency(unpaidFee) }}
            </p>

            <UiBtn
              v-if="isManagement && delivery.status === 'created'"
              variant="ghost"
              :icon="Ban"
              block
              @click="cancelOpen = true"
            >
              Хүргэлт цуцлах
            </UiBtn>
          </div>
        </div>

        <!-- Хаяг ба хүлээн авагч -->
        <div class="card space-y-3">
          <div class="flex gap-2">
            <MapPin :size="17" class="mt-0.5 shrink-0 text-content-secondary" />
            <div class="min-w-0">
              <p class="text-body-sm text-content-secondary">Хүргэх хаяг</p>
              <p class="text-body font-medium text-content">{{ delivery.address }}</p>
            </div>
          </div>

          <div class="flex gap-2">
            <User :size="17" class="mt-0.5 shrink-0 text-content-secondary" />
            <div class="min-w-0">
              <p class="text-body-sm text-content-secondary">Хүлээн авагч</p>
              <p class="tabular text-body font-medium text-content">{{ delivery.phone }}</p>
              <p v-if="customer?.name" class="text-body-sm text-content-secondary">
                {{ customer.name }}
              </p>
            </div>
          </div>

          <div class="border-t border-surface-border pt-3">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div class="flex min-w-0 items-center gap-2">
                <Truck :size="17" class="shrink-0 text-content-secondary" />
                <div>
                  <p class="text-body-sm text-content-secondary">Жолоочийн мэдээлэл</p>
                  <p v-if="delivery.status !== 'created'" class="text-body font-medium text-content">
                    {{ driverLabel }}
                  </p>
                </div>
              </div>
              <UiBtn
                v-if="delivery.status === 'created'"
                size="sm"
                :loading="driverSaving"
                :disabled="!driverChanged"
                @click="saveDriver"
              >
                Хадгалах
              </UiBtn>
            </div>

            <div v-if="delivery.status === 'created'" class="grid gap-3 sm:grid-cols-2">
              <UiField label="Жолоочийн нэр" for="driver-name">
                <UiTextInput
                  id="driver-name"
                  v-model="driverForm.name"
                  :icon="User"
                  placeholder="Батбаяр"
                  @enter="saveDriver"
                />
              </UiField>
              <UiField label="Утасны дугаар" for="driver-phone">
                <UiTextInput
                  id="driver-phone"
                  v-model="driverForm.phone"
                  type="tel"
                  placeholder="99001122"
                  tabular
                  @enter="saveDriver"
                />
              </UiField>
            </div>
          </div>

          <p v-if="delivery.note" class="border-t border-surface-border pt-3 text-body-sm text-content-secondary">
            {{ delivery.note }}
          </p>
        </div>

        <div class="card">
          <dl class="space-y-2 text-body-sm">
            <div class="flex justify-between gap-3">
              <dt class="text-content-secondary">Товлосон</dt>
              <dd class="tabular text-content">{{ formatDate(delivery.scheduledDate) }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-content-secondary">Гарсан</dt>
              <dd class="tabular text-content">{{ formatDateTime(delivery.dispatchedAt) }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-content-secondary">Хүргэгдсэн</dt>
              <dd class="tabular text-content">{{ formatDateTime(delivery.deliveredAt) }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-content-secondary">Үүсгэсэн</dt>
              <dd class="tabular text-content">{{ formatDateTime(delivery.createdAt) }}</dd>
            </div>
          </dl>

          <p
            v-if="delivery.cancelReason"
            class="mt-3 border-t border-surface-border pt-3 text-body-sm text-error"
          >
            Цуцлах шалтгаан: {{ delivery.cancelReason }}
          </p>
        </div>
      </div>
    </div>

    <!-- Цуцлах -->
    <UiModal v-model="cancelOpen" title="Хүргэлт цуцлах" size="sm" persistent>
      <div class="space-y-4">
        <p class="text-body text-content-secondary">
          Хүргэлт УСТАХГҮЙ, «Цуцлагдсан» төлөвт шилжинэ. Ачаа хөдлөхгүй бөгөөд шинэ
          хүргэлтэд орох боломжтой болно.
        </p>
        <UiField label="Шалтгаан" required hint="Audit Log-д бичигдэнэ">
          <UiTextArea v-model="cancelReason" :rows="2" placeholder="Жишээ: хаяг буруу байсан" />
        </UiField>
      </div>
      <template #footer>
        <UiBtn variant="secondary" @click="cancelOpen = false">Болих</UiBtn>
        <UiBtn variant="danger" :loading="busy" @click="applyCancel">Цуцлах</UiBtn>
      </template>
    </UiModal>

    <!-- Roadmap 5.8 — хураамжийн pending төлбөрөөс татгалзах -->
    <UiModal v-model="rejectOpen" title="Гүйлгээнээс татгалзах" size="sm" persistent>
      <div class="space-y-4">
        <p class="text-body text-content-secondary">
          <span class="tabular font-semibold text-content">
            {{ rejectTarget ? formatCurrency(rejectTarget.amount) : '' }}
          </span>
          дүнтэй хүлээгдэж буй гүйлгээ хүчингүй болно. Ашиглана уу, жишээ нь мөнгө хэзээ ч ирээгүй
          бол.
        </p>
        <UiField label="Шалтгаан" required hint="Audit Log-д бичигдэнэ">
          <UiTextArea v-model="rejectReason" :rows="2" placeholder="Жишээ: гүйлгээ ирээгүй" />
        </UiField>
      </div>
      <template #footer>
        <UiBtn variant="secondary" @click="rejectOpen = false">Болих</UiBtn>
        <UiBtn variant="danger" :loading="busy" @click="applyReject">Татгалзах</UiBtn>
      </template>
    </UiModal>

    <!-- Засах — зөвхөн `created` төлөвт -->
    <UiModal v-model="editOpen" title="Хүргэлт засах" size="md">
      <div class="space-y-4">
        <UiField label="Хүргэх хаяг" required>
          <UiTextArea v-model="edit.address" :rows="2" />
        </UiField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UiField label="Хүлээн авагчийн утас">
            <UiTextInput v-model="edit.phone" type="tel" tabular />
          </UiField>
          <UiField label="Товлосон огноо">
            <UiTextInput v-model="edit.scheduledDate" type="date" />
          </UiField>
        </div>
        <UiField label="Тэмдэглэл">
          <UiTextArea v-model="edit.note" :rows="2" />
        </UiField>
      </div>
      <template #footer>
        <UiBtn variant="secondary" @click="editOpen = false">Болих</UiBtn>
        <UiBtn :loading="busy" @click="applyEdit">Хадгалах</UiBtn>
      </template>
    </UiModal>

    <DeliveryRouteSheet
      v-if="delivery"
      v-model="printOpen"
      :delivery="delivery"
      :unpaid-total="unpaidTotal"
    />
  </div>
</template>
