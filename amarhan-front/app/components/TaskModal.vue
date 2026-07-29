<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="closeModal">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
      <div class="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
        <h2 class="text-xl font-bold text-gray-900">
          {{ task ? 'Даалгавар өөрчлөх' : 'Шинэ даалгавар үүсгэх' }}
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
            Гарчиг *
          </label>
          <input
            v-model="form.title"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Даалгаврын гарчиг"
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
            placeholder="Даалгаврын тайлбар"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Төсөл
            </label>
            <select
              v-model="form.project"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Төсөлгүй</option>
              <option v-for="project in projects" :key="project._id" :value="project._id">
                {{ project.name }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Ангилал
            </label>
            <select
              v-model="form.category"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="marketing">Маркетинг</option>
              <option value="finance">Санхүү</option>
              <option value="sales">Борлуулалт</option>
              <option value="development">Хөгжүүлэлт</option>
              <option value="hr">Хүний нөөц</option>
              <option value="operations">Үйл ажиллагаа</option>
              <option value="other">Бусад</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Хуваарилагдсан *
            </label>
            <select
              v-model="form.assigned_to"
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
              Статус
            </label>
            <select
              v-model="form.status"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="not_started">Хийгдээгүй</option>
              <option value="in_progress">Явцтай</option>
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

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Эхлэх огноо
            </label>
            <input
              v-model="form.start_date"
              type="date"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Эцсийн хугацаа
            </label>
            <input
              v-model="form.due_date"
              type="date"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Тооцоолсон цаг
            </label>
            <input
              v-model.number="form.estimated_hours"
              type="number"
              min="0"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="0"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Гүйцэтгэл (%)
            </label>
            <input
              v-model.number="form.progress"
              type="number"
              min="0"
              max="100"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="0"
            />
          </div>
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
  task?: any
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
const projects = ref<any[]>([])

const form = ref({
  title: '',
  description: '',
  project: '',
  category: 'other',
  status: 'not_started',
  priority: 'medium',
  assigned_to: '',
  department: '',
  start_date: '',
  due_date: '',
  progress: 0,
  estimated_hours: 0
})

const loadUsers = async () => {
  try {
    const response = await $axios.get('/api/v1/users', { params: { limit: 100 } })
    users.value = response.data.data || response.data || []
  } catch (error) {
    console.error('Failed to load users:', error)
  }
}

const loadProjects = async () => {
  try {
    const response = await pm.getProjects({ limit: 100 })
    projects.value = response.data || []
  } catch (error) {
    console.error('Failed to load projects:', error)
  }
}

const closeModal = () => {
  isOpen.value = false
  emit('close')
}

const handleSave = async () => {
  if (!form.value.title || !form.value.assigned_to) {
    alert('Бүх шаардлагатай талбаруудыг бөглөнө үү')
    return
  }

  try {
    saving.value = true
    const data: any = { ...form.value }
    
    if (data.start_date) {
      data.start_date = new Date(data.start_date).toISOString()
    }
    if (data.due_date) {
      data.due_date = new Date(data.due_date).toISOString()
    }
    if (!data.project) {
      delete data.project
    }

    if (props.task) {
      await pm.updateTask(props.task._id, data)
    } else {
      await pm.createTask(data)
    }

    emit('saved')
    closeModal()
  } catch (error: any) {
    console.error('Failed to save task:', error)
    alert(error.response?.data?.message || 'Даалгавар хадгалахад алдаа гарлаа')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadUsers()
  loadProjects()
  if (props.task) {
    form.value = {
      title: props.task.title || '',
      description: props.task.description || '',
      project: props.task.project?._id || props.task.project || '',
      category: props.task.category || 'other',
      status: props.task.status || 'not_started',
      priority: props.task.priority || 'medium',
      assigned_to: props.task.assigned_to?._id || props.task.assigned_to || '',
      department: props.task.department || '',
      start_date: props.task.start_date ? new Date(props.task.start_date).toISOString().split('T')[0] : '',
      due_date: props.task.due_date ? new Date(props.task.due_date).toISOString().split('T')[0] : '',
      progress: props.task.progress || 0,
      estimated_hours: props.task.estimated_hours || 0
    }
  }
})
</script>

