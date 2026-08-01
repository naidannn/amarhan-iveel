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

/**
 * Audit-д бүртгэгдэх объектын төрлүүд — introduction.md §9.2
 */
exports.AUDIT_ENTITY = {
  PACKAGE: 'package',
  PAYMENT: 'payment',
  INVOICE: 'invoice',
  DELIVERY: 'delivery',
  CUSTOMER: 'customer',
  USER: 'user',
  BRANCH: 'branch',
  LOCATION: 'location',
  CARGO_TYPE: 'cargo_type',
  TARIFF: 'tariff',
  SETTINGS: 'settings',
};

/**
 * Audit-д бүртгэгдэх үйлдлүүд.
 *
 * Нэршил: `<entity>.<action>`. Шинэ үйлдэл нэмэхдээ ЗААВАЛ энд бүртгэнэ —
 * дурын мөр дамжуулбал тайлан, шүүлт задарна.
 */
exports.AUDIT_ACTION = {
  // Ачаа (Phase 2)
  PACKAGE_CREATE: 'package.create',
  PACKAGE_UPDATE: 'package.update',
  PACKAGE_PRICE_OVERRIDE: 'package.price_override',
  PACKAGE_STATUS_CHANGE: 'package.status_change',
  PACKAGE_LOCATION_MOVE: 'package.location_move',
  PACKAGE_CANCEL: 'package.cancel',
  PACKAGE_DELETE: 'package.delete',
  PACKAGE_DUPLICATE_APPROVED: 'package.duplicate_approved',
  // BR-46 (Phase 5) — харилцагч ӨӨРӨӨ вэбээс ачаагаа урьдчилан бүртгэсэн.
  // `actorId: null`, `actorName` нь харилцагчийн нэр — ажилтан БИШ.
  PACKAGE_SELF_REGISTER: 'package.self_register',
  // Ажилтан урьдчилсан бичлэг дээр бүртгэсэн (шинэ бичлэг үүсээгүй). Төлөвийн
  // өөрчлөлтөөс ТУСДАА бичигдэнэ: "энэ ачаа харилцагчийн мэдүүлгээс эхэлсэн"
  // гэдэг нь шүүх боломжтой байх ёстой асуулт (§9.2).
  PACKAGE_ADOPTED: 'package.adopted',

  // Төлбөр (Phase 3)
  PAYMENT_CREATE: 'payment.create',
  PAYMENT_VOID: 'payment.void',
  // Roadmap 5.8 — хүлээгдэж буй (pending) төлбөрийг ажилтан баталгаажуулсан
  // (харилцагчийн банкны шилжүүлэг бодитоор ирснийг шалгасны дараа).
  PAYMENT_CONFIRM: 'payment.confirm',
  INVOICE_CREATE: 'invoice.create',
  INVOICE_CANCEL: 'invoice.cancel',

  // Хүргэлт (Phase 4)
  DELIVERY_CREATE: 'delivery.create',
  DELIVERY_UPDATE: 'delivery.update',
  DELIVERY_STATUS_CHANGE: 'delivery.status_change',
  DELIVERY_CANCEL: 'delivery.cancel',
  // Roadmap 5.8 — харилцагч ӨӨРӨӨ вэбээс хүргэлт захиалсан. `PACKAGE_SELF_REGISTER`-ийн
  // ижил хэв маяг: `actorId: null`, `actorName` нь харилцагчийн нэр.
  DELIVERY_SELF_CREATE: 'delivery.self_create',

  // Харилцагч
  CUSTOMER_CREATE: 'customer.create',
  CUSTOMER_UPDATE: 'customer.update',
  CUSTOMER_LOYALTY_ADJUST: 'customer.loyalty_adjust',
  // Phase 5 — харилцагч ӨӨРӨӨ хийсэн үйлдэл. `actor` нь ажилтан БИШ тул
  // audit-д `actorId: null`, `actorName: 'Харилцагч'` гэж бичигдэнэ.
  CUSTOMER_REGISTER: 'customer.register',
  CUSTOMER_PHONE_LINK: 'customer.phone_link',

  // Ажилтан
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_ROLE_CHANGE: 'user.role_change',
  USER_DISABLE: 'user.disable',

  // Лавлах өгөгдөл
  BRANCH_CREATE: 'branch.create',
  BRANCH_UPDATE: 'branch.update',
  LOCATION_CREATE: 'location.create',
  LOCATION_UPDATE: 'location.update',
  CARGO_TYPE_CREATE: 'cargo_type.create',
  CARGO_TYPE_UPDATE: 'cargo_type.update',

  // Тохиргоо
  TARIFF_CHANGE: 'settings.tariff_change',
  LOYALTY_CHANGE: 'settings.loyalty_change',
  SETTINGS_UPDATE: 'settings.update',
};

exports.AUDIT_ACTION_LIST = Object.values(exports.AUDIT_ACTION);

/**
 * Ачааны төлөвүүд — introduction.md §1.5.
 * Шилжилтийн дүрмийг `src/domain/package-state.js` тодорхойлно (BR-07).
 *
 * ЯАГААД ЭРЭЭНИЙ ШАТ (хуучин утгаараа) БАЙХГҮЙ: бодит бүртгэл (жин, эзлэхүүн,
 * үнэ, байршил тодорхойлогдох мөч) ачааг Эрээнд БИШ, Монголд ирсний ДАРАА
 * хийгддэг хэвээр байна. `IN_ERLIAN` (доор) үүнийг зөрчихгүй — тэр бол зөвхөн
 * ажилтан ачааны дугаар + утсаар л мэддэг үед бичдэг УРЬДЧИЛСАН тэмдэглэл
 * (2026-07-31 шийдвэр, `roadmap.md` §2.19), "Эрээнд бүртгэгдсэн → Монгол руу
 * илгээгдсэн → Монголд ирсэн" гэсэн хуучин, татгалзсан гурван шатны замын
 * төлөв ОГТ БИШ. `IN_ERLIAN` төлөвтэй ачаа байршлын нүд эзэлдэггүй, төлбөр
 * авах/хүргэлтийн урсгалд огт оролцдоггүй (`package-state.js`-ийн
 * `OCCUPIES_LOCATION`) — зөвхөн "ирэхийг хүлээж буй" гэдгийг илэрхийлнэ.
 */
exports.PACKAGE_STATUS = {
  /**
   * BR-46 (2026-08-01) — ХАРИЛЦАГЧ ӨӨРӨӨ вэбээс бүртгэсэн, хараахан ирээгүй
   * ачаа. `IN_ERLIAN`-аас ЯЛГААТАЙ: тэрийг АЖИЛТАН Хятадын мэдээллээр бичдэг
   * бол энэ нь харилцагчийн МЭДҮҮЛЭГ — компани хараахан ачааг харж ч, хүлээж
   * авч ч амжаагүй. Тиймээс жин, үнэ, байршил, төлбөр огт байхгүй, байршлын
   * нүд эзэлдэггүй, төлбөр/хүргэлтийн урсгалд огт оролцдоггүй.
   *
   * Ачаа Эрээнд/Монголд ирэхэд ажилтан ЯГ ЭНЭ бичлэг дээр бүртгэнэ (шингээнэ)
   * — шинэ бичлэг үүсэхгүй, харилцагчийн хянаж байсан дугаар тасрахгүй.
   */
  EXPECTED: 'expected',
  IN_ERLIAN: 'in_erlian',
  REGISTERED: 'registered',
  NOTIFIED: 'notified',
  AWAITING_PAYMENT: 'awaiting_payment',
  PAID: 'paid',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  PICKED_UP: 'picked_up',
  DELIVERED: 'delivered',
  RETURNED: 'returned',
  CANCELLED: 'cancelled',
};

exports.PACKAGE_STATUS_LIST = Object.values(exports.PACKAGE_STATUS);

/**
 * Ачааны бичлэгийг ХЭН эхлүүлснийг заана — BR-46.
 *
 * Тайланд ялгах шаардлагатай: `customer` бичлэгийн дугаар/тоо хэмжээг компани
 * хараахан БАТАЛГААЖУУЛААГҮЙ (харилцагчийн бичсэнээр). `registeredBy` талбар
 * үүнийг илэрхийлж ЧАДАХГҮЙ — тэр нь `null` байх нь "систем/seed" гэсэн утга ч
 * агуулдаг тул хоёрыг ялгах боломжгүй болно.
 */
exports.REGISTRATION_SOURCE = {
  STAFF: 'staff',
  CUSTOMER: 'customer',
};

exports.REGISTRATION_SOURCE_LIST = Object.values(exports.REGISTRATION_SOURCE);

/**
 * Ачааны төлбөрийн төлөв — §1.8, BR-14.
 *
 * `packages.paidAmount` / `balance`-аас ГАРАЛТАЙ утга. Зөвхөн Phase 3-ийн
 * `payment.service.js` транзакц дотор шинэчилнэ.
 */
exports.PAYMENT_STATUS = {
  UNPAID: 'unpaid',
  PARTIAL: 'partial',
  PAID: 'paid',
};

exports.PAYMENT_STATUS_LIST = Object.values(exports.PAYMENT_STATUS);

/**
 * Төлбөр авах хэлбэр — §1.8.
 *
 * Хуваасан төлбөр гэдэг нь НЭГ ачааг олон хэлбэрээр төлөх (50% данс + 50%
 * бэлэн). Хэлбэр бүр ТУСДАА `payments` бичлэг болно (BR-13) — нэг бичлэгт
 * хоёр хэлбэр багтуулбал касс тулгахад аль дүн хаанаас орсныг ялгах
 * боломжгүй болно.
 */
exports.PAYMENT_METHOD = {
  CASH: 'cash',
  BANK: 'bank',
  CARD: 'card',
  QPAY: 'qpay',
};

exports.PAYMENT_METHOD_LIST = Object.values(exports.PAYMENT_METHOD);

/**
 * `payments` бичлэгийн төлөв — BR-14, BR-18.
 *
 * `pending`   — онлайн төлбөр (QPay) үүссэн ч батлагдаагүй. Үлдэгдэлд
 *               ТООЦОГДОХГҮЙ: батлагдаагүй мөнгийг төлөгдсөн гэж үзвэл
 *               төлөөгүй ачаа хүргэлтэнд гарна.
 * `completed` — мөнгө бодитоор орсон. ЗӨВХӨН энэ төлөв `paidAmount`-д тооцогдоно.
 * `voided`    — буруу бүртгэлийг хүчингүй болгосон. Устгахгүй (BR-18).
 */
exports.PAYMENT_RECORD_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  VOIDED: 'voided',
};

exports.PAYMENT_RECORD_STATUS_LIST = Object.values(exports.PAYMENT_RECORD_STATUS);

/**
 * Нэгтгэсэн нэхэмжлэхийн төлөв — §2.3.
 *
 * Нэхэмжлэх нь ТООЦООНЫ эх сурвалж БИШ — зөвхөн "ажилтан эдгээр ачааг нэг дор
 * төлүүлэхээр сонгосон" гэсэн бүлэглэл. Ачааны `balance` нь үргэлж
 * `payments.allocations`-аас гарна (BR-14), нэхэмжлэхээс биш. Ингэснээр
 * нэхэмжлэхгүйгээр төлбөр авах зам ч хэвийн ажиллана.
 */
exports.INVOICE_STATUS = {
  OPEN: 'open',
  PAID: 'paid',
  CANCELLED: 'cancelled',
};

exports.INVOICE_STATUS_LIST = Object.values(exports.INVOICE_STATUS);

/**
 * Хүргэлтийн төлөв — introduction.md §5.1, BR-21.
 * Шилжилтийн дүрмийг `src/domain/delivery-state.js` тодорхойлно.
 *
 * `cancelled` нь §5.1-ийн дөрвөн төлөвт БАЙГААГҮЙ, Phase 4-т нэмэгдсэн:
 * буруу үүсгэсэн хүргэлтийг устгах нь "Устгал бараг байхгүй" дүрмийг
 * (CLAUDE.md §5 дүрэм 4) зөрчинө, харин цуцлах зам байхгүй бол тэр хүргэлт
 * доторх ачаа ҮҮРД "идэвхтэй хүргэлтэд байна" гэж түгжигдэнэ (BR-20a).
 */
exports.DELIVERY_STATUS = {
  CREATED: 'created',
  DISPATCHED: 'dispatched',
  DELIVERED: 'delivered',
  RETURNED: 'returned',
  CANCELLED: 'cancelled',
};

exports.DELIVERY_STATUS_LIST = Object.values(exports.DELIVERY_STATUS);

/**
 * Roadmap 5.8 — харилцагч өөрөө захиалсан хүргэлтийн суурь хураамж (₮).
 *
 * Зөвхөн `createdBy: null` (харилцагч өөрөө вэбээс захиалсан) хүргэлтэд
 * хэрэглэгдэнэ. Ажилтны гараар үүсгэсэн хүргэлтийн `fee` талбар үүнээс
 * ХАМААРАЛГҮЙ, зөвхөн мэдээлэл хэвээр (BR-21b).
 */
exports.DELIVERY_FEE_AMOUNT = 7000;

/**
 * Frontend-д програмчлан шалгах шаардлагатай алдааны кодууд.
 *
 * Мессежийн ТЕКСТЭД frontend хамаарах ёсгүй (текст өөрчлөгдөж болно) —
 * ийм тохиолдолд кодоор ялгана.
 */
exports.ERROR_CODE = {
  DUPLICATE_TRACKING_NUMBER: 'DUPLICATE_TRACKING_NUMBER',
  OVERRIDE_LIMIT_EXCEEDED: 'OVERRIDE_LIMIT_EXCEEDED',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  DELETE_NOT_ALLOWED: 'DELETE_NOT_ALLOWED',
  // Phase 3 — төлбөр
  OVERPAYMENT: 'OVERPAYMENT',
  ALLOCATION_MISMATCH: 'ALLOCATION_MISMATCH',
  PAYMENT_ALREADY_VOIDED: 'PAYMENT_ALREADY_VOIDED',
  MIXED_CUSTOMERS: 'MIXED_CUSTOMERS',
  // Phase 4 — хүргэлт
  UNPAID_PACKAGES: 'UNPAID_PACKAGES',
  PACKAGE_IN_ACTIVE_DELIVERY: 'PACKAGE_IN_ACTIVE_DELIVERY',
  INVALID_DELIVERY_TRANSITION: 'INVALID_DELIVERY_TRANSITION',
  // Roadmap 5.8 — харилцагчийн хүргэлтийн хураамж төлөгдөөгүй (BR-20-ийн
  // `UNPAID_PACKAGES`-ээс тусад нь ялгах шаардлагатай — өөр эх сурвалж)
  UNPAID_DELIVERY_FEE: 'UNPAID_DELIVERY_FEE',
  PAYMENT_NOT_PENDING: 'PAYMENT_NOT_PENDING',
  // Phase 5 — харилцагчийн вэб
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  PHONE_TAKEN: 'PHONE_TAKEN',
  PHONE_REQUIRED: 'PHONE_REQUIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
};

/**
 * Үнэ аль хэмжигдэхүүнээр тодорхойлогдсоныг заана — §1.2
 *
 * `manual` — ажилтан жин/эзлэхүүн оруулахгүйгээр үнийн дүнг ШУУД заасан.
 * Энэ нь override БИШ: override гэдэг нь системийн бодсон дүнг өөрчлөх, харин
 * `manual` үед бодох өгөгдөл ОГТ байхгүй тул харьцуулах дүн ч байхгүй.
 * Тайланд эдгээрийг тусад нь харах шаардлагатай — тарифын хамрах хүрээ хэр
 * сайн ажиллаж байгааг зөвхөн ингэж хэмжинэ.
 *
 * `pending` — `manual`-аас ЯЛГААТАЙ: ажилтан үнийг зориудаар зааагүй, харин
 * ачаа `expected` / `in_erlian` төлөвт байх үед үнэ ОГТ мэдэгдэхгүй (жин ч
 * байхгүй, дүн ч заагаагүй). Ирц гүйцээхэд (`completeArrival`) энэ утга
 * `weight`/`volume`/
 * `minimum`/`manual`-ийн аль нэгээр ДАРЖ бичигдэнэ — `pending` хэзээ ч эцсийн
 * `finalPrice`-ийн эх сурвалж байхгүй.
 */
exports.PRICE_SOURCE = {
  WEIGHT: 'weight',
  VOLUME: 'volume',
  MINIMUM: 'minimum',
  MANUAL: 'manual',
  PENDING: 'pending',
};

/**
 * Урамшууллын түвшин — §4
 */
exports.LOYALTY_TIER = {
  BRONZE: 'bronze',
  SILVER: 'silver',
  GOLD: 'gold',
};

/**
 * Тохиргооны түлхүүрүүд (`settings` коллекц).
 * Утга нь бизнесийн шийдвэр тул кодод хатуу бичихгүй, DB-д хадгална.
 */
exports.SETTING_KEY = {
  PRICING_OVERRIDE_LIMIT_PERCENT: 'pricing.override_limit_percent',
  PACKAGE_DELETE_WINDOW_HOURS: 'package.delete_window_hours',
  WAREHOUSE_SUGGEST_ENABLED: 'warehouse.suggest_enabled',

  // Phase 5 — харилцагчийн вэбэд харагдах статик агуулга (§3).
  // `content.*` угтвартай түлхүүр НЭВТРЭЭГҮЙ зочинд ч уншигдана — тиймээс
  // энд дотоод/нууц утга ХЭЗЭЭ Ч хадгалахгүй.
  CONTENT_ERENHOT_ADDRESS: 'content.erenhot_address',
  CONTENT_CONTACT: 'content.contact',
  CONTENT_FAQ: 'content.faq',
  CONTENT_HOME_NOTICE: 'content.home_notice',

  // Дотоод тохиргоо — зөвхөн ажилтанд (§9.1). `content.*`-аас ялгаатай: энэ
  // `PUBLIC_CONTENT_KEYS`-д ОРОХГҮЙ, `/v1/public/*`-аар нээлттэй уншигдахгүй.
  PAYMENT_BANK_ACCOUNT: 'payment.bank_account',
};

/**
 * Нээлттэй уншигдах агуулгын түлхүүрүүд.
 *
 * Угтвараар (`content.`) шүүхгүй, ЖАГСААЛТААР зөвшөөрч байгаа шалтгаан: хожим
 * `content.internal_*` төрлийн түлхүүр нэмэгдвэл угтварын шүүлт түүнийг
 * чимээгүй нийтэлнэ. Тодорхой жагсаалт нь нэмэх бүрт ухамсартай шийдвэр шаардана.
 */
exports.PUBLIC_CONTENT_KEYS = [
  exports.SETTING_KEY.CONTENT_ERENHOT_ADDRESS,
  exports.SETTING_KEY.CONTENT_CONTACT,
  exports.SETTING_KEY.CONTENT_FAQ,
  exports.SETTING_KEY.CONTENT_HOME_NOTICE,
];

exports.SETTING_DEFAULTS = {
  [exports.SETTING_KEY.PRICING_OVERRIDE_LIMIT_PERCENT]: 20,
  [exports.SETTING_KEY.PACKAGE_DELETE_WINDOW_HOURS]: 24,
  [exports.SETTING_KEY.WAREHOUSE_SUGGEST_ENABLED]: true,

  /**
   * §3 — Эрээн дэх хүлээн авах хаяг. Энэ нь ЗӨВХӨН ХАРУУЛАХ ТЕКСТ: харилцагч
   * Хятадын дэлгүүрт бичих хаяг бөгөөд системийн агуулахын байршил (§8) БИШ.
   * Эрээний тал систем дээр бүртгэлгүй (§1.1).
   *
   * Утга нь бизнесийн мэдээлэл тул кодод хатуу бичихгүй — Админ вэбээс засна
   * (5.10). Доорх нь зөвхөн бөглөгдөөгүй үеийн ЗАГВАР.
   */
  [exports.SETTING_KEY.CONTENT_ERENHOT_ADDRESS]: {
    receiverName: '',
    phone: '',
    addressCn: '',
    addressMn: '',
    note: 'Хаягийн мэдээлэл хараахан бөглөгдөөгүй байна. Ажилтантай холбогдоно уу.',
  },

  [exports.SETTING_KEY.CONTENT_CONTACT]: {
    phone: '',
    email: '',
    address: '',
    workingHours: '',
    facebook: '',
    website: '',
    googleMapsUrl: '',
  },

  // [{ question, answer }]
  [exports.SETTING_KEY.CONTENT_FAQ]: [],

  // Нүүр хуудсанд харагдах зарлал. `null` = зарлал байхгүй.
  [exports.SETTING_KEY.CONTENT_HOME_NOTICE]: null,

  /**
   * Ажилтан төлбөр авахдаа (§1.8, "Данс" хэлбэр) харилцагчид өгөх дансны
   * мэдээлэл. Зөвхөн ДОТООД харагдац — public БИШ (дээрх тайлбар).
   */
  [exports.SETTING_KEY.PAYMENT_BANK_ACCOUNT]: {
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    note: '',
  },
};
