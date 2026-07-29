# CLAUDE.md — Ивээл Карго систем

Энэ файл нь Claude Code (болон бусад AI туслах) энэ репод ажиллахад хэрэгтэй суурь мэдээллийг агуулна.
**Код бичихээс өмнө энэ файлыг, дараа нь холбогдох `docs/` файлыг унш.**

---

## 1. Төслийн мөн чанар

**Ивээл Карго** — Хятад (Эрээн) → Монгол чиглэлийн карго компанийн нэгдсэн удирдлагын систем.
9 модулиас бүрдэнэ: Ачаа, Төлбөр, Хэрэглэгчийн вэб, Урамшуулал, Хүргэлт, Тайлан, Notification, Агуулах, Аюулгүй байдал.

Бүрэн бизнес шаардлага: [`introduction.md`](introduction.md) — **энэ бол эх сурвалж (source of truth)**.
Хөгжүүлэлтийн дараалал: [`roadmap.md`](roadmap.md).

### Одоогийн байдал (2026-07)

Репо нь **boilerplate төлөвт** байна. Дараах зүйл л бэлэн:

- Express + Mongoose суурь бүтэц (service–repository–controller давхарга)
- Auth (register / login / me / logout / change-password) + JWT
- User CRUD
- Nuxt 4 frontend суурь + admin login хуудас

**Карго домэйны нэг ч модуль хараахан бичигдээгүй.** Тиймээс шинэ код бичихдээ доорх
загварыг (pattern) дагаж, домэйныг тэглээс эхлүүлнэ.

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
yarn dev               # Nuxt dev server (port 3000)
yarn build             # production build
yarn preview

# Бүхэлд нь
docker compose up      # api + mongo
```

> Frontend нь **yarn** (packageManager талбарт заасан), backend нь **npm** ашигладаг. Хольж болохгүй.

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

---

## 6. Хийхээс өмнө асуух ёстой зүйл

Дараах тохиолдолд өөрөө шийдэлгүй, хэрэглэгчээс асуу:

- Тарифын бодит тоон утга, урамшууллын босго (эдгээр нь бизнесийн шийдвэр)
- Одоо байгаа `users` коллекцын өгөгдөлд нөлөөлөх migration
- QPay / SMS үйлчилгээ үзүүлэгчийн бодит гэрээ, эрхийн мэдээлэл
- `introduction.md`-д тодорхойгүй үлдсэн бизнес дүрэм

---

## 7. Анхаарах — одоо байгаа "хог" код

Эдгээр нь өөр төслөөс үлдсэн boilerplate. Шинэ код бичихдээ **жишээ болгож болохгүй**,
Phase 0-д цэвэрлэгдэнэ (`roadmap.md` харах):

| Байршил | Асуудал |
|---|---|
| `amarhan-front/app/composables/use{HR,CRM,Finance,Inventory,FileManager,ProjectManagement}.ts` | Өөр домэйны код, ашиглагдахгүй |
| `amarhan-front/stores/auth.ts` | Nuxt 4-т `app/stores/` идэвхтэй — энэ файл үхмэл давхардал |
| `amarhan-front/app/stores/auth.ts` → `demoLogin()` | Хатуу кодлосон `admin@amarhan.mn / REDACTED_PASSWORD` fallback — production-д аюултай |
| `amarhan-api/src/services/qpay.js` | Хатуу кодлосон өөр компанийн мерчант эрх, `console.log` |
| `amarhan-api/test/{hr,contact-request}.test.js` | Байхгүй модулийн тест |
| `amarhan-api/src/config/constants.js` | Роль (`senior_manager`) нь бизнес шаардлагын Админ/Менежер/Ажилтантай таарахгүй |
| `naidan-main.pem` (репо root) | SSH private key репод commit хийгдсэн — нэн даруй устгаж, түлхүүрийг сольж, `.gitignore`-т нэмнэ |

---

## 8. Хариултын хэл

Хэрэглэгчтэй **монгол хэлээр** харилц. Код доторх comment мөн монгол хэлээр бичиж болно
(одоо байгаа кодод англи comment зонхилдог — файл дотроо нэг хэвийг бариарай).
