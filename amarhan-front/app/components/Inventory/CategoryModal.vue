<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
      <div class="flex justify-between items-center p-6 border-b">
        <h2 class="text-xl font-bold text-gray-900">
          {{ isEdit ? 'Ангилал өөрчлөх' : 'Ангилал үүсгэх' }}
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
            Ангиллын нэр *
          </label>
          <input
            v-model="form.name"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Жнь: Эрүүл мэнд"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Ангиллын код *
          </label>
          <input
            v-model="form.code"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Жнь: HEALTH"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Төрөл *
          </label>
          <select
            v-model="form.type"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Сонгоно уу...</option>
            <option value="PRODUCT">Бараа</option>
            <option value="RAW_MATERIAL">Түүхий эд</option>
            <option value="FINISHED_GOOD">Бэлэн бүтээгдэхүүн</option>
            <option value="OTHER">Бусад</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Тайлбар
          </label>
          <textarea
            v-model="form.description"
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Ангиллын тайлбар"
          />
        </div>
      </div>

      <div class="flex justify-end gap-3 p-6 border-t bg-gray-50">
        <button
          @click="closeModal"
          class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Цуцлах
        </button>
        <button
          @click="handleSubmit"
          :disabled="loading"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {{ loading ? 'Уншиж байна...' : (isEdit ? 'Өновчлох' : 'Үүсгэх') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';

interface Category {
  _id?: string;
  name: string;
  code: string;
  type: string;
  description?: string;
}

interface Props {
  isOpen: boolean;
  isEdit?: boolean;
  category?: Category | null;
}

interface Emits {
  (e: 'close'): void;
  (e: 'submit', data: Category): void;
}

const props = withDefaults(defineProps<Props>(), {
  isEdit: false,
  category: null,
});

const emit = defineEmits<Emits>();

const loading = ref(false);

const form = reactive<Category>({
  name: '',
  code: '',
  type: '',
  description: '',
});

watch(
  () => props.category,
  (newCategory) => {
    if (newCategory) {
      Object.assign(form, newCategory);
    } else {
      form.name = '';
      form.code = '';
      form.type = '';
      form.description = '';
    }
  },
  { deep: true }
);

const closeModal = () => {
  emit('close');
};

const handleSubmit = () => {
  if (!form.name || !form.code || !form.type) {
    alert('Заавал оруулах хэсгүүдийг бөглөнө үү');
    return;
  }

  loading.value = true;
  // Remove empty optional fields
  const submitData: any = {
    name: form.name,
    code: form.code,
    type: form.type,
    description: form.description?.trim() || undefined,
  };
  emit('submit', submitData);
  loading.value = false;
};
</script>

