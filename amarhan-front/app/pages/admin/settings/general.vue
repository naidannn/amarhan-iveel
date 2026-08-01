<script setup lang="ts">
/**
 * Ерөнхий тохиргоо — дотоод, ажилтанд зориулсан тохиргоо (`content.*`-аас
 * ялгаатай: НЭЭЛТТЭЙ БИШ, `/v1/public/*`-аар харагдахгүй).
 *
 * Дансны мэдээлэл: ажилтан "Төлбөр авах" цонхонд "Данс" хэлбэр сонгоход
 * харилцагчид өгөх дансны дугаарыг хуулж авдаг (`PayModal.vue`).
 *
 * ЗӨВХӨН АДМИН засварлана — backend `PUT /settings/:key` нь
 * `ROLE_GROUP.ADMIN`-аар хаагдсан (§9.1).
 */
definePageMeta({ layout: 'admin', middleware: 'auth' })

const auth = useAuthStore()
const settings = useSettings()
const toast = useToast()

const KEY_BANK_ACCOUNT = 'payment.bank_account'

const bankAccount = reactive({
  bankName: '',
  accountNumber: '',
  accountHolder: '',
  note: '',
})

const loading = ref(true)
const saving = ref(false)

onMounted(async () => {
  try {
    const data = await settings.list()
    Object.assign(bankAccount, data[KEY_BANK_ACCOUNT] ?? {})
  } catch (e: any) {
    toast.error(e?.response?.data?.message ?? 'Тохиргоо уншиж чадсангүй')
  } finally {
    loading.value = false
  }
})

async function save() {
  saving.value = true
  try {
    await settings.update(KEY_BANK_ACCOUNT, { ...bankAccount })
    toast.success('Дансны мэдээлэл хадгалагдлаа', {
      description: 'Төлбөр авах цонхонд шууд тусна',
    })
  } catch (e: any) {
    toast.error(e?.response?.data?.message ?? 'Хадгалж чадсангүй')
  } finally {
    saving.value = false
  }
}

const canEdit = computed(() => auth.isAdmin)
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-5">
    <UiPageHeader
      title="Ерөнхий тохиргоо"
      description="Дотоод, зөвхөн ажилтанд харагдах тохиргоо."
    />

    <div
      v-if="!canEdit"
      class="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-body text-content"
    >
      Тохиргоог зөвхөн Админ засварлана. Та мэдээллийг харж болно.
    </div>

    <p v-if="loading" class="py-10 text-center text-body text-content-secondary">Ачаалж байна…</p>

    <section v-else class="rounded-card border border-surface-border bg-surface-card p-5">
      <h2 class="font-semibold text-content">Дансны мэдээлэл</h2>
      <p class="mt-1 text-body-sm text-content-secondary">
        Ажилтан "Төлбөр авах" цонхонд "Данс" хэлбэр сонгоход харилцагчид өгөх
        дансны дугаар. Хуулбарлах товч тэнд гарна.
      </p>

      <div class="mt-4 space-y-4">
        <UiField label="Банк" for="bank-name">
          <UiTextInput
            id="bank-name"
            v-model="bankAccount.bankName"
            :disabled="!canEdit"
            placeholder="Хаан банк"
          />
        </UiField>

        <UiField label="Дансны дугаар" for="bank-account-number">
          <UiTextInput
            id="bank-account-number"
            v-model="bankAccount.accountNumber"
            :disabled="!canEdit"
            placeholder="5000123456"
          />
        </UiField>

        <UiField label="Дансны эзэмшигч" for="bank-account-holder">
          <UiTextInput
            id="bank-account-holder"
            v-model="bankAccount.accountHolder"
            :disabled="!canEdit"
            placeholder="Ивээл карго ХХК"
          />
        </UiField>

        <UiField label="Нэмэлт тайлбар" for="bank-note" hint="Заавал биш">
          <UiTextArea
            id="bank-note"
            v-model="bankAccount.note"
            :disabled="!canEdit"
            :rows="2"
            :maxlength="500"
          />
        </UiField>

        <UiBtn :disabled="!canEdit" :loading="saving" @click="save">Хадгалах</UiBtn>
      </div>
    </section>
  </div>
</template>
