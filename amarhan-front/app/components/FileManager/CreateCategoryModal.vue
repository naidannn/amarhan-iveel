<template>
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-lg shadow-xl max-w-sm w-full">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-slate-200">
        <h2 class="text-xl font-bold text-slate-900">Ангилал үүсгэх</h2>
        <button @click="$emit('close')" class="text-slate-500 hover:text-slate-700">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Body -->
      <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
        <!-- Name -->
        <div>
          <label for="name" class="block text-sm font-medium text-slate-700 mb-2">Ангилалын нэр *</label>
          <input
            id="name"
            v-model="formData.name"
            type="text"
            class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="жишээ: Гэрээ, Тушаал, Тайлан"
            required
          />
        </div>

        <!-- Description -->
        <div>
          <label for="description" class="block text-sm font-medium text-slate-700 mb-2">Тайлбар</label>
          <textarea
            id="description"
            v-model="formData.description"
            rows="2"
            class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Ангилалын тайлбар..."
          ></textarea>
        </div>

        <!-- Color -->
        <div>
          <label for="color" class="block text-sm font-medium text-slate-700 mb-2">Өнгө</label>
          <div class="flex gap-2">
            <div class="flex-1 relative">
              <input
                id="color"
                v-model="formData.color"
                type="color"
                class="w-full h-10 rounded-lg border border-slate-300 cursor-pointer"
              />
            </div>
            <div class="px-4 py-2 bg-slate-100 rounded-lg flex items-center">
              <div
                class="w-6 h-6 rounded"
                :style="{ backgroundColor: formData.color }"
              ></div>
              <span class="ml-2 text-sm text-slate-600">{{ formData.color }}</span>
            </div>
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
            :disabled="!formData.name || isLoading"
            class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
          >
            <span v-if="isLoading" class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            {{ isLoading ? 'Үүсгэж байна...' : 'Үүсгэх' }}
          </button>
        </div>
      </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['create', 'close'])

const isLoading = ref(false)

const formData = ref({
  name: '',
  description: '',
  color: '#3B82F6',
})

const handleSubmit = () => {
  if (!formData.value.name) return

  isLoading.value = true
  emit('create', {
    name: formData.value.name,
    description: formData.value.description,
    color: formData.value.color,
  })

  setTimeout(() => {
    isLoading.value = false
  }, 1000)
}
</script>

