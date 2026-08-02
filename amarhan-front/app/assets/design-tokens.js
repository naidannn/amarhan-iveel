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
 * Харанхуй горим — ЗӨВХӨН харилцагчийн вэб (landing/default layout).
 * Админ хэсэгт хэрэглэгдэхгүй тул `surface`/`text`-тэй адил бүтэцтэй,
 * зэрэгцээ тольд гаргав (`tailwind.config.js`-ийн CSS хувьсагчид хоёуланг
 * уншина, админд ЗАДГАЙ tailwind.config.js-ийн `.dark` хамрах хүрээ хэзээ ч
 * хүрэхгүй тул автоматаар хамгаалагдана).
 */
const surfaceDark = {
  background: '#0B1220',
  card: '#131B2C',
  border: '#243049',
  hover: '#1C2740',
};

const textDark = {
  primary: '#F1F5F9',
  secondary: '#94A3B8',
  disabled: '#64748B',
  inverse: '#0B1220',
};

/**
 * Ачааны төлөвийн өнгө — introduction.md §1.5
 *
 * Хэрэглэгч дэлгэц харангуутаа "миний ачаа хаана явж байна вэ?" гэдгийг
 * ойлгох ёстой. Тиймээс төлөв бүр ӨӨР өнгөтэй, дараалал нь явцыг илэрхийлнэ:
 * саарал (шинэ) → цэнхэрлэг (мэдэгдсэн) → шаргал (төлбөр) → номин (төлөгдсөн)
 * → цэнхэр (хүргэлт) → ногоон (дууссан).
 *
 * ЭРЭЭНИЙ/ЗАМЫН ТӨЛӨВ БАЙХГҮЙ: ачааг Монголд ирсний ДАРАА бүртгэдэг тул
 * бүртгэл өөрөө "ирсэн" гэдгийг илэрхийлнэ. Backend-ийн
 * `domain/package-state.js`-тай ЯГ таарах ёстой.
 */
const packageStatus = {
  // BR-46 — харилцагч ӨӨРӨӨ мэдүүлсэн, компани хараахан хараагүй ачаа
  // (2026-08-01). Ягаан-ягаавтар өнгө нь "албан ёсны бүртгэл хараахан
  // болоогүй" гэдгийг индиго (`in_erlian` — ажилтан баталсан) өнгөнөөс
  // ялгаж харуулна.
  expected: { label: 'Хүлээгдэж буй', color: '#7C3AED', bg: '#F5F3FF' },
  // BR-45 — "Эрээнд байгаа" урьдчилсан бүртгэл (2026-07-31). Индиго өнгө нь
  // бусад төлөвтэй огт давхцахгүй — энэ нь бусад бүх төлөвөөс ялгаатай,
  // ачаа физикээр Монголд хараахан ирээгүй гэдгийг тодотгож харуулна.
  in_erlian: { label: 'Эрээнд байгаа', color: '#4338CA', bg: '#EEF2FF' },
  registered: { label: 'Улаанбаатарт ирсэн', color: '#6B7280', bg: '#F3F4F6' },
  notified: { label: 'Мэдэгдсэн', color: '#0891B2', bg: '#ECFEFF' },
  awaiting_payment: { label: 'Төлбөр хүлээгдэж буй', color: '#B45309', bg: '#FFFBEB' },
  paid: { label: 'Төлбөр төлөгдсөн', color: '#0D9488', bg: '#F0FDFA' },
  out_for_delivery: { label: 'Хүргэлтэнд гарсан', color: '#0891B2', bg: '#ECFEFF' },
  picked_up: { label: 'Салбараас авсан', color: '#16A34A', bg: '#F0FDF4' },
  delivered: { label: 'Хүлээн авсан', color: '#16A34A', bg: '#F0FDF4' },
  returned: { label: 'Буцаагдсан', color: '#B45309', bg: '#FFFBEB' },
  cancelled: { label: 'Хүчингүй', color: '#DC2626', bg: '#FEF2F2' },
};

/**
 * Төлбөрийн хэлбэр — §1.8. Өнгө нь СЕМАНТИК: бэлэн мөнгө нь кассын бодит
 * үлдэгдэлтэй тулгагддаг тул тод, дансны гүйлгээ нь дараа батлагддаг тул хүйтэн.
 */
const paymentMethod = {
  cash: { label: 'Бэлэн', color: '#16A34A', bg: '#F0FDF4' },
  bank: { label: 'Данс', color: '#355DFF', bg: '#EEF2FF' },
  card: { label: 'Карт', color: '#7C3AED', bg: '#F5F3FF' },
  qpay: { label: 'QPay', color: '#0891B2', bg: '#ECFEFF' },
};

/** Төлбөрийн бичлэгийн төлөв — BR-14, BR-18 */
const paymentRecordStatus = {
  pending: { label: 'Батлагдаагүй', color: '#B45309', bg: '#FFFBEB' },
  completed: { label: 'Орсон', color: '#16A34A', bg: '#F0FDF4' },
  voided: { label: 'Хүчингүй', color: '#DC2626', bg: '#FEF2F2' },
};

/** Нэхэмжлэхийн төлөв — §2.3 */
const invoiceStatus = {
  open: { label: 'Нээлттэй', color: '#B45309', bg: '#FFFBEB' },
  paid: { label: 'Төлөгдсөн', color: '#16A34A', bg: '#F0FDF4' },
  cancelled: { label: 'Хүчингүй', color: '#DC2626', bg: '#FEF2F2' },
};

/** Ачааны төлбөрийн байдал — BR-14 */
const paymentStatus = {
  unpaid: { label: 'Төлөгдөөгүй', color: '#DC2626', bg: '#FEF2F2' },
  partial: { label: 'Хэсэгчилсэн', color: '#B45309', bg: '#FFFBEB' },
  paid: { label: 'Төлөгдсөн', color: '#16A34A', bg: '#F0FDF4' },
};

/**
 * Хүргэлтийн төлөв — §5.1
 *
 * `returned` нь шар (улаан БИШ): ачаа буцаж ирсэн нь алдаа биш, дахин
 * гаргах боломжтой хэвийн үр дүн. Улаан нь зөвхөн `cancelled` —
 * хүргэлт огт болоогүй.
 */
const deliveryStatus = {
  created: { label: 'Хүргэлт үүссэн', color: '#6B7280', bg: '#F3F4F6' },
  dispatched: { label: 'Хүргэлтэнд гарсан', color: '#0891B2', bg: '#ECFEFF' },
  delivered: { label: 'Амжилттай хүргэгдсэн', color: '#16A34A', bg: '#F0FDF4' },
  // BR-21d — харилцагч өөрөө порталдаа баталгаажуулсан (ажилтны `delivered`-ээс тусдаа)
  received: { label: 'Харилцагч хүлээж авсан', color: '#0D9488', bg: '#F0FDFA' },
  returned: { label: 'Буцаагдсан', color: '#B45309', bg: '#FFFBEB' },
  cancelled: { label: 'Цуцлагдсан', color: '#DC2626', bg: '#FEF2F2' },
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
  surfaceDark,
  textDark,
  packageStatus,
  paymentMethod,
  paymentRecordStatus,
  paymentStatus,
  invoiceStatus,
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
  surfaceDark,
  textDark,
  packageStatus,
  paymentMethod,
  paymentRecordStatus,
  paymentStatus,
  invoiceStatus,
  deliveryStatus,
  sizing,
  radius,
  shadow,
  motion,
  font,
  breakpoints,
};
