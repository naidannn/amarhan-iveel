# Орчин тохируулах ба Deploy

## 1. Локал орчин

```bash
mongod                 # локал standalone MongoDB (CLAUDE.md §1 — replica set/Docker шаардлагагүй)

cd amarhan-api && npm run dev     # port 4000
cd amarhan-front && npm run dev   # port 3000
```

`amarhan-api/.env`-д `MONGOURI`, JWT нууц гэх мэт тохиргоо байна (репод байхгүй, `.env.example`-ээс хуулна).

## 2. Production сервер

**EC2:** `ubuntu@ec2-13-214-22-1.ap-southeast-1.compute.amazonaws.com` (SSH key: `hurdan.pem`, репогийн үндэс дэх, git-д ороогүй).

**Байршил серверт:** `/var/www/iveel-amarhan/` (`amarhan-api/`, `amarhan-front/`, `ecosystem.config.cjs`, `.deploy-bak/`).

PM2 хоёр процесс ажиллуулна (`ecosystem.config.cjs`, зөвхөн серверт байрлана, репод ороогүй):

| Процесс | cwd | Port | Тайлбар |
|---|---|---|---|
| `iveelt-api` | `amarhan-api/` | 4002 | `NODE_ENV=production` |
| `iveelt-front` | `amarhan-front/` | 3004 | `NUXT_PUBLIC_API_URL=https://iveelt.amarhan.mn` (өөрийн домэйн рүү заана — доор §4 үзнэ үү) |

Node 22 (`~/.nvm/versions/node/v22.22.2`) ашиглана.

## 3. Deploy хийх

Репогийн үндэст `deploy-backend.sh`, `deploy-frontend.sh` (GitHub Actions АШИГЛАХГҮЙ — локал эх кодыг шууд серверт хуулна):

```bash
./deploy-backend.sh              # rsync --exclude=uploads (SERVER-ийн uploads/ хадгална!) + npm install + pm2 restart
./deploy-backend.sh rollback     # .deploy-bak/amarhan-api руу буцаах

./deploy-frontend.sh             # локал nuxt build → tar → scp → pm2 restart
./deploy-frontend.sh rollback    # .output.prev руу буцаах
```

Хоёулаа deploy дараа `HEALTH_URL`-ээр амьд эсэхийг шалгаж, амжилтгүй бол зогсоно (rollback-ыг гараар дуудна).

## 4. Nginx маршрутлалт (iveelt.amarhan.mn)

> ⚠️ **Энэ тохиргоо репод БАЙХГҮЙ** — зөвхөн серверт гараар засварлагдсан
> (`/etc/nginx/sites-available/iveelt.amarhan.mn`). Шинэ сервер босгох/сэргээх үед
> дараах бүтцийг гараар дахин үүсгэх шаардлагатай.

Frontend (Nuxt SSR, 3004) болон Backend API (4002) **нэг домэйн дор**:

```
location /api/     → proxy_pass http://iveelt_api;       # backend
location ^~ /uploads/ → proxy_pass http://iveelt_api;     # backend (байршуулсан файл)
location / → proxy_pass http://iveelt_frontend;           # бусад бүгд — Nuxt SSR
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ → proxy_pass http://iveelt_frontend;  # Nuxt-ийн өөрийн static asset
```

**Готча (2026-08-03 илэрсэн, засагдсан):** nginx-д regex location (`~*`) нь энгийн
prefix location-оос (`/api/`, `/uploads/`) **давуу эрхтэй** байдаг. Иймд `.png`/`.jpg`
гэх мэт өргөтгөлөөр төгссөн зам (`/uploads/guides/xxx.png` — `upload.controller.js`-ийн
буцаадаг backend URL) `/api/`-д тохирохгүй байхаас гадна доод `\.(png|jpg|...)$` regex-д
тааран **Nuxt рүү** (биш backend руу) очиж, Nuxt-д ийм route байхгүй тул 404 өгдөг байсан.
Засвар: `/uploads/` location-д `^~` модификатор (`location ^~ /uploads/`) нэмсэн — энэ нь
regex location-уудыг бүрмөсөн тойрч, backend руу заавал явуулна.

Шинэ static/upload зам нэмэх бүрт (`/uploads/...`-ийн адил backend-ээс шууд файл
буцаадаг зам) **`^~` модификатортой** prefix location нэмэхээ мартуузай — эс тэгвэл
дээрх regex-ийн ижил асуудал давтагдана.

## 5. Алдагдсан эрхийн сэргээлт

`CLAUDE.md` §7-г үзнэ үү — AWS IAM, Slack bot token, QPay мерчант эрх, SSH private key
(`hurdan.pem`) солигдсон эсэхийг эзэмшигчээс лавлана.
