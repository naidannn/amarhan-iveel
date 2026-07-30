<script setup lang="ts">
import { Search, PackageX, ArrowLeft } from 'lucide-vue-next'

/**
 * Ачаа хайх — introduction.md §3 (roadmap 5.5)
 *
 * Нэвтрэхгүйгээр хандана. Backend нь ҮНЭ, ҮЛДЭГДЭЛ, агуулахын байршлыг
 * ХАРУУЛДАГГҮЙ (`public.service.js`) — дугаар мэддэг хэн ч дуудаж чадах
 * тул энд харагдаж болох мэдээллийн хүрээ хатуу.
 */
const route = useRoute()
const { track } = usePublicContent()
const { style, label } = usePackageStatus()

const trackingNumber = computed(() => String(route.params.number ?? ''))

const { data: result, error } = await useAsyncData(
  () => `track-${trackingNumber.value}`,
  () => track(trackingNumber.value),
  { watch: [trackingNumber] }
)

const query = ref(trackingNumber.value)

function search() {
  const value = query.value.trim()
  if (!value || value === trackingNumber.value) return
  navigateTo(`/track/${encodeURIComponent(value)}`)
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('mn-MN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

useHead({ title: `${trackingNumber.value} — Ачаа хайх` })
</script>

<template>
  <div class="mx-auto max-w-lg py-6 sm:py-10">
    <NuxtLink
      to="/"
      class="mb-4 inline-flex items-center gap-1.5 text-body-sm text-content-secondary hover:text-content"
    >
      <ArrowLeft :size="15" />
      Нүүр хуудас
    </NuxtLink>

    <form class="flex gap-2" @submit.prevent="search">
      <UiTextInput
        v-model="query"
        placeholder="Ачааны дугаар"
        :icon="Search"
        class="flex-1"
        aria-label="Ачааны дугаар"
      />
      <UiBtn type="submit">Хайх</UiBtn>
    </form>

    <!-- Олдсонгүй -->
    <div
      v-if="error"
      class="mt-6 rounded-card border border-surface-border bg-surface-card px-6 py-10 text-center"
    >
      <PackageX :size="36" class="mx-auto text-content-disabled" :stroke-width="1.6" />
      <h1 class="mt-3 font-semibold text-content">Ачаа олдсонгүй</h1>
      <p class="mx-auto mt-1.5 max-w-sm text-body-sm text-content-secondary">
        <span class="font-medium">{{ trackingNumber }}</span> дугаартай ачаа системд
        бүртгэгдээгүй байна. Ачаа Монголд ирсний дараа бүртгэгддэг тул хараахан
        замдаа явж байгаа байж болно.
      </p>
    </div>

    <!-- Үр дүн -->
    <div v-else-if="result" class="mt-6 space-y-4">
      <div class="rounded-card border border-surface-border bg-surface-card p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-body-sm text-content-secondary">Ачааны дугаар</p>
            <p class="truncate text-h2 font-bold tabular text-content">
              {{ result.trackingNumber }}
            </p>
          </div>
          <span
            class="rounded-full px-3 py-1 text-body-sm font-semibold"
            :style="{ color: style(result.status).color, backgroundColor: style(result.status).bg }"
          >
            {{ label(result.status) }}
          </span>
        </div>

        <dl class="mt-4 grid gap-3 border-t border-surface-border pt-4 sm:grid-cols-2">
          <div>
            <dt class="text-body-sm text-content-secondary">Бүртгэгдсэн</dt>
            <dd class="text-body text-content">{{ formatDate(result.registeredAt) }}</dd>
          </div>
          <div>
            <dt class="text-body-sm text-content-secondary">Холбоотой утас</dt>
            <dd class="text-body tabular text-content">{{ result.phoneHint }}</dd>
          </div>
        </dl>
      </div>

      <!-- Төлөвийн түүх -->
      <div
        v-if="result.history?.length"
        class="rounded-card border border-surface-border bg-surface-card p-5"
      >
        <h2 class="font-semibold text-content">Төлөвийн түүх</h2>
        <ol class="mt-3 space-y-3">
          <li v-for="(step, i) in result.history" :key="i" class="flex gap-3">
            <span
              class="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              :style="{ backgroundColor: style(step.to).color }"
            />
            <div class="min-w-0">
              <p class="text-body font-medium text-content">{{ label(step.to) }}</p>
              <p class="text-body-sm text-content-secondary">{{ formatDate(step.at) }}</p>
            </div>
          </li>
        </ol>
      </div>

      <p class="text-center text-body-sm text-content-secondary">
        Төлбөр, үнийн мэдээллээ харахын тулд
        <NuxtLink to="/login" class="font-medium text-primary-600 hover:underline">
          нэвтэрнэ үү
        </NuxtLink>
      </p>
    </div>
  </div>
</template>
