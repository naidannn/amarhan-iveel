<script setup lang="ts">
import {
  Plus,
  Trash2,
  ExternalLink,
  ImagePlus,
  ArrowUp,
  ArrowDown,
  X,
  MapPin,
  Megaphone,
  Phone,
  HelpCircle,
  Banknote,
  ShoppingBag,
  BookOpen,
  Menu,
} from 'lucide-vue-next'

/**
 * Статик агуулга удирдах — roadmap 5.10
 *
 * Эрээний хаяг (§3), холбоо барих, түгээмэл асуулт, нүүрийн зарлал —
 * бүгд `settings` коллекцод `content.*` түлхүүрээр хадгалагдана.
 *
 * ЗӨВХӨН АДМИН: backend `PUT /settings/:key` нь `ROLE_GROUP.ADMIN`-аар
 * хаагдсан (§9.1). Энэ хуудасны эрхийн шалгалт нь зөвхөн эвгүй байдлаас
 * сэргийлнэ — жинхэнэ хамгаалалт backend талд.
 */
definePageMeta({ layout: 'admin', middleware: 'auth' })

const auth = useAuthStore()
const { $axios } = useNuxtApp()
const toast = useToast()

const KEYS = {
  erenhot: 'content.erenhot_address',
  contact: 'content.contact',
  faq: 'content.faq',
  notice: 'content.home_notice',
  yuanTransfer: 'content.yuan_transfer',
  linkOrder: 'content.link_order',
  addressGuides: 'content.address_guides',
} as const

/**
 * Хэсэг бүрийг тусад нь харуулах local sidebar — хуудас урт болж, гүйлгэхэд
 * төвөгтэй болсныг засав (7 хэсэг нэг дор жагссан байсан).
 */
const SECTIONS = [
  { id: 'erenhot', label: 'Эрээний хаяг', icon: MapPin },
  { id: 'notice', label: 'Нүүрийн зарлал', icon: Megaphone },
  { id: 'contact', label: 'Холбоо барих', icon: Phone },
  { id: 'faq', label: 'Түгээмэл асуулт', icon: HelpCircle },
  { id: 'yuanTransfer', label: 'Юань шилжүүлэг', icon: Banknote },
  { id: 'linkOrder', label: 'Линк захиалга', icon: ShoppingBag },
  { id: 'addressGuides', label: 'Хаяг холбох заавар', icon: BookOpen },
] as const
type SectionId = (typeof SECTIONS)[number]['id']

const route = useRoute()
const router = useRouter()
const activeSection = ref<SectionId>(
  SECTIONS.some(s => s.id === route.query.tab) ? (route.query.tab as SectionId) : SECTIONS[0].id
)
watch(activeSection, id => router.replace({ query: { ...route.query, tab: id } }))

const mobileNavOpen = ref(false)
function selectSection(id: SectionId) {
  activeSection.value = id
  mobileNavOpen.value = false
}

const erenhot = reactive({
  receiverName: '',
  phone: '',
  addressCn: '',
  addressMn: '',
  note: '',
})
const contact = reactive({
  phone: '',
  email: '',
  address: '',
  workingHours: '',
  facebook: '',
  messenger: '',
  wechat: '',
  website: '',
  googleMapsUrl: '',
})
const faq = ref<{ question: string; answer: string }[]>([])
const notice = ref('')

const yuanTransfer = reactive({
  rate: null as number | null,
  bankAccount: '',
  accountHolder: '',
  transferNote: '',
  facebookUrl: '',
  instructions: '',
})
const linkOrder = reactive({
  facebookUrl: '',
  instructions: '',
})

interface GuideBlock {
  imageUrl: string
  text: string
}
interface Guide {
  id: string
  platform: string
  thumbnailUrl: string
  blocks: GuideBlock[]
}
const guides = ref<Guide[]>([])

const loading = ref(true)
const saving = ref<string | null>(null)

onMounted(async () => {
  try {
    const { data } = await $axios.get('/api/v1/settings')
    Object.assign(erenhot, data.data[KEYS.erenhot] ?? {})
    Object.assign(contact, data.data[KEYS.contact] ?? {})
    faq.value = data.data[KEYS.faq] ?? []
    notice.value = data.data[KEYS.notice] ?? ''
    Object.assign(yuanTransfer, data.data[KEYS.yuanTransfer] ?? {})
    Object.assign(linkOrder, data.data[KEYS.linkOrder] ?? {})
    guides.value = data.data[KEYS.addressGuides] ?? []
  } catch (e: any) {
    toast.error(e?.response?.data?.message ?? 'Тохиргоо уншиж чадсангүй')
  } finally {
    loading.value = false
  }
})

async function save(key: string, value: unknown, successMessage: string) {
  saving.value = key
  try {
    await $axios.put(`/api/v1/settings/${key}`, { value })
    toast.success(successMessage, { description: 'Хэрэглэгчийн вэбэд шууд тусна' })
  } catch (e: any) {
    toast.error(e?.response?.data?.message ?? 'Хадгалж чадсангүй')
  } finally {
    saving.value = null
  }
}

const canEdit = computed(() => auth.isAdmin)

/**
 * Хаяг холбох зааврын зураг upload (thumbnail, алхмын зураг) —
 * `middlewares/upload.js` (backend), локал диск дээр хадгална.
 */
const apiBase = useRuntimeConfig().public.apiBase || 'http://localhost:4000'
function imageSrc(relativeUrl: string) {
  return relativeUrl ? `${apiBase}${relativeUrl}` : ''
}

const uploading = reactive<Record<string, boolean>>({})

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('image', file)
  const { data } = await $axios.post('/api/v1/uploads/images', formData)
  return data.data.url as string
}

async function handleUpload(key: string, file: File | undefined, apply: (url: string) => void) {
  if (!file) return
  uploading[key] = true
  try {
    apply(await uploadImage(file))
  } catch (e: any) {
    toast.error(e?.response?.data?.message ?? 'Зураг upload хийж чадсангүй')
  } finally {
    delete uploading[key]
  }
}

function onThumbnailChange(guide: Guide, event: Event) {
  const input = event.target as HTMLInputElement
  handleUpload(`thumb-${guide.id}`, input.files?.[0], url => (guide.thumbnailUrl = url))
  input.value = ''
}

function onBlockImageChange(guide: Guide, index: number, event: Event) {
  const input = event.target as HTMLInputElement
  handleUpload(`block-${guide.id}-${index}`, input.files?.[0], url => {
    guide.blocks[index].imageUrl = url
  })
  input.value = ''
}

function addGuide() {
  guides.value.push({
    id: crypto.randomUUID(),
    platform: '',
    thumbnailUrl: '',
    blocks: [{ imageUrl: '', text: '' }],
  })
}

function addBlock(guide: Guide) {
  guide.blocks.push({ imageUrl: '', text: '' })
}

/** Жагсаалтын дараалал = харагдах дараалал (FAQ-тай ижил конвенц) */
function moveItem<T>(list: T[], index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= list.length) return
  ;[list[index], list[target]] = [list[target], list[index]]
}

function saveGuides() {
  const cleaned = guides.value
    .filter(guide => guide.platform.trim())
    .map(guide => ({
      id: guide.id,
      platform: guide.platform.trim(),
      thumbnailUrl: guide.thumbnailUrl,
      blocks: guide.blocks.filter(block => block.imageUrl.trim() || block.text.trim()),
    }))
  save(KEYS.addressGuides, cleaned, 'Хаяг холбох заавар хадгалагдлаа')
}
</script>

<template>
  <div class="space-y-5">
    <UiPageHeader
      title="Статик агуулга"
      description="Хэрэглэгчийн вэбэд харагдах мэдээлэл. Хадгалмагц шууд шинэчлэгдэнэ."
    >
      <UiBtn variant="secondary" size="sm" :icon-right="ExternalLink" to="/address" target="_blank">
        Вэб дээр харах
      </UiBtn>
    </UiPageHeader>

    <div
      v-if="!canEdit"
      class="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-body text-content"
    >
      Статик агуулгыг зөвхөн Админ засварлана. Та мэдээллийг харж болно.
    </div>

    <p v-if="loading" class="py-10 text-center text-body text-content-secondary">Ачаалж байна…</p>

    <div v-else class="lg:flex lg:items-start lg:gap-5">
      <!-- Хэсгийн жагсаалт: lg-ээс дээш sidebar, доор нь унадаг цэс -->
      <button
        class="mb-3 flex w-full items-center gap-2 rounded-card border border-surface-border bg-surface-card px-3.5 py-2.5 text-body font-medium text-content lg:hidden"
        @click="mobileNavOpen = !mobileNavOpen"
      >
        <Menu :size="18" />
        <component :is="SECTIONS.find(s => s.id === activeSection)!.icon" :size="16" />
        {{ SECTIONS.find(s => s.id === activeSection)!.label }}
      </button>

      <nav
        class="mb-4 shrink-0 space-y-1 rounded-card border border-surface-border bg-surface-card p-2 lg:sticky lg:top-[4.5rem] lg:mb-0 lg:w-64"
        :class="mobileNavOpen ? 'block' : 'hidden lg:block'"
      >
        <button
          v-for="section in SECTIONS"
          :key="section.id"
          class="flex w-full items-center gap-3 rounded-btn px-3 py-2.5 text-left text-[14px] leading-5 font-medium transition-colors duration-200"
          :class="
            activeSection === section.id
              ? 'bg-primary-50 text-primary-600'
              : 'text-content-secondary hover:bg-surface-hover hover:text-content'
          "
          @click="selectSection(section.id)"
        >
          <component :is="section.icon" :size="18" :stroke-width="2" />
          <span class="truncate">{{ section.label }}</span>
        </button>
      </nav>

      <div class="min-w-0 flex-1 space-y-5">
      <!-- Эрээний хаяг (§3, 5.9) -->
      <section v-if="activeSection === 'erenhot'" class="rounded-card border border-surface-border bg-surface-card p-5">
        <h2 class="font-semibold text-content">Эрээн дэх хүлээн авах хаяг</h2>
        <p class="mt-1 text-body-sm text-content-secondary">
          Харилцагч Хятадын дэлгүүрт бичих хаяг. Энэ нь агуулахын байршлын код
          (8-р модуль) БИШ — тэр нь Монгол дахь агуулахыг заана.
        </p>

        <div class="mt-4 space-y-4">
          <UiField label="Хүлээн авагчийн нэр / код" for="receiver">
            <UiTextInput
              id="receiver"
              v-model="erenhot.receiverName"
              :disabled="!canEdit"
              placeholder="Ивээл карго / 001"
            />
          </UiField>

          <UiField label="Утас" for="erenhot-phone">
            <UiTextInput
              id="erenhot-phone"
              v-model="erenhot.phone"
              :disabled="!canEdit"
              placeholder="+86 ..."
            />
          </UiField>

          <UiField label="Хаяг (хятадаар)" for="address-cn">
            <UiTextArea
              id="address-cn"
              v-model="erenhot.addressCn"
              :disabled="!canEdit"
              :rows="2"
              :maxlength="1000"
              placeholder="内蒙古自治区二连浩特市..."
            />
          </UiField>

          <UiField label="Хаяг (монголоор)" for="address-mn">
            <UiTextArea
              id="address-mn"
              v-model="erenhot.addressMn"
              :disabled="!canEdit"
              :rows="2"
              :maxlength="1000"
            />
          </UiField>

          <UiField label="Нэмэлт тайлбар" for="erenhot-note">
            <UiTextArea
              id="erenhot-note"
              v-model="erenhot.note"
              :disabled="!canEdit"
              :rows="3"
              :maxlength="2000"
            />
          </UiField>

          <UiBtn
            :disabled="!canEdit"
            :loading="saving === KEYS.erenhot"
            @click="save(KEYS.erenhot, { ...erenhot }, 'Хаяг хадгалагдлаа')"
          >
            Хадгалах
          </UiBtn>
        </div>
      </section>

      <!-- Нүүрийн зарлал -->
      <section v-if="activeSection === 'notice'" class="rounded-card border border-surface-border bg-surface-card p-5">
        <h2 class="font-semibold text-content">Нүүр хуудасны зарлал</h2>
        <p class="mt-1 text-body-sm text-content-secondary">
          Хоосон үлдээвэл зарлал харагдахгүй.
        </p>

        <div class="mt-4 space-y-4">
          <UiTextArea
            v-model="notice"
            :disabled="!canEdit"
            :rows="3"
            :maxlength="1000"
            placeholder="Жишээ: 1-р сарын 20-25-нд агуулах хаалттай."
          />
          <UiBtn
            :disabled="!canEdit"
            :loading="saving === KEYS.notice"
            @click="save(KEYS.notice, notice.trim(), 'Зарлал хадгалагдлаа')"
          >
            Хадгалах
          </UiBtn>
        </div>
      </section>

      <!-- Холбоо барих -->
      <section v-if="activeSection === 'contact'" class="rounded-card border border-surface-border bg-surface-card p-5">
        <h2 class="font-semibold text-content">Холбоо барих</h2>

        <div class="mt-4 space-y-4">
          <UiField label="Утас" for="contact-phone">
            <UiTextInput id="contact-phone" v-model="contact.phone" :disabled="!canEdit" />
          </UiField>
          <UiField label="Имэйл" for="contact-email">
            <UiTextInput id="contact-email" v-model="contact.email" :disabled="!canEdit" />
          </UiField>
          <UiField label="Хаяг" for="contact-address">
            <UiTextArea
              id="contact-address"
              v-model="contact.address"
              :disabled="!canEdit"
              :rows="2"
              :maxlength="1000"
            />
          </UiField>
          <UiField label="Ажиллах цаг" for="hours">
            <UiTextInput
              id="hours"
              v-model="contact.workingHours"
              :disabled="!canEdit"
              placeholder="Даваа–Бямба 10:00–19:00"
            />
          </UiField>
          <UiField label="Facebook" for="facebook">
            <UiTextInput id="facebook" v-model="contact.facebook" :disabled="!canEdit" />
          </UiField>
          <UiField label="Messenger холбоос" for="messenger">
            <UiTextInput id="messenger" v-model="contact.messenger" :disabled="!canEdit" placeholder="https://m.me/..." />
          </UiField>
          <UiField label="WeChat ID / холбоос" for="wechat">
            <UiTextInput id="wechat" v-model="contact.wechat" :disabled="!canEdit" />
          </UiField>
          <UiField label="Вэб хуудас" for="website">
            <UiTextInput
              id="website"
              v-model="contact.website"
              :disabled="!canEdit"
              placeholder="www.iweeltcargo.com"
            />
          </UiField>
          <UiField label="Google Maps холбоос" for="google-maps">
            <UiTextInput
              id="google-maps"
              v-model="contact.googleMapsUrl"
              :disabled="!canEdit"
              placeholder="https://maps.app.goo.gl/..."
            />
          </UiField>

          <UiBtn
            :disabled="!canEdit"
            :loading="saving === KEYS.contact"
            @click="save(KEYS.contact, { ...contact }, 'Холбоо барих мэдээлэл хадгалагдлаа')"
          >
            Хадгалах
          </UiBtn>
        </div>
      </section>

      <!-- Түгээмэл асуулт -->
      <section v-if="activeSection === 'faq'" class="rounded-card border border-surface-border bg-surface-card p-5">
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-content">Түгээмэл асуулт</h2>
          <UiBtn
            size="sm"
            variant="secondary"
            :icon="Plus"
            :disabled="!canEdit || faq.length >= 50"
            @click="faq.push({ question: '', answer: '' })"
          >
            Нэмэх
          </UiBtn>
        </div>

        <p v-if="!faq.length" class="mt-4 text-body-sm text-content-secondary">
          Асуулт нэмээгүй байна.
        </p>

        <div v-else class="mt-4 space-y-4">
          <div
            v-for="(item, index) in faq"
            :key="index"
            class="space-y-3 rounded-btn border border-surface-border p-3.5"
          >
            <div class="flex gap-2">
              <UiTextInput
                v-model="item.question"
                :disabled="!canEdit"
                placeholder="Асуулт"
                class="flex-1"
              />
              <UiBtn
                variant="ghost"
                size="sm"
                :icon="Trash2"
                :disabled="!canEdit"
                aria-label="Асуулт устгах"
                @click="faq.splice(index, 1)"
              />
            </div>
            <UiTextArea
              v-model="item.answer"
              :disabled="!canEdit"
              :rows="3"
              :maxlength="3000"
              placeholder="Хариулт"
            />
          </div>
        </div>

        <UiBtn
          class="mt-4"
          :disabled="!canEdit"
          :loading="saving === KEYS.faq"
          @click="
            save(
              KEYS.faq,
              faq.filter(item => item.question.trim() && item.answer.trim()),
              'Түгээмэл асуулт хадгалагдлаа'
            )
          "
        >
          Хадгалах
        </UiBtn>
      </section>

      <!-- Туслах үйлчилгээ — Юань шилжүүлэг -->
      <section v-if="activeSection === 'yuanTransfer'" class="rounded-card border border-surface-border bg-surface-card p-5">
        <h2 class="font-semibold text-content">Туслах үйлчилгээ — Юань шилжүүлэг</h2>
        <p class="mt-1 text-body-sm text-content-secondary">
          Харилцагч Хятад руу юань мөнгө шилжүүлэхэд харагдах данс, ханш, зааврын мэдээлэл.
          Нүүр хуудас болон харилцагчийн хяналтын самбарт харагдана.
        </p>

        <div class="mt-4 space-y-4">
          <UiField label="Ханш (1¥ хэдэн ₮)" for="yuan-rate">
            <UiTextInput
              id="yuan-rate"
              v-model="yuanTransfer.rate"
              type="number"
              suffix="₮"
              :disabled="!canEdit"
              placeholder="Жишээ: 495"
            />
          </UiField>

          <UiField label="Дансны дугаар" for="yuan-account">
            <UiTextInput id="yuan-account" v-model="yuanTransfer.bankAccount" :disabled="!canEdit" />
          </UiField>

          <UiField label="Хүлээн авагчийн нэр" for="yuan-holder">
            <UiTextInput id="yuan-holder" v-model="yuanTransfer.accountHolder" :disabled="!canEdit" />
          </UiField>

          <UiField label="Гуйлгээний утга" for="yuan-note">
            <UiTextInput
              id="yuan-note"
              v-model="yuanTransfer.transferNote"
              :disabled="!canEdit"
              placeholder="yani"
            />
          </UiField>

          <UiField label="Facebook хуудасны холбоос" for="yuan-fb">
            <UiTextInput
              id="yuan-fb"
              v-model="yuanTransfer.facebookUrl"
              :disabled="!canEdit"
              placeholder="https://www.facebook.com/Iweeltcargo"
            />
          </UiField>

          <UiField label="Нэмэлт заавар" for="yuan-instructions">
            <UiTextArea
              id="yuan-instructions"
              v-model="yuanTransfer.instructions"
              :disabled="!canEdit"
              :rows="3"
              :maxlength="2000"
            />
          </UiField>

          <UiBtn
            :disabled="!canEdit"
            :loading="saving === KEYS.yuanTransfer"
            @click="save(KEYS.yuanTransfer, { ...yuanTransfer }, 'Юань шилжүүлгийн мэдээлэл хадгалагдлаа')"
          >
            Хадгалах
          </UiBtn>
        </div>
      </section>

      <!-- Туслах үйлчилгээ — Линк захиалга -->
      <section v-if="activeSection === 'linkOrder'" class="rounded-card border border-surface-border bg-surface-card p-5">
        <h2 class="font-semibold text-content">Туслах үйлчилгээ — Линк захиалга</h2>
        <p class="mt-1 text-body-sm text-content-secondary">
          Систем дотор захиалгын урсгал байхгүй — харилцагчийг доорх Facebook
          хуудас руу чиглүүлж, тэнд чатаар захиалга авна.
        </p>

        <div class="mt-4 space-y-4">
          <UiField label="Facebook хуудасны холбоос" for="link-order-fb">
            <UiTextInput
              id="link-order-fb"
              v-model="linkOrder.facebookUrl"
              :disabled="!canEdit"
              placeholder="https://www.facebook.com/..."
            />
          </UiField>

          <UiField label="Нэмэлт заавар" for="link-order-instructions">
            <UiTextArea
              id="link-order-instructions"
              v-model="linkOrder.instructions"
              :disabled="!canEdit"
              :rows="3"
              :maxlength="2000"
            />
          </UiField>

          <UiBtn
            :disabled="!canEdit"
            :loading="saving === KEYS.linkOrder"
            @click="save(KEYS.linkOrder, { ...linkOrder }, 'Линк захиалгын мэдээлэл хадгалагдлаа')"
          >
            Хадгалах
          </UiBtn>
        </div>
      </section>

      <!-- Хаяг холбох зааварчилгаа -->
      <section v-if="activeSection === 'addressGuides'" class="rounded-card border border-surface-border bg-surface-card p-5">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="font-semibold text-content">Хаяг холбох зааварчилгаа</h2>
            <p class="mt-1 text-body-sm text-content-secondary">
              Хятадын онлайн дэлгүүр тус бүрт (Taobao, Pinduoduo гэх мэт) манай
              Эрээний хаягийг хэрхэн холбохыг зурагтай алхам алхмаар зааж өгнө.
              Нүүр хуудас болон "Хүлээн авах хаяг" хуудсанд харагдана.
            </p>
          </div>
          <UiBtn
            size="sm"
            variant="secondary"
            :icon="Plus"
            :disabled="!canEdit || guides.length >= 30"
            @click="addGuide"
          >
            Заавар нэмэх
          </UiBtn>
        </div>

        <p v-if="!guides.length" class="mt-4 text-body-sm text-content-secondary">
          Заавар нэмээгүй байна.
        </p>

        <div v-else class="mt-4 space-y-5">
          <div
            v-for="(guide, gIndex) in guides"
            :key="guide.id"
            class="space-y-4 rounded-btn border border-surface-border p-4"
          >
            <div class="flex items-start gap-3">
              <!-- Thumbnail -->
              <div class="shrink-0">
                <div
                  class="flex h-20 w-20 items-center justify-center overflow-hidden rounded-btn border border-dashed border-surface-border bg-surface-hover"
                >
                  <img
                    v-if="guide.thumbnailUrl"
                    :src="imageSrc(guide.thumbnailUrl)"
                    class="h-full w-full object-cover"
                    alt=""
                  />
                  <ImagePlus v-else :size="20" class="text-content-disabled" />
                </div>
                <label
                  class="mt-1.5 block cursor-pointer text-center text-[11px] font-medium text-primary-600 hover:text-primary-700"
                  :class="(!canEdit || uploading[`thumb-${guide.id}`]) && 'pointer-events-none opacity-50'"
                >
                  {{ uploading[`thumb-${guide.id}`] ? 'Ачаалж…' : 'Зураг сонгох' }}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    class="hidden"
                    :disabled="!canEdit || uploading[`thumb-${guide.id}`]"
                    @change="onThumbnailChange(guide, $event)"
                  />
                </label>
              </div>

              <UiTextInput
                v-model="guide.platform"
                :disabled="!canEdit"
                placeholder="Жишээ: Taobao"
                class="flex-1"
              />

              <div class="flex shrink-0 flex-col gap-1">
                <UiBtn
                  variant="ghost"
                  size="sm"
                  :icon="ArrowUp"
                  :disabled="!canEdit || gIndex === 0"
                  aria-label="Дээш зөөх"
                  @click="moveItem(guides, gIndex, -1)"
                />
                <UiBtn
                  variant="ghost"
                  size="sm"
                  :icon="ArrowDown"
                  :disabled="!canEdit || gIndex === guides.length - 1"
                  aria-label="Доош зөөх"
                  @click="moveItem(guides, gIndex, 1)"
                />
                <UiBtn
                  variant="ghost"
                  size="sm"
                  :icon="Trash2"
                  :disabled="!canEdit"
                  aria-label="Заавар устгах"
                  @click="guides.splice(gIndex, 1)"
                />
              </div>
            </div>

            <!-- Алхмууд (зураг + текст блок) -->
            <div class="space-y-3 border-t border-surface-border pt-3">
              <p class="text-body-sm font-medium text-content">Алхмууд</p>

              <div
                v-for="(block, bIndex) in guide.blocks"
                :key="bIndex"
                class="flex items-start gap-3 rounded-btn bg-surface-hover p-3"
              >
                <div class="shrink-0">
                  <div
                    class="flex h-16 w-16 items-center justify-center overflow-hidden rounded-btn border border-dashed border-surface-border bg-surface-card"
                  >
                    <img
                      v-if="block.imageUrl"
                      :src="imageSrc(block.imageUrl)"
                      class="h-full w-full object-cover"
                      alt=""
                    />
                    <ImagePlus v-else :size="18" class="text-content-disabled" />
                  </div>
                  <label
                    class="mt-1 block cursor-pointer text-center text-[11px] font-medium text-primary-600 hover:text-primary-700"
                    :class="(!canEdit || uploading[`block-${guide.id}-${bIndex}`]) && 'pointer-events-none opacity-50'"
                  >
                    {{ uploading[`block-${guide.id}-${bIndex}`] ? 'Ачаалж…' : 'Зураг' }}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      class="hidden"
                      :disabled="!canEdit || uploading[`block-${guide.id}-${bIndex}`]"
                      @change="onBlockImageChange(guide, bIndex, $event)"
                    />
                  </label>
                </div>

                <UiTextArea
                  v-model="block.text"
                  :disabled="!canEdit"
                  :rows="2"
                  :maxlength="2000"
                  placeholder="Энэ алхамд юу хийхийг тайлбарлана уу"
                  class="flex-1"
                />

                <div class="flex shrink-0 flex-col gap-1">
                  <UiBtn
                    variant="ghost"
                    size="sm"
                    :icon="ArrowUp"
                    :disabled="!canEdit || bIndex === 0"
                    aria-label="Дээш зөөх"
                    @click="moveItem(guide.blocks, bIndex, -1)"
                  />
                  <UiBtn
                    variant="ghost"
                    size="sm"
                    :icon="ArrowDown"
                    :disabled="!canEdit || bIndex === guide.blocks.length - 1"
                    aria-label="Доош зөөх"
                    @click="moveItem(guide.blocks, bIndex, 1)"
                  />
                  <UiBtn
                    variant="ghost"
                    size="sm"
                    :icon="X"
                    :disabled="!canEdit"
                    aria-label="Алхам устгах"
                    @click="guide.blocks.splice(bIndex, 1)"
                  />
                </div>
              </div>

              <UiBtn
                variant="secondary"
                size="sm"
                :icon="Plus"
                :disabled="!canEdit || guide.blocks.length >= 20"
                @click="addBlock(guide)"
              >
                Алхам нэмэх
              </UiBtn>
            </div>
          </div>
        </div>

        <UiBtn
          class="mt-4"
          :disabled="!canEdit"
          :loading="saving === KEYS.addressGuides"
          @click="saveGuides"
        >
          Хадгалах
        </UiBtn>
      </section>
      </div>
    </div>
  </div>
</template>
