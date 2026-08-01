<script setup lang="ts">
import { Send, RefreshCw } from 'lucide-vue-next'
import type { Column } from '~/components/ui/DataTable.vue'
import type { AdminNotification, NotificationPagination } from '~/composables/useNotifications'

definePageMeta({ layout: 'admin', middleware: 'auth' })
useHead({ title: 'Мэдэгдэл — Ивээл Карго' })

/**
 * §7 (Phase 6), BR-36 — Админ/Менежер бүх бүртгэлтэй харилцагчид нэгдсэн
 * зарлал илгээнэ. Ачааны эвентээс автоматаар үүсдэг ХУВИЙН мэдэгдэл (BR-35)
 * энд ХАРАГДАХГҮЙ — тэдгээр нь удирдах зүйл биш, харилцагч бүрийн `/my/notifications`-д.
 */
const api = useNotifications()
const toast = useToast()

const rows = ref<AdminNotification[]>([])
const pagination = ref<NotificationPagination>({ page: 1, pages: 1, total: 0, limit: 20 })
const loading = ref(true)
const composerOpen = ref(false)
const sending = ref(false)

const form = reactive({ title: '', body: '', expiresAt: '' })

const columns: Column<AdminNotification>[] = [
  { key: 'title', label: 'Гарчиг' },
  { key: 'body', label: 'Агуулга' },
  { key: 'expiresAt', label: 'Хугацаа' },
  { key: 'createdAt', label: 'Илгээсэн', tabular: true },
]

async function load() {
  loading.value = true
  try {
    const result = await api.list({ page: pagination.value.page, limit: pagination.value.limit })
    rows.value = result.data
    pagination.value = result.pagination
  } catch (e: any) {
    toast.error('Мэдэгдлийн жагсаалт ачаалагдсангүй', { description: e.message })
    rows.value = []
  } finally {
    loading.value = false
  }
}

watch(() => pagination.value.page, load)
onMounted(load)

function openComposer() {
  form.title = ''
  form.body = ''
  form.expiresAt = ''
  composerOpen.value = true
}

async function submit() {
  sending.value = true
  try {
    await api.send({
      title: form.title,
      body: form.body,
      expiresAt: form.expiresAt || null,
    })
    toast.success('Мэдэгдэл бүх харилцагчид илгээгдлээ')
    composerOpen.value = false
    pagination.value.page = 1
    await load()
  } catch (e: any) {
    toast.error('Илгээж чадсангүй', { description: e.message })
  } finally {
    sending.value = false
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('mn-MN')
}
</script>

<template>
  <div>
    <UiPageHeader
      title="Мэдэгдэл"
      :subtitle="`Нийт ${pagination.total.toLocaleString('mn-MN')} зарлал илгээгдсэн`"
    >
      <template #actions>
        <UiBtn variant="secondary" :icon="RefreshCw" :loading="loading" @click="load">
          Сэргээх
        </UiBtn>
        <UiBtn :icon="Send" @click="openComposer">Мэдэгдэл илгээх</UiBtn>
      </template>
    </UiPageHeader>

    <UiDataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      empty-text="Илгээсэн мэдэгдэл алга"
    >
      <template #cell-title="{ row }">
        <span class="font-medium text-content">{{ row.title }}</span>
      </template>

      <template #cell-body="{ row }">
        <span class="line-clamp-1 text-content-secondary">{{ row.body }}</span>
      </template>

      <template #cell-expiresAt="{ row }">
        <span class="text-content-secondary">
          {{ row.expiresAt ? formatDate(row.expiresAt) : 'Хугацаагүй' }}
        </span>
      </template>

      <template #cell-createdAt="{ row }">
        <span class="text-content-secondary">{{ formatDate(row.createdAt) }}</span>
      </template>

      <template #empty>
        <UiBtn class="mt-4" :icon="Send" @click="openComposer">Анхны мэдэгдэл илгээх</UiBtn>
      </template>

      <template #footer>
        <UiPagination
          :page="pagination.page"
          :pages="pagination.pages"
          :total="pagination.total"
          :limit="pagination.limit"
          @update:page="pagination.page = $event"
        />
      </template>
    </UiDataTable>

    <UiModal
      v-model="composerOpen"
      title="Мэдэгдэл илгээх"
      subtitle="Бүх бүртгэлтэй харилцагчид харагдана"
    >
      <form class="space-y-4" @submit.prevent="submit">
        <UiField label="Гарчиг" required>
          <UiTextInput v-model="form.title" placeholder="Наадмын амралтын хуваарь" autofocus />
        </UiField>

        <UiField label="Агуулга" required>
          <UiTextArea v-model="form.body" :rows="4" placeholder="Дэлгэрэнгүй мэдээлэл..." />
        </UiField>

        <UiField
          label="Хугацаа дуусах огноо"
          hint="Хоосон бол хугацаагүй — гараар устгах хэрэггүй"
        >
          <UiTextInput v-model="form.expiresAt" type="date" />
        </UiField>
      </form>

      <template #footer>
        <UiBtn variant="secondary" :disabled="sending" @click="composerOpen = false">
          Цуцлах
        </UiBtn>
        <UiBtn
          :loading="sending"
          :disabled="!form.title.trim() || !form.body.trim()"
          @click="submit"
        >
          Илгээх
        </UiBtn>
      </template>
    </UiModal>
  </div>
</template>
