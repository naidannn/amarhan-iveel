import tokens from '~/assets/design-tokens'

/**
 * Ачаа / хүргэлтийн төлөвийн харагдах байдал — introduction.md §1.5, §5.1
 *
 * Төлөвийн монгол нэр ба өнгө нь ЗӨВХӨН энд тодорхойлогдоно
 * (`app/assets/design-tokens.js`). Компонент бүрт давтан бичвэл нэг төлөв
 * хоёр өөр өнгөтэй болох эрсдэлтэй.
 */

export type PackageStatus =
  | 'expected'
  | 'in_erlian'
  | 'registered'
  | 'notified'
  | 'awaiting_payment'
  | 'paid'
  | 'out_for_delivery'
  | 'picked_up'
  | 'delivered'
  | 'returned'
  | 'cancelled'

export type DeliveryStatus =
  | 'created'
  | 'dispatched'
  | 'delivered'
  | 'received'
  | 'returned'
  | 'cancelled'

export interface StatusStyle {
  label: string
  color: string
  bg: string
}

const UNKNOWN: StatusStyle = {
  label: 'Тодорхойгүй',
  color: tokens.text.secondary,
  bg: tokens.surface.hover,
}

export function usePackageStatus() {
  const map = tokens.packageStatus as Record<string, StatusStyle>

  function style(status: string | null | undefined): StatusStyle {
    if (!status) return UNKNOWN
    return map[status] ?? UNKNOWN
  }

  function label(status: string | null | undefined): string {
    return style(status).label
  }

  /**
   * Дэвшлийн мөрөнд ашиглах — төлөв урсгалын хэдэн дэх алхам вэ.
   *
   * `expected` ба `in_erlian` ЗОРИУДААР ОРОХГҮЙ: прогресс зөвхөн Монголд
   * ирсний дараах урсгалыг хардаг (BR-45, BR-46) — урьдчилсан бүртгэл дээр
   * `progress()` 0 буцаана, энэ зөв: бодит бүртгэлийн урсгал хараахан
   * эхлээгүй гэсэн үг.
   */
  const FLOW: PackageStatus[] = [
    'registered',
    'notified',
    'awaiting_payment',
    'paid',
    'out_for_delivery',
    'delivered',
  ]

  function progress(status: string | null | undefined): number {
    const index = FLOW.indexOf(status as PackageStatus)
    if (index === -1) return 0
    return Math.round(((index + 1) / FLOW.length) * 100)
  }

  /**
   * УРЬДЧИЛСАН бүртгэл — ачаа хараахан агуулахад ирээгүй (BR-45, BR-46).
   * Backend-ийн `package-state.js#isPreArrival`-тай ИЖИЛ жагсаалт.
   *
   * UI-д чухал: эдгээр бичлэгт жин, үнэ, байршил БАЙХГҮЙ тул `finalPrice: 0`
   * гэдгийг «үнэгүй / төлөгдсөн» гэж харуулах ЁСГҮЙ.
   */
  const PRE_ARRIVAL: PackageStatus[] = ['expected', 'in_erlian']

  function isPreArrival(status: string | null | undefined): boolean {
    return PRE_ARRIVAL.includes(status as PackageStatus)
  }

  return { style, label, progress, isPreArrival, FLOW, PRE_ARRIVAL, all: map }
}

/**
 * Төлбөрийн харагдах байдал — §1.8, §2.2
 *
 * Дөрвөн ӨӨР зүйлийг ялгаж байгаа шалтгаан:
 *   `method`       — ЯМАР хэлбэрээр орсон (бэлэн/данс/карт/QPay)
 *   `recordStatus` — тухайн БИЧЛЭГ хүчинтэй эсэх (orson/батлагдаагүй/хүчингүй)
 *   `paymentStatus`— АЧААНЫ төлбөрийн байдал (төлөгдөөгүй/хэсэгчилсэн/төлөгдсөн)
 *   `invoiceStatus`— НЭХЭМЖЛЭХИЙН төлөв
 *
 * Эдгээрийг холивол «Хүчингүй» гэсэн ижил үг ачаа, төлбөр, нэхэмжлэхэд
 * өөр өөр утга агуулсан хэвээр нэг өнгөтэй болно.
 */
export function usePaymentStyles() {
  function pick(map: Record<string, StatusStyle>) {
    return {
      style: (key: string | null | undefined): StatusStyle =>
        (key ? map[key] : undefined) ?? UNKNOWN,
      label: (key: string | null | undefined): string =>
        ((key ? map[key] : undefined) ?? UNKNOWN).label,
      all: map,
    }
  }

  return {
    method: pick(tokens.paymentMethod as Record<string, StatusStyle>),
    recordStatus: pick(tokens.paymentRecordStatus as Record<string, StatusStyle>),
    paymentStatus: pick(tokens.paymentStatus as Record<string, StatusStyle>),
    invoiceStatus: pick(tokens.invoiceStatus as Record<string, StatusStyle>),
  }
}

export function useDeliveryStatus() {
  const map = tokens.deliveryStatus as Record<string, StatusStyle>

  function style(status: string | null | undefined): StatusStyle {
    if (!status) return UNKNOWN
    return map[status] ?? UNKNOWN
  }

  function label(status: string | null | undefined): string {
    return style(status).label
  }

  return { style, label, all: map }
}
