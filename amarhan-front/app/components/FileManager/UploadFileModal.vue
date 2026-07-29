<template>
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-lg shadow-xl max-w-lg w-full">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-slate-200">
        <h2 class="text-xl font-bold text-slate-900">Файл байршуулах</h2>
        <button @click="$emit('close')" class="text-slate-500 hover:text-slate-700">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Body -->
      <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
        <!-- File Upload -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">Файл сонгох</label>
          <div
            @drop="handleDrop"
            @dragover.prevent="isDragOver = true"
            @dragleave="isDragOver = false"
            :class="[
              'relative border-2 border-dashed rounded-lg p-8 text-center transition-colors',
              isDragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-slate-400',
            ]"
          >
            <input
              type="file"
              ref="fileInput"
              @change="handleFileSelect"
              class="hidden"
              accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.txt,.csv,.pptx"
            />

            <svg v-if="!selectedFile" class="w-12 h-12 mx-auto text-slate-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>

            <div v-if="!selectedFile" class="mb-3">
              <p class="text-slate-900 font-medium">Файлыг сүүлүүлэх эсвэл <button type="button" @click="$refs.fileInput.click()" class="text-blue-600 hover:text-blue-700 font-semibold">сонгох</button></p>
              <p class="text-xs text-slate-500 mt-1">PDF, DOCX, XLSX, JPG, PNG, CSV, PPTX (max 50MB)</p>
            </div>

            <div v-else class="space-y-3">
              <div class="flex items-center justify-center gap-3">
                <svg class="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p class="font-medium text-slate-900">{{ selectedFile.name }}</p>
                  <p class="text-xs text-slate-500">{{ formatFileSize(selectedFile.size) }}</p>
                </div>
              </div>
              <button
                type="button"
                @click="selectedFile = null"
                class="text-sm text-slate-600 hover:text-slate-900 font-medium"
              >
                Өөр файл сонгох
              </button>
            </div>
          </div>
        </div>

        <!-- Category -->
        <div>
          <label for="category" class="block text-sm font-medium text-slate-700 mb-2">Ангилал *</label>
          <select
            id="category"
            v-model="formData.categoryId"
            class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Ангилал сонгоно уу</option>
            <option v-for="cat in categories" :key="cat._id" :value="cat._id">
              {{ cat.name }}
            </option>
          </select>
        </div>

        <!-- File Name -->
        <div>
          <label for="fileName" class="block text-sm font-medium text-slate-700 mb-2">Файлын нэр *</label>
          <input
            id="fileName"
            v-model="formData.fileName"
            type="text"
            class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="жишээ: Нууц хадгалах гэрээ"
            required
          />
        </div>

        <!-- File Date -->
        <div>
          <label for="fileDate" class="block text-sm font-medium text-slate-700 mb-2">Файлын огноо *</label>
          <input
            id="fileDate"
            v-model="formData.fileDate"
            type="date"
            class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <!-- Description -->
        <div>
          <label for="description" class="block text-sm font-medium text-slate-700 mb-2">Тайлбар</label>
          <textarea
            id="description"
            v-model="formData.description"
            rows="3"
            class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Файлын тайлбар..."
          ></textarea>
        </div>

        <!-- Tags -->
        <div>
          <label for="tags" class="block text-sm font-medium text-slate-700 mb-2">Tags</label>
          <div class="flex flex-wrap gap-2 mb-2">
            <span
              v-for="(tag, index) in formData.tags"
              :key="index"
              class="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-2"
            >
              {{ tag }}
              <button type="button" @click="formData.tags.splice(index, 1)" class="text-blue-700 hover:text-blue-900">
                ✕
              </button>
            </span>
          </div>
          <div class="flex gap-2">
            <input
              id="tags"
              v-model="tagInput"
              @keyup.enter="addTag"
              type="text"
              class="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Tag нэмэх (Enter дарана уу)"
            />
            <button type="button" @click="addTag" class="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors">
              Нэмэх
            </button>
          </div>
        </div>

        <!-- Buttons -->
        <div class="flex gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            @click="$emit('close')"
            class="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
          >
            Хаах
          </button>
          <button
            type="submit"
            :disabled="!selectedFile || !formData.categoryId || !formData.fileName || !formData.fileDate || isLoading"
            class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
          >
            <span v-if="isLoading" class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            {{ isLoading ? 'Байршуулж байна...' : 'Байршуулах' }}
          </button>
        </div>
      </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  categories: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['upload', 'close'])

const selectedFile = ref(null)
const isDragOver = ref(false)
const isLoading = ref(false)
const tagInput = ref('')
const fileInput = ref(null)

const formData = ref({
  categoryId: '',
  fileName: '',
  fileDate: new Date().toISOString().split('T')[0],
  description: '',
  tags: [],
})

const handleDrop = (e) => {
  isDragOver.value = false
  const files = e.dataTransfer?.files
  if (files?.length) {
    selectedFile.value = files[0]
  }
}

const handleFileSelect = (e) => {
  const files = e.target.files
  if (files?.length) {
    selectedFile.value = files[0]
  }
}

const addTag = () => {
  if (tagInput.value.trim() && !formData.value.tags.includes(tagInput.value.trim())) {
    formData.value.tags.push(tagInput.value.trim())
    tagInput.value = ''
  }
}

const handleSubmit = () => {
  if (!selectedFile.value || !formData.value.categoryId || !formData.value.fileName || !formData.value.fileDate) return

  isLoading.value = true
  emit('upload', {
    file: selectedFile.value,
    categoryId: formData.value.categoryId,
    fileName: formData.value.fileName,
    fileDate: formData.value.fileDate,
    description: formData.value.description,
    tags: formData.value.tags,
  })

  setTimeout(() => {
    isLoading.value = false
  }, 1000)
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}
</script>

