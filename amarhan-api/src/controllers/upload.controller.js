'use strict';

const path = require('path');
const crypto = require('crypto');
const fs = require('fs/promises');
const sharp = require('sharp');
const httpStatus = require('http-status');
const APIError = require('../utils/APIError');
const { success } = require('../utils/response');
const { GUIDES_DIR, ALLOWED_MIME_TO_EXT } = require('../middlewares/upload');
const imageHostService = require('../services/image-host.service');

// Зааврын зураг эргэлдэх дэлгэц хамгийн ихдээ ойролцоогоор энэ өргөнөөр л
// харагддаг тул үүнээс том тал шаардлагагүй — файлын хэмжээг мэдэгдэхүйц багасгана.
const MAX_DIMENSION = 1280;
const QUALITY = 72;
const PNG_COMPRESSION_LEVEL = 9;

/**
 * GIF-ийг sharp-аар дахин кодлохгүй (анимэйшн фрэймүүдийг устгачихдаг) —
 * бусад бүх төрлийг хэмжээгээр нь хязгаарлаж, шахна.
 */
async function compressImage(file) {
  if (file.mimetype === 'image/gif') return file.buffer;

  const pipeline = sharp(file.buffer).resize({
    width: MAX_DIMENSION,
    height: MAX_DIMENSION,
    fit: 'inside',
    withoutEnlargement: true,
  });

  if (file.mimetype === 'image/png') {
    return pipeline.png({ quality: QUALITY, compressionLevel: PNG_COMPRESSION_LEVEL }).toBuffer();
  }
  if (file.mimetype === 'image/webp') {
    return pipeline.webp({ quality: QUALITY }).toBuffer();
  }
  return pipeline.jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer();
}

async function saveCompressedImage(file) {
  const ext = ALLOWED_MIME_TO_EXT[file.mimetype] || path.extname(file.originalname) || '';
  const filename = `${crypto.randomUUID()}${ext}`;
  await fs.writeFile(path.join(GUIDES_DIR, filename), await compressImage(file));
  return filename;
}

/**
 * Зураг upload хийсний дараа буцаах зам НЬ ХАРЬЦАНГУЙ (`/uploads/guides/...`) —
 * frontend үүнийг өөрийн API base URL-тэй холбоно (`usePublicContent`-ийн
 * загвартай ижил), сервер өөрийн host-оо тааж бичихгүй.
 */
exports.uploadImage = async (req, res, next) => {
  if (!req.file) {
    return next(new APIError('Зураг сонгогдоогүй байна', httpStatus.BAD_REQUEST));
  }

  try {
    const filename = await saveCompressedImage(req.file);
    return success(res, { url: `/uploads/guides/${filename}` }, httpStatus.CREATED);
  } catch {
    return next(new APIError('Зураг боловсруулж чадсангүй', httpStatus.BAD_REQUEST));
  }
};

/**
 * Нүүрний popup зарлалын зураг — сервер дээр ХАДГАЛАХГҮЙ, Cloudinary руу.
 *
 * Зураг 2–3 хоног тутам солигддог тул `uploads/` дотор хуримтлагдана. Шахалт
 * нь хаяг холбох зааврынхтай ижил (CDN-ийн хадгалах/татах квотыг хэмнэнэ).
 * Буцаах URL нь БҮТЭН (`https://res.cloudinary.com/...`).
 */
exports.uploadPopupImage = async (req, res, next) => {
  if (!req.file) {
    return next(new APIError('Зураг сонгогдоогүй байна', httpStatus.BAD_REQUEST));
  }

  let buffer;
  try {
    buffer = await compressImage(req.file);
  } catch {
    return next(new APIError('Зураг боловсруулж чадсангүй', httpStatus.BAD_REQUEST));
  }

  try {
    const hosted = await imageHostService.upload(buffer, req.file.mimetype);
    return success(res, hosted, httpStatus.CREATED);
  } catch (err) {
    return next(err);
  }
};
