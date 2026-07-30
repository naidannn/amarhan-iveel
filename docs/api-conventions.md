# API конвенц

> REST API-ийн дүрэм. Одоо байгаа `src/routes/api/`, `src/utils/response.js` кодыг үндэс болгосон.

---

## 1. Суурь

| Зүйл | Утга |
|---|---|
| Суурь зам | `/api/v1` |
| Формат | JSON |
| Танилт | `Authorization: Bearer <JWT>` |
| Мөрдөх ID | `X-Request-ID` (байхгүй бол сервер үүсгэнэ) |
| Хугацаа | ISO 8601 UTC (`2026-07-29T07:22:14.000Z`) |
| Эрүүл мэнд | `GET /api/status` |

---

## 2. URL нэршил

- Нөөцийн нэр **олон тоогоор, kebab-case**: `/packages`, `/warehouse-locations`
- Үйлдэл нь CRUD-д багтахгүй бол дэд зам болгоно:

```
POST   /api/v1/packages                      # бүртгэх
GET    /api/v1/packages                      # жагсаах (шүүлт, хуудаслалт)
GET    /api/v1/packages/:packageId           # дэлгэрэнгүй
PUT    /api/v1/packages/:packageId           # засах
POST   /api/v1/packages/:packageId/status    # төлөв өөрчлөх (§1.5)
POST   /api/v1/packages/:packageId/price-override   # үнэ override (§1.2)
POST   /api/v1/packages/:packageId/location  # байршил шилжүүлэх (§8)
POST   /api/v1/packages/:packageId/cancel    # "Хүчингүй" болгох (§1.6)
DELETE /api/v1/packages/:packageId           # бүрмөсөн устгах (зөвхөн Админ, §1.6)
```

> Төлөв өөрчлөхөд `PUT /packages/:id` ашиглахгүй. Тусдаа endpoint байх нь эрх, guard,
> audit-ыг тодорхой болгоно.

**Параметрийн нэр** — `:<entity>Id` хэлбэрээр (`:packageId`, `:paymentId`), зүгээр `:id` биш.

---

## 3. Хариултын формат

`src/utils/response.js`-ийн `success` / `created` / `error` туслахуудыг **үргэлж** ашиглана.

### Амжилттай — нэг объект

```json
{ "success": true, "data": { "id": "...", "trackingNumber": "TRK-88213" } }
```

### Амжилттай — жагсаалт

```json
{
  "success": true,
  "data": [ /* ... */ ],
  "pagination": { "page": 1, "pages": 42, "total": 2100, "limit": 50 }
}
```

### Алдаа

```json
{ "success": false, "message": "Ачаа олдсонгүй" }
```

### Валидацын алдаа (400)

```json
{
  "success": false,
  "message": "Validation Error",
  "errors": [
    { "field": "trackingNumber", "message": "\"trackingNumber\" is required", "location": "body" }
  ]
}
```

### Бизнес дүрмийн алдаа (409 / 422)

Хэрэглэгчийн дараагийн үйлдлийг тодорхойлоход нэмэлт мэдээлэл өгнө:

```json
{
  "success": false,
  "message": "Энэ дугаар 2026-07-28-нд Бат-аар бүртгэгдсэн",
  "code": "DUPLICATE_TRACKING_NUMBER",
  "data": { "existingPackageId": "66a1...", "registeredAt": "2026-07-28T04:11:00.000Z" }
}
```

> `code` талбар нь frontend-д тусгай UI урсгал (жишээ: "Оршин буй ачааг харах" товч)
> харуулахад хэрэгтэй. Бизнесийн онцгой алдаа бүрт `code` өгнө.

---

## 4. HTTP статус код

| Код | Хэзээ |
|---|---|
| `200` | Амжилттай (GET, PUT, POST үйлдэл) |
| `201` | Шинэ нөөц үүссэн (`created()`) |
| `400` | Валидацын алдаа, буруу оролт |
| `401` | Токен байхгүй/буруу |
| `403` | Эрх хүрэхгүй (§9.1) |
| `404` | Олдсонгүй |
| `409` | Зөрчил — давхардсан tracking number (§1.3), зөвшөөрөгдөөгүй төлөв шилжилт |
| `422` | Бизнес дүрэм зөрчигдсөн — төлбөр дутуу байхад хүргэлтэнд гаргах (§5.2) |
| `429` | Rate limit |
| `500` | Дотоод алдаа |

---

## 5. Жагсаалтын query параметр

Бүх жагсаалтын endpoint нэг ижил параметр дэмжинэ:

| Параметр | Төрөл | Default | Тайлбар |
|---|---|---|---|
| `page` | int ≥ 1 | 1 | |
| `limit` | int 1–100 | 50 | §9.3 |
| `sort` | string | `-createdAt` | `-` = буурахаар |
| `search` | string | — | Чөлөөт хайлт |
| `withTotal` | bool | `true` | `false` бол `countDocuments` алгасана (§9.3) |

Домэйн-тусгай шүүлтүүд нэмэгдэнэ:

```
GET /api/v1/packages?status=awaiting_payment&branchId=...&phone=99112233
                    &locationCode=UB-02-B-15&from=2026-07-01&to=2026-07-30
                    &page=1&limit=50
```

**Дүрэм (§9.3):**
- Шүүлт бүр **индекслэгдсэн талбар** дээр байх ёстой
- `limit`-ийн дээд хязгаар 100 — хязгааргүй жагсаалт буцаахгүй
- Client талд шүүхийн тулд бүх өгөгдөл буцаах endpoint байхгүй

---

## 6. Route файлын бүтэц

```js
'use strict';

const express = require('express');
const router = express.Router();
const packageController = require('../../controllers/package.controller');
const authorize = require('../../middlewares/authorization');
const validate = require('../../middlewares/validate');
const packageValidation = require('../../validations/package.validation');
const Constants = require('../../config/constants');

// Бүх route-д ажилтны эрх шаардлагатай
router.use(authorize(Constants.ROLE_GROUP.STAFF));

router
  .route('/')
  .get(validate(packageValidation.list), packageController.list)
  .post(validate(packageValidation.create), packageController.create);

router
  .route('/:packageId')
  .get(validate(packageValidation.getOne), packageController.get)
  .put(validate(packageValidation.update), packageController.update)
  // §1.6 — бүрмөсөн устгах зөвхөн Админ
  .delete(
    authorize(Constants.ROLE_GROUP.ADMIN),
    validate(packageValidation.remove),
    packageController.remove
  );

// §1.2 — хязгааргүй override зөвхөн Менежер/Админ; хязгаарын шалгалт service дотор
router.post(
  '/:packageId/price-override',
  validate(packageValidation.priceOverride),
  packageController.priceOverride
);

module.exports = router;
```

**Дараалал үргэлж:** `authorize` → `validate` → `controller`.

`routes/api/index.js`-д бүртгэнэ:

```js
router.use('/v1/packages', packageRouter);
```

---

## 7. Танилт ба эрх

### Токен

| Талбар | Ажилтан | Харилцагч |
|---|---|---|
| `sub` | `users._id` | `customers._id` |
| `aud` | `staff` | `customer` |
| `role` | `admin`/`manager`/`staff` | — |
| `branchId` | салбарын ID | — |
| Хугацаа | 8 цаг | 30 хоног |

> **Заавал:** `aud` шалгагдана. Харилцагчийн токеноор админ endpoint рүү орох
> боломжгүй, эсрэгээр ч мөн адил. Хоёр ТУСДАА passport strategy (`jwt`,
> `jwt-customer`) — нэг strategy-д хоёр audience зөвшөөрвөл тусгаарлалт нурна.

Гурав дахь, **түр** audience байдаг: `customer_pending` (15 мин). Google-ээр
эхний удаа нэвтэрсэн ч утсаа хараахан өгөөгүй хүнд олгоно. Ард нь бодит
харилцагчийн бичлэг БАЙХГҮЙ тул `customer`-той адилтгахыг хориглоно —
адилтгавал бүртгэлгүй хүн харилцагчийн endpoint рүү орно.

### Эрхийн бүлэг (`config/constants.js`)

```js
exports.ROLE_GROUP = {
  ADMIN:      ['admin'],
  MANAGEMENT: ['admin', 'manager'],
  STAFF:      ['admin', 'manager', 'staff'],
};
```

### Салбарын хамрах хүрээ (§9.1)

Менежер зөвхөн өөрийн салбарын өгөгдлийг харна. Энэ шүүлт **service давхаргад**,
`actor.role`-ээс хамааран автоматаар нэмэгдэнэ — controller эсвэл frontend-д итгэхгүй:

```js
applyBranchScope(query, actor) {
  if (actor.role === 'admin') return query;
  return { ...query, branchId: actor.branchId };
}
```

> **Нэг салбарын горим (BR-22a).** Ивээл Карго ганц салбартай тул `branchId`
> оролт заавал биш — `branchResolver.resolveBranch()` цорын ганц идэвхтэй
> салбарыг автоматаар сонгоно. Салбар олон болмогц заахыг шаардаж эхэлнэ.

---

## 8. Харилцагчийн API (§3, Phase 5)

> **`/v1/customer` (ганц тоо) ≠ `/v1/customers` (олон тоо).** Эхнийх нь
> ХАРИЛЦАГЧ өөрөө ханддаг (`aud: 'customer'`), хоёр дахь нь АЖИЛТАН
> харилцагчийг удирддаг (`aud: 'staff'`). Нэрийн ялгаа бага тул route
> нэмэхдээ алийг нь өргөтгөж байгаагаа шалгана.

Танилтгүй:

```
POST   /api/v1/customer/auth/register           # утас + нууц үг. Утас ЗААВАЛ (BR-26)
POST   /api/v1/customer/auth/login              # identifier = утас ЭСВЭЛ имэйл
GET    /api/v1/customer/auth/google             # → Google руу redirect
GET    /api/v1/customer/auth/google/callback    # → frontend руу redirect (JSON БИШ)
POST   /api/v1/customer/auth/google/complete    # түр токен + утас → бүртгэл дуусна
```

Танилт шаардсан (`authorizeCustomer()` → `req.customer`):

```
GET    /api/v1/customer/auth/me
POST   /api/v1/customer/auth/logout
POST   /api/v1/customer/auth/change-password
PUT    /api/v1/customer/me                      # нэр, имэйл. `phone` БАЙХГҮЙ
PUT    /api/v1/customer/me/addresses
GET    /api/v1/customer/summary                 # нүүр самбарын тоо + үлдэгдэл
GET    /api/v1/customer/packages
GET    /api/v1/customer/packages/:packageId
GET    /api/v1/customer/payments
GET    /api/v1/customer/invoices
GET    /api/v1/customer/deliveries
```

**Гурван дүрэм** (`customer-portal.service.js`):

1. Хамрах хүрээ ҮРГЭЛЖ `req.customer._id`-ээс. Клиентээс ирсэн
   `customerId`/`phone`-г ХЭЗЭЭ Ч авахгүй; Joi танигдахгүй параметрийг таслана.
2. Эрхгүй бичлэгт **`404`**, `403` биш — `403` нь тухайн ID оршин байгааг батална.
3. Хариу нь **цагаан жагсаалттай**. `note`, `locationCode`, `registeredBy`,
   `pricingSnapshot` зэрэг дотоод талбар гарахгүй.

Нээлттэй (танилтгүй, `publicLimiter`-т захирагдана):

```
GET    /api/v1/public/track/:trackingNumber    # төлөв + масклагдсан утас
GET    /api/v1/public/content                  # Эрээний хаяг, холбоо барих, FAQ
GET    /api/v1/public/notifications            # §7 — Phase 6
```

> **`/public/*`-д нэмсэн зам БҮР интернэтэд ил.** `track` нь ҮНЭ, ҮЛДЭГДЭЛ,
> агуулахын байршил, бүтэн утсыг БУЦААХГҮЙ — дугаар мэддэг хэн ч дуудна.
> `content` нь `PUBLIC_CONTENT_KEYS` **жагсаалтад** байгаа түлхүүрийг л
> буцаана (угтварын шүүлт биш).

Тохиргоо / статик агуулга (Phase 5, 5.10):

```
GET    /api/v1/settings                        # унших: ажилтан ба дээш
PUT    /api/v1/settings/:key                   # засах: ЗӨВХӨН Админ, audit-д
```

`:key` нь `SETTING_KEY`-д байгаа утга байх ёстой; утгын хэлбэрийг түлхүүр тус
бүрээр Joi шалгана (`validations/setting.validation.js`) — `settings.value` нь
Mongoose-д `Mixed` тул схемийн хамгаалалт өөр байхгүй.

**QPay callback** (гадаад, Phase 5.6–5.7 — ХЭРЭГЖЭЭГҮЙ):
```
POST   /api/v1/webhooks/qpay
```
Rate limit-ээс чөлөөлөгдөнө, гарын үсгээр баталгаажна, **идемпотент**.

---

## 8a. Төлбөрийн API (§1.8, §2)

```
GET    /api/v1/payments                        # §2.2 — жагсаалт, шүүлттэй
GET    /api/v1/payments/summary                # хэлбэр тус бүрийн нийлбэр (касс тулгах)
GET    /api/v1/payments/package/:packageId     # ачаанд орсон төлбөрүүд
POST   /api/v1/payments                        # төлбөр бүртгэх (3 оролтын хэлбэр)
GET    /api/v1/payments/:paymentId
PUT    /api/v1/payments/:paymentId/void        # BR-18 — Менежер, Админ

GET    /api/v1/payments/invoices               # §2.3 — нэхэмжлэхийн жагсаалт
POST   /api/v1/payments/invoices               # олон ачаанаас нэхэмжлэх үүсгэх
GET    /api/v1/payments/invoices/payable/:phone # нэхэмжлэх үүсгэхийн ӨМНӨХ дэлгэц
GET    /api/v1/payments/invoices/:invoiceId    # дэлгэрэнгүй + төлбөрүүд + audit
PUT    /api/v1/payments/invoices/:invoiceId/cancel  # BR-18a — Менежер, Админ
```

> **Нэхэмжлэх нь `/payments/invoices`-д, `/invoices`-д БИШ.** Шалтгаан:
> нэхэмжлэх нь бие даасан объект биш, төлбөр авах урсгалын хэсэг (§2.3) —
> ачааны `balance` нь нэхэмжлэхээс биш `payments.allocations`-аас гардаг
> (BR-14). Замын бүтэц энэ хамаарлыг илэрхийлнэ.

`POST /payments`-ийн **гурван** оролтын хэлбэр (ядаж нэг заавал):

| Оролт | Хуваарилалт |
|---|---|
| `invoiceId` | нэхэмжлэхийн ачаанууд дунд пропорциональ (BR-17) |
| `packageIds` | нэхэмжлэхгүйгээр шууд, мөн пропорциональ |
| `allocations` | ажилтан ачаа тус бүрийн дүнг ГАРААР заасан (BR-17a) |

---

## 8b. Хүргэлтийн API (§5)

```
GET    /api/v1/deliveries                       # жагсаалт, шүүлттэй (§9.3)
GET    /api/v1/deliveries/summary               # төлөв тус бүрийн тоо (өдрийн маршрут)
GET    /api/v1/deliveries/deliverable/:phone    # хүргэлт үүсгэхийн ӨМНӨХ дэлгэц
GET    /api/v1/deliveries/package/:packageId    # ачаа ямар хүргэлтүүдэд орсон
POST   /api/v1/deliveries                       # хүргэлт үүсгэх (төлбөр шаардахгүй)
PUT    /api/v1/deliveries/bulk/status           # өдрийн маршрутыг нэг дор гаргах
GET    /api/v1/deliveries/:deliveryId           # дэлгэрэнгүй + unpaidTotal + audit
PUT    /api/v1/deliveries/:deliveryId           # засах (зөвхөн `created` төлөвт)
PUT    /api/v1/deliveries/:deliveryId/status    # BR-21 — төлөв өөрчлөх ганц зам
PUT    /api/v1/deliveries/:deliveryId/cancel    # Менежер, Админ, шалтгаан заавал
```

Өдрийн маршрутыг товлосон огноогоор шүүнэ:
`GET /deliveries?scheduledFrom=...&scheduledTo=...&status=created`

**`PUT /:deliveryId/status` — §5.2-ын хаалт.** `status: 'dispatched'` үед багц
доторх бүх ачааны `balance === 0` байх ёстой. Дутуу бол:

```json
{
  "success": false,
  "message": "Төлбөр дутуу байна: 12,000₮",
  "code": "UNPAID_PACKAGES",
  "details": {
    "unpaidTotal": 12000,
    "packages": [{ "id": "...", "trackingNumber": "TRK123", "balance": 12000 }]
  }
}
```

> **`force`, `override` гэсэн параметр БАЙХГҮЙ бөгөөд нэмэхийг хориглоно.**
> Энэ хаалт нь эрхийн БИШ, домэйны хориг — Админ ч тойрч чадахгүй (§5.2).
> `details.packages` нь UI-д аль ачааны төлбөр дутууг шууд заахад зориулагдсан.

`GET /deliveries/:id` нь `allowedTransitions`-ыг **`manualTransitions()`**-ээс
буцаана (`cancelled` орохгүй) — UI зөвхөн бодитоор ажиллах товч харуулна.

---

## 9. Bulk үйлдэл

Олон ачааг нэг дор боловсруулах (§1.9, §2.3):

```
POST /api/v1/payments/invoices       # олон ачаанаас нэхэмжлэх үүсгэх
POST /api/v1/packages/bulk-status    # олон ачааны төлөв өөрчлөх
PUT  /api/v1/deliveries/bulk/status  # олон хүргэлтийн төлөв өөрчлөх (§5)
```

- Нэг хүсэлтэд дээд тал нь **200 элемент** (хүргэлтийн багцад **100**). §1.9-д
  «20–40 ачаа» гэсэн ч хязгаарыг өгөөмөр тавьсан — түүнээс дээш бол нэг HTTP
  хүсэлт хэт урт ажиллаж, ажилтан хүлээнэ
- Нэхэмжлэх үүсгэх нь `withTransaction` дотор дараалан хийгдэнэ — **атомик БИШ**
  (standalone MongoDB, `docs/architecture.md` §9 шийдвэр #2): дунд алдаа гарвал
  өмнөх бичлэг буцаагдахгүй үлдэж болно
- Төлөв өөрчлөх bulk (`packages/bulk-status`, `deliveries/bulk/status`) нь
  элемент бүрийг **ТУСДАА транзакцаар** хийнэ: 40 ачааны 39 нь зөв, 1 нь буруу
  төлөвт байхад бүгдийг унагах нь ажилтныг гацуулна. Аль нь болсон, аль нь
  болоогүйг тодорхой буцаана
- Хариултад амжилтгүй болсон элемент бүрийн шалтгаан:

```json
{
  "success": false,
  "message": "3 ачаа боловсруулагдсангүй",
  "data": {
    "succeeded": ["TRK-1", "TRK-2"],
    "failed": [{ "trackingNumber": "TRK-3", "reason": "Төлбөр дутуу: 12,000₮" }]
  }
}
```

---

## 10. Хувилбаржилт

- Зам дотор хувилбар: `/api/v1/...`
- Эвдрэлтэй өөрчлөлт → `/api/v2/`. Хуучин хувилбар доод тал нь 3 сар ажиллана
- Талбар нэмэх нь эвдрэлтэй өөрчлөлт биш; талбар устгах/нэр солих нь мөн

---

## 11. Шинэ endpoint нэмэх шалгах хуудас

- [ ] Route-д `authorize(...)` тавьсан
- [ ] Joi схем бичсэн, `validate()`-аар холбосон
- [ ] Controller зөвхөн service дуудна, `try/catch` + `next(error)`
- [ ] Service дотор бизнес дүрэм, шаардлагатай бол транзакц
- [ ] Мөнгө/төлөв өөрчилдөг бол `auditService.record()` дуудсан
- [ ] Шүүлтийн талбар индекслэгдсэн
- [ ] Жагсаалт бол хуудаслагдсан
- [ ] Менежерийн салбарын хамрах хүрээ хэрэгжсэн
- [ ] `routes/api/index.js`-д бүртгэсэн
- [ ] Тест бичсэн (амжилттай + эрх хүрэхгүй + бизнес дүрэм зөрчигдсөн тохиолдол)
