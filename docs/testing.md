# Тестийн стратеги

> Одоогийн бүтэц: Mocha + Chai + chai-http (`amarhan-api/test/`), `NODE_ENV=test`.

---

## 1. Юуг заавал тестлэх вэ

Тестгүйгээр merge хийхийг хориглосон код:

| Хэсэг | Шалтгаан | Заавал төрөл |
|---|---|---|
| **Үнэ тооцоолол** (BR-01…04) | Мөнгө. Алдаа шууд алдагдал | Unit — 100% branch |
| **Төлбөрийн хуваарилалт** (BR-16…18) | Мөнгө. Дугуйруулалтын алдаа хуримтлагдана | Unit + Integration |
| **Балансын тооцоолол** (BR-14) | Мөнгө | Integration + concurrency |
| **Төлөвийн машин** (BR-07…09) | Буруу шилжилт бизнесийн будлиан үүсгэнэ | Unit |
| **§5.2 төлбөрийн хаалт** (BR-19, 20) | "Override байхгүй" шаардлага | Integration |
| **Эрхийн матриц** (BR-36, 37) | Аюулгүй байдал | Integration — мөр бүрт |
| **Давхар tracking** (BR-05, 06) | Өгөгдлийн бүрэн бүтэн байдал | Integration |
| **Устгал/Хүчингүй** (BR-10…12) | Санхүүгийн бүрэн бүтэн байдал | Integration |
| **Audit бичигдсэн эсэх** (BR-38, 41) | Хууль/маргааны нотолгоо | Integration |
| **Утас нормчлол** (BR-27) | Харилцагч холбогдох гол түлхүүр | Unit |
| **Байршлын код** (BR-22) | Формат зөрчил | Unit |

---

## 2. Тестийн пирамид

```
        ╱╲       E2E (цөөн)
       ╱  ╲      бүртгэх→төлөх→хүргэх бүрэн урсгал
      ╱────╲
     ╱      ╲    Integration (дунд)
    ╱        ╲   API endpoint + DB + эрх
   ╱──────────╲
  ╱            ╲ Unit (олон)
 ╱______________╲ цэвэр функц: үнэ, төлөв, нормчлол
```

| Түвшин | Хамрах хүрээ | Хурд |
|---|---|---|
| Unit | Домэйн функц (`src/domain/`), utils | < 1 сек |
| Integration | Route → Controller → Service → Repository → DB | < 30 сек |
| E2E | Бүрэн бизнес урсгал | < 2 мин |

---

## 3. Бүтэц

```
amarhan-api/test/
├── setup.js                 # mongodb-memory-server, глобал hook
├── factories/               # тестийн өгөгдөл үүсгэгч
│   ├── package.factory.js
│   ├── customer.factory.js
│   └── user.factory.js
├── unit/
│   ├── pricing.test.js      # BR-01…04
│   ├── package-state.test.js# BR-07…09
│   └── phone.test.js        # BR-27
├── integration/
│   ├── packages.test.js
│   ├── payments.test.js
│   ├── deliveries.test.js
│   ├── permissions.test.js  # BR-36 матрицын мөр бүр
│   └── audit.test.js
└── e2e/
    └── package-lifecycle.test.js
```

---

## 4. Тестийн өгөгдөл

**`mongodb-memory-server`** (**standalone** горимд — систем replica set/транзакц
ашигладаггүй, `docs/architecture.md` §9 шийдвэр #2). Бодит MongoDB руу тест холбохгүй.

Factory ашиглана, шууд `Model.create` биш:

```js
// test/factories/package.factory.js
const makePackage = (overrides = {}) => ({
  trackingNumber: `TRK-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  customerPhone: '99112233',
  quantity: 1,
  weightKg: 5,
  finalPrice: 25000,
  paidAmount: 0,
  balance: 25000,
  status: 'registered',
  ...overrides,
});
```

Тест бүрийн дараа DB цэвэрлэгдэнэ (`afterEach`).

---

## 5. Бичих хэв маяг

Тестийн нэр **монгол хэлээр, бизнес дүрмийг илэрхийлнэ**, BR дугаар заана.

```js
'use strict';

const { expect } = require('chai');
const { calculatePrice } = require('../../src/domain/pricing');

describe('BR-01 — Ачааны үнэ тооцоолол (§1.2)', () => {
  const tariff = { pricePerKg: 5000, pricePerM3: 40000, minimumCharge: 5000 };

  it('жингээр бодсон дүн их бол түүнийг сонгоно', () => {
    const r = calculatePrice({ weightKg: 10, volumeM3: 0.1, tariff });
    expect(r.final).to.equal(50000);
    expect(r.source).to.equal('weight');
  });

  it('эзлэхүүнээр бодсон дүн их бол түүнийг сонгоно', () => {
    const r = calculatePrice({ weightKg: 2, volumeM3: 0.5, tariff });
    expect(r.final).to.equal(20000);
    expect(r.source).to.equal('volume');
  });

  it('хоёулаа доод хэмжээнээс бага бол доод хэмжээг ашиглана', () => {
    const r = calculatePrice({ weightKg: 0.2, volumeM3: 0.01, tariff });
    expect(r.final).to.equal(5000);
    expect(r.source).to.equal('minimum');
  });
});
```

### AAA бүтэц

```js
it('BR-19 — төлбөр дутуу ачааг хүргэлтэнд гаргахгүй', async () => {
  // Arrange
  const pkg = await createPackage({ finalPrice: 30000, paidAmount: 18000, balance: 12000 });

  // Act
  const res = await request(app)
    .post(`/api/v1/packages/${pkg.id}/status`)
    .set('Authorization', `Bearer ${adminToken}`)      // Админ ч гэсэн
    .send({ status: 'out_for_delivery' });

  // Assert
  expect(res.status).to.equal(422);
  expect(res.body.message).to.include('12,000₮');
});
```

---

## 6. Заавал байх тестүүд

### 6.1 Эрхийн матриц (BR-36)

Матрицын **мөр бүрт** гурван ролийн тест:

```js
const CASES = [
  { action: 'DELETE /packages/:id',  admin: 200, manager: 403, staff: 403 },
  { action: 'POST /settings/tariff', admin: 200, manager: 403, staff: 403 },
  { action: 'POST /packages/:id/cancel', admin: 200, manager: 200, staff: 403 },
  // ... матрицын бүх мөр
];
```

### 6.2 Audit бичигдсэн эсэх (BR-38, 41)

Мөнгө/төлөв өөрчлөх тест бүрд:

```js
const logs = await AuditLog.find({ entityId: pkg.id, action: 'package.price_override' });
expect(logs).to.have.lengthOf(1);
expect(logs[0].before).to.equal(35000);
expect(logs[0].after).to.equal(29000);
expect(logs[0].reason).to.not.be.empty;
```

### 6.3 Дараалсан бичилтийн алдаа (rollback БАЙХГҮЙ)

> **2026-07-31 шинэчлэл:** систем standalone MongoDB дээр ажилладаг тул
> `withTransaction()` rollback хийхгүй (§4, `docs/architecture.md` §4.3, §9
> шийдвэр #2). Доорх тест ЗӨВ хуучин зан төлөл БИШ — харин одоогийн жинхэнэ
> зан төлөлийг баримтжуулж байгаа: audit бичих алдаатай ч өмнөх өөрчлөлт үлдэнэ.

```js
it('audit бичихэд алдаа гарвал ч ӨМНӨХ өөрчлөлт үлдэнэ (rollback байхгүй)', async () => {
  stub(auditService, 'record').rejects(new Error('DB алдаа'));
  await expect(packageService.overridePrice(...)).to.be.rejected;
  const pkg = await Package.findById(id);
  expect(pkg.finalPrice).to.equal(29000);   // өөрчлөгдсөн ХЭВЭЭР — trade-off
});
```

### 6.4 Concurrency (BR-14)

```js
it('зэрэг орсон хоёр төлбөр балансыг буруу болгохгүй', async () => {
  await Promise.all([
    payService(pkg.id, 15000),
    payService(pkg.id, 15000),
  ]);
  const p = await Package.findById(pkg.id);
  expect(p.paidAmount).to.equal(30000);
  expect(p.balance).to.equal(0);
});
```

### 6.5 Пропорциональ хуваарилалтын нийлбэр (BR-17)

Санамсаргүй тоогоор олон удаа шалгах (property-based):

```js
it('хуваарилалтын нийлбэр төлсөн дүнтэй үргэлж яг тэнцэнэ', () => {
  for (let i = 0; i < 1000; i++) {
    const prices = randomPrices();
    const amount = randomAmount();
    const allocs = allocateProportionally(amount, prices);
    expect(allocs.reduce((s, a) => s + a.amount, 0)).to.equal(amount);
  }
});
```

---

## 7. Frontend тест

Одоогоор frontend тест байхгүй. Phase 2-оос нэмнэ (Vitest + Vue Test Utils):

| Юуг | Хэрхэн |
|---|---|
| `utils/currency.ts`, огнооны форматлагч | Unit |
| Composable (`usePackages`) | Unit, `useApi` mock хийж |
| Ачаа бүртгэх форм (§1.4 хурдны шаардлага) | Компонентын тест — reload байхгүй, талбар цэвэрлэгдэнэ, фокус эргэнэ |
| Бүрэн урсгал | Playwright (сонголтоор, Phase 9) |

---

## 8. Ачааллын тест (§9.3, Phase 9)

| Хэмжигдэхүүн | Зорилт |
|---|---|
| Ачааны хайлт (индекслэгдсэн талбараар) | p95 < 300ms, 1M+ мөрөнд |
| Жагсаалтын нийт хариу | < 1 сек |
| Ачаа бүртгэх | < 500ms |
| Тайлангийн dashboard | < 2 сек |

Скрипт: `scripts/load-test/` — 1M ачаа үүсгэх seed + k6/autocannon.

---

## 9. CI

```yaml
# .github/workflows/ci.yml
- npm ci
- npm run lint
- npm test          # NODE_ENV=test
- npm audit --audit-level=high
- (front) yarn install && yarn build
```

**Merge хийх нөхцөл:** CI ногоон + шинэ бизнес логикт тест бий.

---

## 10. Хамрах хүрээний зорилт

| Хэсэг | Зорилт |
|---|---|
| `src/domain/` (үнэ, төлөв) | **100%** branch |
| `src/services/` | ≥ 80% |
| `src/repositories/` | ≥ 60% |
| `src/controllers/` | Integration-аар л |
| Нийт | ≥ 70% |

> Хувь бол хэрэгсэл, зорилго биш. **Мөнгө, эрх, audit-тай холбоотой мөр бүр тестлэгдсэн
> байх** нь жинхэнэ шалгуур.
