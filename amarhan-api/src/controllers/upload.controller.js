'use strict';

const path = require('path');
const crypto = require('crypto');
const fs = require('fs/promises');
const sharp = require('sharp');
const httpStatus = require('http-status');
const APIError = require('../utils/APIError');
const { success } = require('../utils/response');
const { GUIDES_DIR, ALLOWED_MIME_TO_EXT } = require('../middlewares/upload');

// Зааврын зураг эргэлдэх дэлгэц хамгийн ихдээ ойролцоогоор энэ өргөнөөр л
// харагддаг тул үүнээс том тал шаардлагагүй — файлын хэмжээг мэдэгдэхүйц багасгана.
const MAX_DIMENSION = 1280;
const QUALITY = 72;
const PNG_COMPRESSION_LEVEL = 9;

/**
 * GIF-ийг sharp-аар дахин кодлохгүй (анимэйшн фрэймүүдийг устгачихдаг) —
 * бусад бүх төрлийг хэмжээгээр нь хязгаарлаж, шахна.
 */
async function saveCompressedImage(file) {
  const ext = ALLOWED_MIME_TO_EXT[file.mimetype] || path.extname(file.originalname) || '';
  const filename = `${crypto.randomUUID()}${ext}`;
  const destPath = path.join(GUIDES_DIR, filename);

  if (file.mimetype === 'image/gif') {
    await fs.writeFile(destPath, file.buffer);
    return filename;
  }

  const pipeline = sharp(file.buffer).resize({
    width: MAX_DIMENSION,
    height: MAX_DIMENSION,
    fit: 'inside',
    withoutEnlargement: true,
  });

  if (file.mimetype === 'image/png') {
    await pipeline.png({ quality: QUALITY, compressionLevel: PNG_COMPRESSION_LEVEL }).toFile(destPath);
  } else if (file.mimetype === 'image/webp') {
    await pipeline.webp({ quality: QUALITY }).toFile(destPath);
  } else {
    await pipeline.jpeg({ quality: QUALITY, mozjpeg: true }).toFile(destPath);
  }

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
