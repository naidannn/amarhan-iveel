<script setup lang="ts">
import {
  Barcode as BarcodeIcon,
  Phone,
  Package as PackageIcon,
  Weight,
  Wand2,
  Check,
  AlertTriangle,
  ExternalLink,
  Keyboard,
  Calculator,
  PenLine,
  PackageCheck,
  Globe2,
} from 'lucide-vue-next'
import { useDebounceFn, onKeyStroke } from '@vueuse/core'
import { ERROR_CODE, type CargoPackage } from '~/composables/usePackages'

/**
 * ХУРДАН АЧАА БҮРТГЭХ — introduction.md §1.4
 *
 * ЭНЭ ДЭЛГЭЦИЙН БҮХ ШИЙДВЭР ХУРДААР ТАЙЛБАРЛАГДАНА. Карго өдөрт хэдэн зуу,
 * мянган ачаа бүртгэдэг тул нэг ачаанд 2 секунд хэмнэх нь өдөрт хагас цаг
 * хэмнэнэ. Тиймээс:
 *
 *   • Хуудас ДАХИН АЧААЛАГДАХГҮЙ — `navigateTo` хийхгүй, форм л цэвэрлэгдэнэ
 *   • Фокус автоматаар ачааны дугаар руу ЭРГЭНЭ
 *   • Enter дарахад бүртгэгдэнэ — хулгана хүрэх шаардлагагүй
 *   • Байршил, үнийн горим, ачааны төрөл ЗАЛГАМЖИЛНА (sticky)
 *   • Мэдэгдэл нь toast — `alert()` хуудсыг блоклож урсгалыг таслах болно
 *
 * ҮНИЙН ХОЁР ГОРИМ (§1.2, BR-01 / BR-01a):
 *   «Жингээр бодох»    — жин/хэмжээс оруулбал тарифаар бодогдоно
 *   «Дүнг шууд бичих»  — жин мэдэгдэхгүй үед ажилтан үнийг өөрөө заана
 *
 * Процессийн хувьд ачааны дугаар ба утас л ирдэг тул хоёр дахь горим нь
 * бодит ажлын гол зам болно — тиймээс нуугдмал биш, тэнцүү харагдана.
 *
 * АЧААНЫ ТӨЛӨВ (BR-45, 2026-07-31): ажилтан бүртгэх мөчид 2 сонголтын аль
 * нэгийг сонгоно —
 *   «Бүртгэгдсэн»    — ачаа гар дээр байна (одоогийн, цорын ганц урсгал байсан)
 *   «Эрээнд байгаа»  — зөвхөн дугаар+утсаар мэднэ, ачаа Монголд хараахан
 *                       ирээгүй тул жин/үнэ/байршил хоосон үлдэнэ
 * Хоёр дахь сонголтын үед үнэ/байршлын хэсгүүд нуугдана — тэдгээрийг
 * "Ирц бүртгэх" цонхоор (`[id].vue`) дараа нь нэмнэ.
 */
definePageMeta({ layout: 'admin', middleware: 'auth' })
useHead({ title: 'Ачаа бүртгэх — Ивээл Карго' })

const api = usePackages()
const locationApi = useWarehouseLocations()
const toast = useToast()
const auth = useAuthStore()

const isManagement = computed(() => ['admin', 'manager'].includes(auth.user?.role ?? ''))

type PriceMode = 'measured' | 'manual'

// ── Формын төлөв ─────────────────────────────────────────────────────────
function blankForm() {
  return {
    trackingNumber: '',
    phone: '',
    customerName: '',
    quantity: 1 as number | null,
    weightKg: null as number | null,
    lengthCm: null as number | null,
    widthCm: null as number | null,
    heightCm: null as number | null,
    note: '',
    /** Горимоос хамаарч: `measured` үед override, `manual` үед үндсэн үнэ */
    price: null as number | null,
    priceOverrideReason: '',
  }
}

const form = reactive(blankForm())

/**
 * ЗАЛГАМЖЛАХ талбарууд — бүртгэлийн дараа цэвэрлэгдэхгүй.
 * Ажилтан нэг тавиур дээр 30 ачаа тавихдаа байршлыг 30 удаа бичих ёсгүй.
 * Үнийн горим ч мөн адил — ажлын нэг ээлжинд ихэвчлэн нэг зам хэрэглэнэ.
 */
type RegistrationStatus = 'registered' | 'in_erlian'

const sticky = reactive({
  mode: 'manual' as PriceMode,
  cargoTypeId: null as string | null,
  locationCode: '',
  // BR-45 — ажилтан ихэвчлэн нэг зэрэг олон ижил төрлийн ачаа бүртгэдэг тул
  // залгамжилна (жишээ: тэс дараалан "Эрээнд байгаа" олон дугаар оруулах үе)
  registrationStatus: 'registered' as RegistrationStatus,
})

const cargoTypeOptions = ref<Array<{ value: string; label: string }>>([])
const locationOptions = ref<Array<{ value: string; label: string }>>([])
const saving = ref(false)
const recent = ref<CargoPackage[]>([])

const isErlian = computed(() => sticky.registrationStatus === 'in_erlian')

const trackingInput = ref<{ focus: () => void; select: () => void } | null>(null)

const isMeasured = computed(() => sticky.mode === 'measured')

// ── Үнийн урьдчилсан тооцоо (§1.2) ───────────────────────────────────────
const quote = ref<{ final: number; source: string; volumeM3: number | null } | null>(null)
const quoteError = ref<string | null>(null)

const hasDimensions = computed(
  () => form.lengthCm != null && form.widthCm != null && form.heightCm != null
)

const canQuote = computed(
  () => isMeasured.value && Boolean(sticky.cargoTypeId) && (form.weightKg != null || hasDimensions.value)
)

/**
 * Үнийг SERVER бодно, client талд БИШ.
 *
 * Шалтгаан: BR-01-ийн жингийн шатлал, тарифын хувилбар бүгд backend-д байна.
 * Client талд хуулбарлавал ажилтанд харагдах үнэ хадгалагдах үнээс зөрөх
 * эрсдэлтэй — мөнгөний талаар хоёр эх сурвалж байж болохгүй.
 */
const refreshQuote = useDebounceFn(async () => {
  if (!canQuote.value) {
    quote.value = null
    quoteError.value = null
    return
  }

  try {
    quoteError.value = null
    quote.value = await api.quote({
      cargoTypeId: sticky.cargoTypeId,
      ...(form.weightKg != null ? { weightKg: form.weightKg } : {}),
      ...(hasDimensions.value
        ? {
            dimensions: {
              lengthCm: form.lengthCm,
              widthCm: form.widthCm,
              heightCm: form.heightCm,
            },
          }
        : {}),
    })
  } catch (e: any) {
    quote.value = null
    quoteError.value = e.message
  }
}, 350)

watch(
  () => [sticky.mode, sticky.cargoTypeId, form.weightKg, form.lengthCm, form.widthCm, form.heightCm],
  () => refreshQuote()
)

/** Хэрэглэгчид харагдах эцсийн дүн — горимоос хамаарна */
const displayPrice = computed(() => {
  if (!isMeasured.value) return form.price
  if (form.price != null) return form.price
  return quote.value?.final ?? null
})

/** Override нь бодогдсон үнээс хэр хазайсныг харуулна (зөвхөн `measured`) */
const overrideDelta = computed(() => {
  if (!isMeasured.value || form.price == null || !quote.value) return null
  const diff = form.price - quote.value.final
  if (diff === 0) return null
  const percent = quote.value.final > 0 ? (diff / quote.value.final) * 100 : 0
  return { diff, percent: Math.round(percent * 10) / 10 }
})

// ── Давхардлын урсгал (§1.3) ─────────────────────────────────────────────
const duplicate = ref<{
  packageId: string
  trackingNumber: string
  registeredAt: string
  registeredBy: string | null
  status: string
  customerPhone: string
} | null>(null)
const duplicateReason = ref('')

/** Сонголт бүрт одоогийн ачааллыг харуулна — "UB-02-B-15 (3/5)" (BR-24) */
function locationLabel(loc: { code: string; currentCount: number; capacityCount: number | null }) {
  const capacity = loc.capacityCount != null ? `${loc.currentCount}/${loc.capacityCount}` : `${loc.currentCount}`
  return `${loc.code} (${capacity})`
}

/**
 * §8 — байршлын кодыг ЧӨЛӨӨТЭЙ БИЧИХГҮЙ, зөвхөн бодит оршин байгаа
 * байршлаас СОНГОНО (2026-07-31 шийдвэр) — андуурч байхгүй код бичих,
 * алдаатай тэмдэгт зэргээс сэргийлнэ.
 */
async function loadLocations() {
  try {
    const result = await locationApi.list()
    locationOptions.value = result.data.map(loc => ({ value: loc.code, label: locationLabel(loc) }))
    // Ачаа бүртгэх үндсэн урсгалд байршлыг давхар сонгох шаардлагагүй:
    // жагсаалт ирмэгц эхний идэвхтэй байршлыг анхдагчаар сонгоно. Хэрэглэгчийн
    // өмнө сонгосон (эсвэл залгамжилсан) утгыг дахин ачаалахад дарж солихгүй.
    if (!sticky.locationCode && locationOptions.value.length > 0) {
      sticky.locationCode = locationOptions.value[0]!.value
    }
  } catch (e: any) {
    toast.error('Байршлын жагсаалт ачаалагдсангүй', { description: e.message })
  }
}

// ── Ачаалах ──────────────────────────────────────────────────────────────
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

  trackingInput.value?.focus()
})

/** BR-23 — санал заавал БИШ, ажилтан хүсвэл дарна */
async function suggestLocation() {
  try {
    const suggestion = await api.suggestLocation()
    if (!suggestion) {
      toast.info('Автомат санал тохиргоогоор унтраалттай байна')
      return
    }
    // Санал болгосон код select-ийн жагсаалтад байхгүй бол (жишээ: шинэ
    // ачаалал өөр ажилтны бүртгэлээс өөрчлөгдсөн) дахин ачаална
    if (!locationOptions.value.some(o => o.value === suggestion.code)) {
      await loadLocations()
    }
    sticky.locationCode = suggestion.code
    toast.success(`Санал: ${suggestion.code}`)
  } catch (e: any) {
    toast.error('Хоосон нүд олдсонгүй', { description: e.message })
  }
}

function setRegistrationStatus(status: RegistrationStatus) {
  sticky.registrationStatus = status
}

function setMode(mode: PriceMode) {
  sticky.mode = mode
  // Горим солиход нөгөө замын өгөгдөл үлдвэл backend хоёуланг хүлээж авч,
  // ажилтны хүсээгүй тооцоолол хийнэ
  if (mode === 'manual') {
    form.weightKg = null
    form.lengthCm = null
    form.widthCm = null
    form.heightCm = null
    form.priceOverrideReason = ''
    quote.value = null
  } else {
    form.price = null
  }
}

// ── Бүртгэх ──────────────────────────────────────────────────────────────
function buildPayload(extra: Record<string, any> = {}) {
  const base: Record<string, any> = {
    trackingNumber: form.trackingNumber.trim(),
    phone: form.phone.trim(),
    ...(form.customerName.trim() ? { customerName: form.customerName.trim() } : {}),
    quantity: form.quantity,
    ...(form.note.trim() ? { note: form.note.trim() } : {}),
    ...extra,
  }

  // BR-45 — "Эрээнд байгаа": жин/үнэ/байршил АЛЬ Ч ТАЛБАРЫГ илгээхгүй,
  // тэдгээрийг ажилтан хараахан мэдэхгүй тул backend `forbidden` болгосон.
  if (isErlian.value) {
    base.status = 'in_erlian'
    return base
  }

  base.locationCode = sticky.locationCode.trim().toUpperCase()

  if (isMeasured.value) {
    base.cargoTypeId = sticky.cargoTypeId
    if (form.weightKg != null) base.weightKg = form.weightKg
    if (hasDimensions.value) {
      base.dimensions = {
        lengthCm: form.lengthCm,
        widthCm: form.widthCm,
        heightCm: form.heightCm,
      }
    }
    // BR-04 — тарифын дүнг дарж бичих нь OVERRIDE, шалтгаан заавал
    if (form.price != null) {
      base.finalPrice = form.price
      base.priceOverrideReason = form.priceOverrideReason.trim()
    }
  } else {
    // BR-01a — гараар заасан үнэ. Ачааны төрөл, шалтгаан шаардахгүй.
    base.finalPrice = form.price
  }

  return base
}

async function submit(extra: Record<string, any> = {}) {
  if (saving.value) return

  // Хамгийн түгээмэл алдаануудыг backend хүртэл явахгүйгээр барина —
  // сүлжээний нэг эргэлт хэмнэнэ
  if (!form.trackingNumber.trim()) {
    toast.error('Ачааны дугаарыг оруулна уу')
    trackingInput.value?.focus()
    return
  }
  if (!form.phone.trim()) {
    toast.error('Харилцагчийн утсыг оруулна уу')
    return
  }
  // BR-45 — "Эрээнд байгаа" үед жин/үнэ/байршил ХАРААХАН мэдэгдэхгүй тул
  // доорх шалгалтууд ХАМААРАХГҮЙ
  if (!isErlian.value) {
    if (!sticky.locationCode.trim()) {
      toast.error('Байршлын кодыг оруулна уу')
      return
    }
    if (!isMeasured.value && form.price == null) {
      toast.error('Үнийн дүнг оруулна уу')
      return
    }
    if (isMeasured.value && form.weightKg == null && !hasDimensions.value) {
      toast.error('Жин эсвэл хэмжээсийг оруулна уу')
      return
    }
  }

  saving.value = true
  try {
    const result = await api.create(buildPayload(extra))

    // §1.4 — БҮРТГЭГДСЭНИЙ ДАРАА: хуудас дахин ачаалагдахгүй, форм цэвэрлэгдэж
    // фокус эргэнэ. Ажилтан дараагийн ачааг ШУУД бүртгэж чадна.
    resetForNext()

    recent.value.unshift(result.package)
    if (recent.value.length > 12) recent.value.pop()

    const detail = isErlian.value
      ? 'Эрээнд байгаа — ирэхэд "Ирц бүртгэх"-ээр гүйцээнэ'
      : `${formatCurrency(result.package.finalPrice)} · ${result.package.locationCode}`

    /**
     * BR-46 — дугаар нь урьдчилсан бүртгэлтэй байсан бол шинэ бичлэг үүсээгүй,
     * тэр бичлэг дээр бүртгэгдсэн. Ажилтанд ЗААВАЛ хэлнэ: эс тэгвээс "яагаад
     * жагсаалтад нэг л мөр нэмэгдэв" гэсэн эргэлзээ үүснэ.
     */
    toast.success(
      result.adopted
        ? `${result.package.trackingNumber} — урьдчилсан бүртгэл дээр нэгтгэгдлээ`
        : `${result.package.trackingNumber} бүртгэгдлээ`,
      {
        description: result.adopted
          ? `${result.adoptedFrom === 'expected' ? 'Харилцагч өөрөө мэдүүлсэн' : 'Эрээнд бүртгэсэн'} ачаа · ${detail}`
          : detail,
      }
    )

    // BR-24 — багтаамжийн сануулга. Хориглохгүй, зөвхөн мэдэгдэнэ.
    for (const warning of result.warnings ?? []) {
      toast.warning(warning)
    }
  } catch (e: any) {
    handleCreateError(e)
  } finally {
    saving.value = false
  }
}

function handleCreateError(e: any) {
  // §1.3 — давхардсан дугаар. Ажилтанд оршин буй ачааг харуулж, Менежерт
  // шалтгаантайгаар давхардуулах боломж санал болгоно.
  if (e.code === ERROR_CODE.DUPLICATE_TRACKING_NUMBER && e.details?.packageId) {
    duplicate.value = e.details
    duplicateReason.value = ''
    return
  }

  if (e.code === ERROR_CODE.OVERRIDE_LIMIT_EXCEEDED) {
    toast.error('Үнийн хязгаар хэтэрсэн', { description: e.message, duration: 9000 })
    return
  }

  toast.error('Бүртгэл амжилтгүй', { description: e.message })
}

/** BR-06 — Менежер/Админ шалтгаантайгаар давхар бүртгэнэ */
async function confirmDuplicate() {
  if (!duplicateReason.value.trim()) {
    toast.error('Давхар бүртгэх шалтгааныг бичнэ үү')
    return
  }
  const reason = duplicateReason.value.trim()
  duplicate.value = null
  await submit({ allowDuplicate: true, duplicateReason: reason })
}

/**
 * §1.4 — талбарууд автоматаар цэвэрлэгдэж, фокус эргэнэ.
 * Залгамжлах талбарууд (`sticky`) хэвээр үлдэнэ.
 */
function resetForNext() {
  Object.assign(form, blankForm())
  quote.value = null
  quoteError.value = null

  nextTick(() => {
    trackingInput.value?.focus()
  })
}

function clearLocation() {
  sticky.locationCode = ''
  toast.info('Байршил цэвэрлэгдлээ')
}

onKeyStroke('Escape', () => {
  if (duplicate.value) duplicate.value = null
})
</script>

<template>
  <div>
    <UiPageHeader title="Ачаа бүртгэх" subtitle="Enter дарж бүртгэнэ — хуудас дахин ачаалагдахгүй">
      <template #actions>
        <UiBtn variant="secondary" to="/admin/packages/bulk">Олноор бүртгэх</UiBtn>
        <UiBtn variant="secondary" to="/admin/packages">Жагсаалт</UiBtn>
      </template>
    </UiPageHeader>

    <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <!-- ── Форм ─────────────────────────────────────────────────────── -->
      <form
        class="flex flex-col gap-3 rounded-card bg-surface-card p-4 shadow-card"
        @submit.prevent="submit()"
      >
        <div class="grid gap-3 sm:grid-cols-3">
          <UiField label="Ачааны дугаар" required for="tracking" class="sm:col-span-2">
            <UiTextInput
              id="tracking"
              ref="trackingInput"
              v-model="form.trackingNumber"
              :icon="BarcodeIcon"
              placeholder="Жишээ: SF1234567890"
              tabular
              autofocus
            />
          </UiField>

          <UiField label="Харилцагчийн утас" required for="phone">
            <UiTextInput
              id="phone"
              v-model="form.phone"
              type="tel"
              :icon="Phone"
              placeholder="99112233"
              tabular
            />
          </UiField>
        </div>

        <UiField label="Харилцагчийн нэр" for="customer-name" hint="Шинэ харилцагч бол — бүртгэлтэй бол автоматаар холбогдоно">
          <UiTextInput id="customer-name" v-model="form.customerName" placeholder="Сонголтоор" />
        </UiField>

        <!-- ── АЧААНЫ ТӨЛӨВ (BR-45) ──────────────────────────────────────── -->
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
            Жин, үнэ, байршил "Ирц бүртгэх"-ээр Монголд ирэхэд гүйцээгдэнэ.
          </p>
        </div>

        <!-- ── ҮНЭ: хоёр горим (§1.2) ─────────────────────────────────── -->
        <div v-if="!isErlian" class="rounded-card border border-surface-border p-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-body-sm font-medium text-content">Үнэ <span class="text-error">*</span></p>

            <div class="flex gap-2">
              <button
                type="button"
                class="flex items-center gap-1.5 rounded-btn border px-2.5 py-1 text-body-sm font-medium transition-colors duration-200"
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
                class="flex items-center gap-1.5 rounded-btn border px-2.5 py-1 text-body-sm font-medium transition-colors duration-200"
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

          <!-- Горим Б: гараар үнэ -->
          <div v-if="!isMeasured" class="mt-3 grid gap-3 sm:grid-cols-2">
            <UiField label="Үнийн дүн" required for="manual-price">
              <UiTextInput
                id="manual-price"
                v-model="form.price"
                type="number"
                suffix="₮"
                placeholder="0"
                tabular
              />
            </UiField>

            <UiField label="Тоо хэмжээ" for="quantity-manual">
              <UiTextInput
                id="quantity-manual"
                v-model="form.quantity"
                type="number"
                :icon="PackageIcon"
                tabular
              />
            </UiField>
          </div>

          <!-- Горим А: жин/хэмжээсээр -->
          <div v-else class="mt-3 space-y-3">
            <div class="grid gap-3 sm:grid-cols-2">
              <UiField label="Ачааны төрөл" required for="cargo-type">
                <UiSelectInput
                  id="cargo-type"
                  v-model="sticky.cargoTypeId"
                  :options="cargoTypeOptions"
                  placeholder="Төрөл сонгоно уу"
                />
              </UiField>

              <UiField label="Тоо хэмжээ" for="quantity">
                <UiTextInput
                  id="quantity"
                  v-model="form.quantity"
                  type="number"
                  :icon="PackageIcon"
                  tabular
                />
              </UiField>
            </div>

            <div class="grid gap-3 sm:grid-cols-4">
              <UiField label="Жин" for="weight">
                <UiTextInput
                  id="weight"
                  v-model="form.weightKg"
                  type="number"
                  :icon="Weight"
                  suffix="кг"
                  placeholder="0.00"
                  tabular
                />
              </UiField>

              <UiField label="Урт" for="length">
                <UiTextInput id="length" v-model="form.lengthCm" type="number" suffix="см" tabular />
              </UiField>
              <UiField label="Өргөн" for="width">
                <UiTextInput id="width" v-model="form.widthCm" type="number" suffix="см" tabular />
              </UiField>
              <UiField label="Өндөр" for="height">
                <UiTextInput id="height" v-model="form.heightCm" type="number" suffix="см" tabular />
              </UiField>
            </div>

            <!-- BR-04 — тарифын дүнг дарж бичих -->
            <details class="rounded-input border border-surface-border p-2.5">
              <summary class="cursor-pointer text-body-sm font-medium text-content">
                Бодогдсон үнийг дарж бичих
                <span class="font-normal text-content-secondary">(шалтгаан заавал)</span>
              </summary>

              <div class="mt-2.5 grid gap-3 sm:grid-cols-2">
                <UiField label="Эцсийн үнэ" for="override-price">
                  <UiTextInput
                    id="override-price"
                    v-model="form.price"
                    type="number"
                    suffix="₮"
                    :placeholder="quote ? String(quote.final) : '0'"
                    tabular
                  />
                </UiField>

                <UiField label="Шалтгаан" for="override-reason" :required="form.price != null">
                  <UiTextInput
                    id="override-reason"
                    v-model="form.priceOverrideReason"
                    placeholder="Жишээ: жинлүүрийн зөрүү"
                  />
                </UiField>
              </div>

              <p
                v-if="overrideDelta"
                class="mt-2.5 text-body-sm"
                :class="overrideDelta.diff > 0 ? 'text-warning' : 'text-primary-600'"
              >
                Бодогдсон үнээс
                <span class="tabular font-semibold">
                  {{ overrideDelta.diff > 0 ? '+' : '' }}{{ formatCurrency(overrideDelta.diff) }}
                </span>
                ({{ overrideDelta.percent > 0 ? '+' : '' }}{{ overrideDelta.percent }}%)
                <span v-if="!isManagement && Math.abs(overrideDelta.percent) > 20">
                  — Ажилтны хязгаараас давсан, Менежерээр хийлгэнэ
                </span>
              </p>
            </details>
          </div>
        </div>

        <!-- Байршил — 2026-07-31: чөлөөтэй бичихийг хассан, зөвхөн бодит
             оршин байгаа байршлаас сонгоно (§8) -->
        <div class="grid gap-3 sm:grid-cols-2">
          <UiField
            v-if="!isErlian"
            label="Байршлын код"
            required
            for="location"
          >
            <div class="flex gap-2">
              <UiSelectInput
                id="location"
                v-model="sticky.locationCode"
                :options="locationOptions"
                placeholder="Байршил сонгоно уу"
                class="flex-1"
              />
              <UiBtn variant="secondary" :icon="Wand2" @click="suggestLocation">Санал</UiBtn>
              <UiBtn v-if="sticky.locationCode" variant="ghost" @click="clearLocation">
                Цэвэрлэх
              </UiBtn>
            </div>
          </UiField>

          <UiField label="Тайлбар" for="note">
            <UiTextArea id="note" v-model="form.note" :rows="1" placeholder="Сонголтоор" />
          </UiField>
        </div>

        <div class="mt-1 flex flex-wrap items-center gap-3 border-t border-surface-border pt-3">
          <UiBtn type="submit" :icon="Check" :loading="saving">Бүртгэх</UiBtn>
          <UiBtn variant="ghost" @click="resetForNext">Цэвэрлэх</UiBtn>

          <p class="ml-auto flex items-center gap-1.5 text-body-sm text-content-secondary">
            <Keyboard :size="15" />
            <kbd class="rounded border border-surface-border px-1.5 py-0.5 font-mono">Enter</kbd>
            дарж бүртгэнэ
          </p>
        </div>
      </form>

      <!-- ── Хажуугийн хэсэг ──────────────────────────────────────────── -->
      <div class="flex flex-col gap-3">
        <div v-if="isErlian" class="rounded-card bg-surface-card p-3 shadow-card">
          <p class="flex items-center gap-2 text-body-sm font-medium text-content-secondary">
            <Globe2 :size="15" />
            Эрээнд байгаа
          </p>
          <p class="mt-1.5 text-body-sm text-content-secondary">
            Жин, үнэ, байршил ачаа Монголд ирээд "Ирц бүртгэх"-ээр тодорхойлогдоно.
          </p>
        </div>

        <div v-else class="rounded-card bg-surface-card p-3 shadow-card">
          <div class="flex items-baseline justify-between gap-2">
            <p class="text-body-sm font-medium text-content-secondary">
              {{ isMeasured ? 'Бодогдох үнэ' : 'Төлөх үнэ' }}
            </p>
            <p v-if="isMeasured && quote" class="text-body-sm text-content-secondary">
              {{
                quote.source === 'weight'
                  ? 'Жин'
                  : quote.source === 'volume'
                    ? 'Эзлэхүүн'
                    : 'Доод хэмжээ'
              }}<span v-if="quote.volumeM3"> · {{ quote.volumeM3 }} м³</span>
            </p>
          </div>

          <p v-if="displayPrice != null" class="tabular mt-0.5 text-h4 font-bold text-primary">
            {{ formatCurrency(displayPrice) }}
          </p>
          <p v-else-if="quoteError" class="mt-0.5 text-body-sm text-error">{{ quoteError }}</p>
          <p v-else class="mt-0.5 text-body text-content-disabled">—</p>

          <p v-if="isMeasured && !canQuote" class="mt-1.5 text-body-sm text-content-secondary">
            Ачааны төрөл ба жин/хэмжээс оруулахад үнэ харагдана.
          </p>
          <p v-else-if="!isMeasured" class="mt-1.5 text-body-sm text-content-secondary">
            Ажилтны заасан дүн — тариф хэрэглэгдэхгүй.
          </p>
        </div>

        <!-- Сүүлд бүртгэсэн — ажилтан эргэлзэж жагсаалт рүү орох шаардлагагүй.
             Жагсаалт өөрөө scroll хийгдэнэ, хуудсыг сунгахгүй. -->
        <div class="min-h-0 flex-1 rounded-card bg-surface-card p-3 shadow-card">
          <p class="mb-2 text-body-sm font-medium text-content">
            Энэ ээлжинд бүртгэсэн
            <span v-if="recent.length" class="tabular text-content-secondary">
              ({{ recent.length }})
            </span>
          </p>

          <p v-if="recent.length === 0" class="text-body-sm text-content-secondary">
            Бүртгэсэн ачаа энд харагдана.
          </p>

          <ul v-else v-auto-animate class="-mx-2 max-h-64 divide-y divide-surface-border overflow-y-auto">
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

    <!-- §1.3 — Давхардлын модал -->
    <UiModal
      :model-value="duplicate !== null"
      title="Дугаар аль хэдийн бүртгэгдсэн"
      persistent
      size="md"
      @update:model-value="duplicate = null"
    >
      <div v-if="duplicate" class="space-y-4">
        <div class="flex items-start gap-3 rounded-card bg-error/5 p-4">
          <AlertTriangle :size="20" class="mt-0.5 shrink-0 text-error" />
          <div class="min-w-0 text-body">
            <p class="tabular font-semibold text-content">{{ duplicate.trackingNumber }}</p>
            <p class="mt-1 text-content-secondary">
              {{ new Date(duplicate.registeredAt).toLocaleString('mn-MN') }}-нд
              <span class="font-medium text-content">
                {{ duplicate.registeredBy || 'тодорхойгүй ажилтан' }}
              </span>
              -аар бүртгэгдсэн
            </p>
            <p class="tabular mt-0.5 text-content-secondary">
              Харилцагч: {{ duplicate.customerPhone }}
            </p>
          </div>
        </div>

        <UiBtn
          variant="secondary"
          :icon-right="ExternalLink"
          :to="`/admin/packages/${duplicate.packageId}`"
          block
        >
          Оршин буй ачааг харах
        </UiBtn>

        <!-- BR-06 — зөвхөн Менежер/Админд харагдана. Жинхэнэ хамгаалалт нь backend. -->
        <div v-if="isManagement" class="border-t border-surface-border pt-4">
          <UiField
            label="Заавал давхар бүртгэх"
            required
            hint="Тээвэрлэгч дугаараа дахин ашигласан бодит тохиолдолд. Audit-д бүртгэгдэнэ."
          >
            <UiTextArea v-model="duplicateReason" :rows="2" placeholder="Давхар бүртгэх шалтгаан" />
          </UiField>
        </div>

        <p v-else class="text-body-sm text-content-secondary">
          Давхар бүртгэх шаардлагатай бол Менежерт хандана уу.
        </p>
      </div>

      <template #footer>
        <UiBtn variant="secondary" @click="duplicate = null">Болих</UiBtn>
        <UiBtn v-if="isManagement" variant="danger" :loading="saving" @click="confirmDuplicate">
          Заавал бүртгэх
        </UiBtn>
      </template>
    </UiModal>
  </div>
</template>
