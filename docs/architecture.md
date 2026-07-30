# Архитектур — Ивээл Карго систем

> Энэ баримт нь системийн техникийн бүтэц, давхарга, өгөгдлийн урсгал, шийдвэрийн үндэслэлийг тодорхойлно.
> Бизнес шаардлагыг [`../introduction.md`](../introduction.md)-аас, өгөгдлийн бүтцийг
> [`data-model.md`](data-model.md)-аас үзнэ үү.

---

## 1. Ерөнхий зураглал

```
┌─────────────────────┐        ┌─────────────────────┐
│  Админ систем       │        │  Хэрэглэгчийн вэб   │
│  (ажилтан, менежер) │        │  (харилцагч)        │
│  Nuxt 4 SPA/SSR     │        │  Nuxt 4 SSR         │
└──────────┬──────────┘        └──────────┬──────────┘
           │  HTTPS / JSON (JWT Bearer)   │
           └──────────────┬───────────────┘
                          ▼
              ┌───────────────────────┐
              │   amarhan-api         │
              │   Express 4 (REST)    │
              │  ┌─────────────────┐  │
              │  │ routes          │  │  Joi validate + authorize
              │  ├─────────────────┤  │
              │  │ controllers     │  │  HTTP req/res
              │  ├─────────────────┤  │
              │  │ services        │  │  Бизнес логик, транзакц
              │  ├─────────────────┤  │
              │  │ repositories    │  │  Mongoose query
              │  └─────────────────┘  │
              └───────┬───────┬───────┘
                      │       │
        ┌─────────────┘       └──────────────┐
        ▼                                     ▼
┌───────────────┐                   ┌──────────────────┐
│  MongoDB 7    │                   │ Гадаад сервисүүд │
│  (replica set)│                   │ QPay, SMS, S3,   │
│  + indexes    │                   │ OneSignal, Slack │
└───────────────┘                   └──────────────────┘
        ▲
        │ (Phase 8)
┌───────────────┐
│  Redis        │  кэш, rate limit, тайлангийн түр хадгалалт
└───────────────┘
```

### Хоёр frontend, нэг backend

Админ систем ба хэрэглэгчийн вэб нь **нэг Nuxt апп доторх өөр route бүлэг** (`/admin/*` ба `/*`)
байдлаар хэрэгжинэ — тусдаа deploy хийхгүй. Шалтгаан: компонент, дизайн систем, `useApi`
composable зэргийг хуваалцах; жижиг багт хоёр апп арчлах зардал өндөр.

Тусгаарлалт нь **layout + middleware түвшинд** хийгдэнэ:

- `app/layouts/admin.vue` + `middleware/auth.ts` → зөвхөн ажилтны токен
- `app/layouts/default.vue` + `middleware/customer.ts` → зөвхөн харилцагчийн токен

Жинхэнэ хамгаалалт нь **үргэлж backend талд** (`authorize()` middleware) байна.

---

## 2. Backend давхаргууд

Давхарга бүр зөвхөн доод хөршөө дуудна. Дээшээ буцаж дуудахыг хориглоно.

```
Route  ──►  Controller  ──►  Service  ──►  Repository  ──►  Model (Mongoose)
  │            │                │               │
validate    req/res           бизнес          query
authorize   мэдэхгүй          логик,          бүтээх
            DB-г мэдэхгүй     транзакц
```

| Давхарга | Хариуцах зүйл | Хориотой зүйл |
|---|---|---|
| **Route** | URL, HTTP method, `validate()`, `authorize()` холбох | Логик бичих |
| **Controller** | `req`-ээс өгөгдөл гаргаж service дуудах, `res` буцаах | Mongoose дуудах, тооцоолол хийх |
| **Service** | Бизнес дүрэм, олон repository зохион байгуулах, транзакц, audit log бичих | `req`/`res` объект хүлээж авах |
| **Repository** | Mongoose query, aggregation, index ашиглалт | Бизнес нөхцөл шалгах, алдаа шидэх (APIError) |
| **Model** | Schema, index, hook, virtual | Гадаад сервис дуудах |

**Repository бүр `BaseRepository`-оос удамшина** (`src/repositories/base.repository.js` —
`findById`, `findOne`, `find`, `paginate`, `create`, `updateById`, `deleteById`, `count`).
Домэйн-тусгай query-г тухайн repository-д нэмнэ.

**Service нь singleton instance экспортлоно** (одоо байгаа `user.service.js`-ийн адил):

```js
class PackageService { /* ... */ }
module.exports = new PackageService();
```

---

## 3. Модулиудын хамаарал

```
        ┌──────────────┐
        │  Аюулгүй     │  ◄── бүх модуль audit бичнэ
        │  байдал (9)  │
        └──────────────┘
               ▲
┌──────────┐   │   ┌──────────┐
│ Агуулах  │───┼──►│  Ачаа    │◄────────┐
│   (8)    │   │   │   (1)    │         │
└──────────┘   │   └────┬─────┘         │
               │        │               │
        ┌──────┴───┐    ▼          ┌────┴─────┐
        │ Тариф/   │  ┌──────────┐ │ Хүргэлт  │
        │ тохиргоо │  │ Төлбөр   │►│   (5)    │
        └──────────┘  │   (2)    │ └──────────┘
                      └────┬─────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │Урамшуулал│ │ Тайлан   │ │Notificat.│
        │   (4)    │ │   (6)    │ │   (7)    │
        └──────────┘ └──────────┘ └──────────┘
              ▲            ▲            ▲
              └────────────┴────────────┘
                     Хэрэглэгчийн вэб (3)
```

**Гол хамаарал:**

- **Ачаа** бол системийн төв нэгж. Бусад бүх зүйл ачаа руу заана.
- **Төлбөр → Хүргэлт**: `balance = 0` биш бол хүргэлтэнд гаргахгүй (§5.2). Энэ шалгалт
  `delivery.service.js` дотор биш, `package.service.js`-ийн **төлөв шилжих гэрээ** (state
  transition guard) дотор байрлана — ингэснээр аль ч замаар тойрч гарах боломжгүй.
- **Төлбөр → Урамшуулал**: оноо зөвхөн `balance = 0` болсны дараа бодогдоно (§4).
- **Ачаа/Төлбөр/Тохиргоо → Audit**: service давхаргаас `auditService.record()` дуудна.

---

## 4. Гол загварууд (patterns)

### 4.1 Төлөвийн машин (State machine)

Ачааны төлөв санамсаргүй өөрчлөгдөхгүй. Зөвшөөрөгдсөн шилжилтийг нэг газарт
(`src/domain/package-state.js`) тодорхойлж, service түүнийг л ашиглана.

```js
// Замын төлөв БАЙХГҮЙ — бүртгэл нь ачаа Монголд ирсний дараа (BR-07).
// `paid` руу шууд орох нь СИСТЕМИЙН зам (төлбөр бүртгэгдэх) — гараар үсрэхгүй.
const TRANSITIONS = {
  registered:        ['notified', 'awaiting_payment', 'paid', 'cancelled'],
  notified:          ['awaiting_payment', 'paid', 'cancelled'],
  awaiting_payment:  ['paid', 'cancelled'],
  // `awaiting_payment` руу буцах нь төлбөр хүчингүй болсны залруулга (BR-18) —
  // `SYSTEM_ONLY_EDGES` гараар хийхийг хориглоно
  paid:              ['out_for_delivery', 'picked_up', 'awaiting_payment'],
  out_for_delivery:  ['delivered', 'returned'],
  picked_up:         ['delivered'],
  delivered:         [],
  returned:          ['out_for_delivery', 'picked_up'],
  cancelled:         [],
};

const GUARDS = {
  // §5.2 — төлбөр дуусаагүй бол хүргэлтэнд гаргахгүй. Override байхгүй.
  out_for_delivery: (pkg) => pkg.balance === 0,
  picked_up:        (pkg) => pkg.balance === 0,
};
```

**Дүрэм:** төлөв өөрчлөх ганц л зам байна — `packageService.changeStatus(id, next, ctx)`.
Хаана ч `pkg.status = '...'` гэж шууд онооход хориотой.

### 4.2 Үнэ тооцох цэвэр функц (Pure pricing function)

Үнийн логик (§1.2) нь DB-ээс хамааралгүй цэвэр функц байна — ингэснээр тестлэхэд хялбар:

```js
// src/domain/pricing.js
function calculatePrice({ weightKg, volumeM3, tariff }) {
  const byWeight = Math.round(weightKg * tariff.pricePerKg);
  const byVolume = Math.round(volumeM3 * tariff.pricePerM3);
  const computed = Math.max(byWeight, byVolume);
  const final    = Math.max(computed, tariff.minimumCharge);
  return {
    byWeight, byVolume, final,
    source: final === tariff.minimumCharge && computed < tariff.minimumCharge
      ? 'minimum'
      : (byWeight >= byVolume ? 'weight' : 'volume'),
  };
}
```

### 4.3 Audit log — service давхаргаас, транзакц дотор

```js
// package.service.js доторх жишээ
async overridePrice(packageId, newPrice, reason, actor) {
  const pkg = await packageRepository.findById(packageId);
  if (!pkg) throw new APIError('Ачаа олдсонгүй', httpStatus.NOT_FOUND);

  this.assertOverrideAllowed(pkg, newPrice, actor);   // §1.2, §9.1 эрхийн хязгаар

  return withTransaction(async (session) => {
    const before = pkg.finalPrice;
    await packageRepository.updateById(packageId, {
      finalPrice: newPrice, priceOverridden: true, priceOverrideReason: reason,
    }, { session });

    await auditService.record({
      actor, action: 'package.price_override', entity: 'package', entityId: packageId,
      field: 'finalPrice', before, after: newPrice, reason,
    }, { session });
  });
}
```

**Транзакц шаардлагатай учир:** audit бичлэггүй өөрчлөлт, эсвэл өөрчлөлтгүй audit бичлэг
хоёулаа бизнесийн хувьд буруу. Тиймээс MongoDB-г **replica set горимд** (ганц node ч болно)
ажиллуулж, `session` ашиглана.

### 4.4 Идемпотент вебхүүк (QPay callback)

QPay нэг төлбөрийн мэдэгдлийг олон удаа илгээж болно. `payments` коллекцод
`(provider, providerInvoiceId)` дээр unique index тавьж, давхардсан callback-ийг
`200 OK` буцаан чимээгүй алгасана.

### 4.5 Тохиргооны хувилбаржилт (Versioned config)

Тариф, урамшууллын босго өөрчлөгдвөл **өмнөх ачааны үнэ өөрчлөгдөхгүй** байх ёстой.
Тиймээс:

- Ачаа бүртгэгдэхдээ тухайн үеийн тарифын **утгыг өөр дээрээ хуулж хадгална**
  (`pricingSnapshot`), зөвхөн `tariffId` заахгүй.
- Тарифын өөрчлөлт бүр `tariff_versions`-д шинэ мөр болж, хуучин мөр устахгүй.

---

## 5. Гүйцэтгэлийн архитектур (§9.3 — 1M+ мөр, < 1 сек)

| Түвшин | Шийдэл |
|---|---|
| **Index** | `trackingNumber` (unique, partial), `customerPhone`, `status`, `createdAt`, `locationCode`, нийлмэл index `{ status: 1, createdAt: -1 }` |
| **Хайлт** | Бүх шүүлт Mongo query-д орно. `Array.filter` client талд хориотой |
| **Хуудаслалт** | `mongoose-paginate-v2`, default 50/хуудас, max 100 |
| **Тоолуур** | Их коллекцод `countDocuments` удаан — жагсаалтад `totalDocs`-ыг сонголтоор (`?withTotal=false`) унтраах боломжтой болгоно |
| **Тайлан** | Тайлан үндсэн коллекцыг шууд уншихгүй. Өдөр бүр `report_daily_*` нэгтгэсэн коллекц үүсгэх (aggregation pipeline + cron) |
| **Frontend** | Виртуал скролл (`@vueuse/core`-ийн `useVirtualList`), хайлтад 300ms debounce |
| **Кэш** | Redis — тариф, тохиргоо, тайлангийн хураангуй (Phase 8) |

> **Read/Write тусгаарлалт:** Тайлангийн модуль үндсэн ажиллагаанд нөлөөлөхгүй байх шаардлага
> (§6) — эхний ээлжид урьдчилан нэгтгэсэн коллекцоор хангана. Ачаалал өсвөл MongoDB replica-ийн
> secondary node-оос унших (`readPreference: 'secondaryPreferred'`) руу шилжинэ.

---

## 6. Аюулгүй байдлын архитектур

| Давхарга | Механизм |
|---|---|
| Тээвэр | HTTPS заавал (nginx/Caddy TLS termination) |
| Танилт | JWT (Bearer). Ажилтан ба харилцагчид **тусдаа token audience** (`aud: 'staff'` / `'customer'`) |
| Эрх | `authorize(ROLE_GROUP.X)` route бүрт. Менежер зөвхөн өөрийн салбарын өгөгдөл (`branchId` шүүлт service дотор) |
| Оролт | Joi схем (`validate` middleware) + `mongo-sanitize` (NoSQL injection) |
| Толгой | `helmet` |
| Хурд | `express-rate-limit` — глобал + auth-д хатуу лимит |
| Нууц | Бүгд `.env`. Репод түлхүүр commit хийхгүй |
| Мөрдлөг | Append-only `audit_logs`, доод тал нь 3 жил (§9.2) |

Дэлгэрэнгүй: [`security-and-permissions.md`](security-and-permissions.md).

---

## 7. Frontend архитектур

```
app/
├── pages/
│   ├── index.vue                  # харилцагчийн нүүр
│   ├── track/[number].vue         # ачаа хайх (нэвтрэхгүйгээр)
│   ├── notifications.vue          # §7 — нэвтрээгүй ч харна
│   ├── my/                        # харилцагчийн хувийн хэсэг
│   │   ├── packages.vue  payments.vue  deliveries.vue  loyalty.vue
│   └── admin/
│       ├── packages/index.vue  packages/new.vue  packages/[id].vue
│       ├── payments/  deliveries/  warehouse/  reports/
│       └── settings/  audit/
├── components/
│   ├── ui/                        # суурь: Button, Input, Modal, Table, Badge
│   ├── package/                   # домэйн: PackageForm, StatusBadge, PackageTable
│   ├── payment/  delivery/  warehouse/
├── composables/                   # домэйн бүрт нэг: usePackages, usePayments, ...
├── stores/                        # Pinia: auth, settings (глобал төлөв л энд)
├── layouts/                       # default (харилцагч), admin (ажилтан)
└── middleware/                    # auth (ажилтан), customer, role
```

**Дүрэм:**

- Сервер өгөгдөл → **composable** (`usePackages`), Pinia store биш. Store-ыг зөвхөн
  жинхэнэ глобал төлөвт (auth, тохиргоо) ашиглана.
- Composable бүр `useApi`-г ашиглана — `$axios`-ыг компонентоос шууд дуудахгүй.
- Хүснэгт/жагсаалтын хуудаслалт, шүүлт **үргэлж query параметрээр backend руу** явна.

---

## 8. Гадаад интеграцууд

| Сервис | Зориулалт | Phase | Тэмдэглэл |
|---|---|---|---|
| **QPay** | Онлайн төлбөр, callback | 4 | Одоогийн `qpay.js` нь өөр төслийнх — бүрэн дахин бичнэ |
| **SMS gateway** | Ачаа ирсэн, төлбөр, хүргэлтийн мэдэгдэл | 5 | Үйлчилгээ үзүүлэгч сонгох шаардлагатай |
| **Google OAuth** | Харилцагчийн нэвтрэлт | 4 | `passport-google-oauth20` аль хэдийн суусан |
| **AWS S3** | Ачааны зураг, экспорт файл | 2 | `s3-upload.js` бэлэн |
| **OneSignal** | Push мэдэгдэл | 5 | Сонголтоор |

**Интеграцын дүрэм:** гадаад дуудлага бүр `src/integrations/<name>/` дотор, adapter
интерфейсийн ард байрлана. Service давхарга adapter-ыг л мэднэ — ингэснээр үйлчилгээ
үзүүлэгч солиход домэйн код өөрчлөгдөхгүй, тестэд mock хийхэд хялбар.

---

## 9. Архитектурын шийдвэрүүд ба үндэслэл

| # | Шийдвэр | Үндэслэл | Хувилбар (татгалзсан) |
|---|---|---|---|
| 1 | MongoDB хэвээр үлдээх | Одоо байгаа код, багийн туршлага; ачааны бичлэг нь баримт хэлбэртэй | PostgreSQL — санхүүгийн бүрэн бүтэн байдалд илүү, гэхдээ бүхэл системийг дахин бичих зардал өндөр |
| 2 | Replica set (ганц node ч гэсэн) | Транзакц ашиглах цорын ганц зам; audit + өөрчлөлт атомик байх шаардлагатай | Standalone — транзакцгүй, санхүүгийн эрсдэлтэй |
| 3 | Ажилтан ба харилцагчийг **тусдаа коллекцод** | Харилцагч ачаа бүртгэх үед утсаар автоматаар үүсдэг (нууц үггүй); ажилтны хүснэгтэд ийм бичлэг холилдвол эрхийн эрсдэл үүснэ | Нэг `users` коллекц — одоогийн boilerplate-ийн байдал |
| 4 | Монолит REST API | Багийн хэмжээ, ачааллын түвшинд микросервис хэт эрт | Микросервис |
| 5 | Нэг Nuxt апп, хоёр layout | Компонент дахин ашиглалт, deploy хялбар | Хоёр тусдаа апп |
| 6 | Мөнгийг бүхэл тоогоор (₮) | Төгрөгт бутархай нэгж хэрэглэгддэггүй; float алдаа санхүүд хүлээн зөвшөөрөгдөхгүй | Decimal128 — илүү нарийн ч илүү төвөгтэй |
| 7 | Тайланг урьдчилан нэгтгэх | §6 ба §9.3-ын шаардлага; live aggregation 1M мөрөнд удаан | Live aggregation |

---

## 10. Хавсралт — хүсэлтийн бүтэн замнал (жишээ)

`POST /api/v1/packages` (ачаа бүртгэх):

```
1. requestId          → мөрдөх ID оноох
2. sanitize           → NoSQL injection цэвэрлэх
3. cors, helmet       → аюулгүй байдал
4. globalLimiter      → хурдны хязгаар
5. authorize(STAFF)   → JWT шалгах, role шалгах
6. validate(schema)   → Joi — trackingNumber, phone, weight/volume заавал
7. packageController.create
     └► packageService.create(dto, actor)
           ├─ trackingNumber давхардал шалгах        (§1.3)
           ├─ customer-ийг утсаар олох/үүсгэх        (§3)
           ├─ tariff → calculatePrice()              (§1.2)
           ├─ байршил санал болгох                    (§8)
           └─ withTransaction:
                ├─ packageRepository.create()
                └─ auditService.record('package.create')
8. created(res, pkg)  → 201 { success: true, data: {...} }
```
