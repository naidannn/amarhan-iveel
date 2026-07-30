<script setup lang="ts">
import { Package, Wallet, PackageCheck, Truck, ArrowRight } from 'lucide-vue-next'
import { formatCurrency } from '~/utils/currency'

/** Харилцагчийн хяналтын самбар — introduction.md §3 */
definePageMeta({ middleware: 'customer' })

const customer = useCustomerStore()
const portal = useCustomerPortal()
const { style, label } = usePackageStatus()

const summary = ref<Awaited<ReturnType<typeof portal.summary>> | null>(null)
const recent = ref<any[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const [s, list] = await Promise.all([portal.summary(), portal.packages({ limit: 5 })])
    summary.value = s
    recent.value = list.data
  } finally {
    loading.value = false
  }
})

const stats = computed(() => [
  {
    label: 'Нийт ачаа',
    value: summary.value?.packages.total ?? 0,
    icon: Package,
    to: '/my/packages',
  },
  {
    label: 'Төлбөр хүлээгдэж буй',
    value: summary.value?.packages.awaitingPayment ?? 0,
    icon: Wallet,
    to: '/my/packages',
  },
  {
    label: 'Авахад бэлэн',
    value: summary.value?.packages.readyForPickup ?? 0,
    icon: PackageCheck,
    to: '/my/packages',
  },
  {
    label: 'Хүргэлтэнд',
    value: summary.value?.packages.inDelivery ?? 0,
    icon: Truck,
    to: '/my/deliveries',
  },
])

useHead({ title: 'Хяналтын самбар — Ивээл Карго' })
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-h1 font-bold text-content">Сайн байна уу, {{ customer.displayName }}</h1>
      <p class="mt-1 text-body text-content-secondary">Ачаа, төлбөрийнхөө байдлыг эндээс харна</p>
    </div>

    <!-- Төлөх үлдэгдэл -->
    <div
      v-if="summary && summary.balance > 0"
      class="flex flex-wrap items-center justify-between gap-3 rounded-card border border-warning/30 bg-warning/10 px-5 py-4"
    >
      <div>
        <p class="text-body-sm text-content-secondary">Төлөх үлдэгдэл</p>
        <p class="text-h2 font-bold tabular text-content">
          {{ formatCurrency(summary.balance) }}
        </p>
      </div>
      <UiBtn to="/my/packages" size="sm" variant="secondary" :icon-right="ArrowRight">
        Ачаагаа харах
      </UiBtn>
    </div>

    <!-- Тоонууд -->
    <div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <NuxtLink
        v-for="stat in stats"
        :key="stat.label"
        :to="stat.to"
        class="rounded-card border border-surface-border bg-surface-card p-4 transition-colors duration-200 hover:border-primary-300"
      >
        <div class="flex items-center gap-2 text-content-secondary">
          <component :is="stat.icon" :size="17" :stroke-width="2" />
          <span class="text-body-sm">{{ stat.label }}</span>
        </div>
        <p class="mt-2 text-h1 font-bold tabular text-content">
          <span v-if="loading" class="text-content-disabled">—</span>
          <span v-else>{{ stat.value }}</span>
        </p>
      </NuxtLink>
    </div>

    <!-- Сүүлийн ачаанууд -->
    <div class="rounded-card border border-surface-border bg-surface-card">
      <div class="flex items-center justify-between border-b border-surface-border px-5 py-4">
        <h2 class="font-semibold text-content">Сүүлд ирсэн ачаа</h2>
        <NuxtLink to="/my/packages" class="text-body-sm font-medium text-primary-600 hover:underline">
          Бүгдийг харах
        </NuxtLink>
      </div>

      <p v-if="loading" class="px-5 py-8 text-center text-body text-content-secondary">
        Ачаалж байна…
      </p>

      <div v-else-if="!recent.length" class="px-5 py-10 text-center">
        <Package :size="32" class="mx-auto text-content-disabled" :stroke-width="1.6" />
        <p class="mt-2.5 text-body text-content-secondary">Танд бүртгэгдсэн ачаа алга байна</p>
        <p class="mx-auto mt-1 max-w-sm text-body-sm text-content-secondary">
          Ачаа Монголд ирж, агуулахад бүртгэгдсэний дараа энд харагдана.
        </p>
      </div>

      <ul v-else class="divide-y divide-surface-border">
        <li v-for="pkg in recent" :key="pkg.id">
          <NuxtLink
            :to="`/my/packages/${pkg.id}`"
            class="flex items-center gap-3 px-5 py-3.5 transition-colors duration-200 hover:bg-surface-hover"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium tabular text-content">{{ pkg.trackingNumber }}</p>
              <p class="text-body-sm text-content-secondary">
                {{ formatCurrency(pkg.finalPrice) }}
                <span v-if="pkg.balance > 0" class="text-warning">
                  · {{ formatCurrency(pkg.balance) }} үлдэгдэлтэй
                </span>
              </p>
            </div>
            <span
              class="shrink-0 rounded-full px-2.5 py-1 text-body-sm font-semibold"
              :style="{ color: style(pkg.status).color, backgroundColor: style(pkg.status).bg }"
            >
              {{ label(pkg.status) }}
            </span>
          </NuxtLink>
        </li>
      </ul>
    </div>
  </div>
</template>
