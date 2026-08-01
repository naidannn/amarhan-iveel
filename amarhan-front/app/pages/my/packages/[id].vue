<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import { formatCurrency } from '~/utils/currency'

/**
 * Ачааны дэлгэрэнгүй — introduction.md §3
 *
 * Backend нь эзэмшлийг шалгаж, өөр хүний ачаанд 404 буцаана
 * (`customer-portal.service.js`). Дотоод талбар (агуулахын байршил,
 * ажилтны тэмдэглэл) хариунд ОРДОГГҮЙ тул энд нуух зүйл байхгүй.
 */
definePageMeta({ middleware: 'customer' })

const route = useRoute()
const portal = useCustomerPortal()
const toast = useToast()
const { style, label, isPreArrival } = usePackageStatus()
const paymentStyles = usePaymentStyles()
const deliveryStatus = useDeliveryStatus()

const pkg = ref<any>(null)
const loading = ref(true)
const notFound = ref(false)
const cancelling = ref(false)

/**
 * BR-46 — өөрийн мэдүүлгээ буцаах зам зөвхөн «Хүлээгдэж буй» үед нээлттэй.
 * Ажилтан бичлэгт хүрмэгц (Эрээнд ирсэн, эсвэл бүртгэсэн) хаагдана —
 * backend мөн ижил дүрмээр шалгана, энэ нь зөвхөн харагдац.
 */
const canCancel = computed(
  () => pkg.value?.status === 'expected' && pkg.value?.registrationSource === 'customer'
)

async function cancel() {
  cancelling.value = true
  try {
    pkg.value = { ...pkg.value, ...(await portal.cancelPackage(String(route.params.id))) }
    toast.success('Бүртгэл цуцлагдлаа')
  } catch (e: any) {
    toast.error(e?.response?.data?.message ?? 'Цуцалж чадсангүй')
  } finally {
    cancelling.value = false
  }
}

onMounted(async () => {
  try {
    pkg.value = await portal.packageDetail(String(route.params.id))
  } catch (e: any) {
    if (e?.response?.status === 404) notFound.value = true
    else throw e
  } finally {
    loading.value = false
  }
})

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('mn-MN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

useHead({ title: 'Ачааны мэдээлэл — Ивээлт Карго' })
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-4">
    <NuxtLink
      to="/my/packages"
      class="inline-flex items-center gap-1.5 text-body-sm text-content-secondary hover:text-content"
    >
      <ArrowLeft :size="15" />
      Миний ачаа
    </NuxtLink>

    <p v-if="loading" class="py-10 text-center text-body text-content-secondary">Ачаалж байна…</p>

    <div
      v-else-if="notFound"
      class="rounded-card border border-surface-border bg-surface-card px-5 py-12 text-center"
    >
      <p class="font-semibold text-content">Ачаа олдсонгүй</p>
      <p class="mt-1.5 text-body-sm text-content-secondary">
        Энэ ачаа таны бүртгэлд байхгүй байна.
      </p>
    </div>

    <template v-else-if="pkg">
      <!-- Толгой -->
      <div class="rounded-card border border-surface-border bg-surface-card p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-body-sm text-content-secondary">Ачааны дугаар</p>
            <p class="truncate text-h2 font-bold tabular text-content">
              {{ pkg.trackingNumber }}
            </p>
          </div>
          <span
            class="rounded-full px-3 py-1 text-body-sm font-semibold"
            :style="{ color: style(pkg.status).color, backgroundColor: style(pkg.status).bg }"
          >
            {{ label(pkg.status) }}
          </span>
        </div>

        <dl class="mt-4 grid gap-3 border-t border-surface-border pt-4 sm:grid-cols-2">
          <div>
            <dt class="text-body-sm text-content-secondary">Ачааны төрөл</dt>
            <dd class="text-body text-content">{{ pkg.cargoType ?? '—' }}</dd>
          </div>
          <div>
            <dt class="text-body-sm text-content-secondary">Тоо ширхэг</dt>
            <dd class="text-body tabular text-content">{{ pkg.quantity }}</dd>
          </div>
          <div v-if="pkg.weightKg">
            <dt class="text-body-sm text-content-secondary">Жин</dt>
            <dd class="text-body tabular text-content">{{ pkg.weightKg }} кг</dd>
          </div>
          <div v-if="pkg.volumeM3">
            <dt class="text-body-sm text-content-secondary">Эзлэхүүн</dt>
            <dd class="text-body tabular text-content">{{ pkg.volumeM3 }} м³</dd>
          </div>
          <div>
            <dt class="text-body-sm text-content-secondary">Бүртгэгдсэн</dt>
            <dd class="text-body text-content">{{ formatDate(pkg.createdAt) }}</dd>
          </div>
          <div v-if="pkg.customerNote" class="sm:col-span-2">
            <dt class="text-body-sm text-content-secondary">Таны тэмдэглэл</dt>
            <dd class="text-body text-content">{{ pkg.customerNote }}</dd>
          </div>
        </dl>

        <!--
          BR-46 — өөрөө бүртгүүлсэн, хараахан ирээгүй ачаа. Буруу дугаар
          бичсэн бол ЭНД буцаана: эс тэгвээс тэр дугаар жинхэнэ ачааны
          бүртгэлийг хаана.
        -->
        <div
          v-if="canCancel"
          class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-surface-border pt-4"
        >
          <p class="text-body-sm text-content-secondary">
            Ачаа ирээгүй байна. Дугаараа буруу бичсэн бол бүртгэлээ цуцлаарай.
          </p>
          <UiBtn variant="secondary" size="sm" :loading="cancelling" @click="cancel">
            Бүртгэл цуцлах
          </UiBtn>
        </div>
      </div>

      <!-- Төлбөр -->
      <div
        v-if="!isPreArrival(pkg.status)"
        class="rounded-card border border-surface-border bg-surface-card p-5"
      >
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-content">Төлбөр</h2>
          <span
            class="rounded-full px-2.5 py-1 text-body-sm font-semibold"
            :style="{
              color: paymentStyles.paymentStatus.style(pkg.paymentStatus).color,
              backgroundColor: paymentStyles.paymentStatus.style(pkg.paymentStatus).bg,
            }"
          >
            {{ paymentStyles.paymentStatus.label(pkg.paymentStatus) }}
          </span>
        </div>

        <dl class="mt-4 grid grid-cols-3 gap-3">
          <div>
            <dt class="text-body-sm text-content-secondary">Нийт үнэ</dt>
            <dd class="font-semibold tabular text-content">{{ formatCurrency(pkg.finalPrice) }}</dd>
          </div>
          <div>
            <dt class="text-body-sm text-content-secondary">Төлсөн</dt>
            <dd class="font-semibold tabular text-success">{{ formatCurrency(pkg.paidAmount) }}</dd>
          </div>
          <div>
            <dt class="text-body-sm text-content-secondary">Үлдэгдэл</dt>
            <dd
              class="font-semibold tabular"
              :class="pkg.balance > 0 ? 'text-warning' : 'text-content'"
            >
              {{ formatCurrency(pkg.balance) }}
            </dd>
          </div>
        </dl>

        <ul v-if="pkg.payments?.length" class="mt-4 divide-y divide-surface-border border-t border-surface-border">
          <li
            v-for="payment in pkg.payments"
            :key="payment.id"
            class="flex items-center justify-between py-2.5"
          >
            <div>
              <p class="text-body text-content">
                {{ paymentStyles.method.label(payment.method) }}
              </p>
              <p class="text-body-sm text-content-secondary">{{ formatDate(payment.createdAt) }}</p>
            </div>
            <p class="font-medium tabular text-content">{{ formatCurrency(payment.amount) }}</p>
          </li>
        </ul>

        <!--
          §5.2 — төлбөр дуусаагүй ачаа хүргэлтэнд ГАРАХГҮЙ. Хэрэглэгч
          яагаад хүргэлт захиалж чадахгүйгээ ойлгох ёстой.
        -->
        <p
          v-if="pkg.balance > 0"
          class="mt-4 rounded-btn bg-warning/10 px-3.5 py-2.5 text-body-sm text-content"
        >
          Үлдэгдэл төлөгдсөний дараа ачаагаа авах эсвэл хүргэлт захиалах боломжтой.
        </p>
      </div>

      <!--
        Урьдчилсан бүртгэлд төлбөрийн карт харуулахгүй (BR-46): үнэ хараахан
        бодогдоогүй тул "0₮ · Төлөгдсөн" гэсэн худал зураг гарна.
      -->
      <div v-else class="rounded-card border border-surface-border bg-surface-card p-5">
        <h2 class="font-semibold text-content">Төлбөр</h2>
        <p class="mt-2 text-body text-content-secondary">
          {{
            pkg.status === 'expected'
              ? 'Ачаа хараахан ирээгүй байна. Эрээнд ирэхэд төлөв өөрчлөгдөнө.'
              : 'Ачаа Эрээнд байна. Улаанбаатарт ирж жин хэмжигдсэний дараа үнэ тодорхойлогдоно.'
          }}
        </p>
      </div>

      <!-- Хүргэлт -->
      <div
        v-if="pkg.deliveries?.length"
        class="rounded-card border border-surface-border bg-surface-card p-5"
      >
        <h2 class="font-semibold text-content">Хүргэлт</h2>
        <ul class="mt-3 space-y-3">
          <li
            v-for="delivery in pkg.deliveries"
            :key="delivery._id"
            class="flex items-start justify-between gap-3"
          >
            <div class="min-w-0">
              <p class="font-medium tabular text-content">{{ delivery.deliveryNumber }}</p>
              <p class="truncate text-body-sm text-content-secondary">{{ delivery.address }}</p>
            </div>
            <span
              class="shrink-0 rounded-full px-2.5 py-1 text-body-sm font-semibold"
              :style="{
                color: deliveryStatus.style(delivery.status).color,
                backgroundColor: deliveryStatus.style(delivery.status).bg,
              }"
            >
              {{ deliveryStatus.label(delivery.status) }}
            </span>
          </li>
        </ul>
      </div>

      <!-- Төлөвийн түүх -->
      <div
        v-if="pkg.statusHistory?.length"
        class="rounded-card border border-surface-border bg-surface-card p-5"
      >
        <h2 class="font-semibold text-content">Төлөвийн түүх</h2>
        <ol class="mt-3 space-y-3">
          <li v-for="(step, i) in pkg.statusHistory" :key="i" class="flex gap-3">
            <span
              class="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              :style="{ backgroundColor: style(step.to).color }"
            />
            <div>
              <p class="text-body font-medium text-content">{{ label(step.to) }}</p>
              <p class="text-body-sm text-content-secondary">{{ formatDate(step.at) }}</p>
            </div>
          </li>
        </ol>
      </div>
    </template>
  </div>
</template>
