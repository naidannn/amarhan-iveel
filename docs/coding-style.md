# Кодын хэв маяг (Coding Style)

> Энэ баримт нь Ивээл Карго системд код бичих дүрмийг тодорхойлно.
> Одоо байгаа `amarhan-api/src/` кодын хэв маягийг үндэс болгосон.

---

## 1. Ерөнхий зарчим

1. **Одоо байгаа кодын хэв маягийг дага.** Файл дотор нэг хэв маяг барь.
2. **Тодорхой байдал > товч байдал.** Ухаалаг нэг мөрийн шийдлээс уншигдах 5 мөр дээр.
3. **Комментоор *яагаад*-ыг тайлбарла, *юу*-г биш.** Бизнес дүрэм тайлбарлахдаа
   `introduction.md`-ийн параграфын дугаарыг заа (`// §1.3 — давхар tracking хамгаалалт`).
4. **Хэрэглэгчид харагдах текст монгол хэлээр, код англи хэлээр.**
5. **Урьдчилан ерөнхийчлөхгүй.** Гурав дахь удаа давтагдахад л abstraction гарга.

---

## 2. Backend (Node.js / Express / Mongoose)

### 2.1 Форматлалт

`.prettierrc`-д заасныг мөрдөнө. `npm run format` ажиллуулж commit хийнэ.

- Мөрийн урт 100 тэмдэгт
- Мөрийн төгсгөлд `;`
- Нэг ишлэл `'single'`
- 2 хоосон зайн догол
- Trailing comma: `es5`

### 2.2 Файлын нэршил

| Төрөл | Хэв | Жишээ |
|---|---|---|
| Model | `<entity>.model.js` | `package.model.js` |
| Repository | `<entity>.repository.js` | `package.repository.js` |
| Service | `<entity>.service.js` | `package.service.js` |
| Controller | `<entity>.controller.js` | `package.controller.js` |
| Route | `<entity>.route.js` | `package.route.js` |
| Validation | `<entity>.validation.js` | `package.validation.js` |
| Middleware | `kebab-case.js` | `error-handler.js` |
| Домэйн логик | `kebab-case.js` | `package-state.js`, `pricing.js` |

**Нэгдмэл тоогоор** нэрлэнэ (`package`, `payment` — `packages` биш). Коллекцын нэр л олон тоотой.

### 2.3 Файлын бүтэц

Файл бүр `'use strict';`-ээр эхэлнэ (одоо байгаа кодын дагуу).

```js
'use strict';

// 1. Гадаад сан
const httpStatus = require('http-status');

// 2. Дотоод модуль
const packageRepository = require('../repositories/package.repository');
const auditService = require('./audit.service');
const APIError = require('../utils/APIError');

// 3. Тогтмол
const MAX_BULK_SIZE = 100;

// 4. Гол агуулга
class PackageService { /* ... */ }

// 5. Экспорт
module.exports = new PackageService();
```

### 2.4 Нэршил

| Зүйл | Хэв | Жишээ |
|---|---|---|
| Хувьсагч, функц | `camelCase` | `finalPrice`, `calculateBalance` |
| Класс | `PascalCase` | `PackageService` |
| Тогтмол | `UPPER_SNAKE_CASE` | `MAX_BULK_SIZE` |
| Mongo талбар | `camelCase` | `trackingNumber`, `finalPrice` |
| Enum утга | `snake_case` мөр | `'out_for_delivery'` |
| Boolean | `is`/`has`/`can` угтвар | `isPaid`, `hasOverride`, `canDelete` |
| Async функц | үйл үгээр | `findByPhone`, `recordPayment` |

**Мөнгөний талбар үргэлж дүнг илэрхийлнэ, нэр нь ойлгомжтой байна:**
`finalPrice`, `paidAmount`, `balance` — `price`, `amount` гэсэн бүрхэг нэр хэрэглэхгүй.

### 2.5 Давхаргын дүрэм

Дэлгэрэнгүй: [`architecture.md` §2](architecture.md). Товчхондоо:

```js
// ❌ Controller дотор Mongoose
exports.get = async (req, res) => {
  const pkg = await Package.findById(req.params.id);   // болохгүй
};

// ✅ Controller зөвхөн service дуудна
exports.get = async (req, res, next) => {
  try {
    const pkg = await packageService.getById(req.params.packageId);
    return success(res, pkg);
  } catch (error) {
    next(error);
  }
};
```

```js
// ❌ Repository дотор бизнес дүрэм
async create(data) {
  if (data.weight > 100) throw new APIError('Хэт хүнд');   // болохгүй
  return this.model.create(data);
}

// ✅ Repository зөвхөн query
async findByTrackingNumber(trackingNumber) {
  return this.model.findOne({ trackingNumber, status: { $ne: 'cancelled' } });
}
```

### 2.6 Алдаа шийдвэрлэх

- Хүлээгдэж буй алдаанд `APIError` ашиглана: `throw new APIError('Ачаа олдсонгүй', httpStatus.NOT_FOUND);`
- Controller бүр `try/catch` + `next(error)` (одоо байгаа хэв маяг).
- Алдааны мессеж **монгол хэлээр** — хэрэглэгчид шууд харагдана.
- Дотоод алдааны дэлгэрэнгүйг хэрэглэгчид гаргахгүй, `logger.error`-т бичнэ.
- `console.log` **хориотой** — `logger` ашиглана.

```js
// ✅
logger.error('Төлбөр хуваарилахад алдаа', { paymentId, error: err.message });
```

### 2.7 Async

- Зөвхөн `async/await`. `.then()` гинж хэрэглэхгүй.
- Хамааралгүй дуудлагыг зэрэг ажиллуул:

```js
const [pkg, tariff] = await Promise.all([
  packageRepository.findById(id),
  tariffRepository.findActive(cargoTypeId),
]);
```

### 2.8 `withTransaction` — дараалсан бичилт

Мөнгө, төлөв, audit хөндөх бүх үйлдэл `withTransaction` дотор:

```js
return withTransaction(async (session) => {
  await packageRepository.updateById(id, patch, { session });
  await auditService.record(entry, { session });
});
```

**Дүрэм:** нэг service метод дотор 2+ бичих үйлдэл байвал `withTransaction` заавал.

> **Анхаар:** систем standalone MongoDB ашигладаг тул энэ нь жинхэнэ Mongo
> транзакц/rollback БИШ — callback дотор дараалан бичдэг (`docs/architecture.md`
> §4.3, §9 шийдвэр #2). `{ session }`-ийг дамжуулсаар байх ёстой (дуудагч талын
> кодыг өөрчлөхгүйн тулд, session нь `undefined` байх болно), гэхдээ дунд
> алхамд алдаа гарвал өмнөх бичлэг **буцаагдахгүй**.

### 2.9 Validation

Бүх оролт Joi схемээр (`validations/<entity>.validation.js`), route-д `validate()`-аар холбогдоно.

```js
createPackage: {
  body: Joi.object({
    trackingNumber: Joi.string().trim().uppercase().max(64).required(),
    customerPhone:  Joi.string().pattern(/^\d{8}$/).required(),
    cargoTypeId:    objectId.required(),
    quantity:       Joi.number().integer().min(1).required(),
    weightKg:       Joi.number().min(0).precision(2),
    volumeM3:       Joi.number().min(0).precision(4),
    // §1.1 — жин эсвэл эзлэхүүний ядаж нэг нь заавал
  }).or('weightKg', 'volumeM3'),
}
```

Service дотор дахин валидац хийхгүй — **бизнес дүрэм** л шалгана
(жишээ: "энэ хэрэглэгч ийм override хийж болох уу").

### 2.10 Mongoose model

- Model бүрт `timestamps: true`
- Хайгддаг талбар бүрт `index: true` эсвэл `schema.index({...})`
- `toJSON` transform-оор `_id → id`, `__v` устгах (одоо байгаа `user.model.js`-ийн адил)
- Хуудаслалт хэрэгтэй model бүрт `mongoose-paginate-v2` plugin
- Enum утгыг `config/constants.js`-д төвлөрүүлж, model-д импортлон ашиглана —
  мөрийг хоёр газар бичихгүй

```js
const { PACKAGE_STATUS } = require('../config/constants');

status: {
  type: String,
  enum: Object.values(PACKAGE_STATUS),
  default: PACKAGE_STATUS.REGISTERED,
  index: true,
},
```

### 2.11 Комментийн хэв маяг

```js
// §1.2 — Эцсийн үнэ = MAX(жин × ₮/kg, эзлэхүүн × ₮/m³), доод хэмжээнээс багагүй.
// Хөнгөн боловч том оврын ачааг жингээр бодвол компанид алдагдалтай тул хоёуланг харьцуулна.
const final = Math.max(byWeight, byVolume, tariff.minimumCharge);
```

Тодорхой байгаа зүйлийг тайлбарлахгүй:

```js
// ❌ i-г нэгээр нэмэгдүүлнэ
i++;
```

---

## 3. Frontend (Nuxt 4 / Vue 3 / TypeScript)

### 3.1 Ерөнхий

- **`<script setup lang="ts">`** — Options API хэрэглэхгүй
- Компонент бүр нэг үүрэгтэй; 250 мөрөөс их бол хуваа
- Nuxt 4-т бүх эх код **`app/` дотор** байна. `app/`-аас гадуур `stores/`, `composables/`
  үүсгэхгүй (одоогийн `amarhan-front/stores/auth.ts` бол алдаа, устгагдана)

### 3.2 Нэршил

| Зүйл | Хэв | Жишээ |
|---|---|---|
| Компонент файл | `PascalCase.vue` | `PackageForm.vue` |
| Компонентын хавтас | `PascalCase/` эсвэл домэйн нэр | `components/package/` |
| Composable | `use<Domain>.ts` | `usePackages.ts` |
| Store | `<domain>.ts`, `use<Domain>Store` | `auth.ts` → `useAuthStore` |
| Page файл | `kebab-case.vue` | `packages/new.vue` |
| Хувьсагч, функц | `camelCase` | `selectedPackages` |
| Type / Interface | `PascalCase` | `Package`, `PaymentMethod` |

### 3.3 Компонентын бүтэц

```vue
<script setup lang="ts">
// 1. Импорт (auto-import байвал хэрэггүй)
// 2. Props / Emits
const props = defineProps<{ packageId: string }>()
const emit = defineEmits<{ saved: [pkg: Package] }>()

// 3. Composable
const { fetchPackage, loading, error } = usePackages()

// 4. Төлөв
const form = reactive({ trackingNumber: '', weightKg: null as number | null })

// 5. Computed
const isValid = computed(() => form.trackingNumber.length > 0)

// 6. Функц
async function submit() { /* ... */ }

// 7. Lifecycle
onMounted(() => { /* ... */ })
</script>

<template>
  <!-- ... -->
</template>
```

`<style>` блок хэрэглэхгүй — Tailwind-аар шийднэ. Зайлшгүй тохиолдолд `<style scoped>`.

### 3.4 Composable

Домэйн бүрт нэг composable. `useApi`-г ашиглана, `$axios`-ыг шууд дуудахгүй.

```ts
export function usePackages() {
  const { get, post, put, loading, error } = useApi<Package>()

  async function list(params: PackageListParams) {
    return get('/api/v1/packages', params)
  }

  async function create(payload: CreatePackageDto) {
    return post('/api/v1/packages', payload)
  }

  return { list, create, loading, error }
}
```

**Дүрэм:** composable нь UI-аас хараат бус байна — `alert`, `router.push` дуудахгүй.

### 3.5 Pinia store

Зөвхөн жинхэнэ глобал төлөв (`auth`, `settings`). Сервер өгөгдлийн жагсаалт store-д хадгалахгүй.

### 3.6 TypeScript

- `any` **хориотой** (одоо байгаа кодод байгаа `any`-г аажмаар арилгана)
- API хариултын төрлийг `app/types/` дотор тодорхойлж, backend-тэй синк байлгана
- Optional талбарт `?`, `null` боломжтой утгад `| null` — хоёуланг холихгүй

```ts
// app/types/package.ts
export interface Package {
  id: string
  trackingNumber: string
  customerPhone: string
  status: PackageStatus
  weightKg: number | null
  volumeM3: number | null
  finalPrice: number      // ₮, бүхэл тоо
  paidAmount: number
  balance: number
  locationCode: string | null
  createdAt: string
}

export type PackageStatus =
  | 'registered' | 'notified' | 'awaiting_payment' | 'paid'
  | 'out_for_delivery' | 'picked_up' | 'delivered'
  | 'returned' | 'cancelled'

export type PaymentMethodValue = 'cash' | 'bank' | 'card' | 'qpay'
export type PaymentRecordStatus = 'pending' | 'completed' | 'voided'
export type InvoiceStatusValue = 'open' | 'paid' | 'cancelled'
```

### 3.7 Tailwind

- Утилити классыг template-д шууд бич
- 3+ газар давтагдвал `components/ui/`-д компонент болго
- Дурын утга (`w-[437px]`) хэрэглэхгүй — `tailwind.config.js`-д нэмнэ
- Брэндийн өнгийг `tailwind.config.js`-д нэрлэж тодорхойлно (`brand-primary`),
  hex кодыг template-д бичихгүй

### 3.8 Хэрэглэгчийн текст

- Бүх харагдах текст монгол хэлээр
- Мөнгөн дүнг `utils/currency.ts`-ийн форматлагчаар (`45,000₮`)
- Огноог нэг форматаар (`2026-07-29 07:22`)
- Алдааны мессежийг backend-ээс ирсэн байдлаар нь харуулна (тэдгээр нь монголоор)

### 3.9 Гүйцэтгэл (§9.3)

```ts
// ❌ Бүх өгөгдлийг татаад client талд шүүх
const all = await get('/api/v1/packages')
const filtered = all.filter(p => p.status === 'paid')

// ✅ Шүүлт server талд
const result = await get('/api/v1/packages', { status: 'paid', page: 1, limit: 50 })
```

- Хайлтын оролтод 300ms debounce
- 200+ мөрт виртуал скролл
- Хүнд компонентод `defineAsyncComponent`

---

## 4. Тэст

Дэлгэрэнгүй: [`testing.md`](testing.md). Хэв маягийн хувьд:

- Тестийн нэр монгол хэлээр, бизнес дүрмийг илэрхийлнэ
- AAA бүтэц (Arrange / Act / Assert)

```js
describe('Ачааны үнэ тооцоолол (§1.2)', () => {
  it('эзлэхүүнээр бодсон дүн их бол түүнийг сонгоно', () => {
    const result = calculatePrice({
      weightKg: 2, volumeM3: 0.5,
      tariff: { pricePerKg: 5000, pricePerM3: 40000, minimumCharge: 5000 },
    });
    expect(result.final).to.equal(20000);
    expect(result.source).to.equal('volume');
  });
});
```

---

## 5. Хориотой зүйлсийн жагсаалт

| Хориотой | Оронд нь |
|---|---|
| `console.log` (backend) | `logger.info/error` |
| Controller дотор Mongoose | Service → Repository |
| Хатуу кодлосон нууц/түлхүүр | `.env` + `config/index.js` |
| Хатуу кодлосон enum мөр олон газар | `config/constants.js` |
| `pkg.status = '...'` шууд онооx | `packageService.changeStatus()` |
| Мөнгийг float-оор | Бүхэл тоо (₮) |
| Client талд бүх өгөгдөл татаж filter | Server талын query параметр |
| `any` (TS) | Тодорхой type |
| Ачаа/төлбөрийг `deleteById` | `cancelled` / `voided` төлөв |
| Audit бичихгүй мөнгө/төлөв өөрчлөх | `auditService.record()` транзакц дотор |
| Эрхийг зөвхөн UI-д шалгах | `authorize()` route-д заавал |
