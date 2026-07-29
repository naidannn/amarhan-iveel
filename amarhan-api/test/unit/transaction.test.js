'use strict';

const { expect } = require('chai');
const mongoose = require('mongoose');
const { withTransaction } = require('../../src/utils/transaction');
const User = require('../../src/models/user.model');
const { makeUser } = require('../factories/user.factory');

/**
 * Транзакцын дэд бүтэц ажиллаж байгааг батална (roadmap Phase 0.7, 0.8).
 *
 * Энэ тест унавал MongoDB replica set горимд ажиллахгүй байна гэсэн үг —
 * тэр тохиолдолд Phase 3 (Төлбөр)-ыг эхлүүлж БОЛОХГҮЙ, учир нь төлбөр ба
 * audit log-ийг атомик бичих боломжгүй болно (BR-41).
 */
describe('withTransaction — атомик бичилт', () => {
  it('амжилттай үед бүх өөрчлөлт хадгалагдана', async () => {
    await withTransaction(async session => {
      await User.create([makeUser({ email: 'a@iveel.mn' })], { session });
      await User.create([makeUser({ email: 'b@iveel.mn' })], { session });
    });

    expect(await User.countDocuments()).to.equal(2);
  });

  it('алдаа гарвал БҮХ өөрчлөлт буцаагдана', async () => {
    const attempt = withTransaction(async session => {
      await User.create([makeUser({ email: 'a@iveel.mn' })], { session });
      // Хоёр дахь бичлэгийн дараа санаатай унагана
      throw new Error('Санаатай алдаа');
    });

    await expect(attempt).to.be.rejectedWith('Санаатай алдаа');

    // Эхний бичлэг ч хадгалагдаагүй байх ёстой
    expect(await User.countDocuments()).to.equal(0);
  });

  it('session дамжуулаагүй бичилт транзакцаас гадуур явна', async () => {
    // Энэ бол ЗӨВ зан төлөв биш, харин анхааруулга: { session } мартвал
    // rollback ажиллахгүй. Тестээр баримтжуулж байна.
    const attempt = withTransaction(async () => {
      await User.create(makeUser({ email: 'outside@iveel.mn' })); // session алга
      throw new Error('Санаатай алдаа');
    });

    await expect(attempt).to.be.rejected;

    // Транзакцаас гадуур явсан тул үлдсэн
    expect(await User.countDocuments()).to.equal(1);
  });

  it('replica set горимд ажиллаж байна', async () => {
    const admin = mongoose.connection.db.admin();
    const status = await admin.command({ replSetGetStatus: 1 });
    expect(status.ok).to.equal(1);
  });
});
