<script setup lang="ts">
import { Printer } from 'lucide-vue-next'
import type { Delivery } from '~/composables/useDeliveries'

/**
 * Хүргэлтийн баримт хэвлэх — introduction.md §5 (roadmap 4.5)
 *
 * ЗОРИЛГО: хүргэлтийн БАРААН дээр шууд наадаг баримт (гарын үсгийн мөр
 * ХЭРЭГГҮЙ болсон тул хассан — зөвхөн бараа таних, хүлээлгэн өгөхөд
 * хэрэгтэй мэдээлэл). Жолооч БОЛОН харилцагч хоёуланд нь хэрэгтэй бүх
 * мэдээлэл (хугацаа, хаяг, холбогдох дугаар, ачааны төлөв, авах дүн) нэг
 * хуудсанд, ТОМООР бичигдэнэ — бараан дээр наахад холоос ч уншигдахуйц
 * (дэлгэцэн дээрх урьдчилсан харагдац). ХЭВЛЭХ үед л `print:` классуудаар
 * 58мм наалтын принтерийн өргөнд багтдаг хэмжээ рүү шилждэг — доор
 * `.print-area-thermal` (`main.css`-ийн `@page thermal`). Хүснэгт (4
 * баганатай) 58мм-т багтахгүй тул хэвлэхэд ачаа тус бүрийг ЖАГСААЛТ
 * (мөр бүр өөрийн мөрөнд) болгож эвхдэг.
 *
 * ХЭВЛЭХ ТЕХНИК: `PrintSheet.vue`-ийн ижил — `window.print()` дуудахад
 * зөвхөн `.print-area` харагдана (`@media print`). ГАРААР ДАРЖ ХЭВЛЭНЭ:
 * модал нээгдмэгц автоматаар хэвлэх хувилбарыг туршсан ч Vue-ийн
 * Teleport/Transition-той зэрэгцэн гарах race condition-оос болж заримдаа
 * хоосон хуудас хэвлэгдэх асуудал давтагдсан тул буцаагдсан. "Хэвлэх" товч
 * модалын ГАРЧГИЙН МӨРӨНД байрлана (доош гүйлгэх шаардлагагүй, шууд харагдана).
 *
 * ТӨЛБӨР ДУТУУ бол хуудсан дээр ТОДООР бичигдэнэ: жолооч ачааг хүлээлгэж
 * өгөхөөсөө өмнө хэдэн төгрөг авахаа мэдэх ёстой. Гэхдээ энэ нь §5.2-ыг
 * сулруулахгүй — дутуу төлбөртэй хүргэлт хэвлэгдэх боловч ГАРЧ ЧАДАХГҮЙ.
 *
 * ХЭВЛЭГЧИЙН ЯНЗ БҮРИЙН ХЭМЖЭЭ: бүх хэсэг босоо (`flex-col`/тайлбар мөр)
 * эвхэгддэг тул наалтын жижиг принтер, А4 хоёуланд аль алинд тохирдог.
 * Чухал мэдээлэл (дугаар, хаяг, авах дүн) ТОМООР/ТОДООР, туслах мэдээлэл
 * (огноо, тэмдэглэл) ЖИЖГЭЭР ялгагдана.
 */
const props = defineProps<{
  modelValue: boolean
  delivery: Delivery
  unpaidTotal: number
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const deliveryStatus = useDeliveryStatus()
const packageStatus = usePackageStatus()

const customer = computed(() => {
  const c = props.delivery.customerId
  return typeof c === 'object' && c !== null ? c : null
})

const packages = computed(() =>
  (props.delivery.packageIds ?? []).filter(
    (p): p is { id: string; trackingNumber: string; balance: number; status: string } =>
      typeof p === 'object' && p !== null
  )
)

function formatDate(value: string | Date | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function print() {
  if (!import.meta.client) return
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
          <h2 class="text-h4 text-content">Хүргэлтийн баримт хэвлэх</h2>
          <p class="mt-0.5 text-body text-content-secondary">{{ delivery.deliveryNumber }}</p>
        </div>
        <UiBtn :icon="Printer" size="sm" @click="print">Хэвлэх</UiBtn>
      </div>
    </template>

    <!-- `print-area-thermal` — 58мм наалтын принтерийн `@page thermal`-д
         холбогдоно (`main.css`). `print:` классууд ЗӨВХӨН хэвлэхэд идэвхжинэ. -->
    <div
      class="print-area print-area-thermal overflow-hidden rounded-card border-2 border-content bg-white text-content print:rounded-none print:border-0"
    >
      <header
        class="flex items-start justify-between gap-6 border-b-4 border-content px-8 py-6 print:flex-col print:gap-1 print:border-b print:border-black print:px-1 print:py-1.5"
      >
        <div>
          <p
            class="text-[40px] font-extrabold leading-none tracking-tight text-black print:text-[15px]"
          >
            Ивээлт Карго
          </p>
          <p class="mt-2 text-h4 text-content-secondary print:mt-0.5 print:text-[9px]">
            Хүргэлтийн баримт
          </p>
        </div>
        <div class="text-right print:w-full print:text-left">
          <p class="text-body text-content-secondary print:text-[8px]">Хүргэлтийн дугаар</p>
          <p class="tabular text-h1 font-bold text-black print:text-[13px]">
            {{ delivery.deliveryNumber }}
          </p>
          <p class="tabular mt-1 text-h4 text-content-secondary print:mt-0 print:text-[8px]">
            {{ formatDate(delivery.scheduledDate ?? delivery.createdAt) }}
          </p>
          <p
            class="print-force-bg mt-2 inline-block rounded-full px-3 py-1 text-h4 font-bold print:mt-0.5 print:rounded-none print:bg-transparent print:px-0 print:py-0 print:text-[9px]"
            :style="{
              color: deliveryStatus.style(delivery.status).color,
              backgroundColor: deliveryStatus.style(delivery.status).bg,
            }"
          >
            {{ deliveryStatus.label(delivery.status) }}
          </p>
        </div>
      </header>

      <section
        class="grid gap-6 border-b border-surface-border px-8 py-6 sm:grid-cols-2 print:grid-cols-1 print:gap-1 print:border-black print:px-1 print:py-1.5"
      >
        <div>
          <p class="text-h4 text-content-secondary print:text-[8px]">Хүлээн авагч</p>
          <p class="tabular text-h1 font-bold text-black print:text-[13px]">{{ delivery.phone }}</p>
          <p v-if="customer?.name" class="text-h4 text-content print:text-[9px]">
            {{ customer.name }}
          </p>
        </div>
        <div class="sm:text-right print:text-left">
          <p class="text-h4 text-content-secondary print:text-[8px]">Жолооч</p>
          <p class="text-h3 font-semibold text-black print:text-[9px]">
            {{ delivery.driverName ?? '—' }}
          </p>
          <p v-if="delivery.driverPhone" class="tabular text-h4 text-content-secondary print:text-[8px]">
            {{ delivery.driverPhone }}
          </p>
        </div>
      </section>

      <section
        class="border-b border-surface-border px-8 py-6 print:border-black print:px-1 print:py-1.5"
      >
        <p class="text-h4 text-content-secondary print:text-[8px]">Хүргэх хаяг</p>
        <p class="text-h1 font-bold text-black print:text-[13px] print:leading-tight">
          {{ delivery.address }}
        </p>
        <p v-if="delivery.note" class="mt-1 text-h4 text-content-secondary print:mt-0.5 print:text-[8px]">
          Тэмдэглэл: {{ delivery.note }}
        </p>
      </section>

      <!-- Ачааны жагсаалт — жолооч тоолж авах. 58мм-д хүснэгт багтахгүй тул
           хэвлэхэд мөр бүрийг өөрийн блок болгож эвхнэ. -->
      <section class="px-8 py-6 print:px-1 print:py-1.5">
        <p class="mb-3 text-h3 font-semibold text-black print:mb-1 print:text-[10px]">
          Ачаа ({{ packages.length }})
        </p>

        <table class="w-full border-collapse text-left print:hidden">
          <thead>
            <tr class="border-b border-surface-border">
              <th class="py-2 pr-3 text-h4 font-medium text-content-secondary">№</th>
              <th class="py-2 pr-3 text-h4 font-medium text-content-secondary">Ачааны дугаар</th>
              <th class="py-2 pr-3 text-h4 font-medium text-content-secondary">Төлөв</th>
              <th class="py-2 text-right text-h4 font-medium text-content-secondary">Үлдэгдэл</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(p, index) in packages" :key="p.id" class="border-b border-surface-border">
              <td class="tabular py-3 pr-3 text-h4 text-content-secondary">{{ index + 1 }}</td>
              <td class="tabular py-3 pr-3 text-h3 font-bold text-black">{{ p.trackingNumber }}</td>
              <td
                class="py-3 pr-3 text-h4 font-semibold"
                :style="{ color: packageStatus.style(p.status).color }"
              >
                {{ packageStatus.label(p.status) }}
              </td>
              <td class="tabular py-3 text-right text-h3 font-bold text-black">
                {{ p.balance > 0 ? formatCurrency(p.balance) : '—' }}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Зөвхөн хэвлэхэд харагдах, наалтын өргөнд эвхэгддэг жагсаалт -->
        <ul class="hidden print:block">
          <li
            v-for="(p, index) in packages"
            :key="p.id"
            class="border-b border-dashed border-black py-1 last:border-b-0"
          >
            <div class="flex items-baseline justify-between gap-2">
              <span class="tabular text-[12px] font-bold text-black print:break-all">
                {{ index + 1 }}. {{ p.trackingNumber }}
              </span>
              <span v-if="p.balance > 0" class="tabular text-[11px] font-bold text-black">
                {{ formatCurrency(p.balance) }}
              </span>
            </div>
            <span
              class="text-[9px] font-semibold"
              :style="{ color: packageStatus.style(p.status).color }"
            >
              {{ packageStatus.label(p.status) }}
            </span>
          </li>
        </ul>
      </section>

      <!-- §5.2 — жолооч хэдэн төгрөг авахаа мэдэх ёстой -->
      <section
        v-if="unpaidTotal > 0"
        class="mx-8 mb-6 border-2 border-content px-6 py-4 print:mx-1 print:mb-2 print:border print:border-black print:px-2 print:py-1.5"
      >
        <div class="flex items-center justify-between gap-4 print:flex-col print:items-start print:gap-0.5">
          <span class="text-h3 font-extrabold text-black print:text-[10px]">ТӨЛБӨР ДУТУУ — авах дүн</span>
          <span class="tabular text-[40px] font-extrabold leading-none text-black print:text-[16px]">
            {{ formatCurrency(unpaidTotal) }}
          </span>
        </div>
      </section>

      <section
        v-if="delivery.fee > 0"
        class="mx-8 mb-6 flex items-center justify-between print:mx-1 print:mb-2"
      >
        <span class="text-h4 text-content-secondary print:text-[8px]">Хүргэлтийн төлбөр</span>
        <span class="tabular text-h3 font-semibold text-black print:text-[9px]">{{ formatCurrency(delivery.fee) }}</span>
      </section>
    </div>

    <template #footer>
      <UiBtn variant="secondary" @click="emit('update:modelValue', false)">Хаах</UiBtn>
    </template>
  </UiModal>
</template>
