<script setup lang="ts">
import { Megaphone } from 'lucide-vue-next'
import type { PublicNotification } from '~/composables/useCustomerPortal'

/**
 * Мэдэгдэл — introduction.md §7, roadmap 6.3
 *
 * Нэвтрээгүй зочинд ч харагдах компанийн нийтийн зарлал (BR-36). Хувийн
 * (ачааны эвент, BR-35) мэдэгдэл энд ОРОХГҮЙ — тэр зөвхөн нэвтэрсэн
 * харилцагчид (`/my/notifications`), учир нь тодорхой хүнд хамаарна.
 * Уншсан/уншаагүй төлөв энд байхгүй (зочинд харилцагчийн бичлэг үгүй).
 */
useHead({ title: 'Мэдэгдэл — Ивээлт Карго' })

const { notifications } = usePublicContent()
const page = ref(1)

const { data, pending } = await useAsyncData(
  () => `public-notifications-${page.value}`,
  () => notifications({ page: page.value, limit: 20 }),
  { watch: [page] }
)

const items = computed<PublicNotification[]>(() => data.value?.data ?? [])
const pagination = computed(
  () => data.value?.pagination ?? { page: 1, pages: 1, total: 0, limit: 20 }
)

function formatDate(value: string) {
  return new Date(value).toLocaleString('mn-MN')
}
</script>

<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-h1 font-bold text-content">Мэдэгдэл</h1>
      <p class="mt-1 text-body text-content-secondary">
        Компанийн зарлал, амралтын хуваарь, агуулахын өөрчлөлт зэрэг мэдээлэл
      </p>
    </div>

    <p v-if="pending" class="py-10 text-center text-body text-content-secondary">Ачаалж байна…</p>

    <div
      v-else-if="!items.length"
      class="rounded-card border border-surface-border bg-surface-card px-5 py-14 text-center"
    >
      <Megaphone :size="34" class="mx-auto text-content-disabled" :stroke-width="1.6" />
      <p class="mt-3 text-body text-content">Одоогоор мэдэгдэл алга байна</p>
    </div>

    <template v-else>
      <ul class="space-y-2.5">
        <li v-for="item in items" :key="item.id">
          <div class="flex items-start gap-3 rounded-card border border-surface-border bg-surface-card px-4 py-3.5 sm:px-5">
            <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600">
              <Megaphone :size="16" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-content">{{ item.title }}</p>
              <p class="mt-0.5 text-body-sm text-content-secondary">{{ item.body }}</p>
              <p class="mt-1 text-body-sm text-content-disabled">{{ formatDate(item.createdAt) }}</p>
            </div>
          </div>
        </li>
      </ul>

      <UiPagination
        :page="pagination.page"
        :pages="pagination.pages"
        :total="pagination.total"
        :limit="pagination.limit"
        @update:page="page = $event"
      />
    </template>
  </div>
</template>
