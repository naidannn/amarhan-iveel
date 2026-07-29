<template>
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-lg shadow-xl max-w-lg w-full">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-slate-200">
        <div>
          <h2 class="text-xl font-bold text-slate-900">Файл хуваалцах</h2>
          <p class="text-sm text-slate-600 mt-1">{{ file.original_file_name }}</p>
        </div>
        <button @click="$emit('close')" class="text-slate-500 hover:text-slate-700">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Body -->
      <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
        <!-- Share Type Tabs -->
        <div class="flex border-b border-slate-200">
          <button
            type="button"
            @click="shareType = 'link'"
            :class="[
              'px-4 py-2 font-medium border-b-2 transition-colors',
              shareType === 'link'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900',
            ]"
          >
            Хуваалцах Линк
          </button>
          <button
            type="button"
            @click="shareType = 'user'"
            :class="[
              'px-4 py-2 font-medium border-b-2 transition-colors',
              shareType === 'user'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900',
            ]"
          >
            Ажилтантай хуваалцах
          </button>
        </div>

        <!-- Share Link Tab -->
        <div v-if="shareType === 'link'" class="space-y-4">
          <!-- Access Level -->
          <div>
            <label for="access-level" class="block text-sm font-medium text-slate-700 mb-2">Хандалтын эрх</label>
            <select
              id="access-level"
              v-model="linkData.accessLevel"
              class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="view">Зөвхөн харах</option>
              <option value="download">Татаж авах боломжтой</option>
            </select>
            <p class="text-xs text-slate-500 mt-1">
              <span v-if="linkData.accessLevel === 'view'">👁️ Зөвхөн файлыг нэгэн харах боломж олгоно</span>
              <span v-else>⬇️ Файлыг татаж авах боломж олгоно</span>
            </p>
          </div>

          <!-- Expiration -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="expires-date" class="block text-sm font-medium text-slate-700 mb-2">Хугацааны эцэс</label>
              <input
                id="expires-date"
                v-model="linkData.expiresDate"
                type="date"
                class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label for="max-views" class="block text-sm font-medium text-slate-700 mb-2">Хамгийн их үзэлт</label>
              <input
                id="max-views"
                v-model="linkData.maxViews"
                type="number"
                min="1"
                class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Хязгаарлахгүй"
              />
            </div>
          </div>

          <!-- Share Button -->
          <button
            type="submit"
            class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            🔗 Хуваалцах линк үүсгэх
          </button>

          <!-- Info -->
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p class="text-sm text-blue-900">
              💡 Линкийг хүний аль ч хэн авалгүйгээр нээх боломжтой. Хэнийг нэгэнт хандуулахыг хүсвэл "Ажилтантай хуваалцах" эрхгүй сонгоно уу.
            </p>
          </div>
        </div>

        <!-- Share with User Tab -->
        <div v-else class="space-y-4">
          <!-- User Search -->
          <div>
            <label for="user-search" class="block text-sm font-medium text-slate-700 mb-2">Ажилтан сонгох</label>
            <input
              id="user-search"
              v-model="userSearch"
              type="text"
              class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ажилтаны нэр эсвэл имэйл хайх..."
            />
          </div>

          <!-- User Results (Mock) -->
          <div class="border border-slate-200 rounded-lg">
            <div
              v-for="user in filteredUsers"
              :key="user.id"
              class="p-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 cursor-pointer"
              @click="selectUser(user)"
            >
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium text-slate-900">{{ user.name }}</p>
                  <p class="text-xs text-slate-500">{{ user.email }}</p>
                </div>
                <input
                  type="checkbox"
                  :checked="userData.selectedUsers.includes(user.id)"
                  class="w-4 h-4 rounded"
                />
              </div>
            </div>
          </div>

          <!-- Access Level for Users -->
          <div>
            <label for="user-access-level" class="block text-sm font-medium text-slate-700 mb-2">Хандалтын эрх</label>
            <select
              id="user-access-level"
              v-model="userData.accessLevel"
              class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="view">👁️ Зөвхөн харах</option>
              <option value="download">⬇️ Татаж авах</option>
              <option value="edit">✏️ Засах</option>
            </select>
          </div>

          <!-- Share Button -->
          <button
            type="submit"
            :disabled="userData.selectedUsers.length === 0"
            class="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            👥 {{ userData.selectedUsers.length }} хүнийг хуваалцах
          </button>
        </div>

        <!-- Close Button -->
        <div class="flex gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            @click="$emit('close')"
            class="w-full px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
          >
            Хаах
          </button>
        </div>
      </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  file: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['share', 'close'])

// Mock users (replace with actual API call)
const mockUsers = [
  { id: '1', name: 'Баярж Батгэрэл', email: 'bayarjb@company.com' },
  { id: '2', name: 'Оюун Энхбат', email: 'oyun@company.com' },
  { id: '3', name: 'Туяа Болор', email: 'tuyaa@company.com' },
  { id: '4', name: 'Жаргал Сүрэндамба', email: 'jargal@company.com' },
  { id: '5', name: 'Саранцэцэг Мөнхбат', email: 'sarantsetseg@company.com' },
]

const shareType = ref('link')
const userSearch = ref('')
const isLoading = ref(false)

const linkData = ref({
  accessLevel: 'download',
  expiresDate: '',
  maxViews: null,
})

const userData = ref({
  selectedUsers: [],
  accessLevel: 'view',
})

const filteredUsers = computed(() => {
  const query = userSearch.value.toLowerCase()
  return mockUsers.filter(
    (user) =>
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
  )
})

const selectUser = (user) => {
  const index = userData.value.selectedUsers.indexOf(user.id)
  if (index > -1) {
    userData.value.selectedUsers.splice(index, 1)
  } else {
    userData.value.selectedUsers.push(user.id)
  }
}

const handleSubmit = async () => {
  isLoading.value = true

  try {
    if (shareType.value === 'link') {
      emit('share', {
        fileId: props.file._id,
        accessLevel: linkData.value.accessLevel,
        expiresAt: linkData.value.expiresDate ? new Date(linkData.value.expiresDate) : null,
        maxViews: linkData.value.maxViews ? parseInt(linkData.value.maxViews) : null,
      })
    } else {
      emit('share', {
        fileId: props.file._id,
        users: userData.value.selectedUsers,
        accessLevel: userData.value.accessLevel,
      })
    }

    setTimeout(() => {
      isLoading.value = false
    }, 1000)
  } catch (error) {
    isLoading.value = false
    console.error('Error sharing file:', error)
  }
}
</script>

