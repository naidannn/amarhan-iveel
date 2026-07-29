<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="closeModal">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
      <div class="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
        <h2 class="text-xl font-bold text-gray-900">
          {{ project ? 'Төсөл өөрчлөх' : 'Шинэ төсөл үүсгэх' }}
        </h2>
        <button
          @click="closeModal"
          class="text-gray-400 hover:text-gray-600"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Төслийн нэр *
          </label>
          <input
            v-model="form.name"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Төслийн нэр"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Зорилго
          </label>
          <input
            v-model="form.goal"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Төслийн зорилго"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Тайлбар
          </label>
          <textarea
            v-model="form.description"
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Төслийн тайлбар"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Менежер *
            </label>
            <select
              v-model="form.manager"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Сонгоно уу...</option>
              <option v-for="user in users" :key="user._id" :value="user._id">
                {{ user.firstname }} {{ user.lastname }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Хэлтэс
            </label>
            <input
              v-model="form.department"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Хэлтэс"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Эхлэх огноо *
            </label>
            <input
              v-model="form.start_date"
              type="date"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Дуусах огноо *
            </label>
            <input
              v-model="form.end_date"
              type="date"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Төсөв (Дүн)
            </label>
            <input
              v-model.number="form.budget.amount"
              type="number"
              min="0"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="0"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Валют
            </label>
            <select
              v-model="form.budget.currency"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="MNT">MNT</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="CNY">CNY</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Статус
            </label>
            <select
              v-model="form.status"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="planning">Төлөвлөж байна</option>
              <option value="active">Идэвхтэй</option>
              <option value="on_hold">Түдгэлзсэн</option>
              <option value="completed">Дууссан</option>
              <option value="cancelled">Цуцлагдсан</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Түвшин
            </label>
            <select
              v-model="form.priority"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="low">Бага</option>
              <option value="medium">Дунд</option>
              <option value="high">Өндөр</option>
              <option value="urgent">Яаралтай</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Багийн гишүүд
          </label>
          <select
            v-model="form.team_members"
            multiple
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option v-for="user in users" :key="user._id" :value="user._id">
              {{ user.firstname }} {{ user.lastname }}
            </option>
          </select>
          <p class="text-xs text-gray-500 mt-1">Олон сонгохын тулд Ctrl (Windows) эсвэл Cmd (Mac) товч дараарай</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Тэмдэглэл
          </label>
          <textarea
            v-model="form.notes"
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Тэмдэглэл"
          />
        </div>
      </div>

      <div class="flex justify-end gap-3 p-6 border-t sticky bottom-0 bg-white">
        <button
          @click="closeModal"
          class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Цуцлах
        </button>
        <button
          @click="handleSave"
          :disabled="saving"
          class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {{ saving ? 'Хадгалж байна...' : 'Хадгалах' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  project?: any
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const pm = useProjectManagement()
const { $axios } = useNuxtApp()

const isOpen = ref(true)
const saving = ref(false)
const users = ref<any[]>([])

const form = ref({
  name: '',
  description: '',
  goal: '',
  manager: '',
  team_members: [] as string[],
  department: '',
  start_date: '',
  end_date: '',
  budget: {
    amount: 0,
    currency: 'MNT'
  },
  status: 'planning',
  priority: 'medium',
  notes: ''
})

const loadUsers = async () => {
  try {
    const response = await $axios.get('/api/v1/users', { params: { limit: 100 } })
    users.value = response.data.data || response.data || []
  } catch (error) {
    console.error('Failed to load users:', error)
  }
}

const closeModal = () => {
  isOpen.value = false
  emit('close')
}

const handleSave = async () => {
  if (!form.value.name || !form.value.manager || !form.value.start_date || !form.value.end_date) {
    alert('Бүх шаардлагатай талбаруудыг бөглөнө үү')
    return
  }

  try {
    saving.value = true
    const data = {
      ...form.value,
      start_date: new Date(form.value.start_date).toISOString(),
      end_date: new Date(form.value.end_date).toISOString()
    }

    if (props.project) {
      await pm.updateProject(props.project._id, data)
    } else {
      await pm.createProject(data)
    }

    emit('saved')
    closeModal()
  } catch (error: any) {
    console.error('Failed to save project:', error)
    alert(error.response?.data?.message || 'Төсөл хадгалахад алдаа гарлаа')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadUsers()
  if (props.project) {
    form.value = {
      name: props.project.name || '',
      description: props.project.description || '',
      goal: props.project.goal || '',
      manager: props.project.manager?._id || props.project.manager || '',
      team_members: props.project.team_members?.map((m: any) => m._id || m) || [],
      department: props.project.department || '',
      start_date: props.project.start_date ? new Date(props.project.start_date).toISOString().split('T')[0] : '',
      end_date: props.project.end_date ? new Date(props.project.end_date).toISOString().split('T')[0] : '',
      budget: props.project.budget || { amount: 0, currency: 'MNT' },
      status: props.project.status || 'planning',
      priority: props.project.priority || 'medium',
      notes: props.project.notes || ''
    }
  }
})
</script>

