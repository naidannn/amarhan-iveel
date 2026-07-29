<template>
  <!--
    Харилцагчийн вэбийн үндсэн layout.
    Хуудсын агуулга <slot /> дотор ирнэ — <RouterView /> биш
    (тэр нь Nuxt-ийн layout системтэй зөрчилддөг).
  -->
  <div class="min-h-screen bg-surface-bg">
    <slot />
  </div>
</template>
