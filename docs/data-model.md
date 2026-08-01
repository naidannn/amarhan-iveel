# Өгөгдлийн загвар (Data Model)

> MongoDB коллекцууд, талбар, индекс, хамаарал. Бизнес утгыг [`../introduction.md`](../introduction.md)-аас,
> дүрмийн дэлгэрэнгүйг [`business-rules.md`](business-rules.md)-аас үзнэ үү.

---

## 0. Нийтлэг дүрэм

| Дүрэм | Тайлбар |
|---|---|
| **Мөнгө** | Бүхэл тоо, нэгж = ₮. `45000` = 45,000₮. Float, аравтын бутархай **хориотой** |
| **Огноо** | `Date` (UTC). Frontend талд Asia/Ulaanbaatar руу хөрвүүлнэ |
| **`timestamps: true`** | Бүх коллекцод `createdAt`, `updatedAt` |
| **Устгал** | Домэйн бичлэгийг устгахгүй — `status: 'cancelled'` / `'voided'`. Ганц үл хамаарах: §1.6 |
| **Enum** | `config/constants.js`-д төвлөрнө |
| **Утасны дугаар** | Нормчлогдсон 8 оронтой мөр (`"99112233"`). Улсын код тусад нь |
| **Snapshot** | Тариф, үнийн тохиргоог ачаанд **хуулж** хадгална (хожим өөрчлөгдвөл түүх гажихгүй) |

---

## 1. Коллекцын зураглал

```
branches ──┬──► warehouse_locations ──┐
           │                          │
           └──► users (ажилтан)       │
                                      ▼
customers ─────────────────────────► packages ◄──── cargo_types ──► tariff_versions
    │                                  │  ▲
    │                                  │  │
    ├──► loyalty_transactions ◄────────┤  │
    │                                  │  │
    └──► invoices ──► payments ────────┘  │
                          │               │
                     deliveries ──────────┘

audit_logs   ◄── бүх коллекцоос
notifications, settings  (бие даасан)
```

---

## 2. `users` — дотоод ажилтан

Зөвхөн компанийн ажилтан. Харилцагч энд байхгүй (архитектурын шийдвэр №3).

| Талбар | Төрөл | Тайлбар |
|---|---|---|
| `email` | String, unique, lowercase | Нэвтрэх нэр |
| `password` | String | bcrypt (pre-save hook) |
| `firstname`, `lastname` | String | |
| `role` | Enum: `admin` \| `manager` \| `staff` | §9.1 |
| `branchId` | ObjectId → `branches` | Менежерийн харах хүрээг тодорхойлно |
| `status` | Enum: `active` \| `deactive` | |
| `lastLoginAt` | Date | |

**Индекс:** `email` (unique), `{ role: 1, status: 1 }`, `branchId`

> **Migration:** одоо байгаа `senior_manager` → `manager`, `manager` → `staff`, `user` →
> (ажилтан биш бол `customers` руу шилжүүлэх эсвэл идэвхгүй болгох). Phase 0.6.

---

## 3. `customers` — харилцагч

Ачаа бүртгэхэд утсаар **автоматаар үүсдэг** (нууц үггүй). Хожим өөрөө бүртгүүлэхэд
`hasAccount: true` болно.

| Талбар | Төрөл | Тайлбар |
|---|---|---|
| `phone` | String, **unique** | Нормчлогдсон, системийн гол түлхүүр (§3) |
| `phoneVerified` | Boolean | OTP-оор баталгаажсан эсэх |
| `name` | String | Сонголтоор |
| `email` | String, sparse unique | |
| `password` | String \| null | Зөвхөн өөрөө бүртгүүлсэн бол |
| `googleId` | String, sparse unique | §3 |
| `hasAccount` | Boolean | Вэбэд нэвтрэх эрхтэй эсэх |
| `addresses` | [{ label, address, note }] | Хүргэлтэд |
| `loyaltyTier` | Enum: `bronze` \| `silver` \| `gold` | §4 |
| `loyaltyPoints` | Number (бүхэл) | §4 |
| `lifetimeSpent` | Number (₮) | Түвшин тооцоход |
| `status` | Enum: `active` \| `blocked` | |

**Индекс:** `phone` (unique), `email` (sparse unique), `googleId` (sparse unique),
`{ name: 'text' }`

> **Гол дүрэм (§3):** Ачаа зөвхөн утсаар холбогдоно. Google/имэйлээр бүртгүүлсэн хэрэглэгч
> утсаа баталгаажуулмагц өмнөх бүх ачаа нь автоматаар харагдана — учир нь ачаа аль хэдийн
> тухайн `customers` бичлэг рүү холбогдсон байдаг.

> **`phone` нь `required` — утасгүй харилцагч БАЙХГҮЙ (Phase 5).** Google-ээс
> утас ирдэггүй тул тэр урсгалд бичлэгийг ШУУД үүсгэхгүй: хэрэглэгчид гарын
> үсэгтэй түр токен (`aud: 'customer_pending'`, 15 мин) олгож утсыг нь асуусны
> дараа `findOrCreateByPhone`-оор үүсгэнэ. Утасгүй бичлэг зөвшөөрвөл ямар ч
> ачаатай холбогдохгүй "хоосон" бүртгэл хуримтлагдана.

> **`phoneVerified` нь Phase 5-д `false` хэвээр үлдэнэ.** OTP хараахан
> хэрэгжээгүй (roadmap 5.2) тул систем баталгаажаагүйг баталгаажсан гэж
> БИЧИХГҮЙ. Phase 6-д зөвхөн BR-28-ийн хаалтыг асаана — өгөгдөл засах
> шаардлагагүй. Хариуд нь харилцагч утсаа өөрөө солих зам байхгүй
> (CLAUDE.md §5 дүрэм 13).

---

## 4. `branches` — салбар

> **Одоогийн байдал:** ганц салбар — **Монгол дахь** агуулах (жишээ `UB`).
> Коллекцыг устгаагүй — байршлын код салбарын кодоос эхэлдэг (§8) ба ирээдүйд
> салбар нэмэгдэх ёстой.
> Нэг салбарын горимын дүрэм: [`business-rules.md` BR-22a](business-rules.md).
>
> Ачааг Эрээнд БИШ, Монголд ирсний дараа бүртгэдэг (§1.1) тул салбар нь Монголд
> байна. Эрээний хүлээн авах хаяг нь `settings`-д хадгалагдах ХАРУУЛАХ текст
> (§3, `content.erenhot_address`) — салбарын бүртгэл биш.

| Талбар | Төрөл | Тайлбар |
|---|---|---|
| `code` | String(2), unique | `UB` (§8) |
| `name` | String | "Улаанбаатар агуулах" |
| `country` | String | "Монгол" |
| `address`, `phone` | String | Хэрэглэгчийн вэбэд харагдана (§3) |
| `isActive` | Boolean | |

---

## 5. `warehouse_locations` — агуулахын байршил (§8)

Салбар → Өрөө → Тавиур → Мөр → Нүд бүтцийн **навч (нүд) бүрт нэг бичлэг**.

| Талбар | Төрөл | Тайлбар |
|---|---|---|
| `code` | String, **unique** | `UB-02-B-15` — бүрэн код |
| `branchId` | ObjectId → `branches` | |
| `room` | String(2) | `02` |
| `shelf` | String | `B` |
| `row` | Number(1) | `1` |
| `cell` | Number(1) | `5` |
| `capacityCount` | Number | Ачааны тооны дээд хязгаар |
| `capacityM3` | Number | Эзлэхүүний дээд хязгаар |
| `currentCount` | Number | Одоогийн ачааны тоо |
| `currentM3` | Number | Одоогийн эзлэхүүн |
| `isActive` | Boolean | |

**Индекс:** `code` (unique), `{ branchId: 1, room: 1, shelf: 1 }`,
`{ branchId: 1, currentCount: 1 }` (хоосон нүд хайхад)

**Кодын формат:** `{branch}-{room}-{shelf}-{row}{cell}` — мөр ба нүд сүүлийн 2 оронд хамт.

> `currentCount`/`currentM3` нь **кэшлэгдсэн утга**. Ачаа орох/гарах бүрт транзакц дотор
> `$inc` хийнэ. Өдөр бүр `packages`-аас дахин тооцож зөрүүг шалгах cron ажиллана.

---

## 6. `cargo_types` ба `tariff_versions` (§1.2)

### `cargo_types`

| Талбар | Төрөл | Тайлбар |
|---|---|---|
| `code` | String, unique | `standard`, `fragile`, `oversized` |
| `name` | String | "Энгийн ачаа" |
| `isActive` | Boolean | |

### `tariff_versions`

Тариф өөрчлөгдөх бүрт **шинэ мөр**. Хуучин мөр устахгүй.

| Талбар | Төрөл | Тайлбар |
|---|---|---|
| `cargoTypeId` | ObjectId → `cargo_types` | |
| `weightBrackets` | [{ maxGrams, price }] | Жингийн шатлал, `maxGrams` өсөх дарааллаар. Хоосон = шатлалгүй |
| `pricePerKgAbove` | Number (₮) | Шатлалаас дээш 1 кг тутмын үнэ |
| `pricePerM3` | Number (₮) | |
| `minimumCharge` | Number (₮) | Доод хэмжээ. Шатлалтай тарифд ихэвчлэн `0` — хамгийн бага шатлал өөрөө доод хэмжээ болно |
| `effectiveFrom` | Date | Хүчин төгөлдөр болох огноо |
| `effectiveTo` | Date \| null | `null` = одоо идэвхтэй |
| `createdBy` | ObjectId → `users` | |

**Жишээ — энгийн ачаа:**

```js
{
  weightBrackets: [
    { maxGrams: 100,  price: 800 },
    { maxGrams: 500,  price: 1500 },
    { maxGrams: 1000, price: 2000 },
  ],
  pricePerKgAbove: 2000,
  pricePerM3: 400000,
  minimumCharge: 0,
}
```

> Шатлалын дараалал/давхцлыг `pre('validate')` hook (`assertValidBrackets`)
> шалгана — буруу дараалалтай шатлал үнийг **чимээгүй буруу** бодуулна.

**Индекс:** `{ cargoTypeId: 1, effectiveFrom: -1 }`

---

## 7. `packages` — ачаа (гол коллекц)

| Талбар | Төрөл | Тайлбар |
|---|---|---|
| `trackingNumber` | String | §1.3. Нормчлогдсон (зай арилсан, том үсэг) — `domain/tracking-number.js` |
| `activeTrackingNumber` | String \| null | Давхардлыг хориглох түлхүүр — доорх unique дүрэм харах |
| `customerId` | ObjectId → `customers` | |
| `customerPhone` | String | Хайлтад зориулж хуулбарласан (denormalized) |
| `branchId` | ObjectId → `branches` | Бүртгэсэн салбар |
| `cargoTypeId` | ObjectId → `cargo_types` **\| null** | Тарифаар бодоход заавал. `null` = ажилтан дүнг шууд заасан (BR-01a) |
| `quantity` | Number | §1.1, default `1` |
| `weightKg` | Number \| null | 2 орны нарийвчлал |
| `volumeM3` | Number \| null | 4 орны нарийвчлал |
| `dimensions` | { lengthCm, widthCm, heightCm } \| null | Оруулбал `volumeM3` автоматаар бодогдоно |
| **Үнэ** | | |
| `pricingSnapshot` | { weightBrackets[], pricePerKgAbove, pricePerM3, minimumCharge, tariffVersionId } **\| null** | Бүртгэх үеийн тариф (BR-02). Ачааг **засахад ч** энэ тарифаар дахин бодогдоно. `null` = тариф хэрэглээгүй (BR-01a) |
| `computedPrice` | Number (₮) | Автоматаар бодогдсон дүн. `manual` үед `finalPrice`-тай тэнцүү |
| `priceSource` | Enum: `weight` \| `volume` \| `minimum` \| `manual` | Аль замаар үнэ тодорхойлогдсон |
| `finalPrice` | Number (₮) | Бодит төлөх дүн (override-ийн дараа) |
| `priceOverridden` | Boolean | Тарифын дүнг ДАРСАН эсэх. `manual` бүртгэлд `false` — дарах дүн байгаагүй |
| `priceOverrideReason` | String \| null | Override үед **заавал**. `manual` бүртгэлд шаардахгүй |

> **`pricingSnapshot: null` нь зөвшөөрөгдсөн, ХУУРАМЧ snapshot хориотой.** Тариф
> хэрэглээгүй ачаанд хоосон/зохиомол snapshot хадгалбал `update()` түүнийг
> тариф гэж уншиж, хожим жин нэмэхэд БУРУУ дүн бодно. `null` байхад систем
> дахин бодохоос татгалзаж, үнийг зөвхөн `PUT /:id/price`-аар шалтгаантайгаар
> өөрчлүүлнэ (BR-01a).

> **Ямар нэг зам ЗААВАЛ.** `weightKg`/`volumeM3`/`dimensions`/`finalPrice`-ийн
> ядаж нэг нь өгөгдөх ёстой — Joi түвшинд `.or(...)`-оор шалгагдана. Жин өгөөд
> `cargoTypeId` өгөхгүй бол service `400` буцаана.
| **Төлбөр** | | |
| `paidAmount` | Number (₮) | Хуваарилагдсан төлбөрийн нийлбэр |
| `balance` | Number (₮) | `finalPrice − paidAmount` |
| `paymentStatus` | Enum: `unpaid` \| `partial` \| `paid` | |
| **Төлөв** | | |
| `status` | Enum (доор) | §1.5 |
| `statusHistory` | [{ from, to, at, by, byName, reason }] | Embedded. `byName` — ажилтан устсан ч түүхэнд нэр үлдэнэ |
| **Байршил** | | |
| `locationId` | ObjectId → `warehouse_locations` \| null | |
| `locationCode` | String \| null | Хайлтад зориулж хуулбарласан |
| **Бусад** | | |
| `arrivedAt` | Date | Ирсэн огноо (§1.1). Урьдчилсан төлөвт (`expected`, `in_erlian`) байх үед энд "бүртгэсэн огноо" түр хадгалагдана — "Ирц бүртгэх"-д (`completeArrival`) бодит Монголд ирсэн огноогоор ДАРЖ бичигдэнэ (BR-45, BR-46). Харилцагчид урьдчилсан үед `null` болж харагдана |
| `note` | String | Ажилтны ДОТООД тэмдэглэл — харилцагчид харагдахгүй |
| `customerNote` | String \| null | BR-46 — ХАРИЛЦАГЧИЙН өөрийн бичсэн тайлбар. `note`-оос тусдаа: нэг талбарт нийлүүлбэл дотоод тэмдэглэл задарна |
| `registeredBy` | ObjectId → `users` | Бодит бүртгэл хийсэн ажилтан. Харилцагчийн мэдүүлэгт `null` |
| `registrationSource` | Enum: `staff` \| `customer` | BR-46 — бичлэгийг ХЭН эхлүүлсэн. Шингээхэд ӨӨРЧЛӨГДӨХГҮЙ (түүхэн баримт). `registeredBy: null` нь "систем/seed" гэсэн утга ч агуулдаг тул тэр талбар үүнийг заахгүй |
| `isDuplicateApproved` | Boolean | §1.3 — Менежер зөвшөөрсөн давхардал |
| `cancelledAt`, `cancelReason` | Date, String | §1.6 |

### Төлөвийн enum (§1.5)

> **11 утга.** Хуучин `in_transit` ба `arrived` БАЙХГҮЙ хэвээр — бодит бүртгэл
> (жин/үнэ/байршил) нь ачаа Монголд ирсний дараа хийгддэг тул `registered` өөрөө
> «ирсэн» гэдгийг илэрхийлнэ ([`business-rules.md` BR-07](business-rules.md)).
> `in_erlian` (BR-45, 2026-07-31) ба `expected` (BR-46, 2026-08-01) нь үүнийг
> зөрчихгүй — хоёулаа ачаа ирэхээс ӨМНӨх УРЬДЧИЛСАН тэмдэглэл: жин/эзлэхүүн/
> үнэ/байршил бүгд `null`/`0`, байршлын нүд эзэлдэггүй, төлбөр/хүргэлтийн
> урсгалд ороогүй. Ялгаа нь ХЭН бичсэнд: `in_erlian`-ыг ажилтан Хятадын
> жагсаалтаар, `expected`-ыг харилцагч өөрөө вэбээс
> ([`business-rules.md` BR-45, BR-46](business-rules.md)).

| Утга | Монгол |
|---|---|
| `expected` | Хүлээгдэж буй (харилцагч өөрөө мэдүүлсэн; компани хараахан хараагүй) |
| `in_erlian` | Эрээнд байгаа (зөвхөн дугаар+утас мэдэгдэж байна; сонголтоор) |
| `registered` | Бүртгэгдсэн (= Монголд ирсэн, агуулахад байна) |
| `notified` | Хэрэглэгчид мэдэгдсэн |
| `awaiting_payment` | Төлбөр хүлээгдэж буй |
| `paid` | Төлбөр төлөгдсөн |
| `out_for_delivery` | Хүргэлтэнд гарсан |
| `picked_up` | Салбараас авсан |
| `delivered` | Амжилттай хүлээлгэн өгсөн |
| `returned` | Буцаагдсан |
| `cancelled` | Хүчингүй |

### Индекс (§9.3 — 1M+ мөр, < 1 сек)

```js
// Давхардлыг хориглох — §1.3, BR-05/BR-06
schema.index(
  { activeTrackingNumber: 1 },
  { unique: true, partialFilterExpression: { activeTrackingNumber: { $type: 'string' } } }
);

schema.index({ trackingNumber: 1, createdAt: -1 });
schema.index({ customerPhone: 1, createdAt: -1 });
schema.index({ customerId: 1, createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });
schema.index({ locationCode: 1 });
schema.index({ locationId: 1, status: 1 });
schema.index({ branchId: 1, status: 1, createdAt: -1 });
schema.index({ createdAt: -1 });
schema.index({ paymentStatus: 1, status: 1 });
```

### `activeTrackingNumber` — яагаад тусдаа талбар вэ

Давхардлын дүрэм (§1.3) нь **гурван** нөхцөлийг зэрэг хангах ёстой:

| Ачаа | Дугаарыг эзэмших эсэх |
|---|---|
| Ердийн, идэвхтэй | **Эзэмшинэ** — өөр ачаа тэр дугаараар орж чадахгүй |
| Менежер зөвшөөрсөн давхардал (BR-06) | Эзэмшихгүй |
| Хүчингүй болсон (BR-05) | Эзэмшихгүй — ажилтан алдаагаа засаад дахин бүртгэнэ |

Индексийг `{ trackingNumber: 1 }` дээр `partialFilterExpression: { isDuplicateApproved: false }`-оор
тавих нь **гуравдугаар мөрийг зөрчинө**: хүчингүй болсон ачаа дугаараа үүрд хааж,
ажилтан алдаагаа засах боломжгүй болно. MongoDB-ийн `partialFilterExpression`
нь `$ne`, `$in`-ыг дэмждэггүй тул "хүчингүй биш" гэсэн нөхцөлийг индексээр
илэрхийлэх боломжгүй.

Тиймээс "эзэмшил"-ийг тодорхой талбараар илэрхийлэв: `activeTrackingNumber`
нь дугаарыг эзэмшиж байвал `trackingNumber`-тэй тэнцүү, эс бөгөөс `null`.
Хүчингүй болгох үйлдэл түүнийг `null` болгож дугаарыг чөлөөлнө.

> **`balance`-ийн бүрэн бүтэн байдал:** `paidAmount` ба `balance` нь хуулбарласан утга.
> Тэдгээрийг **зөвхөн** `payment.service.js` транзакц дотор шинэчилнэ. Өдөр бүр
> `payments.allocations`-аас дахин тооцож зөрүү шалгах cron ажиллана.

---

## 8. `invoices` — нэгтгэсэн нэхэмжлэх (§2.3)

| Талбар | Төрөл | Тайлбар |
|---|---|---|
| `invoiceNumber` | String, unique | `INV-{YYMM}-{дараалал}` (BR-16b) |
| `customerId` | ObjectId → `customers` | BR-16 — нэг нэхэмжлэхэд ЗӨВХӨН нэг харилцагч |
| `customerPhone` | String | Хайлт, баримт хэвлэхэд хуулбарласан |
| `items` | [{ packageId, trackingNumber, amount }] | Багтсан ачаанууд. `amount` = нэхэмжлэх үүсэх үеийн **үлдэгдэл** |
| `totalAmount` | Number (₮) | `Σ items.amount` — үүсэх үед хөшөөлөгдөнө |
| `paidAmount` | Number (₮) | Холбогдсон `completed` төлбөрүүдийн нийлбэр |
| `status` | Enum: `open` \| `paid` \| `cancelled` | |
| `branchId` | ObjectId → `branches` | BR-37 — Менежерийн хамрах хүрээ |
| `createdBy` | ObjectId → `users` \| null | `null` = харилцагч өөрөө |
| `cancelledAt`, `cancelReason` | Date, String | BR-18a |

**Индекс:** `invoiceNumber` (unique), `{ customerId: 1, createdAt: -1 }`,
`{ status: 1, createdAt: -1 }`, `createdAt`, `items.packageId` (BR-16a)

> **ТООЦООНЫ ЭХ СУРВАЛЖ БИШ.** `items.amount` ба `totalAmount` нь баримт
> хэвлэхэд зориулсан ХӨШӨӨЛӨГДСӨН утга. Ачааны `balance` үргэлж
> `payments.allocations`-аас гарна (BR-14). `items.amount`-ыг `finalPrice`-ээр
> биш **үлдэгдлээр** бичдэг: ачааны хэсэг өмнө төлөгдсөн байвал `finalPrice`-ээр
> нэхэмжлэх нь аль хэдийн төлсөн мөнгийг дахин нэхэмжлэнэ (BR-16).

---

## 9. `payments` — төлбөр (§1.8, §2)

Нэг төлбөрийн бичлэг = нэг удаагийн мөнгөний хөдөлгөөн. Хуваасан төлбөр = олон бичлэг.

| Талбар | Төрөл | Тайлбар |
|---|---|---|
| `amount` | Number (₮) | |
| `method` | Enum: `cash` \| `bank` \| `card` \| `qpay` | §1.8 |
| `invoiceId` | ObjectId → `invoices` \| null | |
| `customerId` | ObjectId → `customers` | |
| `allocations` | [{ packageId, amount }] | **Σ = `amount`** байх ёстой |
| `status` | Enum: `pending` \| `completed` \| `voided` | |
| `receivedBy` | ObjectId → `users` \| null | `null` = онлайн (§2.1) |
| `receivedByName` | String \| null | Кассын баримт тулгахад ажилтан устсан ч нэр үлдэнэ |
| `branchId` | ObjectId → `branches` | BR-37 |
| `note` | String \| null | Дансны гүйлгээний дугаар г.м. |
| `provider` | String \| null | `qpay` |
| `providerInvoiceId` | String \| null | QPay нэхэмжлэхийн ID |
| `providerPaymentId` | String \| null | QPay төлбөрийн ID |
| `voidedAt`, `voidedBy`, `voidReason` | Date, ObjectId, String | Устгахгүй, хүчингүй болгоно (BR-18) |

**Индекс:**
```js
schema.index({ 'allocations.packageId': 1 });
schema.index({ customerId: 1, createdAt: -1 });
schema.index({ createdAt: -1 });
schema.index({ method: 1, createdAt: -1 });
// Идемпотент вебхүүк (архитектур §4.4)
schema.index(
  { provider: 1, providerPaymentId: 1 },
  { unique: true, partialFilterExpression: { providerPaymentId: { $type: 'string' } } }
);
```

> **ЭНЭ КОЛЛЕКЦ НЬ МӨНГӨНИЙ ЭХ СУРВАЛЖ.** `packages.paidAmount` / `balance` нь
> үүнээс ГАРАЛТАЙ кэш (BR-14) — зөрвөл ЭНД байгаа нь зөв. Тиймээс бичлэгийг
> ХЭЗЭЭ Ч устгахгүй, зөвхөн `voided` болгоно (BR-18).

> **Пропорциональ хуваарилалт (§2.3):** `allocations`-ыг **үлдэгдлийн** харьцаагаар
> (`finalPrice`-ийн БИШ) бодохдоо доогуур дугуйруулж, **үлдэгдлийг сүүлийн
> ачаанд нэмнэ**. Ингэснээр `Σ allocations.amount === amount` үргэлж яг таарна
> (BR-17). Тогтмолыг model-ийн `pre('validate')` мөн ДАХИН шалгана — домэйныг
> тойрч гарах шинэ зам нэмэгдэхэд мөнгө чимээгүй «үүсэх/устах» боломжгүй байх
> ёстой.

> **`status: 'pending'` нь үлдэгдэлд ТООЦОГДОХГҮЙ** — батлагдаагүй онлайн
> төлбөрийг төлөгдсөн гэж үзвэл төлөөгүй ачаа хүргэлтэнд гарна. Зөвхөн
> `completed` тооцогдоно.

---

## 9a. `counters` — дараалсан дугаарын тоолуур

| Талбар | Төрөл | Тайлбар |
|---|---|---|
| `key` | String, unique | `invoice` г.м. |
| `seq` | Number | Атомик `$inc`-ээр өсдөг |

Нэхэмжлэхийн дугаарт хэрэглэнэ (BR-16b). `countDocuments() + 1` нь зэрэг
дуудлагад ижил тоо буцаадаг тул хэрэглэхгүй.

---

## 10. `deliveries` — хүргэлт (§5)

| Талбар | Төрөл | Тайлбар |
|---|---|---|
| `deliveryNumber` | String, unique | `DLV-YYMM-NNNNNN` (`counters`-ийн `delivery` түлхүүр) |
| `customerId` | ObjectId → `customers` | Нэг хүргэлт = НЭГ харилцагч |
| `customerPhone` | String (8 орон) | Хайлтад зориулж хуулбарласан (BR-27) |
| `packageIds` | [ObjectId → `packages`] | Хоосон биш, давхардалгүй (`pre('validate')`) |
| `address` | String, required | |
| `phone` | String (8 орон) | **Хүлээн авагчийн** утас — `customerPhone`-оос ялгаатай байж болно (гэр бүл, ажлын хаяг). Заагаагүй бол харилцагчийнхыг авна |
| `note` | String \| null | |
| `status` | Enum: `created` \| `dispatched` \| `delivered` \| `returned` \| `cancelled` | §5.1, BR-21 |
| `driverId` | ObjectId → `users` \| null | Системд бүртгэлтэй ажилтан |
| `driverName`, `driverPhone` | String \| null | Гэрээт/гадны жолооч. `driverId` өгсөн үед нэр ХУУЛБАРЛАГДАНА — ажилтан устсан ч түүхэнд үлдэнэ |
| `scheduledDate` | Date \| null | Өдрийн маршрутын бүлэглэл |
| `dispatchedAt`, `deliveredAt` | Date \| null | |
| `createdBy` | ObjectId → `users` \| null | `null` = харилцагч өөрөө |
| `statusHistory` | [{ from, to, at, by, byName, reason }] | `packages.statusHistory`-ийн ижил бүтэц |
| `cancelledAt`, `cancelReason` | Date \| String | Зөвхөн `cancelled` төлөвт |
| `fee` | Number (₮) | Хүргэлтийн төлбөр. **ЗӨВХӨН МЭДЭЭЛЭЛ** — ачааны `balance`-д нөлөөлөхгүй, §5.2-ын хаалтад орохгүй (BR-21b, нээлттэй Q3) |

**Индекс:** `deliveryNumber` (unique), `{ status: 1, scheduledDate: 1 }`,
`{ customerId: 1, createdAt: -1 }`, `packageIds`, `{ branchId: 1, createdAt: -1 }`,
`{ createdAt: -1 }`, `{ driverId: 1, scheduledDate: -1 }`

`packageIds` индекс нь хоёр зорилготой: ачааны дэлгэрэнгүйд хүргэлтийн түүх харах,
мөн BR-20a-ийн «энэ ачаа идэвхтэй хүргэлтэд байна уу» шалгалт.

> **§5.2 хаалт:** `created → dispatched` шилжихийн өмнө `packageIds`-ийн **бүх** ачааны
> `balance === 0` байх ёстой. Override байхгүй. Үлдэгдлийг транзакц дотор ачааг
> ДАХИН уншиж бодно (BR-20) — гадуур уншсан утга хуучирсан байж болно.

---

## 11. `loyalty_tiers`, `loyalty_transactions` (§4)

### `loyalty_tiers` (тохиргоо)

| Талбар | Төрөл |
|---|---|
| `code` | `bronze` \| `silver` \| `gold` |
| `name` | "Хүрэл" |
| `minSpent` | Number (₮) — түвшинд орох босго |
| `pointRate` | Number — 1₮-д ногдох оноо (жишээ 0.01) |
| `benefits` | String |

### `loyalty_transactions`

| Талбар | Төрөл | Тайлбар |
|---|---|---|
| `customerId` | ObjectId | |
| `type` | `earn` \| `redeem` \| `adjust` \| `expire` | |
| `points` | Number | `redeem` үед сөрөг |
| `sourcePaymentId` | ObjectId \| null | Аль төлбөрөөс |
| `reason` | String | `adjust` үед заавал |
| `balanceAfter` | Number | |

> **§4 дүрэм:** `earn` бичлэг зөвхөн ачааны `balance === 0` болсны дараа үүснэ.

---

## 12. `notifications` (§7, Phase 6 хэрэгжсэн — 2026-08-01)

Нэг коллекц ХОЁР төрлийг хамарна (`audience`-аар ялгана):

| Талбар | Төрөл | Тайлбар |
|---|---|---|
| `title`, `body` | String | |
| `audience` | `customer` \| `all` | `customer` = тухайн харилцагчид (BR-35), `all` = бүх харилцагчид (BR-36) |
| `customerId` | ObjectId → `customers`, null | зөвхөн `audience: customer` |
| `entity`, `entityId`, `entityLabel` | String/ObjectId/String, null | audit-log-той ижил хэв маяг — жишээ `entity:'package'` |
| `readAt` | Date, null | зөвхөн `audience: customer` (ганц хүлээн авагч тул шууд талбар) |
| `expiresAt` | Date, null | зөвхөн `audience: all`, `null` = хугацаагүй |
| `createdBy` | ObjectId → `users`, null | нийтийн зарлал илгээсэн ажилтан; хувийнд `null` (систем) |

`notification_reads`: `{ notificationId, customerId, readAt }` — `{notificationId, customerId}`
unique, ЗӨВХӨН `audience: all` бичлэгийн уншсан төлөв (олон харилцагч
хуваалцдаг тул шууд `readAt`-аар барих боломжгүй).

> **Анхны төлөвлөгөөнөөс хялбарчилсан:** `channels`/`segmentFilter`/`isPublic`/
> `publishedAt`/`deliveryStats` талбарууд ХЭРЭГЛЭГДЭХГҮЙ — SMS суваг (roadmap
> 6.5) болон нэвтрээгүй зочны хуудас (roadmap 6.3) хойшлогдсон тул одоохондоо
> зөвхөн `web` суваг, зорилтод бүлэг нь харилцагч. Хэрэгцээ гарвал нэмнэ.

---

## 13. `audit_logs` (§9.2) — **append-only**

| Талбар | Төрөл | Жишээ |
|---|---|---|
| `actorId` | ObjectId → `users` \| null | |
| `actorName` | String | "Бат" — ажилтан устсан ч түүх үлдэнэ |
| `action` | String | `package.price_override` |
| `entity` | String | `package` |
| `entityId` | ObjectId | |
| `entityLabel` | String | `TRK-88213` |
| `field` | String \| null | `finalPrice` |
| `before` | Mixed \| null | `35000` |
| `after` | Mixed \| null | `29000` |
| `reason` | String \| null | "Хэрэглэгчтэй тохиролцсон хямдрал" |
| `branchId` | ObjectId \| null | Менежерийн харах хүрээ (§9.1) |
| `ip`, `userAgent`, `requestId` | String | |
| `createdAt` | Date | |

**Индекс:** `{ entity: 1, entityId: 1, createdAt: -1 }`, `{ actorId: 1, createdAt: -1 }`,
`{ createdAt: -1 }`, `{ branchId: 1, createdAt: -1 }`, `{ action: 1, createdAt: -1 }`

**Append-only хэрэгжүүлэлт:**
```js
const block = function (next) {
  next(new Error('Audit log is immutable'));
};
schema.pre('updateOne', block);
schema.pre('updateMany', block);
schema.pre('findOneAndUpdate', block);
schema.pre('deleteOne', block);
schema.pre('deleteMany', block);
schema.pre('findOneAndDelete', block);
```
Нэмээд DB түвшинд тусдаа хэрэглэгчид зөвхөн `insert` эрх өгөх нь илүү найдвартай.

**Хадгалах хугацаа:** доод тал нь 3 жил. TTL index **тавихгүй** — архивлах ажил гараар
хийгдэнэ (санамсаргүй устгалаас сэргийлэх).

### Хянагдах үйлдлийн жагсаалт (§9.2)

| `action` | Хэзээ |
|---|---|
| `package.create` | Ачаа бүртгэгдсэн |
| `package.price_override` | Үнэ гараар өөрчлөгдсөн (§1.2) |
| `package.status_change` | Төлөв өөрчлөгдсөн (§1.5) |
| `package.location_move` | Байршил шилжсэн (§8) |
| `package.cancel` | "Хүчингүй" болсон (§1.6) |
| `package.delete` | Бүрмөсөн устгагдсан (§1.6) |
| `package.duplicate_approved` | Давхар tracking зөвшөөрөгдсөн (§1.3) |
| `package.self_register` | Харилцагч ӨӨРӨӨ вэбээс мэдүүлсэн (BR-46; `actorId: null`) |
| `package.adopted` | Ажилтан урьдчилсан бичлэг дээр бүртгэсэн — шингээлт (BR-46) |
| `payment.create` / `payment.void` | Төлбөр бүртгэгдсэн / хүчингүй болсон |
| `customer.update` | Утас/хаяг өөрчлөгдсөн |
| `customer.loyalty_adjust` | Түвшин/оноо гараар өөрчлөгдсөн |
| `user.role_change` / `user.create` / `user.disable` | Ажилтны эрх |
| `settings.tariff_change` | Тариф өөрчлөгдсөн |
| `settings.loyalty_change` | Урамшууллын босго өөрчлөгдсөн |

---

## 14. `settings` — системийн тохиргоо

Key-value бүтэц, хувилбартай.

| Талбар | Төрөл |
|---|---|
| `key` | String, unique — `pricing.override_limit_percent` |
| `value` | Mixed |
| `description` | String |
| `updatedBy` | ObjectId → `users` |

Жишээ түлхүүрүүд:

| Түлхүүр | Утга | Тайлбар |
|---|---|---|
| `pricing.override_limit_percent` | `20` | Ажилтны override хязгаар (§1.2) |
| `package.delete_window_hours` | `24` | Устгах цонх (§1.6) |
| `warehouse.suggest_enabled` | `true` | Автомат байршил санал болгох (§8) |
| `content.erenhot_address` | `{ receiverName, phone, addressCn, addressMn, note }` | Эрээний хаяг (§3) |
| `content.contact` | `{ phone, email, address, workingHours, facebook }` | Холбоо барих |
| `content.faq` | `[{ question, answer }]` | Түгээмэл асуулт |
| `content.home_notice` | `String \| null` | Нүүрийн зарлал. `null` = зарлалгүй |

> **`content.*` нь НЭЭЛТТЭЙ** — `GET /v1/public/content` нь нэвтрээгүй зочинд
> уншуулна. Энд дотоод/нууц утга ХЭЗЭЭ Ч хадгалахгүй. Нийтлэгдэх түлхүүрийг
> угтвараар БИШ, `PUBLIC_CONTENT_KEYS` жагсаалтаар зөвшөөрнө: угтварын шүүлт нь
> хожим нэмэгдэх `content.internal_*` төрлийн түлхүүрийг чимээгүй нийтэлнэ.
>
> `value` нь `Mixed` тул схемийн хамгаалалт байхгүй — түлхүүр тус бүрийн
> хэлбэрийг `validations/setting.validation.js`-ийн `VALUE_SCHEMAS` шалгана.
> Үүнгүй бол буруу хэлбэртэй утга бичих ҮЕДЭЭ БИШ, хэрэглэгчийн вэб рендерлэх
> үед унана.

---

## 15. Тайлангийн нэгтгэсэн коллекцууд (§6, §9.3)

Cron-оор өдөр бүр (мөн урсгал өдөрт нэмэгдүүлж) бөглөгдөнө.

### `report_daily_packages`
`{ date, branchId, registeredCount, arrivedCount, deliveredCount, cancelledCount, totalWeightKg, totalVolumeM3 }`

### `report_daily_revenue`
`{ date, branchId, totalRevenue, byMethod: { cash, bank, card, qpay }, paymentCount, invoiceCount }`

**Индекс:** `{ date: -1, branchId: 1 }` (unique)

> Тайлангийн API эдгээр коллекцыг л уншина. `packages`/`payments` дээр live aggregation
> хийхийг хориглоно — §6-ийн "үндсэн ажиллагаанд нөлөөлөхгүй" шаардлагыг зөрчинө.

---

## 16. Migration тэмдэглэл

| # | Migration | Phase |
|---|---|---|
| M1 | `users.role`: `senior_manager → manager`, `manager → staff` | 0 |
| M2 | `users.role === 'user'` бичлэгийг шалгаж `customers` руу шилжүүлэх эсвэл идэвхгүй болгох | 0 |
| M3 | `users`-д `branchId` нэмэх, одоо байгаа ажилтныг үндсэн салбарт холбох | 1 |
| M4 | Бүх индексийг үүсгэх (`ensureIndexes`) | 1–2 |
| M5 | Одоо байгаа ачааны өгөгдөл импортлох (CSV) | 9 |

Migration скрипт `amarhan-api/scripts/migrations/<NNN>-<name>.js` дотор, дугаарласан,
**идемпотент** (дахин ажиллуулахад аюулгүй) байна.
