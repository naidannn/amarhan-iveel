<script setup lang="ts">
import { Package, Truck, Wallet, Users } from 'lucide-vue-next'

/**
 * Хяналтын самбар.
 *
 * Одоогоор тоонууд нь тэг — Phase 2-т ачааны модуль бэлэн болоход
 * бодит өгөгдлөөр солигдоно. Энэ хуудас нь Design System-ийн бүтэц
 * (карт, badge, сүлжээ) бодитоор ажиллаж байгааг харуулна.
 */
definePageMeta({
  layout: 'admin',
  middleware: 'auth',
})

useHead({ title: 'Хяналтын самбар · Ивээл Карго' })

const { all: allStatuses } = usePackageStatus()

const stats = [
  { label: 'Өнөөдөр бүртгэсэн', value: 0, icon: Package, accent: '#355DFF' },
  { label: 'Замд явж буй', value: 0, icon: Truck, accent: '#EA580C' },
  { label: 'Төлбөр хүлээгдэж буй', value: 0, icon: Wallet, accent: '#B45309' },
  { label: 'Идэвхтэй харилцагч', value: 0, icon: Users, accent: '#16A34A' },
]

const statusKeys = Object.keys(allStatuses)
</script>

<template>
  <div>
    <UiPageHeader title="Хяналтын самбар" subtitle="Өдөр тутмын үйл ажиллагааны товч байдал" />

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiStatCard
        v-for="stat in stats"
        :key="stat.label"
        :label="stat.label"
        :value="stat.value"
        :icon="stat.icon"
        :accent="stat.accent"
      />
    </div>

    <div class="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
      <section class="card lg:col-span-2">
        <h2 class="text-h4 text-content">Сүүлд бүртгэгдсэн ачаа</h2>
        <p class="mt-1 text-body text-content-secondary">
          Ачааны модуль (Phase 2) бэлэн болоход энд жагсаалт харагдана.
        </p>

        <div
          class="mt-5 flex flex-col items-center justify-center rounded-btn border border-dashed border-surface-border py-12 text-center"
        >
          <Package :size="32" class="text-content-disabled" :stroke-width="1.6" />
          <p class="mt-3 text-body text-content-secondary">Одоогоор ачаа бүртгэгдээгүй байна</p>
        </div>
      </section>

      <section class="card">
        <h2 class="text-h4 text-content">Ачааны төлөвүүд</h2>
        <p class="mt-1 text-body text-content-secondary">Систем даяар ашиглагдах өнгөний схем</p>

        <div class="mt-5 flex flex-wrap gap-2">
          <UiStatusBadge v-for="key in statusKeys" :key="key" :status="key" />
        </div>
      </section>
    </div>
  </div>
</template>
