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

> **Заавал:** `aud` шалгагдана. Харилцагчийн токеноор админ endpoint рүү орох боломжгүй.

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

## 8. Харилцагчийн API

Тусдаа зам, тусдаа middleware:

```
POST   /api/v1/customer/auth/register
POST   /api/v1/customer/auth/login
POST   /api/v1/customer/auth/google
POST   /api/v1/customer/auth/phone/request-otp
POST   /api/v1/customer/auth/phone/verify
GET    /api/v1/customer/me
GET    /api/v1/customer/packages
GET    /api/v1/customer/payments
POST   /api/v1/customer/payments/qpay          # QPay нэхэмжлэх үүсгэх
POST   /api/v1/customer/deliveries
GET    /api/v1/customer/loyalty
```

Нээлттэй (танилтгүй):

```
GET    /api/v1/public/track/:trackingNumber    # ачаа хайх
GET    /api/v1/public/notifications            # §7 — нэвтрээгүй ч харна
GET    /api/v1/public/content/:key             # Эрээний хаяг г.м.
```

**QPay callback** (гадаад):
```
POST   /api/v1/webhooks/qpay
```
Rate limit-ээс чөлөөлөгдөнө, гарын үсгээр баталгаажна, **идемпотент**.

---

## 9. Bulk үйлдэл

Олон ачааг нэг дор боловсруулах (§1.9, §2.3):

```
POST /api/v1/invoices                # олон ачаанаас нэхэмжлэх үүсгэх
POST /api/v1/packages/bulk-status    # олон ачааны төлөв өөрчлөх
```

- Нэг хүсэлтэд дээд тал нь **100 элемент**
- Бүхэлдээ нэг транзакцад — нэг нь бүтэлгүйтвэл бүгд буцна
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
