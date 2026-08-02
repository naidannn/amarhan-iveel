<script setup lang="ts">
import { Truck, Plus, Landmark, Copy, Check, PackageCheck } from 'lucide-vue-next'
import { formatCurrency } from '~/utils/currency'
import type { DeliverableForDelivery } from '~/composables/useCustomerPortal'

/**
 * Хүргэлтийн түүх — introduction.md §5, roadmap 5.8
 *
 * Харилцагч ЭНДЭЭС "Хүргэлт захиалах"-аар өөрөө шинэ хүргэлт үүсгэж
 * болно (`/my/deliveries/new`) — жагсаалт нь ажилтны үүсгэсэн хийгээд
 * өөрийн захиалсан хүргэлт хоёуланг адилхан харуулна.
 *
 * Захиалсны дараа гарч ирдэг дансны мэдээлэл нэг л удаа (баталгаажуулах
 * дэлгэц дээр) харагддаг байсныг ЭНД ДАХИН харах боломжтой болгов —
 * хүргэлт тус бүрийн "Хураамж хүлээгдэж байна" мөрнөөс шууд нээнэ.
 */
definePageMeta({ middleware: 'customer' })

const portal = useCustomerPortal()
const toast = useToast()
const { style, label } = useDeliveryStatus()

const page = ref(1)
const items = ref<any[]>([])
const pagination = ref({ page: 1, pages: 1, total: 0, limit: 20 })
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    const result = await portal.deliveries({ page: page.value, limit: 20 })
    items.value = result.data
    pagination.value = result.pagination
  } finally {
    loading.value = false
  }
}

watch(page, load)
onMounted(load)

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

/** Roadmap 5.8 — харилцагчийн ӨӨРИЙН захиалсан хүргэлтийн хураамж хүлээгдэж байгаа эсэх */
function feePending(delivery: any) {
  return (delivery.fee ?? 0) > (delivery.feePaidAmount ?? 0)
}

// ── BR-21d — «Хүргэлтээ авлаа» ─────────────────────────────────────────────

const receivingId = ref<string | null>(null)

async function confirmReceived(delivery: any) {
  receivingId.value = delivery.id
  try {
    await portal.confirmDeliveryReceived(delivery.id)
    toast.success('Баярлалаа! Хүргэлт хүлээж авсан гэж тэмдэглэгдлээ')
    await load()
  } catch (e: any) {
    toast.error('Тэмдэглэгдсэнгүй', {
      description: e?.response?.data?.message ?? e.message,
    })
  } finally {
    receivingId.value = null
  }
}

// ── Дансны мэдээлэл дахин харах ───────────────────────────────────────────

const bankModalOpen = ref(false)
const bankModalDelivery = ref<any | null>(null)
const bankAccount = ref<DeliverableForDelivery['bankAccount'] | null>(null)
const bankLoading = ref(false)
const copied = ref(false)

async function openBankInfo(delivery: any = null) {
  bankModalDelivery.value = delivery
  bankModalOpen.value = true
  if (bankAccount.value) return

  bankLoading.value = true
  try {
    const data = await portal.deliverableForDelivery()
    bankAccount.value = data.bankAccount
  } catch (e: any) {
    toast.error('Дансны мэдээлэл ачаалагдсангүй', {
      description: e?.response?.data?.message ?? e.message,
    })
  } finally {
    bankLoading.value = false
  }
}

const bankAccountText = computed(() => {
  const b = bankAccount.value
  if (!b) return ''
  return [b.bankName, b.accountNumber, b.accountHolder].filter(Boolean).join('\n')
})

async function copyBankAccount() {
  if (!bankAccountText.value) return
  try {
    await navigator.clipboard.writeText(bankAccountText.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    // Clipboard эрх өгөөгүй ч дансны мэдээлэл дэлгэцэн дээр харагдсаар байна
  }
}

useHead({ title: 'Хүргэлт — Ивээлт Карго' })
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-h1 font-bold text-content">Хүргэлт</h1>
        <p class="mt-1 text-body text-content-secondary">
          Нийт {{ pagination.total.toLocaleString('mn-MN') }} хүргэлт
        </p>
      </div>
      <div class="flex gap-2">
        <UiBtn variant="secondary" :icon="Landmark" @click="openBankInfo()">
          Дансны мэдээлэл
        </UiBtn>
        <UiBtn :icon="Plus" to="/my/deliveries/new">Хүргэлт захиалах</UiBtn>
      </div>
    </div>

    <p v-if="loading" class="py-10 text-center text-body text-content-secondary">Ачаалж байна…</p>

    <div
      v-else-if="!items.length"
      class="rounded-card border border-surface-border bg-surface-card px-5 py-14 text-center"
    >
      <Truck :size="34" class="mx-auto text-content-disabled" :stroke-width="1.6" />
      <p class="mt-3 text-body text-content">Хүргэлтийн бүртгэл алга байна</p>
      <p class="mx-auto mt-1 max-w-sm text-body-sm text-content-secondary">
        Бэлэн ачаагаа сонгож, өөрөө хүргэлт захиалах боломжтой.
      </p>
      <UiBtn :icon="Plus" class="mt-4" to="/my/deliveries/new">Хүргэлт захиалах</UiBtn>
    </div>

    <template v-else>
      <ul class="space-y-2.5">
        <li
          v-for="delivery in items"
          :key="delivery.id"
          class="rounded-card border border-surface-border bg-surface-card px-4 py-4 sm:px-5"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-semibold tabular text-content">{{ delivery.deliveryNumber }}</p>
              <p class="mt-0.5 text-body-sm text-content-secondary">
                {{ delivery.packageCount }} ачаа
                <span v-if="delivery.fee"> · {{ formatCurrency(delivery.fee) }} хүргэлтийн төлбөр</span>
              </p>
            </div>
            <span
              class="shrink-0 rounded-full px-2.5 py-1 text-body-sm font-semibold"
              :style="{
                color: style(delivery.status).color,
                backgroundColor: style(delivery.status).bg,
              }"
            >
              {{ label(delivery.status) }}
            </span>
          </div>

          <!-- Roadmap 5.8 — өөрөө захиалсан хүргэлтийн хураамж баталгаажаагүй байгааг сануулна -->
          <div
            v-if="feePending(delivery)"
            class="mt-2 flex flex-wrap items-center justify-between gap-2"
          >
            <p class="text-body-sm text-warning">
              Хураамж хүлээгдэж байна — ажилтан баталгаажуулмагц хүргэлтэнд гарна
            </p>
            <UiBtn size="sm" variant="ghost" :icon="Landmark" @click="openBankInfo(delivery)">
              Дансны мэдээлэл харах
            </UiBtn>
          </div>

          <!--
            BR-21d — «Хүргэлтэнд гарсан» үед харилцагч өөрөө хүлээж авснаа
            баталгаажуулна. Ажилтны «Хүргэгдсэн» тэмдэглэлээс ТУСДАА `received`
            төлөв рүү шилжинэ — хэн баталгаажуулснаар ялгагдана.
          -->
          <div v-if="delivery.status === 'dispatched'" class="mt-2">
            <UiBtn
              size="sm"
              :icon="PackageCheck"
              :loading="receivingId === delivery.id"
              @click="confirmReceived(delivery)"
            >
              Хүргэлтээ авлаа
            </UiBtn>
          </div>

          <dl class="mt-3 grid gap-2 border-t border-surface-border pt-3 sm:grid-cols-3">
            <div class="sm:col-span-2">
              <dt class="text-body-sm text-content-secondary">Хаяг</dt>
              <dd class="text-body text-content">{{ delivery.address }}</dd>
            </div>
            <div>
              <dt class="text-body-sm text-content-secondary">Товлосон огноо</dt>
              <dd class="text-body tabular text-content">{{ formatDate(delivery.scheduledDate) }}</dd>
            </div>
          </dl>
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

    <!-- Roadmap 5.8 — захиалсны дараа алдсан дансны мэдээллийг ДАХИН харах -->
    <UiModal v-model="bankModalOpen" title="Дансны мэдээлэл" size="sm">
      <div class="space-y-4">
        <p v-if="bankModalDelivery" class="text-body text-content-secondary">
          <span class="tabular font-semibold text-content">{{ bankModalDelivery.deliveryNumber }}</span>
          хүргэлтийн хураамжид
          <strong class="tabular text-content">
            {{ formatCurrency(Math.max((bankModalDelivery.fee ?? 0) - (bankModalDelivery.feePaidAmount ?? 0), 0)) }}
          </strong>
          үлдэж байна.
        </p>

        <p v-if="bankLoading" class="py-6 text-center text-body-sm text-content-secondary">
          Ачаалж байна…
        </p>

        <div
          v-else-if="bankAccount"
          class="rounded-card border border-surface-border bg-surface-hover px-4 py-3.5"
        >
          <div class="flex items-center justify-between gap-3">
            <p class="text-body-sm font-semibold text-content">Дансны мэдээлэл</p>
            <button
              type="button"
              class="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-body-sm font-medium transition-colors"
              :class="
                copied
                  ? 'bg-primary-600 text-white'
                  : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
              "
              @click="copyBankAccount"
            >
              <component :is="copied ? Check : Copy" :size="13" />
              {{ copied ? 'Хуулагдлаа' : 'Хуулах' }}
            </button>
          </div>
          <dl class="mt-2 space-y-1 text-body-sm">
            <div v-if="bankAccount.bankName" class="flex justify-between gap-3">
              <dt class="text-content-secondary">Банк</dt>
              <dd class="font-medium text-content">{{ bankAccount.bankName }}</dd>
            </div>
            <div v-if="bankAccount.accountNumber" class="flex justify-between gap-3">
              <dt class="text-content-secondary">Дансны дугаар</dt>
              <dd class="tabular font-medium text-content">{{ bankAccount.accountNumber }}</dd>
            </div>
            <div v-if="bankAccount.accountHolder" class="flex justify-between gap-3">
              <dt class="text-content-secondary">Эзэмшигч</dt>
              <dd class="font-medium text-content">{{ bankAccount.accountHolder }}</dd>
            </div>
          </dl>
          <p v-if="bankAccount.note" class="mt-2 text-body-sm text-content-secondary">
            {{ bankAccount.note }}
          </p>
        </div>
      </div>

      <template #footer>
        <UiBtn variant="secondary" @click="bankModalOpen = false">Хаах</UiBtn>
      </template>
    </UiModal>
  </div>
</template>
