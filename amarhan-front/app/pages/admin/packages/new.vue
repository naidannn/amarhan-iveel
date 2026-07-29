<script setup lang="ts">
import {
  Barcode as BarcodeIcon,
  Phone,
  Package as PackageIcon,
  MapPin,
  Weight,
  Ruler,
  Wand2,
  Check,
  AlertTriangle,
  ExternalLink,
  Keyboard,
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
 *   • Ачааны төрөл, байршил, ирсэн огноо ЗАЛГАМЖИЛНА (sticky) — дараалсан
 *     ачаа ихэвчлэн ижил тавиур, ижил төрөлтэй байдаг
 *   • Мэдэгдэл нь toast — `alert()` хуудсыг блоклож урсгалыг таслах болно
 *   • Үнэ бичих зуур урьдчилан харагдана (debounce 350мс)
 *
 * Хамгийн сүүлд бүртгэсэн ачаанууд баруун талд харагдана — ажилтан
 * "бүртгэгдсэн үү?" гэж эргэлзэж жагсаалт рүү орох шаардлагагүй.
 */
definePageMeta({ layout: 'admin', middleware: 'auth' })
useHead({ title: 'Ачаа бүртгэх — Ивээл Карго' })

const api = usePackages()
const toast = useToast()
const auth = useAuthStore()

const isManagement = computed(() => ['admin', 'manager'].includes(auth.user?.role ?? ''))

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
    finalPrice: null as number | null,
    priceOverrideReason: '',
  }
}

const form = reactive(blankForm())

/**
 * ЗАЛГАМЖЛАХ талбарууд — бүртгэлийн дараа цэвэрлэгдэхгүй.
 * Ажилтан нэг тавиур дээр 30 ачаа тавихдаа байршлыг 30 удаа бичих ёсгүй.
 */
const sticky = reactive({
  cargoTypeId: null as string | null,
  locationCode: '',
})

const cargoTypeOptions = ref<Array<{ value: string; label: string }>>([])
const saving = ref(false)
const recent = ref<CargoPackage[]>([])

const trackingInput = ref<{ focus: () => void; select: () => void } | null>(null)

// ── Үнийн урьдчилсан тооцоо (§1.2) ───────────────────────────────────────
const quote = ref<{ final: number; source: string; volumeM3: number | null } | null>(null)
const quoteError = ref<string | null>(null)

const hasDimensions = computed(
  () => form.lengthCm != null && form.widthCm != null && form.heightCm != null
)

const canQuote = computed(
  () => Boolean(sticky.cargoTypeId) && (form.weightKg != null || hasDimensions.value)
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
  () => [
    sticky.cargoTypeId,
    form.weightKg,
    form.lengthCm,
    form.widthCm,
    form.heightCm,
  ],
  () => refreshQuote()
)

/** Override нь бодогдсон үнээс хэр хазайсныг ажилтанд харуулна (BR-04) */
const overrideDelta = computed(() => {
  if (form.finalPrice == null || !quote.value) return null
  const diff = form.finalPrice - quote.value.final
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

// ── Ачаалах ──────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const types = await api.cargoTypes()
    cargoTypeOptions.value = types.data.map(t => ({ value: t.id, label: t.name }))
    // Ганц төрөлтэй бол сонгуулах нь илүүц алхам
    if (cargoTypeOptions.value.length === 1) {
      sticky.cargoTypeId = cargoTypeOptions.value[0]!.value
    }
  } catch (e: any) {
    toast.error('Ачааны төрөл ачаалагдсангүй', { description: e.message })
  }

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
    sticky.locationCode = suggestion.code
    toast.success(`Санал: ${suggestion.code}`)
  } catch (e: any) {
    toast.error('Хоосон нүд олдсонгүй', { description: e.message })
  }
}

// ── Бүртгэх ──────────────────────────────────────────────────────────────
function buildPayload(extra: Record<string, any> = {}) {
  return {
    trackingNumber: form.trackingNumber.trim(),
    phone: form.phone.trim(),
    ...(form.customerName.trim() ? { customerName: form.customerName.trim() } : {}),
    cargoTypeId: sticky.cargoTypeId,
    quantity: form.quantity,
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
    locationCode: sticky.locationCode.trim().toUpperCase(),
    ...(form.note.trim() ? { note: form.note.trim() } : {}),
    ...(form.finalPrice != null
      ? { finalPrice: form.finalPrice, priceOverrideReason: form.priceOverrideReason.trim() }
      : {}),
    ...extra,
  }
}

async function submit(extra: Record<string, any> = {}) {
  if (saving.value) return

  // Хамгийн түгээмэл гурван алдааг backend хүртэл явахгүйгээр барина —
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
  if (!sticky.locationCode.trim()) {
    toast.error('Байршлын кодыг оруулна уу')
    return
  }

  saving.value = true
  try {
    const result = await api.create(buildPayload(extra))

    // §1.4 — БҮРТГЭГДСЭНИЙ ДАРАА: хуудас дахин ачаалагдахгүй, форм цэвэрлэгдэж
    // фокус эргэнэ. Ажилтан дараагийн ачааг ШУУД бүртгэж чадна.
    resetForNext()

    recent.value.unshift(result.package)
    if (recent.value.length > 12) recent.value.pop()

    toast.success(`${result.package.trackingNumber} бүртгэгдлээ`, {
      description: `${formatCurrency(result.package.finalPrice)} · ${result.package.locationCode}`,
    })

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
    toast.error('Үнийн хязгаар хэтэрсэн', { description: e.message })
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

function clearSticky() {
  sticky.locationCode = ''
  toast.info('Байршил цэвэрлэгдлээ')
}

// Гарын хурдан товчлол — хулганаас бүрэн хамааралгүй ажиллана
onKeyStroke('Escape', () => {
  if (duplicate.value) duplicate.value = null
})
</script>

<template>
  <div>
    <UiPageHeader title="Ачаа бүртгэх" subtitle="Enter дарж бүртгэнэ — хуудас дахин ачаалагдахгүй">
      <template #actions>
        <UiBtn variant="secondary" to="/admin/packages">Жагсаалт</UiBtn>
      </template>
    </UiPageHeader>

    <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <!-- ── Форм ─────────────────────────────────────────────────────── -->
      <form class="card space-y-5" @submit.prevent="submit()">
        <!-- Ачааны дугаар — фокус үргэлж энд эргэнэ -->
        <UiField label="Ачааны дугаар" required for="tracking">
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

        <div class="grid gap-5 sm:grid-cols-2">
          <UiField label="Харилцагчийн утас" required for="phone" hint="Бүртгэлтэй бол автоматаар холбогдоно">
            <UiTextInput
              id="phone"
              v-model="form.phone"
              type="tel"
              :icon="Phone"
              placeholder="99112233"
              tabular
            />
          </UiField>

          <UiField label="Харилцагчийн нэр" for="customer-name" hint="Шинэ харилцагч бол">
            <UiTextInput id="customer-name" v-model="form.customerName" placeholder="Сонголтоор" />
          </UiField>
        </div>

        <div class="grid gap-5 sm:grid-cols-2">
          <UiField label="Ачааны төрөл" required for="cargo-type" hint="Дараагийн ачаанд хадгалагдана">
            <UiSelectInput
              id="cargo-type"
              v-model="sticky.cargoTypeId"
              :options="cargoTypeOptions"
              placeholder="Төрөл сонгоно уу"
            />
          </UiField>

          <UiField label="Тоо хэмжээ" required for="quantity">
            <UiTextInput
              id="quantity"
              v-model="form.quantity"
              type="number"
              :icon="PackageIcon"
              tabular
            />
          </UiField>
        </div>

        <!-- Жин ба эзлэхүүн — BR-01: ядаж нэг нь заавал -->
        <div class="rounded-card border border-surface-border p-4">
          <p class="mb-3 text-body font-medium text-content">
            Жин эсвэл хэмжээс
            <span class="text-error">*</span>
          </p>

          <div class="grid gap-4 sm:grid-cols-4">
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

          <p class="mt-3 flex items-center gap-1.5 text-body-sm text-content-secondary">
            <Ruler :size="14" />
            Хэмжээс оруулбал эзлэхүүн автоматаар бодогдоно. Жин ба эзлэхүүний
            <span class="font-medium text-content">өндөр дүнгээр</span> тооцогдоно.
          </p>
        </div>

        <!-- Байршил -->
        <UiField label="Байршлын код" required for="location" hint="Дараагийн ачаанд хадгалагдана">
          <div class="flex gap-2">
            <UiTextInput
              id="location"
              v-model="sticky.locationCode"
              :icon="MapPin"
              placeholder="ER-02-B-15"
              tabular
              class="flex-1"
            />
            <UiBtn variant="secondary" :icon="Wand2" @click="suggestLocation">Санал</UiBtn>
            <UiBtn v-if="sticky.locationCode" variant="ghost" @click="clearSticky">Цэвэрлэх</UiBtn>
          </div>
        </UiField>

        <UiField label="Тайлбар" for="note">
          <UiTextArea id="note" v-model="form.note" :rows="2" placeholder="Сонголтоор" />
        </UiField>

        <!-- Үнэ override — BR-04 -->
        <details class="rounded-card border border-surface-border p-4">
          <summary class="cursor-pointer text-body font-medium text-content">
            Үнэ гараар өөрчлөх
            <span class="font-normal text-content-secondary">(шалтгаан заавал)</span>
          </summary>

          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <UiField label="Эцсийн үнэ" for="override-price">
              <UiTextInput
                id="override-price"
                v-model="form.finalPrice"
                type="number"
                suffix="₮"
                :placeholder="quote ? String(quote.final) : '0'"
                tabular
              />
            </UiField>

            <UiField label="Шалтгаан" for="override-reason" :required="form.finalPrice != null">
              <UiTextInput
                id="override-reason"
                v-model="form.priceOverrideReason"
                placeholder="Жишээ: жинлүүрийн зөрүү"
              />
            </UiField>
          </div>

          <p
            v-if="overrideDelta"
            class="mt-3 text-body-sm"
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

        <div class="flex flex-wrap items-center gap-3 border-t border-surface-border pt-5">
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
      <div class="space-y-6">
        <!-- Үнийн урьдчилсан тооцоо -->
        <div class="card">
          <p class="text-body font-medium text-content-secondary">Бодогдох үнэ</p>

          <p v-if="quote" class="tabular mt-1 text-h2 font-bold text-primary">
            {{ formatCurrency(quote.final) }}
          </p>
          <p v-else-if="quoteError" class="mt-1 text-body text-error">{{ quoteError }}</p>
          <p v-else class="mt-1 text-h3 text-content-disabled">—</p>

          <dl v-if="quote" class="mt-4 space-y-2 border-t border-surface-border pt-4 text-body">
            <div class="flex justify-between">
              <dt class="text-content-secondary">Тооцооллын үндэс</dt>
              <dd class="font-medium text-content">
                {{
                  quote.source === 'weight'
                    ? 'Жин'
                    : quote.source === 'volume'
                      ? 'Эзлэхүүн'
                      : 'Доод хэмжээ'
                }}
              </dd>
            </div>
            <div v-if="quote.volumeM3" class="flex justify-between">
              <dt class="text-content-secondary">Эзлэхүүн</dt>
              <dd class="tabular font-medium text-content">{{ quote.volumeM3 }} м³</dd>
            </div>
          </dl>

          <p v-else-if="!canQuote" class="mt-3 text-body-sm text-content-secondary">
            Ачааны төрөл ба жин/хэмжээс оруулахад үнэ харагдана.
          </p>
        </div>

        <!-- Сүүлд бүртгэсэн — ажилтан эргэлзэж жагсаалт рүү орох шаардлагагүй -->
        <div class="card">
          <p class="mb-3 text-body font-medium text-content">
            Энэ ээлжинд бүртгэсэн
            <span v-if="recent.length" class="tabular text-content-secondary">
              ({{ recent.length }})
            </span>
          </p>

          <p v-if="recent.length === 0" class="text-body-sm text-content-secondary">
            Бүртгэсэн ачаа энд харагдана.
          </p>

          <ul v-else v-auto-animate class="-mx-2 divide-y divide-surface-border">
            <li v-for="pkg in recent" :key="pkg.id">
              <NuxtLink
                :to="`/admin/packages/${pkg.id}`"
                class="flex items-center gap-2 rounded-btn px-2 py-2.5 transition-colors duration-200 hover:bg-surface-hover"
              >
                <div class="min-w-0 flex-1">
                  <p class="tabular truncate text-body font-semibold text-content">
                    {{ pkg.trackingNumber }}
                  </p>
                  <p class="tabular truncate text-body-sm text-content-secondary">
                    {{ pkg.customerPhone }} · {{ pkg.locationCode }}
                  </p>
                </div>
                <p class="tabular shrink-0 text-body font-semibold text-content">
                  {{ formatCurrency(pkg.finalPrice) }}
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

        <UiBtn variant="secondary" :icon-right="ExternalLink" :to="`/admin/packages/${duplicate.packageId}`" block>
          Оршин буй ачааг харах
        </UiBtn>

        <!-- BR-06 — зөвхөн Менежер/Админд харагдана. Жинхэнэ хамгаалалт нь backend. -->
        <div v-if="isManagement" class="border-t border-surface-border pt-4">
          <UiField
            label="Заавал давхар бүртгэх"
            required
            hint="Тээвэрлэгч дугаараа дахин ашигласан бодит тохиолдолд. Audit-д бүртгэгдэнэ."
          >
            <UiTextArea
              v-model="duplicateReason"
              :rows="2"
              placeholder="Давхар бүртгэх шалтгаан"
            />
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
