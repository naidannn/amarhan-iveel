import { ref, computed, reactive } from 'vue'

interface FileCategory {
  _id: string
  name: string
  description?: string
  color: string
}

interface FileItem {
  _id: string
  original_file_name: string
  file_size: number
  file_type: string
  description?: string
  category_id: FileCategory
  uploaded_by: { email: string; full_name: string }
  tags: string[]
  createdAt: string
}

interface FileFilter {
  category_id?: string
  file_type?: string
  uploaded_by?: string
  sort_by?: 'name' | 'date' | 'size'
  sort_order?: 'asc' | 'desc'
  page?: number
  limit?: number
  q?: string
}

const API_BASE = '/api/v1/files'

// Helper to get authorization headers
const getHeaders = () => {
  const authStore = useAuthStore()
  return {
    Authorization: authStore.token ? `Bearer ${authStore.token}` : '',
    'Content-Type': 'application/json',
  }
}

export const useFileManager = () => {
  const authStore = useAuthStore()
  const categories = ref<FileCategory[]>([])
  const files = ref<FileItem[]>([])
  const selectedFile = ref<FileItem | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const filters = reactive<FileFilter>({
    sort_by: 'date',
    sort_order: 'desc',
    page: 1,
    limit: 10,
  })

  // Fetch categories
  const fetchCategories = async () => {
    try {
      isLoading.value = true
      error.value = null

      const { data } = await $fetch(`${API_BASE}/categories`, {
        headers: getHeaders(),
      })

      categories.value = data || []
    } catch (err: any) {
      error.value = err.data?.message || 'Ангилал авах барагдсан'
      console.error('Error fetching categories:', err)
    } finally {
      isLoading.value = false
    }
  }

  // Fetch files with filters
  const fetchFiles = async () => {
    try {
      isLoading.value = true
      error.value = null

      const query = new URLSearchParams(
        Object.entries(filters).reduce((acc, [key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            acc[key] = String(value)
          }
          return acc
        }, {} as Record<string, string>)
      )

      const { data, pagination } = await $fetch(`${API_BASE}?${query}`, {
        headers: getHeaders(),
      })

      files.value = data || []
      return { files: data, pagination }
    } catch (err: any) {
      error.value = err.data?.message || 'Файлуудыг авах барагдсан'
      console.error('Error fetching files:', err)
    } finally {
      isLoading.value = false
    }
  }

  // Upload file
  const uploadFile = async (file: File, categoryId: string, description?: string, tags?: string[]) => {
    try {
      isLoading.value = true
      error.value = null

      const formData = new FormData()
      formData.append('file', file)
      formData.append('category_id', categoryId)
      if (description) formData.append('description', description)
      if (tags?.length) formData.append('tags', JSON.stringify(tags))

      const result = await $fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
        headers: getHeaders(),
      })

      // Refresh files list
      await fetchFiles()
      return result
    } catch (err: any) {
      error.value = err.data?.message || 'Файл байршуулах барагдсан'
      console.error('Error uploading file:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Get file details
  const getFile = async (fileId: string) => {
    try {
      isLoading.value = true
      error.value = null

      const result = await $fetch(`${API_BASE}/${fileId}`, {
        headers: getHeaders(),
      })
      selectedFile.value = result.data
      return result.data
    } catch (err: any) {
      error.value = err.data?.message || 'Файлыг авах барагдсан'
      console.error('Error getting file:', err)
    } finally {
      isLoading.value = false
    }
  }

  // Update file
  const updateFile = async (fileId: string, updates: Partial<FileItem>) => {
    try {
      isLoading.value = true
      error.value = null

      const result = await $fetch(`${API_BASE}/${fileId}`, {
        method: 'PUT',
        body: updates,
        headers: getHeaders(),
      })

      // Update in local list
      const index = files.value.findIndex((f) => f._id === fileId)
      if (index !== -1) {
        files.value[index] = { ...files.value[index], ...result.data }
      }

      return result.data
    } catch (err: any) {
      error.value = err.data?.message || 'Файлыг шинэчлэх барагдсан'
      console.error('Error updating file:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Delete file
  const deleteFile = async (fileId: string) => {
    try {
      isLoading.value = true
      error.value = null

      await $fetch(`${API_BASE}/${fileId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      })

      // Remove from local list
      files.value = files.value.filter((f) => f._id !== fileId)
      return true
    } catch (err: any) {
      error.value = err.data?.message || 'Файлыг устгах барагдсан'
      console.error('Error deleting file:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Download file
  const downloadFile = (fileId: string) => {
    try {
      window.open(`${API_BASE}/${fileId}/download`, '_blank')
    } catch (err) {
      error.value = 'Файлыг татаж авах барагдсан'
      console.error('Error downloading file:', err)
    }
  }

  // Create category
  const createCategory = async (name: string, description?: string, color?: string) => {
    try {
      isLoading.value = true
      error.value = null

      const result = await $fetch(`${API_BASE}/categories`, {
        method: 'POST',
        body: { name, description, color },
        headers: getHeaders(),
      })

      categories.value.push(result.data)
      return result.data
    } catch (err: any) {
      error.value = err.data?.message || 'Ангилал үүсгэх барагдсан'
      console.error('Error creating category:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Create share link
  const createShareLink = async (fileId: string, accessLevel: 'view' | 'download' = 'view', expiresAt?: Date, maxViews?: number) => {
    try {
      isLoading.value = true
      error.value = null

      const result = await $fetch(`${API_BASE}/share`, {
        method: 'POST',
        body: {
          file_id: fileId,
          access_level: accessLevel,
          expires_at: expiresAt,
          max_views: maxViews,
        },
        headers: getHeaders(),
      })

      return result
    } catch (err: any) {
      error.value = err.data?.message || 'Хуваалцах линк үүсгэх барагдсан'
      console.error('Error creating share link:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Grant access
  const grantAccess = async (fileId: string, userId: string, accessLevel: string) => {
    try {
      isLoading.value = true
      error.value = null

      await $fetch(`${API_BASE}/access/grant`, {
        method: 'POST',
        body: {
          file_id: fileId,
          user_id: userId,
          access_level: accessLevel,
          access_type: 'user',
        },
        headers: getHeaders(),
      })

      return true
    } catch (err: any) {
      error.value = err.data?.message || 'Хандалт өгөх барагдсан'
      console.error('Error granting access:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Get activity log
  const getActivityLog = async (fileId?: string, page: number = 1, limit: number = 10) => {
    try {
      isLoading.value = true
      error.value = null

      const query = new URLSearchParams()
      if (fileId) query.append('file_id', fileId)
      query.append('page', String(page))
      query.append('limit', String(limit))

      const result = await $fetch(`${API_BASE}/logs/activity?${query}`, {
        headers: getHeaders(),
      })
      return result
    } catch (err: any) {
      error.value = err.data?.message || 'Үйл ажиллагааны бүртгэлийг авах барагдсан'
      console.error('Error getting activity log:', err)
    } finally {
      isLoading.value = false
    }
  }

  return {
    // State
    categories,
    files,
    selectedFile,
    isLoading,
    error,
    filters,
    // Methods
    fetchCategories,
    fetchFiles,
    uploadFile,
    getFile,
    updateFile,
    deleteFile,
    downloadFile,
    createCategory,
    createShareLink,
    grantAccess,
    getActivityLog,
  }
}

