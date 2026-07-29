import { ref, computed } from 'vue';

interface Category {
  _id: string;
  name: string;
  code: string;
  type: 'PRODUCT' | 'RAW_MATERIAL' | 'FINISHED_GOOD' | 'OTHER';
  description?: string;
  isActive: boolean;
}

interface Warehouse {
  _id: string;
  name: string;
  code: string;
  location?: {
    address?: string;
    city?: string;
    province?: string;
  };
  isActive: boolean;
}

interface Item {
  _id: string;
  name: string;
  code: string;
  barcode?: string;
  category: string;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  taxRate?: number;
  reorderPoint?: number;
  supplier?: string;
  isActive: boolean;
}

interface Stock {
  _id: string;
  item: Item;
  warehouse: Warehouse;
  quantity: number;
}

interface StockMovement {
  _id: string;
  item: string;
  warehouse: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'RETURN';
  quantity: number;
  reason: string;
  reference?: string;
  notes?: string;
  createdAt: string;
}

interface Supplier {
  _id: string;
  name: string;
  code: string;
  email?: string;
  phone?: string;
  isActive: boolean;
}

export const useInventory = () => {
  const $axios = useNuxtApp().$axios;

  // State
  const categories = ref<Category[]>([]);
  const warehouses = ref<Warehouse[]>([]);
  const items = ref<Item[]>([]);
  const stocks = ref<Stock[]>([]);
  const suppliers = ref<Supplier[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Category methods
  const fetchCategories = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $axios.get('/api/v1/inventory/categories');
      // API returns { message: '...', data: [...] }
      const responseData = response.data;
      
      if (responseData && Array.isArray(responseData.data)) {
        categories.value = responseData.data;
        console.log(`Loaded ${responseData.data.length} categories`);
      } else if (Array.isArray(responseData)) {
        categories.value = responseData;
        console.log(`Loaded ${responseData.length} categories (direct array)`);
      } else {
        categories.value = [];
        console.warn('Unexpected response format:', responseData);
      }
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      console.error('Error fetching categories:', err);
      categories.value = [];
    } finally {
      loading.value = false;
    }
  };

  const createCategory = async (categoryData: Partial<Category>) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $axios.post('/api/v1/inventory/categories', categoryData);
      // API returns { message: '...', data: {...} } }
      const responseData = response.data;
      let category;
      
      if (responseData && responseData.data) {
        category = responseData.data;
      } else if (responseData && !responseData.data && responseData._id) {
        // Direct category object
        category = responseData;
      } else {
        category = responseData;
      }
      
      if (category && category._id) {
        categories.value.push(category);
        console.log('Category created and added to list:', category);
      } else {
        console.warn('Unexpected category response format:', responseData);
        // Still refresh the list
        await fetchCategories();
      }
      
      return category;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      console.error('Error creating category:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const updateCategory = async (id: string, categoryData: Partial<Category>) => {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await $axios.put(`/api/v1/inventory/categories/${id}`, categoryData);
      const category = data.data || data;
      const index = categories.value.findIndex(c => c._id === id);
      if (index > -1) {
        categories.value[index] = category;
      }
      return category;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const deleteCategory = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      await $axios.delete(`/api/v1/inventory/categories/${id}`);
      categories.value = categories.value.filter(c => c._id !== id);
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // Warehouse methods
  const fetchWarehouses = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $axios.get('/api/v1/inventory/warehouses');
      // API returns { message: '...', data: [...] }
      const responseData = response.data;
      
      if (responseData && Array.isArray(responseData.data)) {
        warehouses.value = responseData.data;
        console.log(`Loaded ${responseData.data.length} warehouses`);
      } else if (Array.isArray(responseData)) {
        warehouses.value = responseData;
        console.log(`Loaded ${responseData.length} warehouses (direct array)`);
      } else {
        warehouses.value = [];
        console.warn('Unexpected response format:', responseData);
      }
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      console.error('Error fetching warehouses:', err);
      warehouses.value = [];
    } finally {
      loading.value = false;
    }
  };

  const createWarehouse = async (warehouseData: Partial<Warehouse>) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $axios.post('/api/v1/inventory/warehouses', warehouseData);
      // API returns { message: '...', data: {...} }
      const responseData = response.data;
      let warehouse;
      
      if (responseData && responseData.data) {
        warehouse = responseData.data;
      } else if (responseData && !responseData.data && responseData._id) {
        warehouse = responseData;
      } else {
        warehouse = responseData;
      }
      
      if (warehouse && warehouse._id) {
        warehouses.value.push(warehouse);
        console.log('Warehouse created and added to list:', warehouse);
      } else {
        console.warn('Unexpected warehouse response format:', responseData);
        await fetchWarehouses();
      }
      
      return warehouse;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      console.error('Error creating warehouse:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const updateWarehouse = async (id: string, warehouseData: Partial<Warehouse>) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $axios.put(`/api/v1/inventory/warehouses/${id}`, warehouseData);
      const responseData = response.data;
      const warehouse = responseData.data || responseData;
      
      const index = warehouses.value.findIndex(w => w._id === id);
      if (index > -1) {
        warehouses.value[index] = warehouse;
      }
      return warehouse;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const deleteWarehouse = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      await $axios.delete(`/api/v1/inventory/warehouses/${id}`);
      warehouses.value = warehouses.value.filter(w => w._id !== id);
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // Item methods
  const fetchItems = async (filters?: any) => {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await $axios.get('/api/v1/inventory/items', { params: filters });
      items.value = data.data || data;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
    } finally {
      loading.value = false;
    }
  };

  const createItem = async (itemData: Partial<Item>) => {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await $axios.post('/api/v1/inventory/items', itemData);
      const item = data.data || data;
      items.value.push(item);
      return item;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const updateItem = async (id: string, itemData: Partial<Item>) => {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await $axios.put(`/api/v1/inventory/items/${id}`, itemData);
      const item = data.data || data;
      const index = items.value.findIndex(i => i._id === id);
      if (index > -1) {
        items.value[index] = item;
      }
      return item;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const searchItems = async (searchTerm: string) => {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await $axios.get('/api/v1/inventory/items/search', { params: { q: searchTerm } });
      return data.data || data;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // Stock methods
  const fetchStocks = async (filters?: any) => {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await $axios.get('/api/v1/inventory/stocks', { params: filters });
      stocks.value = data.data || data;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
    } finally {
      loading.value = false;
    }
  };

  const recordStockMovement = async (movementData: Partial<StockMovement>) => {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await $axios.post('/api/v1/inventory/stock/movement', movementData);
      return data.data || data;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // Supplier methods
  const fetchSuppliers = async () => {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await $axios.get('/api/v1/inventory/suppliers');
      suppliers.value = data.data || data;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
    } finally {
      loading.value = false;
    }
  };

  const createSupplier = async (supplierData: Partial<Supplier>) => {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await $axios.post('/api/v1/inventory/suppliers', supplierData);
      const supplier = data.data || data;
      suppliers.value.push(supplier);
      return supplier;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const updateSupplier = async (id: string, supplierData: Partial<Supplier>) => {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await $axios.put(`/api/v1/inventory/suppliers/${id}`, supplierData);
      const supplier = data.data || data;
      const index = suppliers.value.findIndex(s => s._id === id);
      if (index > -1) {
        suppliers.value[index] = supplier;
      }
      return supplier;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const deleteSupplier = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      await $axios.delete(`/api/v1/inventory/suppliers/${id}`);
      suppliers.value = suppliers.value.filter(s => s._id !== id);
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return {
    // State
    categories,
    warehouses,
    items,
    stocks,
    suppliers,
    loading,
    error,

    // Category methods
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,

    // Warehouse methods
    fetchWarehouses,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,

    // Item methods
    fetchItems,
    createItem,
    updateItem,
    searchItems,

    // Stock methods
    fetchStocks,
    recordStockMovement,

    // Supplier methods
    fetchSuppliers,
    createSupplier,
    updateSupplier,
    deleteSupplier,
  };
};

