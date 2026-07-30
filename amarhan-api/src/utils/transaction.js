'use strict';

/**
 * Функцийг MongoDB session-гүйгээр (дараалсан бичилт) ажиллуулна.
 *
 * Санамж: энэ систем MongoDB-г STANDALONE горимд ажиллуулдаг (replica set
 * шаарддаггүй, Docker-гүй, локал mongod-д шууд холбогдоно) — тиймээс жинхэнэ
 * multi-document транзакц АШИГЛАХГҮЙ. `withTransaction`-ийн доторх бичих
 * үйлдлүүд бие биенээсээ ХАМААРАЛГҮЙгээр дараалан гүйцэтгэгдэнэ: аль нэг нь
 * дунд замдаа алдаа шидвэл өмнөх бичлэгүүд БУЦААГДАХГҮЙ (rollback байхгүй).
 *
 * Callback-ийн гарын үсэг өмнөх шигээ хэвээр байгаа нь дуудагч талын кодыг
 * (172+ дуудлага) өөрчлөхгүйн тулд — session параметр `undefined` дамжина,
 * repository/query давхарга үүнийг аль хэдийн зөвшөөрөлтэйгээр эсэргэ авдаг
 * (`session ? { session } : {}`).
 *
 * @param {(session: undefined) => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
async function withTransaction(fn) {
  return fn(undefined);
}

module.exports = { withTransaction };
