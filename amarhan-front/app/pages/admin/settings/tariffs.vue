<script setup lang="ts">
import { Plus, Pencil, History, Trash2, Settings2 } from 'lucide-vue-next'
import type { CargoType, TariffVersion, WeightBracket } from '~/composables/useTariffs'

/**
 * Тарифын удирдлага — introduction.md §1.2, roadmap 1.11
 *
 * 1кг/1м³-ийн үнэ, жингийн шатлал, доод хэмжээ — эдгээр Санхүүд ШУУД
 * нөлөөлдөг тул зөвхөн Админ засварлана (§9.1). Тариф ЗАСАХ нь хуучин
 * хувилбарыг дарж бичихгүй — шинэ хувилбар үүсгэдэг (BR-02): өмнө
 * бүртгэгдсэн ачааны үнэ хэвээр үлдэнэ. Backend `ROLE_GROUP.ADMIN`-аар
 * хаагдсан — энэ хуудасны эрхийн шалгалт зөвхөн эвгүй байдлаас сэргийлнэ.
 */
definePageMeta({ layout: 'admin', middleware: 'auth' })

const auth = useAuthStore()
const tariffs = useTariffs()
const toast = useToast()

const canEdit = computed(() => auth.isAdmin)

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('mn-MN')
}

const loading = ref(true)
const rows = ref<TariffVersion[]>([])

async function load() {
  loading.value = true
  try {
    rows.value = await tariffs.listActiveTariffs()
  } catch (e: any) {
    toast.error(e?.message ?? 'Тариф ачаалж чадсангүй')
  } finally {
    loading.value = false
  }
}
onMounted(load)

const EMPTY_CARGO_TYPE: CargoType = {
  id: '',
  code: '',
  name: '?',
  description: null,
  isActive: true,
  createdAt: '',
}

function cargoTypeOf(row: TariffVersion): CargoType {
  return typeof row.cargoTypeId === 'string' ? EMPTY_CARGO_TYPE : row.cargoTypeId
}

function newBracket(): WeightBracket {
  return { maxGrams: 0, price: 0 }
}

function cleanBrackets(list: WeightBracket[]) {
  return list
    .filter(b => Number(b.maxGrams) > 0)
    .map(b => ({ maxGrams: Number(b.maxGrams), price: Number(b.price) || 0 }))
}

// ── Тариф засах ──────────────────────────────────────────────────────────
const tariffOpen = ref(false)
const tariffBusy = ref(false)
const tariffTarget = ref<TariffVersion | null>(null)
const tariffForm = reactive({ pricePerKgAbove: 0, pricePerM3: 0, minimumCharge: 0, note: '' })
const tariffBrackets = ref<WeightBracket[]>([])

function openTariffEdit(row: TariffVersion) {
  tariffTarget.value = row
  tariffForm.pricePerKgAbove = row.pricePerKgAbove
  tariffForm.pricePerM3 = row.pricePerM3
  tariffForm.minimumCharge = row.minimumCharge
  tariffForm.note = ''
  tariffBrackets.value = row.weightBrackets.map(b => ({ ...b }))
  tariffOpen.value = true
}

async function saveTariff() {
  if (!tariffTarget.value) return
  const cargoType = cargoTypeOf(tariffTarget.value)
  tariffBusy.value = true
  try {
    await tariffs.changeTariff(cargoType.id, {
      weightBrackets: cleanBrackets(tariffBrackets.value),
      pricePerKgAbove: Number(tariffForm.pricePerKgAbove) || 0,
      pricePerM3: Number(tariffForm.pricePerM3) || 0,
      minimumCharge: Number(tariffForm.minimumCharge) || 0,
      note: tariffForm.note.trim() || undefined,
    })
    toast.success('Тариф шинэчлэгдлээ', { description: 'Өмнө бүртгэгдсэн ачааны үнэ хөдлөөгүй' })
    tariffOpen.value = false
    await load()
  } catch (e: any) {
    toast.error(e?.message ?? 'Хадгалж чадсангүй')
  } finally {
    tariffBusy.value = false
  }
}

// ── Ачааны төрлийн мэдээлэл засах (нэр/тайлбар/идэвх) ──────────────────────
const infoOpen = ref(false)
const infoBusy = ref(false)
const infoTarget = ref<CargoType | null>(null)
const infoForm = reactive({ name: '', description: '', isActive: true })

function openInfoEdit(cargoType: CargoType) {
  infoTarget.value = cargoType
  infoForm.name = cargoType.name
  infoForm.description = cargoType.description ?? ''
  infoForm.isActive = cargoType.isActive
  infoOpen.value = true
}

async function saveInfo() {
  if (!infoTarget.value) return
  infoBusy.value = true
  try {
    await tariffs.updateCargoType(infoTarget.value.id, {
      name: infoForm.name.trim(),
      description: infoForm.description.trim() || null,
      isActive: infoForm.isActive,
    })
    toast.success('Мэдээлэл хадгалагдлаа')
    infoOpen.value = false
    await load()
  } catch (e: any) {
    toast.error(e?.message ?? 'Хадгалж чадсангүй')
  } finally {
    infoBusy.value = false
  }
}

// ── Шинэ ачааны төрөл + анхны тариф ─────────────────────────────────────────
const createOpen = ref(false)
const createBusy = ref(false)
const createForm = reactive({
  code: '',
  name: '',
  description: '',
  pricePerKgAbove: 0,
  pricePerM3: 0,
  minimumCharge: 0,
})
const createBrackets = ref<WeightBracket[]>([])

function openCreate() {
  createForm.code = ''
  createForm.name = ''
  createForm.description = ''
  createForm.pricePerKgAbove = 0
  createForm.pricePerM3 = 0
  createForm.minimumCharge = 0
  createBrackets.value = []
  createOpen.value = true
}

async function submitCreate() {
  createBusy.value = true
  try {
    await tariffs.createCargoType({
      code: createForm.code.trim().toLowerCase(),
      name: createForm.name.trim(),
      description: createForm.description.trim() || null,
      weightBrackets: cleanBrackets(createBrackets.value),
      pricePerKgAbove: Number(createForm.pricePerKgAbove) || 0,
      pricePerM3: Number(createForm.pricePerM3) || 0,
      minimumCharge: Number(createForm.minimumCharge) || 0,
    })
    toast.success('Ачааны төрөл нэмэгдлээ')
    createOpen.value = false
    await load()
  } catch (e: any) {
    toast.error(e?.message ?? 'Үүсгэж чадсангүй')
  } finally {
    createBusy.value = false
  }
}

// ── Тарифын түүх ─────────────────────────────────────────────────────────
const historyOpen = ref(false)
const historyLoading = ref(false)
const historyRows = ref<TariffVersion[]>([])

async function openHistory(cargoType: CargoType) {
  historyOpen.value = true
  historyLoading.value = true
  try {
    historyRows.value = await tariffs.listTariffHistory(cargoType.id)
  } catch (e: any) {
    toast.error(e?.message ?? 'Түүх ачаалж чадсангүй')
  } finally {
    historyLoading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-5">
    <UiPageHeader
      title="Тарифын удирдлага"
      subtitle="Ачааны төрөл тус бүрийн 1кг/1м³-ийн үнэ, жингийн шатлал. Өөрчлөлт зөвхөн шинэ бүртгэлд нөлөөлнө."
    >
      <template #actions>
        <UiBtn v-if="canEdit" :icon="Plus" @click="openCreate">Шинэ төрөл нэмэх</UiBtn>
      </template>
    </UiPageHeader>

    <div
      v-if="!canEdit"
      class="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-body text-content"
    >
      Тарифыг зөвхөн Админ засварлана. Та мэдээллийг харж болно.
    </div>

    <p v-if="loading" class="py-10 text-center text-body text-content-secondary">Ачаалж байна…</p>
    <p v-else-if="!rows.length" class="py-10 text-center text-body text-content-secondary">
      Ачааны төрөл бүртгэгдээгүй байна.
    </p>

    <section
      v-for="row in rows"
      :key="row.id"
      class="rounded-card border border-surface-border bg-surface-card p-5"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="font-semibold text-content">{{ cargoTypeOf(row).name }}</h2>
            <span class="text-body-sm text-content-secondary">{{ cargoTypeOf(row).code }}</span>
            <span
              class="inline-flex rounded-full px-2 py-1 text-body-sm font-medium"
              :class="
                cargoTypeOf(row).isActive
                  ? 'bg-success/10 text-success'
                  : 'bg-surface-hover text-content-secondary'
              "
            >
              {{ cargoTypeOf(row).isActive ? 'Идэвхтэй' : 'Идэвхгүй' }}
            </span>
          </div>
          <p v-if="cargoTypeOf(row).description" class="mt-1 text-body-sm text-content-secondary">
            {{ cargoTypeOf(row).description }}
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <UiBtn size="sm" variant="ghost" :icon="History" @click="openHistory(cargoTypeOf(row))">
            Түүх
          </UiBtn>
          <UiBtn
            size="sm"
            variant="ghost"
            :icon="Settings2"
            :disabled="!canEdit"
            @click="openInfoEdit(cargoTypeOf(row))"
          >
            Мэдээлэл
          </UiBtn>
          <UiBtn
            size="sm"
            variant="secondary"
            :icon="Pencil"
            :disabled="!canEdit"
            @click="openTariffEdit(row)"
          >
            Тариф засах
          </UiBtn>
        </div>
      </div>

      <dl class="mt-4 grid grid-cols-2 gap-4 border-t border-surface-border pt-4 sm:grid-cols-3">
        <div>
          <dt class="text-body-sm text-content-secondary">1 кг-ийн үнэ (шатлалаас дээш)</dt>
          <dd class="tabular text-body font-semibold text-content">
            {{ formatCurrency(row.pricePerKgAbove) }}
          </dd>
        </div>
        <div>
          <dt class="text-body-sm text-content-secondary">1 м³-ийн үнэ</dt>
          <dd class="tabular text-body font-semibold text-content">
            {{ formatCurrency(row.pricePerM3) }}
          </dd>
        </div>
        <div>
          <dt class="text-body-sm text-content-secondary">Доод хэмжээ</dt>
          <dd class="tabular text-body font-semibold text-content">
            {{ row.minimumCharge ? formatCurrency(row.minimumCharge) : '—' }}
          </dd>
        </div>
      </dl>

      <div v-if="row.weightBrackets.length" class="mt-4 border-t border-surface-border pt-4">
        <p class="text-body-sm font-medium text-content-secondary">Жингийн шатлал</p>
        <ul class="mt-2 flex flex-wrap gap-2">
          <li
            v-for="(b, i) in row.weightBrackets"
            :key="i"
            class="rounded-btn bg-surface-hover px-3 py-1.5 text-body-sm text-content"
          >
            {{ b.maxGrams }}гр хүртэл — {{ formatCurrency(b.price) }}
          </li>
        </ul>
      </div>

      <p v-if="row.note" class="mt-3 text-body-sm italic text-content-secondary">«{{ row.note }}»</p>
      <p class="mt-3 text-body-sm text-content-secondary">
        Хүчинтэй болсон: {{ formatDate(row.effectiveFrom) }}
      </p>
    </section>

    <!-- Тариф засах модал -->
    <UiModal v-model="tariffOpen" title="Тариф өөрчлөх" size="lg">
      <div class="space-y-4">
        <p class="text-body text-content-secondary">
          Шинэ хувилбар үүснэ — өмнө бүртгэгдсэн ачааны үнэ хөдлөхгүй (BR-02).
        </p>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <UiField label="1 кг-ийн үнэ (шатлалаас дээш)" required>
            <UiTextInput v-model="tariffForm.pricePerKgAbove" type="number" suffix="₮" tabular />
          </UiField>
          <UiField label="1 м³-ийн үнэ" required>
            <UiTextInput v-model="tariffForm.pricePerM3" type="number" suffix="₮" tabular />
          </UiField>
          <UiField label="Доод хэмжээ">
            <UiTextInput v-model="tariffForm.minimumCharge" type="number" suffix="₮" tabular />
          </UiField>
        </div>

        <div>
          <div class="flex items-center justify-between">
            <p class="text-body font-medium text-content">Жингийн шатлал</p>
            <UiBtn size="sm" variant="secondary" :icon="Plus" @click="tariffBrackets.push(newBracket())">
              Мөр нэмэх
            </UiBtn>
          </div>

          <p v-if="!tariffBrackets.length" class="mt-2 text-body-sm text-content-secondary">
            Шатлалгүй — ачаа эхнээсээ кг-аар тооцогдоно.
          </p>

          <div v-else class="mt-3 space-y-2">
            <div v-for="(b, i) in tariffBrackets" :key="i" class="flex items-center gap-2">
              <UiTextInput v-model="b.maxGrams" type="number" suffix="гр хүртэл" tabular class="flex-1" />
              <UiTextInput v-model="b.price" type="number" suffix="₮" tabular class="flex-1" />
              <UiBtn
                variant="ghost"
                size="sm"
                :icon="Trash2"
                aria-label="Мөр устгах"
                @click="tariffBrackets.splice(i, 1)"
              />
            </div>
          </div>
        </div>

        <UiField label="Тайлбар" hint="Заавал биш. Audit-д бичигдэнэ.">
          <UiTextArea v-model="tariffForm.note" :rows="2" placeholder="Жишээ: 2026 оны 3-р улирлын нэмэгдэл" />
        </UiField>
      </div>

      <template #footer>
        <UiBtn variant="secondary" @click="tariffOpen = false">Болих</UiBtn>
        <UiBtn :loading="tariffBusy" @click="saveTariff">Хадгалах</UiBtn>
      </template>
    </UiModal>

    <!-- Ачааны төрлийн мэдээлэл засах модал -->
    <UiModal v-model="infoOpen" title="Ачааны төрлийн мэдээлэл" size="sm">
      <div class="space-y-4">
        <UiField label="Нэр" required>
          <UiTextInput v-model="infoForm.name" />
        </UiField>
        <UiField label="Тайлбар">
          <UiTextArea v-model="infoForm.description" :rows="2" />
        </UiField>
        <UiField label="Төлөв">
          <UiSelectInput
            :model-value="infoForm.isActive ? 'true' : 'false'"
            :options="[
              { value: 'true', label: 'Идэвхтэй' },
              { value: 'false', label: 'Идэвхгүй' },
            ]"
            @update:model-value="v => (infoForm.isActive = v === 'true')"
          />
        </UiField>
      </div>

      <template #footer>
        <UiBtn variant="secondary" @click="infoOpen = false">Болих</UiBtn>
        <UiBtn :loading="infoBusy" @click="saveInfo">Хадгалах</UiBtn>
      </template>
    </UiModal>

    <!-- Шинэ ачааны төрөл үүсгэх модал -->
    <UiModal v-model="createOpen" title="Шинэ ачааны төрөл" size="lg">
      <div class="space-y-4">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UiField label="Код" required hint="Жижиг үсэг, тоо, доогуур зураас">
            <UiTextInput v-model="createForm.code" placeholder="regular" />
          </UiField>
          <UiField label="Нэр" required>
            <UiTextInput v-model="createForm.name" placeholder="Энгийн ачаа" />
          </UiField>
        </div>
        <UiField label="Тайлбар">
          <UiTextArea v-model="createForm.description" :rows="2" />
        </UiField>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <UiField label="1 кг-ийн үнэ (шатлалаас дээш)" required>
            <UiTextInput v-model="createForm.pricePerKgAbove" type="number" suffix="₮" tabular />
          </UiField>
          <UiField label="1 м³-ийн үнэ" required>
            <UiTextInput v-model="createForm.pricePerM3" type="number" suffix="₮" tabular />
          </UiField>
          <UiField label="Доод хэмжээ">
            <UiTextInput v-model="createForm.minimumCharge" type="number" suffix="₮" tabular />
          </UiField>
        </div>

        <div>
          <div class="flex items-center justify-between">
            <p class="text-body font-medium text-content">Жингийн шатлал</p>
            <UiBtn size="sm" variant="secondary" :icon="Plus" @click="createBrackets.push(newBracket())">
              Мөр нэмэх
            </UiBtn>
          </div>

          <p v-if="!createBrackets.length" class="mt-2 text-body-sm text-content-secondary">
            Шатлалгүй — ачаа эхнээсээ кг-аар тооцогдоно.
          </p>

          <div v-else class="mt-3 space-y-2">
            <div v-for="(b, i) in createBrackets" :key="i" class="flex items-center gap-2">
              <UiTextInput v-model="b.maxGrams" type="number" suffix="гр хүртэл" tabular class="flex-1" />
              <UiTextInput v-model="b.price" type="number" suffix="₮" tabular class="flex-1" />
              <UiBtn
                variant="ghost"
                size="sm"
                :icon="Trash2"
                aria-label="Мөр устгах"
                @click="createBrackets.splice(i, 1)"
              />
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <UiBtn variant="secondary" @click="createOpen = false">Болих</UiBtn>
        <UiBtn :loading="createBusy" @click="submitCreate">Үүсгэх</UiBtn>
      </template>
    </UiModal>

    <!-- Тарифын түүх модал -->
    <UiModal v-model="historyOpen" title="Тарифын түүх" size="lg">
      <p v-if="historyLoading" class="py-6 text-center text-body text-content-secondary">
        Ачаалж байна…
      </p>
      <p v-else-if="!historyRows.length" class="py-6 text-center text-body text-content-secondary">
        Түүх алга.
      </p>
      <ul v-else class="space-y-3">
        <li
          v-for="h in historyRows"
          :key="h.id"
          class="rounded-btn border border-surface-border p-3.5"
          :class="h.effectiveTo === null ? 'border-primary-200 bg-primary-50/40' : ''"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-body-sm font-medium text-content">
              {{ formatDate(h.effectiveFrom) }} —
              {{ h.effectiveTo ? formatDate(h.effectiveTo) : 'одоог хүртэл' }}
            </span>
            <span
              v-if="h.effectiveTo === null"
              class="inline-flex rounded-full bg-primary-100 px-2 py-0.5 text-body-sm font-medium text-primary-600"
            >
              Идэвхтэй
            </span>
          </div>
          <p class="mt-1.5 tabular text-body-sm text-content-secondary">
            {{ formatCurrency(h.pricePerKgAbove) }}/кг ·
            {{ formatCurrency(h.pricePerM3) }}/м³ ·
            доод {{ h.minimumCharge ? formatCurrency(h.minimumCharge) : '0₮' }}
          </p>
          <p v-if="h.note" class="mt-1 text-body-sm italic text-content-secondary">«{{ h.note }}»</p>
        </li>
      </ul>
    </UiModal>
  </div>
</template>
