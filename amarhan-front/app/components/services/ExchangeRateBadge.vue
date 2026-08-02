<script setup lang="ts">
import { Banknote } from 'lucide-vue-next'

/**
 * Header дээр байнга харагдах юанийн ханшийн богино тэмдэглэгээ.
 * Дарахад `content.yuan_transfer`-ийн бүрэн заавар (данс, гуйлгээний утга,
 * Facebook холбоос) попупоор нээгдэнэ — header дэх зай хязгаартай тул
 * бүрэн мэдээллийг энд БИШ, попупоор үзүүлнэ.
 */
const props = defineProps<{
  data: {
    rate?: number | null
    bankAccount?: string
    accountHolder?: string
    transferNote?: string
    facebookUrl?: string
    instructions?: string
  } | null
}>()

const show = ref(false)
const hasRate = computed(() => typeof props.data?.rate === 'number' && props.data.rate > 0)
</script>

<template>
  <span v-if="hasRate" class="inline-flex shrink-0 items-center">
    <button
      type="button"
      class="flex items-center gap-1.5 rounded-full border border-primary-100 bg-primary-50 px-3 py-1.5 text-body-sm font-semibold text-primary-700 transition-colors duration-200 hover:bg-primary-100"
      @click="show = true"
    >
      <Banknote :size="14" :stroke-width="2.2" />
      <span class="tabular">1¥ = {{ data!.rate!.toLocaleString('mn-MN') }}₮</span>
    </button>

    <ServicesYuanTransferModal v-model="show" :data="data" />
  </span>
</template>
