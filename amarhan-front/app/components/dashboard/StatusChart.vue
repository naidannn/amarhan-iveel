<script setup lang="ts">
interface StatusSlice {
  key: string
  label: string
  color: string
  count: number
}

const props = defineProps<{
  statuses: StatusSlice[]
  total: number
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
let chart: import('chart.js').Chart<'doughnut', number[], string> | null = null
let renderVersion = 0

/** Chart.js-ийн donut өгөгдөл нь 0-тэй slice-уудыг оруулахгүй — хоосон legend/tooltip үүсгэхгүй. */
const activeStatuses = computed(() => props.statuses.filter(status => status.count > 0))

async function renderChart() {
  const version = ++renderVersion
  chart?.destroy()
  chart = null

  if (!import.meta.client) return

  await nextTick()
  if (!canvas.value || version !== renderVersion) return

  const { ArcElement, Chart, DoughnutController, Tooltip } = await import('chart.js')
  if (!canvas.value || version !== renderVersion) return

  Chart.register(DoughnutController, ArcElement, Tooltip)
  chart = new Chart(canvas.value, {
    type: 'doughnut',
    data: {
      labels: activeStatuses.value.map(status => status.label),
      datasets: [
        {
          data: activeStatuses.value.map(status => status.count),
          backgroundColor: activeStatuses.value.map(status => status.color),
          borderColor: '#FFFFFF',
          borderWidth: 3,
          borderRadius: 5,
          spacing: 2,
          hoverOffset: 7,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      animation: { animateRotate: true, duration: 500 },
      plugins: {
        legend: { display: false },
        tooltip: {
          padding: 10,
          displayColors: true,
          callbacks: {
            label: item => {
              const count = Number(item.raw)
              const percent = props.total ? Math.round((count / props.total) * 100) : 0
              return `${item.label}: ${count.toLocaleString('mn-MN')} (${percent}%)`
            },
          },
        },
      },
    },
  })
}

watch(() => [props.statuses, props.total], renderChart, { deep: true })
onMounted(renderChart)
onBeforeUnmount(() => chart?.destroy())
</script>

<template>
  <div class="relative h-64">
    <canvas ref="canvas" aria-label="Ачааны төлөвийн тойрог график" />
    <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
      <span class="tabular text-h2 text-content">{{ total.toLocaleString('mn-MN') }}</span>
      <span class="mt-1 text-body-sm text-content-secondary">Идэвхтэй ачаа</span>
    </div>
  </div>
</template>
