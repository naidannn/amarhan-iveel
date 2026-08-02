'use strict';

const fs = require('fs');
const path = require('path');
const multer = require('multer');

/**
 * Зурган файл upload — хаяг холбох зааврын thumbnail/блокийн зураг
 * (`docs/git-workflow.md` — Phase 5.10 өргөтгөл).
 *
 * Локал диск дээр хадгална (`amarhan-api/uploads/guides/`) — AWS S3 нь Phase 0-д
 * эзэмшигчийн шийдвэрээр репогоос устсан (`CLAUDE.md` §7.1), сэргээхгүй.
 * Файлын нэрийг СЕРВЕР ҮҮСГЭНЭ (`uuid + өргөтгөл`) — клиентийн нэрийг шууд
 * ашиглавал path traversal, давхардал, урт/тэмдэгтийн асуудал үүснэ.
 *
 * Диск рүү шууд бичихгүй, санах ойд (`memoryStorage`) түр байрлуулаад
 * `upload.controller.js`-д sharp-аар хэмжээг багасгаж/шахаж дараа нь бичнэ —
 * учир нь гар утасны камерын зураг ихэвчлэн хэдэн MB байдаг тул шахахгүй бол
 * `uploads/guides/` хурдан хэтэрхий том болно.
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

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TO_EXT[file.mimetype]) {
    return cb(new Error('Зөвхөн JPG, PNG, WEBP, GIF зураг оруулна'));
  }
  cb(null, true);
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

module.exports = upload;
module.exports.GUIDES_DIR = GUIDES_DIR;
module.exports.ALLOWED_MIME_TO_EXT = ALLOWED_MIME_TO_EXT;
