/**
 * Тайлангийн нэгдсэн API.
 *
 * Нэг хүсэлтээр KPI, графикийн series, төлбөрийн ангилал ирдэг. Ингэснээр
 * хуудас нээгдэхэд олон endpoint болон client-side тоолол үүсэхгүй.
 */

export type ReportPeriod = '7d' | '30d' | '12m'

export interface ReportValue {
  value: number
  count: number
}

export interface ReportsSummary {
  cargo: {
    total: number
    issued: number
    remaining: number
    arrivals: number
    previousArrivals: number
    daily: Record<string, number>
    monthly: Record<string, number>
    weekly: { current: Record<string, number>; previous: Record<string, number> }
  }
  revenue: {
    total: number
    count: number
    averagePerPackage: number
    methods: Record<string, ReportValue>
    refunds: number
    discounts: number
    daily: Record<string, number>
    monthly: Record<string, number>
    yearly: Record<string, number>
  }
  payments: {
    pending: number
    pendingCount: number
    overdue: number
    overdueCount: number
    averageDays: number
    aging: Record<string, ReportValue>
  }
  /**
   * BR-47a — өдрийн үр ашгийн тайлан. `revenue`-ээс ЗОРИУДААР тусдаа:
   * `packageRevenue` нь "олох ёстой орлого" (Σ finalPrice, ирсэн өдрөөр,
   * төлбөр орсон эсэхээс үл хамааран), `revenue` нь БОДИТ орсон төлбөр.
   */
  efficiency: {
    packageRevenue: { total: number; count: number; daily: Record<string, number> }
    expenses: {
      total: number
      count: number
      byCategory: Record<string, ReportValue>
      daily: Record<string, number>
    }
    profit: { total: number; daily: Record<string, number> }
  }
  period: ReportPeriod
  generatedAt: string
  cacheTtlSeconds: number
}

export function useReports() {
  const { $axios } = useNuxtApp()

  async function summary(period: ReportPeriod): Promise<ReportsSummary> {
    try {
      const response = await $axios.get('/api/v1/reports', { params: { period } })
      return response.data.data as ReportsSummary
    } catch (error: any) {
      const body = error.response?.data
      throw new Error(body?.errors?.[0]?.message || body?.message || error.message || 'Хүсэлт биелсэнгүй')
    }
  }

  return { summary }
}
