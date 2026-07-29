<script setup lang="ts">
import { Package, Truck, Wallet, Users, Search, Plus, Trash2 } from 'lucide-vue-next'
import tokens from '~/assets/design-tokens'
import type { Column } from '~/components/ui/DataTable.vue'

/**
 * Design System-ийн амьд лавлагаа.
 *
 * Зорилго: шинэ дэлгэц зохиохын өмнө ямар токен, компонент байгааг ЭНД харна.
 * Ингэснээр хөгжүүлэгч бүр өөрийн өнгө, хэмжээ зохиохоос сэргийлнэ.
 *
 * Нэвтрэлт шаардахгүй — дизайн хянахад хялбар байх зорилготой.
 */
definePageMeta({ layout: false })
useHead({ title: 'Design System · Ивээл Карго' })

const { all: packageStatuses } = usePackageStatus()
const { all: deliveryStatuses } = useDeliveryStatus()
const toast = useToast()

const colorGroups = [
  { name: 'Primary — цэнхэр', desc: 'Үндсэн үйлдэл, идэвхтэй төлөв', scale: tokens.primary },
  { name: 'Secondary — улаан', desc: 'ЗӨВХӨН CTA ба чухал төлөв', scale: tokens.secondary },
]

const semanticColors = [
  { name: 'Success', value: tokens.semantic.success },
  { name: 'Warning', value: tokens.semantic.warning },
  { name: 'Error', value: tokens.semantic.error },
  { name: 'Info', value: tokens.semantic.info },
]

const typeScale = [
  { cls: 'text-h1', label: 'Heading 1 — 32px', sample: 'Ивээл Карго' },
  { cls: 'text-h2', label: 'Heading 2 — 28px', sample: 'Ачааны бүртгэл' },
  { cls: 'text-h3', label: 'Heading 3 — 24px', sample: 'Хяналтын самбар' },
  { cls: 'text-h4', label: 'Heading 4 — 20px', sample: 'Сүүлийн ачаанууд' },
  { cls: 'text-body-lg', label: 'Body Large — 16px', sample: 'Олон улсын карго тээвэр' },
  { cls: 'text-body', label: 'Body — 14px', sample: 'Таны ачаа Монголд ирлээ' },
  { cls: 'text-body-sm', label: 'Body Small — 13px', sample: 'Бүртгэсэн: 2026-07-30' },
]

// ── Формын жишээ ──
const form = reactive({
  tracking: '',
  phone: '',
  weight: null as number | null,
  cargoType: null as string | null,
})

const cargoTypes = [
  { value: 'standard', label: 'Энгийн ачаа' },
  { value: 'bulky', label: 'Гутал / нугалахгүй ачаа' },
]

// ── Хүснэгтийн жишээ ──
interface Row {
  id: string
  tracking: string
  customer: string
  status: string
  weight: string
  price: number
}

const columns: Column<Row>[] = [
  { key: 'tracking', label: 'Дугаар', sortable: true },
  { key: 'customer', label: 'Харилцагч', tabular: true },
  { key: 'status', label: 'Төлөв' },
  { key: 'weight', label: 'Жин', align: 'right', tabular: true },
  { key: 'price', label: 'Үнэ', align: 'right', tabular: true, sortable: true },
]

const rows: Row[] = [
  { id: '1', tracking: 'TRK-88213', customer: '9911-2233', status: 'in_transit', weight: '0.85', price: 2000 },
  { id: '2', tracking: 'TRK-88214', customer: '9955-4433', status: 'awaiting_payment', weight: '3.20', price: 8000 },
  { id: '3', tracking: 'TRK-88215', customer: '8811-9900', status: 'delivered', weight: '0.09', price: 800 },
]

const sort = ref<string | null>('-price')
const selected = ref<string[]>([])
const page = ref(1)
const modalOpen = ref(false)

function money(value: number) {
  return `${value.toLocaleString('mn-MN')}₮`
}
</script>

<template>
  <div class="min-h-screen bg-surface-bg px-4 py-10 sm:px-8">
    <div class="mx-auto max-w-5xl space-y-10">
      <header>
        <p class="text-body font-semibold text-primary">Design System v1</p>
        <h1 class="mt-1 text-h1">Ивээл Карго</h1>
        <p class="mt-2 text-body-lg text-content-secondary">
          Олон улсын карго тээврийг илүү хялбар, илүү ил тод.
        </p>
        <p class="mt-4 text-body text-content-secondary">
          Найдвартай • Хурдан • Энгийн • Орчин үеийн
        </p>
        <p class="mt-3 text-body-sm text-content-secondary">
          Гуравдагч UI сангүй — Tailwind + токен + Lucide icon дээр өөрсдөө бүтээсэн.
        </p>
      </header>

      <!-- Өнгө -->
      <section class="card">
        <h2 class="text-h3">Өнгө</h2>

        <div v-for="group in colorGroups" :key="group.name" class="mt-6">
          <p class="text-body font-semibold text-content">{{ group.name }}</p>
          <p class="text-body-sm text-content-secondary">{{ group.desc }}</p>
          <div class="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-11">
            <div v-for="(hex, key) in group.scale" :key="key">
              <div
                class="h-12 rounded-lg border border-surface-border"
                :style="{ background: hex }"
              />
              <p class="mt-1 text-center text-[11px] text-content-secondary">{{ key }}</p>
            </div>
          </div>
        </div>

        <div class="mt-6">
          <p class="text-body font-semibold text-content">Төлөвийн өнгө</p>
          <div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div v-for="c in semanticColors" :key="c.name" class="flex items-center gap-2.5">
              <span class="h-9 w-9 rounded-btn" :style="{ background: c.value }" />
              <div>
                <p class="text-body font-medium">{{ c.name }}</p>
                <p class="text-body-sm text-content-secondary">{{ c.value }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Typography -->
      <section class="card">
        <h2 class="text-h3">Үсгийн хэмжээ</h2>
        <p class="mt-1 text-body text-content-secondary">Inter — монгол кирилл дээр уншигдахуйц</p>

        <div class="mt-5 divide-y divide-surface-border">
          <div v-for="t in typeScale" :key="t.cls" class="flex flex-wrap items-baseline gap-3 py-3">
            <span :class="t.cls" class="min-w-0 flex-1">{{ t.sample }}</span>
            <span class="text-body-sm text-content-secondary">{{ t.label }}</span>
          </div>
        </div>
      </section>

      <!-- Товч -->
      <section class="card">
        <h2 class="text-h3">Товч</h2>
        <p class="mt-1 text-body text-content-secondary">Өндөр 40px · radius 12px</p>

        <div class="mt-5 flex flex-wrap gap-3">
          <UiBtn>Ачаа бүртгэх</UiBtn>
          <UiBtn variant="secondary">Хадгалах</UiBtn>
          <UiBtn variant="danger" :icon="Trash2">Устгах</UiBtn>
          <UiBtn variant="success">Баталгаажуулах</UiBtn>
          <UiBtn variant="ghost">Болих</UiBtn>
          <UiBtn disabled>Идэвхгүй</UiBtn>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-3">
          <UiBtn :icon="Plus">Шинэ ачаа</UiBtn>
          <UiBtn variant="secondary" :icon="Search">Хайх</UiBtn>
          <UiBtn loading>Хадгалж байна</UiBtn>
          <UiBtn size="sm">Жижиг</UiBtn>
          <UiBtn size="sm" variant="secondary">Жижиг secondary</UiBtn>
        </div>
      </section>

      <!-- Оролт -->
      <section class="card">
        <h2 class="text-h3">Оролтын талбар</h2>
        <p class="mt-1 text-body text-content-secondary">Өндөр 40px · radius 10px</p>

        <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UiField label="Ачааны дугаар" required for="ds-tracking">
            <UiTextInput id="ds-tracking" v-model="form.tracking" placeholder="TRK-88213" />
          </UiField>

          <UiField label="Утасны дугаар" required for="ds-phone" hint="8 оронтой">
            <UiTextInput id="ds-phone" v-model="form.phone" type="tel" placeholder="9911-2233" tabular />
          </UiField>

          <UiField label="Жин" for="ds-weight">
            <UiTextInput id="ds-weight" v-model="form.weight" type="number" placeholder="0.85" suffix="кг" tabular />
          </UiField>

          <UiField label="Ачааны төрөл" required for="ds-type">
            <UiSelectInput id="ds-type" v-model="form.cargoType" :options="cargoTypes" />
          </UiField>

          <UiField label="Хайх">
            <UiTextInput placeholder="Дугаар, утсаар хайх" :icon="Search" />
          </UiField>

          <UiField label="Алдаатай талбар" error="Энэ дугаар аль хэдийн бүртгэгдсэн">
            <UiTextInput model-value="TRK-88213" invalid />
          </UiField>

          <UiField label="Идэвхгүй">
            <UiTextInput placeholder="Засах боломжгүй" disabled />
          </UiField>
        </div>
      </section>

      <!-- Карт -->
      <section>
        <h2 class="mb-4 text-h3">Тоон үзүүлэлтийн карт</h2>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <UiStatCard label="Өнөөдөр бүртгэсэн" :value="125" :icon="Package" accent="#355DFF" />
          <UiStatCard label="Замд явж буй" :value="48" :icon="Truck" accent="#EA580C" />
          <UiStatCard label="Төлбөр хүлээгдэж буй" :value="12" :icon="Wallet" accent="#B45309" hint="1,240,000₮" />
          <UiStatCard label="Идэвхтэй харилцагч" :value="2140" :icon="Users" accent="#16A34A" />
        </div>
      </section>

      <!-- Төлөв -->
      <section class="card">
        <h2 class="text-h3">Ачааны төлөв</h2>
        <p class="mt-1 text-body text-content-secondary">
          Саарал (шинэ) → улбар шар (замд) → ягаан (ирсэн) → ногоон (дууссан)
        </p>
        <div class="mt-5 flex flex-wrap gap-2">
          <UiStatusBadge v-for="(_, key) in packageStatuses" :key="key" :status="String(key)" />
        </div>

        <h3 class="mt-8 text-h4">Хүргэлтийн төлөв</h3>
        <div class="mt-4 flex flex-wrap gap-2">
          <UiStatusBadge
            v-for="(_, key) in deliveryStatuses"
            :key="key"
            :status="String(key)"
            kind="delivery"
          />
        </div>
      </section>

      <!-- Хүснэгт -->
      <section>
        <h2 class="mb-1 text-h3">Хүснэгт</h2>
        <p class="mb-4 text-body text-content-secondary">
          Өндөр мөр · zebra байхгүй · hover өнгөтэй · эрэмбэлэлт server талд
        </p>

        <UiDataTable
          :columns="columns"
          :rows="rows"
          v-model:sort="sort"
          v-model:selected="selected"
          selectable
        >
          <template #toolbar>
            <div class="flex flex-wrap items-center gap-3">
              <div class="min-w-0 flex-1">
                <UiTextInput placeholder="Дугаар, утсаар хайх" :icon="Search" />
              </div>
              <UiBtn variant="secondary" size="sm">Шүүлт</UiBtn>
              <UiBtn size="sm" :icon="Plus">Шинэ ачаа</UiBtn>
            </div>
          </template>

          <template #cell-status="{ value }">
            <UiStatusBadge :status="value" size="sm" />
          </template>

          <template #cell-weight="{ value }">{{ value }} кг</template>

          <template #cell-price="{ value }">
            <span class="font-semibold">{{ money(value) }}</span>
          </template>

          <template #footer>
            <UiPagination v-model:page="page" :pages="8" :total="380" :limit="50" />
          </template>
        </UiDataTable>

        <p v-if="selected.length" class="mt-3 text-body text-content-secondary">
          {{ selected.length }} мөр сонгогдсон
        </p>
      </section>

      <!-- Модал ба мэдэгдэл -->
      <section class="card">
        <h2 class="text-h3">Модал ба мэдэгдэл</h2>
        <p class="mt-1 text-body text-content-secondary">
          Мэдэгдэл ажлыг таслахгүй — alert() ашиглахыг хориглоно (§1.4)
        </p>

        <div class="mt-5 flex flex-wrap gap-3">
          <UiBtn variant="secondary" @click="modalOpen = true">Модал нээх</UiBtn>
          <UiBtn variant="secondary" @click="toast.success('Ачаа бүртгэгдлээ', { description: 'TRK-88213 · ER-02-B-15' })">
            Амжилт
          </UiBtn>
          <UiBtn variant="secondary" @click="toast.error('Төлбөр дутуу байна', { description: '12,000₮ үлдэгдэлтэй' })">
            Алдаа
          </UiBtn>
          <UiBtn variant="secondary" @click="toast.warning('Нүд дүүрсэн байна', { description: 'ER-02-B-15' })">
            Сануулга
          </UiBtn>
        </div>

        <UiModal v-model="modalOpen" title="Ачаа хүчингүй болгох" subtitle="TRK-88213">
          <p class="text-body text-content-secondary">
            Энэ ачааг хүчингүй болгоход өгөгдөл устахгүй — зөвхөн төлөв өөрчлөгдөнө.
            Үйлдэл хяналтын бүртгэлд тэмдэглэгдэнэ.
          </p>

          <UiField class="mt-4" label="Шалтгаан" required>
            <UiTextInput placeholder="Жишээ: хэрэглэгч татгалзсан" />
          </UiField>

          <template #footer>
            <UiBtn variant="secondary" @click="modalOpen = false">Болих</UiBtn>
            <UiBtn variant="danger" @click="modalOpen = false">Хүчингүй болгох</UiBtn>
          </template>
        </UiModal>
      </section>

      <!-- Радиус ба сүүдэр -->
      <section class="card">
        <h2 class="text-h3">Радиус ба сүүдэр</h2>
        <div class="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div class="text-center">
            <div class="mx-auto h-20 w-full rounded-card bg-surface-card shadow-card" />
            <p class="mt-2 text-body-sm text-content-secondary">Card · 16px</p>
          </div>
          <div class="text-center">
            <div class="mx-auto h-20 w-full rounded-btn bg-surface-card shadow-card" />
            <p class="mt-2 text-body-sm text-content-secondary">Button · 12px</p>
          </div>
          <div class="text-center">
            <div class="mx-auto h-20 w-full rounded-input bg-surface-card shadow-card" />
            <p class="mt-2 text-body-sm text-content-secondary">Input · 10px</p>
          </div>
          <div class="text-center">
            <div class="mx-auto h-20 w-full rounded-card bg-surface-card shadow-raised" />
            <p class="mt-2 text-body-sm text-content-secondary">Raised shadow</p>
          </div>
        </div>
      </section>

      <footer class="pb-4 text-center text-body-sm text-content-secondary">
        Токенууд: <code>app/assets/design-tokens.js</code> — өнгө засахдаа зөвхөн энэ файлыг өөрчилнө
      </footer>
    </div>

    <UiToastHost />
  </div>
</template>
