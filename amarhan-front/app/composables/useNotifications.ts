import { ApiError } from './usePackages'

/**
 * Мэдэгдэл — introduction.md §7 (Phase 6)
 *
 * ЭНЭ composable нь АЖИЛТНЫ (админ панелийн) илгээх/удирдах эрхийг
 * илэрхийлнэ (`/api/v1/notifications`, BR-36 — зөвхөн Админ/Менежер).
 * Харилцагчийн ӨӨРИЙН мэдэгдэл `useCustomerPortal.ts`-д.
 */

export interface AdminNotification {
  id: string
  title: string
  body: string
  audience: 'customer' | 'all'
  expiresAt: string | null
  createdBy: string | null
  createdAt: string
}

export interface NotificationPagination {
  page: number
  pages: number
  total: number
  limit: number
}

export interface SendNotificationPayload {
  title: string
  body: string
  expiresAt?: string | null
}

const API = '/api/v1/notifications'

export function useNotifications() {
  const { $axios } = useNuxtApp()

  function toApiError(e: any): ApiError {
    const body = e.response?.data
    const message =
      body?.errors?.[0]?.message || body?.message || e.message || 'Хүсэлт биелсэнгүй'
    return new ApiError(message, {
      code: body?.code ?? null,
      details: body?.details ?? null,
      status: e.response?.status ?? 0,
    })
  }

  /** §9.3 — хуудаслалт сервер талд */
  async function list(params: { page?: number; limit?: number } = {}) {
    try {
      const res = await $axios.get(API, { params })
      return {
        data: (res.data.data ?? []) as AdminNotification[],
        pagination: (res.data.pagination ?? {
          page: 1,
          pages: 1,
          total: 0,
          limit: params.limit ?? 20,
        }) as NotificationPagination,
      }
    } catch (e: any) {
      throw toApiError(e)
    }
  }

  /** BR-36 — бүх бүртгэлтэй харилцагчид нэгдсэн зарлал илгээнэ */
  async function send(payload: SendNotificationPayload): Promise<AdminNotification> {
    try {
      const res = await $axios.post(API, payload)
      return res.data.data
    } catch (e: any) {
      throw toApiError(e)
    }
  }

  return { list, send }
}
