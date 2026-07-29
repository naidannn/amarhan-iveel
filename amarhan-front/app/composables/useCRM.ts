export const useCRM = () => {
  const { $axios } = useNuxtApp()

  // Customers
  const getCustomers = async (params: any = {}) => {
    try {
      const response = await $axios.get('/api/v1/crm/customers', { params })
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const getCustomer = async (id: string) => {
    try {
      const response = await $axios.get(`/api/v1/crm/customers/${id}`)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const createCustomer = async (data: any) => {
    try {
      const response = await $axios.post('/api/v1/crm/customers', data)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const updateCustomer = async (id: string, data: any) => {
    try {
      const response = await $axios.put(`/api/v1/crm/customers/${id}`, data)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const deleteCustomer = async (id: string) => {
    try {
      const response = await $axios.delete(`/api/v1/crm/customers/${id}`)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const getCustomerStats = async () => {
    try {
      const response = await $axios.get('/api/v1/crm/customers/stats')
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  // Leads
  const getLeads = async (params: any = {}) => {
    try {
      const response = await $axios.get('/api/v1/crm/leads', { params })
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const getLead = async (id: string) => {
    try {
      const response = await $axios.get(`/api/v1/crm/leads/${id}`)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const createLead = async (data: any) => {
    try {
      const response = await $axios.post('/api/v1/crm/leads', data)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const updateLead = async (id: string, data: any) => {
    try {
      const response = await $axios.put(`/api/v1/crm/leads/${id}`, data)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const convertLeadToCustomer = async (id: string, customerData?: any) => {
    try {
      const response = await $axios.post(`/api/v1/crm/leads/${id}/convert`, { customer_data: customerData })
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const getLeadFunnel = async (params: any = {}) => {
    try {
      const response = await $axios.get('/api/v1/crm/leads/funnel', { params })
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  // Deals
  const getDeals = async (params: any = {}) => {
    try {
      const response = await $axios.get('/api/v1/crm/deals', { params })
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const getDeal = async (id: string) => {
    try {
      const response = await $axios.get(`/api/v1/crm/deals/${id}`)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const createDeal = async (data: any) => {
    try {
      const response = await $axios.post('/api/v1/crm/deals', data)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const updateDeal = async (id: string, data: any) => {
    try {
      const response = await $axios.put(`/api/v1/crm/deals/${id}`, data)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const closeDeal = async (id: string, data: any) => {
    try {
      const response = await $axios.put(`/api/v1/crm/deals/${id}/close`, data)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  // Activities
  const getActivities = async (params: any = {}) => {
    try {
      const response = await $axios.get('/api/v1/crm/activities', { params })
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const getActivity = async (id: string) => {
    try {
      const response = await $axios.get(`/api/v1/crm/activities/${id}`)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const createActivity = async (data: any) => {
    try {
      const response = await $axios.post('/api/v1/crm/activities', data)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const updateActivity = async (id: string, data: any) => {
    try {
      const response = await $axios.put(`/api/v1/crm/activities/${id}`, data)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const completeActivity = async (id: string, data: any = {}) => {
    try {
      const response = await $axios.put(`/api/v1/crm/activities/${id}/complete`, data)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  // Payments
  const getPayments = async (params: any = {}) => {
    try {
      const response = await $axios.get('/api/v1/crm/payments', { params })
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const getPayment = async (id: string) => {
    try {
      const response = await $axios.get(`/api/v1/crm/payments/${id}`)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const createPayment = async (data: any) => {
    try {
      const response = await $axios.post('/api/v1/crm/payments', data)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const markPaymentAsPaid = async (id: string, data: any = {}) => {
    try {
      const response = await $axios.put(`/api/v1/crm/payments/${id}/mark-paid`, data)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  // Dashboard
  const getDashboard = async (params: any = {}) => {
    try {
      const response = await $axios.get('/api/v1/crm/dashboard', { params })
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const getSalesReport = async (params: any = {}) => {
    try {
      const response = await $axios.get('/api/v1/crm/dashboard/sales-report', { params })
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const getPerformanceReport = async (params: any = {}) => {
    try {
      const response = await $axios.get('/api/v1/crm/dashboard/performance-report', { params })
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const getAISuggestions = async (customerId: string) => {
    try {
      const response = await $axios.get(`/api/v1/crm/dashboard/suggestions/customer/${customerId}`)
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  const getOpportunitySuggestions = async () => {
    try {
      const response = await $axios.get('/api/v1/crm/dashboard/suggestions/opportunities')
      return response.data
    } catch (error: any) {
      throw error
    }
  }

  return {
    // Customers
    getCustomers,
    getCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomerStats,
    // Leads
    getLeads,
    getLead,
    createLead,
    updateLead,
    convertLeadToCustomer,
    getLeadFunnel,
    // Deals
    getDeals,
    getDeal,
    createDeal,
    updateDeal,
    closeDeal,
    // Activities
    getActivities,
    getActivity,
    createActivity,
    updateActivity,
    completeActivity,
    // Payments
    getPayments,
    getPayment,
    createPayment,
    markPaymentAsPaid,
    // Dashboard
    getDashboard,
    getSalesReport,
    getPerformanceReport,
    getAISuggestions,
    getOpportunitySuggestions
  }
}

