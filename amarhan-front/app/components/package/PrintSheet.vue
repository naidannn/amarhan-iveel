<script setup lang="ts">
import { Printer } from 'lucide-vue-next'
import type { CargoPackage } from '~/composables/usePackages'

/**
 * Ачааны баримт хэвлэх — introduction.md §1.10
 *
 * ГУРВАН ХЭЛБЭР:
 *   label — ачааны шошго (хайрцаг дээр наана): дугаар + зураасан код + байршил
 *   shelf — тавиурын шошго (тавиур дээр наана): томоор зөвхөн байршлын код
 *   info  — хэрэглэгчид наадаг мэдээллийн цаас: үнэ, төлбөр, төлөв
 *
 * ХЭВЛЭХ ТЕХНИК: `window.print()` дуудахад ЗӨВХӨН `.print-area` харагдана
 * (`@media print` дотор бусад бүхнийг `display: none`). Шинэ цонх/iframe
 * нээхгүй байгаа шалтгаан: popup blocker, дахин ачаалалт, фонт ачаалагдаагүй
 * байх зэрэг эмзэг байдал үүсдэг. Одоогийн DOM-ыг хэвлэх нь найдвартай.
 *
 * Зураасан кодыг SVG-ээр зурна — ямар ч DPI-д хурц (`utils/barcode.ts`).
 */
const props = defineProps<{
  modelValue: boolean
  packages: CargoPackage[]
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

type SheetKind = 'label' | 'shelf' | 'info'

const kind = ref<SheetKind>('label')

const KINDS: Array<{ value: SheetKind; label: string; hint: string }> = [
  { value: 'label', label: 'Ачааны шошго', hint: 'Хайрцаг дээр наана — зураасан кодтой' },
  { value: 'shelf', label: 'Тавиурын шошго', hint: 'Тавиур дээр наана — томоор байршил' },
  { value: 'info', label: 'Мэдээллийн цаас', hint: 'Хэрэглэгчид өгнө — үнэ, төлбөр' },
]

/** Тавиурын шошго нь ачаа тус бүрт биш, БАЙРШИЛ тус бүрт нэг байх ёстой */
const shelfCodes = computed(() => [
  ...new Set(props.packages.map(p => p.locationCode).filter((c): c is string => Boolean(c))),
])

const totals = computed(() =>
  props.packages.reduce(
    (acc, p) => {
      acc.finalPrice += p.finalPrice
      acc.balance += p.balance
      return acc
    },
    { finalPrice: 0, balance: 0 }
  )
)

// `typeof null === 'object'` тул `!== null` шалгалт ЗААВАЛ — тарифгүй ачаанд
// `cargoTypeId` нь `null` (BR-01a) бөгөөд `null.name` нь render-ыг унагана.
function typeName(pkg: CargoPackage) {
  const t = pkg.cargoTypeId
  return typeof t === 'object' && t !== null ? t.name : ''
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
    title="Баримт хэвлэх"
    :subtitle="`${packages.length} ачаа сонгогдсон`"
    size="lg"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="space-y-5">
      <!-- Хэлбэр сонгох — хэвлэхэд харагдахгүй -->
      <div class="no-print grid gap-2 sm:grid-cols-3">
        <button
          v-for="option in KINDS"
          :key="option.value"
          type="button"
          class="rounded-card border p-3 text-left transition-all duration-200"
          :class="
            kind === option.value
              ? 'border-primary bg-primary-50'
              : 'border-surface-border hover:border-primary-300'
          "
          @click="kind = option.value"
        >
          <p class="text-body font-semibold text-content">{{ option.label }}</p>
          <p class="mt-0.5 text-body-sm text-content-secondary">{{ option.hint }}</p>
        </button>
      </div>

      <!-- ── ХЭВЛЭГДЭХ ХЭСЭГ ──────────────────────────────────────────── -->
      <div class="print-area rounded-card border border-surface-border bg-white p-4">
        <!-- Ачааны шошго -->
        <template v-if="kind === 'label'">
          <div
            v-for="pkg in packages"
            :key="pkg.id"
            class="print-item flex items-center gap-4 border-b border-surface-border py-4 last:border-0"
          >
            <div class="min-w-0 flex-1">
              <p class="text-body-sm font-semibold uppercase tracking-wide text-content-secondary">
                Ивээл Карго
              </p>
              <p class="tabular mt-1 text-h3 font-bold leading-tight text-black">
                {{ pkg.locationCode || '—' }}
              </p>
              <p class="tabular mt-1 text-body text-content">
                {{ pkg.customerPhone }} · {{ pkg.quantity }} шир
              </p>
              <p v-if="typeName(pkg)" class="text-body-sm text-content-secondary">
                {{ typeName(pkg) }}
              </p>
            </div>

            <UiBarcode :value="pkg.trackingNumber" :height="44" :module-width="2" />
          </div>
        </template>

        <!-- Тавиурын шошго — томоор, зайнаас уншигдахуйц -->
        <template v-else-if="kind === 'shelf'">
          <div
            v-for="code in shelfCodes"
            :key="code"
            class="print-item flex flex-col items-center border-b border-surface-border py-8 last:border-0"
          >
            <p class="text-body font-semibold uppercase tracking-widest text-content-secondary">
              Ивээл Карго — Агуулах
            </p>
            <p class="tabular my-3 text-[56px] font-bold leading-none tracking-tight text-black">
              {{ code }}
            </p>
            <UiBarcode :value="code" :height="52" :module-width="2" :show-text="false" />
          </div>

          <p v-if="shelfCodes.length === 0" class="py-8 text-center text-body text-content-secondary">
            Сонгосон ачаанд байршил тэмдэглэгдээгүй байна.
          </p>
        </template>

        <!-- Мэдээллийн цаас — хэрэглэгчид өгнө -->
        <template v-else>
          <div class="print-item">
            <header class="flex items-baseline justify-between border-b-2 border-black pb-2">
              <p class="text-h4 font-bold text-black">Ивээл Карго</p>
              <p class="tabular text-body text-content-secondary">
                {{ new Date().toLocaleDateString('mn-MN') }}
              </p>
            </header>

            <p v-if="packages[0]" class="tabular mt-3 text-body text-content">
              Харилцагч: <span class="font-semibold">{{ packages[0].customerPhone }}</span>
            </p>

            <table class="mt-3 w-full border-collapse text-body">
              <thead>
                <tr class="border-b border-surface-border text-left">
                  <th class="py-2 font-medium text-content-secondary">Ачааны дугаар</th>
                  <th class="py-2 font-medium text-content-secondary">Байршил</th>
                  <th class="py-2 text-right font-medium text-content-secondary">Үнэ</th>
                  <th class="py-2 text-right font-medium text-content-secondary">Үлдэгдэл</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="pkg in packages" :key="pkg.id" class="border-b border-surface-border">
                  <td class="tabular py-2 text-black">{{ pkg.trackingNumber }}</td>
                  <td class="tabular py-2 text-content">{{ pkg.locationCode || '—' }}</td>
                  <td class="tabular py-2 text-right text-black">
                    {{ formatCurrency(pkg.finalPrice) }}
                  </td>
                  <td class="tabular py-2 text-right text-black">
                    {{ formatCurrency(pkg.balance) }}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="border-t-2 border-black font-bold">
                  <td class="py-2 text-black" colspan="2">Нийт</td>
                  <td class="tabular py-2 text-right text-black">
                    {{ formatCurrency(totals.finalPrice) }}
                  </td>
                  <td class="tabular py-2 text-right text-black">
                    {{ formatCurrency(totals.balance) }}
                  </td>
                </tr>
              </tfoot>
            </table>

            <p class="mt-4 text-body-sm text-content-secondary">
              Олон улсын карго тээврийг илүү хялбар, илүү ил тод.
            </p>
          </div>
        </template>
      </div>
    </div>

    <template #footer>
      <UiBtn variant="secondary" @click="emit('update:modelValue', false)">Хаах</UiBtn>
      <UiBtn :icon="Printer" @click="print">Хэвлэх</UiBtn>
    </template>
  </UiModal>
</template>
