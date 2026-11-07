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
  imageUrl: string | null
  linkUrl: string | null
  linkText: string | null
  showAsPopup: boolean
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
  imageUrl?: string | null
  linkUrl?: string | null
  linkText?: string | null
  showAsPopup?: boolean
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

  /** Хугацаанаас нь өмнө зогсоох — popup, нүүр, зочны хуудаснаас шууд алга болно */
  async function expire(id: string): Promise<AdminNotification> {
    try {
      const res = await $axios.post(`${API}/${id}/expire`)
      return res.data.data
    } catch (e: any) {
      throw toApiError(e)
    }
  }

  /** Зарлалын зураг — backend шахаад Cloudinary руу байршуулна, бүтэн URL буцаана */
  async function uploadImage(file: File): Promise<string> {
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await $axios.post('/api/v1/uploads/notification-image', formData)
      return res.data.data.url as string
    } catch (e: any) {
      throw toApiError(e)
    }
  }

  return { list, send, expire, uploadImage }
}
