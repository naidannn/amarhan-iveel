<template>
  <div class="relative">
    <input
      v-model="searchQuery"
      type="text"
      :placeholder="placeholder"
      :required="required"
      class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
      @input="handleInput"
      @focus="showDropdown = true"
      @blur="handleBlur"
    />
    
    <!-- Dropdown -->
    <div
      v-if="showDropdown && (searchQuery.length > 0 || customers.length > 0)"
      class="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto"
    >
      <div v-if="loading" class="p-4 text-center text-sm text-gray-500">
        Хайж байна...
      </div>
      <div v-else-if="customers.length === 0" class="p-4 text-center text-sm text-gray-500">
        Харилцагч олдсонгүй
      </div>
      <div v-else>
        <div
          v-for="customer in customers"
          :key="customer.id || customer._id || customer.customer_id"
          @mousedown="selectCustomer(customer)"
          class="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
        >
          <div class="font-medium text-gray-900">{{ customer.name }}</div>
          <div class="text-sm text-gray-500">
            {{ customer.email || '-' }} | {{ customer.phone || '-' }}
          </div>
          <div v-if="customer.company_name" class="text-xs text-gray-400 mt-1">
            {{ customer.company_name }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue?: string
  placeholder?: string
  required?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Харилцагч хайх...',
  required: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const crm = useCRM()
const searchQuery = ref('')
const customers = ref<any[]>([])
const loading = ref(false)
const showDropdown = ref(false)
const selectedCustomer = ref<any>(null)

let searchTimeout: NodeJS.Timeout

const handleInput = () => {
  clearTimeout(searchTimeout)
  
  if (searchQuery.value.length === 0) {
    customers.value = []
    emit('update:modelValue', '')
    selectedCustomer.value = null
    return
  }
  
  searchTimeout = setTimeout(async () => {
    if (searchQuery.value.length < 2) {
      customers.value = []
      return
    }
    
    try {
      loading.value = true
      const response = await crm.getCustomers({
        search: searchQuery.value,
        limit: 10
      })
      customers.value = response.data || []
    } catch (error: any) {
      console.error('Failed to search customers:', error)
      customers.value = []
    } finally {
      loading.value = false
    }
  }, 300)
}

const selectCustomer = (customer: any) => {
  selectedCustomer.value = customer
  searchQuery.value = `${customer.name} (${customer.email || customer.phone || customer.customer_id})`
  // Use id or _id field - MongoDB returns _id, but transform() might return id
  // Customer model transform() returns 'id' field
  const customerId = customer.id || customer._id
  console.log('CustomerSearch - Selected customer:', customer)
  console.log('CustomerSearch - Extracted ID:', customerId)
  if (!customerId) {
    console.error('CustomerSearch - No ID found in customer object:', customer)
    alert('Харилцагчийн ID олдсонгүй. Дахин оролдоно уу.')
    return
  }
  emit('update:modelValue', customerId)
  showDropdown.value = false
  customers.value = []
}

const handleBlur = () => {
  // Delay to allow click event to fire
  setTimeout(() => {
    showDropdown.value = false
  }, 200)
}

// Watch for external changes
watch(() => props.modelValue, (newValue) => {
  if (!newValue) {
    searchQuery.value = ''
    selectedCustomer.value = null
  } else if (newValue && !selectedCustomer.value) {
    // If ID is set externally but we don't have the customer object, load it
    loadCustomerById(newValue)
  } else if (selectedCustomer.value && newValue) {
    // Verify that the selected customer ID matches the modelValue
    const currentId = selectedCustomer.value.id || selectedCustomer.value._id || selectedCustomer.value.customer_id
    if (currentId !== newValue) {
      // IDs don't match, clear selection
      selectedCustomer.value = null
      searchQuery.value = ''
    }
  }
})

const loadCustomerById = async (id: string) => {
  try {
    const response = await crm.getCustomer(id)
    if (response.data) {
      selectedCustomer.value = response.data
      searchQuery.value = `${response.data.name} (${response.data.email || response.data.phone || response.data.customer_id})`
    }
  } catch (error) {
    // Customer not found or error loading
    console.error('Failed to load customer:', error)
  }
}
</script>

