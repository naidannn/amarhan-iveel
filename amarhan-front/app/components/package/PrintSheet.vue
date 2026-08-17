<script setup lang="ts">
import { Printer } from 'lucide-vue-next'
import type { CargoPackage } from '~/composables/usePackages'

/**
 * Ачааны шошго хэвлэх — introduction.md §1.10
 *
 * Хайрцаг дээр шууд наадаг НЭГ ХЭЛБЭР л байна (өмнө нь "Тавиурын шошго",
 * "Мэдээллийн цаас" гэсэн нэмэлт хэлбэрүүд байсныг хэрэглээгүй тул хассан —
 * зөвхөн ачааны шошго л хэрэгтэй).
 *
 * ЗОРИУДААР ЦӨӨН ТАЛБАРТАЙ: наалтын (жижиг, ~58-80мм) принтер дээр их
 * мэдээлэл шахвал бичиг жижигрэх/тасрах, уншигдахгүй болох эрсдэлтэй.
 * Тиймээс хайрцгийг ХҮЛЭЭЛГЭН ӨГӨХ, ТАНИХАД шаардлагатай хамгийн цөөн
 * талбарыг (нэр, утас, үнэ, огноо, код) л мөр бүрээр, саарал дэвсгэртэй
 * нэрлэсэн key-value байдлаар хэвлэнэ. Жин, Төлөв нь доод жижиг мөрөнд
 * туслах мэдээлэл болгон үлдсэн. Дэлгэцэн дээрх урьдчилсан харагдац ТОМ,
 * ТОД хэвээр (уншихад тохиромжтой) — зөвхөн ХЭВЛЭХ үед л `print:`
 * классуудаар 58мм наалтын принтерийн өргөнд багтдаг жижиг хэмжээ рүү
 * шилждэг (доор `.print-area-thermal` — `main.css`-ийн `@page thermal`).
 *
 * ХЭВЛЭХ ТЕХНИК: `window.print()` дуудахад ЗӨВХӨН `.print-area` харагдана
 * (`@media print` дотор бусад бүхнийг `display: none`). Шинэ цонх/iframe
 * нээхгүй байгаа шалтгаан: popup blocker, дахин ачаалалт, фонт ачаалагдаагүй
 * байх зэрэг эмзэг байдал үүсдэг. Одоогийн DOM-ыг хэвлэх нь найдвартай.
 *
 * ГАРААР ДАРЖ ХЭВЛЭНЭ (автомат биш): модал нээгдмэгц шууд `window.print()`
 * дуудах хувилбарыг туршсан ч Vue-ийн Teleport/Transition-той зэрэгцэн
 * гарах race condition-оос болж заримдаа хоосон/буруу хуудас хэвлэгдэх
 * асуудал давтагдсан тул буцаагдсан. "Хэвлэх" товч модалын ГАРЧГИЙН МӨРӨНД
 * байрлана (доош гүйлгэх шаардлагагүй, шууд харагдана).
 *
 * Зураасан кодыг SVG-ээр зурна — ямар ч DPI-д хурц (`utils/barcode.ts`).
 * `height`/`module-width`-ыг 58мм өргөнд тааруулж багасгасан (100/3 →
 * 50/1.5) — SVG өөрөө `max-w-full`-ээр контейнерийн өргөнд шахагддаг тул
 * хэвлэх үед автоматаар 54мм дотор багтана (дэлгэцэн дээр модал өргөн тул
 * шахагдахгүй, ялгаа гарахгүй).
 */
const props = defineProps<{
  modelValue: boolean
  packages: CargoPackage[]
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const packageStatus = usePackageStatus()

/**
 * Компанийн утасны дугаар — `content.contact` тохиргооноос (Тохиргоо →
 * Агуулга, Админ засна). `useState`-ээр КЭШЛЭГДДЭГ шалтгаан: шошго дараалан
 * олон удаа нээгдэхэд (жишээ нь ачаа бүр тус бүрт "Хэвлэх" дарах) API-г
 * ДАХИН ДАХИН дуудахгүй байх. Ачаалагдаагүй/хоосон бол мөрийг зүгээр
 * үзүүлэхгүй — алдаа шидэхгүй.
 */
const contactPhone = useState<string>('print-sheet-contact-phone', () => '')
if (import.meta.client && !contactPhone.value) {
  useSettings()
    .list()
    .then(data => {
      contactPhone.value = data?.['content.contact']?.phone ?? ''
    })
    .catch(() => {})
}

/** Харилцагчийн нэр `customerId` populate хийгдсэн үед л ирнэ — үгүй бол хоосон */
function customerName(pkg: CargoPackage) {
  const c = pkg.customerId
  return typeof c === 'object' && c !== null ? (c.name ?? '') : ''
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function print() {
  if (!import.meta.client) return
  // Модал хаагдахаас ӨМНӨ хэвлэнэ — DOM-д байхгүй бол хоосон хуудас гарна
  window.print()
}
</script>

<template>
  <UiModal
    :model-value="modelValue"
    size="lg"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="flex w-full items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="text-h4 text-content">Ачааны шошго хэвлэх</h2>
          <p class="mt-0.5 text-body text-content-secondary">
            {{ packages.length }} ачаа сонгогдсон
          </p>
        </div>
        <UiBtn :icon="Printer" size="sm" @click="print">Хэвлэх</UiBtn>
      </div>
    </template>

    <!-- ── ХЭВЛЭГДЭХ ХЭСЭГ ──────────────────────────────────────────── -->
    <!-- `print-area-thermal` — 58мм наалтын принтерийн `@page thermal`-д
         холбогдоно (`main.css`). `print:` классууд ЗӨВХӨН хэвлэхэд идэвхжинэ. -->
    <div
      class="print-area print-area-thermal rounded-card border border-surface-border bg-white p-4 print:p-0"
    >
      <div
        v-for="pkg in packages"
        :key="pkg.id"
        class="print-item mb-6 overflow-hidden rounded-card border-2 border-content last:mb-0 print:mb-2 print:overflow-visible print:rounded-none print:border-0 print:border-b print:border-dashed print:border-black print:pb-2 print:last:border-b-0"
      >
        <header
          class="border-b-4 border-content px-8 py-6 text-center print:border-b print:border-black print:px-1 print:py-1.5"
        >
          <p
            class="text-[44px] font-extrabold leading-none tracking-tight text-black print:text-[15px] print:tracking-normal"
          >
            Ивээлт Карго
          </p>
          <p
            v-if="contactPhone"
            class="tabular mt-3 text-h3 font-bold tracking-widest text-content-secondary print:mt-0.5 print:text-[9px] print:tracking-normal print:text-black"
          >
            УТАС: {{ contactPhone }}
          </p>
        </header>

        <dl class="divide-y divide-surface-border print:divide-black">
          <div
            class="flex items-center justify-between gap-6 px-8 py-6 print:flex-col print:items-start print:gap-0 print:px-1 print:py-1"
          >
            <dt
              class="print-force-bg rounded bg-surface-hover px-3 py-1.5 text-h4 font-semibold text-black print:rounded-none print:bg-transparent print:px-0 print:py-0 print:text-[8px] print:font-normal print:uppercase print:tracking-wide print:text-content-secondary"
            >
              Нэр:
            </dt>
            <dd
              class="tabular text-h1 font-bold text-black print:text-[13px] print:leading-tight"
            >
              {{ customerName(pkg) || '—' }}
            </dd>
          </div>
          <div
            class="flex items-center justify-between gap-6 px-8 py-6 print:flex-col print:items-start print:gap-0 print:px-1 print:py-1"
          >
            <dt
              class="print-force-bg rounded bg-surface-hover px-3 py-1.5 text-h4 font-semibold text-black print:rounded-none print:bg-transparent print:px-0 print:py-0 print:text-[8px] print:font-normal print:uppercase print:tracking-wide print:text-content-secondary"
            >
              Утас:
            </dt>
            <dd
              class="tabular text-h1 font-bold text-black print:text-[13px] print:leading-tight"
            >
              {{ pkg.customerPhone || '—' }}
            </dd>
          </div>
          <div
            class="flex items-center justify-between gap-6 px-8 py-6 print:flex-col print:items-start print:gap-0 print:px-1 print:py-1"
          >
            <dt
              class="print-force-bg rounded bg-surface-hover px-3 py-1.5 text-h4 font-semibold text-black print:rounded-none print:bg-transparent print:px-0 print:py-0 print:text-[8px] print:font-normal print:uppercase print:tracking-wide print:text-content-secondary"
            >
              Үнэ:
            </dt>
            <dd
              class="tabular text-[48px] font-bold leading-none text-black print:text-[16px] print:leading-tight"
            >
              {{ formatCurrency(pkg.finalPrice) }}
            </dd>
          </div>
          <div
            class="flex items-center justify-between gap-6 px-8 py-6 print:flex-col print:items-start print:gap-0 print:px-1 print:py-1"
          >
            <dt
              class="print-force-bg rounded bg-surface-hover px-3 py-1.5 text-h4 font-semibold text-black print:rounded-none print:bg-transparent print:px-0 print:py-0 print:text-[8px] print:font-normal print:uppercase print:tracking-wide print:text-content-secondary"
            >
              Огноо:
            </dt>
            <dd
              class="tabular text-h1 font-bold text-black print:text-[13px] print:leading-tight"
            >
              {{ formatDate(pkg.arrivedAt || pkg.createdAt) }}
            </dd>
          </div>
          <div
            class="flex items-center justify-between gap-6 px-8 py-6 print:flex-col print:items-start print:gap-0 print:px-1 print:py-1"
          >
            <dt
              class="print-force-bg rounded bg-surface-hover px-3 py-1.5 text-h4 font-semibold text-black print:rounded-none print:bg-transparent print:px-0 print:py-0 print:text-[8px] print:font-normal print:uppercase print:tracking-wide print:text-content-secondary"
            >
              Код:
            </dt>
            <dd
              class="tabular text-h1 font-bold text-black print:text-[13px] print:leading-tight print:break-all"
            >
              {{ pkg.trackingNumber }}
            </dd>
          </div>
        </dl>

        <!-- Скайнерт уншигдах зураасан код — Код мөрийн доор -->
        <div
          class="flex justify-center border-t border-dashed border-surface-border py-8 print:border-t-0 print:py-1"
        >
          <UiBarcode :value="pkg.trackingNumber" :height="50" :module-width="1.5" :show-text="false" />
        </div>

        <!-- Жин, төлөв — тусламж болгож жижгээр, шаардлагатай бол -->
        <footer
          class="flex flex-col gap-3 border-t border-surface-border px-8 py-6 print:gap-0.5 print:border-t-0 print:px-1 print:py-0"
        >
          <div class="flex items-center justify-between gap-6 print:justify-start print:gap-2">
            <span class="text-h4 text-content-secondary print:text-[8px]">Жин:</span>
            <span class="tabular text-h3 font-semibold text-black print:text-[9px]">
              {{ pkg.weightKg ? `${pkg.weightKg} кг` : '—' }}
            </span>
          </div>
          <div class="flex items-center justify-between gap-6 print:justify-start print:gap-2">
            <span class="text-h4 text-content-secondary print:text-[8px]">Төлөв:</span>
            <span
              class="text-h3 font-semibold print:text-[9px]"
              :style="{ color: packageStatus.style(pkg.status).color }"
            >
              {{ packageStatus.label(pkg.status) }}
            </span>
          </div>
        </footer>
      </div>
    </div>

    <template #footer>
      <UiBtn variant="secondary" @click="emit('update:modelValue', false)">Хаах</UiBtn>
    </template>
  </UiModal>
</template>
