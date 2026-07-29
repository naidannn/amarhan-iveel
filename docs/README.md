# Баримт бичгийн жагсаалт

Ивээл Карго нэгдсэн удирдлагын системийн техникийн баримт бичиг.

---

## Хаанаас эхлэх вэ

| Та хэн бэ | Дараалал |
|---|---|
| **Шинэ хөгжүүлэгч** | `introduction.md` → [`architecture.md`](architecture.md) → [`coding-style.md`](coding-style.md) → [`setup-and-deployment.md`](setup-and-deployment.md) |
| **AI туслах (Claude Code)** | [`../CLAUDE.md`](../CLAUDE.md) → даалгаварт холбогдох doc |
| **Төслийн менежер** | `introduction.md` → [`../roadmap.md`](../roadmap.md) |
| **Бизнес шинжээч** | `introduction.md` → [`business-rules.md`](business-rules.md) |

---

## Бүх баримт

### Үндсэн

| Файл | Агуулга |
|---|---|
| [`../introduction.md`](../introduction.md) | **Бизнес шаардлага — эх сурвалж.** Зөрчилдөөн гарвал энэ давуу эрхтэй |
| [`../roadmap.md`](../roadmap.md) | Хөгжүүлэлтийн төлөвлөгөө: 10 phase, хугацаа, дуусгах шалгуур, эрсдэл |
| [`../CLAUDE.md`](../CLAUDE.md) | AI туслахад зориулсан суурь заавар |

### Техникийн

| Файл | Агуулга | Хэзээ унших |
|---|---|---|
| [`architecture.md`](architecture.md) | Системийн бүтэц, давхарга, загварууд, шийдвэрийн үндэслэл | Шинэ модуль эхлүүлэхээс өмнө |
| [`data-model.md`](data-model.md) | MongoDB коллекц, талбар, индекс, migration | Model / талбар нэмэхээс өмнө |
| [`api-conventions.md`](api-conventions.md) | REST дүрэм, хариултын формат, эрх, шалгах хуудас | Endpoint нэмэхээс өмнө |
| [`coding-style.md`](coding-style.md) | Backend + frontend кодын хэв маяг, хориотой зүйлс | Код бичихээс өмнө |
| [`business-rules.md`](business-rules.md) | BR-01…BR-44 — тестлэх боломжтой бизнес дүрмүүд | Домэйн логик хөндөхөөс өмнө |
| [`security-and-permissions.md`](security-and-permissions.md) | Эрхийн матриц, audit log, аюулгүй байдал | Эрх / audit хөндөхөөс өмнө |
| [`testing.md`](testing.md) | Тестийн стратеги, заавал байх тестүүд | Тест бичихээс өмнө |
| [`git-workflow.md`](git-workflow.md) | Салаа, commit, PR дүрэм | Commit хийхээс өмнө |
| [`setup-and-deployment.md`](setup-and-deployment.md) | Локал орчин, env, Docker, deploy | Орчин тохируулахад |
| [`glossary.md`](glossary.md) | Монгол ↔ англи нэр томьёо | Нэр сонгохдоо |

---

## Хоорондын хамаарал

```
introduction.md  (бизнес шаардлага — эх сурвалж)
        │
        ├──► business-rules.md   (BR-01…44 — хэрэгжүүлэх хэлбэрт)
        │            │
        │            ├──► data-model.md      (юуг хадгалах)
        │            ├──► architecture.md    (хэрхэн зохион байгуулах)
        │            ├──► security-*.md      (хэн юу хийж болох)
        │            └──► testing.md         (юуг заавал тестлэх)
        │
        └──► roadmap.md          (хэзээ, ямар дарааллаар)

coding-style.md · api-conventions.md · git-workflow.md · glossary.md
        └──► өдөр тутмын ажлын дүрэм

CLAUDE.md ──► бүгдийн үүд хаалга
```

---

## Баримт бичгийг шинэчлэх дүрэм

| Өөрчлөлт | Шинэчлэх файл |
|---|---|
| Шинэ коллекц / талбар | `data-model.md` |
| Шинэ бизнес дүрэм | `business-rules.md` (шинэ BR дугаар) + `introduction.md` |
| Шинэ endpoint бүлэг | `api-conventions.md` |
| Архитектурын шийдвэр | `architecture.md` §9 хүснэгт |
| Шинэ нэр томьёо | `glossary.md` |
| Phase дуусах | `roadmap.md`-д тэмдэглэх |

> Кодын өөрчлөлт баримтыг хуучруулж байвал **нэг PR-д хамт** шинэчилнэ. Хоцорсон баримт
> нь буруу баримтаас арай дээр боловч, буруу баримт нь баримтгүйгээс дор.
