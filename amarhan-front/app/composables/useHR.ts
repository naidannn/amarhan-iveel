import { ref, reactive } from 'vue'

interface Employee {
  _id?: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  position: string
  department: string
  startDate: string
  endDate?: string
  contractType: string
  baseSalary: number
  registryNumber?: string
  status: 'active' | 'onboarding' | 'offboarding' | 'inactive'
  manager?: string
}

interface Contract {
  _id?: string
  employee: string
  contractType: string
  startDate: string
  endDate: string
  status: 'draft' | 'active' | 'expired' | 'terminated'
  documentUrl?: string
}

interface Payroll {
  _id?: string
  employee: string
  month: string
  baseSalary: number
  additions?: number
  bonus?: number
  deductions?: number
  netSalary: number
  status: 'draft' | 'calculated' | 'approved' | 'paid'
}

interface Leave {
  _id?: string
  employee: string
  leaveType: string
  startDate: string
  endDate: string
  numberOfDays: number
  reason: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
}

interface Attendance {
  _id?: string
  employee: string
  date: string
  checkInTime?: string
  checkOutTime?: string
  status: 'present' | 'absent' | 'late' | 'half-day' | 'leave'
}

interface Bonus {
  _id?: string
  employee: string
  month: string
  bonusType: string
  amount: number
  reason: string
  status: 'pending' | 'approved' | 'rejected' | 'paid'
}

export const useHR = () => {
  const $axios = useNuxtApp().$axios

  // Employee Management
  const employees = ref<Employee[]>([])
  const currentEmployee = ref<Employee | null>(null)
  const employeeLoading = ref(false)
  const employeeError = ref<string | null>(null)

  // Contracts
  const contracts = ref<Contract[]>([])
  const currentContract = ref<Contract | null>(null)
  const contractLoading = ref(false)

  // Payroll
  const payrolls = ref<Payroll[]>([])
  const payrollLoading = ref(false)

  // Leave
  const leaves = ref<Leave[]>([])
  const leaveLoading = ref(false)

  // Attendance
  const attendances = ref<Attendance[]>([])
  const attendanceLoading = ref(false)

  // Bonus
  const bonuses = ref<Bonus[]>([])
  const bonusLoading = ref(false)

  // ===== EMPLOYEE METHODS =====
  const fetchEmployees = async (params?: any) => {
    try {
      employeeLoading.value = true
      const { data } = await $axios.get('/api/v1/hr/employees', { params })
      employees.value = data.docs || data
    } catch (error: any) {
      employeeError.value = error.response?.data?.message || 'Failed to fetch employees'
    } finally {
      employeeLoading.value = false
    }
  }

  const getEmployee = async (id: string) => {
    try {
      employeeLoading.value = true
      const { data } = await $axios.get(`/api/v1/hr/employees/${id}`)
      currentEmployee.value = data.employee
      return data
    } catch (error: any) {
      employeeError.value = error.response?.data?.message || 'Failed to fetch employee'
    } finally {
      employeeLoading.value = false
    }
  }

  const createEmployee = async (employee: Employee) => {
    try {
      employeeLoading.value = true
      const { data } = await $axios.post('/api/v1/hr/employees', employee)
      employees.value.push(data)
      return data
    } catch (error: any) {
      employeeError.value = error.response?.data?.message || 'Failed to create employee'
      throw error
    } finally {
      employeeLoading.value = false
    }
  }

  const updateEmployee = async (id: string, updates: Partial<Employee>) => {
    try {
      employeeLoading.value = true
      const { data } = await $axios.put(`/api/v1/hr/employees/${id}`, updates)
      const index = employees.value.findIndex((e) => e._id === id)
      if (index !== -1) {
        employees.value[index] = data
      }
      currentEmployee.value = data
      return data
    } catch (error: any) {
      employeeError.value = error.response?.data?.message || 'Failed to update employee'
      throw error
    } finally {
      employeeLoading.value = false
    }
  }

  const deleteEmployee = async (id: string) => {
    try {
      employeeLoading.value = true
      await $axios.delete(`/api/v1/hr/employees/${id}`)
      employees.value = employees.value.filter((e) => e._id !== id)
    } catch (error: any) {
      employeeError.value = error.response?.data?.message || 'Failed to delete employee'
      throw error
    } finally {
      employeeLoading.value = false
    }
  }

  const getEmployeeStats = async () => {
    try {
      const { data } = await $axios.get('/api/v1/hr/employees/stats/overview')
      return data
    } catch (error: any) {
      console.error('Failed to fetch employee stats')
    }
  }

  // ===== CONTRACT METHODS =====
  const fetchContracts = async (params?: any) => {
    try {
      contractLoading.value = true
      const { data } = await $axios.get('/api/v1/hr/contracts', { params })
      contracts.value = data.docs || data
    } catch (error: any) {
      console.error('Failed to fetch contracts')
    } finally {
      contractLoading.value = false
    }
  }

  const getContract = async (id: string) => {
    try {
      contractLoading.value = true
      const { data } = await $axios.get(`/api/v1/hr/contracts/${id}`)
      currentContract.value = data
      return data
    } catch (error: any) {
      console.error('Failed to fetch contract')
      throw error
    } finally {
      contractLoading.value = false
    }
  }

  const createContract = async (contract: Contract) => {
    try {
      contractLoading.value = true
      const { data } = await $axios.post('/api/v1/hr/contracts', contract)
      contracts.value.push(data)
      return data
    } catch (error: any) {
      throw error
    } finally {
      contractLoading.value = false
    }
  }

  const updateContract = async (id: string, updates: Partial<Contract>) => {
    try {
      const { data } = await $axios.put(`/api/v1/hr/contracts/${id}`, updates)
      const index = contracts.value.findIndex((c) => c._id === id)
      if (index !== -1) {
        contracts.value[index] = data
      }
      return data
    } catch (error: any) {
      throw error
    }
  }

  const approveContract = async (id: string) => {
    try {
      const { data } = await $axios.put(`/api/v1/hr/contracts/${id}/approve`)
      return data
    } catch (error: any) {
      throw error
    }
  }

  const renewContract = async (id: string, endDate: string) => {
    try {
      const { data } = await $axios.put(`/api/v1/hr/contracts/${id}/renew`, { endDate })
      return data
    } catch (error: any) {
      throw error
    }
  }

  const getExpiringContracts = async () => {
    try {
      const { data } = await $axios.get('/api/v1/hr/contracts/expiring/list')
      return data
    } catch (error: any) {
      console.error('Failed to fetch expiring contracts')
    }
  }

  // ===== PAYROLL METHODS =====
  const fetchPayroll = async (params?: any) => {
    try {
      payrollLoading.value = true
      const { data } = await $axios.get('/api/v1/hr/payroll', { params })
      payrolls.value = data.docs || data
    } catch (error: any) {
      console.error('Failed to fetch payroll')
    } finally {
      payrollLoading.value = false
    }
  }

  const getPayroll = async (id: string) => {
    try {
      payrollLoading.value = true
      const { data } = await $axios.get(`/api/v1/hr/payroll/${id}`)
      return data
    } catch (error: any) {
      console.error('Failed to fetch payroll')
      throw error
    } finally {
      payrollLoading.value = false
    }
  }

  const calculatePayroll = async (employeeId: string, month: string, salary: number) => {
    try {
      payrollLoading.value = true
      const { data } = await $axios.post('/api/v1/hr/payroll/calculate', {
        employee: employeeId,
        month,
        baseSalary: salary,
      })
      payrolls.value.push(data)
      return data
    } catch (error: any) {
      throw error
    } finally {
      payrollLoading.value = false
    }
  }

  const approvePayroll = async (id: string) => {
    try {
      const { data } = await $axios.put(`/api/v1/hr/payroll/${id}/approve`)
      return data
    } catch (error: any) {
      throw error
    }
  }

  const markPayrollAsPaid = async (id: string) => {
    try {
      const { data } = await $axios.put(`/api/v1/hr/payroll/${id}/mark-paid`)
      return data
    } catch (error: any) {
      throw error
    }
  }

  const getPayrollSummary = async (month: string) => {
    try {
      const { data } = await $axios.get('/api/v1/hr/payroll/summary/monthly', { params: { month } })
      return data
    } catch (error: any) {
      console.error('Failed to fetch payroll summary')
    }
  }

  // ===== LEAVE METHODS =====
  const fetchLeaves = async (params?: any) => {
    try {
      leaveLoading.value = true
      const { data } = await $axios.get('/api/v1/hr/leave', { params })
      leaves.value = data.docs || data
    } catch (error: any) {
      console.error('Failed to fetch leaves')
    } finally {
      leaveLoading.value = false
    }
  }

  const getLeave = async (id: string) => {
    try {
      leaveLoading.value = true
      const { data } = await $axios.get(`/api/v1/hr/leave/${id}`)
      return data
    } catch (error: any) {
      console.error('Failed to fetch leave')
      throw error
    } finally {
      leaveLoading.value = false
    }
  }

  const createLeaveRequest = async (leave: Leave) => {
    try {
      leaveLoading.value = true
      const { data } = await $axios.post('/api/v1/hr/leave', leave)
      leaves.value.push(data)
      return data
    } catch (error: any) {
      throw error
    } finally {
      leaveLoading.value = false
    }
  }

  const approveLeave = async (id: string) => {
    try {
      const { data } = await $axios.put(`/api/v1/hr/leave/${id}/approve`)
      return data
    } catch (error: any) {
      throw error
    }
  }

  const rejectLeave = async (id: string, reason: string) => {
    try {
      const { data } = await $axios.put(`/api/v1/hr/leave/${id}/reject`, { rejectionReason: reason })
      return data
    } catch (error: any) {
      throw error
    }
  }

  const getLeaveBalance = async (employeeId: string) => {
    try {
      const { data } = await $axios.get(`/api/v1/hr/leave/balance/${employeeId}`)
      return data
    } catch (error: any) {
      console.error('Failed to fetch leave balance')
    }
  }

  // ===== ATTENDANCE METHODS =====
  const fetchAttendance = async (params?: any) => {
    try {
      attendanceLoading.value = true
      const { data } = await $axios.get('/api/v1/hr/attendance', { params })
      attendances.value = data.docs || data
    } catch (error: any) {
      console.error('Failed to fetch attendance')
    } finally {
      attendanceLoading.value = false
    }
  }

  const checkIn = async (employeeId: string) => {
    try {
      const { data } = await $axios.post('/api/v1/hr/attendance/check-in', { employee: employeeId })
      return data
    } catch (error: any) {
      throw error
    }
  }

  const checkOut = async (employeeId: string) => {
    try {
      const { data } = await $axios.post('/api/v1/hr/attendance/check-out', { employee: employeeId })
      return data
    } catch (error: any) {
      throw error
    }
  }

  const getAttendanceStats = async (params?: any) => {
    try {
      const { data } = await $axios.get('/api/v1/hr/attendance/stats/summary', { params })
      return data
    } catch (error: any) {
      console.error('Failed to fetch attendance stats')
    }
  }

  // ===== BONUS METHODS =====
  const fetchBonuses = async (params?: any) => {
    try {
      bonusLoading.value = true
      const { data } = await $axios.get('/api/v1/hr/bonus', { params })
      bonuses.value = data.docs || data
    } catch (error: any) {
      console.error('Failed to fetch bonuses')
    } finally {
      bonusLoading.value = false
    }
  }

  const getBonus = async (id: string) => {
    try {
      bonusLoading.value = true
      const { data } = await $axios.get(`/api/v1/hr/bonus/${id}`)
      return data
    } catch (error: any) {
      console.error('Failed to fetch bonus')
      throw error
    } finally {
      bonusLoading.value = false
    }
  }

  const createBonus = async (bonus: Bonus) => {
    try {
      bonusLoading.value = true
      const { data } = await $axios.post('/api/v1/hr/bonus', bonus)
      bonuses.value.push(data)
      return data
    } catch (error: any) {
      throw error
    } finally {
      bonusLoading.value = false
    }
  }

  const approveBonus = async (id: string) => {
    try {
      const { data } = await $axios.put(`/api/v1/hr/bonus/${id}/approve`)
      return data
    } catch (error: any) {
      throw error
    }
  }

  const getBonusSummary = async (month: string) => {
    try {
      const { data } = await $axios.get('/api/v1/hr/bonus/summary/monthly', { params: { month } })
      return data
    } catch (error: any) {
      console.error('Failed to fetch bonus summary')
    }
  }

  return {
    // Employee
    employees,
    currentEmployee,
    employeeLoading,
    employeeError,
    fetchEmployees,
    getEmployee,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    getEmployeeStats,
    // Contract
    contracts,
    currentContract,
    contractLoading,
    fetchContracts,
    getContract,
    createContract,
    updateContract,
    approveContract,
    renewContract,
    getExpiringContracts,
    // Payroll
    payrolls,
    payrollLoading,
    fetchPayroll,
    getPayroll,
    calculatePayroll,
    approvePayroll,
    markPayrollAsPaid,
    getPayrollSummary,
    // Leave
    leaves,
    leaveLoading,
    fetchLeaves,
    getLeave,
    createLeaveRequest,
    approveLeave,
    rejectLeave,
    getLeaveBalance,
    // Attendance
    attendances,
    attendanceLoading,
    fetchAttendance,
    checkIn,
    checkOut,
    getAttendanceStats,
    // Bonus
    bonuses,
    bonusLoading,
    fetchBonuses,
    getBonus,
    createBonus,
    approveBonus,
    getBonusSummary,
  }
}

