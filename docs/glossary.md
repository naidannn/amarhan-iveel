# Нэр томьёоны толь (Glossary)

> UI текст монгол, код англи хэлээр байдаг тул энэ харгалзуулалт **заавал** мөрдөгдөнө.
> Нэг ойлголтод хоёр өөр англи нэр өгөхийг хориглоно.

---

## 1. Үндсэн нэгжүүд

| Монгол | Код (англи) | Коллекц | Тэмдэглэл |
|---|---|---|---|
| Ачаа | `package` | `packages` | `cargo`, `shipment`, `parcel` хэрэглэхгүй |
| Ачааны дугаар | `trackingNumber` | | `trackingNo`, `code` биш |
| Харилцагч / Хэрэглэгч (вэбийн) | `customer` | `customers` | `client`, `user` биш |
| Ажилтан (дотоод) | `user` / `staff` | `users` | `employee` биш |
| Салбар | `branch` | `branches` | |
| Агуулахын байршил | `warehouseLocation` | `warehouse_locations` | |
| Байршлын код | `locationCode` | | `UB-02-B-15` |
| Ачааны төрөл | `cargoType` | `cargo_types` | |
| Тариф | `tariff` | `tariff_versions` | |
| Төлбөр | `payment` | `payments` | |
| Нэхэмжлэх | `invoice` | `invoices` | Нэгтгэсэн нэхэмжлэх |
| Хүргэлт | `delivery` | `deliveries` | `shipping` биш |
| Урамшуулал | `loyalty` | `loyalty_*` | `bonus`, `reward` биш |
| Мэдэгдэл | `notification` | `notifications` | |
| Хяналтын бүртгэл | `auditLog` | `audit_logs` | |
| Тохиргоо | `settings` | `settings` | `config` нь кодын тохиргоо |

---

## 2. Ачааны төлөв (§1.5)

> Замын төлөв (`in_transit`, `arrived`) байхгүй — бүртгэл нь ачаа Монголд ирсний
> дараа хийгддэг ([`business-rules.md` BR-07](business-rules.md)).

| Монгол (UI) | Код |
|---|---|
| Бүртгэгдсэн *(= Монголд ирсэн)* | `registered` |
| Хэрэглэгчид мэдэгдсэн | `notified` |
| Төлбөр хүлээгдэж буй | `awaiting_payment` |
| Төлбөр төлөгдсөн | `paid` |
| Хүргэлтэнд гарсан | `out_for_delivery` |
| Салбараас авсан | `picked_up` |
| Амжилттай хүлээлгэн өгсөн | `delivered` |
| Буцаагдсан | `returned` |
| Хүчингүй | `cancelled` |

---

## 3. Хүргэлтийн төлөв (§5.1)

| Монгол | Код |
|---|---|
| Хүргэлт үүссэн | `created` |
| Хүргэлтэнд гарсан | `dispatched` |
| Амжилттай хүргэгдсэн | `delivered` |
| Буцаагдсан | `returned` |

---

## 4. Төлбөрийн ойлголтууд

| Монгол | Код | Тэмдэглэл |
|---|---|---|
| Бэлэн мөнгө | `cash` | |
| Данс (шилжүүлэг) | `bank` | |
| Карт | `card` | |
| QPay | `qpay` | |
| Хуваасан төлбөр | (олон `payment` бичлэг) | Тусдаа талбар биш |
| Автомат тооцсон үнэ | `computedPrice` | |
| Эцсийн үнэ | `finalPrice` | Override-ийн дараах |
| Төлөгдсөн дүн | `paidAmount` | |
| Үлдэгдэл | `balance` | `finalPrice − paidAmount` |
| Доод хэмжээний төлбөр | `minimumCharge` | |
| Хуваарилалт | `allocation` | Төлбөр → ачаанд ногдох дүн |
| Хүчингүй болгосон төлбөр | `voided` | Устгаагүй |
| Төлбөрийн төлөв | `paymentStatus`: `unpaid`/`partial`/`paid` | |

---

## 5. Эрх (§9.1)

| Монгол | Код |
|---|---|
| Админ | `admin` |
| Менежер | `manager` |
| Ажилтан | `staff` |
| Харилцагч | (`customers` коллекц, роль байхгүй) |

> ⚠️ Одоогийн кодод `senior_manager` байгаа — Phase 0.6-д `manager` болж, одоогийн
> `manager` нь `staff` болно.

---

## 6. Агуулахын шатлал (§8)

| Монгол | Код | Жишээ |
|---|---|---|
| Салбар | `branch` | `ER` |
| Өрөө | `room` | `02` |
| Тавиур | `shelf` | `B` |
| Мөр | `row` | `1` |
| Нүд | `cell` | `5` |
| Бүрэн код | `code` | `UB-02-B-15` |
| Багтаамж | `capacityCount` / `capacityM3` | |

---

## 7. Урамшуулал (§4)

| Монгол | Код |
|---|---|
| Түвшин | `tier` |
| Хүрэл | `bronze` |
| Мөнгө | `silver` |
| Алт | `gold` |
| Оноо | `points` |
| Оноо олгох | `earn` |
| Оноо зарцуулах | `redeem` |
| Гараар тохируулах | `adjust` |
| Нийт зарцуулсан дүн | `lifetimeSpent` |

---

## 8. Хэмжих нэгж

| Ойлголт | Код | Нэгж | Нарийвчлал |
|---|---|---|---|
| Жин | `weightKg` | кг | 2 орон |
| Эзлэхүүн | `volumeM3` | м³ | 4 орон |
| Хэмжээ | `dimensions.{lengthCm,widthCm,heightCm}` | см | бүхэл |
| Мөнгө | `finalPrice`, `amount` г.м. | ₮ | **бүхэл тоо** |
| Нэгж үнэ | `pricePerKg`, `pricePerM3` | ₮/кг, ₮/м³ | бүхэл |

---

## 9. Түгээмэл алдаатай орчуулга

| ❌ Буруу | ✅ Зөв | Шалтгаан |
|---|---|---|
| `cargo` / `shipment` | `package` | Нэг ойлголтод нэг нэр |
| `client` | `customer` | |
| `user` (харилцагчийн утгаар) | `customer` | `user` = дотоод ажилтан |
| `price` (бүрхэг) | `computedPrice` / `finalPrice` | Аль нь болох нь тодорхойгүй |
| `amount` (ачаан дээр) | `finalPrice` | `amount` зөвхөн төлбөр дээр |
| `deleted` | `cancelled` / `voided` | Устгал бараг байхгүй (BR-11, BR-18) |
| `bonus` | `loyaltyPoints` | |
| `warehouse` (нүдний утгаар) | `warehouseLocation` | |
| `status` (төлбөрийн) | `paymentStatus` | `status` = ачааны төлөв |

---

## 10. Товчлол

| Товчлол | Тайлбар |
|---|---|
| BR-XX | Business Rule — [`business-rules.md`](business-rules.md) |
| §X.X | `introduction.md`-ийн хэсгийн дугаар |
| OTP | Нэг удаагийн код (утас баталгаажуулах) |
| SSR | Server-Side Rendering (Nuxt) |
| p95 | 95 хувийн хугацааны хэмжүүр |
