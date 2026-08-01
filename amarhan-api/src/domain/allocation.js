'use strict';

/**
 * Төлбөрийг ачаанууд дунд хуваарилах — introduction.md §2.3, BR-16/BR-17
 *
 * ЯАГААД ТУСДАА ДОМЭЙН ФАЙЛ: энэ бол системийн санхүүгийн ГОЛ тэнцвэр.
 * Хуваарилалтын нийлбэр төлсөн дүнтэй ₮1 зөрвөл ачааны `balance` буруу болж,
 * ажилтан төлбөр авсан ачааг "төлөгдөөгүй" гэж харах, эсвэл төлөгдөөгүй ачааг
 * хүргэлтэнд гаргах болно. DB-ээс, HTTP-ээс ЦЭВЭР салгаж, 100% тестээр хучна.
 *
 * ХАМГИЙН ЧУХАЛ ТОГТМОЛ (BR-17):
 *
 *     Σ allocations.amount === payment.amount   — ҮРГЭЛЖ, ЯГ таарна
 *
 * Мөнгө = бүхэл тоо ₮ (CLAUDE.md §5 дүрэм 2). Хуваалт бутархай гаргадаг тул
 * `Math.floor`-оор доогуур дугуйруулж, гарсан үлдэгдлийг СҮҮЛИЙН ачаанд нэмнэ.
 */

class AllocationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AllocationError';
  }
}

/**
 * Дүнг ачаануудын ҮЛДЭГДЛИЙН харьцаагаар хуваарилна (BR-17).
 *
 * ЯАГААД `finalPrice` БИШ `balance`-аар хуваарилдаг: хэрэглэгч ачааныхаа
 * хэсгийг өмнө нь төлсөн байж болно. Тэр үед `finalPrice`-аар хуваарилбал аль
 * хэдийн төлөгдсөн ачаанд дахин мөнгө ногдож, ХЭТ ТӨЛӨЛТ үүсэх ба нөгөө ачаа
 * дутуу төлөгдсөн хэвээр үлдэнэ.
 *
 * ДУГУЙРУУЛАЛТЫН ҮЛДЭГДЭЛ: `floor`-ийн улмаас нийлбэр нь дүнгээс бага гарна
 * (хамгийн их `n−1`₮ зөрөх боломжтой). Үлдэгдлийг тарааж бутаргахгүй, СҮҮЛИЙН
 * ачаанд бүтнээр нэмнэ — дүрэм тодорхой, тестлэхэд хялбар, нийлбэр яг таарна.
 *
 * @param {number} amount — хуваарилах дүн (₮, сөрөг бус бүхэл тоо)
 * @param {Array<{ packageId: any, balance: number }>} targets — дараалал ЧУХАЛ:
 *        үлдэгдэл сүүлийн элементэд нэмэгдэнэ
 * @returns {Array<{ packageId: any, amount: number }>} `amount === 0` бүхий
 *        элемент ОРОХГҮЙ — хоосон хуваарилалт хадгалах нь тайланг бохирдуулна
 * @throws {AllocationError}
 */
function allocateProportionally(amount, targets) {
  assertMoney(amount, 'Хуваарилах дүн');

  if (!Array.isArray(targets) || targets.length === 0) {
    throw new AllocationError('Хуваарилах ачаа заагаагүй байна');
  }

  for (const target of targets) {
    if (!Number.isInteger(target?.balance)) {
      throw new AllocationError(`Ачааны үлдэгдэл бүхэл тоо (₮) байх ёстой: "${target?.balance}"`);
    }
    if (target.balance < 0) {
      throw new AllocationError('Үлдэгдэл сөрөг ачаанд төлбөр хуваарилах боломжгүй');
    }
  }

  const totalBalance = targets.reduce((sum, t) => sum + t.balance, 0);

  if (totalBalance === 0) {
    throw new AllocationError('Сонгосон ачаанууд бүрэн төлөгдсөн байна');
  }

  // BR-15 — илүү төлөлт хориотой. Энд шалгаж байгаа шалтгаан: доорх `floor`
  // хуваалт нь дүн ихдэхэд ЧИМЭЭГҮЙ хэт төлөлт үүсгэдэг, дараа нь `balance`
  // сөрөг болж "төлөгдсөн" гэж харагдана.
  if (amount > totalBalance) {
    throw new AllocationError(`Төлөх дүн (${amount}₮) нийт үлдэгдлээс (${totalBalance}₮) их байна`);
  }

  /**
   * BigInt-ээр үржүүлж байгаа шалтгаан: `amount × balance` нь хоёулаа 1e9
   * хүртэл байж болох тул үржвэр 1e18 хүрч, `Number.MAX_SAFE_INTEGER`
   * (≈9.007e15)-ээс ХЭТЭРНЭ. Тэр үед `Math.floor` нь ойролцоо утга гаргаж,
   * хуваарилалтын нийлбэр дүнтэй таарахаа болино — өөрөөр хэлбэл мөнгө
   * "үүсэх/устах". BigInt нь яг таг тул тогтмол хэзээ ч зөрөхгүй.
   */
  const totalBig = BigInt(totalBalance);
  const amountBig = BigInt(amount);

  const allocations = targets.map(t => ({
    packageId: t.packageId,
    // BigInt-ийн `/` нь аль хэдийн доогуур дугуйруулдаг (сөрөг бус тоонд)
    amount: Number((amountBig * BigInt(t.balance)) / totalBig),
  }));

  const allocated = allocations.reduce((sum, a) => sum + a.amount, 0);
  const remainder = amount - allocated;

  // Тогтмолыг ЭНД баталгаажуулна: `floor` нь үргэлж доогуур дугуйруулдаг тул
  // үлдэгдэл нь [0, targets.length) хооронд байх ёстой. Гарвал арифметик
  // хэтэрсэн (overflow) гэсэн үг — чимээгүй өнгөрүүлбэл мөнгө "үүсэх/устах".
  if (remainder < 0 || remainder >= targets.length) {
    throw new AllocationError(
      `Хуваарилалтын дугуйруулалт хүлээгдээгүй үлдэгдэл гаргав: ${remainder}₮`
    );
  }

  if (remainder > 0) {
    allocations[allocations.length - 1].amount += remainder;
  }

  // `0`-той хуваарилалт хадгалахгүй: тайланд "энэ ачаанд төлбөр хийгдсэн" гэж
  // харагдаад дүн нь 0 байх нь ажилтныг төөрөгдүүлнэ. Гэхдээ СҮҮЛИЙН элементийг
  // хасахгүй — үлдэгдэл түүнд нэмэгдсэн байж болно.
  const result = allocations.filter(a => a.amount > 0);

  assertSumMatches(result, amount);

  return result;
}

/**
 * Ажилтан ачаа тус бүрийн дүнг ГАРААР заасан үед шалгана.
 *
 * Пропорциональ хуваарилалт нь автомат замын хувьд зөв боловч бодит ажилд
 * "энэ ачааг бүтнээр төлье, нөгөөг дараа" гэсэн хэрэгцээ байдаг. Тэр үед
 * ажилтны заасан дүнг ХҮНДЭТГЭНЭ, гэхдээ тогтмолыг зөрчүүлэхгүй.
 *
 * @param {number} amount — төлбөрийн нийт дүн (₮)
 * @param {Array<{ packageId: any, amount: number }>} allocations
 * @param {Map<string, number>} balanceByPackageId — ачаа тус бүрийн үлдэгдэл
 * @returns {Array<{ packageId: any, amount: number }>}
 * @throws {AllocationError}
 */
function validateManualAllocations(amount, allocations, balanceByPackageId) {
  assertMoney(amount, 'Төлбөрийн дүн');

  if (!Array.isArray(allocations) || allocations.length === 0) {
    throw new AllocationError('Хуваарилалт заагаагүй байна');
  }

  const seen = new Set();
  for (const allocation of allocations) {
    const key = String(allocation.packageId);

    if (seen.has(key)) {
      throw new AllocationError('Нэг ачаа хуваарилалтад хоёр удаа орсон байна');
    }
    seen.add(key);

    assertMoney(allocation.amount, 'Хуваарилах дүн');
    if (allocation.amount === 0) {
      throw new AllocationError('Хуваарилалтын дүн 0 байж болохгүй');
    }

    const balance = balanceByPackageId.get(key);
    if (balance === undefined) {
      throw new AllocationError('Хуваарилалтад байхгүй ачаа заагдсан байна');
    }
    // BR-15 — ачаа тус бүрийн хувьд ч илүү төлөлт хориотой
    if (allocation.amount > balance) {
      throw new AllocationError(
        `Ачаанд ногдох дүн (${allocation.amount}₮) түүний үлдэгдлээс (${balance}₮) их байна`
      );
    }
  }

  assertSumMatches(allocations, amount);

  return allocations.map(a => ({ packageId: a.packageId, amount: a.amount }));
}

/**
 * Тогтмолыг шалгана: `Σ allocations.amount === amount` (BR-17).
 *
 * Тусад нь функц болгосон шалтгаан: автомат ба гараар заасан ХОЁР зам ижил
 * тогтмолыг биелүүлэх ёстой. Хоёр газарт бичвэл нэг нь ЗҮГЭЭР л мартагдана.
 */
function assertSumMatches(allocations, amount) {
  const sum = allocations.reduce((acc, a) => acc + a.amount, 0);
  if (sum !== amount) {
    throw new AllocationError(
      `Хуваарилалтын нийлбэр (${sum}₮) төлбөрийн дүнтэй (${amount}₮) таарахгүй байна`
    );
  }
}

/**
 * Roadmap 5.8 — харилцагч өөрөө хүргэлт захиалахад ачаануудынхаа ҮЛДЭГДЛИЙГ
 * БҮРЭН барагдуулж, дээр нь хүргэлтийн хураамжийг нэмж ТӨЛӨХ бүтэц бодно.
 *
 * `allocateProportionally`-аас ЯЛГААТАЙ: энд ХЭСЭГЧИЛСЭН төлбөр биш —
 * харилцагч сонгосон ачаа бүрийнхээ ҮЛДЭГДЛИЙГ БҮТНЭЭР төлнө (дугуйруулах
 * үлдэгдэл гарах эрсдэлгүй, `balance`-аа шууд хуулна). Хураамж нь
 * `deliveryId`-тай, ямар ч ачаанд ХАМААРАЛГҮЙ тусдаа зорилт (`payment.model.js`).
 *
 * @param {Array<{ packageId: any, balance: number }>} packages
 * @param {any} deliveryId
 * @param {number} feeAmount — ₮, эерэг бүхэл тоо
 * @returns {{ allocations: Array<{packageId?: any, deliveryId?: any, amount: number}>, amount: number }}
 * @throws {AllocationError}
 */
function buildFullSettlement(packages, deliveryId, feeAmount) {
  if (!Array.isArray(packages)) {
    throw new AllocationError('Ачааны жагсаалт заавал байх ёстой');
  }
  assertMoney(feeAmount, 'Хүргэлтийн хураамж');
  if (feeAmount <= 0) {
    throw new AllocationError('Хүргэлтийн хураамж 0-ээс их байх ёстой');
  }

  const allocations = [];
  for (const pkg of packages) {
    if (!Number.isInteger(pkg?.balance) || pkg.balance < 0) {
      throw new AllocationError(`Ачааны үлдэгдэл бүхэл тоо (₮) байх ёстой: "${pkg?.balance}"`);
    }
    if (pkg.balance > 0) {
      allocations.push({ packageId: pkg.packageId, amount: pkg.balance });
    }
  }

  allocations.push({ deliveryId, amount: feeAmount });

  const amount = allocations.reduce((sum, a) => sum + a.amount, 0);
  assertSumMatches(allocations, amount);

  return { allocations, amount };
}

function assertMoney(value, label) {
  if (!Number.isInteger(value)) {
    throw new AllocationError(`${label} бүхэл тоо (₮) байх ёстой: "${value}"`);
  }
  if (value < 0) {
    throw new AllocationError(`${label} сөрөг байж болохгүй: "${value}"`);
  }
}

module.exports = {
  AllocationError,
  allocateProportionally,
  validateManualAllocations,
  buildFullSettlement,
  assertSumMatches,
};
