import tokens from '~/assets/design-tokens'

/**
 * Ачаа / хүргэлтийн төлөвийн харагдах байдал — introduction.md §1.5, §5.1
 *
 * Төлөвийн монгол нэр ба өнгө нь ЗӨВХӨН энд тодорхойлогдоно
 * (`app/assets/design-tokens.js`). Компонент бүрт давтан бичвэл нэг төлөв
 * хоёр өөр өнгөтэй болох эрсдэлтэй.
 */

export type PackageStatus =
  | 'registered'
  | 'notified'
  | 'awaiting_payment'
  | 'paid'
  | 'out_for_delivery'
  | 'picked_up'
  | 'delivered'
  | 'returned'
  | 'cancelled'

export type DeliveryStatus = 'created' | 'dispatched' | 'delivered' | 'returned'

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

  /** Дэвшлийн мөрөнд ашиглах — төлөв урсгалын хэдэн дэх алхам вэ */
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

  return { style, label, progress, FLOW, all: map }
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
