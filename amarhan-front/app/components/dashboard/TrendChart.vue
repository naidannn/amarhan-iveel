<script setup lang="ts">
import type { DashboardDailyPoint } from '~/composables/useDashboard'

const props = withDefaults(
  defineProps<{
    points: DashboardDailyPoint[]
    field: 'revenue' | 'packages'
    label: string
    color: string
    loading?: boolean
    valueLabel: (value: number) => string
  }>(),
  { loading: false }
)

const canvas = ref<HTMLCanvasElement | null>(null)
let chart: import('chart.js').Chart<'line', number[], string> | null = null
let renderVersion = 0

function shortDate(date: string) {
  const [, month, day] = date.split('-')
  return `${Number(month)}/${Number(day)}`
}

function fullDate(date: string) {
  return new Date(`${date}T00:00:00+08:00`).toLocaleDateString('mn-MN', {
    month: 'long',
    day: 'numeric',
  })
}

function compactValue(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString('mn-MN', { maximumFractionDigits: 1 })} сая`
  if (value >= 1_000) return `${(value / 1_000).toLocaleString('mn-MN', { maximumFractionDigits: 1 })} мян`
  return value.toLocaleString('mn-MN')
}

/** Chart.js нь зөвхөн dashboard route дээр dynamic import-оор ачаалагдана. */
async function renderChart() {
  const version = ++renderVersion
  chart?.destroy()
  chart = null

  if (props.loading || !import.meta.client) return

  await nextTick()
  if (!canvas.value || version !== renderVersion) return

  const { Chart, Filler, LineController, LineElement, LinearScale, PointElement, Tooltip, CategoryScale } =
    await import('chart.js')

  if (!canvas.value || version !== renderVersion) return

  Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler)
  chart = new Chart(canvas.value, {
    type: 'line',
    data: {
      labels: props.points.map(point => shortDate(point.date)),
      datasets: [
        {
          label: props.label,
          data: props.points.map(point => point[props.field]),
          borderColor: props.color,
          backgroundColor: `${props.color}22`,
          fill: true,
          borderWidth: 3,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBorderWidth: 3,
          pointHoverBackgroundColor: '#FFFFFF',
          pointHoverBorderColor: props.color,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      animation: { duration: 450 },
      plugins: {
        legend: { display: false },
        tooltip: {
          padding: 11,
          displayColors: false,
          callbacks: {
            title: items => fullDate(props.points[items[0]?.dataIndex]?.date ?? ''),
            label: item => `${props.label}: ${props.valueLabel(Number(item.raw))}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: '#6B7280', maxTicksLimit: 5, font: { size: 11 } },
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
  () => [props.points, props.field, props.color, props.label, props.loading],
  renderChart,
  { deep: true }
)

onMounted(renderChart)
onBeforeUnmount(() => chart?.destroy())
</script>

<template>
  <div v-if="loading" class="h-[254px] animate-pulse rounded-btn bg-surface-hover" />
  <div v-else>
    <div class="mb-3 flex items-center justify-between gap-3">
      <span class="flex items-center gap-2 text-body-sm font-medium text-content">
        <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: color }" />
        {{ label }}
      </span>
      <span class="text-body-sm text-content-secondary">Өдөр тутам</span>
    </div>
    <div class="h-[226px]">
      <canvas ref="canvas" :aria-label="`Сүүлийн 30 хоногийн ${label} график`" />
    </div>
  </div>
</template>
