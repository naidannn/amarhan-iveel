/**
 * Cloudinary-ийн зургийг хөтөчид тохирох формат (WebP/AVIF), чанар, өргөнөөр
 * авна — гар утсанд эх 1280px зургийг татуулахгүй. Бусад host-ын URL хэвээр.
 */
export function optimizedImage(url: string | null | undefined, width = 900) {
  if (!url) return ''
  return url.includes('res.cloudinary.com/') && url.includes('/image/upload/')
    ? url.replace('/image/upload/', `/image/upload/f_auto,q_auto,w_${width}/`)
    : url
}
