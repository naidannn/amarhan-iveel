'use strict';

/**
 * M1 — Ролийг бизнес шаардлагад нийцүүлэх (introduction.md §9.1)
 *
 * Хуучин boilerplate-ийн 4 роль → шинэ 3 роль:
 *
 *   senior_manager → manager   (өдөр тутмын удирдлага)
 *   manager        → staff     (суурь бүртгэлийн ажилтан)
 *   admin          → admin     (өөрчлөгдөхгүй)
 *   user           → ???       (доор үзнэ үү)
 *
 * `user` ролийн тухай: энэ нь boilerplate-ийн "энгийн хэрэглэгч" байсан бөгөөд
 * шинэ бүтцэд дотоод ажилтан биш. Ивээл Каргод харилцагч нь тусдаа `customers`
 * коллекцод байна (docs/architecture.md шийдвэр №3). Тиймээс `user` бичлэгийг
 * АВТОМАТААР staff болгохгүй — тэгвэл гаднын хүнд дотоод системийн эрх өгөх эрсдэлтэй.
 * Оронд нь `status: 'deactive'` болгож, гараар хянуулна.
 *
 * ЗААВАЛ: ажиллуулахын өмнө `npm run migrate -- --dry` болон DB backup хийнэ үү.
 */

const ROLE_MAP = {
  senior_manager: 'manager',
  manager: 'staff',
};

exports.up = async (connection) => {
  const users = connection.collection('users');

  // 1. Дараалал чухал: manager → staff-ыг ЭХЭЛЖ хийвэл senior_manager → manager
  //    шинээр үүссэн manager-уудыг дахин staff болгох байсан. Тиймээс эсрэгээр,
  //    бүр найдвартай нь — түр нэрээр дамжуулна.
  const tmp = await users.updateMany({ role: 'manager' }, { $set: { role: '__tmp_staff' } });
  console.log(`  manager → __tmp_staff: ${tmp.modifiedCount}`);

  const senior = await users.updateMany(
    { role: 'senior_manager' },
    { $set: { role: ROLE_MAP.senior_manager } }
  );
  console.log(`  senior_manager → manager: ${senior.modifiedCount}`);

  const staff = await users.updateMany({ role: '__tmp_staff' }, { $set: { role: 'staff' } });
  console.log(`  __tmp_staff → staff: ${staff.modifiedCount}`);

  // 2. `user` ролийг автоматаар шилжүүлэхгүй — идэвхгүй болгож гараар хянуулна.
  const legacy = await users.updateMany(
    { role: 'user' },
    { $set: { role: 'staff', status: 'deactive' } }
  );
  if (legacy.modifiedCount > 0) {
    console.log(`  user → staff + ИДЭВХГҮЙ: ${legacy.modifiedCount}`);
    console.log('    ⚠ Эдгээрийг гараар хянаж, бодит ажилтныг л идэвхжүүлнэ үү.');
  }

  // 3. Шинэ талбаруудын анхны утга
  await users.updateMany({ branchId: { $exists: false } }, { $set: { branchId: null } });

  // 4. Шалгалт — танигдахгүй роль үлдсэн эсэх
  const remaining = await users.distinct('role');
  const invalid = remaining.filter((r) => !['admin', 'manager', 'staff'].includes(r));
  if (invalid.length > 0) {
    throw new Error(`Танигдахгүй роль үлдлээ: ${invalid.join(', ')}`);
  }

  console.log(`  Эцсийн ролиуд: ${remaining.join(', ')}`);
};
