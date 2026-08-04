<template>
  <div class="relative flex min-h-screen flex-col justify-center bg-gradient-to-br from-gray-50 to-gray-100 py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <div class="flex justify-center">
        <div class="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg">
          <span class="text-white font-bold text-2xl">A</span>
        </div>
      </div>
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
        Нууц үг сэргээх
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        Бүртгэлтэй имэйл хаягаа оруулна уу, сэргээх холбоос илгээх болно
      </p>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-white py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-gray-100">
        <div v-if="sent" class="text-center">
          <p class="text-sm text-gray-700">
            Хэрэв энэ имэйл бүртгэлтэй бол сэргээх холбоос илгээгдлээ. Имэйлээ шалгана уу.
          </p>
          <NuxtLink to="/admin/login" class="mt-6 inline-block text-sm font-medium text-primary-600 hover:text-primary-700">
            Нэвтрэх хуудас руу буцах
          </NuxtLink>
        </div>

        <form v-else class="space-y-6" @submit.prevent="handleSubmit">
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
              Имэйл хаяг
            </label>
            <div class="mt-1">
              <input
                id="email"
                v-model="email"
                name="email"
                type="email"
                autocomplete="email"
                required
                class="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-all duration-200"
                :class="{ 'border-red-300 focus:ring-red-500 focus:border-red-500': errorMessage }"
                placeholder="admin@amarhan.mn"
              />
            </div>
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
              :disabled="loading || !email"
              class="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <span v-if="loading" class="flex items-center">
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Илгээж байна...
              </span>
              <span v-else>Сэргээх холбоос илгээх</span>
            </button>
          </div>

          <p class="text-center text-sm text-gray-600">
            <NuxtLink to="/admin/login" class="font-medium text-primary-600 hover:text-primary-700">
              Нэвтрэх хуудас руу буцах
            </NuxtLink>
          </p>
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

const email = ref('')
const sent = ref(false)
const loading = ref(false)
const errorMessage = ref('')

const handleSubmit = async () => {
  errorMessage.value = ''
  loading.value = true

  try {
    await authStore.forgotPassword(email.value.trim())
    sent.value = true
  } catch (error) {
    errorMessage.value =
      error?.response?.data?.message ?? 'Хүсэлт илгээхэд алдаа гарлаа. Дахин оролдоно уу.'
  } finally {
    loading.value = false
  }
}
</script>
