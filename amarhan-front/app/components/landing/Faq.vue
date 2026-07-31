<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'

const props = defineProps<{ faq: { question: string; answer: string }[] }>()

const open = ref<number | null>(0)

function toggle(i: number) {
  open.value = open.value === i ? null : i
}
</script>

<template>
  <section id="faq" class="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-16">
    <div class="mx-auto max-w-xl text-center">
      <h2 class="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Түгээмэл асуулт</h2>
      <p class="mt-4 text-body-lg text-slate-500">Хамгийн олон асуудаг зүйлсийн хариулт.</p>
    </div>

    <div v-if="faq.length" class="mt-12 space-y-3">
      <div
        v-for="(item, i) in faq"
        :key="i"
        class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]"
      >
        <button
          type="button"
          class="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
          :aria-expanded="open === i"
          @click="toggle(i)"
        >
          <span class="font-medium text-slate-900">{{ item.question }}</span>
          <ChevronDown
            :size="18"
            class="shrink-0 text-slate-400 transition-transform duration-200"
            :class="open === i && 'rotate-180'"
          />
        </button>
        <p
          v-if="open === i"
          class="whitespace-pre-line px-5 pb-4 text-body-sm leading-relaxed text-slate-500"
        >
          {{ item.answer }}
        </p>
      </div>
    </div>

    <p v-else class="mt-12 text-center text-body-sm text-slate-400">
      Түгээмэл асуултын жагсаалт удахгүй нэмэгдэнэ.
      <NuxtLink to="/help" class="font-medium text-primary-600 hover:underline">Тусламжийн хуудас</NuxtLink>
    </p>
  </section>
</template>
