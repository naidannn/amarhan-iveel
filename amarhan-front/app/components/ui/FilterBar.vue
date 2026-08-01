<script setup lang="ts">
import { Filter, ChevronDown } from 'lucide-vue-next'

/**
 * Жагсаалтын шүүлтүүрийг ороож өгдөг wrapper.
 *
 * `lg`-ээс дээш (sidebar-ийн breakpoint-той тааруулав) шүүлтүүр үргэлж
 * дэлгэгдсэн — desktop дээр харагдах байдал өөрчлөгдөхгүй. `lg`-ээс доош
 * анхандаа хаалттай: өгөгдлийг хамгийн түрүүнд харуулж, шүүлтүүрийг
 * хэрэгтэй үедээ л дэлгэдэг болгоно.
 *
 * `#primary` slot — тухайн хуудсанд ХАМГИЙН ОЛОН ашиглагддаг 1-2 хайлтын
 * талбар (жишээ нь: ачааны дугаар, утас) — эвхэгдэхгүй, үргэлж харагдана.
 * Бусад талбарууд (default slot) л мобайл дээр эвхэгдэнэ.
 */
withDefaults(defineProps<{ activeCount?: number }>(), { activeCount: 0 })

const open = ref(false)
</script>

<template>
  <div>
    <div v-if="$slots.primary" class="mb-3 grid gap-3 sm:grid-cols-2">
      <slot name="primary" />
    </div>

    <button
      type="button"
      class="flex w-full items-center gap-2 rounded-btn px-1 py-1.5 text-body font-medium text-content lg:hidden"
      :aria-expanded="open"
      @click="open = !open"
    >
      <Filter :size="16" :stroke-width="2" class="text-content-secondary" />
      Шүүлтүүр
      <span
        v-if="activeCount"
        class="rounded-full bg-primary-50 px-1.5 py-0.5 text-body-sm font-semibold text-primary-600"
      >
        {{ activeCount }}
      </span>
      <ChevronDown
        :size="16"
        :stroke-width="2"
        class="ml-auto text-content-secondary transition-transform duration-200"
        :class="open && 'rotate-180'"
      />
    </button>

    <div class="mt-3 lg:mt-0" :class="open ? 'block' : 'hidden lg:block'">
      <slot />
    </div>
  </div>
</template>
