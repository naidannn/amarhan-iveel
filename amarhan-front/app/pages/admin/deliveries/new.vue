<script setup lang="ts">
import { Search, Truck, ArrowLeft, AlertTriangle, User } from 'lucide-vue-next'
import { useDeliveries } from '~/composables/useDeliveries'
import type { CargoPackage } from '~/composables/usePackages'

/**
 * Хүргэлт үүсгэх — introduction.md §5.1 (roadmap 4.4)
 *
 * УРСГАЛ: утас → ачаа сонгох → хаяг, жолооч → үүсгэх.
 * `payments/collect.vue`-ийн ижил бүтэц: ажилтан хэрэглэгчийн урд сууж байна,
 * хуудас хооронд үсрэх бүрт хүлээлт үүснэ.
 *
 * §5.2 — ЭНД ТӨЛБӨР ШААРДАХГҮЙ. Хүргэлт үүсгэх нь маршрут БЭЛДЭХ үйлдэл;
 * хаалт нь «Хүргэлтэнд гаргах» товч дээр (дэлгэрэнгүй хуудас). Гэхдээ төлбөр
 * дутуу ачааг ЭНД тодоор харуулна — ажилтан гарахын өмнө төлүүлэх ёстойгоо
 * мэдэж байх ёстой, сүүлийн мөчид биш.
 */
definePageMeta({ layout: 'admin', middleware: 'auth' })
useHead({ title: 'Хүргэлт үүсгэх — Ивээл Карго' })

const api = useDeliveries()
const toast = useToast()

type Step = 'search' | 'form'

const step = ref<Step>('search')
const phone = ref('')
const busy = ref(false)

const customer = ref<{ id: string; phone: string; name: string | null } | null>(null)
const packages = ref<CargoPackage[]>([])
const selected = ref<string[]>([])
const blockedDeliveries = ref<Array<{ id: string; deliveryNumber: string; status: string }>>([])

const form = reactive({
  address: '',
  phone: '',
  note: '',
  driverName: '',
  driverPhone: '',
  scheduledDate: '',
  fee: 0,
})

const selectedPackages = computed(() => packages.value.filter(p => selected.value.includes(p.id)))

/**
 * Сонгосон ачааны төлбөрийн үлдэгдэл — ЗӨВХӨН СЭРЭМЖЛҮҮЛЭХ зорилгоор.
 * Жинхэнэ шалгалт нь backend-д, гаргах мөчид ДАХИН уншиж хийгдэнэ (BR-20).
 */
const unpaidTotal = computed(() =>
  selectedPackages.value.reduce((sum, p) => sum + Math.max(p.balance, 0), 0)
)

const allSelected = computed(
  () => packages.value.length > 0 && selected.value.length === packages.value.length
)

// ── 1. Утсаар хайх ───────────────────────────────────────────────────────

async function search() {
  const value = phone.value.trim()
  if (value.length < 8) {
    toast.error('Утасны дугаарыг бүтнээр оруулна уу')
    return
  }

  busy.value = true
  try {
    const result = await api.deliverableByPhone(value)
    customer.value = result.customer
    packages.value = result.packages
    blockedDeliveries.value = result.inActiveDelivery
    // Бүгдийг ӨМНӨӨС сонгоно — хамгийн түгээмэл тохиолдол нь "бүгдийг хүргэх"
    selected.value = result.packages.map(p => p.id)
    form.phone = result.customer.phone

    if (result.packages.length === 0) {
      toast.info('Хүргэх боломжтой ачаа байхгүй', {
        description: blockedDeliveries.value.length
          ? 'Бүх ачаа аль хэдийн идэвхтэй хүргэлтэд байна'
          : 'Агуулахад байгаа ачаа олдсонгүй',
      })
      return
    }

    step.value = 'form'
  } catch (e: any) {
    toast.error('Харилцагч олдсонгүй', { description: e.message })
  } finally {
    busy.value = false
  }
}

function toggleAll() {
  selected.value = allSelected.value ? [] : packages.value.map(p => p.id)
}

function toggle(id: string) {
  selected.value = selected.value.includes(id)
    ? selected.value.filter(x => x !== id)
    : [...selected.value, id]
}

// ── 2. Хаяг, жолооч ба үүсгэх ────────────────────────────────────────────

async function submit() {
  if (selected.value.length === 0) {
    toast.error('Ачаа сонгоно уу')
    return
  }
  if (form.address.trim().length < 3) {
    toast.error('Хүргэх хаягийг бичнэ үү')
    return
  }

  busy.value = true
  try {
    const delivery = await api.create({
      packageIds: selected.value,
      address: form.address.trim(),
      phone: form.phone.trim() || undefined,
      note: form.note.trim() || undefined,
      driverName: form.driverName.trim() || undefined,
      driverPhone: form.driverPhone.trim() || undefined,
      scheduledDate: form.scheduledDate || null,
      fee: Number(form.fee) || 0,
    })

    toast.success(`Хүргэлт ${delivery.deliveryNumber} үүслээ`, {
      description:
        unpaidTotal.value > 0
          ? `Төлбөр дутуу: ${formatCurrency(unpaidTotal.value)} — гарахын өмнө төлүүлнэ`
          : 'Хүргэлтэнд гаргахад бэлэн',
    })

    await navigateTo(`/admin/deliveries/${delivery.id}`)
  } catch (e: any) {
    toast.error('Хүргэлт үүссэнгүй', { description: e.message, duration: 9000 })
  } finally {
    busy.value = false
  }
}

function reset() {
  step.value = 'search'
  phone.value = ''
  customer.value = null
  packages.value = []
  selected.value = []
  blockedDeliveries.value = []
  form.address = ''
  form.phone = ''
  form.note = ''
  form.driverName = ''
  form.driverPhone = ''
  form.scheduledDate = ''
  form.fee = 0
}
</script>

<template>
  <div>
    <UiPageHeader
      title="Хүргэлт үүсгэх"
      subtitle="Харилцагчийн ачааг багцалж, хаяг ба жолоочийг заана"
    >
      <template #actions>
        <UiBtn variant="secondary" to="/admin/deliveries">Хүргэлтийн жагсаалт</UiBtn>
      </template>
    </UiPageHeader>

    <!-- ── 1. Утсаар хайх ─────────────────────────────────────────────── -->
    <div v-if="step === 'search'" class="card max-w-xl">
      <UiField
        label="Харилцагчийн утас"
        required
        hint="Агуулахад байгаа, идэвхтэй хүргэлтэд ороогүй ачаа гарч ирнэ"
      >
        <UiTextInput
          v-model="phone"
          :icon="Search"
          type="tel"
          placeholder="99112233"
          tabular
          autofocus
          @enter="search"
        />
      </UiField>

      <UiBtn class="mt-4" :loading="busy" :icon="Search" @click="search">Ачааг хайх</UiBtn>

      <!-- Яагаад ачаа алга болсныг тайлбарлана (BR-20a) -->
      <div
        v-if="blockedDeliveries.length"
        class="mt-4 rounded-card border border-warning/30 bg-warning/5 p-3"
      >
        <p class="text-body-sm text-content">
          Энэ харилцагчийн зарим ачаа аль хэдийн идэвхтэй хүргэлтэд байна:
          <NuxtLink
            v-for="d in blockedDeliveries"
            :key="d.id"
            :to="`/admin/deliveries/${d.id}`"
            class="tabular font-semibold text-primary hover:underline"
          >
            {{ d.deliveryNumber }}
          </NuxtLink>
        </p>
      </div>
    </div>

    <!-- ── 2. Ачаа сонгох + хаяг ──────────────────────────────────────── -->
    <div v-else class="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div class="card">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="tabular text-h4 font-semibold text-content">
              {{ customer?.phone }}
              <span v-if="customer?.name" class="font-normal text-content-secondary">
                · {{ customer.name }}
              </span>
            </p>
            <p class="text-body-sm text-content-secondary">
              Хүргэх боломжтой {{ packages.length }} ачаа
            </p>
          </div>

          <UiBtn size="sm" variant="ghost" :icon="ArrowLeft" @click="reset">
            Өөр харилцагч
          </UiBtn>
        </div>

        <div class="overflow-hidden rounded-card border border-surface-border">
          <table class="w-full border-collapse text-left">
            <thead>
              <tr class="border-b border-surface-border bg-surface-hover">
                <th class="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    class="h-4 w-4 cursor-pointer rounded border-surface-border text-primary focus:ring-2 focus:ring-primary-200"
                    :checked="allSelected"
                    aria-label="Бүгдийг сонгох"
                    @change="toggleAll"
                  />
                </th>
                <th class="px-4 py-3 text-body-sm font-medium text-content-secondary">
                  Ачааны дугаар
                </th>
                <th class="px-4 py-3 text-body-sm font-medium text-content-secondary">Төлөв</th>
                <th class="px-4 py-3 text-body-sm font-medium text-content-secondary">Байршил</th>
                <th class="px-4 py-3 text-right text-body-sm font-medium text-content-secondary">
                  Үлдэгдэл
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="p in packages"
                :key="p.id"
                class="cursor-pointer border-b border-surface-border last:border-0 hover:bg-surface-hover"
                @click="toggle(p.id)"
              >
                <td class="px-4 py-3" @click.stop>
                  <input
                    type="checkbox"
                    class="h-4 w-4 cursor-pointer rounded border-surface-border text-primary focus:ring-2 focus:ring-primary-200"
                    :checked="selected.includes(p.id)"
                    :aria-label="`${p.trackingNumber} сонгох`"
                    @change="toggle(p.id)"
                  />
                </td>
                <td class="tabular px-4 py-3 text-body font-medium text-content">
                  {{ p.trackingNumber }}
                </td>
                <td class="px-4 py-3">
                  <UiStatusBadge :status="p.status" size="sm" />
                </td>
                <td class="tabular px-4 py-3 text-body-sm text-content-secondary">
                  {{ p.locationCode ?? '—' }}
                </td>
                <td
                  class="tabular px-4 py-3 text-right text-body font-semibold"
                  :class="p.balance > 0 ? 'text-error' : 'text-success'"
                >
                  {{ formatCurrency(p.balance) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Хаяг, жолооч, товлолт -->
      <div class="space-y-4">
        <div class="card space-y-4">
          <UiField label="Хүргэх хаяг" required>
            <UiTextArea
              v-model="form.address"
              :rows="2"
              placeholder="ХУД, 3-р хороо, 12-р байр, 34 тоот"
            />
          </UiField>

          <UiField
            label="Хүлээн авагчийн утас"
            hint="Харилцагчийнхаас өөр байж болно (гэр бүл, ажлын хаяг)"
          >
            <UiTextInput v-model="form.phone" type="tel" placeholder="99112233" tabular />
          </UiField>

          <UiField label="Товлосон огноо" hint="Өдрийн маршрутад бүлэглэгдэнэ">
            <UiTextInput v-model="form.scheduledDate" type="date" />
          </UiField>

          <UiField label="Жолооч" hint="Гэрээт жолоочийн нэрийг шууд бичиж болно">
            <UiTextInput v-model="form.driverName" :icon="User" placeholder="Батбаяр" />
          </UiField>

          <UiField label="Жолоочийн утас">
            <UiTextInput v-model="form.driverPhone" type="tel" placeholder="99001122" tabular />
          </UiField>

          <UiField
            label="Хүргэлтийн төлбөр"
            hint="Зөвхөн тэмдэглэл — ачааны төлбөрт НЭМЭГДЭХГҮЙ"
          >
            <UiTextInput v-model="form.fee" type="number" tabular suffix="₮" />
          </UiField>

          <UiField label="Тэмдэглэл">
            <UiTextArea v-model="form.note" :rows="2" placeholder="Оройн 6-аас хойш" />
          </UiField>
        </div>

        <!--
          §5.2 — төлбөр дутуу байгааг ЭРТ мэдэгдэнэ. Хүргэлт үүсгэхийг
          хориглохгүй (backend ч хориглохгүй) — зөвхөн гаргах товч хаагдана.
        -->
        <div
          v-if="unpaidTotal > 0"
          class="card border-warning/40 bg-warning/5"
        >
          <div class="flex gap-3">
            <AlertTriangle :size="20" class="shrink-0 text-warning" />
            <div>
              <p class="text-body font-semibold text-content">
                Төлбөр дутуу байна: {{ formatCurrency(unpaidTotal) }}
              </p>
              <p class="mt-1 text-body-sm text-content-secondary">
                Хүргэлт үүснэ, гэхдээ төлбөр бүрэн төлөгдтөл
                <strong>хүргэлтэнд гарахгүй</strong> (§5.2). Энэ шалгалтыг Админ ч тойрч
                чадахгүй.
              </p>
            </div>
          </div>
        </div>

        <div class="card flex flex-wrap items-center justify-between gap-4">
          <div>
            <p class="text-body text-content-secondary">{{ selected.length }} ачаа сонгогдсон</p>
          </div>
          <UiBtn
            :loading="busy"
            :disabled="selected.length === 0 || form.address.trim().length < 3"
            :icon="Truck"
            @click="submit"
          >
            Хүргэлт үүсгэх
          </UiBtn>
        </div>
      </div>
    </div>
  </div>
</template>
