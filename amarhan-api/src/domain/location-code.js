'use strict';

/**
 * Агуулахын байршлын код — introduction.md §8, BR-22
 *
 * Бүтэц:  Салбар → Өрөө → Тавиур → Мөр → Нүд
 * Формат: `{Салбар:2 үсэг}-{Өрөө:2 орон}-{Тавиур:үсэг}-{Мөр:1}{Нүд:1}`
 * Жишээ:  `ER-02-B-15`  =  Эрээн салбар → 02-р өрөө → B тавиур → 1-р мөр → 5-р нүд
 *
 * Мөр ба Нүд нь сүүлийн хоёр оронд ХАМТ бичигдэнэ: эхний орон = Мөр, хоёр дахь = Нүд.
 *
 * DB-ээс хамааралгүй цэвэр функцууд — тестлэхэд хялбар (docs/architecture.md §4.2).
 */

const CODE_PATTERN = /^([A-Z]{2})-(\d{2})-([A-Z])-(\d)(\d)$/;

/**
 * Бүрдэл хэсгүүдээс бүрэн код угсарна.
 *
 * @param {object} parts
 * @param {string} parts.branch  — 2 үсэг (`ER`)
 * @param {string|number} parts.room   — 1–2 орон (`2` эсвэл `'02'`)
 * @param {string} parts.shelf   — 1 үсэг (`B`)
 * @param {number} parts.row     — 1–9
 * @param {number} parts.cell    — 1–9
 * @returns {string} `ER-02-B-15`
 * @throws {Error} утга формат хангахгүй бол
 */
function formatLocationCode({ branch, room, shelf, row, cell }) {
  const b = String(branch ?? '').toUpperCase();
  const s = String(shelf ?? '').toUpperCase();
  const r = Number(room);
  const rowN = Number(row);
  const cellN = Number(cell);

  if (!/^[A-Z]{2}$/.test(b)) {
    throw new Error(`Салбарын код 2 латин үсэг байх ёстой: "${branch}"`);
  }
  if (!Number.isInteger(r) || r < 0 || r > 99) {
    throw new Error(`Өрөөний дугаар 0–99 хооронд байх ёстой: "${room}"`);
  }
  if (!/^[A-Z]$/.test(s)) {
    throw new Error(`Тавиурын код 1 латин үсэг байх ёстой: "${shelf}"`);
  }
  if (!Number.isInteger(rowN) || rowN < 1 || rowN > 9) {
    throw new Error(`Мөрийн дугаар 1–9 хооронд байх ёстой: "${row}"`);
  }
  if (!Number.isInteger(cellN) || cellN < 1 || cellN > 9) {
    throw new Error(`Нүдний дугаар 1–9 хооронд байх ёстой: "${cell}"`);
  }

  return `${b}-${String(r).padStart(2, '0')}-${s}-${rowN}${cellN}`;
}

/**
 * Бүрэн кодыг бүрдэл хэсэгт задална.
 *
 * @param {string} code — `ER-02-B-15`
 * @returns {{branch: string, room: string, roomNumber: number, shelf: string, row: number, cell: number}}
 * @throws {Error} формат буруу бол
 */
function parseLocationCode(code) {
  const normalized = String(code ?? '')
    .trim()
    .toUpperCase();
  const match = CODE_PATTERN.exec(normalized);

  if (!match) {
    throw new Error(`Байршлын кодын формат буруу: "${code}". Жишээ: ER-02-B-15`);
  }

  const [, branch, room, shelf, row, cell] = match;

  return {
    branch,
    room,
    roomNumber: Number(room),
    shelf,
    row: Number(row),
    cell: Number(cell),
  };
}

/**
 * Код хүчинтэй эсэхийг шалгана (алдаа шидэхгүй).
 * @param {string} code
 * @returns {boolean}
 */
function isValidLocationCode(code) {
  return CODE_PATTERN.test(
    String(code ?? '')
      .trim()
      .toUpperCase()
  );
}

/**
 * Нэг тавиурын бүх нүдний кодыг үүсгэнэ (bulk seed-д).
 *
 * @param {object} params
 * @param {string} params.branch
 * @param {number} params.room
 * @param {string} params.shelf
 * @param {number} params.rows   — мөрийн тоо (1–9)
 * @param {number} params.cells  — мөр бүрийн нүдний тоо (1–9)
 * @returns {Array<{code: string, branch: string, room: string, shelf: string, row: number, cell: number}>}
 */
function generateShelfCodes({ branch, room, shelf, rows, cells }) {
  if (!Number.isInteger(rows) || rows < 1 || rows > 9) {
    throw new Error(`Мөрийн тоо 1–9 хооронд байх ёстой: "${rows}"`);
  }
  if (!Number.isInteger(cells) || cells < 1 || cells > 9) {
    throw new Error(`Нүдний тоо 1–9 хооронд байх ёстой: "${cells}"`);
  }

  const result = [];
  for (let row = 1; row <= rows; row += 1) {
    for (let cell = 1; cell <= cells; cell += 1) {
      result.push({
        code: formatLocationCode({ branch, room, shelf, row, cell }),
        branch: String(branch).toUpperCase(),
        room: String(Number(room)).padStart(2, '0'),
        shelf: String(shelf).toUpperCase(),
        row,
        cell,
      });
    }
  }
  return result;
}

module.exports = {
  CODE_PATTERN,
  formatLocationCode,
  parseLocationCode,
  isValidLocationCode,
  generateShelfCodes,
};
