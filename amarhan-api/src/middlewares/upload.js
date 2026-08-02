'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

/**
 * Зурган файл upload — хаяг холбох зааврын thumbnail/блокийн зураг
 * (`docs/git-workflow.md` — Phase 5.10 өргөтгөл).
 *
 * Локал диск дээр хадгална (`amarhan-api/uploads/guides/`) — AWS S3 нь Phase 0-д
 * эзэмшигчийн шийдвэрээр репогоос устсан (`CLAUDE.md` §7.1), сэргээхгүй.
 * Файлын нэрийг СЕРВЕР ҮҮСГЭНЭ (`uuid + өргөтгөл`) — клиентийн нэрийг шууд
 * ашиглавал path traversal, давхардал, урт/тэмдэгтийн асуудал үүснэ.
 */
const UPLOAD_ROOT = path.join(__dirname, '../../uploads');
const GUIDES_DIR = path.join(UPLOAD_ROOT, 'guides');

fs.mkdirSync(GUIDES_DIR, { recursive: true });

const ALLOWED_MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, GUIDES_DIR);
  },
  filename(req, file, cb) {
    const ext = ALLOWED_MIME_TO_EXT[file.mimetype] || path.extname(file.originalname) || '';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TO_EXT[file.mimetype]) {
    return cb(new Error('Зөвхөн JPG, PNG, WEBP, GIF зураг оруулна'));
  }
  cb(null, true);
}

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});
