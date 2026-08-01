<script setup lang="ts">
import { Package, Plus, Truck } from 'lucide-vue-next'
import { formatCurrency } from '~/utils/currency'

/**
 * Миний ачаа — introduction.md §3
 *
 * §9.3 — шүүлт ба хуудаслалт ҮРГЭЛЖ backend руу query параметрээр явна.
 * Бүх ачааг татаж client талд шүүхийг хориглоно.
 */
definePageMeta({ middleware: 'customer' })

const portal = useCustomerPortal()
const toast = useToast()
const { style, label, isPreArrival, all: statuses } = usePackageStatus()

const page = ref(1)
const items = ref<any[]>([])
const pagination = ref({ page: 1, pages: 1, total: 0, limit: 20 })
const loading = ref(true)

/**
 * `'all'` нь тодорхой утга — хоосон мөр (`''`) ашиглаж БОЛОХГҮЙ: `SelectInput`
 * нь placeholder-даа `value=""`-г идэвхгүй сонголт болгон эзэмшдэг тул хоёр
 * сонголт мөргөлдөж, «бүх төлөв» рүү буцаж очих боломжгүй болно.
 */
const status = ref<string>('all')

const statusOptions = computed(() => [
  { value: 'all', label: 'Бүх төлөв' },
  ...Object.entries(statuses).map(([value, s]: [string, any]) => ({ value, label: s.label })),
])

async function load() {
  loading.value = true
  try {
    const result = await portal.packages({
      page: page.value,
      limit: 20,
      status: status.value === 'all' ? undefined : status.value,
    })
    items.value = result.data
    pagination.value = result.pagination
  } finally {
    loading.value = false
  }
}

// Шүүлт солигдоход эхний хуудас руу буцна — 5-р хуудсанд байхад шүүвэл
// хоосон жагсаалт харагдана
watch(status, () => {
  page.value = 1
})
watch([page, status], load)

onMounted(load)

/**
 * Хяналтын самбараас `/my/packages?register=1` линкээр ирвэл бүртгэх
 * маягтыг шууд нээнэ — хэрэглэгч дахин "Ачаа бүртгүүлэх" товч хайхгүй.
 */
const route = useRoute()
const router = useRouter()
onMounted(() => {
  if (route.query.register === '1') {
    openForm()
    router.replace({ query: {} })
  }
})

/**
 * BR-46 — өөрөө ачаа бүртгүүлэх.
 *
 * Маягтад ЗӨВХӨН харилцагчийн мэдэх зүйл байна: дугаар, тоо ширхэг, тайлбар.
 * Жин, үнэ, байршлыг компани хэмжиж тодорхойлдог (§1.1) тул энд асуухгүй —
 * асуувал харилцагч тэр дүнг "тохирсон үнэ" гэж ойлгоно.
 */
const formOpen = ref(false)
const form = reactive({ trackingNumber: '', quantity: 1, note: '' })
const formError = ref<string | null>(null)
const saving = ref(false)

function openForm() {
  form.trackingNumber = ''
  form.quantity = 1
  form.note = ''
  formError.value = null
  formOpen.value = true
}

async function submit() {
  const trackingNumber = form.trackingNumber.trim()
  if (!trackingNumber) {
    formError.value = 'Ачааны дугаараа оруулна уу'
    return
  }

  saving.value = true
  formError.value = null
  try {
    await portal.registerPackage({
      trackingNumber,
      quantity: form.quantity || 1,
      note: form.note.trim() || undefined,
    })
    formOpen.value = false
    toast.success('Ачаа бүртгэгдлээ', {
      description: 'Ачаа ирэхэд бид энэ дугаараар холбож, төлөвийг шинэчилнэ',
    })
    /**
     * Шинэ бичлэг эхний хуудсанд гарна (`-createdAt`) — шүүлттэй байсан ч
     * хэрэглэгч бүртгэсэн зүйлээ шууд харах ёстой. `status`/`page`-ийг
     * ӨӨРЧЛӨГДӨХ ҮЕД нь л оноож байгаа шалтгаан: `watch([page, status])`
     * өөрөө `load()` дуудна — шууд дуудвал хоёр хүсэлт зэрэг явна.
     */
    if (status.value !== 'all') status.value = 'all'
    else if (page.value !== 1) page.value = 1
    else await load()
  } catch (e: any) {
    formError.value = e?.response?.data?.message ?? 'Бүртгэж чадсангүй'
  } finally {
    saving.value = false
  }
}

useHead({ title: 'Миний ачаа — Ивээлт Карго' })
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-h1 font-bold text-content">Миний ачаа</h1>
        <p class="mt-1 text-body text-content-secondary">
          Нийт {{ pagination.total.toLocaleString('mn-MN') }} ачаа
        </p>
      </div>

      <div class="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
        <UiSelectInput v-model="status" :options="statusOptions" class="flex-1 sm:w-52" />
        <UiBtn variant="secondary" :icon="Truck" class="shrink-0" to="/my/deliveries/new">
          Хүргэлт үүсгэх
        </UiBtn>
        <UiBtn :icon="Plus" class="shrink-0" @click="openForm">Ачаа бүртгүүлэх</UiBtn>
      </div>
    </div>

    <p v-if="loading" class="py-10 text-center text-body text-content-secondary">Ачаалж байна…</p>

    <div
      v-else-if="!items.length"
      class="rounded-card border border-surface-border bg-surface-card px-5 py-14 text-center"
    >
      <Package :size="34" class="mx-auto text-content-disabled" :stroke-width="1.6" />
      <p class="mt-3 text-body text-content">
        {{ status === 'all' ? 'Танд бүртгэгдсэн ачаа алга байна' : 'Энэ төлөвт ачаа алга' }}
      </p>
      <p class="mx-auto mt-1 max-w-sm text-body-sm text-content-secondary">
        Ачаагаа урьдчилан бүртгүүлбэл Монголд ирэх замын явцыг энд хянана.
      </p>
      <UiBtn v-if="status === 'all'" :icon="Plus" class="mt-4" @click="openForm">
        Ачаа бүртгүүлэх
      </UiBtn>
    </div>

    <template v-else>
      <ul class="space-y-2.5">
        <li v-for="pkg in items" :key="pkg.id">
          <NuxtLink
            :to="`/my/packages/${pkg.id}`"
            class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-surface-border bg-surface-card px-4 py-3.5 transition-colors duration-200 hover:border-primary-300 sm:px-5"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold tabular text-content">{{ pkg.trackingNumber }}</p>
              <p class="truncate text-body-sm text-content-secondary">
                {{ pkg.customerNote || pkg.cargoType || 'Ачаа' }}
                <span v-if="pkg.weightKg"> · {{ pkg.weightKg }} кг</span>
                <span v-if="pkg.quantity > 1"> · {{ pkg.quantity }} ш</span>
              </p>
            </div>

            <!--
              Урьдчилсан бүртгэлд үнэ ХАРААХАН БАЙХГҮЙ (BR-46) — `finalPrice`
              нь 0. Түүнийг "0₮ · Төлөгдсөн" гэж харуулбал хэрэглэгч төлбөр
              төлөх шаардлагагүй гэж ойлгоно.
            -->
            <div v-if="isPreArrival(pkg.status)" class="text-right">
              <p class="text-body-sm text-content-secondary">Үнэ тодорхойгүй</p>
              <p class="text-body-sm text-content-disabled">Ачаа ирэхэд бодогдоно</p>
            </div>

            <div v-else class="text-right">
              <p class="font-semibold tabular text-content">
                {{ formatCurrency(pkg.finalPrice) }}
              </p>
              <p v-if="pkg.balance > 0" class="text-body-sm tabular text-warning">
                {{ formatCurrency(pkg.balance) }} үлдэгдэлтэй
              </p>
              <p v-else class="text-body-sm text-success">Төлөгдсөн</p>
            </div>

            <span
              class="shrink-0 rounded-full px-2.5 py-1 text-body-sm font-semibold"
              :style="{ color: style(pkg.status).color, backgroundColor: style(pkg.status).bg }"
            >
              {{ label(pkg.status) }}
            </span>
          </NuxtLink>
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

    <UiModal
      v-model="formOpen"
      persistent
      size="sm"
      title="Ачаа бүртгүүлэх"
      subtitle="Дэлгүүрээс өгсөн ачааны дугаараа бүртгүүлбэл ачаа ирэхэд шууд холбогдоно"
    >
      <form class="space-y-4" @submit.prevent="submit">
        <UiField
          label="Ачааны дугаар"
          required
          :error="formError"
          hint="Хятадын дэлгүүр/тээвэрлэгчээс өгсөн дугаар"
        >
          <UiTextInput
            v-model="form.trackingNumber"
            autofocus
            tabular
            placeholder="Жишээ: SF1234567890"
            @enter="submit"
          />
        </UiField>

        <UiField label="Тоо ширхэг">
          <UiTextInput v-model="form.quantity" type="number" tabular />
        </UiField>

        <UiField label="Тайлбар" hint="Ачаагаа таних тэмдэглэл — заавал биш">
          <UiTextArea v-model="form.note" :rows="2" placeholder="Жишээ: улаан цүнх, Taobao" />
        </UiField>

        <!--
          Хүлээлтийг ЗӨВ тавина: урьдчилсан бүртгэл нь ачаа ирснийг батлахгүй,
          үнэ ч энэ мөчид тодорхойгүй (§1.1, BR-46).
        -->
        <p class="rounded-btn bg-surface-hover px-3 py-2.5 text-body-sm text-content-secondary">
          Жин, үнийг ачаа Улаанбаатарт ирж, агуулахад хэмжигдсэний дараа
          бид тодорхойлж энд харуулна.
        </p>
      </form>

      <template #footer>
        <UiBtn variant="secondary" :disabled="saving" @click="formOpen = false">Болих</UiBtn>
        <UiBtn :loading="saving" @click="submit">Бүртгүүлэх</UiBtn>
      </template>
    </UiModal>
  </div>
</template>
