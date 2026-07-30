# CLAUDE.md — Ивээл Карго систем

Энэ файл нь Claude Code (болон бусад AI туслах) энэ репод ажиллахад хэрэгтэй суурь мэдээллийг агуулна.
**Код бичихээс өмнө энэ файлыг, дараа нь холбогдох `docs/` файлыг унш.**

---

## 1. Төслийн мөн чанар

**Ивээл Карго** — Хятад (Эрээн) → Монгол чиглэлийн карго компанийн нэгдсэн удирдлагын систем.

> **Бүртгэл ХААНА хийгддэг (энэ нь бүх урсгалыг тодорхойлно):** Хятадаас ирдэг
> мэдээлэл нь **зөвхөн ачааны дугаар ба утасны дугаар**. Эрээнд ачааг систем дээр
> бүртгэдэггүй. Ачаа **Монголд ирсний ДАРАА** ажилтан агуулахад бүртгэнэ. Үүнээс:
> замын төлөв (`in_transit`, `arrived`) **байхгүй**, үнийг бүртгэх үедээ
> тодорхойлно (жингээр тарифаар, эсвэл дүнг шууд бичих). `introduction.md` §1.1–1.5.
9 модулиас бүрдэнэ: Ачаа, Төлбөр, Хэрэглэгчийн вэб, Урамшуулал, Хүргэлт, Тайлан, Notification, Агуулах, Аюулгүй байдал.

Бүрэн бизнес шаардлага: [`introduction.md`](introduction.md) — **энэ бол эх сурвалж (source of truth)**.
Хөгжүүлэлтийн дараалал: [`roadmap.md`](roadmap.md).

### Одоогийн байдал (2026-07-30)

> **Урсгалын өөрчлөлт (2026-07-30):** Phase 2-ын дараа эзэмшигчийн тодруулгаар
> бүртгэлийн урсгал өөрчлөгдсөн — дэлгэрэнгүй `roadmap.md` §2.18.
> Салбарын seed код `ER` (Эрээн, Хятад) → `UB` (Улаанбаатар, Монгол) болов;
> `UB` нь **түр утга**, бодит агуулахын кодыг эзэмшигчээс лавлана.

**Phase 0, 1, 2 дууссан.** Бэлэн байгаа зүйл:

| Хэсэг | Байдал |
|---|---|
| Auth (login / me / logout / change-password) + JWT | ✅ |
| Салбар, агуулахын байршил, ачааны төрөл, тариф (хувилбаржсан) | ✅ |
| Харилцагч (утсаар автомат үүсэх) | ✅ |
| Audit Log (append-only) + харах UI | ✅ |
| **Ачааны модуль** — бүртгэл, төлөв (9), үнэ (2 горим), байршил, устгал/хүчингүй | ✅ |
| Хурдан бүртгэлийн UI, жагсаалт, дэлгэрэнгүй, баримт хэвлэх | ✅ |
| Design System v1 + өөрсдийн компонентын сан (`components/ui/`) | ✅ |
| Төлбөр (§2), Хүргэлт (§5), Хэрэглэгчийн вэб (§3), Урамшуулал (§4), Тайлан (§6), Notification (§7) | ⛔ Phase 3+ |

Домэйны цөм логик `amarhan-api/src/domain/`-д DB-ээс хамааралгүй ЦЭВЭР функц
хэлбэрээр байна — шинэ дүрэм нэмэхдээ эндээс эхэлж, 100% тестээр хучина:

| Файл | Хариуцах дүрэм |
|---|---|
| `pricing.js` | BR-01, **BR-01a**, BR-02…BR-04 — жингийн шатлал, эзлэхүүн, гараар заасан үнэ, override хязгаар |
| `package-state.js` | BR-07…BR-09a, BR-19 — төлөвийн шилжилт (замын шат БАЙХГҮЙ), байршил эзэмшил |
| `tracking-number.js` | §1.3 — ачааны дугаарын нормчлол |
| `location-code.js` | BR-22 — байршлын кодын формат |
| `phone.js` | BR-27 — утасны нормчлол, лог маскчлал |

---

## 2. Репогийн бүтэц

```
iveel-amarhan/
├── amarhan-api/          # Backend — Node.js + Express + MongoDB (Mongoose)
│   ├── src/
│   │   ├── config/       # env config, constants (роль, enum)
│   │   ├── models/       # Mongoose schema
│   │   ├── repositories/ # DB хандалт — зөвхөн энд Mongoose дуудна
│   │   ├── services/     # Бизнес логик
│   │   ├── controllers/  # HTTP req/res
│   │   ├── routes/api/   # Route тодорхойлолт
│   │   ├── validations/  # Joi схем
│   │   ├── middlewares/  # auth, validate, rate-limit, error-handler, sanitize
│   │   └── utils/        # logger, APIError, response
│   ├── scripts/          # seed / import скрипт
│   └── test/             # Mocha + Chai
├── amarhan-front/        # Frontend — Nuxt 4 + Vue 3 + Tailwind + Pinia
│   └── app/              # Nuxt 4-т бүх эх код `app/` дотор байна
│       ├── pages/  components/  composables/  stores/  layouts/  middleware/
├── docs/                 # Техникийн баримт бичиг (доор жагсаав)
├── introduction.md       # Бизнес шаардлага
├── roadmap.md            # Хөгжүүлэлтийн төлөвлөгөө
└── docker-compose.yml
```

---

## 3. Аль docs-ыг хэзээ унших вэ

| Ажил хийхээс өмнө | Унших файл |
|---|---|
| Ямар нэг код бичих | [`docs/coding-style.md`](docs/coding-style.md) |
| Шинэ модуль/давхарга нэмэх | [`docs/architecture.md`](docs/architecture.md) |
| Шинэ Mongoose model / талбар нэмэх | [`docs/data-model.md`](docs/data-model.md) |
| Шинэ endpoint нэмэх | [`docs/api-conventions.md`](docs/api-conventions.md) |
| Ачаа/төлбөр/үнийн логик хөндөх | [`docs/business-rules.md`](docs/business-rules.md) |
| Эрх, audit log хөндөх | [`docs/security-and-permissions.md`](docs/security-and-permissions.md) |
| Тест бичих | [`docs/testing.md`](docs/testing.md) |
| Commit / PR хийх | [`docs/git-workflow.md`](docs/git-workflow.md) |
| Орчин тохируулах, deploy хийх | [`docs/setup-and-deployment.md`](docs/setup-and-deployment.md) |
| Монгол ↔ англи нэр томьёо | [`docs/glossary.md`](docs/glossary.md) |

---

## 4. Түгээмэл командууд

```bash
# Backend (amarhan-api/)
npm run dev            # nodemon-оор ажиллуулах (port 4000)
npm start              # production
npm run lint           # ESLint
npm run format         # Prettier
npm test               # Mocha (NODE_ENV=test)
npm run seed:admin     # Админ хэрэглэгч үүсгэх

# Frontend (amarhan-front/)
npm run dev            # Nuxt dev server (port 3000)
npm run build          # production build
npm run preview

# Бүхэлд нь
docker compose up      # api + mongo (replica set горимд автоматаар эхэлнэ)
```

> Хоёулаа **npm** ашиглана (`package-lock.json`). Frontend-д `packageManager: yarn`
> гэсэн зөрчилтэй талбар байсныг Phase 0-д устгасан.

---

## 5. Заавал баримтлах дүрмүүд

Эдгээрийг зөрчсөн код review-д хүлээж авахгүй.

1. **Давхаргын дүрэм.** Controller → Service → Repository → Model. Controller дотор Mongoose
   дуудахыг, Repository дотор бизнес логик бичихийг хориглоно.
2. **Мөнгө = бүхэл тоо (₮).** Аравтын бутархай, float ашиглахгүй. Дэлгэрэнгүй: `docs/data-model.md`.
3. **Мөнгө/төлөв өөрчлөх бүр Audit Log-д бичигдэнэ.** Мартвал бизнес шаардлага зөрчигдөнө.
4. **Устгал бараг байхгүй.** Ачаа, төлбөрийг `cancelled`/`voided` төлөвт шилжүүлнэ.
   Ганц үл хамаарах тохиолдол: `introduction.md` §1.6 (Админ, 24ц дотор, төлбөргүй).
5. **Хайлт бүр индекслэгдсэн байх, server талд хийгдэх, хуудаслагдсан байна.** Client талд
   бүх өгөгдлийг татаж filter хийхийг хориглоно (§9.3).
6. **Эрхийн шалгалт route бүрт `authorize(...)`-оор хийгдэнэ.** UI-д товч нуух нь хамгаалалт биш.
7. **Хатуу кодлосон нууц үг/түлхүүр байхгүй.** Бүгд `.env`-ээс. *(Одоо `src/services/qpay.js`-д
   өөр төслийн QPay мерчант эрх хатуу бичигдсэн байгаа — Phase 0-д заавал арилгана.)*
8. **UI текст монгол хэлээр, код (хувьсагч, enum, коллекц) англи хэлээр.** Заримыг холихгүй.
   Харгалзуулалт: `docs/glossary.md`.
9. **Ачаа бүртгэх урсгалыг удаашруулж болохгүй.** §1.4 — хуудас reload хийхгүй, дараалсан
   бүртгэлийг тасалдуулахгүй.
10. **Үнийн хоёр горимыг хоёуланг хүндэтгэ.** Жин оруулаагүй бүртгэл нь алдаа БИШ —
   `priceSource: 'manual'`, `pricingSnapshot: null` нь зөв, хүчинтэй бүртгэл (BR-01a).
   Тариф хэрэглээгүй ачаанд **хуурамч snapshot хадгалахыг хориглоно** — хожим жин
   нэмэгдэхэд буруу дүн бодогдоно. `manual` ачаанд ±20%-ийн хязгаар хамаарахгүй.

---

## 6. Хийхээс өмнө асуух ёстой зүйл

Дараах тохиолдолд өөрөө шийдэлгүй, хэрэглэгчээс асуу:

- Тарифын бодит тоон утга, урамшууллын босго (эдгээр нь бизнесийн шийдвэр)
- Одоо байгаа `users` коллекцын өгөгдөлд нөлөөлөх migration
- QPay / SMS үйлчилгээ үзүүлэгчийн бодит гэрээ, эрхийн мэдээлэл
- `introduction.md`-д тодорхойгүй үлдсэн бизнес дүрэм

---

## 7. Phase 0 цэвэрлэгээ — дууссан (2026-07-30)

Boilerplate-ийн хог код устаж, аюулгүй байдлын нүхнүүд таглагдсан. Дэлгэрэнгүйг
git түүхээс (`chore/p0-cleanup` салаа) харна уу. Гол өөрчлөлтүүд:

| Юу | Үр дүн |
|---|---|
| Ролийн бүтэц | `admin` / `manager` / `staff` (`senior_manager` арилсан) |
| Нээлттэй `POST /auth/register` | **Хаагдсан** — эрх өөрөө өсгөх нүх байсан. Ажилтныг зөвхөн Админ `POST /api/v1/users`-ээр үүсгэнэ |
| JWT | 8 цагийн хугацаа + `aud: 'staff'` нэмэгдсэн (өмнө нь хугацаагүй байсан) |
| Идэвхгүй ажилтан | Хүчинтэй токентой ч хаагдана |
| Хатуу кодлосон нууц | qpay.js, slack.js устсан; s3-upload.js-ийнх арилсан; `demoLogin()` устсан |
| MongoDB | docker-compose-д replica set (`rs0`) автоматаар эхэлнэ |
| Транзакц | `src/utils/transaction.js` → `withTransaction()` |
| Тест | mongodb-memory-server (replica set), 18 тест өнгөрдөг |
| Lint | ESLint 9 flat config, Prettier-тэй зөрчилдөхгүй |
| CI | `.github/workflows/ci.yml` — lint, format, test, build, нууц түлхүүр шалгах |

**Хараахан ажиллуулаагүй:** `scripts/migrations/001-align-staff-roles.js` — одоо байгаа
`users` өгөгдлийн ролийг хөрвүүлнэ. Backup хийж, `npm run migrate -- --dry` шалгасны
дараа ажиллуулна.

> ⚠️ **Алдагдсан эрхийг солих шаардлагатай** — эдгээр репод хатуу кодлогдсон байсан:
> AWS IAM түлхүүр (`s3-upload.js`), Slack bot token (`slack.js`), QPay мерчант эрх
> (`qpay.js`), SSH private key (`naidan-main.pem`, одоо `~/.ssh/`-д).
> Утгыг нь энд бичихгүй — солих ажлыг гүйцэтгэсэн эсэхийг эзэмшигчээс лавлана.

---

## 8. Хариултын хэл

Хэрэглэгчтэй **монгол хэлээр** харилц. Код доторх comment мөн монгол хэлээр бичиж болно
(одоо байгаа кодод англи comment зонхилдог — файл дотроо нэг хэвийг бариарай).
