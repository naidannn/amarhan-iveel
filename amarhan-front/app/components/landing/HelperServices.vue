<script setup lang="ts">
import { Banknote, Link2, ArrowUpRight } from 'lucide-vue-next'

/**
 * Туслах үйлчилгээ — Юань шилжүүлэг, Линк захиалга. `content.yuan_transfer`,
 * `content.link_order` (Тохиргоо > Туслах үйлчилгээ, Админ засна).
 *
 * Хоёулаа систем дотор өөрийн урсгалгүй — зөвхөн заавар/чиглүүлэлт:
 * Юань шилжүүлэг попупоор дансны мэдээлэл харуулна, Линк захиалга шууд
 * Facebook хуудас руу чиглүүлнэ (тэнд чатаар зохицуулагддаг тул).
 */
const props = defineProps<{
  yuanTransfer: {
    rate?: number | null
    bankAccount?: string
    accountHolder?: string
    transferNote?: string
    facebookUrl?: string
    instructions?: string
  } | null
  linkOrder: {
    facebookUrl?: string
    instructions?: string
  } | null
}>()

const showYuanModal = ref(false)

const hasYuanTransfer = computed(() => Boolean(props.yuanTransfer?.bankAccount))
const hasLinkOrder = computed(() => Boolean(props.linkOrder?.facebookUrl))
</script>

<template>
  <section v-if="hasYuanTransfer || hasLinkOrder" class="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16">
    <div class="mx-auto max-w-xl text-center">
      <h2 class="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Туслах үйлчилгээ</h2>
      <p class="mt-4 text-body-lg text-slate-500">
        Ачаа тээвэрлэлтээс гадна дараах үйлчилгээг мөн санал болгож байна.
      </p>
    </div>

    <div class="mx-auto mt-12 grid max-w-3xl gap-5 sm:grid-cols-2">
      <button
        v-if="hasYuanTransfer"
        type="button"
        class="group flex flex-col items-start rounded-[24px] border border-slate-200/80 bg-white p-7 text-left shadow-[0_8px_30px_-12px_rgba(15,23,42,0.1)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-14px_rgba(15,23,42,0.16)]"
        @click="showYuanModal = true"
      >
        <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
          <Banknote :size="22" :stroke-width="1.8" />
        </span>
        <h3 class="mt-4 text-lg font-semibold text-slate-900">Юань шилжүүлэг</h3>
        <p class="mt-1.5 text-body-sm text-slate-500">
          Хятад руу юань мөнгө шилжүүлэх дансны мэдээлэл, ханш, заавар.
        </p>
        <span class="mt-4 inline-flex items-center gap-1 text-body-sm font-semibold text-primary-600 group-hover:text-primary-700">
          Дэлгэрэнгүй харах <ArrowUpRight :size="15" />
        </span>
      </button>

      <NuxtLink
        v-if="hasLinkOrder"
        :to="linkOrder!.facebookUrl!"
        target="_blank"
        rel="noopener noreferrer"
        class="group flex flex-col items-start rounded-[24px] border border-slate-200/80 bg-white p-7 text-left shadow-[0_8px_30px_-12px_rgba(15,23,42,0.1)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-14px_rgba(15,23,42,0.16)]"
      >
        <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
          <Link2 :size="22" :stroke-width="1.8" />
        </span>
        <h3 class="mt-4 text-lg font-semibold text-slate-900">Линк захиалга</h3>
        <p class="mt-1.5 text-body-sm text-slate-500">
          {{ linkOrder?.instructions || 'Захиалах бараанийхаа линкийг Facebook хуудсаар илгээгээд захиалуулаарай.' }}
        </p>
        <span class="mt-4 inline-flex items-center gap-1 text-body-sm font-semibold text-primary-600 group-hover:text-primary-700">
          Facebook-руу очих <ArrowUpRight :size="15" />
        </span>
      </NuxtLink>
    </div>

    <ServicesYuanTransferModal v-model="showYuanModal" :data="yuanTransfer" />
  </section>
</template>
