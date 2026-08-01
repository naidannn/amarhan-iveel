<script setup lang="ts">
import { Bell, CheckCheck, Megaphone, Package } from 'lucide-vue-next'
import type { CustomerNotification } from '~/composables/useCustomerPortal'

/**
 * Миний мэдэгдэл — introduction.md §7 (Phase 6)
 *
 * ХУВИЙН (ачааны эвент, BR-35) болон идэвхтэй НИЙТИЙН (BR-36) мэдэгдэл нэг
 * жагсаалтад холилдоно (backend аль хэдийн мержсэн) — `audience`-аар зөвхөн
 * ЗУРАГ ялгана, тусдаа хуудас/таб хэрэггүй.
 */
definePageMeta({ middleware: 'customer' })
useHead({ title: 'Мэдэгдэл — Ивээлт Карго' })

const portal = useCustomerPortal()
const toast = useToast()

const page = ref(1)
const items = ref<CustomerNotification[]>([])
const pagination = ref({ page: 1, pages: 1, total: 0, limit: 20 })
const loading = ref(true)
const markingAll = ref(false)

async function load() {
  loading.value = true
  try {
    const result = await portal.notifications({ page: page.value, limit: 20 })
    items.value = result.data
    pagination.value = result.pagination
  } catch (e: any) {
    toast.error('Мэдэгдэл ачаалагдсангүй', { description: e.message })
  } finally {
    loading.value = false
  }
}

watch(page, load)
onMounted(load)

async function openNotification(item: CustomerNotification) {
  if (!item.read) {
    item.read = true
    try {
      await portal.markNotificationRead(item.id)
    } catch {
      item.read = false
    }
  }
  if (item.entity === 'package' && item.entityId) {
    await navigateTo(`/my/packages/${item.entityId}`)
  }
}

async function markAllRead() {
  markingAll.value = true
  try {
    await portal.markAllNotificationsRead()
    items.value.forEach(i => (i.read = true))
  } catch (e: any) {
    toast.error('Тэмдэглэж чадсангүй', { description: e.message })
  } finally {
    markingAll.value = false
  }
}

const hasUnread = computed(() => items.value.some(i => !i.read))

function formatDate(value: string) {
  return new Date(value).toLocaleString('mn-MN')
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-h1 font-bold text-content">Мэдэгдэл</h1>
        <p class="mt-1 text-body text-content-secondary">
          Нийт {{ pagination.total.toLocaleString('mn-MN') }} мэдэгдэл
        </p>
      </div>

      <UiBtn
        v-if="hasUnread"
        variant="secondary"
        :icon="CheckCheck"
        :loading="markingAll"
        @click="markAllRead"
      >
        Бүгдийг уншсан
      </UiBtn>
    </div>

    <p v-if="loading" class="py-10 text-center text-body text-content-secondary">Ачаалж байна…</p>

    <div
      v-else-if="!items.length"
      class="rounded-card border border-surface-border bg-surface-card px-5 py-14 text-center"
    >
      <Bell :size="34" class="mx-auto text-content-disabled" :stroke-width="1.6" />
      <p class="mt-3 text-body text-content">Танд мэдэгдэл алга байна</p>
    </div>

    <template v-else>
      <ul class="space-y-2.5">
        <li v-for="item in items" :key="item.id">
          <button
            type="button"
            class="flex w-full items-start gap-3 rounded-card border px-4 py-3.5 text-left transition-colors duration-200 hover:border-primary-300 sm:px-5"
            :class="
              item.read
                ? 'border-surface-border bg-surface-card'
                : 'border-primary-200 bg-primary-50/40'
            "
            @click="openNotification(item)"
          >
            <span
              class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              :class="item.audience === 'all' ? 'bg-primary-50 text-primary-600' : 'bg-surface-hover text-content-secondary'"
            >
              <Megaphone v-if="item.audience === 'all'" :size="16" />
              <Package v-else :size="16" />
            </span>

            <div class="min-w-0 flex-1">
              <p class="flex items-center gap-2 font-semibold text-content">
                {{ item.title }}
                <span v-if="!item.read" class="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              </p>
              <p class="mt-0.5 text-body-sm text-content-secondary">{{ item.body }}</p>
              <p class="mt-1 text-body-sm text-content-disabled">{{ formatDate(item.createdAt) }}</p>
            </div>
          </button>
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
