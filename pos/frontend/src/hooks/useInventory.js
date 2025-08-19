import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  productsApi, 
  inventoryApi, 
  categoriesApi,
  locationsApi,
  suppliersApi,
  purchaseOrdersApi 
} from '../services/inventoryService';
import { isApiEndpointAvailable } from '../utils/apiErrorHandler';

// Debounce utility to prevent excessive API calls
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
};

// Utility for exponential backoff retry
const retryWithBackoff = async (fn, maxRetries = 3, initialDelay = 300) => {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      retries++;
      if (retries >= maxRetries) throw error;
      
      // Calculate delay with exponential backoff
      const delay = initialDelay * Math.pow(2, retries);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

export const useProducts = (initialParams = {}) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiAvailable, setApiAvailable] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  
  // Track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);
  // Track in-flight requests to prevent duplicate calls
  const pendingRequest = useRef(false);

  // Check if API endpoint is available
  useEffect(() => {
    const checkApiAvailability = async () => {
      const isAvailable = await isApiEndpointAvailable(
        productsApi.getAll,
        initialParams
      );
      setApiAvailable(isAvailable);
      if (!isAvailable) {
        setLoading(false);
      }
    };
    checkApiAvailability();
  }, [initialParams]);

  const fetchProducts = useCallback(async (params = {}) => {
    if (!apiAvailable || pendingRequest.current) {
      if (!apiAvailable) {
        setProducts([]);
        setLoading(false);
      }
      return;
    }
    
    try {
      pendingRequest.current = true;
      setLoading(true);
      const paginationParams = {
        page: pagination?.page || 1,
        limit: pagination?.limit || 20,
        ...params
      };
      
      // Use retry with backoff for resilience
      const response = await retryWithBackoff(
        () => productsApi.getAll(paginationParams),
        3,  // max retries
        300 // initial delay in ms
      );
      
      if (isMounted.current) {
        setProducts(response?.data || []);
        setPagination({
          page: response?.page || 1,
          limit: response?.limit || 20,
          total: response?.total || 0,
          totalPages: response?.totalPages || 1,
        });
        setError(null);
      }
    } catch (err) {
      // Error is already handled by the createSafeApiCall wrapper
      if (isMounted.current) {
        setError(err);
        setProducts([]);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
      // Add a small delay before allowing new requests
      setTimeout(() => {
        pendingRequest.current = false;
      }, 1000);
    }
  }, [apiAvailable, pagination?.page, pagination?.limit]);

  // Debounce the initialParams to prevent excessive API calls when they change rapidly
  const debouncedParams = useDebounce(initialParams, 300);
  
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  useEffect(() => {
    if (!pendingRequest.current) {
      fetchProducts(debouncedParams);
    }
  }, [fetchProducts, debouncedParams]);

  const createProduct = async (productData) => {
    try {
      setLoading(true);
      const response = await productsApi.create(productData);
      await fetchProducts();
      return { success: true, data: response.data };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to create product';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const updateProduct = async (id, productData) => {
    try {
      setLoading(true);
      const response = await productsApi.update(id, productData);
      await fetchProducts();
      return { success: true, data: response.data };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to update product';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const deleteProduct = async (id) => {
    try {
      setLoading(true);
      await productsApi.delete(id);
      await fetchProducts();
      return { success: true };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to delete product';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  return {
    products,
    loading,
    error,
    pagination: pagination || { page: 1, limit: 20, total: 0, totalPages: 1 },
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
  };
};

export const useInventoryByLocation = (locationId) => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adjustmentDialog, setAdjustmentDialog] = useState(null);
  const [transferDialog, setTransferDialog] = useState(null);
  const [apiAvailable, setApiAvailable] = useState(true);

  // Check if API endpoint is available
  useEffect(() => {
    const checkApiAvailability = async () => {
      const isAvailable = await isApiEndpointAvailable(
        inventoryApi.getByLocation,
        locationId
      );
      setApiAvailable(isAvailable);
      if (!isAvailable) {
        setLoading(false);
      }
    };
    checkApiAvailability();
  }, [locationId]);

  const fetchInventory = useCallback(async () => {
    if (!apiAvailable) {
      setInventory([]);
      setLoading(false);
      return;
    }
    
    if (!locationId) return;
    
    try {
      setLoading(true);
      const response = await inventoryApi.getByLocation(locationId);
      setInventory(response.data || []);
      setError(null);
    } catch (err) {
      // Error is already handled by the createSafeApiCall wrapper
      setError(err);
      setInventory([]);
    } finally {
      setLoading(false);
    }
  }, [locationId, apiAvailable]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const adjustInventory = async (itemId, adjustmentData) => {
    try {
      setLoading(true);
      await inventoryApi.adjust({
        itemId,
        locationId,
        ...adjustmentData
      });
      await fetchInventory();
      return { success: true };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to adjust inventory';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const transferInventory = async (transferData) => {
    try {
      setLoading(true);
      await inventoryApi.transfer({
        ...transferData,
        fromLocationId: locationId
      });
      await fetchInventory();
      return { success: true };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to transfer inventory';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const showAdjustmentDialog = (item) => {
    setAdjustmentDialog({
      item,
      open: true,
      onClose: () => setAdjustmentDialog(null),
      onSubmit: async (data) => {
        await adjustInventory(item.id, data);
        setAdjustmentDialog(null);
      }
    });
  };

  const showTransferDialog = (item) => {
    setTransferDialog({
      item,
      open: true,
      onClose: () => setTransferDialog(null),
      onSubmit: async (data) => {
        await transferInventory({
          itemId: item.id,
          toLocationId: data.toLocationId,
          quantity: data.quantity,
          notes: data.notes
        });
        setTransferDialog(null);
      }
    });
  };

  return {
    inventory,
    loading,
    error,
    adjustmentDialog,
    transferDialog,
    fetchInventory,
    adjustInventory,
    transferInventory,
    showAdjustmentDialog,
    showTransferDialog,
  };
};

export const useCategories = () => {
  const [categories, setCategories] = useState([]);
  const [categoryTree, setCategoryTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiAvailable, setApiAvailable] = useState(true);
  
  // Track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);
  // Track in-flight requests to prevent duplicate calls
  const pendingRequest = useRef(false);

  // Check if API endpoint is available
  useEffect(() => {
    const checkApiAvailability = async () => {
      const isAvailable = await isApiEndpointAvailable(
        categoriesApi.getAll
      );
      setApiAvailable(isAvailable);
      if (!isAvailable) {
        setLoading(false);
      }
    };
    checkApiAvailability();
  }, []);

  const fetchCategories = useCallback(async () => {
    if (!apiAvailable || pendingRequest.current) {
      if (!apiAvailable) {
        setCategories([]);
        setCategoryTree([]);
        setLoading(false);
      }
      return;
    }
    
    try {
      pendingRequest.current = true;
      setLoading(true);
      
      // Use retry with backoff for resilience
      const [flatResponse, treeResponse] = await Promise.all([
        retryWithBackoff(() => categoriesApi.getAll(), 3, 300),
        retryWithBackoff(() => categoriesApi.getTree(), 3, 300)
      ]);
      
      if (isMounted.current) {
        setCategories(flatResponse.data || []);
        setCategoryTree(treeResponse.data || []);
        setError(null);
      }
    } catch (err) {
      // Error is already handled by the createSafeApiCall wrapper
      if (isMounted.current) {
        setError(err);
        setCategories([]);
        setCategoryTree([]);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
      // Add a small delay before allowing new requests
      setTimeout(() => {
        pendingRequest.current = false;
      }, 1000);
    }
  }, [apiAvailable]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  useEffect(() => {
    if (!pendingRequest.current) {
      fetchCategories();
    }
  }, [fetchCategories]);

  const createCategory = async (categoryData) => {
    try {
      setLoading(true);
      await categoriesApi.create(categoryData);
      await fetchCategories();
      return { success: true };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to create category';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const updateCategory = async (id, categoryData) => {
    try {
      setLoading(true);
      await categoriesApi.update(id, categoryData);
      await fetchCategories();
      return { success: true };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to update category';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const deleteCategory = async (id) => {
    try {
      setLoading(true);
      await categoriesApi.delete(id);
      await fetchCategories();
      return { success: true };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to delete category';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  return {
    categories,
    categoryTree,
    loading,
    error,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  };
};

export const useLocations = () => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiAvailable, setApiAvailable] = useState(true);

  // Check if API endpoint is available
  useEffect(() => {
    const checkApiAvailability = async () => {
      const isAvailable = await isApiEndpointAvailable(
        locationsApi.getAll
      );
      setApiAvailable(isAvailable);
      if (!isAvailable) {
        setLoading(false);
      }
    };
    checkApiAvailability();
  }, []);

  const fetchLocations = useCallback(async () => {
    if (!apiAvailable) {
      setLocations([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const response = await locationsApi.getAll();
      setLocations(response.data || []);
      setError(null);
    } catch (err) {
      // Error is already handled by the createSafeApiCall wrapper
      setError(err);
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const createLocation = async (locationData) => {
    try {
      setLoading(true);
      await locationsApi.create(locationData);
      await fetchLocations();
      return { success: true };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to create location';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const updateLocation = async (id, locationData) => {
    try {
      setLoading(true);
      await locationsApi.update(id, locationData);
      await fetchLocations();
      return { success: true };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to update location';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const deleteLocation = async (id) => {
    try {
      setLoading(true);
      await locationsApi.delete(id);
      await fetchLocations();
      return { success: true };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to delete location';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  return {
    locations,
    loading,
    error,
    fetchLocations,
    createLocation,
    updateLocation,
    deleteLocation,
  };
};

export const useSuppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiAvailable, setApiAvailable] = useState(true);

  // Check if API endpoint is available
  useEffect(() => {
    const checkApiAvailability = async () => {
      const isAvailable = await isApiEndpointAvailable(
        suppliersApi.getAll
      );
      setApiAvailable(isAvailable);
      if (!isAvailable) {
        setLoading(false);
      }
    };
    checkApiAvailability();
  }, []);

  const fetchSuppliers = useCallback(async () => {
    if (!apiAvailable) {
      setSuppliers([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const response = await suppliersApi.getAll();
      setSuppliers(response.data || []);
      setError(null);
    } catch (err) {
      // Error is already handled by the createSafeApiCall wrapper
      setError(err);
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const searchSuppliers = async (query) => {
    try {
      setLoading(true);
      const response = await suppliersApi.search(query);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to search suppliers');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const createSupplier = async (supplierData) => {
    try {
      setLoading(true);
      await suppliersApi.create(supplierData);
      await fetchSuppliers();
      return { success: true };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to create supplier';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const updateSupplier = async (id, supplierData) => {
    try {
      setLoading(true);
      await suppliersApi.update(id, supplierData);
      await fetchSuppliers();
      return { success: true };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to update supplier';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const deleteSupplier = async (id) => {
    try {
      setLoading(true);
      await suppliersApi.delete(id);
      await fetchSuppliers();
      return { success: true };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to delete supplier';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  return {
    suppliers,
    loading,
    error,
    fetchSuppliers,
    searchSuppliers,
    createSupplier,
    updateSupplier,
    deleteSupplier,
  };
};

export const usePurchaseOrders = (initialParams = {}) => {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  
  // Track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);
  // Track in-flight requests to prevent duplicate calls
  const pendingRequest = useRef(false);

  const fetchPurchaseOrders = useCallback(async (params = {}) => {
    if (pendingRequest.current) {
      return;
    }
    
    try {
      pendingRequest.current = true;
      setLoading(true);
      
      // Use retry with backoff for resilience
      const response = await retryWithBackoff(
        () => purchaseOrdersApi.getAll({
          page: pagination.page,
          limit: pagination.limit,
          ...params
        }),
        3,  // max retries
        300 // initial delay in ms
      );
      
      if (isMounted.current) {
        setPurchaseOrders(response.data || []);
        setPagination({
          page: response.page || 1,
          limit: response.limit || 20,
          total: response.total || 0,
          totalPages: response.totalPages || 1,
        });
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err.response?.data?.error || 'Failed to fetch purchase orders');
        console.error('Error fetching purchase orders:', err);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
      // Add a small delay before allowing new requests
      setTimeout(() => {
        pendingRequest.current = false;
      }, 1000);
    }
  }, [pagination.page, pagination.limit]);

  // Debounce the initialParams to prevent excessive API calls when they change rapidly
  const debouncedParams = useDebounce(initialParams, 300);
  
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  useEffect(() => {
    if (!pendingRequest.current) {
      fetchPurchaseOrders(debouncedParams);
    }
  }, [fetchPurchaseOrders, debouncedParams]);

  const createPurchaseOrder = async (poData) => {
    try {
      setLoading(true);
      const response = await purchaseOrdersApi.create(poData);
      await fetchPurchaseOrders();
      return { success: true, data: response.data };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to create purchase order';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const updatePurchaseOrderStatus = async (id, status) => {
    try {
      setLoading(true);
      await purchaseOrdersApi.updateStatus(id, status);
      await fetchPurchaseOrders();
      return { success: true };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to update purchase order status';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const receivePurchaseOrderItems = async (id, items, locationId, notes = '') => {
    try {
      setLoading(true);
      await purchaseOrdersApi.receiveItems(id, {
        items,
        location_id: locationId,
        notes
      });
      await fetchPurchaseOrders();
      return { success: true };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to receive items';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  return {
    purchaseOrders,
    loading,
    error,
    pagination,
    fetchPurchaseOrders,
    createPurchaseOrder,
    updatePurchaseOrderStatus,
    receivePurchaseOrderItems,
  };
};

/**
 * Combined hook that provides all inventory functionality
 * This is used by the InventoryContext
 */
export const useInventory = () => {
  // Use all the individual hooks
  const productsHook = useProducts();
  const categoriesHook = useCategories();
  const suppliersHook = useSuppliers();
  const locationsHook = useLocations();
  const purchaseOrdersHook = usePurchaseOrders();
  
  // Return a combined object with all the hooks' properties and methods
  return {
    // Products
    products: productsHook.products,
    loadProducts: productsHook.fetchProducts,
    fetchProducts: productsHook.fetchProducts,
    createProduct: productsHook.createProduct,
    updateProduct: productsHook.updateProduct,
    deleteProduct: productsHook.deleteProduct,
    
    // Categories
    categories: categoriesHook.categories,
    categoryTree: categoriesHook.categoryTree,
    fetchCategories: categoriesHook.fetchCategories,
    createCategory: categoriesHook.createCategory,
    updateCategory: categoriesHook.updateCategory,
    deleteCategory: categoriesHook.deleteCategory,
    
    // Suppliers
    suppliers: suppliersHook.suppliers,
    fetchSuppliers: suppliersHook.fetchSuppliers,
    searchSuppliers: suppliersHook.searchSuppliers,
    createSupplier: suppliersHook.createSupplier,
    updateSupplier: suppliersHook.updateSupplier,
    deleteSupplier: suppliersHook.deleteSupplier,
    
    // Locations
    locations: locationsHook.locations,
    fetchLocations: locationsHook.fetchLocations,
    createLocation: locationsHook.createLocation,
    updateLocation: locationsHook.updateLocation,
    deleteLocation: locationsHook.deleteLocation,
    
    // Purchase Orders
    purchaseOrders: purchaseOrdersHook.purchaseOrders,
    fetchPurchaseOrders: purchaseOrdersHook.fetchPurchaseOrders,
    createPurchaseOrder: purchaseOrdersHook.createPurchaseOrder,
    updatePurchaseOrderStatus: purchaseOrdersHook.updatePurchaseOrderStatus,
    receivePurchaseOrderItems: purchaseOrdersHook.receivePurchaseOrderItems,
    
    // Inventory - using default location for now
    // In a real implementation, we would get the default location from user preferences or context
    inventory: [],
    fetchInventory: (locationId) => {
      if (!locationId) return Promise.resolve([]);
      return inventoryApi.getByLocation(locationId).then(res => res.data || []);
    },
    adjustInventory: (adjustmentData) => {
      if (!adjustmentData) return Promise.resolve({ success: false });
      return inventoryApi.adjust(adjustmentData).then(res => res.data || { success: true });
    },
    transferInventory: (transferData) => {
      if (!transferData) return Promise.resolve({ success: false });
      return inventoryApi.transfer(transferData).then(res => res.data || { success: true });
    },
    getLowStock: (threshold) => {
      return inventoryApi.getLowStock(threshold).then(res => res.data || []);
    },
    getInventorySnapshot: () => {
      return inventoryApi.getSnapshot().then(res => res.data || {});
    },
    
    // Loading and error states
    loading: productsHook.loading || categoriesHook.loading || suppliersHook.loading || 
             locationsHook.loading || purchaseOrdersHook.loading,
    error: productsHook.error || categoriesHook.error || suppliersHook.error || 
           locationsHook.error || purchaseOrdersHook.error,
  };
};

// Default export for backward compatibility
export default useInventory;
