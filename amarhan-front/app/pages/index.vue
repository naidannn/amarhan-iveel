<script setup lang="ts">
import { Search, Package, Wallet, MapPin, Megaphone } from 'lucide-vue-next'

/**
 * Харилцагчийн нүүр хуудас — introduction.md §3
 *
 * Нээлттэй (SSR-тэй): зочин нэвтрэхгүйгээр ачаагаа хайж чадах ёстой — энэ нь
 * вэбийн хамгийн олон ашиглагддаг үйлдэл.
 */
const { content } = usePublicContent()

const { data: site } = await useAsyncData('public-content', () => content(), {
  // Backend унтарсан үед нүүр хуудас БҮХЭЛДЭЭ унах ёсгүй — зарлал бол
  // нэмэлт мэдээлэл, гол агуулга биш
  default: () => null,
})

const query = ref('')

function search() {
  const value = query.value.trim()
  if (!value) return
  navigateTo(`/track/${encodeURIComponent(value)}`)
}

const features = [
  {
    icon: Package,
    title: 'Ачаагаа хянах',
    body: 'Ачаа агуулахад ирсэн эсэх, төлөв нь хаана явааг бодит цагт харна.',
  },
  {
    icon: Wallet,
    title: 'Төлбөрөө харах',
    body: 'Төлөх үлдэгдэл, төлсөн түүхээ нэг дороос шалгана.',
  },
  {
    icon: MapPin,
    title: 'Хүргэлт захиалах',
    body: 'Салбар дээр ирэхгүйгээр ачаагаа хаягаараа хүлээж авна.',
  },
]

useHead({ title: 'Ивээл Карго — Хятадаас Монгол руу ачаа тээвэрлэлт' })
</script>

<template>
  <div class="space-y-10 sm:space-y-14">
    <!-- Зарлал (админаас засварлагдана — roadmap 5.10) -->
    <div
      v-if="site?.home_notice"
      class="flex items-start gap-3 rounded-card border border-warning/30 bg-warning/10 px-4 py-3"
    >
      <Megaphone :size="18" class="mt-0.5 shrink-0 text-warning" />
      <p class="text-body text-content">{{ site.home_notice }}</p>
    </div>

    <!-- Ачаа хайх -->
    <section class="text-center">
      <h1 class="text-h1 font-bold text-content sm:text-4xl">Ачаагаа хаанаас ч хянаарай</h1>
      <p class="mx-auto mt-3 max-w-xl text-body text-content-secondary">
        Ачааны дугаараа бичээд төлөвөө шалгана уу. Нэвтрэх шаардлагагүй.
      </p>

      <form class="mx-auto mt-6 flex max-w-lg gap-2" @submit.prevent="search">
        <UiTextInput
          v-model="query"
          placeholder="Ачааны дугаар"
          :icon="Search"
          class="flex-1"
          aria-label="Ачааны дугаар"
        />
        <UiBtn type="submit" :disabled="!query.trim()">Хайх</UiBtn>
      </form>
    </section>

    <!-- Боломжууд -->
    <section class="grid gap-4 sm:grid-cols-3">
      <div
        v-for="item in features"
        :key="item.title"
        class="rounded-card border border-surface-border bg-surface-card p-5"
      >
        <div
          class="flex h-10 w-10 items-center justify-center rounded-btn bg-primary-50 text-primary-600"
        >
          <component :is="item.icon" :size="20" :stroke-width="2" />
        </div>
        <h2 class="mt-3 font-semibold text-content">{{ item.title }}</h2>
        <p class="mt-1 text-body-sm text-content-secondary">{{ item.body }}</p>
      </div>
    </section>

    <!-- Бүртгүүлэх урилга -->
    <section
      class="rounded-card border border-surface-border bg-surface-card px-6 py-8 text-center"
    >
      <h2 class="text-h2 font-bold text-content">Бүртгүүлээд бүх ачаагаа нэг дороос</h2>
      <p class="mx-auto mt-2 max-w-lg text-body text-content-secondary">
        Утасны дугаараараа бүртгүүлэхэд тухайн дугаараар бүртгэгдсэн бүх ачаа
        автоматаар бүртгэл дээр тань харагдана.
      </p>
      <div class="mt-5 flex justify-center gap-2">
        <UiBtn to="/register">Бүртгүүлэх</UiBtn>
        <UiBtn variant="secondary" to="/login">Нэвтрэх</UiBtn>
      </div>
    </section>
  </div>
</template>
