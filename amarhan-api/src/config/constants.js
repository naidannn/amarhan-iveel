'use strict';

/**
 * Дотоод системийн ролиуд — introduction.md §9.1
 *
 * Админ    — бүрэн эрх: тариф, ажилтны эрх, ачаа бүрмөсөн устгах
 * Менежер  — өдөр тутмын удирдлага: override, "Хүчингүй" болгох, тайлан (зөвхөн өөрийн салбар)
 * Ажилтан  — суурь бүртгэл: ачаа бүртгэх, төлбөр авах
 *
 * Харилцагч (вэбийн хэрэглэгч) энд ОРОХГҮЙ — тусдаа `customers` коллекцод байна.
 */
exports.ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  STAFF: 'staff',
};

exports.ROLE_LIST = Object.values(exports.ROLES);

/**
 * Route-д ашиглах эрхийн бүлгүүд.
 * Бүдүүн ширхэглэлийн шалгалт — нарийн дүрмийг (override хязгаар, 24ц цонх,
 * салбарын хамрах хүрээ) service давхарга шалгана.
 */
exports.ROLE_GROUP = {
  ADMIN: [exports.ROLES.ADMIN],
  MANAGEMENT: [exports.ROLES.ADMIN, exports.ROLES.MANAGER],
  STAFF: [exports.ROLES.ADMIN, exports.ROLES.MANAGER, exports.ROLES.STAFF],
};
