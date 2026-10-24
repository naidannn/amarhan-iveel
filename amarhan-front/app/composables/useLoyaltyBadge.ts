import type { LoyaltyBalance } from './useCustomerPortal'

/**
 * Header/sidebar-ын кредитийн тэмдэг ("4,500 +350") — хуваалцсан төлөв.
 *
 * Layout хуудас солигдох бүрт шинэчилдэг ч төлбөр төлсний дараа хуудас
 * солигдохгүй үлддэг тул төлбөрийн хуудсууд `refresh()`-ийг шууд дуудна —
 * эс тэгвээс "кредит хэрэглэгдлээ" гэж харуулаад header-т хуучин дүн үлдэнэ.
 */
export function useLoyaltyBadge() {
  const balance = useState<LoyaltyBalance | null>('loyalty-badge', () => null)
  const customer = useCustomerStore()

  async function refresh() {
    if (!customer.isAuthenticated) return
    try {
      balance.value = await useCustomerPortal().loyaltyBalance()
    } catch {
      // Гоёл чимэглэл — урсгалыг блоклохгүй
    }
  }

  return { balance, refresh }
}
