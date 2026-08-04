'use strict';

const jwt = require('jsonwebtoken');
const httpStatus = require('http-status');
const config = require('../config');
const customerRepository = require('../repositories/customer.repository');
const auditService = require('./audit.service');
const emailService = require('./email.service');
const APIError = require('../utils/APIError');
const resetToken = require('../utils/reset-token');
const { passwordResetEmail } = require('../utils/email-templates');
const { withTransaction } = require('../utils/transaction');
const { normalizePhone, maskPhone } = require('../domain/phone');
const { AUDIT_ACTION, AUDIT_ENTITY, ERROR_CODE } = require('../config/constants');

/**
 * Харилцагчийн танилт — introduction.md §3
 *
 * ⚠ УТАС БАТАЛГААЖУУЛАЛТ (OTP) ХАРААХАН ХЭРЭГЖЭЭГҮЙ (roadmap 5.2).
 *
 * Утас бол ачааг харилцагчтай холбох ГОЛ ТҮЛХҮҮР (BR-26): бүртгүүлэхэд тухайн
 * утсаар бүртгэгдсэн БҮХ ачаа шууд харагдана. Тиймээс баталгаажуулалтгүй
 * үед хэн нэгэн ӨӨРИЙН БИШ утас бичээд өөр хүний ачааг харах боломжтой.
 * Эзэмшигчийн шийдвэрээр энэ эрсдэлийг түр хүлээн зөвшөөрөв.
 *
 * Үүнээс үүдэн энэ файлд хоёр хамгаалалт БАРИМТЛАГДАНА:
 *   1. `phoneVerified` нь бүртгүүлэхэд `false` хэвээр — систем хэзээ ч
 *      баталгаажаагүйг баталгаажсан гэж БИЧИХГҮЙ. Phase 6-д OTP нэмэхэд
 *      зөвхөн энэ талбарын хаалтыг асаана, өгөгдөл засах шаардлагагүй.
 *   2. Харилцагч өөрийн утсыг ӨӨРЧЛӨХ зам БАЙХГҮЙ. Байсан бол нэг бүртгэлээр
 *      дараалан утас сольж бүх хүний ачааг харах боломж үүснэ. Утас солих
 *      нь ажилтны үйлдэл (`PUT /customers/:id`, audit-д бичигдэнэ).
 */
class CustomerAuthService {
  /**
   * Харилцагчийн токен — `aud: 'customer'`.
   *
   * Ажилтны токеноос ЯЛГААТАЙ audience тул хоёулаа хоорондоо солигдохгүй
   * (docs/security-and-permissions.md §4).
   */
  generateToken(customer) {
    return jwt.sign({ sub: customer.id }, config.secret, {
      audience: config.jwt.customerAudience,
      expiresIn: config.jwt.customerExpiresIn,
    });
  }

  /**
   * Google-ээр эхний удаа нэвтэрсэн, системд хараахан бүртгэлгүй хүнд
   * олгох ТҮР токен.
   *
   * Яагаад шаардлагатай вэ: Google-ээс утасны дугаар ирдэггүй, гэтэл утас
   * бол ачааг холбох цорын ганц түлхүүр (BR-26). Утасгүй харилцагчийн
   * бичлэг үүсгэвэл ямар ч ачаатай холбогдохгүй "хоосон" бүртгэл үлдэнэ.
   * Тиймээс Google-ийн мэдээллийг ГАРЫН ҮСЭГТЭЙ түр токенд хийж буцаана —
   * сервер талд түр төлөв хадгалах шаардлагагүй, засварлах ч боломжгүй.
   */
  generatePendingToken({ googleId, email, name }) {
    return jwt.sign({ googleId, email, name }, config.secret, {
      audience: config.jwt.pendingAudience,
      expiresIn: config.jwt.pendingExpiresIn,
    });
  }

  verifyPendingToken(token) {
    try {
      return jwt.verify(token, config.secret, { audience: config.jwt.pendingAudience });
    } catch {
      throw new APIError(
        'Бүртгэлийн хугацаа дууссан байна. Google-ээр дахин нэвтэрнэ үү',
        httpStatus.UNAUTHORIZED
      );
    }
  }

  /**
   * §3 — өөрөө бүртгүүлэх. Утас ЗААВАЛ.
   *
   * BR-29 — тухайн утсаар ачаа бүртгэгдэж байсан бол ШИНЭ бичлэг үүсэхгүй,
   * байгаа нь `hasAccount: true` болно. Ингэснээр өмнөх бүх ачаа шууд
   * харагдана (§3-ын гол шаардлага).
   */
  async register({ phone, password, name, email }, req) {
    const normalized = this.normalizeOrThrow(phone);
    const normalizedEmail = email ? String(email).toLowerCase().trim() : null;

    if (normalizedEmail) {
      await this.assertEmailFree(normalizedEmail);
    }

    return withTransaction(async session => {
      const { customer } = await customerRepository.findOrCreateByPhone(
        normalized,
        {},
        { session }
      );

      this.assertNoAccount(customer);

      // `save()` ашиглаж байгаа шалтгаан: нууц үгийг hash хийдэг `pre('save')`
      // hook нь `findByIdAndUpdate`-д АЖИЛЛАХГҮЙ — цэвэр текстээр хадгалагдана.
      customer.password = password;
      customer.hasAccount = true;
      if (name) customer.name = name;
      if (normalizedEmail) customer.email = normalizedEmail;
      await customer.save({ session });

      await this.recordSelfAction(
        {
          customer,
          action: AUDIT_ACTION.CUSTOMER_REGISTER,
          after: { method: 'password', hasEmail: Boolean(normalizedEmail) },
          req,
        },
        { session }
      );

      return { token: this.generateToken(customer), customer: this.toPublic(customer) };
    });
  }

  /**
   * Нэвтрэх — утас ЭСВЭЛ имэйлээр.
   *
   * Аль нь буруу байсныг ЯЛГААГҮЙ нэг мессежээр буцаана — "имэйл олдсонгүй"
   * гэж хэлэх нь ямар имэйл бүртгэлтэйг тааварлах боломж өгнө.
   */
  async login({ identifier, password }) {
    const customer = await this.findByIdentifier(identifier);

    const invalid = new APIError('Нэвтрэх нэр эсвэл нууц үг буруу байна', httpStatus.UNAUTHORIZED, {
      code: ERROR_CODE.INVALID_CREDENTIALS,
    });

    // `password` нь `select: false` тул тусад нь дуудна
    const withPassword = customer ? await this.loadFull(customer._id) : null;

    if (!withPassword || !withPassword.hasAccount || !withPassword.passwordMatches(password)) {
      throw invalid;
    }

    if (withPassword.status !== 'active') {
      throw new APIError('Таны бүртгэл хаагдсан байна', httpStatus.FORBIDDEN);
    }

    return { token: this.generateToken(withPassword), customer: this.toPublic(withPassword) };
  }

  /**
   * Google callback-аас дуудагдана (`passport-setup.js`).
   *
   * Бүртгэлтэй бол харилцагчийг, БҮРТГЭЛГҮЙ бол `null` буцаана — сүүлийн
   * тохиолдолд controller түр токен үүсгэж frontend-ийг утас асуух хуудас
   * руу шилжүүлнэ. Утасгүй харилцагч ЭНД үүсгэхгүй (дээрх тайлбар).
   */
  async findOrCreateByGoogle({ googleId, email, name }) {
    const existing = await customerRepository.findByGoogleId(googleId);
    if (existing) return existing;

    // Имэйлээрээ өмнө нь бүртгүүлсэн бол ижил бичлэгт `googleId` холбоно —
    // нэг хүн хоёр бүртгэлтэй болж ачаа нь тарахаас сэргийлнэ.
    if (email) {
      const byEmail = await customerRepository.findByEmail(email);
      if (byEmail && byEmail.hasAccount) {
        byEmail.googleId = googleId;
        if (!byEmail.name && name) byEmail.name = name;
        await byEmail.save();
        return byEmail;
      }
    }

    return null;
  }

  /**
   * Google-ээр эхний удаа нэвтэрсэн хүн утсаа өгсний дараа бүртгэлээ дуусгана.
   *
   * `register()`-ийн адил BR-29 үйлчилнэ: тухайн утсаар ачаа бүртгэгдсэн
   * байсан бол байгаа бичлэг рүү холбогдоно.
   */
  async completeGoogleRegistration({ pendingToken, phone, name }, req) {
    const payload = this.verifyPendingToken(pendingToken);
    const normalized = this.normalizeOrThrow(phone);

    // Хоёр хүн зэрэг ижил Google бүртгэлээр орох тохиолдолд давхардахгүй
    const alreadyLinked = await customerRepository.findByGoogleId(payload.googleId);
    if (alreadyLinked) {
      return {
        token: this.generateToken(alreadyLinked),
        customer: this.toPublic(alreadyLinked),
      };
    }

    if (payload.email) {
      await this.assertEmailFree(payload.email, { allowPhone: normalized });
    }

    return withTransaction(async session => {
      const { customer } = await customerRepository.findOrCreateByPhone(
        normalized,
        {},
        { session }
      );

      this.assertNoAccount(customer);

      customer.googleId = payload.googleId;
      customer.hasAccount = true;
      if (payload.email) customer.email = payload.email;
      if (name || payload.name) customer.name = name || payload.name;
      await customer.save({ session });

      await this.recordSelfAction(
        {
          customer,
          action: AUDIT_ACTION.CUSTOMER_REGISTER,
          after: { method: 'google' },
          req,
        },
        { session }
      );

      return { token: this.generateToken(customer), customer: this.toPublic(customer) };
    });
  }

  async getMe(customerId) {
    const customer = await this.loadFull(customerId);
    if (!customer) {
      throw new APIError('Бүртгэл олдсонгүй', httpStatus.NOT_FOUND);
    }
    return this.toPublic(customer);
  }

  /**
   * `password` нь `select: false` — бичлэгийг ҮҮНГҮЙГЭЭР уншвал `toPublic()`
   * нь "нууц үг тавиагүй" гэж БУРУУ хэлнэ (Google-ээр орсон хүнд нууц үг
   * тавих санал буруугаар харагдана). Тиймээс харилцагчид буцаах бүх зам
   * энэ ганц уншигчаар дамжина.
   */
  async loadFull(customerId) {
    return customerRepository.model.findById(customerId).select('+password');
  }

  /**
   * Профайл засах.
   *
   * `phone` ЗОРИУД байхгүй — файлын толгойн 2 дугаар хамгаалалт. Мөн
   * `loyalty*`, `status`, `hasAccount` зэрэг эрхийн талбар харилцагчийн
   * гараар өөрчлөгдөх боломжгүй байх ёстой тул тодорхой талбар л шинэчилнэ.
   */
  async updateProfile(customerId, { name, email }, req) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      throw new APIError('Бүртгэл олдсонгүй', httpStatus.NOT_FOUND);
    }

    const patch = {};
    if (name !== undefined) patch.name = name || null;

    if (email !== undefined) {
      const normalizedEmail = email ? String(email).toLowerCase().trim() : null;
      if (normalizedEmail !== customer.email) {
        if (normalizedEmail) await this.assertEmailFree(normalizedEmail);
        patch.email = normalizedEmail;
      }
    }

    if (Object.keys(patch).length === 0) return this.toPublic(customer);

    const changes = {};
    for (const field of Object.keys(patch)) {
      changes[field] = { before: customer[field], after: patch[field] };
    }

    await withTransaction(async session => {
      const updated = await customerRepository.updateByIdWithSession(customerId, patch, {
        session,
      });

      await auditService.recordChanges(
        {
          action: AUDIT_ACTION.CUSTOMER_UPDATE,
          entity: AUDIT_ENTITY.CUSTOMER,
          entityId: updated._id,
          entityLabel: updated.phone,
          actorName: this.describeCustomer(updated),
          req,
        },
        changes,
        { session }
      );
    });

    return this.getMe(customerId);
  }

  /**
   * Хүргэлтийн хаягууд (§5). Бүхэлд нь солино — жагсаалт богино (1–3 хаяг)
   * тул элемент тус бүрийн CRUD нь хэрэглэгчид ч, кодод ч илүү төвөгтэй.
   */
  async replaceAddresses(customerId, addresses) {
    const updated = await customerRepository.updateById(customerId, { addresses });
    if (!updated) {
      throw new APIError('Бүртгэл олдсонгүй', httpStatus.NOT_FOUND);
    }
    return this.getMe(customerId);
  }

  async changePassword(customerId, { currentPassword, newPassword }) {
    const customer = await customerRepository.model.findById(customerId).select('+password');
    if (!customer) {
      throw new APIError('Бүртгэл олдсонгүй', httpStatus.NOT_FOUND);
    }

    // Google-ээр бүртгүүлсэн хүнд нууц үг байхгүй — эхний удаа шууд тавина
    if (customer.password && !customer.passwordMatches(currentPassword)) {
      throw new APIError('Одоогийн нууц үг буруу байна', httpStatus.BAD_REQUEST);
    }

    customer.password = newPassword;
    await customer.save();
    return true;
  }

  /**
   * Нууц үг сэргээх холбоос имэйлээр илгээнэ.
   *
   * Утсаар БИШ, зөвхөн имэйлээр — SMS суваг хараахан хэрэгжээгүй (roadmap
   * 6.5). Бүртгэл олдсон эсэхээс үл хамааран ЯГ АДИЛ хариу буцаана (user
   * enumeration-оос сэргийлнэ, `login()`-ийн адил зарчим).
   */
  async selfForgotPassword(email, req) {
    const normalizedEmail = String(email ?? '')
      .toLowerCase()
      .trim();
    const customer = normalizedEmail ? await customerRepository.findByEmail(normalizedEmail) : null;

    if (customer && customer.hasAccount && customer.status === 'active') {
      const { token, hash, expires } = resetToken.generate();
      customer.resetPasswordTokenHash = hash;
      customer.resetPasswordExpires = expires;
      await customer.save({ validateBeforeSave: false });

      const resetUrl = `${config.server.frontendURL}/reset-password?token=${token}`;
      await emailService.send({
        to: customer.email,
        subject: 'Нууц үг сэргээх — Ивээл Карго',
        html: passwordResetEmail({ resetUrl, expiresInMinutes: resetToken.TTL_MS / 60000 }),
      });

      await this.recordSelfAction({
        customer,
        action: AUDIT_ACTION.CUSTOMER_PASSWORD_RESET_REQUEST,
        after: { email: customer.email },
        req,
      });
    }

    return true;
  }

  async selfResetPassword({ token, newPassword }, req) {
    const customer = await customerRepository.findByResetTokenHash(resetToken.hash(token));
    if (!customer) {
      throw new APIError('Холбоосны хугацаа дууссан эсвэл буруу байна', httpStatus.BAD_REQUEST, {
        code: ERROR_CODE.INVALID_RESET_TOKEN,
      });
    }

    customer.password = newPassword;
    customer.resetPasswordTokenHash = null;
    customer.resetPasswordExpires = null;
    await customer.save();

    await this.recordSelfAction({
      customer,
      action: AUDIT_ACTION.CUSTOMER_PASSWORD_RESET,
      req,
    });

    return true;
  }

  // ── Туслах ────────────────────────────────────────────────────────────

  async findByIdentifier(identifier) {
    const raw = String(identifier ?? '').trim();
    if (!raw) return null;

    if (raw.includes('@')) {
      return customerRepository.findByEmail(raw);
    }

    try {
      return await customerRepository.findByPhone(normalizePhone(raw));
    } catch {
      // Утас ч биш, имэйл ч биш — бүртгэл олдохгүй гэсэн үг
      return null;
    }
  }

  assertNoAccount(customer) {
    if (customer.hasAccount) {
      throw new APIError(
        'Энэ дугаараар бүртгэл аль хэдийн үүссэн байна. Нэвтэрнэ үү',
        httpStatus.CONFLICT,
        { code: ERROR_CODE.PHONE_TAKEN }
      );
    }
  }

  async assertEmailFree(email, { allowPhone = null } = {}) {
    const existing = await customerRepository.findByEmail(email);
    if (existing && existing.phone !== allowPhone) {
      throw new APIError('Энэ имэйл өөр бүртгэлд ашиглагдсан байна', httpStatus.CONFLICT, {
        code: ERROR_CODE.EMAIL_TAKEN,
      });
    }
  }

  async recordSelfAction({ customer, action, after, req }, { session } = {}) {
    return auditService.record(
      {
        action,
        entity: AUDIT_ENTITY.CUSTOMER,
        entityId: customer._id,
        entityLabel: customer.phone,
        actorName: this.describeCustomer(customer),
        after,
        req,
      },
      { session }
    );
  }

  /**
   * Audit-д харилцагчийг тэмдэглэх нэр. §8 — логт бүтэн утас бичихгүй,
   * маскална. Audit нь лог биш ч ижил зарчмыг барина: `entityId`-аар
   * бүртгэл рүү үргэлж хүрч болно, нэр нь харагдацад л хэрэгтэй.
   */
  describeCustomer(customer) {
    return `Харилцагч ${maskPhone(customer.phone)}`;
  }

  /**
   * Хариултад орох талбарууд.
   *
   * `toJSON` нь `password`-ыг аль хэдийн хасдаг ч энд ЦАГААН ЖАГСААЛТ
   * ашиглаж байгаа шалтгаан: `customers`-д ажилтны дотоод тэмдэглэл (`note`)
   * байдаг — харилцагч өөрөө үүнийг харах ёсгүй. Хожим шинэ дотоод талбар
   * нэмэгдэхэд цагаан жагсаалт нь түүнийг ЧИМЭЭГҮЙ нийтлэхгүй.
   */
  toPublic(customer) {
    return {
      id: customer._id,
      phone: customer.phone,
      phoneVerified: customer.phoneVerified,
      name: customer.name,
      email: customer.email,
      hasGoogle: Boolean(customer.googleId),
      hasPassword: Boolean(customer.password),
      addresses: customer.addresses ?? [],
      loyaltyTier: customer.loyaltyTier,
      loyaltyPoints: customer.loyaltyPoints,
      status: customer.status,
      createdAt: customer.createdAt,
    };
  }

  normalizeOrThrow(phone) {
    try {
      return normalizePhone(phone);
    } catch (err) {
      throw new APIError(err.message, httpStatus.BAD_REQUEST);
    }
  }
}

module.exports = new CustomerAuthService();
