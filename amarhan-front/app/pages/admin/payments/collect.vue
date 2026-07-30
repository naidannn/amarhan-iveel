<script setup lang="ts">
import { Search, FileText, Wallet, Printer, PackageCheck, ArrowLeft } from 'lucide-vue-next'
import { usePayments, type Invoice, type Payment } from '~/composables/usePayments'
import type { CargoPackage } from '~/composables/usePackages'

/**
 * Олон ачааг нэг дор хүлээлгэн өгөх — introduction.md §1.9, §2.3
 *
 * ХЭРЭГЦЭЭ: хэрэглэгч 20–40 ачаа нэг дор авдаг. Ачаа болгоны хуудсаар орж
 * төлбөр авах нь цаг үрсэн, алдаатай тооцоо гаргах эрсдэлтэй.
 *
 * УРСГАЛ (§2.3): утас → ачаа сонгох → нэхэмжлэх → төлбөр → хэвлэх → хүлээлгэх.
 * Дөрвөн алхам НЭГ хуудсанд байгаа шалтгаан: ажилтан хэрэглэгчийн урд сууж
 * байна, хуудас хооронд үсрэх бүрт хүлээлт үүсэх ба §1.4-ийн хурдны шаардлага
 * зөрчигдөнө.
 *
 * ДҮНГ CLIENT ТАЛД БОДОХГҮЙ. Нэхэмжлэхийн дүн, хуваарилалт, үлдэгдэл бүгд
 * backend-ээс ирнэ (BR-14, BR-17). Энд бодвол баримт ба бүртгэл зөрнө.
 */
definePageMeta({ layout: 'admin', middleware: 'auth' })
useHead({ title: 'Төлбөр авах — Ивээл Карго' })

const api = usePayments()
const packageApi = usePackages()
const toast = useToast()

type Step = 'search' | 'select' | 'pay'

const step = ref<Step>('search')
const phone = ref('')
const busy = ref(false)

const customer = ref<{ id: string; phone: string; name: string | null } | null>(null)
const packages = ref<CargoPackage[]>([])
const selected = ref<string[]>([])

const invoice = ref<Invoice | null>(null)
const invoicePayments = ref<Payment[]>([])
const invoiceBalance = ref(0)

const payOpen = ref(false)
const printOpen = ref(false)

const selectedPackages = computed(() => packages.value.filter(p => selected.value.includes(p.id)))

/**
 * Сонгосон ачааны нийт үлдэгдэл — ЗӨВХӨН ХАРУУЛАХ зорилгоор.
 * Нэхэмжлэх үүсэхэд backend үлдэгдлийг ДАХИН уншиж бодно (BR-16): ажилтан
 * жагсаалт үзэж байх зуур өөр ажилтан төлбөр авсан байж болно.
 */
const selectedTotal = computed(() => selectedPackages.value.reduce((s, p) => s + p.balance, 0))

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
    const result = await api.payableByPhone(value)
    customer.value = result.customer
    packages.value = result.packages
    // Бүгдийг ӨМНӨӨС сонгоно — хамгийн түгээмэл тохиолдол нь "бүгдийг авах"
    selected.value = result.packages.map(p => p.id)
    invoice.value = null

    if (result.packages.length === 0) {
      toast.info('Төлбөр хүлээгдэж буй ачаа байхгүй', {
        description: 'Бүх ачаа төлөгдсөн эсвэл бүртгэгдээгүй байна',
      })
      step.value = 'search'
      return
    }

    step.value = 'select'
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

// ── 2. Нэхэмжлэх үүсгэх ──────────────────────────────────────────────────

async function makeInvoice() {
  if (selected.value.length === 0) {
    toast.error('Ачаа сонгоно уу')
    return
  }

  busy.value = true
  try {
    const created = await api.createInvoice(selected.value)
    await loadInvoice(created.id)
    step.value = 'pay'
    toast.success(`Нэхэмжлэх ${created.invoiceNumber} үүслээ`)
  } catch (e: any) {
    toast.error('Нэхэмжлэх үүссэнгүй', { description: e.message, duration: 9000 })
  } finally {
    busy.value = false
  }
}

async function loadInvoice(id: string) {
  const detail = await api.invoiceDetail(id)
  invoice.value = detail.invoice
  invoicePayments.value = detail.payments
  invoiceBalance.value = detail.balance
}

// ── 3. Төлбөр ────────────────────────────────────────────────────────────

async function afterPaid() {
  if (!invoice.value) return
  await loadInvoice(invoice.value.id)

  if (invoiceBalance.value === 0) {
    toast.success('Нэхэмжлэх бүрэн төлөгдлөө', { description: 'Ачааг хүлээлгэн өгч болно' })
  }
}

/**
 * §1.9 — бүрэн төлөгдсөний дараа ачааг нэг дор хүлээлгэн өгнө.
 *
 * `picked_up` руу шилжүүлнэ (салбараас авсан). Хүргэлтээр авах бол Хүргэлтийн
 * модуль (§5, Phase 4) үүсгэнэ — тэр нь тусдаа урсгал.
 */
async function handOver() {
  if (!invoice.value) return

  busy.value = true
  try {
    const ids = invoice.value.items.map(item =>
      typeof item.packageId === 'object' && item.packageId !== null
        ? item.packageId.id
        : String(item.packageId)
    )

    const result = await packageApi.changeStatusBulk(ids, 'picked_up')

    if (result.succeeded.length) {
      toast.success(`${result.succeeded.length} ачаа хүлээлгэн өгөгдлөө`)
    }
    // Бүтэлгүйтсэнийг ЧИМЭЭГҮЙ алгасахгүй — ажилтан аль ачаа гараагүйг мэдэх ёстой
    if (result.failed.length) {
      toast.warning(`${result.failed.length} ачаа шилжсэнгүй`, {
        description: result.failed[0]?.message,
        duration: 9000,
      })
    }

    reset()
  } catch (e: any) {
    toast.error('Хүлээлгэн өгөх боломжгүй', { description: e.message, duration: 9000 })
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
  invoice.value = null
  invoicePayments.value = []
  invoiceBalance.value = 0
}

function backToSelect() {
  step.value = 'select'
  invoice.value = null
}
</script>

<template>
  <div>
    <UiPageHeader
      title="Төлбөр авах"
      subtitle="Олон ачааг нэг нэхэмжлэхээр төлүүлж, нэг дор хүлээлгэн өгнө"
    >
      <template #actions>
        <UiBtn variant="secondary" to="/admin/payments">Төлбөрийн жагсаалт</UiBtn>
      </template>
    </UiPageHeader>

    <!-- Алхмын заагч — ажилтан хаана байгаагаа үргэлж харна -->
    <ol class="mb-6 flex flex-wrap items-center gap-2 text-body-sm">
      <li
        v-for="(item, index) in [
          { key: 'search', label: 'Харилцагч' },
          { key: 'select', label: 'Ачаа сонгох' },
          { key: 'pay', label: 'Төлбөр ба баримт' },
        ]"
        :key="item.key"
        class="flex items-center gap-2"
      >
        <span
          class="flex h-6 w-6 items-center justify-center rounded-full font-semibold"
          :class="
            step === item.key
              ? 'bg-primary text-white'
              : 'bg-surface-hover text-content-secondary'
          "
        >
          {{ index + 1 }}
        </span>
        <span :class="step === item.key ? 'font-semibold text-content' : 'text-content-secondary'">
          {{ item.label }}
        </span>
        <span v-if="index < 2" class="text-content-disabled">→</span>
      </li>
    </ol>

    <!-- ── 1. Утсаар хайх ─────────────────────────────────────────────── -->
    <div v-if="step === 'search'" class="card max-w-xl">
      <UiField
        label="Харилцагчийн утас"
        required
        hint="Ачаа утасны дугаараар харилцагчид холбогддог (§1.1)"
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
    </div>

    <!-- ── 2. Ачаа сонгох ─────────────────────────────────────────────── -->
    <div v-else-if="step === 'select'" class="space-y-4">
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
              Төлбөр хүлээгдэж буй {{ packages.length }} ачаа
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
                <th class="px-4 py-3 text-right text-body-sm font-medium text-content-secondary">
                  Үнэ
                </th>
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
                <td class="tabular px-4 py-3 text-right text-body text-content-secondary">
                  {{ formatCurrency(p.finalPrice) }}
                </td>
                <td class="tabular px-4 py-3 text-right text-body font-semibold text-error">
                  {{ formatCurrency(p.balance) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Нийт дүн ба дараагийн алхам -->
      <div class="card flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="text-body text-content-secondary">
            {{ selected.length }} ачаа сонгогдсон
          </p>
          <p class="tabular text-h2 font-bold text-content">{{ formatCurrency(selectedTotal) }}</p>
        </div>

        <UiBtn
          :loading="busy"
          :disabled="selected.length === 0"
          :icon="FileText"
          @click="makeInvoice"
        >
          Нэхэмжлэх үүсгэх
        </UiBtn>
      </div>
    </div>

    <!-- ── 3. Төлбөр ба баримт ────────────────────────────────────────── -->
    <div v-else-if="step === 'pay' && invoice" class="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div class="card">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="tabular text-h4 font-bold text-content">{{ invoice.invoiceNumber }}</p>
            <p class="tabular text-body-sm text-content-secondary">
              {{ invoice.customerPhone }} · {{ invoice.items.length }} ачаа
            </p>
          </div>
          <UiStatusBadge :status="invoice.status" kind="invoice" />
        </div>

        <table class="w-full border-collapse text-left">
          <thead>
            <tr class="border-b border-surface-border">
              <th class="py-2 text-body-sm font-medium text-content-secondary">Ачааны дугаар</th>
              <th class="py-2 text-right text-body-sm font-medium text-content-secondary">Дүн</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in invoice.items"
              :key="item.trackingNumber"
              class="border-b border-surface-border last:border-0"
            >
              <td class="tabular py-2.5 text-body text-content">{{ item.trackingNumber }}</td>
              <td class="tabular py-2.5 text-right text-body text-content">
                {{ formatCurrency(item.amount) }}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Хийгдсэн төлбөрүүд — хуваасан төлбөрийн явцыг харна (BR-13) -->
        <div v-if="invoicePayments.length" class="mt-5 border-t border-surface-border pt-4">
          <p class="mb-2 text-body font-semibold text-content">Хийгдсэн төлбөр</p>
          <ul class="space-y-2">
            <li
              v-for="p in invoicePayments"
              :key="p.id"
              class="flex items-center justify-between gap-3 text-body-sm"
            >
              <span class="flex items-center gap-2">
                <UiStatusBadge :status="p.method" kind="method" size="sm" />
                <UiStatusBadge
                  v-if="p.status !== 'completed'"
                  :status="p.status"
                  kind="record"
                  size="sm"
                />
              </span>
              <span
                class="tabular font-medium"
                :class="p.status === 'voided' ? 'text-content-disabled line-through' : 'text-content'"
              >
                {{ formatCurrency(p.amount) }}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <!-- Үйлдлийн хэсэг -->
      <div class="space-y-4">
        <div class="card">
          <dl class="space-y-2 text-body">
            <div class="flex justify-between">
              <dt class="text-content-secondary">Нийт</dt>
              <dd class="tabular font-medium text-content">
                {{ formatCurrency(invoice.totalAmount) }}
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-content-secondary">Төлөгдсөн</dt>
              <dd class="tabular font-medium text-success">
                {{ formatCurrency(invoice.paidAmount) }}
              </dd>
            </div>
          </dl>

          <div class="mt-3 flex items-baseline justify-between border-t border-surface-border pt-3">
            <span class="text-body font-semibold text-content">Үлдэгдэл</span>
            <span
              class="tabular text-h2 font-bold"
              :class="invoiceBalance > 0 ? 'text-error' : 'text-success'"
            >
              {{ formatCurrency(invoiceBalance) }}
            </span>
          </div>

          <UiBtn
            v-if="invoiceBalance > 0"
            class="mt-4"
            :icon="Wallet"
            block
            @click="payOpen = true"
          >
            Төлбөр авах
          </UiBtn>

          <UiBtn class="mt-2" variant="secondary" :icon="Printer" block @click="printOpen = true">
            Нэхэмжлэх хэвлэх
          </UiBtn>
        </div>

        <!--
          §1.9 — бүрэн төлөгдсөний ДАРАА л хүлээлгэн өгнө. Backend мөн хаана
          (BR-19) — энд товч нуух нь хамгаалалт биш, зөвхөн урсгалын заавар.
        -->
        <div v-if="invoiceBalance === 0" class="card">
          <p class="mb-3 text-body text-content-secondary">
            Төлбөр бүрэн төлөгдсөн. Ачааг хэрэглэгчид хүлээлгэн өгнө үү.
          </p>
          <UiBtn variant="success" :icon="PackageCheck" block :loading="busy" @click="handOver">
            {{ invoice.items.length }} ачааг хүлээлгэн өгөх
          </UiBtn>
        </div>

        <UiBtn variant="ghost" :icon="ArrowLeft" block @click="backToSelect">
          Ачаа сонголт руу буцах
        </UiBtn>
      </div>
    </div>

    <PaymentPayModal
      v-if="invoice"
      v-model="payOpen"
      :packages="selectedPackages"
      :invoice-id="invoice.id"
      :invoice-balance="invoiceBalance"
      @paid="afterPaid"
    />

    <PaymentInvoiceSheet
      v-if="invoice"
      v-model="printOpen"
      :invoice="invoice"
      :payments="invoicePayments"
      :balance="invoiceBalance"
    />
  </div>
</template>
