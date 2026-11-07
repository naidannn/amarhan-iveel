<script setup lang="ts">
import { Send, RefreshCw, ImagePlus, X } from 'lucide-vue-next'
import type { Column } from '~/components/ui/DataTable.vue'
import type { AdminNotification, NotificationPagination } from '~/composables/useNotifications'

definePageMeta({ layout: 'admin', middleware: 'auth' })
useHead({ title: 'Мэдэгдэл — Ивээл Карго' })

/**
 * §7 (Phase 6), BR-36 — Админ/Менежер бүх бүртгэлтэй харилцагчид нэгдсэн
 * зарлал илгээнэ. Ачааны эвентээс автоматаар үүсдэг ХУВИЙН мэдэгдэл (BR-35)
 * энд ХАРАГДАХГҮЙ — тэдгээр нь удирдах зүйл биш, харилцагч бүрийн `/my/notifications`-д.
 *
 * Зарлалын ЦОРЫН ГАНЦ газар: нэг зарлал нүүрний зурвас, `/notifications`,
 * харилцагчийн хонх, («Popup-аар харуулах» бол) вэб рүү ороход гарах popup
 * бүгдэд гарна. Зураг Cloudinary-д (сервер дээр хадгалахгүй).
 */
const api = useNotifications()
const toast = useToast()

const rows = ref<AdminNotification[]>([])
const pagination = ref<NotificationPagination>({ page: 1, pages: 1, total: 0, limit: 20 })
const loading = ref(true)
const composerOpen = ref(false)
const sending = ref(false)
const uploading = ref(false)
const expiring = ref<string | null>(null)

const form = reactive({
  title: '',
  body: '',
  expiresAt: '',
  imageUrl: '',
  linkUrl: '',
  linkText: '',
  showAsPopup: false,
})

const columns: Column<AdminNotification>[] = [
  { key: 'imageUrl', label: '', width: '64px' },
  { key: 'title', label: 'Гарчиг', mobileTitle: true },
  { key: 'body', label: 'Агуулга' },
  { key: 'expiresAt', label: 'Хугацаа' },
  { key: 'createdAt', label: 'Илгээсэн', tabular: true },
  { key: 'actions', label: '', align: 'right' },
]

function isActive(row: AdminNotification) {
  return !row.expiresAt || new Date(row.expiresAt) > new Date()
}

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
  Object.assign(form, {
    title: '',
    body: '',
    expiresAt: '',
    imageUrl: '',
    linkUrl: '',
    linkText: '',
    showAsPopup: false,
  })
  composerOpen.value = true
}

async function onImageChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  uploading.value = true
  try {
    form.imageUrl = await api.uploadImage(file)
    // Зураг оруулсан зарлалыг ихэвчлэн popup-аар гаргахыг хүсдэг
    form.showAsPopup = true
  } catch (e: any) {
    toast.error('Зураг байршуулж чадсангүй', { description: e.message })
  } finally {
    uploading.value = false
  }
}

function removeImage() {
  form.imageUrl = ''
  form.showAsPopup = false
}

async function submit() {
  sending.value = true
  try {
    await api.send({
      title: form.title,
      body: form.body,
      // Сонгосон өдрийн ТӨГСГӨЛ хүртэл (локал цагаар) идэвхтэй байна
      expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`).toISOString() : null,
      imageUrl: form.imageUrl || null,
      linkUrl: form.linkUrl.trim() || null,
      linkText: form.linkText.trim() || null,
      showAsPopup: Boolean(form.imageUrl) && form.showAsPopup,
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

async function expire(row: AdminNotification) {
  expiring.value = row.id
  try {
    await api.expire(row.id)
    toast.success('Зарлал зогслоо', { description: 'Вэб, popup, хонхноос алга болсон' })
    await load()
  } catch (e: any) {
    toast.error('Зогсоож чадсангүй', { description: e.message })
  } finally {
    expiring.value = null
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
      <template #cell-imageUrl="{ row }">
        <img
          v-if="row.imageUrl"
          :src="optimizedImage(row.imageUrl, 120)"
          alt=""
          class="h-10 w-10 rounded-btn border border-surface-border object-cover"
        />
      </template>

      <template #cell-title="{ row }">
        <span class="font-medium text-content">{{ row.title }}</span>
        <span
          v-if="row.showAsPopup"
          class="ml-2 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-600"
        >
          Popup
        </span>
      </template>

      <template #cell-body="{ row }">
        <span class="line-clamp-1 text-content-secondary">{{ row.body }}</span>
      </template>

      <template #cell-expiresAt="{ row }">
        <span :class="isActive(row) ? 'text-content-secondary' : 'text-content-disabled'">
          {{ row.expiresAt ? formatDate(row.expiresAt) : 'Хугацаагүй' }}
          <template v-if="!isActive(row)"> · дууссан</template>
        </span>
      </template>

      <template #cell-actions="{ row }">
        <UiBtn
          v-if="isActive(row)"
          size="sm"
          variant="ghost"
          :loading="expiring === row.id"
          @click.stop="expire(row)"
        >
          Зогсоох
        </UiBtn>
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
      subtitle="Нүүр хуудас, мэдэгдлийн хуудас, харилцагчийн хонхонд харагдана"
    >
      <form class="space-y-4" @submit.prevent="submit">
        <UiField label="Гарчиг" required>
          <UiTextInput v-model="form.title" placeholder="Наадмын амралтын хуваарь" autofocus />
        </UiField>

        <UiField label="Агуулга" required>
          <UiTextArea v-model="form.body" :rows="4" placeholder="Дэлгэрэнгүй мэдээлэл..." />
        </UiField>

        <UiField label="Зураг" hint="Popup-аар харуулахад зураг заавал">
          <div
            v-if="form.imageUrl"
            class="relative overflow-hidden rounded-btn border border-surface-border bg-surface-hover"
          >
            <img :src="optimizedImage(form.imageUrl, 600)" alt="" class="max-h-56 w-full object-contain" />
            <button
              type="button"
              class="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
              aria-label="Зураг хасах"
              @click="removeImage"
            >
              <X :size="15" />
            </button>
          </div>
          <label
            v-else
            class="flex cursor-pointer items-center justify-center gap-2 rounded-btn border border-dashed border-surface-border bg-surface-hover px-4 py-6 text-body-sm font-medium text-primary-600 hover:text-primary-700"
            :class="uploading && 'pointer-events-none opacity-60'"
          >
            <ImagePlus :size="17" />
            {{ uploading ? 'Байршуулж байна…' : 'Зураг сонгох' }}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              class="hidden"
              :disabled="uploading"
              @change="onImageChange"
            />
          </label>
        </UiField>

        <label
          class="flex items-start gap-2.5 text-body text-content"
          :class="!form.imageUrl && 'opacity-50'"
        >
          <input
            v-model="form.showAsPopup"
            type="checkbox"
            class="mt-0.5 h-4 w-4 rounded border-surface-border text-primary"
            :disabled="!form.imageUrl"
          />
          <span>
            <span class="font-medium">Вэб рүү ороход popup-аар харуулах</span>
            <span class="block text-body-sm text-content-secondary">
              Хамгийн сүүлийн popup зарлал л гарна — шинийг илгээхэд хуучин нь солигдоно
            </span>
          </span>
        </label>

        <div class="grid gap-4 sm:grid-cols-2">
          <UiField label="Товчны холбоос" hint="Сонголттой">
            <UiTextInput v-model="form.linkUrl" placeholder="https://..." />
          </UiField>
          <UiField label="Товчны текст">
            <UiTextInput v-model="form.linkText" placeholder="Ачаа шалгах" />
          </UiField>
        </div>

        <UiField
          label="Хугацаа дуусах огноо"
          hint="Тэр өдрийн төгсгөл хүртэл харагдана. Хоосон бол хугацаагүй — «Зогсоох»-оор гараар зогсооно"
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
          :disabled="!form.title.trim() || !form.body.trim() || uploading"
          @click="submit"
        >
          Илгээх
        </UiBtn>
      </template>
    </UiModal>
  </div>
</template>
