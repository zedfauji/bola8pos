import { useState, useEffect, useCallback } from 'react';
import { 
  productsApi, 
  inventoryApi, 
  categoriesApi,
  locationsApi,
  suppliersApi,
  purchaseOrdersApi 
} from '../services/inventoryService';

export const useProducts = (initialParams = {}) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const fetchProducts = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      const response = await productsApi.getAll({
        page: pagination.page,
        limit: pagination.limit,
        ...params
      });
      
      setProducts(response.data);
      setPagination({
        page: response.page,
        limit: response.limit,
        total: response.total,
        totalPages: response.totalPages,
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch products');
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit]);

  useEffect(() => {
    fetchProducts(initialParams);
  }, [fetchProducts, initialParams]);

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
    pagination,
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
  };
};

export const useInventory = (locationId) => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adjustmentDialog, setAdjustmentDialog] = useState(null);
  const [transferDialog, setTransferDialog] = useState(null);

  const fetchInventory = useCallback(async () => {
    if (!locationId) return;
    
    try {
      setLoading(true);
      const response = await inventoryApi.getByLocation(locationId);
      setInventory(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch inventory');
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

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

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const [flatResponse, treeResponse] = await Promise.all([
        categoriesApi.getAll(),
        categoriesApi.getTree()
      ]);
      
      setCategories(flatResponse.data);
      setCategoryTree(treeResponse.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch categories');
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
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

  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await locationsApi.getAll();
      setLocations(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch locations');
      console.error('Error fetching locations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await suppliersApi.getAll();
      setSuppliers(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch suppliers');
      console.error('Error fetching suppliers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const fetchPurchaseOrders = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      const response = await purchaseOrdersApi.getAll({
        page: pagination.page,
        limit: pagination.limit,
        ...params
      });
      
      setPurchaseOrders(response.data);
      setPagination({
        page: response.page,
        limit: response.limit,
        total: response.total,
        totalPages: response.totalPages,
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch purchase orders');
      console.error('Error fetching purchase orders:', err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit]);

  useEffect(() => {
    fetchPurchaseOrders(initialParams);
  }, [fetchPurchaseOrders, initialParams]);

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
