<script setup lang="ts">
import { ArrowRight, Check, Circle, CreditCard, Package, Timer, Weight } from 'lucide-vue-next'

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
  { key: 'registered', label: 'Улаанбаатарт ирж бүртгэгдсэн', at: '07/28 · 10:20', complete: true },
  { key: 'notified', label: 'Хэрэглэгчид мэдэгдсэн', at: '07/28 · 10:23', complete: true },
  { key: 'awaiting_payment', label: 'Төлбөр хүлээгдэж байна', at: 'Одоогийн төлөв', complete: false },
  { key: 'paid', label: 'Төлбөр төлөгдөнө', at: '', complete: false },
  { key: 'out_for_delivery', label: 'Хүлээн авч дуусна', at: '', complete: false },
]

const current = 'awaiting_payment'
</script>

<template>
  <section class="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16">
    <div class="grid items-center gap-10 rounded-[32px] bg-primary-600 px-6 py-8 shadow-[0_24px_60px_-28px_rgba(53,93,255,0.7)] sm:px-10 sm:py-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
      <div class="text-center lg:text-left">
        <p class="text-body-sm font-semibold text-primary-100">Ачаа хайх</p>
        <h2 class="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Тухайн үеийн төлвөө шалгана
        </h2>
        <p class="mx-auto mt-4 max-w-md text-body-lg leading-relaxed text-primary-100 lg:mx-0">
          Ачааны дугаараараа хайж тухайн үеийн төлөвийг шалгана. Төлбөр,
          жин болон хүлээн авах шат бүр нэг дэлгэц дээр харагдана.
        </p>
        <UiBtn to="/track" class="mt-7 !bg-white !text-primary-700 hover:!bg-primary-50" :icon-right="ArrowRight">Ачаагаа хайх</UiBtn>
      </div>

      <div class="rounded-[28px] border border-white/80 bg-white p-5 shadow-[0_18px_40px_-18px_rgba(15,23,42,0.35)] sm:p-7">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-body-sm font-medium text-slate-400">Ачааны дугаар</p>
            <p class="mt-1 text-xl font-bold tabular tracking-tight text-slate-900 sm:text-2xl">TRK20260728014</p>
          </div>
          <span
            class="rounded-full px-3 py-1 text-body-sm font-semibold"
            :style="{ color: all[current].color, backgroundColor: all[current].bg }"
          >
            {{ all[current].label }}
          </span>
        </div>

        <div class="mt-5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            class="h-full rounded-full bg-gradient-to-r from-primary-600 to-primary-400 transition-all duration-700"
            :style="{ width: `${progress(current)}%` }"
          />
        </div>

        <ol class="mt-6 space-y-4">
          <li v-for="step in demoSteps" :key="step.key" class="flex gap-3">
            <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full" :class="step.complete ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-400'">
              <Check v-if="step.complete" :size="13" :stroke-width="3" />
              <Circle v-else :size="8" fill="currentColor" />
            </span>
            <div class="min-w-0">
              <p class="text-body-sm font-medium" :class="step.complete ? 'text-slate-900' : 'text-slate-500'">{{ step.label }}</p>
              <p v-if="step.at" class="text-[12px] text-slate-400">{{ step.at }}</p>
            </div>
          </li>
        </ol>

        <div class="mt-6 grid grid-cols-3 gap-2 border-t border-slate-100 pt-5">
          <div class="rounded-xl bg-slate-50 p-2.5">
            <Weight :size="15" class="text-primary-600" />
            <p class="mt-2 text-[11px] text-slate-400">Жин</p>
            <p class="text-body-sm font-semibold text-slate-900">2.4 кг</p>
          </div>
          <div class="rounded-xl bg-slate-50 p-2.5">
            <Timer :size="15" class="text-primary-600" />
            <p class="mt-2 text-[11px] text-slate-400">Хүлээн авах</p>
            <p class="text-body-sm font-semibold text-slate-900">Агуулах</p>
          </div>
          <div class="rounded-xl bg-slate-50 p-2.5">
            <CreditCard :size="15" class="text-primary-600" />
            <p class="mt-2 text-[11px] text-slate-400">Төлбөр</p>
            <p class="text-body-sm font-semibold text-slate-900">Хүлээгдэж</p>
          </div>
        </div>
        <p class="mt-5 text-center text-[12px] text-slate-400"><Package :size="12" class="mr-1 inline" /> Жишээ дэлгэц — бодит өгөгдөл биш</p>
      </div>
    </div>
  </section>
</template>
