<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" @click.self="$emit('close')">
    <div class="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <div class="p-6">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-xl font-bold text-gray-900">
            {{ isEditing ? 'Хэрэглэгч засах' : 'Шинэ хэрэглэгч нэмэх' }}
          </h3>
          <button
            @click="$emit('close')"
            class="text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- First Name -->
            <div>
              <label for="firstname" class="block text-sm font-medium text-gray-700 mb-2">
                Нэр *
              </label>
              <input
                id="firstname"
                v-model="form.firstname"
                type="text"
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                :class="{ 'border-red-300 focus:ring-red-500 focus:border-red-500': errors.firstname }"
                placeholder="Нэр"
              />
              <p v-if="errors.firstname" class="mt-1 text-sm text-red-600">
                {{ errors.firstname }}
              </p>
            </div>

            <!-- Last Name -->
            <div>
              <label for="lastname" class="block text-sm font-medium text-gray-700 mb-2">
                Овог *
              </label>
              <input
                id="lastname"
                v-model="form.lastname"
                type="text"
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                :class="{ 'border-red-300 focus:ring-red-500 focus:border-red-500': errors.lastname }"
                placeholder="Овог"
              />
              <p v-if="errors.lastname" class="mt-1 text-sm text-red-600">
                {{ errors.lastname }}
              </p>
            </div>
          </div>

          <!-- Email -->
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
              Имэйл хаяг *
            </label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              required
              :disabled="isEditing"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
              :class="{ 'border-red-300 focus:ring-red-500 focus:border-red-500': errors.email }"
              placeholder="user@amarhan.mn"
            />
            <p v-if="errors.email" class="mt-1 text-sm text-red-600">
              {{ errors.email }}
            </p>
          </div>

          <!-- Password (only for new users) -->
          <div v-if="!isEditing">
            <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
              Нууц үг *
            </label>
            <div class="relative">
              <input
                id="password"
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                :class="{ 'border-red-300 focus:ring-red-500 focus:border-red-500': errors.password }"
                placeholder="••••••••"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <svg v-if="showPassword" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              </button>
            </div>
            <p v-if="errors.password" class="mt-1 text-sm text-red-600">
              {{ errors.password }}
            </p>
            <p class="mt-1 text-xs text-gray-500">
              Хамгийн багадаа 6 тэмдэгт байх ёстой
            </p>
          </div>

          <!-- Role -->
          <div>
            <label for="role" class="block text-sm font-medium text-gray-700 mb-2">
              Эрх *
            </label>
            <select
              id="role"
              v-model="form.role"
              required
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
              :class="{ 'border-red-300 focus:ring-red-500 focus:border-red-500': errors.role }"
            >
              <option value="user">Хэрэглэгч</option>
              <option value="manager">Менежер</option>
              <option value="admin">Админ</option>
            </select>
            <p v-if="errors.role" class="mt-1 text-sm text-red-600">
              {{ errors.role }}
            </p>
          </div>

          <!-- Active Status -->
          <div>
            <label class="flex items-center">
              <input
                v-model="form.active"
                type="checkbox"
                class="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span class="ml-2 text-sm font-medium text-gray-700">
                Идэвхтэй хэрэглэгч
              </span>
            </label>
          </div>

          <!-- Error Message -->
          <div v-if="errorMessage" class="rounded-lg bg-red-50 p-4">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm font-medium text-red-800">
                  {{ errorMessage }}
                </p>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              @click="$emit('close')"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
            >
              Цуцлах
            </button>
            <button
              type="submit"
              :disabled="loading"
              class="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg hover:from-primary-600 hover:to-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <span v-if="loading" class="flex items-center">
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Хадгалж байна...
              </span>
              <span v-else>{{ isEditing ? 'Хадгалах' : 'Нэмэх' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  user?: any
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  save: [userData: any]
}>()

const isEditing = computed(() => !!props.user)

const form = reactive({
  firstname: '',
  lastname: '',
  email: '',
  password: '',
  role: 'user',
  active: true
})

const errors = reactive({
  firstname: '',
  lastname: '',
  email: '',
  password: '',
  role: ''
})

const showPassword = ref(false)
const loading = ref(false)
const errorMessage = ref('')

// Initialize form when user prop changes
watch(() => props.user, (user) => {
  if (user) {
    form.firstname = user.firstname || user.firstName || ''
    form.lastname = user.lastname || user.lastName || ''
    form.email = user.email || ''
    form.role = user.role || 'user'
    form.active = user.active !== false
    form.password = ''
  } else {
    // Reset form for new user
    form.firstname = ''
    form.lastname = ''
    form.email = ''
    form.password = ''
    form.role = 'user'
    form.active = true
  }
}, { immediate: true })

const validateForm = () => {
  // Clear errors
  Object.keys(errors).forEach(key => {
    errors[key as keyof typeof errors] = ''
  })
  errorMessage.value = ''
  
  let isValid = true

  if (!form.firstname.trim()) {
    errors.firstname = 'Нэр оруулна уу'
    isValid = false
  }

  if (!form.lastname.trim()) {
    errors.lastname = 'Овог оруулна уу'
    isValid = false
  }

  if (!form.email.trim()) {
    errors.email = 'Имэйл хаяг оруулна уу'
    isValid = false
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Зөв имэйл хаяг оруулна уу'
    isValid = false
  }

  if (!isEditing.value) {
    if (!form.password) {
      errors.password = 'Нууц үг оруулна уу'
      isValid = false
    } else if (form.password.length < 6) {
      errors.password = 'Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой'
      isValid = false
    }
  }

  if (!form.role) {
    errors.role = 'Эрх сонгоно уу'
    isValid = false
  }

  return isValid
}

const handleSubmit = async () => {
  if (!validateForm()) {
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    // Debug: Log form values
    console.log('UserModal - form.password:', form.password)
    console.log('UserModal - isEditing:', isEditing.value)
    console.log('UserModal - form:', { ...form })

    const userData: any = {
      firstname: form.firstname.trim(),
      lastname: form.lastname.trim(),
      email: form.email.trim(),
      role: form.role,
      active: form.active
    }

    // Password is required for new users
    if (!isEditing.value) {
      // Trim password and ensure it's not empty
      const passwordValue = form.password || ''
      const trimmedPassword = passwordValue.trim()
      
      console.log('UserModal - password check:', {
        original: form.password,
        trimmed: trimmedPassword,
        isEmpty: !trimmedPassword
      })
      
      if (!trimmedPassword) {
        errors.password = 'Нууц үг оруулна уу'
        loading.value = false
        return
      }
      userData.password = trimmedPassword
    }
    // For editing, password is optional (only update if provided)

    console.log('UserModal - emitting userData:', userData)
    emit('save', userData)
  } catch (error: any) {
    console.error('Save error:', error)
    if (error.response?.data?.message) {
      errorMessage.value = error.response.data.message
    } else {
      errorMessage.value = 'Хадгалахад алдаа гарлаа. Дахин оролдоно уу.'
    }
  } finally {
    loading.value = false
  }
}
</script>

