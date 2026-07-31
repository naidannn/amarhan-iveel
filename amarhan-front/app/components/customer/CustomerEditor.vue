<script setup lang="ts">
import type { AdminCustomer, AdminCustomerPayload } from '~/composables/useCustomers'

const props = defineProps<{
  customer: AdminCustomer | null
  saving?: boolean
}>()

const emit = defineEmits<{
  submit: [payload: AdminCustomerPayload]
  cancel: []
}>()

const isNew = computed(() => !props.customer)
const form = reactive({
  phone: '',
  name: '',
  email: '',
  status: 'active' as 'active' | 'blocked',
  note: '',
})
const phoneError = ref<string | null>(null)

const statusOptions = [
  { value: 'active', label: 'Идэвхтэй' },
  { value: 'blocked', label: 'Хаагдсан' },
]

function reset(customer: AdminCustomer | null) {
  form.phone = customer?.phone ?? ''
  form.name = customer?.name ?? ''
  form.email = customer?.email ?? ''
  form.status = customer?.status ?? 'active'
  form.note = customer?.note ?? ''
  phoneError.value = null
}

watch(() => props.customer, reset, { immediate: true })

function submit() {
  const phone = form.phone.trim()
  if (!phone) {
    phoneError.value = 'Утасны дугаар заавал'
    return
  }

  phoneError.value = null
  emit('submit', {
    phone,
    name: form.name.trim() || null,
    email: form.email.trim() || null,
    note: form.note.trim() || null,
    ...(!isNew.value ? { status: form.status } : {}),
  })
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="submit">
    <UiField label="Утасны дугаар" for="customer-phone" required :error="phoneError">
      <UiTextInput
        id="customer-phone"
        v-model="form.phone"
        type="tel"
        placeholder="99112233"
        tabular
        autofocus
        :invalid="Boolean(phoneError)"
      />
    </UiField>

    <UiField label="Нэр" for="customer-name">
      <UiTextInput id="customer-name" v-model="form.name" placeholder="Харилцагчийн нэр" />
    </UiField>

    <UiField label="Имэйл" for="customer-email">
      <UiTextInput id="customer-email" v-model="form.email" type="email" placeholder="name@example.mn" />
    </UiField>

    <UiField v-if="!isNew" label="Төлөв" for="customer-status">
      <UiSelectInput id="customer-status" v-model="form.status" :options="statusOptions" />
    </UiField>

    <UiField label="Дотоод тэмдэглэл" for="customer-note" hint="Харилцагчид харагдахгүй">
      <UiTextArea id="customer-note" v-model="form.note" :rows="4" :maxlength="1000" />
    </UiField>

    <div class="flex justify-end gap-2 pt-2">
      <UiBtn type="button" variant="secondary" :disabled="saving" @click="emit('cancel')">
        Болих
      </UiBtn>
      <UiBtn type="submit" :loading="saving">
        {{ isNew ? 'Харилцагч нэмэх' : 'Хадгалах' }}
      </UiBtn>
    </div>
  </form>
</template>
