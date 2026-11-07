<script setup lang="ts">
import {
  MessageSquareText,
  Copy,
  Check,
  Loader2,
  CircleCheck,
  Clock,
  AlertCircle,
} from 'lucide-vue-next'
import type { PhoneVerification } from '~/stores/customer'

/**
 * Утас баталгаажуулах алхам — roadmap 5.2 (Verify.MN, MO загвар).
 *
 * Уламжлалт "кодыг танд илгээнэ" OTP БИШ: харилцагч ӨӨРИЙН утаснаас 144773
 * руу дэлгэцэн дээрх кодыг SMS-ээр илгээнэ. Илгээгч дугаар нь утас
 * эзэмшлийн нотолгоо — тиймээс кодыг нуух шаардлагагүй, харин "зөв
 * дугаараасаа илгээ" гэдгийг тод сануулна (хос SIM-тэй үед хамгийн түгээмэл
 * алдаа).
 *
 * Аль урсгалд ч (бүртгэл, Google, нууц үг сэргээх, нэг удаагийн
 * баталгаажуулалт) ижил: `start` ба `check`-ийг эцэг нь өгнө, баталгаажмагц
 * `verified` эвентээр токеныг буцаана.
 */
const props = defineProps<{
  start: () => Promise<PhoneVerification>
  check: (token: string) => Promise<PhoneVerification>
}>()

const emit = defineEmits<{
  verified: [token: string]
}>()

// Verify.MN-ийн зөвлөмж: 3 секундээс олон биш
const POLL_INTERVAL_MS = 3000

const state = ref<'starting' | 'waiting' | 'verified' | 'expired' | 'error'>('starting')
const session = ref<PhoneVerification | null>(null)
const errorMessage = ref('')
const now = ref(Date.now())
const copied = ref<'code' | 'number' | null>(null)

let token = ''
let pollTimer: ReturnType<typeof setTimeout> | null = null
let clockTimer: ReturnType<typeof setInterval> | null = null

const shortcode = computed(() => session.value?.shortcode || '144773')
const smsHref = computed(
  () => session.value?.smsUri || `sms:${shortcode.value}?body=${session.value?.text ?? ''}`
)

const secondsLeft = computed(() => {
  if (!session.value) return 0
  return Math.max(0, Math.floor((new Date(session.value.expiresAt).getTime() - now.value) / 1000))
})
const countdown = computed(() => {
  const m = Math.floor(secondsLeft.value / 60)
  const s = secondsLeft.value % 60
  return `${m}:${String(s).padStart(2, '0')}`
})

async function begin() {
  stop()
  state.value = 'starting'
  errorMessage.value = ''
  try {
    const result = await props.start()
    session.value = result
    token = result.token ?? ''
    state.value = 'waiting'
    clockTimer = setInterval(() => (now.value = Date.now()), 1000)
    schedulePoll()
  } catch (e: any) {
    state.value = 'error'
    errorMessage.value =
      e?.response?.data?.message ?? 'Баталгаажуулалт эхлүүлж чадсангүй. Дахин оролдоно уу'
  }
}

function schedulePoll() {
  pollTimer = setTimeout(poll, POLL_INTERVAL_MS)
}

async function poll() {
  try {
    const result = await props.check(token)
    session.value = { ...session.value!, ...result }

    if (result.status === 'verified' || result.status === 'consumed') {
      stop()
      state.value = 'verified'
      emit('verified', token)
      return
    }
    if (result.status === 'expired') {
      stop()
      state.value = 'expired'
      return
    }
  } catch (e: any) {
    // Сүлжээний түр тасалдал нь баталгаажуулалт унасан гэсэн үг БИШ —
    // зөвхөн сесс олдохгүй болсон үед зогсоно
    if (e?.response?.status === 404) {
      stop()
      state.value = 'error'
      errorMessage.value = e.response.data?.message ?? 'Баталгаажуулалт олдсонгүй'
      return
    }
  }
  schedulePoll()
}

function stop() {
  if (pollTimer) clearTimeout(pollTimer)
  if (clockTimer) clearInterval(clockTimer)
  pollTimer = null
  clockTimer = null
}

async function copy(value: string, what: 'code' | 'number') {
  try {
    await navigator.clipboard.writeText(value)
    copied.value = what
    setTimeout(() => (copied.value = null), 1500)
  } catch {
    // Clipboard хаалттай браузер — хэрэглэгч гараар бичнэ
  }
}

onMounted(begin)
onBeforeUnmount(stop)
</script>

<template>
  <div class="rounded-card border border-surface-border bg-surface-card p-5">
    <!-- Эхлүүлж байна -->
    <div v-if="state === 'starting'" class="py-6 text-center">
      <Loader2 :size="26" class="mx-auto animate-spin text-primary" />
      <p class="mt-3 text-body-sm text-content-secondary">Баталгаажуулалт бэлдэж байна…</p>
    </div>

    <!-- SMS хүлээж байна -->
    <div v-else-if="state === 'waiting' && session">
      <div class="flex items-center gap-2 text-content">
        <MessageSquareText :size="18" class="text-primary-600" />
        <p class="font-semibold">Утсаа баталгаажуулна уу</p>
      </div>

      <p class="mt-3 text-body-sm text-content-secondary">
        <span class="font-semibold text-content tabular-nums">{{ session.phone }}</span>
        дугаараасаа доорх кодыг
        <span class="font-semibold text-content tabular-nums">{{ shortcode }}</span>
        руу SMS-ээр илгээнэ үү.
      </p>

      <div class="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          class="rounded-card border border-surface-border bg-surface-bg px-3 py-3 text-left hover:bg-surface-hover"
          @click="copy(shortcode, 'number')"
        >
          <span class="block text-xs text-content-secondary">Хүлээн авагч</span>
          <span class="mt-0.5 flex items-center justify-between">
            <span class="text-h3 font-bold tabular-nums text-content">{{ shortcode }}</span>
            <component
              :is="copied === 'number' ? Check : Copy"
              :size="15"
              class="text-content-secondary"
            />
          </span>
        </button>
        <button
          type="button"
          class="rounded-card border border-primary-200 bg-primary-50 px-3 py-3 text-left hover:brightness-95"
          @click="copy(session.text, 'code')"
        >
          <span class="block text-xs text-content-secondary">Код</span>
          <span class="mt-0.5 flex items-center justify-between">
            <span class="text-h3 font-bold tracking-widest tabular-nums text-primary-700">
              {{ session.text }}
            </span>
            <component :is="copied === 'code' ? Check : Copy" :size="15" class="text-primary-600" />
          </span>
        </button>
      </div>

      <a
        :href="smsHref"
        class="mt-4 flex h-control w-full items-center justify-center gap-2 rounded-btn bg-primary px-4 text-body font-medium text-white shadow-sm hover:bg-primary-600"
      >
        <MessageSquareText :size="17" />
        SMS бичих
      </a>

      <div class="mt-4 flex items-center justify-center gap-2 text-body-sm text-content-secondary">
        <Loader2 :size="15" class="animate-spin" />
        SMS хүлээж байна…
        <span class="inline-flex items-center gap-1 tabular-nums">
          <Clock :size="14" />
          {{ countdown }}
        </span>
      </div>

      <ul class="mt-4 space-y-1 text-xs text-content-secondary">
        <li>· Хос SIM-тэй бол яг энэ дугаараасаа илгээнэ үү.</li>
        <li>· SMS-ийн үнэ 150₮ таны операторын төлбөрөөс суутгагдана.</li>
        <li>· Ганц л удаа баталгаажуулна.</li>
      </ul>
    </div>

    <!-- Баталгаажлаа -->
    <div v-else-if="state === 'verified'" class="py-4 text-center">
      <CircleCheck :size="32" class="mx-auto text-success" :stroke-width="1.8" />
      <p class="mt-2 font-semibold text-content">Утас баталгаажлаа</p>
    </div>

    <!-- Хугацаа дууссан / алдаа -->
    <div v-else class="py-4 text-center">
      <AlertCircle :size="30" class="mx-auto text-error" :stroke-width="1.8" />
      <p class="mt-2 text-body-sm text-content">
        {{
          state === 'expired'
            ? 'Хугацаа дууссан. SMS илгээсэн бол хэдэн секунд хүлээгээд дахин оролдоно уу.'
            : errorMessage
        }}
      </p>
      <UiBtn variant="secondary" class="mt-4" @click="begin">Дахин эхлүүлэх</UiBtn>
    </div>
  </div>
</template>
