<template>
  <div class="relative flex min-h-screen flex-col justify-center bg-gradient-to-br from-gray-50 to-gray-100 py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <div class="flex justify-center">
        <div class="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg">
          <span class="text-white font-bold text-2xl">A</span>
        </div>
      </div>
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
        Шинэ нууц үг
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        Шинэ нууц үгээ тохируулна уу
      </p>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-white py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-gray-100">
        <div v-if="!token" class="text-center">
          <p class="text-sm text-gray-700">Холбоос буруу байна. Сэргээх хүсэлтээ дахин илгээнэ үү.</p>
          <NuxtLink to="/admin/forgot-password" class="mt-6 inline-block text-sm font-medium text-primary-600 hover:text-primary-700">
            Дахин илгээх
          </NuxtLink>
        </div>

        <div v-else-if="done" class="text-center">
          <p class="text-sm text-gray-700">Нууц үг амжилттай солигдлоо.</p>
          <NuxtLink to="/admin/login" class="mt-6 inline-block text-sm font-medium text-primary-600 hover:text-primary-700">
            Нэвтрэх
          </NuxtLink>
        </div>

        <form v-else class="space-y-6" @submit.prevent="handleSubmit">
          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
              Шинэ нууц үг
            </label>
            <input
              id="password"
              v-model="password"
              name="password"
              type="password"
              autocomplete="new-password"
              required
              class="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-all duration-200"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-2">
              Нууц үг давтах
            </label>
            <input
              id="confirmPassword"
              v-model="confirmPassword"
              name="confirmPassword"
              type="password"
              autocomplete="new-password"
              required
              class="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-all duration-200"
              :class="{ 'border-red-300 focus:ring-red-500 focus:border-red-500': errorMessage }"
              placeholder="••••••••"
            />
          </div>

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

          <div>
            <button
              type="submit"
              :disabled="loading || !canSubmit"
              class="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <span v-if="loading" class="flex items-center">
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Хадгалж байна...
              </span>
              <span v-else>Нууц үг солих</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <footer class="absolute inset-x-0 bottom-5 text-center">
      <DeveloperCredit />
    </footer>
  </div>
</template>

<script setup>
definePageMeta({
  layout: false
})

const authStore = useAuthStore()
const route = useRoute()

const token = computed(() => String(route.query.token ?? ''))
const password = ref('')
const confirmPassword = ref('')
const done = ref(false)
const loading = ref(false)
const errorMessage = ref('')

const canSubmit = computed(
  () => password.value.length >= 8 && password.value === confirmPassword.value
)

const handleSubmit = async () => {
  errorMessage.value = ''

  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Нууц үг таарахгүй байна'
    return
  }

  loading.value = true
  try {
    await authStore.resetPassword(token.value, password.value)
    done.value = true
  } catch (error) {
    errorMessage.value =
      error?.response?.data?.message ?? 'Нууц үг сэргээхэд алдаа гарлаа. Дахин оролдоно уу.'
  } finally {
    loading.value = false
  }
}
</script>
