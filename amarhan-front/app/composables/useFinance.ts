import { ref, computed } from 'vue';

interface Income {
  _id: string;
  incomeNumber: string;
  type: 'SALE' | 'SERVICE' | 'RENTAL' | 'INTEREST' | 'DIVIDEND' | 'OTHER';
  amount: number;
  currency: string;
  date: string;
  customer?: any;
  description?: string;
  category?: string;
  taxAmount?: number;
  taxRate?: number;
  paymentStatus: 'PENDING' | 'PAID' | 'PARTIAL' | 'OVERDUE';
  paymentMethod?: string;
  reference?: string;
  createdAt: string;
  updatedAt: string;
}

interface Expense {
  _id: string;
  expenseNumber: string;
  category: 'SUPPLIES' | 'SALARY' | 'RENT' | 'UTILITIES' | 'MARKETING' | 'TRAVEL' | 'MAINTENANCE' | 'INSURANCE' | 'TAX' | 'INTEREST' | 'OTHER';
  amount: number;
  currency: string;
  date: string;
  vendor?: string;
  description?: string;
  paymentMethod: string;
  paymentStatus: 'PENDING' | 'PAID' | 'OVERDUE';
  dueDate?: string;
  taxAmount?: number;
  taxRate?: number;
  receiptNumber?: string;
  reference?: string;
  createdAt: string;
  updatedAt: string;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  amount: number;
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  customer: any;
  issueDate: string;
  dueDate: string;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'PARTIAL' | 'OVERDUE' | 'CANCELLED';
  items: InvoiceItem[];
  subtotal: number;
  taxAmount: number;
  taxRate: number;
  total: number;
  currency: string;
  paidAmount: number;
  notes?: string;
  terms?: string;
  qrCode?: string;
  qrCodeImage?: string;
  paymentLink?: string;
  createdAt: string;
  updatedAt: string;
}

export const useFinance = () => {
  const { $axios } = useNuxtApp()

  // State
  const incomes = ref<Income[]>([]);
  const expenses = ref<Expense[]>([]);
  const invoices = ref<Invoice[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Income methods
  const fetchIncomes = async (filters?: any) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $axios.get('/api/v1/finance/income', { params: filters });
      incomes.value = response.data.data || response.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
    } finally {
      loading.value = false;
    }
  };

  const createIncome = async (incomeData: Partial<Income>) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $axios.post('/api/v1/finance/income', incomeData);
      const newIncome = response.data.data || response.data;
      incomes.value.push(newIncome);
      return newIncome;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const updateIncome = async (id: string, incomeData: Partial<Income>) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $axios.put(`/api/v1/finance/income/${id}`, incomeData);
      const updatedIncome = response.data.data || response.data;
      const index = incomes.value.findIndex(i => i._id === id);
      if (index > -1) {
        incomes.value[index] = updatedIncome;
      }
      return updatedIncome;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const deleteIncome = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      await $axios.delete(`/api/v1/finance/income/${id}`);
      incomes.value = incomes.value.filter(i => i._id !== id);
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // Expense methods
  const fetchExpenses = async (filters?: any) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $axios.get('/api/v1/finance/expense', { params: filters });
      expenses.value = response.data.data || response.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
    } finally {
      loading.value = false;
    }
  };

  const createExpense = async (expenseData: Partial<Expense>) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $axios.post('/api/v1/finance/expense', expenseData);
      const newExpense = response.data.data || response.data;
      expenses.value.push(newExpense);
      return newExpense;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const updateExpense = async (id: string, expenseData: Partial<Expense>) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $axios.put(`/api/v1/finance/expense/${id}`, expenseData);
      const updatedExpense = response.data.data || response.data;
      const index = expenses.value.findIndex(e => e._id === id);
      if (index > -1) {
        expenses.value[index] = updatedExpense;
      }
      return updatedExpense;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const deleteExpense = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      await $axios.delete(`/api/v1/finance/expense/${id}`);
      expenses.value = expenses.value.filter(e => e._id !== id);
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // Invoice methods
  const fetchInvoices = async (filters?: any) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $axios.get('/api/v1/finance/invoice', { params: filters });
      invoices.value = response.data.data || response.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
    } finally {
      loading.value = false;
    }
  };

  const createInvoice = async (invoiceData: Partial<Invoice>) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $axios.post('/api/v1/finance/invoice', invoiceData);
      const newInvoice = response.data.data || response.data;
      invoices.value.push(newInvoice);
      return newInvoice;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const updateInvoice = async (id: string, invoiceData: Partial<Invoice>) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $axios.put(`/api/v1/finance/invoice/${id}`, invoiceData);
      const updatedInvoice = response.data.data || response.data;
      const index = invoices.value.findIndex(inv => inv._id === id);
      if (index > -1) {
        invoices.value[index] = updatedInvoice;
      }
      return updatedInvoice;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const deleteInvoice = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      await $axios.delete(`/api/v1/finance/invoice/${id}`);
      invoices.value = invoices.value.filter(inv => inv._id !== id);
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const recordPayment = async (invoiceId: string, amount: number) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $axios.post(`/api/v1/finance/invoice/${invoiceId}/payment`, { amount });
      const updatedInvoice = response.data.data || response.data;
      const index = invoices.value.findIndex(inv => inv._id === invoiceId);
      if (index > -1) {
        invoices.value[index] = updatedInvoice;
      }
      return updatedInvoice;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const getInvoiceQRCode = async (invoiceId: string) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $axios.get(`/api/v1/finance/invoice/${invoiceId}/qrcode`);
      return response.data.data || response.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // Report methods
  const getFinancialReport = async (startDate?: string, endDate?: string) => {
    loading.value = true;
    error.value = null;
    try {
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const response = await $axios.get('/api/v1/finance/reports/financial', { params });
      return response.data.data || response.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const getIncomeByType = async (startDate?: string, endDate?: string) => {
    loading.value = true;
    error.value = null;
    try {
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const response = await $axios.get('/api/v1/finance/reports/income-by-type', { params });
      return response.data.data || response.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const getExpenseByCategory = async (startDate?: string, endDate?: string) => {
    loading.value = true;
    error.value = null;
    try {
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const response = await $axios.get('/api/v1/finance/reports/expense-by-category', { params });
      return response.data.data || response.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const getPaymentStatus = async (startDate?: string, endDate?: string) => {
    loading.value = true;
    error.value = null;
    try {
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const response = await $axios.get('/api/v1/finance/reports/payment-status', { params });
      return response.data.data || response.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return {
    // State
    incomes,
    expenses,
    invoices,
    loading,
    error,

    // Income methods
    fetchIncomes,
    createIncome,
    updateIncome,
    deleteIncome,

    // Expense methods
    fetchExpenses,
    createExpense,
    updateExpense,
    deleteExpense,

    // Invoice methods
    fetchInvoices,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    recordPayment,
    getInvoiceQRCode,

    // Report methods
    getFinancialReport,
    getIncomeByType,
    getExpenseByCategory,
    getPaymentStatus,
  };
};

