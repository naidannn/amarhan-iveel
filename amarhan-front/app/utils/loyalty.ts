import type { LoyaltyTransaction } from '~/composables/useCustomerPortal'

/**
 * Урамшууллын харагдацын туслах функцууд — §4.
 * Хувь нь backend-ээс `rateBps` (1/10000) бүхэл тоогоор ирнэ (float-гүй).
 */

/** 350 → "3.5%" */
export function formatRate(rateBps: number): string {
  const pct = rateBps / 100
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`
}

/** Кредит олголт — backend-тэй ИЖИЛ floor дүрэм (BR-31), зөвхөн урьдчилсан тооцоо */
export function estimateEarn(cashAmount: number, rateBps: number): number {
  if (cashAmount <= 0 || rateBps <= 0) return 0
  return Math.floor((cashAmount * rateBps) / 10000)
}

/**
 * "Дахиад ≈ N ачаа" — харилцагчийн өөрийн дундаж ачааны дүнгээр. Дундаж
 * мэдэгдэхгүй (анхны ачаа) бол `null` — таамаг тоо харуулахгүй.
 */
export function packagesToGo(remaining: number, averagePackageValue: number | null): number | null {
  if (!averagePackageValue || averagePackageValue <= 0 || remaining <= 0) return null
  return Math.max(1, Math.ceil(remaining / averagePackageValue))
}

export interface TxCopy {
  title: string
  subtitle: string | null
  positive: boolean
}

/** Ledger мөрийг харилцагчид ойлгомжтой текст болгоно */
export function transactionCopy(tx: LoyaltyTransaction): TxCopy {
  const positive = tx.amount > 0
  switch (tx.type) {
    case 'earn':
      return { title: 'Кредит олгогдлоо', subtitle: tx.label ? `Ачаа ${tx.label}` : null, positive }
    case 'earn_reversal':
      return {
        title: 'Олголт буцаагдсан',
        subtitle: tx.label ? `${tx.label} — төлбөр өөрчлөгдсөн` : 'Төлбөр өөрчлөгдсөн',
        positive,
      }
    case 'redeem':
      return { title: 'Ачааны төлбөрт ашигласан', subtitle: tx.label, positive }
    case 'redeem_refund':
      return { title: 'Кредит буцаан олгогдлоо', subtitle: 'Кредитийн төлбөр цуцлагдсан', positive }
    case 'adjust':
      return {
        title: positive ? 'Урамшуулал олгогдлоо' : 'Кредитийн засвар',
        subtitle: 'Ивээлт Каргогоос',
        positive,
      }
    default:
      return { title: 'Кредитийн гүйлгээ', subtitle: null, positive }
  }
}
