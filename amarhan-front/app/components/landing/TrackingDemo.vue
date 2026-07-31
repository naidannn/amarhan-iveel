<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next'

/**
 * Жишээ (демо) хяналтын урьдчилан харагдац.
 *
 * ⚠ Энэ бол ЗАГВАР л — бодит ачааны өгөгдөл БИШ, тодорхой танилцуулав.
 * Бодит хайлт хэрэглэгчийн `SearchCard`/`/track` дээр л явагдана. Статусын
 * дараалал `useStatus.ts`-ийн `FLOW`-тэй ижил — систем ЗАМЫН төлөв (in_transit)
 * хадгалдаггүй тул "Хятадаас гарсан" мэт алхам энд БАЙХГҮЙ.
 */
const { all, progress } = usePackageStatus()

const demoSteps = [
  { key: 'registered', at: 'Бүртгэгдсэн' },
  { key: 'notified', at: 'Мэдэгдэл илгээсэн' },
  { key: 'awaiting_payment', at: 'Төлбөр хүлээгдэж буй' },
  { key: 'paid', at: 'Төлбөр төлөгдсөн' },
  { key: 'out_for_delivery', at: 'Хүргэлтэнд гарсан' },
]

const current = 'out_for_delivery'
</script>

<template>
  <section class="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
    <div class="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
      <div class="text-center lg:text-left">
        <h2 class="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Ачааныхаа явцыг бодит цагт хараарай
        </h2>
        <p class="mx-auto mt-4 max-w-md text-body-lg text-slate-500 lg:mx-0">
          Ачаа Монголд ирж бүртгэгдсэн даруйдаа таны хяналтад орно. Дугаар
          эсвэл утасны дугаараараа хэдийд ч, хаанаас ч шалгана.
        </p>
        <UiBtn to="/track" class="mt-7" :icon-right="ArrowRight">Ачаагаа хайх</UiBtn>
      </div>

      <div class="rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.1)] sm:p-7">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-body-sm text-slate-400">Ачааны дугаар</p>
            <p class="text-h3 font-bold tabular text-slate-900">TRK20260728014</p>
          </div>
          <span
            class="rounded-full px-3 py-1 text-body-sm font-semibold"
            :style="{ color: all[current].color, backgroundColor: all[current].bg }"
          >
            {{ all[current].label }}
          </span>
        </div>

        <div class="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            class="h-full rounded-full bg-gradient-to-r from-primary-600 to-primary-400 transition-all duration-700"
            :style="{ width: `${progress(current)}%` }"
          />
        </div>

        <ol class="mt-6 space-y-4">
          <li v-for="(step, i) in demoSteps" :key="step.key" class="flex gap-3">
            <span
              class="mt-1 h-2 w-2 shrink-0 rounded-full"
              :class="i <= 4 ? 'bg-primary-500' : 'bg-slate-200'"
            />
            <div class="min-w-0">
              <p class="text-body-sm font-medium text-slate-900">{{ all[step.key].label }}</p>
              <p class="text-[12px] text-slate-400">{{ step.at }}</p>
            </div>
          </li>
        </ol>

        <p class="mt-5 text-center text-[12px] text-slate-400">Жишээ дэлгэц — бодит өгөгдөл биш</p>
      </div>
    </div>
  </section>
</template>
