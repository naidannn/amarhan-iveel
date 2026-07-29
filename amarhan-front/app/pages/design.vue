<script setup lang="ts">
import { Package, Truck, Wallet, Users, Search, Plus } from 'lucide-vue-next'
import tokens from '~/assets/design-tokens'

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

const sampleRows = [
  { tracking: 'TRK-88213', customer: '9911-2233', status: 'in_transit', weight: '0.85', price: 2000 },
  { tracking: 'TRK-88214', customer: '9955-4433', status: 'awaiting_payment', weight: '3.20', price: 8000 },
  { tracking: 'TRK-88215', customer: '8811-9900', status: 'delivered', weight: '0.09', price: 800 },
]

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
      </header>

      <!-- Өнгө -->
      <section class="card">
        <h2 class="text-h3">Өнгө</h2>

        <div v-for="group in colorGroups" :key="group.name" class="mt-6">
          <p class="text-body font-semibold text-content">{{ group.name }}</p>
          <p class="text-body-sm text-content-secondary">{{ group.desc }}</p>
          <div class="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-11">
            <div v-for="(hex, key) in group.scale" :key="key">
              <div class="h-12 rounded-lg border border-surface-border" :style="{ background: hex }" />
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
          <Button label="Ачаа бүртгэх" />
          <Button label="Хадгалах" severity="secondary" outlined />
          <Button label="Устгах" severity="danger" />
          <Button label="Баталгаажуулах" severity="success" />
          <Button label="Нэмэх" :disabled="true" />
        </div>

        <div class="mt-4 flex flex-wrap gap-3">
          <Button label="Шинэ ачаа">
            <template #icon><Plus :size="17" :stroke-width="2.2" /></template>
          </Button>
          <Button label="Хайх" severity="secondary" outlined>
            <template #icon><Search :size="17" :stroke-width="2.2" /></template>
          </Button>
        </div>
      </section>

      <!-- Оролт -->
      <section class="card">
        <h2 class="text-h3">Оролтын талбар</h2>
        <p class="mt-1 text-body text-content-secondary">Өндөр 40px · radius 10px</p>

        <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="mb-1.5 block text-body font-medium text-content">Ачааны дугаар</label>
            <InputText class="w-full" placeholder="TRK-88213" />
          </div>
          <div>
            <label class="mb-1.5 block text-body font-medium text-content">Утасны дугаар</label>
            <InputText class="w-full" placeholder="9911-2233" />
          </div>
          <div>
            <label class="mb-1.5 block text-body font-medium text-content">Жин (кг)</label>
            <InputText class="w-full" placeholder="0.85" />
          </div>
          <div>
            <label class="mb-1.5 block text-body font-medium text-content">Идэвхгүй</label>
            <InputText class="w-full" placeholder="Засах боломжгүй" disabled />
          </div>
        </div>
      </section>

      <!-- Карт -->
      <section>
        <h2 class="mb-4 text-h3">Тоон үзүүлэлтийн карт</h2>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <UiStatCard label="Өнөөдөр бүртгэсэн" :value="125" :icon="Package" accent="#355DFF" />
          <UiStatCard label="Замд явж буй" :value="48" :icon="Truck" accent="#EA580C" />
          <UiStatCard
            label="Төлбөр хүлээгдэж буй"
            :value="12"
            :icon="Wallet"
            accent="#B45309"
            hint="1,240,000₮"
          />
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
      <section class="card">
        <h2 class="text-h3">Хүснэгт</h2>
        <p class="mt-1 text-body text-content-secondary">
          Өндөр мөр · zebra байхгүй · hover өнгөтэй
        </p>

        <div class="mt-5 -mx-2 overflow-x-auto">
          <table class="w-full min-w-[600px] text-left">
            <thead>
              <tr class="border-b border-surface-border">
                <th class="px-4 py-3.5 text-body font-medium text-content-secondary">Дугаар</th>
                <th class="px-4 py-3.5 text-body font-medium text-content-secondary">Харилцагч</th>
                <th class="px-4 py-3.5 text-body font-medium text-content-secondary">Төлөв</th>
                <th class="px-4 py-3.5 text-right text-body font-medium text-content-secondary">
                  Жин
                </th>
                <th class="px-4 py-3.5 text-right text-body font-medium text-content-secondary">
                  Үнэ
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in sampleRows" :key="row.tracking" class="table-row">
                <td class="px-4 py-4 font-medium text-content">{{ row.tracking }}</td>
                <td class="tabular px-4 py-4 text-content-secondary">{{ row.customer }}</td>
                <td class="px-4 py-4"><UiStatusBadge :status="row.status" size="sm" /></td>
                <td class="tabular px-4 py-4 text-right text-content-secondary">
                  {{ row.weight }} кг
                </td>
                <td class="tabular px-4 py-4 text-right font-semibold text-content">
                  {{ money(row.price) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
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
  </div>
</template>
