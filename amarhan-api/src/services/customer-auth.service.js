'use strict';

const jwt = require('jsonwebtoken');
const httpStatus = require('http-status');
const config = require('../config');
const customerRepository = require('../repositories/customer.repository');
const auditService = require('./audit.service');
const emailService = require('./email.service');
const phoneVerificationService = require('./phone-verification.service');
const APIError = require('../utils/APIError');
const resetToken = require('../utils/reset-token');
const { passwordResetEmail } = require('../utils/email-templates');
const { withTransaction } = require('../utils/transaction');
const { normalizePhone, maskPhone } = require('../domain/phone');
const {
  AUDIT_ACTION,
  AUDIT_ENTITY,
  ERROR_CODE,
  PHONE_VERIFICATION_PURPOSE,
  PHONE_VERIFICATION_STATUS,
} = require('../config/constants');

/**
 * Харилцагчийн танилт — introduction.md §3
 *
 * УТАС БАТАЛГААЖУУЛАЛТ (roadmap 5.2, Verify.MN — 2026-11-08).
 *
 * Утас бол ачааг харилцагчтай холбох ГОЛ ТҮЛХҮҮР (BR-26): бүртгүүлэхэд тухайн
 * утсаар бүртгэгдсэн БҮХ ачаа шууд харагдана. Тиймээс `config.verify.enabled`
 * үед бүртгэл (утас+нууц үг, Google) нь Verify.MN-ээр баталгаажсан сессийг
 * ЗААВАЛ зарцуулна, баталгаажаагүй хуучин бүртгэл порталын өгөгдөл рүү
 * НЭГ УДАА баталгаажуулах хүртэл хандахгүй (`require-verified-phone.js`, BR-28).
 *
 * Энэ файлд баримтлагдах хамгаалалт:
 *   1. `phoneVerified`-ыг ЗӨВХӨН зарцуулсан баталгаажуулалтын дараа `true`
 *      болгоно — систем баталгаажаагүйг баталгаажсан гэж БИЧИХГҮЙ.
 *   2. Харилцагч өөрийн утсыг ӨӨРЧЛӨХ зам БАЙХГҮЙ. Байсан бол нэг бүртгэлээр
 *      дараалан утас сольж бүх хүний ачааг харах боломж үүснэ. Утас солих
 *      нь ажилтны үйлдэл (`PUT /customers/:id`, audit-д бичигдэнэ) бөгөөд
 *      `phoneVerified`-ыг буцааж `false` болгоно.
 *   3. Баталгаажуулалтыг зарцуулахаас ӨМНӨ бусад бүх шалгалтыг хийнэ —
 *      хэрэглэгч SMS-дээ (150₮) мөнгө төлдөг тул имэйл давхардсан гэх мэт
 *      алдаагаар баталгаажуулалт нь дэмий шатахгүй.
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
  async register({ phone, password, name, email, verificationToken }, req) {
    const normalized = this.normalizeOrThrow(phone);
    const normalizedEmail = email ? String(email).toLowerCase().trim() : null;

    if (normalizedEmail) {
      await this.assertEmailFree(normalizedEmail);
    }

    const existing = await customerRepository.findByPhone(normalized);
    if (existing) this.assertNoAccount(existing);

    const verification = await this.consumeVerification({
      token: verificationToken,
      phone: normalized,
      purpose: PHONE_VERIFICATION_PURPOSE.REGISTER,
    });

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
      this.markVerified(customer, verification);
      await customer.save({ session });

      await this.recordSelfAction(
        {
          customer,
          action: AUDIT_ACTION.CUSTOMER_REGISTER,
          after: {
            method: 'password',
            hasEmail: Boolean(normalizedEmail),
            phoneVerified: customer.phoneVerified,
          },
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
  async completeGoogleRegistration({ pendingToken, phone, name, verificationToken }, req) {
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

    const existing = await customerRepository.findByPhone(normalized);
    if (existing) this.assertNoAccount(existing);

    const verification = await this.consumeVerification({
      token: verificationToken,
      phone: normalized,
      purpose: PHONE_VERIFICATION_PURPOSE.REGISTER,
    });

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
      this.markVerified(customer, verification);
      await customer.save({ session });

      await this.recordSelfAction(
        {
          customer,
          action: AUDIT_ACTION.CUSTOMER_REGISTER,
          after: { method: 'google', phoneVerified: customer.phoneVerified },
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

  // ── Утас баталгаажуулалт (roadmap 5.2, Verify.MN) ─────────────────────

  /**
   * Нэвтрээгүй хэрэглэгчийн баталгаажуулалт эхлүүлэх — бүртгүүлэх эсвэл
   * нууц үг сэргээх.
   *
   * Урьдчилсан шалгалтыг SMS илгээхээс ӨМНӨ хийнэ (хэрэглэгч SMS-дээ мөнгө
   * төлдөг): бүртгэлтэй дугаараар бүртгүүлэх, бүртгэлгүй дугаарын нууц үг
   * сэргээх нь дэмий SMS болно. Бүртгэл байгаа эсэхийг ил болгох нь
   * шинэ зүйл БИШ — `register` аль хэдийн `PHONE_TAKEN` буцаадаг.
   */
  async startPhoneVerification({ phone, purpose }) {
    const normalized = this.normalizeOrThrow(phone);
    const customer = await customerRepository.findByPhone(normalized);

    if (purpose === PHONE_VERIFICATION_PURPOSE.REGISTER && customer) {
      this.assertNoAccount(customer);
    }

    if (purpose === PHONE_VERIFICATION_PURPOSE.RESET_PASSWORD) {
      this.assertResettable(customer);
    }

    return phoneVerificationService.start({ phone: normalized, purpose });
  }

  async checkPhoneVerification(token) {
    return phoneVerificationService.check(token);
  }

  /**
   * Нууц үг мартсан — утсаар (Verify.MN).
   *
   * Утас эзэмшлийг нотолсон тул `phoneVerified` мөн `true` болно. Өмнө нь
   * баталгаажаагүй бүртгэл байсан бол түүнд холбогдсон имэйл/Google нь утас
   * эзэмшлийг нотлоогүй хүнийх байж болзошгүй (BR-26 — өөрийн бус дугаараар
   * бүртгүүлсэн) тул САЛГАНА, бүх хуучин токеныг хүчингүй болгоно
   * (`tokensValidAfter`). Эс тэгвээс тэр хүн Google-ээрээ орсоор байна.
   */
  async resetPasswordWithPhone({ phone, verificationToken, newPassword }, req) {
    const normalized = this.normalizeOrThrow(phone);
    const found = await customerRepository.findByPhone(normalized);
    this.assertResettable(found);

    const verification = await this.consumeVerification({
      token: verificationToken,
      phone: normalized,
      purpose: PHONE_VERIFICATION_PURPOSE.RESET_PASSWORD,
      required: true,
    });

    const customer = await this.loadFull(found._id);
    const wasVerified = customer.phoneVerified;
    const detached = {};

    if (!wasVerified) {
      if (customer.email) detached.email = customer.email;
      if (customer.googleId) detached.google = true;
      customer.email = null;
      customer.googleId = null;
    }

    customer.password = newPassword;
    customer.tokensValidAfter = this.nowInTokenPrecision();
    this.markVerified(customer, verification);
    await customer.save();

    await this.recordSelfAction({
      customer,
      action: AUDIT_ACTION.CUSTOMER_PASSWORD_RESET,
      after: { method: 'phone', ...(Object.keys(detached).length ? { detached } : {}) },
      req,
    });
    if (!wasVerified) {
      await this.recordSelfAction({
        customer,
        action: AUDIT_ACTION.CUSTOMER_PHONE_VERIFY,
        after: { phoneVerified: true, via: 'reset_password' },
        req,
      });
    }

    return { token: this.generateToken(customer), customer: this.toPublic(customer) };
  }

  /**
   * Нэвтэрсэн, утас нь баталгаажаагүй харилцагч НЭГ УДАА баталгаажуулна
   * (BR-28). Утас ҮРГЭЛЖ токены харилцагчаас — клиентээс авахгүй (дүрэм 14).
   */
  async startSelfVerification(customerId) {
    const customer = await this.loadVerifiableOrThrow(customerId);
    return phoneVerificationService.start({
      phone: customer.phone,
      purpose: PHONE_VERIFICATION_PURPOSE.VERIFY_PHONE,
      customerId: customer._id,
    });
  }

  /**
   * Polling. Verify.MN баталгаажуулмагц ЭНД шууд зарцуулж `phoneVerified`
   * болгоно — тусдаа "дуусгах" алхам шаардахгүй.
   */
  async checkSelfVerification(customerId, token, req) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      throw new APIError('Бүртгэл олдсонгүй', httpStatus.NOT_FOUND);
    }

    const verification = await phoneVerificationService.check(token, {
      customerId: customer._id,
    });

    if (customer.phoneVerified || verification.status !== PHONE_VERIFICATION_STATUS.VERIFIED) {
      return { verification, customer: await this.getMe(customerId) };
    }

    const consumed = await phoneVerificationService.consume({
      token,
      phone: customer.phone,
      purpose: PHONE_VERIFICATION_PURPOSE.VERIFY_PHONE,
      customerId: customer._id,
    });

    const updated = await customerRepository.updateById(customerId, {
      phoneVerified: true,
      phoneVerifiedAt: consumed.verifiedAt,
    });

    await this.recordSelfAction({
      customer: updated,
      action: AUDIT_ACTION.CUSTOMER_PHONE_VERIFY,
      after: { phoneVerified: true, via: 'verify_phone' },
      req,
    });

    return {
      verification: { ...verification, status: consumed.status },
      customer: await this.getMe(customerId),
    };
  }

  /**
   * `config.verify.enabled` үед ЗААВАЛ (бүртгэл); тохируулаагүй орчинд
   * баталгаажуулалтгүйгээр явна (`phoneVerified: false` хэвээр — худал
   * бичихгүй). `required` нь нууц үг сэргээх мэт баталгаажуулалтгүйгээр
   * УТГАГҮЙ урсгалд.
   */
  async consumeVerification({ token, phone, purpose, required = false }) {
    if (!config.verify.enabled) {
      if (required) {
        throw new APIError(
          'Утас баталгаажуулалт тохируулагдаагүй байна',
          httpStatus.SERVICE_UNAVAILABLE,
          { code: ERROR_CODE.PHONE_VERIFICATION_DISABLED }
        );
      }
      return null;
    }
    return phoneVerificationService.consume({ token, phone, purpose });
  }

  markVerified(customer, verification) {
    if (!verification) return;
    customer.phoneVerified = true;
    customer.phoneVerifiedAt = verification.verifiedAt || new Date();
  }

  async loadVerifiableOrThrow(customerId) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      throw new APIError('Бүртгэл олдсонгүй', httpStatus.NOT_FOUND);
    }
    if (customer.phoneVerified) {
      throw new APIError('Таны утасны дугаар аль хэдийн баталгаажсан байна', httpStatus.CONFLICT);
    }
    return customer;
  }

  assertResettable(customer) {
    if (!customer || !customer.hasAccount) {
      throw new APIError('Энэ дугаараар бүртгэл олдсонгүй', httpStatus.NOT_FOUND, {
        code: ERROR_CODE.ACCOUNT_NOT_FOUND,
      });
    }
    if (customer.status !== 'active') {
      throw new APIError('Таны бүртгэл хаагдсан байна', httpStatus.FORBIDDEN);
    }
  }

  /**
   * JWT-ийн `iat` нь СЕКУНДЭЭР — миллисекундтэй харьцуулбал яг энэ мөчид
   * олгосон шинэ токен ч "хуучин" гэж унана. Секунд хүртэл тайрна.
   */
  nowInTokenPrecision() {
    return new Date(Math.floor(Date.now() / 1000) * 1000);
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
        'Энэ дугаараар бүртгэл аль хэдийн үүссэн байна. Нэвтэрнэ үү эсвэл «Нууц үг мартсан»-аар сэргээнэ үү',
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
      // Frontend `/my/*`-ийг баталгаажуулах хуудас руу чиглүүлэх эсэх (BR-28)
      phoneVerificationRequired: config.verify.enabled && !customer.phoneVerified,
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
