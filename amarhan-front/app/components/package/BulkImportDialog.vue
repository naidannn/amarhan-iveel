<script setup lang="ts">
import { FileSpreadsheet, ClipboardPaste, Download, AlertTriangle, CheckCircle2 } from 'lucide-vue-next'
import {
  parseExcelFile,
  parsePastedText,
  rowsFromMatrix,
  downloadSampleWorkbook,
  type ParsedImportRow,
} from '~/utils/packageBulkImport'

/**
 * "Ачаа олноор бүртгэх" хуудасны Excel/paste импорт цонх — ЭНД ачаа шууд
 * ҮҮСГЭХГҮЙ, зөвхөн `bulk.vue`-ийн мөрийн хүснэгтийг бөглөнө (ажилтан хараад
 * шалгаад "Бүгдийг бүртгэх" дарна — одоогийн validate/submit урсгал хэвээр).
 */
const props = defineProps<{ modelValue: boolean }>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  apply: [rows: ParsedImportRow[]]
}>()

type Tab = 'file' | 'paste'

const tab = ref<Tab>('file')
const pasteText = ref('')
const fileName = ref('')
const parsing = ref(false)
const parseError = ref<string | null>(null)
const result = ref<{ rows: ParsedImportRow[]; skippedCount: number } | null>(null)

watch(
  () => props.modelValue,
  open => {
    if (!open) return
    tab.value = 'file'
    pasteText.value = ''
    fileName.value = ''
    parseError.value = null
    result.value = null
  }
)

function setTab(next: Tab) {
  tab.value = next
  parseError.value = null
  result.value = null
}

async function onFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  fileName.value = file.name
  parsing.value = true
  parseError.value = null
  result.value = null
  try {
    const matrix = await parseExcelFile(file)
    applyMatrix(matrix)
  } catch {
    parseError.value = 'Файлыг уншиж чадсангүй — .xlsx эсвэл .xls файл сонгоно уу'
  } finally {
    parsing.value = false
  }
}

function onPasteInput() {
  parseError.value = null
  if (!pasteText.value.trim()) {
    result.value = null
    return
  }
  applyMatrix(parsePastedText(pasteText.value))
}

function applyMatrix(matrix: (string | number)[][]) {
  const parsed = rowsFromMatrix(matrix)
  if (parsed.missingRequiredColumn) {
    parseError.value = '"Ачааны дугаар" баганыг олсонгүй — sample загвар файлын толгойн нэрийг ашиглана уу'
    result.value = null
    return
  }
  if (parsed.rows.length === 0) {
    parseError.value = 'Ачааны дугаартай мөр олдсонгүй'
    result.value = null
    return
  }
  result.value = { rows: parsed.rows, skippedCount: parsed.skippedCount }
}

async function downloadSample() {
  await downloadSampleWorkbook()
}

function apply() {
  if (!result.value?.rows.length) return
  emit('apply', result.value.rows)
  close()
}

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <UiModal
    :model-value="modelValue"
    title="Excel-с оруулах"
    subtitle="Sample загвар файлын дагуу бэлдсэн датагаа файлаар оруулах эсвэл шууд хуулж буулгах боломжтой"
    size="lg"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="space-y-4">
      <UiBtn variant="secondary" size="sm" :icon="Download" @click="downloadSample">
        Sample загвар татах
      </UiBtn>

      <div class="flex gap-2 border-b border-surface-border">
        <button
          type="button"
          class="flex items-center gap-1.5 border-b-2 px-3 pb-2 text-body-sm font-medium transition-colors duration-200"
          :class="tab === 'file' ? 'border-primary text-primary' : 'border-transparent text-content-secondary hover:text-content'"
          @click="setTab('file')"
        >
          <FileSpreadsheet :size="15" />
          Файл сонгох
        </button>
        <button
          type="button"
          class="flex items-center gap-1.5 border-b-2 px-3 pb-2 text-body-sm font-medium transition-colors duration-200"
          :class="tab === 'paste' ? 'border-primary text-primary' : 'border-transparent text-content-secondary hover:text-content'"
          @click="setTab('paste')"
        >
          <ClipboardPaste :size="15" />
          Хуулж буулгах
        </button>
      </div>

      <div v-if="tab === 'file'">
        <label
          class="flex cursor-pointer flex-col items-center gap-2 rounded-card border-2 border-dashed border-surface-border px-4 py-8 text-center transition-colors duration-200 hover:border-primary-300"
        >
          <FileSpreadsheet :size="24" class="text-content-disabled" />
          <span class="text-body-sm font-medium text-primary-600">
            {{ fileName || 'Excel файл сонгох (.xlsx, .xls)' }}
          </span>
          <input type="file" accept=".xlsx,.xls" class="hidden" @change="onFileChange" />
        </label>
      </div>

      <div v-else>
        <UiTextArea
          v-model="pasteText"
          :rows="8"
          :maxlength="50000"
          placeholder="Excel хүснэгтээсээ мөрүүдээ хуулаад энд буулгана уу (толгой мөртэй хамт)"
          @update:model-value="onPasteInput"
        />
      </div>

      <p v-if="parsing" class="text-body-sm text-content-secondary">Уншиж байна…</p>

      <p v-if="parseError" class="flex items-center gap-1.5 text-body-sm text-error">
        <AlertTriangle :size="14" class="shrink-0" />
        {{ parseError }}
      </p>

      <div v-else-if="result" class="flex items-start gap-1.5 rounded-card bg-primary-50 px-3 py-2.5 text-body-sm text-primary-700">
        <CheckCircle2 :size="15" class="mt-0.5 shrink-0" />
        <span>
          {{ result.rows.length }} мөр олдлоо.
          <template v-if="result.skippedCount > 0">
            {{ result.skippedCount }} мөрийг ачааны дугаар байхгүй тул алгаслаа.
          </template>
        </span>
      </div>
    </div>

    <template #footer>
      <UiBtn variant="ghost" @click="close">Болих</UiBtn>
      <UiBtn :disabled="!result?.rows.length" @click="apply">
        {{ result?.rows.length ? `${result.rows.length} мөр оруулах` : 'Оруулах' }}
      </UiBtn>
    </template>
  </UiModal>
</template>
