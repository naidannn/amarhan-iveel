'use strict';

const { expect } = require('chai');
const { withTransaction } = require('../../src/utils/transaction');
const User = require('../../src/models/user.model');
const { makeUser } = require('../factories/user.factory');

/**
 * Систем MongoDB-г STANDALONE горимд ажиллуулдаг тул `withTransaction` нь
 * жинхэнэ Mongo транзакц ХИЙХГҮЙ — callback дотор дараалан бичдэг. Энэ тест
 * зөвхөн callback зөв дуудагдаж, утга буцааж байгааг батална; rollback
 * баталгаа БАЙХГҮЙ (docs/architecture.md §4.3, §9 — шийдвэр #2 шинэчлэгдсэн).
 */
describe('withTransaction — дараалсан бичилт', () => {
  it('callback-ийн бүх бичилт хадгалагдана', async () => {
    await withTransaction(async session => {
      await User.create([makeUser({ email: 'a@iveel.mn' })], { session });
      await User.create([makeUser({ email: 'b@iveel.mn' })], { session });
    });

    expect(await User.countDocuments()).to.equal(2);
  });

  it('callback-ийн буцаасан утгыг дамжуулна', async () => {
    const result = await withTransaction(async () => 'ok');
    expect(result).to.equal('ok');
  });

  it('алдаа гарвал дуудагч руу шидэгдэнэ, гэхдээ өмнөх бичлэг БУЦААГДАХГҮЙ', async () => {
    const attempt = withTransaction(async session => {
      await User.create([makeUser({ email: 'a@iveel.mn' })], { session });
      throw new Error('Санаатай алдаа');
    });

    await expect(attempt).to.be.rejectedWith('Санаатай алдаа');

    // Rollback байхгүй тул эхний бичлэг үлдэнэ — энэ бол мэдэгдэж буй
    // trade-off (§9 архитектурын шийдвэр), алдаа биш.
    expect(await User.countDocuments()).to.equal(1);
  });
});
