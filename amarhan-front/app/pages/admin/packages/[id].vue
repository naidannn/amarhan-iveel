<script setup lang="ts">
import {
  ArrowLeft,
  Printer,
  Pencil,
  Ban,
  Trash2,
  MapPin,
  ArrowRight,
  History,
  ShieldCheck,
  AlertTriangle,
  Wallet,
  Truck,
  Globe2,
  PackageCheck,
} from 'lucide-vue-next'
import { ERROR_CODE, type CargoPackage, type PackageStatusValue } from '~/composables/usePackages'
import { usePayments, type Payment } from '~/composables/usePayments'
import type { Delivery } from '~/composables/useDeliveries'

/**
 * Ачааны дэлгэрэнгүй — introduction.md §1
 *
 * Нэг хуудсанд: мэдээлэл · үнэ · төлбөр · байршил · төлөвийн түүх · audit.
 * Backend бүгдийг НЭГ хүсэлтээр буцаана (`GET /packages/:id`) — олон хүсэлт
 * хийвэл хуудас алаг ачаалагдаж, ажилтан хагас өгөгдөл хардаг.
 *
 * Ямар үйлдэл боломжтойг BACKEND шийднэ (`allowedTransitions`) — UI өөрөө
 * тооцвол шилжилтийн дүрэм хоёр газар байж зөрнө (BR-07).
 */
definePageMeta({ layout: 'admin', middleware: 'auth' })

const route = useRoute()
const api = usePackages()
const paymentApi = usePayments()
const locationApi = useWarehouseLocations()
const toast = useToast()
const status = usePackageStatus()
const auth = useAuthStore()

const id = computed(() => String(route.params.id))

const pkg = ref<CargoPackage | null>(null)
const auditLogs = ref<any[]>([])
const payments = ref<Payment[]>([])
const deliveries = ref<Delivery[]>([])
const allowedTransitions = ref<PackageStatusValue[]>([])
const loading = ref(true)

const isManagement = computed(() => ['admin', 'manager'].includes(auth.user?.role ?? ''))
const isAdmin = computed(() => auth.user?.role === 'admin')

useHead(() => ({
  title: pkg.value ? `${pkg.value.trackingNumber} — Ивээл Карго` : 'Ачаа — Ивээл Карго',
}))

async function load() {
  loading.value = true
  try {
    const result = await api.detail(id.value)
    pkg.value = result.package
    auditLogs.value = result.auditLogs ?? []
    payments.value = result.payments ?? []
    deliveries.value = result.deliveries ?? []
    allowedTransitions.value = result.allowedTransitions ?? []
  } catch (e: any) {
    toast.error('Ачаа ачаалагдсангүй', { description: e.message })
  } finally {
    loading.value = false
  }
}

onMounted(load)

// ── Харуулах туслахууд ───────────────────────────────────────────────────
const customer = computed(() => {
  const c = pkg.value?.customerId
  return typeof c === 'object' && c !== null ? c : null
})

const cargoType = computed(() => {
  const t = pkg.value?.cargoTypeId
  return typeof t === 'object' && t !== null ? t : null
})

const registeredByName = computed(() => {
  const r = pkg.value?.registeredBy
  if (!r || typeof r !== 'object') return '—'
  return `${r.firstname ?? ''} ${r.lastname ?? ''}`.trim() || '—'
})

/** Audit-ийн үйлдлийн монгол нэр — §9.2-ийн бүртгэлийг уншихад */
const AUDIT_LABELS: Record<string, string> = {
  'package.create': 'Ачаа бүртгэв',
  'package.update': 'Мэдээлэл засав',
  'package.price_override': 'Үнэ гараар өөрчлөв',
  'package.status_change': 'Төлөв өөрчлөв',
  'package.location_move': 'Байршил шилжүүлэв',
  'package.cancel': 'Хүчингүй болгов',
  'package.delete': 'Бүрмөсөн устгав',
  'package.duplicate_approved': 'Давхар бүртгэхийг зөвшөөрөв',
  // BR-46 — харилцагчийн өөрийн үйлдэл ба ажилтны шингээлт
  'package.self_register': 'Харилцагч өөрөө бүртгүүлэв',
  'package.adopted': 'Урьдчилсан бүртгэл дээр бүртгэв',
}

function auditLabel(action: string) {
  return AUDIT_LABELS[action] ?? action
}

/**
 * Audit бичлэгийн before/after нь скаляр (харуулж болохуйц) эсэх.
 * Объект утгыг (бүртгэлийн snapshot, устгасан ачааны бүх талбар) хүснэгт
 * хэлбэрээр харуулах нь энэ хуудсын зорилго биш.
 */
function scalarChange(log: { before: any; after: any }) {
  const isScalar = (v: any) => v !== null && v !== undefined && typeof v !== 'object'
  return isScalar(log.before) || isScalar(log.after)
}

function formatDateTime(value: string | Date) {
  return new Date(value).toLocaleString('mn-MN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Төлөв өөрчлөх ────────────────────────────────────────────────────────
const statusOpen = ref(false)
const nextStatus = ref<string | null>(null)
const statusReason = ref('')
const busy = ref(false)

const transitionOptions = computed(() =>
  allowedTransitions.value
    // Хүчингүй болгох нь тусдаа урсгал (BR-11) — доорх товчоор
    .filter(s => s !== 'cancelled')
    .map(s => ({ value: s, label: status.label(s) }))
)

async function applyStatus() {
  if (!nextStatus.value) return
  busy.value = true
  try {
    await api.changeStatus(id.value, nextStatus.value, statusReason.value.trim() || undefined)
    toast.success(`Төлөв "${status.label(nextStatus.value)}" болов`)
    statusOpen.value = false
    nextStatus.value = null
    statusReason.value = ''
    await load()
  } catch (e: any) {
    // BR-07 — зөвшөөрөгдөөгүй шилжилтийг тодорхой хэлнэ
    const title =
      e.code === ERROR_CODE.INVALID_STATUS_TRANSITION
        ? 'Энэ шилжилт зөвшөөрөгдөхгүй'
        : 'Төлөв өөрчлөгдсөнгүй'
    toast.error(title, { description: e.message, duration: 9000 })
  } finally {
    busy.value = false
  }
}

// ── Үнэ override (BR-04) ─────────────────────────────────────────────────
const priceOpen = ref(false)
const newPrice = ref<number | null>(null)
const priceReason = ref('')

function openPrice() {
  newPrice.value = pkg.value?.finalPrice ?? null
  priceReason.value = ''
  priceOpen.value = true
}

async function applyPrice() {
  if (newPrice.value == null || !priceReason.value.trim()) {
    toast.error('Үнэ ба шалтгааныг оруулна уу')
    return
  }
  busy.value = true
  try {
    await api.overridePrice(id.value, newPrice.value, priceReason.value.trim())
    toast.success('Үнэ өөрчлөгдлөө')
    priceOpen.value = false
    await load()
  } catch (e: any) {
    toast.error('Үнэ өөрчлөгдсөнгүй', { description: e.message, duration: 9000 })
  } finally {
    busy.value = false
  }
}

// ── Төлбөр (§1.8, §2.2) ──────────────────────────────────────────────────
const payOpen = ref(false)

/**
 * Төлбөрийн бичлэг ОЛОН ачаанд хуваарилагдсан байж болно (нэгтгэсэн нэхэмжлэх,
 * §2.3). Тиймээс ЭНЭ ачааны хуудсанд бүтэн `payment.amount`-ыг харуулбал
 * ажилтан хэт их дүн харж, тооцоо зөрсөн гэж бодно. Зөвхөн энэ ачаанд НОГДСОН
 * хэсгийг харуулна.
 */
function allocationFor(payment: Payment) {
  return payment.allocations
    .filter(a => {
      const pid = typeof a.packageId === 'object' && a.packageId !== null
        ? a.packageId.id
        : a.packageId
      return String(pid) === id.value
    })
    .reduce((sum, a) => sum + a.amount, 0)
}

const voidOpen = ref(false)
const voidTarget = ref<Payment | null>(null)
const voidReason = ref('')

function openVoid(payment: Payment) {
  voidTarget.value = payment
  voidReason.value = ''
  voidOpen.value = true
}

async function applyVoid() {
  if (!voidTarget.value || voidReason.value.trim().length < 3) {
    toast.error('Хүчингүй болгох шалтгааныг бичнэ үү')
    return
  }
  busy.value = true
  try {
    await paymentApi.voidPayment(voidTarget.value.id, voidReason.value.trim())
    toast.success('Төлбөр хүчингүй болов', {
      description: 'Ачааны үлдэгдэл дахин бодогдлоо',
    })
    voidOpen.value = false
    await load()
  } catch (e: any) {
    toast.error('Хүчингүй болсонгүй', { description: e.message, duration: 9000 })
  } finally {
    busy.value = false
  }
}

// ── Байршил шилжүүлэх (BR-25) ────────────────────────────────────────────
const locationOpen = ref(false)
const newLocation = ref('')
const locationReason = ref('')

async function applyLocation() {
  if (!newLocation.value.trim()) {
    toast.error('Байршлын кодыг оруулна уу')
    return
  }
  busy.value = true
  try {
    const result = await api.moveLocation(
      id.value,
      newLocation.value.trim().toUpperCase(),
      locationReason.value.trim() || undefined
    )
    toast.success(`Байршил ${result.package.locationCode} болов`)
    for (const warning of result.warnings ?? []) toast.warning(warning)
    locationOpen.value = false
    newLocation.value = ''
    locationReason.value = ''
    await load()
  } catch (e: any) {
    toast.error('Байршил шилжсэнгүй', { description: e.message })
  } finally {
    busy.value = false
  }
}

// ── Ирц бүртгэх (BR-45) ──────────────────────────────────────────────────
// "Эрээнд байгаа" ачаа Монголд ирэхэд жин/үнэ/байршил нэмж "Бүртгэгдсэн"
// болгоно. `new.vue`-гийн хоёр горимтой яг адил зарчим (BR-01/BR-01a).
const arriveOpen = ref(false)
type ArriveMode = 'measured' | 'manual'
const arriveMode = ref<ArriveMode>('manual')
const arriveCargoTypeId = ref<string | null>(null)
const arriveWeightKg = ref<number | null>(null)
const arriveLengthCm = ref<number | null>(null)
const arriveWidthCm = ref<number | null>(null)
const arriveHeightCm = ref<number | null>(null)
const arrivePrice = ref<number | null>(null)
const arrivePriceReason = ref('')
const arriveLocationCode = ref<string | null>(null)

const arriveCargoTypeOptions = ref<Array<{ value: string; label: string }>>([])
const arriveLocationOptions = ref<Array<{ value: string; label: string }>>([])

const arriveHasDimensions = computed(
  () => arriveLengthCm.value != null && arriveWidthCm.value != null && arriveHeightCm.value != null
)

async function openArrive() {
  arriveMode.value = 'manual'
  arriveCargoTypeId.value = null
  arriveWeightKg.value = null
  arriveLengthCm.value = null
  arriveWidthCm.value = null
  arriveHeightCm.value = null
  arrivePrice.value = null
  arrivePriceReason.value = ''
  arriveLocationCode.value = null

  try {
    const [types, locations] = await Promise.all([api.cargoTypes(), locationApi.list()])
    arriveCargoTypeOptions.value = types.data.map(t => ({ value: t.id, label: t.name }))
    arriveLocationOptions.value = locations.data.map(loc => ({
      value: loc.code,
      label: loc.capacityCount != null
        ? `${loc.code} (${loc.currentCount}/${loc.capacityCount})`
        : `${loc.code} (${loc.currentCount})`,
    }))
  } catch (e: any) {
    toast.error('Төрөл/байршил ачаалагдсангүй', { description: e.message })
  }

  arriveOpen.value = true
}

async function applyArrive() {
  if (!arriveLocationCode.value) {
    toast.error('Байршлын кодыг сонгоно уу')
    return
  }
  if (arriveMode.value === 'manual' && arrivePrice.value == null) {
    toast.error('Үнийн дүнг оруулна уу')
    return
  }
  if (arriveMode.value === 'measured' && arriveWeightKg.value == null && !arriveHasDimensions.value) {
    toast.error('Жин эсвэл хэмжээсийг оруулна уу')
    return
  }

  const payload: Record<string, any> = { locationCode: arriveLocationCode.value }

  if (arriveMode.value === 'measured') {
    payload.cargoTypeId = arriveCargoTypeId.value
    if (arriveWeightKg.value != null) payload.weightKg = arriveWeightKg.value
    if (arriveHasDimensions.value) {
      payload.dimensions = {
        lengthCm: arriveLengthCm.value,
        widthCm: arriveWidthCm.value,
        heightCm: arriveHeightCm.value,
      }
    }
    if (arrivePrice.value != null) {
      payload.finalPrice = arrivePrice.value
      payload.priceOverrideReason = arrivePriceReason.value.trim()
    }
  } else {
    payload.finalPrice = arrivePrice.value
  }

  busy.value = true
  try {
    await api.completeArrival(id.value, payload)
    toast.success('Ирц бүртгэгдлээ — ачаа "Улаанбаатарт ирсэн" боллоо')
    arriveOpen.value = false
    await load()
  } catch (e: any) {
    toast.error('Ирц бүртгэгдсэнгүй', { description: e.message, duration: 9000 })
  } finally {
    busy.value = false
  }
}

// ── Хүчингүй болгох ба устгах (§1.6) ─────────────────────────────────────
const cancelOpen = ref(false)
const cancelReason = ref('')

async function applyCancel() {
  if (!cancelReason.value.trim()) {
    toast.error('Хүчингүй болгох шалтгааныг бичнэ үү')
    return
  }
  busy.value = true
  try {
    await api.cancel(id.value, cancelReason.value.trim())
    toast.success('Ачаа хүчингүй болов')
    cancelOpen.value = false
    await load()
  } catch (e: any) {
    toast.error('Хүчингүй болгож чадсангүй', { description: e.message, duration: 9000 })
  } finally {
    busy.value = false
  }
}

const deleteOpen = ref(false)
const deleteReason = ref('')

async function applyDelete() {
  if (!deleteReason.value.trim()) {
    toast.error('Устгах шалтгааныг бичнэ үү')
    return
  }
  busy.value = true
  try {
    await api.remove(id.value, deleteReason.value.trim())
    toast.success('Ачаа бүрмөсөн устлаа')
    await navigateTo('/admin/packages')
  } catch (e: any) {
    // BR-10 — нөхцөл биелээгүй бол "Хүчингүй" болгохыг санал болгоно
    if (e.code === ERROR_CODE.DELETE_NOT_ALLOWED) {
      deleteOpen.value = false
      toast.error('Устгах боломжгүй', { description: e.message, duration: 9000 })
      cancelOpen.value = true
      return
    }
    toast.error('Устгаж чадсангүй', { description: e.message })
  } finally {
    busy.value = false
  }
}

const printOpen = ref(false)
</script>

<template>
  <div>
    <!-- Ачаалж буй -->
    <div v-if="loading" class="space-y-4">
      <div class="h-8 w-64 animate-pulse rounded bg-surface-hover" />
      <div class="h-48 animate-pulse rounded-card bg-surface-hover" />
    </div>

    <div v-else-if="!pkg" class="card text-center">
      <p class="text-body text-content-secondary">Ачаа олдсонгүй.</p>
      <UiBtn class="mt-4" variant="secondary" :icon="ArrowLeft" to="/admin/packages">
        Жагсаалт руу
      </UiBtn>
    </div>

    <template v-else>
      <UiPageHeader :title="pkg.trackingNumber">
        <template #actions>
          <UiBtn variant="ghost" :icon="ArrowLeft" to="/admin/packages">Жагсаалт</UiBtn>
          <UiBtn variant="secondary" :icon="Printer" @click="printOpen = true">Хэвлэх</UiBtn>
          <!--
            BR-45/BR-46 — урьдчилсан бүртгэлийн (Эрээнд байгаа, эсвэл
            харилцагчийн мэдүүлсэн) цорын ганц дараагийн алхам
          -->
          <UiBtn
            v-if="status.isPreArrival(pkg.status)"
            :icon="PackageCheck"
            @click="openArrive"
          >
            Ирц бүртгэх
          </UiBtn>
          <UiBtn
            v-if="transitionOptions.length"
            :icon-right="ArrowRight"
            @click="statusOpen = true"
          >
            Төлөв өөрчлөх
          </UiBtn>
        </template>
      </UiPageHeader>

      <!-- Хүчингүй болсон ачаа — хамгийн дээр анхааруулна -->
      <div
        v-if="pkg.status === 'cancelled'"
        class="mb-6 flex items-start gap-3 rounded-card bg-error/5 p-4"
      >
        <Ban :size="20" class="mt-0.5 shrink-0 text-error" />
        <div class="text-body">
          <p class="font-semibold text-content">Энэ ачаа хүчингүй болсон</p>
          <p class="mt-0.5 text-content-secondary">
            {{ pkg.cancelledAt ? formatDateTime(pkg.cancelledAt) : '' }} ·
            {{ pkg.cancelReason }}
          </p>
        </div>
      </div>

      <!-- BR-45 — "Эрээнд байгаа": физикээр Монголд хараахан ирээгүй -->
      <div
        v-if="pkg.status === 'in_erlian'"
        class="mb-6 flex items-start gap-3 rounded-card bg-primary-50 p-4"
      >
        <Globe2 :size="20" class="mt-0.5 shrink-0 text-primary" />
        <div class="min-w-0 text-body">
          <p class="font-semibold text-content">Энэ ачаа Эрээнд байгаа — Монголд хараахан ирээгүй</p>
          <p class="mt-0.5 text-content-secondary">
            Зөвхөн ачааны дугаар, харилцагчийн утас мэдэгдэж байна. Ачаа Монголд
            ирэхэд "Ирц бүртгэх" товчоор жин, үнэ, байршлыг нэмнэ.
          </p>
        </div>
      </div>

      <!--
        BR-46 — харилцагч ӨӨРӨӨ мэдүүлсэн ачаа. Ажилтанд ХАРАГДАХ ЁСТОЙ:
        дугаар, тоо ширхэг нь ХАРИЛЦАГЧИЙН бичсэнээр, компани хараахан
        баталгаажуулаагүй. Ирц бүртгэхэд ажилтны оруулсан утас давамгайлна.
      -->
      <div
        v-if="pkg.status === 'expected'"
        class="mb-6 flex items-start gap-3 rounded-card bg-primary-50 p-4"
      >
        <Globe2 :size="20" class="mt-0.5 shrink-0 text-primary" />
        <div class="min-w-0 text-body">
          <p class="font-semibold text-content">
            Харилцагч өөрөө бүртгүүлсэн — ачаа хараахан ирээгүй
          </p>
          <p class="mt-0.5 text-content-secondary">
            Жин, үнэ, байршил хараахан байхгүй. Ачаа Эрээнд ирснийг "Төлөв
            өөрчлөх"-өөр, Улаанбаатарт ирэхэд "Ирц бүртгэх"-ээр яг энэ бичлэг
            дээр гүйцээнэ.
          </p>
          <p v-if="pkg.customerNote" class="mt-1 text-content">
            Харилцагчийн тэмдэглэл: {{ pkg.customerNote }}
          </p>
        </div>
      </div>

      <div
        v-if="pkg.isDuplicateApproved"
        class="mb-6 flex items-start gap-3 rounded-card bg-warning/5 p-4"
      >
        <AlertTriangle :size="20" class="mt-0.5 shrink-0 text-warning" />
        <p class="text-body text-content">
          Давхар бүртгэл — Менежер зөвшөөрсөн. Ижил дугаартай өөр ачаа байна.
        </p>
      </div>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <!-- ── Зүүн: мэдээлэл ба түүх ──────────────────────────────────── -->
        <div class="space-y-6">
          <!-- Үндсэн мэдээлэл -->
          <div class="card">
            <div class="mb-4 flex items-center justify-between gap-3">
              <h2 class="text-h4 text-content">Ачааны мэдээлэл</h2>
              <UiStatusBadge :status="pkg.status" />
            </div>

            <dl class="grid grid-cols-2 gap-x-4 gap-y-4 sm:gap-x-6">
              <div>
                <dt class="text-body-sm text-content-secondary">Харилцагч</dt>
                <dd class="tabular mt-0.5 text-body font-medium text-content">
                  {{ customer?.phone ?? pkg.customerPhone ?? 'Холбоогүй' }}
                  <span v-if="customer?.name" class="font-normal text-content-secondary">
                    · {{ customer.name }}
                  </span>
                </dd>
              </div>

              <div>
                <dt class="text-body-sm text-content-secondary">Ачааны төрөл</dt>
                <dd class="mt-0.5 text-body font-medium text-content">
                  {{ cargoType?.name ?? '—' }}
                </dd>
              </div>

              <div>
                <dt class="text-body-sm text-content-secondary">Тоо хэмжээ</dt>
                <dd class="tabular mt-0.5 text-body font-medium text-content">
                  {{ pkg.quantity }} шир
                </dd>
              </div>

              <div>
                <dt class="text-body-sm text-content-secondary">Жин / Эзлэхүүн</dt>
                <dd class="tabular mt-0.5 text-body font-medium text-content">
                  {{ pkg.weightKg != null ? `${pkg.weightKg} кг` : '—' }}
                  <span v-if="pkg.volumeM3 != null"> · {{ pkg.volumeM3 }} м³</span>
                </dd>
              </div>

              <div v-if="pkg.dimensions">
                <dt class="text-body-sm text-content-secondary">Хэмжээс</dt>
                <dd class="tabular mt-0.5 text-body font-medium text-content">
                  {{ pkg.dimensions.lengthCm }}×{{ pkg.dimensions.widthCm }}×{{
                    pkg.dimensions.heightCm
                  }}
                  см
                </dd>
              </div>

              <div>
                <dt class="text-body-sm text-content-secondary">Ирсэн огноо</dt>
                <dd class="tabular mt-0.5 text-body font-medium text-content">
                  {{ new Date(pkg.arrivedAt).toLocaleDateString('mn-MN') }}
                </dd>
              </div>

              <div>
                <dt class="text-body-sm text-content-secondary">Бүртгэсэн</dt>
                <dd class="mt-0.5 text-body font-medium text-content">
                  {{ registeredByName }}
                  <span class="tabular font-normal text-content-secondary">
                    · {{ formatDateTime(pkg.createdAt) }}
                  </span>
                </dd>
              </div>

              <div v-if="pkg.note" class="sm:col-span-2">
                <dt class="text-body-sm text-content-secondary">Тайлбар</dt>
                <dd class="mt-0.5 text-body text-content">{{ pkg.note }}</dd>
              </div>
            </dl>
          </div>

          <!-- Төлөвийн түүх (§1.5) -->
          <div class="card">
            <h2 class="mb-4 flex items-center gap-2 text-h4 text-content">
              <History :size="19" class="text-content-secondary" />
              Төлөвийн түүх
            </h2>

            <ol class="space-y-4">
              <li
                v-for="(entry, index) in [...pkg.statusHistory].reverse()"
                :key="index"
                class="flex gap-3"
              >
                <div class="flex flex-col items-center">
                  <span
                    class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    :style="{ backgroundColor: status.style(entry.to).color }"
                  />
                  <span
                    v-if="index < pkg.statusHistory.length - 1"
                    class="mt-1 w-px flex-1 bg-surface-border"
                  />
                </div>

                <div class="min-w-0 pb-1">
                  <p class="text-body font-medium text-content">
                    {{ status.label(entry.to) }}
                    <span v-if="entry.from" class="font-normal text-content-secondary">
                      ← {{ status.label(entry.from) }}
                    </span>
                  </p>
                  <p class="tabular text-body-sm text-content-secondary">
                    {{ formatDateTime(entry.at) }}
                    <span v-if="entry.byName"> · {{ entry.byName }}</span>
                  </p>
                  <p v-if="entry.reason" class="mt-0.5 text-body-sm text-content">
                    {{ entry.reason }}
                  </p>
                </div>
              </li>
            </ol>
          </div>

          <!-- Audit (§9.2) — зөвхөн Менежер/Админд харагдана -->
          <div v-if="isManagement" class="card">
            <h2 class="mb-4 flex items-center gap-2 text-h4 text-content">
              <ShieldCheck :size="19" class="text-content-secondary" />
              Хяналтын бүртгэл
              <span class="tabular text-body font-normal text-content-secondary">
                ({{ auditLogs.length }})
              </span>
            </h2>

            <p v-if="auditLogs.length === 0" class="text-body text-content-secondary">
              Бүртгэл байхгүй.
            </p>

            <ul v-else class="divide-y divide-surface-border">
              <li v-for="log in auditLogs" :key="log.id" class="py-3 first:pt-0 last:pb-0">
                <div class="flex flex-wrap items-baseline gap-x-2">
                  <p class="text-body font-medium text-content">{{ auditLabel(log.action) }}</p>
                  <p v-if="log.field" class="text-body-sm text-content-secondary">
                    · {{ log.field }}
                  </p>
                  <p class="tabular ml-auto text-body-sm text-content-secondary">
                    {{ formatDateTime(log.createdAt) }}
                  </p>
                </div>

                <p class="text-body-sm text-content-secondary">{{ log.actorName }}</p>

                <!-- Зөвхөн ХАРУУЛАХ БОЛОМЖТОЙ (скаляр) өөрчлөлтийг зурна.
                     `package.create` гэх мэт бичлэгийн `after` нь бүтэн объект
                     тул "…" гэж харуулах нь мэдээлэл биш, зөвхөн шуугиан. -->
                <p v-if="scalarChange(log)" class="tabular mt-1 text-body-sm text-content">
                  <span v-if="log.before !== null" class="text-content-secondary line-through">
                    {{ log.before }}
                  </span>
                  <span v-if="log.before !== null && log.after !== null"> → </span>
                  <span v-if="log.after !== null" class="font-medium">{{ log.after }}</span>
                </p>

                <p v-if="log.reason" class="mt-0.5 text-body-sm italic text-content-secondary">
                  «{{ log.reason }}»
                </p>
              </li>
            </ul>
          </div>
        </div>

        <!-- ── Баруун: үнэ, байршил, үйлдэл ────────────────────────────── -->
        <div class="space-y-6">
          <!-- Үнэ ба төлбөр -->
          <div class="card">
            <h2 class="mb-4 text-h4 text-content">Үнэ ба төлбөр</h2>

            <p class="tabular text-h2 font-bold text-content">
              {{ formatCurrency(pkg.finalPrice) }}
            </p>

            <!--
              `manual` (BR-01a) — тариф хэрэглээгүй, ажилтан дүнг өөрөө заасан.
              Тарифын дүн БАЙХГҮЙ тул "бодогдсон" гэж харуулах юм байхгүй.
            -->
            <p v-if="pkg.priceSource === 'manual'" class="mt-1 text-body-sm text-content-secondary">
              Ажилтан дүнг шууд заасан
            </p>
            <p v-else-if="pkg.priceOverridden" class="mt-1 text-body-sm text-warning">
              Гараар өөрчилсөн (бодогдсон: {{ formatCurrency(pkg.computedPrice) }})
            </p>
            <p v-else class="mt-1 text-body-sm text-content-secondary">
              {{
                pkg.priceSource === 'weight'
                  ? 'Жингээр бодогдсон'
                  : pkg.priceSource === 'volume'
                    ? 'Эзлэхүүнээр бодогдсон'
                    : 'Доод хэмжээгээр'
              }}
            </p>

            <p v-if="pkg.priceOverrideReason" class="mt-1 text-body-sm italic text-content-secondary">
              «{{ pkg.priceOverrideReason }}»
            </p>

            <dl class="mt-4 space-y-2 border-t border-surface-border pt-4 text-body">
              <div class="flex justify-between">
                <dt class="text-content-secondary">Төлөгдсөн</dt>
                <dd class="tabular font-medium text-content">
                  {{ formatCurrency(pkg.paidAmount) }}
                </dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-content-secondary">Үлдэгдэл</dt>
                <dd
                  class="tabular font-semibold"
                  :class="pkg.balance > 0 ? 'text-error' : 'text-success'"
                >
                  {{ formatCurrency(pkg.balance) }}
                </dd>
              </div>
              <div class="flex justify-between pt-1">
                <dt class="text-content-secondary">Төлбөрийн байдал</dt>
                <dd><UiStatusBadge :status="pkg.paymentStatus" kind="payment" size="sm" /></dd>
              </div>
            </dl>

            <!--
              §1.8 — төлбөр авах нь ГОЛ үйлдэл тул `primary` товч.
              Хүчингүй ачаанд төлбөр авах нь бүртгэгдээгүй мөнгө үүсгэнэ (backend
              мөн хаана), бүрэн төлөгдсөнд авах юм байхгүй.
            -->
            <UiBtn
              v-if="pkg.status !== 'cancelled' && pkg.balance > 0"
              class="mt-4"
              :icon="Wallet"
              block
              @click="payOpen = true"
            >
              Төлбөр авах
            </UiBtn>

            <!-- BR-45 — "Эрээнд байгаа" үед үнэ ХАРААХАН ТОДОРХОЙГҮЙ (pending) тул
                 гараар өөрчлөх боломжгүй — "Ирц бүртгэх"-ээр анх удаа тодорхойлно -->
            <UiBtn
              v-if="pkg.status !== 'cancelled' && !status.isPreArrival(pkg.status)"
              class="mt-2"
              variant="secondary"
              :icon="Pencil"
              block
              @click="openPrice"
            >
              Үнэ өөрчлөх
            </UiBtn>
          </div>

          <!-- §2.2 — Төлбөрийн түүх -->
          <div v-if="payments.length" class="card">
            <h2 class="mb-3 flex items-center gap-2 text-h4 text-content">
              <Wallet :size="19" class="text-content-secondary" />
              Төлбөрийн түүх
            </h2>

            <ul class="divide-y divide-surface-border">
              <li v-for="p in payments" :key="p.id" class="py-3 first:pt-0 last:pb-0">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p
                      class="tabular text-body font-semibold"
                      :class="
                        p.status === 'voided'
                          ? 'text-content-disabled line-through'
                          : 'text-content'
                      "
                    >
                      {{ formatCurrency(allocationFor(p)) }}
                    </p>
                    <p class="tabular mt-0.5 text-body-sm text-content-secondary">
                      {{ formatDateTime(p.createdAt) }}
                      <span v-if="p.receivedByName"> · {{ p.receivedByName }}</span>
                    </p>
                    <p
                      v-if="p.voidReason"
                      class="mt-0.5 text-body-sm italic text-content-secondary"
                    >
                      «{{ p.voidReason }}»
                    </p>
                  </div>

                  <div class="flex shrink-0 flex-col items-end gap-1">
                    <UiStatusBadge :status="p.method" kind="method" size="sm" />
                    <UiStatusBadge
                      v-if="p.status !== 'completed'"
                      :status="p.status"
                      kind="record"
                      size="sm"
                    />
                  </div>
                </div>

                <!--
                  BR-18 — устгахгүй, хүчингүй болгоно. Зөвхөн Менежер/Админ:
                  хүчингүй болгох нь орсон мөнгийг "байхгүй" болгодог тул
                  ажилтан өөрөө хийж чадвал кассын дутагдлыг нуух зам болно.
                -->
                <UiBtn
                  v-if="isManagement && p.status === 'completed'"
                  class="mt-2"
                  size="sm"
                  variant="ghost"
                  :icon="Ban"
                  @click="openVoid(p)"
                >
                  Хүчингүй болгох
                </UiBtn>
              </li>
            </ul>
          </div>

          <!-- §5 — Хүргэлтийн түүх (цуцлагдсаныг ч харуулна) -->
          <div v-if="deliveries.length" class="card">
            <h2 class="mb-3 flex items-center gap-2 text-h4 text-content">
              <Truck :size="19" class="text-content-secondary" />
              Хүргэлт
            </h2>

            <ul class="divide-y divide-surface-border">
              <li
                v-for="d in deliveries"
                :key="d.id"
                class="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div class="min-w-0">
                  <NuxtLink
                    :to="`/admin/deliveries/${d.id}`"
                    class="tabular text-body font-semibold text-primary hover:underline"
                  >
                    {{ d.deliveryNumber }}
                  </NuxtLink>
                  <p class="mt-0.5 truncate text-body-sm text-content-secondary">
                    {{ d.address }}
                  </p>
                </div>
                <UiStatusBadge :status="d.status" kind="delivery" size="sm" />
              </li>
            </ul>
          </div>

          <!-- Байршил -->
          <div class="card">
            <h2 class="mb-3 flex items-center gap-2 text-h4 text-content">
              <MapPin :size="19" class="text-content-secondary" />
              Байршил
            </h2>

            <p v-if="status.isPreArrival(pkg.status)" class="text-body text-content-secondary">
              {{ pkg.status === 'expected' ? 'Ачаа хараахан ирээгүй' : 'Эрээнд байгаа' }} —
              байршил хараахан тодорхойгүй
            </p>
            <p v-else class="tabular text-h3 font-bold text-content">{{ pkg.locationCode || '—' }}</p>

            <!-- BR-45 — "Эрээнд байгаа" үед байршил "Ирц бүртгэх"-ээр анх удаа
                 тодорхойлогдоно, шилжүүлэх зүйл байхгүй -->
            <UiBtn
              v-if="pkg.status !== 'cancelled' && !status.isPreArrival(pkg.status)"
              class="mt-4"
              variant="secondary"
              block
              @click="locationOpen = true"
            >
              Байршил шилжүүлэх
            </UiBtn>
          </div>

          <!-- §1.6 — эмзэг үйлдлүүд. Эрхийг backend шалгана, UI зөвхөн нуудаг. -->
          <div v-if="isManagement && pkg.status !== 'cancelled'" class="card">
            <h2 class="mb-3 text-h4 text-content">Эмзэг үйлдэл</h2>

            <div class="space-y-2">
              <UiBtn variant="secondary" :icon="Ban" block @click="cancelOpen = true">
                Хүчингүй болгох
              </UiBtn>

              <UiBtn v-if="isAdmin" variant="danger" :icon="Trash2" block @click="deleteOpen = true">
                Бүрмөсөн устгах
              </UiBtn>
            </div>

            <p class="mt-3 text-body-sm text-content-secondary">
              Бүрмөсөн устгах нь зөвхөн төлбөргүй, 24 цагийн дотор бүртгэгдсэн ачаанд
              боломжтой. Бусад тохиолдолд «Хүчингүй» болгоно.
            </p>
          </div>
        </div>
      </div>

      <!-- ── Модалууд ────────────────────────────────────────────────── -->

      <!-- §1.8 — төлбөр авах. `packages` нь массив: ижил компонент
           нэгтгэсэн нэхэмжлэхэд олон ачаатай хэрэглэгдэнэ (§2.3) -->
      <PaymentPayModal v-model="payOpen" :packages="[pkg]" @paid="load" />

      <UiModal v-model="voidOpen" title="Төлбөрийг хүчингүй болгох" size="sm" persistent>
        <div class="space-y-4">
          <p class="text-body text-content-secondary">
            <span class="tabular font-semibold text-content">
              {{ voidTarget ? formatCurrency(voidTarget.amount) : '' }}
            </span>
            дүнтэй төлбөр хүчингүй болно. Бичлэг УСТАХГҮЙ — ачааны үлдэгдэл дахин
            бодогдож, төлөв нь «Төлбөр хүлээгдэж буй» болж залруулагдана.
          </p>

          <UiField label="Шалтгаан" required hint="Audit Log-д бичигдэнэ">
            <UiTextArea v-model="voidReason" :rows="2" placeholder="Жишээ: дансаар ороогүй" />
          </UiField>
        </div>

        <template #footer>
          <UiBtn variant="secondary" @click="voidOpen = false">Болих</UiBtn>
          <UiBtn variant="danger" :loading="busy" @click="applyVoid">Хүчингүй болгох</UiBtn>
        </template>
      </UiModal>

      <UiModal v-model="statusOpen" title="Төлөв өөрчлөх">
        <div class="space-y-4">
          <p class="text-body text-content-secondary">
            Одоогийн төлөв: <span class="font-medium text-content">{{ status.label(pkg.status) }}</span>
          </p>

          <UiField label="Шинэ төлөв" required>
            <UiSelectInput
              v-model="nextStatus"
              :options="transitionOptions"
              placeholder="Төлөв сонгоно уу"
            />
          </UiField>

          <UiField label="Шалтгаан" hint="Сонголтоор — түүх ба audit-д бичигдэнэ">
            <UiTextArea v-model="statusReason" :rows="2" />
          </UiField>
        </div>

        <template #footer>
          <UiBtn variant="secondary" @click="statusOpen = false">Болих</UiBtn>
          <UiBtn :loading="busy" @click="applyStatus">Өөрчлөх</UiBtn>
        </template>
      </UiModal>

      <UiModal v-model="priceOpen" title="Үнэ гараар өөрчлөх">
        <div class="space-y-4">
          <p class="text-body text-content-secondary">
            Системийн бодсон үнэ:
            <span class="tabular font-medium text-content">
              {{ formatCurrency(pkg.computedPrice) }}
            </span>
          </p>

          <UiField label="Шинэ үнэ" required>
            <UiTextInput v-model="newPrice" type="number" suffix="₮" tabular />
          </UiField>

          <UiField
            label="Шалтгаан"
            required
            hint="Заавал. Хуучин дүн, шинэ дүн, шалтгаан audit-д бүртгэгдэнэ."
          >
            <UiTextArea v-model="priceReason" :rows="2" placeholder="Жишээ: гэрээт үнэ" />
          </UiField>
        </div>

        <template #footer>
          <UiBtn variant="secondary" @click="priceOpen = false">Болих</UiBtn>
          <UiBtn :loading="busy" @click="applyPrice">Хадгалах</UiBtn>
        </template>
      </UiModal>

      <UiModal v-model="locationOpen" title="Байршил шилжүүлэх">
        <div class="space-y-4">
          <p class="tabular text-body text-content-secondary">
            Одоогийн байршил:
            <span class="font-medium text-content">{{ pkg.locationCode || '—' }}</span>
          </p>

          <UiField label="Шинэ байршлын код" required>
            <UiTextInput v-model="newLocation" :icon="MapPin" placeholder="UB-02-B-15" tabular />
          </UiField>

          <UiField label="Шалтгаан" hint="Сонголтоор — audit-д бичигдэнэ">
            <UiTextInput v-model="locationReason" placeholder="Жишээ: тавиур цэвэрлэв" />
          </UiField>
        </div>

        <template #footer>
          <UiBtn variant="secondary" @click="locationOpen = false">Болих</UiBtn>
          <UiBtn :loading="busy" @click="applyLocation">Шилжүүлэх</UiBtn>
        </template>
      </UiModal>

      <!-- BR-45/BR-46 — Ирц бүртгэх: урьдчилсан бүртгэл → "Улаанбаатарт ирсэн" -->
      <UiModal v-model="arriveOpen" title="Ирц бүртгэх" size="lg">
        <div class="space-y-4">
          <p class="text-body text-content-secondary">
            Ачаа Монголд ирлээ гэдгийг бүртгэж, жин, үнэ, байршлыг нэмнэ.
          </p>

          <div class="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              class="flex items-start gap-2.5 rounded-card border p-3 text-left transition-all duration-200"
              :class="
                arriveMode === 'manual'
                  ? 'border-primary bg-primary-50'
                  : 'border-surface-border hover:border-primary-300'
              "
              @click="arriveMode = 'manual'"
            >
              <span class="min-w-0">
                <span class="block text-body font-semibold text-content">Дүнг шууд бичих</span>
                <span class="block text-body-sm text-content-secondary">Жин мэдэгдэхгүй үед</span>
              </span>
            </button>

            <button
              type="button"
              class="flex items-start gap-2.5 rounded-card border p-3 text-left transition-all duration-200"
              :class="
                arriveMode === 'measured'
                  ? 'border-primary bg-primary-50'
                  : 'border-surface-border hover:border-primary-300'
              "
              @click="arriveMode = 'measured'"
            >
              <span class="min-w-0">
                <span class="block text-body font-semibold text-content">Жингээр бодох</span>
                <span class="block text-body-sm text-content-secondary">Тарифаар автоматаар</span>
              </span>
            </button>
          </div>

          <div v-if="arriveMode === 'manual'">
            <UiField label="Үнийн дүн" required>
              <UiTextInput v-model="arrivePrice" type="number" suffix="₮" tabular />
            </UiField>
          </div>

          <div v-else class="space-y-4">
            <UiField label="Ачааны төрөл" required>
              <UiSelectInput
                v-model="arriveCargoTypeId"
                :options="arriveCargoTypeOptions"
                placeholder="Төрөл сонгоно уу"
              />
            </UiField>

            <div class="grid gap-4 sm:grid-cols-4">
              <UiField label="Жин">
                <UiTextInput v-model="arriveWeightKg" type="number" suffix="кг" tabular />
              </UiField>
              <UiField label="Урт">
                <UiTextInput v-model="arriveLengthCm" type="number" suffix="см" tabular />
              </UiField>
              <UiField label="Өргөн">
                <UiTextInput v-model="arriveWidthCm" type="number" suffix="см" tabular />
              </UiField>
              <UiField label="Өндөр">
                <UiTextInput v-model="arriveHeightCm" type="number" suffix="см" tabular />
              </UiField>
            </div>

            <details class="rounded-input border border-surface-border p-3">
              <summary class="cursor-pointer text-body font-medium text-content">
                Бодогдсон үнийг дарж бичих
                <span class="font-normal text-content-secondary">(шалтгаан заавал)</span>
              </summary>
              <div class="mt-3 grid gap-4 sm:grid-cols-2">
                <UiField label="Эцсийн үнэ">
                  <UiTextInput v-model="arrivePrice" type="number" suffix="₮" tabular />
                </UiField>
                <UiField label="Шалтгаан" :required="arrivePrice != null">
                  <UiTextInput v-model="arrivePriceReason" placeholder="Жишээ: жинлүүрийн зөрүү" />
                </UiField>
              </div>
            </details>
          </div>

          <UiField label="Байршлын код" required>
            <UiSelectInput
              v-model="arriveLocationCode"
              :options="arriveLocationOptions"
              placeholder="Байршил сонгоно уу"
            />
          </UiField>
        </div>

        <template #footer>
          <UiBtn variant="secondary" @click="arriveOpen = false">Болих</UiBtn>
          <UiBtn :loading="busy" @click="applyArrive">Улаанбаатарт ирсэн болгох</UiBtn>
        </template>
      </UiModal>

      <UiModal v-model="cancelOpen" title="Ачааг хүчингүй болгох" size="sm">
        <div class="space-y-4">
          <p class="text-body text-content">
            Ачаа устахгүй — «Хүчингүй» төлөвт шилжиж, түүх бүрэн хадгалагдана.
            Дугаар чөлөөлөгдөж дахин бүртгэх боломжтой болно.
          </p>

          <UiField label="Шалтгаан" required>
            <UiTextArea v-model="cancelReason" :rows="3" placeholder="Хүчингүй болгох шалтгаан" />
          </UiField>
        </div>

        <template #footer>
          <UiBtn variant="secondary" @click="cancelOpen = false">Болих</UiBtn>
          <UiBtn variant="danger" :loading="busy" @click="applyCancel">Хүчингүй болгох</UiBtn>
        </template>
      </UiModal>

      <UiModal v-model="deleteOpen" title="Ачааг бүрмөсөн устгах" size="sm" persistent>
        <div class="space-y-4">
          <div class="flex items-start gap-3 rounded-card bg-error/5 p-4">
            <AlertTriangle :size="20" class="mt-0.5 shrink-0 text-error" />
            <p class="text-body text-content">
              Энэ үйлдэл БУЦААГДАХГҮЙ. Ачааны бүх мэдээлэл устана — зөвхөн хяналтын
              бүртгэлд snapshot үлдэнэ.
            </p>
          </div>

          <UiField label="Шалтгаан" required>
            <UiTextArea v-model="deleteReason" :rows="3" placeholder="Устгах шалтгаан" />
          </UiField>
        </div>

        <template #footer>
          <UiBtn variant="secondary" @click="deleteOpen = false">Болих</UiBtn>
          <UiBtn variant="danger" :loading="busy" @click="applyDelete">Устгах</UiBtn>
        </template>
      </UiModal>

      <PackagePrintSheet v-model="printOpen" :packages="[pkg]" />
    </template>
  </div>
</template>
