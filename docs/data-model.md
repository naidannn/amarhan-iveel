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

---

## 4. `branches` — салбар

> **Одоогийн байдал:** ганц салбар (`ER` — Эрээн агуулах). Коллекцыг устгаагүй —
> байршлын код салбарын кодоос эхэлдэг (§8) ба ирээдүйд салбар нэмэгдэх ёстой.
> Нэг салбарын горимын дүрэм: [`business-rules.md` BR-22a](business-rules.md).

| Талбар | Төрөл | Тайлбар |
|---|---|---|
| `code` | String(2), unique | `ER`, `UB` (§8) |
| `name` | String | "Эрээн салбар" |
| `country` | String | |
| `address`, `phone` | String | Хэрэглэгчийн вэбэд харагдана (§3) |
| `isActive` | Boolean | |

---

## 5. `warehouse_locations` — агуулахын байршил (§8)

Салбар → Өрөө → Тавиур → Мөр → Нүд бүтцийн **навч (нүд) бүрт нэг бичлэг**.

| Талбар | Төрөл | Тайлбар |
|---|---|---|
| `code` | String, **unique** | `ER-02-B-15` — бүрэн код |
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
| `cargoTypeId` | ObjectId → `cargo_types` | |
| `quantity` | Number | §1.1 |
| `weightKg` | Number \| null | 2 орны нарийвчлал |
| `volumeM3` | Number \| null | 4 орны нарийвчлал |
| `dimensions` | { lengthCm, widthCm, heightCm } \| null | Оруулбал `volumeM3` автоматаар бодогдоно |
| **Үнэ** | | |
| `pricingSnapshot` | { weightBrackets[], pricePerKgAbove, pricePerM3, minimumCharge, tariffVersionId } | Бүртгэх үеийн тариф (BR-02). Ачааг **засахад ч** энэ тарифаар дахин бодогдоно |
| `computedPrice` | Number (₮) | Автоматаар бодогдсон дүн |
| `priceSource` | Enum: `weight` \| `volume` \| `minimum` | Аль нь давамгайлсан |
| `finalPrice` | Number (₮) | Бодит төлөх дүн (override-ийн дараа) |
| `priceOverridden` | Boolean | |
| `priceOverrideReason` | String \| null | Override үед **заавал** |
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
| `arrivedAt` | Date | Ирсэн огноо (§1.1) |
| `note` | String | |
| `registeredBy` | ObjectId → `users` | |
| `isDuplicateApproved` | Boolean | §1.3 — Менежер зөвшөөрсөн давхардал |
| `cancelledAt`, `cancelReason` | Date, String | §1.6 |

### Төлөвийн enum (§1.5)

| Утга | Монгол |
|---|---|
| `registered` | Эрээнд бүртгэгдсэн |
| `in_transit` | Монгол руу илгээгдсэн |
| `arrived` | Монголд ирсэн |
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
| `invoiceNumber` | String, unique | Дараалсан дугаар |
| `customerId` | ObjectId → `customers` | |
| `items` | [{ packageId, trackingNumber, amount }] | Багтсан ачаанууд |
| `totalAmount` | Number (₮) | `Σ items.amount` |
| `paidAmount` | Number (₮) | |
| `status` | Enum: `open` \| `paid` \| `cancelled` | |
| `createdBy` | ObjectId → `users` \| null | `null` = харилцагч өөрөө |

**Индекс:** `invoiceNumber` (unique), `{ customerId: 1, createdAt: -1 }`, `status`

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
| `receivedBy` | ObjectId → `users` \| null | `null` = онлайн |
| `provider` | String \| null | `qpay` |
| `providerInvoiceId` | String \| null | QPay нэхэмжлэхийн ID |
| `providerPaymentId` | String \| null | QPay төлбөрийн ID |
| `voidedAt`, `voidReason` | Date, String | Устгахгүй, хүчингүй болгоно |

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

> **Пропорциональ хуваарилалт (§2.3):** `allocations`-ыг үнийн харьцаагаар бодохдоо
> `Math.floor` ашиглаж, **дугуйруулалтын үлдэгдлийг сүүлийн ачаанд нэмнэ**. Ингэснээр
> `Σ allocations.amount === amount` үргэлж яг таарна.

---

## 10. `deliveries` — хүргэлт (§5)

| Талбар | Төрөл | Тайлбар |
|---|---|---|
| `deliveryNumber` | String, unique | |
| `customerId` | ObjectId → `customers` | |
| `packageIds` | [ObjectId → `packages`] | |
| `address`, `phone`, `note` | String | |
| `status` | Enum: `created` \| `dispatched` \| `delivered` \| `returned` | §5.1 |
| `driverId` | ObjectId → `users` \| null | |
| `scheduledDate` | Date | |
| `dispatchedAt`, `deliveredAt` | Date | |
| `createdBy` | ObjectId → `users` \| null | `null` = харилцагч өөрөө |
| `fee` | Number (₮) | Хүргэлтийн төлбөр (хэрэв авбал) |

**Индекс:** `deliveryNumber` (unique), `{ status: 1, scheduledDate: 1 }`,
`{ customerId: 1, createdAt: -1 }`, `packageIds`

> **§5.2 хаалт:** `created → dispatched` шилжихийн өмнө `packageIds`-ийн **бүх** ачааны
> `balance === 0` байх ёстой. Override байхгүй.

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

## 12. `notifications` (§7)

| Талбар | Төрөл | Тайлбар |
|---|---|---|
| `title`, `body` | String | |
| `channels` | [`web` \| `sms` \| `push`] | |
| `audience` | `all` \| `customers` \| `segment` | |
| `segmentFilter` | Object \| null | Жишээ: `{ loyaltyTier: 'gold' }` |
| `isPublic` | Boolean | Нэвтрээгүй ч харагдах эсэх (§7) |
| `publishedAt`, `expiresAt` | Date | |
| `createdBy` | ObjectId → `users` | |
| `deliveryStats` | { sent, failed } | |

`notification_reads`: `{ notificationId, customerId, readAt }` — `{notificationId, customerId}` unique.

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
| `content.erenhot_address` | `{...}` | Эрээний хаяг (§3) |

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
