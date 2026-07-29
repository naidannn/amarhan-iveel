<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
      <div class="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
        <h2 class="text-xl font-bold text-gray-900">
          {{ isEdit ? 'Бараа өөрчлөх' : 'Бараа үүсгэх' }}
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
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Бараа нэр *
            </label>
            <input
              v-model="form.name"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Жнь: Аспирин"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Бараа код *
            </label>
            <input
              v-model="form.code"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Жнь: ASP-001"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Баркод
            </label>
            <input
              v-model="form.barcode"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Баркод"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Ангилал *
            </label>
            <select
              v-model="form.category"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Сонгоно уу...</option>
              <option v-for="cat in props.categories" :key="cat._id" :value="cat._id">
                {{ cat.name }}
              </option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Агуулах
          </label>
          <select
            v-model="form.warehouse"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Сонгоно уу...</option>
            <option v-for="warehouse in props.warehouses" :key="warehouse._id" :value="warehouse._id">
              {{ warehouse.name }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Тайлбар
          </label>
          <textarea
            v-model="form.description"
            rows="2"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Бараа тайлбар"
          />
        </div>

        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Хэмжих нэгж *
            </label>
            <select
              v-model="form.unit"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Сонгоно уу...</option>
              <option value="kg">кг</option>
              <option value="g">гр</option>
              <option value="l">л</option>
              <option value="ml">мл</option>
              <option value="pcs">ширхэг</option>
              <option value="box">хайрцаг</option>
              <option value="pack">багц</option>
              <option value="meter">метр</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Худалдан авах үнэ *
            </label>
            <input
              v-model.number="form.purchasePrice"
              type="number"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="0"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Зарах үнэ *
            </label>
            <input
              v-model.number="form.sellingPrice"
              type="number"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="0"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Татварын хувь (%)
            </label>
            <input
              v-model.number="form.taxRate"
              type="number"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="0"
              min="0"
              max="100"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Тоо
            </label>
            <input
              v-model.number="form.reorderPoint"
              type="number"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="0"
              min="0"
            />
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-3 p-6 border-t bg-gray-50 sticky bottom-0">
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
import { ref, reactive, watch, computed } from 'vue';
import { useInventory } from '~/composables/useInventory';

interface Item {
  _id?: string;
  name: string;
  code: string;
  barcode?: string;
  category: string;
  warehouse?: string;
  description?: string;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  taxRate?: number;
  reorderPoint?: number;
}

interface Category {
  _id: string;
  name: string;
  code: string;
}

interface Warehouse {
  _id: string;
  name: string;
  code: string;
}

interface Props {
  isOpen: boolean;
  isEdit?: boolean;
  item?: Item | null;
  categories?: Category[];
  warehouses?: Warehouse[];
}

interface Emits {
  (e: 'close'): void;
  (e: 'submit', data: Item): void;
}

const props = withDefaults(defineProps<Props>(), {
  isEdit: false,
  item: null,
  categories: () => [],
  warehouses: () => [],
});

const emit = defineEmits<Emits>();

const loading = ref(false);

const form = reactive<Item>({
  name: '',
  code: '',
  barcode: '',
  category: '',
  warehouse: '',
  description: '',
  unit: '',
  purchasePrice: 0,
  sellingPrice: 0,
  taxRate: 0,
  reorderPoint: 0,
});

watch(
  () => props.item,
  (newItem) => {
    if (newItem) {
      Object.assign(form, newItem);
    } else {
      form.name = '';
      form.code = '';
      form.barcode = '';
      form.category = '';
      form.warehouse = '';
      form.description = '';
      form.unit = '';
      form.purchasePrice = 0;
      form.sellingPrice = 0;
      form.taxRate = 0;
      form.reorderPoint = 0;
    }
  },
  { deep: true }
);

const closeModal = () => {
  emit('close');
};

const handleSubmit = () => {
  if (!form.name || !form.code || !form.category || !form.unit || !form.purchasePrice || !form.sellingPrice) {
    alert('Заавал оруулах хэсгүүдийг бөглөнө үү');
    return;
  }

  loading.value = true;
  // Remove empty optional fields
  const submitData: any = {
    ...form,
    barcode: form.barcode?.trim() || undefined,
    warehouse: form.warehouse || undefined,
    description: form.description?.trim() || undefined,
  };
  emit('submit', submitData);
  loading.value = false;
};
</script>

