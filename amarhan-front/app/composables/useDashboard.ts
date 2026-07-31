/**
 * Админ dashboard-ийн API.
 *
 * Нэг endpoint ашигласнаар хуудас ачаалахад package/payment/delivery API-г
 * тус тусад нь дуудахгүй. Тэгснээр browser-ийн хүсэлт, backend-ийн давхар
 * нэгтгэл хоёул багасна.
 */

export interface DashboardDailyPoint {
  date: string
  revenue: number
  packages: number
}

export interface DashboardSummary {
  packages: {
    total: number
    awaitingPayment: number
    outstandingAmount: number
    paid: number
  }
  packageStatuses: Record<string, number>
  revenue: { total: number; count: number }
  deliveries: { total: number; delivered: number; pending: number }
  daily: DashboardDailyPoint[]
  generatedAt: string
  cacheTtlSeconds: number
}

export function useDashboard() {
  const { $axios } = useNuxtApp()

  async function summary(): Promise<DashboardSummary> {
    try {
      const response = await $axios.get('/api/v1/dashboard')
      return response.data.data as DashboardSummary
    } catch (e: any) {
      const body = e.response?.data
      throw new Error(body?.errors?.[0]?.message || body?.message || e.message || 'Хүсэлт биелсэнгүй')
    }
  }

  return { summary }
}
