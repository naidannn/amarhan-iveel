import { ApiError } from './usePackages'

export type SystemUserRole = 'admin' | 'manager' | 'staff'
export type SystemUserStatus = 'active' | 'deactive'

export interface SystemUser {
  id: string
  email: string
  firstname: string
  lastname: string
  role: SystemUserRole
  status: SystemUserStatus
  branchId?: string | null
  lastLoginAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface SystemUserPayload {
  email: string
  firstname: string
  lastname: string
  role: SystemUserRole
  status: SystemUserStatus
  password?: string
}

export interface UserFilters {
  search: string
  role: SystemUserRole | null
  status: SystemUserStatus | null
  page: number
  limit: number
}

export interface UserPagination {
  page: number
  pages: number
  total: number
  limit: number
}

const API = '/api/v1/users'

/** Дотоод ажилтан, эрхийн удирдлагын API. */
export function useUsers() {
  const { $axios } = useNuxtApp()

  function toApiError(e: any): ApiError {
    const body = e.response?.data
    return new ApiError(body?.errors?.[0]?.message || body?.message || e.message || 'Хүсэлт биелсэнгүй', {
      code: body?.code ?? null,
      details: body?.details ?? null,
      status: e.response?.status ?? 0,
    })
  }

  async function call<T>(fn: () => Promise<any>): Promise<T> {
    try {
      const response = await fn()
      return response.data.data as T
    } catch (e: any) {
      throw toApiError(e)
    }
  }

  async function list(filters: UserFilters) {
    const params: Record<string, string | number> = {}
    for (const [key, value] of Object.entries(filters)) {
      if (value === '' || value == null) continue
      params[key] = value
    }

    try {
      const response = await $axios.get(API, { params })
      return {
        data: (response.data.data ?? []) as SystemUser[],
        pagination: (response.data.pagination ?? {
          page: 1,
          pages: 1,
          total: 0,
          limit: filters.limit,
        }) as UserPagination,
      }
    } catch (e: any) {
      throw toApiError(e)
    }
  }

  const create = (payload: SystemUserPayload) => call<SystemUser>(() => $axios.post(API, payload))
  const update = (id: string, payload: Omit<SystemUserPayload, 'password'>) =>
    call<SystemUser>(() => $axios.put(`${API}/${id}`, payload))

  return { list, create, update }
}
