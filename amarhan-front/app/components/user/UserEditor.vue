<script setup lang="ts">
import type { SystemUser, SystemUserPayload, SystemUserRole, SystemUserStatus } from '~/composables/useUsers'

const props = defineProps<{
  user: SystemUser | null
  saving?: boolean
}>()

const emit = defineEmits<{
  submit: [payload: SystemUserPayload]
  cancel: []
}>()

const isNew = computed(() => !props.user)
const form = reactive({
  firstname: '',
  lastname: '',
  email: '',
  password: '',
  role: 'staff' as SystemUserRole,
  status: 'active' as SystemUserStatus,
})
const errors = reactive({
  firstname: '',
  lastname: '',
  email: '',
  password: '',
})

const roleOptions = [
  { value: 'staff', label: 'Ажилтан' },
  { value: 'manager', label: 'Менежер' },
  { value: 'admin', label: 'Админ' },
]

const statusOptions = [
  { value: 'active', label: 'Идэвхтэй' },
  { value: 'deactive', label: 'Идэвхгүй' },
]

function reset(user: SystemUser | null) {
  form.firstname = user?.firstname ?? ''
  form.lastname = user?.lastname ?? ''
  form.email = user?.email ?? ''
  form.password = ''
  form.role = user?.role ?? 'staff'
  form.status = user?.status ?? 'active'
  errors.firstname = ''
  errors.lastname = ''
  errors.email = ''
  errors.password = ''
}

watch(() => props.user, reset, { immediate: true })

function submit() {
  const firstname = form.firstname.trim()
  const lastname = form.lastname.trim()
  const email = form.email.trim().toLowerCase()
  const password = form.password

  errors.firstname = firstname ? '' : 'Нэр заавал'
  errors.lastname = lastname ? '' : 'Овог заавал'
  errors.email = /^\S+@\S+\.\S+$/.test(email) ? '' : 'Зөв имэйл хаяг оруулна уу'
  errors.password = isNew.value && password.length < 8 ? 'Нууц үг хамгийн багадаа 8 тэмдэгт' : ''
  if (Object.values(errors).some(Boolean)) return

  emit('submit', {
    firstname,
    lastname,
    email,
    role: form.role,
    status: form.status,
    ...(isNew.value ? { password } : {}),
  })
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="submit">
    <div class="grid gap-4 sm:grid-cols-2">
      <UiField label="Овог" for="user-lastname" required :error="errors.lastname">
        <UiTextInput id="user-lastname" v-model="form.lastname" placeholder="Бат" autofocus :invalid="Boolean(errors.lastname)" />
      </UiField>
      <UiField label="Нэр" for="user-firstname" required :error="errors.firstname">
        <UiTextInput id="user-firstname" v-model="form.firstname" placeholder="Болд" :invalid="Boolean(errors.firstname)" />
      </UiField>
    </div>

    <UiField label="Имэйл" for="user-email" required :error="errors.email">
      <UiTextInput id="user-email" v-model="form.email" type="email" placeholder="name@iveel.mn" :invalid="Boolean(errors.email)" />
    </UiField>

    <UiField v-if="isNew" label="Түр нууц үг" for="user-password" required :error="errors.password" hint="Ажилтан эхний нэвтрэхдээ ашиглана">
      <UiTextInput id="user-password" v-model="form.password" type="password" placeholder="Хамгийн багадаа 8 тэмдэгт" :invalid="Boolean(errors.password)" />
    </UiField>

    <div class="grid gap-4 sm:grid-cols-2">
      <UiField label="Эрх" for="user-role">
        <UiSelectInput id="user-role" v-model="form.role" :options="roleOptions" />
      </UiField>
      <UiField label="Төлөв" for="user-status">
        <UiSelectInput id="user-status" v-model="form.status" :options="statusOptions" />
      </UiField>
    </div>

    <div class="flex justify-end gap-2 pt-2">
      <UiBtn type="button" variant="secondary" :disabled="saving" @click="emit('cancel')">Болих</UiBtn>
      <UiBtn type="submit" :loading="saving">{{ isNew ? 'Хэрэглэгч нэмэх' : 'Хадгалах' }}</UiBtn>
    </div>
  </form>
</template>
