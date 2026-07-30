<script setup lang="ts">
import { Plus, Trash2, ExternalLink } from 'lucide-vue-next'

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
} as const

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
  website: '',
  googleMapsUrl: '',
})
const faq = ref<{ question: string; answer: string }[]>([])
const notice = ref('')

const loading = ref(true)
const saving = ref<string | null>(null)

onMounted(async () => {
  try {
    const { data } = await $axios.get('/api/v1/settings')
    Object.assign(erenhot, data.data[KEYS.erenhot] ?? {})
    Object.assign(contact, data.data[KEYS.contact] ?? {})
    faq.value = data.data[KEYS.faq] ?? []
    notice.value = data.data[KEYS.notice] ?? ''
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
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-5">
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

    <template v-else>
      <!-- Эрээний хаяг (§3, 5.9) -->
      <section class="rounded-card border border-surface-border bg-surface-card p-5">
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
      <section class="rounded-card border border-surface-border bg-surface-card p-5">
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
      <section class="rounded-card border border-surface-border bg-surface-card p-5">
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
      <section class="rounded-card border border-surface-border bg-surface-card p-5">
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
    </template>
  </div>
</template>
