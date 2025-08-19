import { useState, useEffect, useCallback } from 'react';
import inventoryService from '../services/inventoryService';
import { isApiEndpointAvailable } from '../utils/apiErrorHandler';

// Type definitions
interface Pagination {
  page: number;
  limit: number;
  total?: number;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  price?: number;
  cost?: number;
  sku?: string;
  barcode?: string;
  category_id?: string;
  [key: string]: any;
}

interface Category {
  id: string;
  name: string;
  parent_id?: string | null;
  description?: string;
  [key: string]: any;
}

interface Location {
  id: string;
  name: string;
  description?: string;
  [key: string]: any;
}

interface Supplier {
  id: string;
  name: string;
  contact?: string;
  email?: string;
  phone?: string;
  address?: string;
  [key: string]: any;
}

interface PurchaseOrder {
  id: string;
  supplier_id: string;
  status: string;
  order_date: string;
  expected_date?: string;
  items?: Array<any>;
  [key: string]: any;
}

interface InventoryItem {
  id: string;
  product_id: string;
  location_id: string;
  quantity: number;
  [key: string]: any;
}

interface InventoryAdjustment {
  item_id: string;
  quantity: number;
  reason?: string;
  [key: string]: any;
}

interface InventoryTransfer {
  product_id: string;
  from_location_id: string;
  to_location_id: string;
  quantity: number;
  [key: string]: any;
}

interface ApiParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  [key: string]: any;
}

/**
 * Hook for managing products
 */
export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0
  });
  const [apiAvailable, setApiAvailable] = useState<boolean>(true);

  // Check if API endpoint is available
  useEffect(() => {
    const checkApiAvailability = async () => {
      const isAvailable = await isApiEndpointAvailable(inventoryService.productsApi.getAll);
      setApiAvailable(isAvailable);
      if (!isAvailable) setLoading(false);
    };
    checkApiAvailability();
  }, []);

  // Fetch products with pagination
  const fetchProducts = useCallback(async (params: ApiParams = {}) => {
    if (!apiAvailable) return;
    
    setLoading(true);
    try {
      const response = await inventoryService.productsApi.getAll({
        page: pagination.page,
        limit: pagination.limit,
        ...params
      });
      
      setProducts(response.data || []);
      if (response.meta?.pagination) {
        setPagination(prev => ({
          ...prev,
          total: response.meta.pagination.total || 0
        }));
      }
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, apiAvailable]);

  // Create a new product
  const createProduct = useCallback(async (productData: Partial<Product>) => {
    if (!apiAvailable) return null;
    
    setLoading(true);
    try {
      const response = await inventoryService.productsApi.create(productData);
      setProducts(prev => [...prev, response.data]);
      setError(null);
      return response.data;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  // Update a product
  const updateProduct = useCallback(async (id: string, productData: Partial<Product>) => {
    if (!apiAvailable) return null;
    
    setLoading(true);
    try {
      const response = await inventoryService.productsApi.update(id, productData);
      setProducts(prev => 
        prev.map(product => product.id === id ? { ...product, ...response.data } : product)
      );
      setError(null);
      return response.data;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  // Delete a product
  const deleteProduct = useCallback(async (id: string) => {
    if (!apiAvailable) return false;
    
    setLoading(true);
    try {
      await inventoryService.productsApi.delete(id);
      setProducts(prev => prev.filter(product => product.id !== id));
      setError(null);
      return true;
    } catch (err) {
      setError(err as Error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  // Get inventory levels for a specific location
  const getInventoryByLocation = useCallback(async (locationId: string) => {
    if (!apiAvailable) return [];
    
    setLoading(true);
    try {
      const response = await inventoryService.inventoryApi.getByLocation(locationId);
      setError(null);
      return response.data || [];
    } catch (err) {
      setError(err as Error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  // Get low stock items
  const getLowStockItems = useCallback(async () => {
    if (!apiAvailable) return [];
    
    setLoading(true);
    try {
      const response = await inventoryService.inventoryApi.getLowStock();
      setError(null);
      return response.data || [];
    } catch (err) {
      setError(err as Error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  // Adjust inventory
  const adjustInventory = useCallback(async (itemId: string, adjustmentData: InventoryAdjustment) => {
    if (!apiAvailable) return null;
    
    setLoading(true);
    try {
      const response = await inventoryService.inventoryApi.adjust(itemId, adjustmentData);
      setError(null);
      return response.data;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  // Transfer inventory between locations
  const transferInventory = useCallback(async (transferData: InventoryTransfer) => {
    if (!apiAvailable) return null;
    
    setLoading(true);
    try {
      const response = await inventoryService.inventoryApi.transfer(transferData);
      setError(null);
      return response.data;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  // Get a single product
  const getProduct = useCallback(async (id: string) => {
    if (!apiAvailable) return null;
    
    setLoading(true);
    try {
      const response = await inventoryService.productsApi.getById(id);
      setError(null);
      return response.data;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  return {
    products,
    loading,
    error,
    pagination,
    apiAvailable,
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    getProduct,
    getInventoryByLocation,
    getLowStockItems,
    adjustInventory,
    transferInventory,
    setPagination
  };
};

/**
 * Hook for managing categories
 */
export const useCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryTree, setCategoryTree] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [apiAvailable, setApiAvailable] = useState<boolean>(true);

  // Check if API endpoint is available
  useEffect(() => {
    const checkApiAvailability = async () => {
      const isAvailable = await isApiEndpointAvailable(inventoryService.categoriesApi.getAll);
      setApiAvailable(isAvailable);
      if (!isAvailable) setLoading(false);
    };
    checkApiAvailability();
  }, []);

  // Fetch all categories
  const fetchCategories = useCallback(async () => {
    if (!apiAvailable) return;
    
    setLoading(true);
    try {
      const response = await inventoryService.categoriesApi.getAll();
      setCategories(response.data || []);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  // Fetch category tree
  const fetchCategoryTree = useCallback(async () => {
    if (!apiAvailable) return;
    
    setLoading(true);
    try {
      const response = await inventoryService.categoriesApi.getTree();
      setCategoryTree(response.data || []);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  // Create a new category
  const createCategory = useCallback(async (categoryData: Partial<Category>) => {
    if (!apiAvailable) return null;
    
    setLoading(true);
    try {
      const response = await inventoryService.categoriesApi.create(categoryData);
      setCategories(prev => [...prev, response.data]);
      setError(null);
      return response.data;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  // Update a category
  const updateCategory = useCallback(async (id: string, categoryData: Partial<Category>) => {
    if (!apiAvailable) return null;
    
    setLoading(true);
    try {
      const response = await inventoryService.categoriesApi.update(id, categoryData);
      setCategories(prev => 
        prev.map(category => category.id === id ? { ...category, ...response.data } : category)
      );
      setError(null);
      return response.data;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  // Delete a category
  const deleteCategory = useCallback(async (id: string) => {
    if (!apiAvailable) return false;
    
    setLoading(true);
    try {
      await inventoryService.categoriesApi.delete(id);
      setCategories(prev => prev.filter(category => category.id !== id));
      setError(null);
      return true;
    } catch (err) {
      setError(err as Error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  return {
    categories,
    categoryTree,
    loading,
    error,
    apiAvailable,
    fetchCategories,
    fetchCategoryTree,
    createCategory,
    updateCategory,
    deleteCategory
  };
};

/**
 * Hook for managing locations
 */
export const useLocations = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [apiAvailable, setApiAvailable] = useState<boolean>(true);

  // Check if API endpoint is available
  useEffect(() => {
    const checkApiAvailability = async () => {
      const isAvailable = await isApiEndpointAvailable(inventoryService.locationsApi.getAll);
      setApiAvailable(isAvailable);
      if (!isAvailable) setLoading(false);
    };
    checkApiAvailability();
  }, []);

  // Fetch all locations
  const fetchLocations = useCallback(async () => {
    if (!apiAvailable) return;
    
    setLoading(true);
    try {
      const response = await inventoryService.locationsApi.getAll();
      setLocations(response.data || []);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  // Create a new location
  const createLocation = useCallback(async (locationData: Partial<Location>) => {
    if (!apiAvailable) return null;
    
    setLoading(true);
    try {
      const response = await inventoryService.locationsApi.create(locationData);
      setLocations(prev => [...prev, response.data]);
      setError(null);
      return response.data;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  // Update a location
  const updateLocation = useCallback(async (id: string, locationData: Partial<Location>) => {
    if (!apiAvailable) return null;
    
    setLoading(true);
    try {
      const response = await inventoryService.locationsApi.update(id, locationData);
      setLocations(prev => 
        prev.map(location => location.id === id ? { ...location, ...response.data } : location)
      );
      setError(null);
      return response.data;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  // Delete a location
  const deleteLocation = useCallback(async (id: string) => {
    if (!apiAvailable) return false;
    
    setLoading(true);
    try {
      await inventoryService.locationsApi.delete(id);
      setLocations(prev => prev.filter(location => location.id !== id));
      setError(null);
      return true;
    } catch (err) {
      setError(err as Error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  return {
    locations,
    loading,
    error,
    apiAvailable,
    fetchLocations,
    createLocation,
    updateLocation,
    deleteLocation
  };
};

/**
 * Hook for managing suppliers
 */
export const useSuppliers = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [apiAvailable, setApiAvailable] = useState<boolean>(true);

  // Check if API endpoint is available
  useEffect(() => {
    const checkApiAvailability = async () => {
      const isAvailable = await isApiEndpointAvailable(inventoryService.suppliersApi.getAll);
      setApiAvailable(isAvailable);
      if (!isAvailable) setLoading(false);
    };
    checkApiAvailability();
  }, []);

  // Fetch all suppliers
  const fetchSuppliers = useCallback(async () => {
    if (!apiAvailable) return;
    
    setLoading(true);
    try {
      const response = await inventoryService.suppliersApi.getAll();
      setSuppliers(response.data || []);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  // Create a new supplier
  const createSupplier = useCallback(async (supplierData: Partial<Supplier>) => {
    if (!apiAvailable) return null;
    
    setLoading(true);
    try {
      const response = await inventoryService.suppliersApi.create(supplierData);
      setSuppliers(prev => [...prev, response.data]);
      setError(null);
      return response.data;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  // Update a supplier
  const updateSupplier = useCallback(async (id: string, supplierData: Partial<Supplier>) => {
    if (!apiAvailable) return null;
    
    setLoading(true);
    try {
      const response = await inventoryService.suppliersApi.update(id, supplierData);
      setSuppliers(prev => 
        prev.map(supplier => supplier.id === id ? { ...supplier, ...response.data } : supplier)
      );
      setError(null);
      return response.data;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  // Delete a supplier
  const deleteSupplier = useCallback(async (id: string) => {
    if (!apiAvailable) return false;
    
    setLoading(true);
    try {
      await inventoryService.suppliersApi.delete(id);
      setSuppliers(prev => prev.filter(supplier => supplier.id !== id));
      setError(null);
      return true;
    } catch (err) {
      setError(err as Error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  return {
    suppliers,
    loading,
    error,
    apiAvailable,
    fetchSuppliers,
    createSupplier,
    updateSupplier,
    deleteSupplier
  };
};

/**
 * Hook for managing purchase orders
 */
export const usePurchaseOrders = () => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [apiAvailable, setApiAvailable] = useState<boolean>(true);

  // Check if API endpoint is available
  useEffect(() => {
    const checkApiAvailability = async () => {
      const isAvailable = await isApiEndpointAvailable(inventoryService.purchaseOrdersApi.getAll);
      setApiAvailable(isAvailable);
      if (!isAvailable) setLoading(false);
    };
    checkApiAvailability();
  }, []);

  // Fetch all purchase orders
  const fetchPurchaseOrders = useCallback(async () => {
    if (!apiAvailable) return;
    
    setLoading(true);
    try {
      const response = await inventoryService.purchaseOrdersApi.getAll();
      setPurchaseOrders(response.data || []);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  // Create a new purchase order
  const createPurchaseOrder = useCallback(async (orderData: Partial<PurchaseOrder>) => {
    if (!apiAvailable) return null;
    
    setLoading(true);
    try {
      const response = await inventoryService.purchaseOrdersApi.create(orderData);
      setPurchaseOrders(prev => [...prev, response.data]);
      setError(null);
      return response.data;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  // Update a purchase order
  const updatePurchaseOrder = useCallback(async (id: string, orderData: Partial<PurchaseOrder>) => {
    if (!apiAvailable) return null;
    
    setLoading(true);
    try {
      const response = await inventoryService.purchaseOrdersApi.update(id, orderData);
      setPurchaseOrders(prev => 
        prev.map(order => order.id === id ? { ...order, ...response.data } : order)
      );
      setError(null);
      return response.data;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  // Delete a purchase order
  const deletePurchaseOrder = useCallback(async (id: string) => {
    if (!apiAvailable) return false;
    
    setLoading(true);
    try {
      await inventoryService.purchaseOrdersApi.delete(id);
      setPurchaseOrders(prev => prev.filter(order => order.id !== id));
      setError(null);
      return true;
    } catch (err) {
      setError(err as Error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  // Get a single purchase order
  const getPurchaseOrder = useCallback(async (id: string) => {
    if (!apiAvailable) return null;
    
    setLoading(true);
    try {
      const response = await inventoryService.purchaseOrdersApi.getById(id);
      setError(null);
      return response.data;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  // Receive a purchase order
  const receivePurchaseOrder = useCallback(async (id: string, receiveData: any) => {
    if (!apiAvailable) return null;
    
    setLoading(true);
    try {
      const response = await inventoryService.purchaseOrdersApi.receive(id, receiveData);
      setPurchaseOrders(prev => 
        prev.map(order => order.id === id ? { ...order, status: 'received', ...response.data } : order)
      );
      setError(null);
      return response.data;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  return {
    purchaseOrders,
    loading,
    error,
    apiAvailable,
    fetchPurchaseOrders,
    createPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder,
    getPurchaseOrder,
    receivePurchaseOrder
  };
};

export default {
  useProducts,
  useCategories,
  useLocations,
  useSuppliers,
  usePurchaseOrders
};
