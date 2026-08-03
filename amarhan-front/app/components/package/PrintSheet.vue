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
 * туслах мэдээлэл болгон үлдсэн. Бичиг том, тод — хуудсыг дүүргэнэ.
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
 * Саарал дэвсгэртэй нэрлэсэн талбар (`.print-force-bg`) хэвлэхэд арилахгүй
 * байхын тулд `main.css`-ийн `@media print` дүрмээр `print-color-adjust`-ыг
 * зорин заасан.
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
    <div class="print-area rounded-card border border-surface-border bg-white p-4">
      <div
        v-for="pkg in packages"
        :key="pkg.id"
        class="print-item mb-6 overflow-hidden rounded-card border-2 border-content last:mb-0"
      >
        <header class="border-b-4 border-content px-8 py-6 text-center">
          <p class="text-[44px] font-extrabold leading-none tracking-tight text-black">
            Ивээлт Карго
          </p>
          <p
            v-if="contactPhone"
            class="tabular mt-3 text-h3 font-bold tracking-widest text-content-secondary"
          >
            УТАС: {{ contactPhone }}
          </p>
        </header>

        <dl class="divide-y divide-surface-border">
          <div class="flex items-center justify-between gap-6 px-8 py-6">
            <dt
              class="print-force-bg rounded bg-surface-hover px-3 py-1.5 text-h4 font-semibold text-black"
            >
              Нэр:
            </dt>
            <dd class="tabular text-h1 font-bold text-black">{{ customerName(pkg) || '—' }}</dd>
          </div>
          <div class="flex items-center justify-between gap-6 px-8 py-6">
            <dt
              class="print-force-bg rounded bg-surface-hover px-3 py-1.5 text-h4 font-semibold text-black"
            >
              Утас:
            </dt>
            <dd class="tabular text-h1 font-bold text-black">{{ pkg.customerPhone || '—' }}</dd>
          </div>
          <div class="flex items-center justify-between gap-6 px-8 py-6">
            <dt
              class="print-force-bg rounded bg-surface-hover px-3 py-1.5 text-h4 font-semibold text-black"
            >
              Үнэ:
            </dt>
            <dd class="tabular text-[48px] font-bold leading-none text-black">
              {{ formatCurrency(pkg.finalPrice) }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-6 px-8 py-6">
            <dt
              class="print-force-bg rounded bg-surface-hover px-3 py-1.5 text-h4 font-semibold text-black"
            >
              Огноо:
            </dt>
            <dd class="tabular text-h1 font-bold text-black">
              {{ formatDate(pkg.arrivedAt || pkg.createdAt) }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-6 px-8 py-6">
            <dt
              class="print-force-bg rounded bg-surface-hover px-3 py-1.5 text-h4 font-semibold text-black"
            >
              Код:
            </dt>
            <dd class="tabular text-h1 font-bold text-black">{{ pkg.trackingNumber }}</dd>
          </div>
        </dl>

        <!-- Скайнерт уншигдах зураасан код — Код мөрийн доор -->
        <div class="flex justify-center border-t border-dashed border-surface-border py-8">
          <UiBarcode :value="pkg.trackingNumber" :height="100" :module-width="3" :show-text="false" />
        </div>

        <!-- Жин, төлөв — тусламж болгож жижгээр, шаардлагатай бол -->
        <footer class="flex flex-col gap-3 border-t border-surface-border px-8 py-6">
          <div class="flex items-center justify-between gap-6">
            <span class="text-h4 text-content-secondary">Жин:</span>
            <span class="tabular text-h3 font-semibold text-black">
              {{ pkg.weightKg ? `${pkg.weightKg} кг` : '—' }}
            </span>
          </div>
          <div class="flex items-center justify-between gap-6">
            <span class="text-h4 text-content-secondary">Төлөв:</span>
            <span
              class="text-h3 font-semibold"
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
