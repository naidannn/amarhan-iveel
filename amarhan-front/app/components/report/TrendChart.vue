<script setup lang="ts">
type ChartType = 'line' | 'bar'

interface Dataset {
  label: string
  data: number[]
  color: string
}

const props = withDefaults(
  defineProps<{
    labels: string[]
    datasets: Dataset[]
    type?: ChartType
    loading?: boolean
    valueLabel: (value: number) => string
  }>(),
  { type: 'line', loading: false }
)

const canvas = ref<HTMLCanvasElement | null>(null)
let chart: import('chart.js').Chart | null = null
let renderVersion = 0

function compactValue(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('mn-MN', { maximumFractionDigits: 1 })} сая`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toLocaleString('mn-MN', { maximumFractionDigits: 1 })} мян`
  }
  return value.toLocaleString('mn-MN')
}

/** Chart.js нь зөвхөн тайлангийн хуудас нээгдсэн үед dynamic import-оор орно. */
async function renderChart() {
  const version = ++renderVersion
  chart?.destroy()
  chart = null

  if (props.loading || !import.meta.client) return

  await nextTick()
  if (!canvas.value || version !== renderVersion) return

  const { Chart, BarController, BarElement, CategoryScale, Filler, Legend, LineController, LineElement, LinearScale, PointElement, Tooltip } =
    await import('chart.js')

  if (!canvas.value || version !== renderVersion) return

  Chart.register(
    LineController,
    BarController,
    LineElement,
    BarElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Tooltip,
    Legend,
    Filler
  )

  chart = new Chart(canvas.value, {
    type: props.type,
    data: {
      labels: props.labels,
      datasets: props.datasets.map(dataset => ({
        label: dataset.label,
        data: dataset.data,
        borderColor: dataset.color,
        backgroundColor: props.type === 'line' ? `${dataset.color}20` : `${dataset.color}CC`,
        fill: props.type === 'line',
        borderWidth: props.type === 'line' ? 3 : 0,
        tension: 0.35,
        borderRadius: props.type === 'bar' ? 6 : 0,
        maxBarThickness: 36,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBorderWidth: 3,
        pointHoverBackgroundColor: '#FFFFFF',
        pointHoverBorderColor: dataset.color,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      animation: { duration: 350 },
      plugins: {
        legend: {
          display: props.datasets.length > 1,
          position: 'top',
          align: 'end',
          labels: { boxWidth: 9, boxHeight: 9, usePointStyle: true, pointStyle: 'circle', color: '#4B5563' },
        },
        tooltip: {
          padding: 11,
          displayColors: props.datasets.length > 1,
          callbacks: {
            label: item => `${item.dataset.label}: ${props.valueLabel(Number(item.raw))}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: '#6B7280', maxTicksLimit: 7, font: { size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: '#E5E7EB', borderDash: [4, 4] },
          border: { display: false },
          ticks: {
            color: '#6B7280',
            maxTicksLimit: 4,
            font: { size: 11 },
            callback: value => compactValue(Number(value)),
          },
        },
      },
    },
  })
}

watch(
  () => [props.labels, props.datasets, props.type, props.loading],
  renderChart,
  { deep: true }
)

onMounted(renderChart)
onBeforeUnmount(() => chart?.destroy())
</script>

<template>
  <div v-if="loading" class="h-[272px] animate-pulse rounded-btn bg-surface-hover" />
  <div v-else class="h-[272px]">
    <canvas ref="canvas" aria-label="Тайлангийн график" />
  </div>
</template>
