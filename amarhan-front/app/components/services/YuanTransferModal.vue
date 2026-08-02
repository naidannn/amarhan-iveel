<script setup lang="ts">
import { Copy, Check, Facebook } from 'lucide-vue-next'

/**
 * Юань шилжүүлгийн зааврын попап — `content.yuan_transfer` (Тохиргоо > Туслах
 * үйлчилгээ, Админ засна). Систем дотор гүйлгээ БҮРТГЭХГҮЙ, зөвхөн харилцагчид
 * шилжүүлэг хэрхэн хийхийг харуулна — бодит гүйлгээ банк/Alipay/WeChat дээр
 * шууд хийгдэнэ.
 */
const props = defineProps<{
  modelValue: boolean
  data: {
    rate?: number | null
    bankAccount?: string
    accountHolder?: string
    transferNote?: string
    facebookUrl?: string
    instructions?: string
  } | null
}>()

defineEmits<{ 'update:modelValue': [value: boolean] }>()

const copied = ref(false)

const hasRate = computed(() => typeof props.data?.rate === 'number' && props.data.rate! > 0)

// Тооцоолуур — аль нэг талыг бичихэд нөгөөг нь шууд бодно. Ажиллах чиглэлийг
// (¥→₮ эсвэл ₮→¥) тусад нь тэмдэглэхийн оронд бодогдсон талыг шууд онооно —
// watcher ашиглавал хоёр тал бие биенээ дахин бодож хязгааргүй мөчлөгт орно.
const yuanAmount = ref<number | null>(null)
const mntAmount = ref<number | null>(null)

function setFromYuan(value: number | null) {
  yuanAmount.value = value
  mntAmount.value = value != null && hasRate.value ? Math.round(value * props.data!.rate!) : null
}

function setFromMnt(value: number | null) {
  mntAmount.value = value
  yuanAmount.value =
    value != null && hasRate.value ? Math.round((value / props.data!.rate!) * 100) / 100 : null
}

// Модал хаагдах бүрт тооцоолуур цэвэрлэгдэнэ — дараагийн удаа хуучин дүнтэй
// нээгдэх нь эргэлзээ төрүүлнэ (энэ ханшаар өмнө нь тооцсон гэж андуурна).
watch(
  () => props.modelValue,
  open => {
    if (!open) {
      yuanAmount.value = null
      mntAmount.value = null
    }
  }
)

async function copyAccount() {
  if (!props.data?.bankAccount) return
  try {
    await navigator.clipboard.writeText(props.data.bankAccount)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    // Clipboard эрх өгөөгүй — хэрэглэгч гараар сонгож хуулна
  }
}
</script>

<template>
  <UiModal
    :model-value="modelValue"
    title="Юань шилжүүлэг"
    subtitle="Хятад руу юань мөнгө шилжүүлэх заавар"
    size="sm"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="space-y-4">
      <div class="rounded-card border border-primary-100 bg-primary-50 px-4 py-3 text-center">
        <p class="text-body-sm text-primary-700">Өнөөдрийн ханш</p>
        <p class="mt-0.5 text-h3 font-bold tabular text-primary-800">
          <template v-if="data?.rate">1¥ = {{ data.rate.toLocaleString('mn-MN') }}₮</template>
          <template v-else>Удахгүй шинэчлэгдэнэ</template>
        </p>

        <div v-if="hasRate" class="mt-3 flex items-center gap-2 border-t border-primary-100 pt-3">
          <UiTextInput
            type="number"
            suffix="¥"
            placeholder="0"
            tabular
            :model-value="yuanAmount"
            @update:model-value="setFromYuan($event as number | null)"
          />
          <span class="shrink-0 text-body-sm text-primary-600">=</span>
          <UiTextInput
            type="number"
            suffix="₮"
            placeholder="0"
            tabular
            :model-value="mntAmount"
            @update:model-value="setFromMnt($event as number | null)"
          />
        </div>
      </div>

      <div class="rounded-card border border-surface-border p-4">
        <p class="text-body-sm text-content-secondary">Дансны дугаар</p>
        <div class="mt-1 flex items-center justify-between gap-3">
          <p class="break-all text-body font-semibold tabular text-content">
            {{ data?.bankAccount || '—' }}
          </p>
          <button
            type="button"
            class="flex shrink-0 items-center gap-1.5 rounded-full bg-surface-hover px-3 py-1.5 text-body-sm font-medium text-content-secondary transition-colors duration-200 hover:bg-surface-border"
            @click="copyAccount"
          >
            <component :is="copied ? Check : Copy" :size="13" />
            {{ copied ? 'Хуулагдлаа' : 'Хуулах' }}
          </button>
        </div>
        <p v-if="data?.accountHolder" class="mt-2 text-body-sm text-content-secondary">
          Хүлээн авагч: {{ data.accountHolder }}
        </p>
      </div>

      <div class="rounded-card border border-warning/30 bg-warning/10 p-4">
        <p class="text-body-sm text-content-secondary">Гуйлгээний утга</p>
        <p class="mt-0.5 text-h4 font-bold tabular text-content">{{ data?.transferNote || '—' }}</p>
        <p class="mt-1 text-body-sm text-content-secondary">
          Заавал энэ утгыг бичнэ үү — эс тэгвэл таны шилжүүлгийг олоход хугацаа алдана.
        </p>
      </div>

      <p v-if="data?.instructions" class="whitespace-pre-line text-body-sm text-content-secondary">
        {{ data.instructions }}
      </p>
    </div>

    <template v-if="data?.facebookUrl" #footer>
      <UiBtn
        block
        :icon="Facebook"
        :to="data.facebookUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        Facebook хуудсаар холбогдох
      </UiBtn>
    </template>
  </UiModal>
</template>

