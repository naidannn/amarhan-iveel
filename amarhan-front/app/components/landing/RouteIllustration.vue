<script setup lang="ts">
import { Warehouse, Milestone, House, Package } from 'lucide-vue-next'

/**
 * Хятадын агуулах → хил → Монголын агуулах → харилцагч чиглэлийг илэрхийлэх
 * SVG зураглал. Гэрэл зураг БИШ — цэвэр шугам, brand цэнхэрээр.
 *
 * `--route-path`-ыг доорх `<path>`-тай ЯГ ижил байлгах ёстой: animated dot нь
 * `offset-path`-аар яг энэ замын дагуу хөдөлнө.
 */
const nodes = [
  { icon: Warehouse, label: 'Хятад агуулах', sub: 'Эрээн' },
  { icon: Milestone, label: 'Хилийн шалган нэвтрүүлэх', sub: 'Гаалийн бүрдүүлэлт' },
  { icon: Warehouse, label: 'Монгол агуулах', sub: 'Улаанбаатар' },
  { icon: House, label: 'Харилцагч', sub: 'Хүргэлт / Салбар' },
]
</script>

<template>
  <div class="relative mx-auto w-full max-w-sm">
    <svg viewBox="0 0 320 560" fill="none" class="w-full" aria-hidden="true">
      <path
        d="M 60 60 C 60 160, 260 160, 260 260 C 260 360, 60 360, 60 460"
        stroke="url(#route-gradient)"
        stroke-width="2.5"
        stroke-dasharray="7 9"
        stroke-linecap="round"
        class="route-path"
      />
      <defs>
        <linearGradient id="route-gradient" x1="60" y1="60" x2="60" y2="460" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#355DFF" stop-opacity="0.85" />
          <stop offset="1" stop-color="#6285FF" stop-opacity="0.35" />
        </linearGradient>
      </defs>
    </svg>

    <!-- Замын дагуу хөдөлдөг ачааны цэг -->
    <div class="route-dot absolute left-0 top-0">
      <div class="flex h-9 w-9 items-center justify-center rounded-full bg-primary-500 shadow-[0_8px_20px_-2px_rgba(53,93,255,0.55)]">
        <Package :size="17" class="text-white" :stroke-width="2.4" />
      </div>
    </div>

    <!-- Зангилаанууд -->
    <div
      v-for="(node, i) in nodes"
      :key="node.label"
      class="absolute flex items-center gap-3"
      :class="[i % 2 === 0 ? 'left-[2%]' : 'right-[2%] flex-row-reverse text-right']"
      :style="{ top: `${[10, 29, 64, 82][i]}%` }"
    >
      <div
        class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_24px_-6px_rgba(15,23,42,0.12)] backdrop-blur-xl"
      >
        <component :is="node.icon" :size="24" class="text-primary-500" :stroke-width="1.7" />
      </div>
      <div class="min-w-0">
        <p class="text-body-sm font-semibold text-slate-900">{{ node.label }}</p>
        <p class="text-[12px] text-slate-500">{{ node.sub }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.route-path {
  animation: dash-flow 3.2s linear infinite;
}

@keyframes dash-flow {
  to {
    stroke-dashoffset: -32;
  }
}

.route-dot {
  offset-path: path('M 60 60 C 60 160, 260 160, 260 260 C 260 360, 60 360, 60 460');
  offset-rotate: 0deg;
  animation: travel 7s ease-in-out infinite;
}

@keyframes travel {
  0% {
    offset-distance: 0%;
  }
  45% {
    offset-distance: 48%;
  }
  55% {
    offset-distance: 52%;
  }
  100% {
    offset-distance: 100%;
  }
}
</style>
