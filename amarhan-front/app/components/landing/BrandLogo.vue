<script setup lang="ts">
withDefaults(defineProps<{ compact?: boolean }>(), {
  compact: false,
})
</script>

<template>
  <div class="inline-flex items-center" :class="compact ? 'gap-2' : 'gap-2.5'">
    <img
      src="/logo-mark.png"
      alt=""
      aria-hidden="true"
      class="shrink-0 object-contain"
      :class="compact ? 'h-8 w-10' : 'h-10 w-[52px]'"
      :width="compact ? 40 : 52"
      :height="compact ? 32 : 40"
    />
    <span
      class="whitespace-nowrap font-bold leading-none tracking-[0.015em] text-primary"
      :class="compact ? 'text-[16px]' : 'text-[20px] sm:text-[22px]'"
    >
      ИВЭЭЛТ КАРГО
    </span>
  </div>
</template>
