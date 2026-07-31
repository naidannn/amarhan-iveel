<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { onKeyStroke, useScrollLock } from '@vueuse/core'

/**
 * Модал цонх.
 *
 * `<dialog>` элемент биш, өөрсдийн teleport ашиглаж байгаа шалтгаан: `<dialog>`
 * нь Safari дээр анимаци, backdrop-ын хяналт хязгаартай. Гэхдээ хүртээмжийн
 * гол шаардлагууд (Esc-ээр хаах, дэвсгэр товших, фокусын урхи, aria) хэрэгжсэн.
 */
const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    subtitle?: string
    size?: 'sm' | 'md' | 'lg'
    /** Дэвсгэр товшиход хаагдахгүй — өгөгдөл алдагдах эрсдэлтэй формд */
    persistent?: boolean
  }>(),
  { size: 'md' }
)

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' } as const

const panel = ref<HTMLElement | null>(null)
const isOpen = computed(() => props.modelValue)
const route = useRoute()
const isAdminModal = computed(() => route.path.startsWith('/admin'))

// Модал нээлттэй үед дэвсгэр гүйлгэхээс сэргийлнэ
const locked = useScrollLock(import.meta.client ? document.body : null)
watch(isOpen, open => {
  locked.value = open
  if (open) nextTick(() => panel.value?.focus())
})
onBeforeUnmount(() => {
  locked.value = false
})

function close() {
  emit('update:modelValue', false)
}

onKeyStroke('Escape', () => {
  if (isOpen.value && !props.persistent) close()
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-200 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4"
        @click.self="persistent ? null : close()"
      >
        <div
          ref="panel"
          tabindex="-1"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          class="max-h-[92vh] w-full overflow-y-auto rounded-t-card bg-surface-card shadow-dropdown outline-none sm:rounded-card"
          :class="[SIZES[size], isAdminModal && 'admin-density-panel']"
        >
          <header
            v-if="title || $slots.header"
            class="flex items-start justify-between gap-4 border-b border-surface-border px-card py-5"
          >
            <slot name="header">
              <div class="min-w-0">
                <h2 class="text-h4 text-content">{{ title }}</h2>
                <p v-if="subtitle" class="mt-0.5 text-body text-content-secondary">
                  {{ subtitle }}
                </p>
              </div>
            </slot>

            <button
              type="button"
              class="-mr-1 shrink-0 rounded-btn p-1.5 text-content-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-content"
              aria-label="Хаах"
              @click="close"
            >
              <X :size="19" />
            </button>
          </header>

          <div class="px-card py-5">
            <slot />
          </div>

          <footer
            v-if="$slots.footer"
            class="flex flex-wrap justify-end gap-2 border-t border-surface-border px-card py-4"
          >
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
