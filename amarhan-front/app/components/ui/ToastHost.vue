<script setup lang="ts">
import type { Component } from 'vue'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-vue-next'
import tokens from '~/assets/design-tokens'
import type { ToastKind } from '~/composables/useToast'

/**
 * Toast-уудыг харуулах контейнер. Layout бүрт НЭГ удаа байрлана.
 */
const { items, dismiss } = useToast()

const STYLES: Record<ToastKind, { icon: Component; color: string }> = {
  success: { icon: CheckCircle2, color: tokens.semantic.success },
  error: { icon: XCircle, color: tokens.semantic.error },
  warning: { icon: AlertTriangle, color: tokens.semantic.warning },
  info: { icon: Info, color: tokens.semantic.info },
}
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      <TransitionGroup
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="translate-y-2 opacity-0"
        leave-active-class="transition-all duration-200 ease-in absolute"
        leave-to-class="translate-x-4 opacity-0"
        move-class="transition-transform duration-200"
      >
        <div
          v-for="toast in items"
          :key="toast.id"
          class="pointer-events-auto flex items-start gap-3 rounded-card border border-surface-border bg-surface-card p-4 shadow-dropdown"
        >
          <component
            :is="STYLES[toast.kind].icon"
            :size="19"
            :stroke-width="2.2"
            class="mt-0.5 shrink-0"
            :style="{ color: STYLES[toast.kind].color }"
          />

          <div class="min-w-0 flex-1">
            <p class="text-body font-semibold text-content">{{ toast.title }}</p>
            <p v-if="toast.description" class="mt-0.5 text-body-sm text-content-secondary">
              {{ toast.description }}
            </p>
          </div>

          <button
            type="button"
            class="-mr-1 -mt-1 shrink-0 rounded-btn p-1 text-content-disabled transition-colors duration-200 hover:bg-surface-hover hover:text-content"
            aria-label="Хаах"
            @click="dismiss(toast.id)"
          >
            <X :size="15" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
