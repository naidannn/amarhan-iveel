/**
 * Ивээл Карго — Design System v1 токенууд
 *
 * ЭНЭ ФАЙЛ БОЛ ЦОРЫН ГАНЦ ЭХ СУРВАЛЖ (single source of truth).
 * Tailwind (`tailwind.config.js`) болон PrimeVue theme (`primevue-preset.js`)
 * хоёулаа эндээс уншина — хоёр газар өнгө бичих нь зөрүү үүсгэдэг.
 *
 * Брэндийн санаа (логоноос):
 *   Цэнхэр  → Найдвартай, технологи, хурд
 *   Улаан   → Хөдөлгөөн, олон улсын тээвэр
 *
 * Уриа: "Олон улсын карго тээврийг илүү хялбар, илүү ил тод."
 *
 * Дизайны хэв маяг: Alibaba / Cainiao / DHL / 17Track төрлийн modern dashboard.
 * Их цагаан зай · том карт · бөөрөнхий булан · цэвэр icon · өнгө бага.
 */

/** Цэнхэр — үндсэн үйлдэл, идэвхтэй төлөв, холбоос */
const primary = {
  50: '#EEF3FF',
  100: '#D9E4FF',
  200: '#B8CCFF',
  300: '#8FADFF',
  400: '#6285FF',
  500: '#355DFF', // брэндийн үндсэн цэнхэр
  600: '#2247E6',
  700: '#1836B8',
  800: '#132B8F',
  900: '#11246E',
  950: '#0B1745',
};

/** Улаан — ЗӨВХӨН CTA болон чухал төлөвт. Хэт их ашиглахгүй. */
const secondary = {
  50: '#FEECEB',
  100: '#FDD5D3',
  200: '#FAAEAA',
  300: '#F67F79',
  400: '#EF5A52',
  500: '#E53935', // брэндийн улаан
  600: '#C62828',
  700: '#A31F1F',
  800: '#7F1D1D',
  900: '#651B1B',
  950: '#380A0A',
};

/** Төлөвийн өнгө */
const semantic = {
  success: '#16A34A',
  warning: '#F59E0B',
  error: '#DC2626',
  info: primary[500],
};

/** Гадаргуу ба хүрээ */
const surface = {
  background: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E5E7EB',
  hover: '#F1F5F9',
};

/** Текст */
const text = {
  primary: '#111827',
  secondary: '#6B7280',
  disabled: '#9CA3AF',
  inverse: '#FFFFFF',
};

/**
 * Ачааны төлөвийн өнгө — introduction.md §1.5
 *
 * Хэрэглэгч дэлгэц харангуутаа "миний ачаа хаана явж байна вэ?" гэдгийг
 * ойлгох ёстой. Тиймээс төлөв бүр ӨӨР өнгөтэй, дараалал нь замын явцыг
 * илэрхийлнэ: саарал (шинэ) → цэнхэр (агуулах) → улбар шар (замд) →
 * ягаан (ирсэн) → цэнхэрлэг (хүргэлт) → ногоон (дууссан).
 */
const packageStatus = {
  registered: { label: 'Эрээнд бүртгэгдсэн', color: '#6B7280', bg: '#F3F4F6' },
  in_transit: { label: 'Монгол руу илгээгдсэн', color: '#EA580C', bg: '#FFF7ED' },
  arrived: { label: 'Монголд ирсэн', color: '#7C3AED', bg: '#F5F3FF' },
  notified: { label: 'Мэдэгдсэн', color: '#0891B2', bg: '#ECFEFF' },
  awaiting_payment: { label: 'Төлбөр хүлээгдэж буй', color: '#B45309', bg: '#FFFBEB' },
  paid: { label: 'Төлбөр төлөгдсөн', color: '#0D9488', bg: '#F0FDFA' },
  out_for_delivery: { label: 'Хүргэлтэнд гарсан', color: '#0891B2', bg: '#ECFEFF' },
  picked_up: { label: 'Салбараас авсан', color: '#16A34A', bg: '#F0FDF4' },
  delivered: { label: 'Хүлээн авсан', color: '#16A34A', bg: '#F0FDF4' },
  returned: { label: 'Буцаагдсан', color: '#B45309', bg: '#FFFBEB' },
  cancelled: { label: 'Хүчингүй', color: '#DC2626', bg: '#FEF2F2' },
};

/** Хүргэлтийн төлөв — §5.1 */
const deliveryStatus = {
  created: { label: 'Хүргэлт үүссэн', color: '#6B7280', bg: '#F3F4F6' },
  dispatched: { label: 'Хүргэлтэнд гарсан', color: '#0891B2', bg: '#ECFEFF' },
  delivered: { label: 'Амжилттай хүргэгдсэн', color: '#16A34A', bg: '#F0FDF4' },
  returned: { label: 'Буцаагдсан', color: '#DC2626', bg: '#FEF2F2' },
};

/** Бүрэлдэхүүн хэсгийн хэмжээ — бүх интерактив элемент 40px өндөр */
const sizing = {
  controlHeight: '40px',
  cardPadding: '24px',
  sidebarWidth: '260px',
  navbarHeight: '64px',
};

const radius = {
  card: '16px',
  button: '12px',
  input: '10px',
  badge: '9999px',
  base: '12px',
};

const shadow = {
  // Зөөлөн — хэт бараан сүүдэр брэндийн цэвэр төрхийг эвдэнэ
  card: '0 4px 16px rgba(0, 0, 0, 0.06)',
  raised: '0 8px 24px rgba(0, 0, 0, 0.08)',
  dropdown: '0 12px 32px rgba(0, 0, 0, 0.10)',
};

const motion = {
  duration: '200ms',
  easing: 'ease',
  hoverScale: '1.02',
};

const font = {
  sans: ['Inter', 'Noto Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
};

/** Дэлгэцийн хэмжээ */
const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

export {
  primary,
  secondary,
  semantic,
  surface,
  text,
  packageStatus,
  deliveryStatus,
  sizing,
  radius,
  shadow,
  motion,
  font,
  breakpoints,
};

export default {
  primary,
  secondary,
  semantic,
  surface,
  text,
  packageStatus,
  deliveryStatus,
  sizing,
  radius,
  shadow,
  motion,
  font,
  breakpoints,
};
