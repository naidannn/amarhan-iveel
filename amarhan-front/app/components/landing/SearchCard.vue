<script setup lang="ts">
import { Search, Phone, PackageX, ArrowRight } from 'lucide-vue-next'

/**
 * Нүүр хуудасны glass хайлтын карт — дугаар/утсаар ачаа хайна.
 *
 * Хоёр горим тусдаа шалтгаантай:
 *   · Дугаараар → тухайн НЭГ ачааны төлөв (`/track/[number]`).
 *   · Утсаар    → тухайн дугаартай холбоотой БҮХ ачаа. Энэ учраас зөвхөн
 *     ЯГ БҮТЭН дугаар зөвшөөрнө (backend `public.service.js#trackByPhone`
 *     prefix хайлт хийхгүй — enumeration-с хамгаална).
 */
const { trackByPhone } = usePublicContent()
const { style, label } = usePackageStatus()

const mode = ref<'tracking' | 'phone'>('tracking')
const trackingQuery = ref('')
const phoneQuery = ref('')

const loading = ref(false)
const error = ref<string | null>(null)
const results = ref<{ trackingNumber: string; status: string; registeredAt: string }[] | null>(null)

function searchTracking() {
  const value = trackingQuery.value.trim()
  if (!value) return
  navigateTo(`/track/${encodeURIComponent(value)}`)
}

async function searchPhone() {
  const value = phoneQuery.value.trim()
  if (!value) return

  loading.value = true
  error.value = null
  results.value = null

  try {
    const res = await trackByPhone(value, { limit: 10 })
    results.value = res.data
  } catch (err: any) {
    error.value = err?.data?.message || 'Утасны дугаар буруу байна. 8 оронтой дугаараа шалгана уу'
  } finally {
    loading.value = false
  }
}

function switchMode(next: 'tracking' | 'phone') {
  mode.value = next
  error.value = null
  results.value = null
}
</script>

<template>
  <div
    class="w-full rounded-[24px] border border-slate-200/80 bg-white/90 p-2 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.18)] backdrop-blur-2xl"
  >
    <!-- Горим сонгох таб -->
    <div class="flex gap-1 rounded-2xl bg-slate-100 p-1">
      <button
        type="button"
        class="flex-1 rounded-xl px-4 py-2.5 text-body-sm font-semibold transition-colors duration-200"
        :class="mode === 'tracking' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'"
        @click="switchMode('tracking')"
      >
        Ачааны дугаар
      </button>
      <button
        type="button"
        class="flex-1 rounded-xl px-4 py-2.5 text-body-sm font-semibold transition-colors duration-200"
        :class="mode === 'phone' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'"
        @click="switchMode('phone')"
      >
        Утасны дугаар
      </button>
    </div>

    <form v-if="mode === 'tracking'" class="flex flex-col gap-2 p-2 sm:flex-row" @submit.prevent="searchTracking">
      <UiTextInput
        v-model="trackingQuery"
        placeholder="Жишээ: TRK20260731001"
        :icon="Search"
        class="flex-1"
        aria-label="Ачааны дугаар"
      />
      <UiBtn type="submit" size="md" :icon-right="ArrowRight" :disabled="!trackingQuery.trim()" class="sm:w-auto">
        Хайх
      </UiBtn>
    </form>

    <form v-else class="flex flex-col gap-2 p-2 sm:flex-row" @submit.prevent="searchPhone">
      <UiTextInput
        v-model="phoneQuery"
        type="tel"
        placeholder="Жишээ: 9911 2233"
        :icon="Phone"
        class="flex-1"
        aria-label="Утасны дугаар"
      />
      <UiBtn type="submit" size="md" :loading="loading" :disabled="!phoneQuery.trim()" class="sm:w-auto">
        Хайх
      </UiBtn>
    </form>

    <!-- Утсаар хайсан үр дүн -->
    <div v-if="mode === 'phone' && (results || error)" class="border-t border-slate-200/80 p-3">
      <p v-if="error" class="flex items-center gap-2 px-2 py-2 text-body-sm text-slate-500">
        <PackageX :size="16" class="shrink-0" />
        {{ error }}
      </p>

      <p v-else-if="results && results.length === 0" class="px-2 py-2 text-body-sm text-slate-500">
        Энэ дугаартай бүртгэлтэй ачаа олдсонгүй.
      </p>

      <ul v-else-if="results" class="max-h-56 space-y-1.5 overflow-y-auto">
        <li v-for="pkg in results" :key="pkg.trackingNumber">
          <NuxtLink
            :to="`/track/${encodeURIComponent(pkg.trackingNumber)}`"
            class="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-100"
          >
            <span class="truncate text-body-sm font-medium tabular text-slate-900">{{ pkg.trackingNumber }}</span>
            <span
              class="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold"
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
