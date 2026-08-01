<script setup lang="ts">
import {
  Barcode as BarcodeIcon,
  Phone,
  Plus,
  Trash2,
  Check,
  Wand2,
  PackageCheck,
  Globe2,
  PenLine,
  Calculator,
  AlertTriangle,
} from 'lucide-vue-next'
import type { CargoPackage } from '~/composables/usePackages'

/**
 * ОЛНООР АЧАА БҮРТГЭХ
 *
 * "Ачаа бүртгэх" (`new.vue`)-ийн хурдны зарчмыг ХОЛИМОГ ХАРИЛЦАГЧДЫН
 * БАГЦАД өргөтгөсөн хувилбар: нэг дэлгэц дээр олон мөр (дугаар+утас тус
 * бүрээрээ өөр харилцагч) бөглөөд НЭГ товчоор бүгдийг илгээнэ. Excel/CSV
 * АШИГЛАХГҮЙ — цэвэр вэб форм.
 *
 * Байршил, ачааны төрөл, үнийн горим, бүртгэлийн төлөв БҮХ мөрөнд НИЙТЛЭГ
 * (sticky) — ажлын нэг ээлжинд ихэвчлэн нэг тавиур дээр ижил төрлийн ачаа
 * тавигддаг тул мөр бүрт давтан сонгуулах шаардлагагүй. Мөр тус бүрт зөвхөн
 * харилцагчийн мэдээлэл (дугаар, утас, нэр) БА жин/үнэ ялгаатай байна.
 *
 * ЗАРИМ МӨР АЛДААТАЙ БАЙВАЛ (жишээ: давхардсан дугаар) бусдыг нь бүртгэж,
 * зөвхөн алдаатай мөрийг улаанаар үлдээж ажилтанд засуулна — 1 мөрийн алдаа
 * бүх багцыг зогсоохгүй (backend: `POST /packages/bulk`, `changeStatusBulk`-
 * тай ижил хэв маяг).
 */
definePageMeta({ layout: 'admin', middleware: 'auth' })
useHead({ title: 'Ачаа олноор бүртгэх — Ивээл Карго' })

const api = usePackages()
const locationApi = useWarehouseLocations()
const toast = useToast()

type PriceMode = 'measured' | 'manual'
type RegistrationStatus = 'registered' | 'in_erlian'

const MAX_ROWS = 100
const INITIAL_ROWS = 6

let rowKeySeq = 0

interface BulkRow {
  key: number
  trackingNumber: string
  phone: string
  customerName: string
  quantity: number | null
  weightKg: number | null
  price: number | null
  error: string | null
  /** BR-45/BR-46 — дугаар урьдчилсан бичлэгтэй тул утас/нэр автоматаар олдсон */
  prefilled: boolean
}

function blankRow(): BulkRow {
  return {
    key: rowKeySeq++,
    trackingNumber: '',
    phone: '',
    customerName: '',
    quantity: 1,
    weightKg: null,
    price: null,
    error: null,
    prefilled: false,
  }
}

const rows = ref<BulkRow[]>(Array.from({ length: INITIAL_ROWS }, blankRow))

/** Мөр бүрт нийтлэг (залгамжлах) тохиргоо — §1.4-ийн sticky зарчим */
const sticky = reactive({
  registrationStatus: 'registered' as RegistrationStatus,
  mode: 'manual' as PriceMode,
  cargoTypeId: null as string | null,
  locationCode: '',
})

const isErlian = computed(() => sticky.registrationStatus === 'in_erlian')
const isMeasured = computed(() => sticky.mode === 'measured')

const cargoTypeOptions = ref<Array<{ value: string; label: string }>>([])
const locationOptions = ref<Array<{ value: string; label: string }>>([])
const saving = ref(false)
const recent = ref<CargoPackage[]>([])

const trackingRefs = ref<Array<{ focus: () => void } | null>>([])

const columnCount = computed(() => (isErlian.value ? 4 : 6))

function locationLabel(loc: { code: string; currentCount: number; capacityCount: number | null }) {
  const capacity = loc.capacityCount != null ? `${loc.currentCount}/${loc.capacityCount}` : `${loc.currentCount}`
  return `${loc.code} (${capacity})`
}

async function loadLocations() {
  try {
    const result = await locationApi.list()
    locationOptions.value = result.data.map(loc => ({ value: loc.code, label: locationLabel(loc) }))
    if (!sticky.locationCode && locationOptions.value.length > 0) {
      sticky.locationCode = locationOptions.value[0]!.value
    }
  } catch (e: any) {
    toast.error('Байршлын жагсаалт ачаалагдсангүй', { description: e.message })
  }
}

onMounted(async () => {
  try {
    const types = await api.cargoTypes()
    cargoTypeOptions.value = types.data.map(t => ({ value: t.id, label: t.name }))
    if (cargoTypeOptions.value.length === 1) {
      sticky.cargoTypeId = cargoTypeOptions.value[0]!.value
    }
  } catch (e: any) {
    toast.error('Ачааны төрөл ачаалагдсангүй', { description: e.message })
  }

  await loadLocations()
  nextTick(() => trackingRefs.value[0]?.focus())
})

async function suggestLocation() {
  try {
    const suggestion = await api.suggestLocation()
    if (!suggestion) {
      toast.info('Автомат санал тохиргоогоор унтраалттай байна')
      return
    }
    if (!locationOptions.value.some(o => o.value === suggestion.code)) {
      await loadLocations()
    }
    sticky.locationCode = suggestion.code
    toast.success(`Санал: ${suggestion.code}`)
  } catch (e: any) {
    toast.error('Хоосон нүд олдсонгүй', { description: e.message })
  }
}

/** Горим/төлөв солиход нөгөө замын мөр өгөгдөл үлдвэл будлиан үүсгэнэ */
function setRegistrationStatus(status: RegistrationStatus) {
  sticky.registrationStatus = status
  for (const row of rows.value) row.error = null
}

function setMode(mode: PriceMode) {
  sticky.mode = mode
  for (const row of rows.value) {
    row.weightKg = null
    row.price = null
    row.error = null
  }
}

function addRow() {
  if (rows.value.length >= MAX_ROWS) {
    toast.info(`Нэг дор дээд тал нь ${MAX_ROWS} мөр бүртгэнэ`)
    return
  }
  rows.value.push(blankRow())
  nextTick(() => trackingRefs.value[rows.value.length - 1]?.focus())
}

function removeRow(index: number) {
  if (rows.value.length === 1) {
    rows.value = [blankRow()]
    return
  }
  rows.value.splice(index, 1)
}

/** Enter дарахад дараагийн мөр рүү шилжинэ — сүүлийн мөр дээр шинэ мөр нэмнэ */
function handleTrackingEnter(index: number) {
  if (index === rows.value.length - 1) {
    addRow()
    return
  }
  trackingRefs.value[index + 1]?.focus()
}

/**
 * BR-45/BR-46 — мөрийн дугаар УРЬДЧИЛСАН бичлэгтэй (`expected`/`in_erlian`)
 * тохирвол утас/нэрийг ажилтнаар ДАХИН бичүүлэхгүй, автоматаар олж бөглөнө.
 * Мөр тус бүрдээ тусдаа debounce хийхийн тулд `row.key`-ээр timer хадгална —
 * нэг debounce функц бүх мөрөнд хуваалцвал зэрэг бичиж буй мөрүүдийн хайлт
 * бие биенээ дарж алгасна.
 */
const lookupTimers = new Map<number, ReturnType<typeof setTimeout>>()
const lookedUpTracking = new Map<number, string>()

function scheduleLookup(row: BulkRow) {
  const tracking = row.trackingNumber.trim()

  const timer = lookupTimers.get(row.key)
  if (timer) clearTimeout(timer)

  if (tracking.length < 4 || tracking === lookedUpTracking.get(row.key)) return

  lookupTimers.set(
    row.key,
    setTimeout(async () => {
      lookedUpTracking.set(row.key, tracking)
      try {
        const pkg = await api.getByTracking(tracking)
        if (pkg.status !== 'expected' && pkg.status !== 'in_erlian') return
        // Хайлт эргэж ирэхэд ажилтан дугаараа аль хэдийн өөрчилсөн байж болно
        if (row.trackingNumber.trim() !== tracking) return

        const customer = typeof pkg.customerId === 'object' ? pkg.customerId : null
        if (!row.phone.trim() && pkg.customerPhone) row.phone = pkg.customerPhone
        if (!row.customerName.trim() && customer?.name) row.customerName = customer.name
        row.prefilled = true
      } catch {
        // 404 — шинэ дугаар, хэвийн явдал тул алдаа харуулахгүй
      }
    }, 350)
  )
}

watch(
  rows,
  newRows => {
    for (const row of newRows) {
      if (!row.trackingNumber.trim()) row.prefilled = false
      scheduleLookup(row)
    }
  },
  { deep: true }
)

function isRowBlank(row: BulkRow) {
  return !row.trackingNumber.trim() && !row.phone.trim()
}

function buildRowPayload(row: BulkRow): Record<string, any> {
  const base: Record<string, any> = {
    trackingNumber: row.trackingNumber.trim(),
    ...(row.phone.trim() ? { phone: row.phone.trim() } : {}),
    ...(row.customerName.trim() ? { customerName: row.customerName.trim() } : {}),
  }

  if (isErlian.value) {
    base.status = 'in_erlian'
    return base
  }

  base.quantity = row.quantity ?? 1
  base.locationCode = sticky.locationCode.trim().toUpperCase()

  if (isMeasured.value) {
    base.cargoTypeId = sticky.cargoTypeId
    base.weightKg = row.weightKg
  } else {
    base.finalPrice = row.price
  }

  return base
}

/**
 * Клиент талд зөвхөн хамгийн энгийн шалгалт хийнэ — backend `create`-тэй
 * ИЖИЛ дүрмээр (тариф, давхардал гэх мэт) бүрэн шалгана.
 */
function validateRows(): Array<{ row: BulkRow; body: Record<string, any> }> | null {
  const active = rows.value.filter(row => !isRowBlank(row))
  if (active.length === 0) {
    toast.error('Ядаж нэг мөр бөглөнө үү')
    return null
  }
  if (!isErlian.value && !sticky.locationCode.trim()) {
    toast.error('Байршлын кодыг сонгоно уу')
    return null
  }
  if (!isErlian.value && isMeasured.value && !sticky.cargoTypeId) {
    toast.error('Ачааны төрлийг сонгоно уу')
    return null
  }

  let hasError = false
  const payload: Array<{ row: BulkRow; body: Record<string, any> }> = []

  for (const row of active) {
    row.error = null
    if (!row.trackingNumber.trim()) row.error = 'Дугаар оруулна уу'
    else if (!isErlian.value && isMeasured.value && row.weightKg == null) row.error = 'Жин оруулна уу'
    else if (!isErlian.value && !isMeasured.value && row.price == null) row.error = 'Үнэ оруулна уу'

    if (row.error) {
      hasError = true
    } else {
      payload.push({ row, body: buildRowPayload(row) })
    }
  }

  if (hasError) {
    toast.error('Улаанаар тэмдэглэсэн мөрийг гүйцээнэ үү')
    return null
  }

  return payload
}

async function submitAll() {
  if (saving.value) return
  const payload = validateRows()
  if (!payload) return

  saving.value = true
  try {
    const result = await api.createBulk(payload.map(item => item.body))

    recent.value.unshift(...result.succeeded)
    if (recent.value.length > 30) recent.value.length = 30

    for (const failure of result.failed) {
      const target = payload[failure.index]
      if (target) target.row.error = failure.message
    }

    const succeededKeys = new Set(
      payload
        .filter((_, index) => !result.failed.some(f => f.index === index))
        .map(item => item.row.key)
    )
    rows.value = rows.value.filter(row => !succeededKeys.has(row.key))
    if (rows.value.length === 0) {
      rows.value = Array.from({ length: INITIAL_ROWS }, blankRow)
    } else {
      rows.value.push(blankRow())
    }

    if (result.failed.length === 0) {
      toast.success(`${result.succeeded.length} ачаа бүртгэгдлээ`)
    } else {
      toast.warning(`${result.succeeded.length} бүртгэгдлээ, ${result.failed.length} алдаатай`, {
        description: 'Улаанаар тэмдэглэсэн мөрийг засаад дахин илгээнэ үү',
      })
    }

    nextTick(() => trackingRefs.value[0]?.focus())
  } catch (e: any) {
    toast.error('Бүртгэл амжилтгүй', { description: e.message })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <UiPageHeader title="Ачаа олноор бүртгэх" subtitle="Мөр нэмээд нэг товчоор бүгдийг бүртгэнэ">
      <template #actions>
        <UiBtn variant="secondary" to="/admin/packages/new">Ганцаар бүртгэх</UiBtn>
        <UiBtn variant="secondary" to="/admin/packages">Жагсаалт</UiBtn>
      </template>
    </UiPageHeader>

    <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div class="flex flex-col gap-3">
        <!-- ── Нийтлэг тохиргоо (бүх мөрөнд нэгэн адил хэрэглэгдэнэ) ─────── -->
        <div class="flex flex-col gap-3 rounded-card bg-surface-card p-4 shadow-card">
          <div>
            <p class="mb-1 text-body-sm font-medium text-content">Ачааны төлөв</p>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="flex flex-1 items-center justify-center gap-1.5 rounded-btn border px-3 py-1.5 text-body-sm font-medium transition-colors duration-200"
                :class="
                  !isErlian
                    ? 'border-primary bg-primary-50 text-primary'
                    : 'border-surface-border text-content-secondary hover:border-primary-300'
                "
                @click="setRegistrationStatus('registered')"
              >
                <PackageCheck :size="15" />
                Улаанбаатарт ирсэн
              </button>

              <button
                type="button"
                class="flex flex-1 items-center justify-center gap-1.5 rounded-btn border px-3 py-1.5 text-body-sm font-medium transition-colors duration-200"
                :class="
                  isErlian
                    ? 'border-primary bg-primary-50 text-primary'
                    : 'border-surface-border text-content-secondary hover:border-primary-300'
                "
                @click="setRegistrationStatus('in_erlian')"
              >
                <Globe2 :size="15" />
                Эрээнд байгаа
              </button>
            </div>
            <p v-if="isErlian" class="mt-1.5 flex items-start gap-1.5 text-body-sm text-content-secondary">
              <Globe2 :size="13" class="mt-0.5 shrink-0" />
              Жин, үнэ, байршил "Ирц бүртгэх"-ээр Монголд ирэхэд мөр тус бүрт нь гүйцээгдэнэ.
            </p>
          </div>

          <div v-if="!isErlian" class="grid gap-3 sm:grid-cols-2">
            <div>
              <p class="mb-1 text-body-sm font-medium text-content">Үнэ</p>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="flex flex-1 items-center justify-center gap-1.5 rounded-btn border px-2.5 py-1.5 text-body-sm font-medium transition-colors duration-200"
                  :class="
                    !isMeasured
                      ? 'border-primary bg-primary-50 text-primary'
                      : 'border-surface-border text-content-secondary hover:border-primary-300'
                  "
                  @click="setMode('manual')"
                >
                  <PenLine :size="14" />
                  Дүнг шууд бичих
                </button>

                <button
                  type="button"
                  class="flex flex-1 items-center justify-center gap-1.5 rounded-btn border px-2.5 py-1.5 text-body-sm font-medium transition-colors duration-200"
                  :class="
                    isMeasured
                      ? 'border-primary bg-primary-50 text-primary'
                      : 'border-surface-border text-content-secondary hover:border-primary-300'
                  "
                  @click="setMode('measured')"
                >
                  <Calculator :size="14" />
                  Жингээр бодох
                </button>
              </div>
            </div>

            <UiField v-if="isMeasured" label="Ачааны төрөл" required for="cargo-type">
              <UiSelectInput
                id="cargo-type"
                v-model="sticky.cargoTypeId"
                :options="cargoTypeOptions"
                placeholder="Төрөл сонгоно уу"
              />
            </UiField>

            <UiField label="Байршлын код" required for="location" :class="isMeasured ? 'sm:col-span-2' : ''">
              <div class="flex gap-2">
                <UiSelectInput
                  id="location"
                  v-model="sticky.locationCode"
                  :options="locationOptions"
                  placeholder="Байршил сонгоно уу"
                  class="flex-1"
                />
                <UiBtn variant="secondary" :icon="Wand2" @click="suggestLocation">Санал</UiBtn>
              </div>
            </UiField>
          </div>
        </div>

        <!-- ── Мөрүүд ────────────────────────────────────────────────────── -->
        <div class="rounded-card bg-surface-card p-4 shadow-card">
          <div class="overflow-x-auto">
            <table class="w-full min-w-[720px] border-collapse">
              <thead>
                <tr class="border-b border-surface-border text-left text-body-sm font-medium text-content-secondary">
                  <th class="w-8 pb-2"></th>
                  <th class="pb-2 pr-2">Ачааны дугаар</th>
                  <th class="pb-2 pr-2">Утас</th>
                  <th class="pb-2 pr-2">Нэр</th>
                  <template v-if="!isErlian">
                    <th class="w-20 pb-2 pr-2">Тоо</th>
                    <th class="w-32 pb-2 pr-2">{{ isMeasured ? 'Жин (кг)' : 'Үнэ (₮)' }}</th>
                  </template>
                  <th class="w-10 pb-2"></th>
                </tr>
              </thead>
              <tbody>
                <template v-for="(row, index) in rows" :key="row.key">
                  <tr class="border-b border-surface-border/60">
                    <td class="py-1.5 pr-1 text-center text-body-sm tabular text-content-disabled">
                      {{ index + 1 }}
                    </td>
                    <td class="py-1.5 pr-2">
                      <UiTextInput
                        :ref="(el: any) => (trackingRefs[index] = el)"
                        v-model="row.trackingNumber"
                        :icon="BarcodeIcon"
                        placeholder="SF1234567890"
                        tabular
                        :invalid="Boolean(row.error)"
                        @enter="handleTrackingEnter(index)"
                      />
                    </td>
                    <td class="py-1.5 pr-2">
                      <UiTextInput
                        v-model="row.phone"
                        type="tel"
                        :icon="Phone"
                        placeholder="99112233"
                        tabular
                        :invalid="Boolean(row.error)"
                      />
                    </td>
                    <td class="py-1.5 pr-2">
                      <UiTextInput v-model="row.customerName" placeholder="Сонголтоор" />
                    </td>
                    <template v-if="!isErlian">
                      <td class="py-1.5 pr-2">
                        <UiTextInput v-model="row.quantity" type="number" tabular />
                      </td>
                      <td class="py-1.5 pr-2">
                        <UiTextInput
                          v-if="isMeasured"
                          v-model="row.weightKg"
                          type="number"
                          suffix="кг"
                          tabular
                          :invalid="Boolean(row.error)"
                        />
                        <UiTextInput
                          v-else
                          v-model="row.price"
                          type="number"
                          suffix="₮"
                          tabular
                          :invalid="Boolean(row.error)"
                        />
                      </td>
                    </template>
                    <td class="py-1.5 text-right">
                      <button
                        type="button"
                        class="rounded-btn p-1.5 text-content-disabled transition-colors duration-200 hover:bg-error/10 hover:text-error"
                        title="Мөр устгах"
                        @click="removeRow(index)"
                      >
                        <Trash2 :size="15" />
                      </button>
                    </td>
                  </tr>
                  <tr v-if="row.error" class="border-b border-surface-border/60">
                    <td :colspan="columnCount" class="pb-1.5 pt-0.5">
                      <p class="flex items-center gap-1.5 text-body-sm text-error">
                        <AlertTriangle :size="13" class="shrink-0" />
                        {{ row.error }}
                      </p>
                    </td>
                  </tr>
                  <tr v-else-if="row.prefilled" class="border-b border-surface-border/60">
                    <td :colspan="columnCount" class="pb-1.5 pt-0.5">
                      <p class="flex items-center gap-1.5 text-body-sm text-primary">
                        <Check :size="13" class="shrink-0" />
                        Урьдчилсан бүртгэлтэй харилцагч олдож автоматаар бөглөгдлөө
                      </p>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>

          <UiBtn variant="ghost" size="sm" :icon="Plus" class="mt-2" @click="addRow">Мөр нэмэх</UiBtn>
        </div>

        <div class="flex items-center gap-3">
          <UiBtn :icon="Check" :loading="saving" @click="submitAll">Бүгдийг бүртгэх</UiBtn>
          <p class="text-body-sm text-content-secondary">
            Дугаарын талбарт Enter дарахад дараагийн мөр рүү шилжинэ.
          </p>
        </div>
      </div>

      <!-- ── Сүүлд бүртгэсэн ─────────────────────────────────────────────── -->
      <div class="min-h-0 rounded-card bg-surface-card p-3 shadow-card">
        <p class="mb-2 text-body-sm font-medium text-content">
          Энэ ээлжинд бүртгэсэн
          <span v-if="recent.length" class="tabular text-content-secondary">({{ recent.length }})</span>
        </p>

        <p v-if="recent.length === 0" class="text-body-sm text-content-secondary">
          Бүртгэсэн ачаа энд харагдана.
        </p>

        <ul v-else v-auto-animate class="-mx-2 max-h-[32rem] divide-y divide-surface-border overflow-y-auto">
          <li v-for="pkg in recent" :key="pkg.id">
            <NuxtLink
              :to="`/admin/packages/${pkg.id}`"
              class="flex items-center gap-2 rounded-btn px-2 py-1.5 transition-colors duration-200 hover:bg-surface-hover"
            >
              <div class="min-w-0 flex-1">
                <p class="tabular truncate text-body-sm font-semibold text-content">
                  {{ pkg.trackingNumber }}
                </p>
                <p class="tabular truncate text-body-sm text-content-secondary">
                  {{ pkg.customerPhone }} ·
                  {{ pkg.status === 'in_erlian' ? 'Эрээнд байгаа' : pkg.locationCode }}
                </p>
              </div>
              <p class="tabular shrink-0 text-body-sm font-semibold text-content">
                {{ pkg.status === 'in_erlian' ? '—' : formatCurrency(pkg.finalPrice) }}
              </p>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
