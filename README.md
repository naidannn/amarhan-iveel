# Ивээл Карго — Нэгдсэн удирдлагын систем

Хятад (Эрээн) → Монгол чиглэлийн карго компанийн өдөр тутмын үйл ажиллагааг нэг
дороос удирдах систем. Ачаа бүртгэхээс эхлээд төлбөр авах, хүргэх, тайлагнах хүртэл.

Ачааг **Монголд ирсний дараа** агуулахад бүртгэнэ — Хятадаас ачааны дугаар ба
утасны дугаар л ирдэг тул систем дээрх урсгал Монголоос эхэлнэ.

> **Төлөв:** Хөгжүүлэлтийн шатанд. Phase 0, 1, 2, 3 дууссан.
> Дараагийн алхам: Phase 4 — Хүргэлтийн модуль. Дэлгэрэнгүйг [`roadmap.md`](roadmap.md).

---

## Модулиуд

| № | Модуль | Товч |
|---|---|---|
| 1 | Ачаа | Бүртгэл, үнэ автоматаар тооцох, төлөв хөтлөх, баримт хэвлэх |
| 2 | Төлбөр | Хуваасан төлбөр, нэгтгэсэн нэхэмжлэх, QPay |
| 3 | Хэрэглэгчийн вэб | Харилцагч ачаагаа хянах, төлөх, хүргэлт захиалах |
| 4 | Урамшуулал | Түвшин, оноо |
| 5 | Хүргэлт | Хүргэлт үүсгэх, төлөв хөтлөх |
| 6 | Тайлан | Орлого, ачааны урсгал, статистик |
| 7 | Notification | Вэб popup, мэдэгдлийн хуудас, SMS |
| 8 | Агуулах | Салбар→Өрөө→Тавиур→Мөр→Нүд байршил |
| 9 | Аюулгүй байдал | Эрхийн удирдлага, Audit Log |

Бүрэн бизнес шаардлага: [`introduction.md`](introduction.md)

---

## Технологи

| Хэсэг | Технологи |
|---|---|
| Backend | Node.js 20, Express 4, MongoDB 7 (Mongoose) |
| Frontend | Nuxt 4, Vue 3, Tailwind CSS, Pinia |
| Тест | Mocha, Chai, mongodb-memory-server |
| Бусад | JWT танилт, Joi валидац |

---

## Эхлэх

### Шаардлага

- Node.js 20 LTS
- MongoDB 7 (**standalone** — replica set шаардлагагүй, систем транзакц ашигладаггүй)

### Суулгах

```bash
git clone git@github.com:naidannn/amarhan-iveel.git
cd amarhan-iveel

# 1. MongoDB — локал mongod аль хэдийн ажиллаж байгаа гэж үзнэ (порт 27017)

# 2. Backend
cd amarhan-api
cp .env.example .env          # APP_SECRET-ийг заавал бөглөнө
npm install
npm run seed:admin            # анхны админ (нууц үгийг нэг удаа хэвлэнэ)
npm run dev                   # http://localhost:4000

# 3. Frontend (шинэ терминал)
cd amarhan-front
npm install
npm run dev                   # http://localhost:3000
```

Шалгах: `curl http://localhost:4000/api/status`

### Командууд

```bash
# Backend (amarhan-api/)
npm run dev            # nodemon
npm test               # Mocha (санах ойн MongoDB, standalone)
npm run lint           # ESLint
npm run format         # Prettier
npm run seed:admin     # анхны админ үүсгэх
npm run migrate -- --dry   # хүлээгдэж буй migration харах
npm run migrate            # migration ажиллуулах

# Frontend (amarhan-front/)
npm run dev
npm run build
```

> Хоёулаа **npm** ашиглана (`package-lock.json`).

---

## Баримт бичиг

| Файл | Агуулга |
|---|---|
| [`introduction.md`](introduction.md) | Бизнес шаардлага — **эх сурвалж** |
| [`roadmap.md`](roadmap.md) | Хөгжүүлэлтийн төлөвлөгөө, 10 phase |
| [`CLAUDE.md`](CLAUDE.md) | AI туслахад зориулсан заавар |
| [`docs/`](docs/README.md) | Архитектур, өгөгдлийн загвар, API конвенц, кодын хэв маяг, бизнес дүрэм, аюулгүй байдал, тест, git workflow, нэр томьёо |

---

## Бүтэц

```
iveel-amarhan/
├── amarhan-api/       # Backend — Express + MongoDB
│   └── src/           # config, models, repositories, services,
│                      # controllers, routes, validations, middlewares, utils
├── amarhan-front/     # Frontend — Nuxt 4
│   └── app/           # pages, components, composables, stores, layouts
└── docs/              # Техникийн баримт бичиг
```

Давхаргын дүрэм: **Controller → Service → Repository → Model.**
Controller дотор Mongoose дуудахыг, Repository дотор бизнес логик бичихийг хориглоно.
Дэлгэрэнгүй: [`docs/architecture.md`](docs/architecture.md).

---

## Хувь нэмэр оруулах

Commit болон PR-ийн дүрэм: [`docs/git-workflow.md`](docs/git-workflow.md).
Merge хийхийн өмнө `npm run lint`, `npm run format:check`, `npm test` гурвуулаа
цэвэр өнгөрсөн байх ёстой.

---

## Лиценз

Хувийн төсөл — Ивээл Карго ХХК.
