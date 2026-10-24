# Урамшууллын модуль (Phase 7) — одоогийн кодын бэлэн байдал

> **2026-10-24: ХЭРЭГЖСЭН.** Доорх §3-ын загвараар хийгдсэн, §5-ын асуултад
> эзэмшигч хариулсан — одоогийн дүрэм `docs/business-rules.md` BR-30…BR-33, BR-48,
> `roadmap.md` §7.7. Энэ файл түүхэн үнэлгээ болон үлдсэн.

> 2026-10-18-ны үнэлгээ. Шаардлага: `introduction.md` §4, `roadmap.md` Phase 7,
> `docs/business-rules.md` BR-30…BR-33, `docs/data-model.md` §11.
> Phase 7-г эхлэхээс ӨМНӨ энэ файлыг унш.

## 1. Аль хэдийн бэлэн

| Юу | Хаана |
|---|---|
| `loyaltyTier`, `loyaltyPoints`, `lifetimeSpent` талбар | `models/customer.model.js` |
| `LOYALTY_TIER` enum, `AUDIT_ACTION.CUSTOMER_LOYALTY_ADJUST` | `config/constants.js` |
| BR-33 гараар өөрчлөх endpoint (зөвхөн Админ, шалтгаан заавал, audit) | `customer.service.js#adjustLoyalty`, `PUT /customers/:id/loyalty` |
| Энгийн засварын замаар урамшууллын талбар өөрчлөгдөхгүй | `customer.service.js#update` |
| Харилцагчийн профайлд түвшин/оноо гардаг | `customer-auth.service.js` |
| Нэг харилцагчийн төлбөр/ачааг индексээр тоолох | `payments {customerId, createdAt}`, `packages {customerId, createdAt}` |

## 2. Оноо олгох ЦОРЫН ГАНЦ найдвартай цэг

`payment.service.js#recalculatePackage` — мөнгө үүсэх/хүчингүй болох/
баталгаажих БҮХ зам (`create`, `void`, `confirmPending`, `confirmByProvider`)
эндээс дамждаг, `paymentStatus`-ыг эх сурвалжаас дахин боддог.

- **`paid` ТӨЛӨВ дээр бүү тулгуурла.** `syncPaidStatus` шилжилт зөвшөөрөгдөөгүй
  үед (жишээ: `delivered`) төлөвийг өөрчлөхгүй. **`paymentStatus === 'paid'`**
  дээр тулгуурла.
- 2026-10-18-нд засагдсан: `package.service.js#overridePrice` өмнө нь
  `balance`/`paymentStatus`-ыг өөрөө бичдэг байсан (дүрэм #10 зөрчил) — одоо
  `recalculatePackage`-ээр дамждаг тул үнэ өөрчлөгдөхөд ч энэ цэг ажиллана.

## 3. Санал болгож буй загвар (тоон утгагүй — тоо бол бизнесийн шийдвэр)

1. **`loyalty_transactions` = эх сурвалж (ledger), append-only.**
   `customer.loyaltyPoints` нь ledger-ийн нийлбэрийн КЭШ — `+=`-ээр биш дахин
   бодож бичнэ (BR-14-ийн ижил зарчим). `adjustLoyalty` нь шууд дарж бичихийн
   оронд `adjust` бичлэг үүсгэх болно.
2. **Идемпотент "reconcile", нэг удаагийн "earn" эвент БИШ.**
   `loyaltyService.reconcilePackage(packageId)`: ачаанд ногдох ёстой оноог
   (`paymentStatus === 'paid'` ба хүчингүй биш бол `earn`, үгүй бол 0) бодож,
   тухайн ачааны ledger нийлбэртэй харьцуулж, ЗӨРҮҮГ л бичнэ. Ингэснээр:
   - давхардсан webhook / зэрэг баталгаажуулалт давхар оноо олгохгүй;
   - төлбөр хүчингүй болох, үнэ буурах/өсөх, ачаа хүчингүй болоход оноо
     автоматаар буцаагдана;
   - транзакц/rollback байхгүй (standalone MongoDB) тул дунд замдаа тасарсан
     бичилтийг шөнийн cron дахин ажиллуулж засна.
   Зэрэгцээ бичилтээс `{ packageId, seq }` unique индекс хамгаална.
3. **Оноо бодох хувийг бүхэл тоогоор хадгал** (жишээ `pointRateBps`, 1/10000).
   `docs/data-model.md`-ийн `pointRate: 0.01` float нь `floor()`-д алдаа өгнө
   (`0.29 * 100 = 28.999…`). Дүрэм #2 (мөнгө = бүхэл тоо)-той нийцнэ.
4. **Ledger бичлэг бүрд түвшин/хувийн snapshot** (`tariff-version`-ий ижил
   санаа) — босго өөрчлөхөд өмнөх оноо өөрчлөгдөхгүй (Phase 7 шалгуур).
5. **Цэвэр домэйн функц** `domain/loyalty.js` — `computeEarn`, `resolveTier`
   (хэзээ ч доошлохгүй, BR-32), `nextTierGap`; 100% тестээр хучина.
6. **`config.loyalty.enabled`** туг (`config.qpay.enabled`-ийн ижил) — reconcile
   идэвхгүй үед no-op.

## 4. Эрсдэл / анхаарах зүйл

- **Ачааг өөр харилцагч руу шилжүүлэх** (`package.service.js#update` →
  `resolveCustomerLink`, төлөгдсөн ачаанд ч зөвшөөрөгддөг): A-гийн оноог
  буцааж B-д олгох ёстой — reconcile ачааны ОДООГИЙН `customerId`-аар ажиллана.
- **Утасгүй ачаа** (BR-45, `customerId: null`) оноо авахгүй; хожим харилцагч
  холбогдоход reconcile нөхөж олгоно.
- **Notification-ийн "never throw, fire-and-forget" хэв маягийг оноонд бүү
  хуулбарла** — оноо бол үнэ цэнэ, чимээгүй алдагдах ёсгүй (reconcile + cron).
- **Оноогоор төлөх (redeem) хэрэгжүүлбэл:** `points` төлбөрийн хэлбэрийг
  `PAYMENT_METHOD_LIST`-д (ажилтны `payment.validation.js`) БҮҮ нэм — ажилтан
  гараар "оноон төлбөр" бүртгэх нүх болно; мөн бүх орлогын тайлан
  (`report.repository.js`, `dashboard.repository.js`) үүнийг хасах ёстой.
  `finalPrice`-ийг бууруулах замаар хөнгөлөх нь ±20% override хязгаар болон
  "хөнгөлөлт" KPI-тай холилдоно.

## 5. Эзэмшигчээс асуух (CLAUDE.md §6)

1. `lifetimeSpent`-ийн тодорхойлолт: төлөгдсөн ачааны Σ `finalPrice` уу, эсвэл
   Σ гүйцэтгэсэн төлбөр үү? Хүргэлтийн 7000₮ хураамж орох уу?
2. Түвшний босго, оноо бодох хувь (тоон утга).
3. "Бонусын нөхцөл" гэж юу вэ (`introduction.md` §4-т тодорхойгүй).
4. Оноог төлбөрт ашиглах уу (Q5 — одоогоор "зөвхөн харуулах"), хугацаа дуусах
   уу (Q4 — одоогоор "үгүй")?
5. Ачаа хүчингүй болох / төлбөр буцаагдахад олгосон оноог буцаах уу (санал:
   тийм, reconcile автоматаар).
