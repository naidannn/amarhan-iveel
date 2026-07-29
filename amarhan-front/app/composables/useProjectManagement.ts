export const useProjectManagement = () => {
  const { $axios } = useNuxtApp()

  // Projects
  const getProjects = async (params: any = {}) => {
    try {
      const response = await $axios.get('/api/v1/projects', { params })
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const getProject = async (id: string) => {
    try {
      const response = await $axios.get(`/api/v1/projects/${id}`)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const createProject = async (data: any) => {
    try {
      const response = await $axios.post('/api/v1/projects', data)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const updateProject = async (id: string, data: any) => {
    try {
      const response = await $axios.put(`/api/v1/projects/${id}`, data)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const deleteProject = async (id: string) => {
    try {
      const response = await $axios.delete(`/api/v1/projects/${id}`)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const updateProjectProgress = async (id: string) => {
    try {
      const response = await $axios.put(`/api/v1/projects/${id}/progress`)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const getProjectStats = async (id: string) => {
    try {
      const response = await $axios.get(`/api/v1/projects/${id}/stats`)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const getProjectDashboard = async (params: any = {}) => {
    try {
      const response = await $axios.get('/api/v1/projects/dashboard', { params })
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  // Tasks
  const getTasks = async (params: any = {}) => {
    try {
      const response = await $axios.get('/api/v1/tasks', { params })
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const getTask = async (id: string) => {
    try {
      const response = await $axios.get(`/api/v1/tasks/${id}`)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const createTask = async (data: any) => {
    try {
      const response = await $axios.post('/api/v1/tasks', data)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const updateTask = async (id: string, data: any) => {
    try {
      const response = await $axios.put(`/api/v1/tasks/${id}`, data)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const deleteTask = async (id: string) => {
    try {
      const response = await $axios.delete(`/api/v1/tasks/${id}`)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const updateTaskProgress = async (id: string, progress: number) => {
    try {
      const response = await $axios.put(`/api/v1/tasks/${id}/progress`, { progress })
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const addTaskComment = async (id: string, content: string, attachments: any[] = []) => {
    try {
      const response = await $axios.post(`/api/v1/tasks/${id}/comments`, { content, attachments })
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const updateSubtask = async (taskId: string, subtaskIndex: number, data: any) => {
    try {
      const response = await $axios.put(`/api/v1/tasks/${taskId}/subtasks/${subtaskIndex}`, data)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const getOverdueTasks = async () => {
    try {
      const response = await $axios.get('/api/v1/tasks/overdue')
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const getTaskAnalytics = async (params: any = {}) => {
    try {
      const response = await $axios.get('/api/v1/tasks/analytics', { params })
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  return {
    // Projects
    getProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,
    updateProjectProgress,
    getProjectStats,
    getProjectDashboard,
    // Tasks
    getTasks,
    getTask,
    createTask,
    updateTask,
    deleteTask,
    updateTaskProgress,
    addTaskComment,
    updateSubtask,
    getOverdueTasks,
    getTaskAnalytics
  }
}

