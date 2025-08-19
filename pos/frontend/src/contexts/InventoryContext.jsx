import React, { createContext, useContext, useReducer, useState, useCallback, useEffect } from 'react';
import { useSnackbar } from 'notistack';
import { handleApiError } from '../utils/errorHandler';
import { useInventory } from '../hooks/useInventory';

// Initial state
const initialState = {
  products: [],
  categories: [],
  suppliers: [],
  locations: [],
  purchaseOrders: [],
  inventory: [],
  selectedProduct: null,
  selectedCategory: null,
  selectedSupplier: null,
  selectedLocation: null,
  selectedOrder: null,
  loading: false,
  error: null,
  filters: {
    search: '',
    category: 'all',
    status: 'all',
    location: 'all',
    supplier: 'all',
    dateRange: {
      start: null,
      end: null,
    },
  },
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  },
};

// Action types
const actionTypes = {
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_PRODUCTS: 'SET_PRODUCTS',
  SET_CATEGORIES: 'SET_CATEGORIES',
  SET_SUPPLIERS: 'SET_SUPPLIERS',
  SET_LOCATIONS: 'SET_LOCATIONS',
  SET_INVENTORY: 'SET_INVENTORY',
  SET_PURCHASE_ORDERS: 'SET_PURCHASE_ORDERS',
  SET_SELECTED_ITEM: 'SET_SELECTED_ITEM',
  SET_FILTERS: 'SET_FILTERS',
  SET_PAGINATION: 'SET_PAGINATION',
  RESET_STATE: 'RESET_STATE',
};

// Reducer function
const inventoryReducer = (state, action) => {
  switch (action.type) {
    case actionTypes.SET_LOADING:
      return { ...state, loading: action.payload };
    
    case actionTypes.SET_ERROR:
      return { ...state, error: action.payload, loading: false };
    
    case actionTypes.SET_PRODUCTS:
      return { ...state, products: action.payload, loading: false };
    
    case actionTypes.SET_CATEGORIES:
      return { ...state, categories: action.payload, loading: false };
    
    case actionTypes.SET_SUPPLIERS:
      return { ...state, suppliers: action.payload, loading: false };
    
    case actionTypes.SET_LOCATIONS:
      return { ...state, locations: action.payload, loading: false };
    
    case actionTypes.SET_INVENTORY:
      return { ...state, inventory: action.payload, loading: false };
    
    case actionTypes.SET_PURCHASE_ORDERS:
      return { ...state, purchaseOrders: action.payload, loading: false };
    
    case actionTypes.SET_SELECTED_ITEM:
      return {
        ...state,
        [`selected${action.payload.type}`]: action.payload.data,
        loading: false,
      };
    
    case actionTypes.SET_FILTERS:
      return {
        ...state,
        filters: { ...state.filters, ...action.payload },
        pagination: { ...state.pagination, page: 1 }, // Reset to first page on filter change
      };
    
    case actionTypes.SET_PAGINATION:
      return {
        ...state,
        pagination: { ...state.pagination, ...action.payload },
      };
    
    case actionTypes.RESET_STATE:
      return { ...initialState };
    
    default:
      return state;
  }
};

// Create context
const InventoryContext = createContext();

// Provider component
export const InventoryProvider = ({ children }) => {
  const [state, dispatch] = useReducer(inventoryReducer, initialState);
  const { enqueueSnackbar } = useSnackbar();
  const {
    products,
    loading: productsLoading,
    error: productsError,
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    categories,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    suppliers,
    fetchSuppliers,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    locations,
    fetchLocations,
    inventory,
    fetchInventory,
    adjustInventory,
    transferInventory,
    purchaseOrders,
    fetchPurchaseOrders,
    createPurchaseOrder,
    updatePurchaseOrderStatus,
    receivePurchaseOrderItems,
  } = useInventory();

  // Set loading state
  const setLoading = (isLoading) => {
    dispatch({ type: actionTypes.SET_LOADING, payload: isLoading });
  };

  // Set error state
  const setError = (error) => {
    const errorMessage = error?.message || 'An error occurred';
    dispatch({ type: actionTypes.SET_ERROR, payload: errorMessage });
    enqueueSnackbar(errorMessage, { variant: 'error' });
  };

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        await Promise.all([
          fetchCategories(),
          fetchSuppliers(),
          fetchLocations(),
        ]);
      } catch (error) {
        setError(error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Update state when data changes
  useEffect(() => {
    if (categories) {
      dispatch({ type: actionTypes.SET_CATEGORIES, payload: categories });
    }
  }, [categories]);

  useEffect(() => {
    if (suppliers) {
      dispatch({ type: actionTypes.SET_SUPPLIERS, payload: suppliers });
    }
  }, [suppliers]);

  useEffect(() => {
    if (locations) {
      dispatch({ type: actionTypes.SET_LOCATIONS, payload: locations });
    }
  }, [locations]);

  // Product actions
  const loadProducts = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      const { page = 1, limit = 20, ...filters } = params;
      
      await fetchProducts({
        page,
        limit,
        ...filters,
      });
      
      dispatch({
        type: actionTypes.SET_PAGINATION,
        payload: {
          page,
          limit,
          // total and totalPages will be updated by the hook
        },
      });
    } catch (error) {
      const handledError = handleApiError(error, 'Failed to load products');
      setError(handledError);
    }
  }, [fetchProducts]);

  const addProduct = async (productData) => {
    try {
      setLoading(true);
      const newProduct = await createProduct(productData);
      enqueueSnackbar('Product created successfully', { variant: 'success' });
      await loadProducts();
      return newProduct;
    } catch (error) {
      const handledError = handleApiError(error, 'Failed to create product');
      setError(handledError);
      throw handledError;
    } finally {
      setLoading(false);
    }
  };

  const editProduct = async (id, productData) => {
    try {
      setLoading(true);
      const updatedProduct = await updateProduct(id, productData);
      enqueueSnackbar('Product updated successfully', { variant: 'success' });
      await loadProducts();
      return updatedProduct;
    } catch (error) {
      const handledError = handleApiError(error, 'Failed to update product');
      setError(handledError);
      throw handledError;
    } finally {
      setLoading(false);
    }
  };

  const removeProduct = async (id) => {
    try {
      setLoading(true);
      await deleteProduct(id);
      enqueueSnackbar('Product deleted successfully', { variant: 'success' });
      await loadProducts();
    } catch (error) {
      const handledError = handleApiError(error, 'Failed to delete product');
      setError(handledError);
      throw handledError;
    } finally {
      setLoading(false);
    }
  };

  // Category actions
  const loadCategories = async () => {
    try {
      setLoading(true);
      await fetchCategories();
    } catch (error) {
      setError(error);
    } finally {
      setLoading(false);
    }
  };

  const addCategory = async (categoryData) => {
    try {
      setLoading(true);
      const newCategory = await createCategory(categoryData);
      enqueueSnackbar('Category added successfully', { variant: 'success' });
      await loadCategories();
      return newCategory;
    } catch (error) {
      const handledError = handleApiError(error, 'Failed to add category');
      setError(handledError);
      throw handledError;
    } finally {
      setLoading(false);
    }
  };

  // Supplier actions
  const loadSuppliers = async () => {
    try {
      setLoading(true);
      await fetchSuppliers();
    } catch (error) {
      setError(error);
    } finally {
      setLoading(false);
    }
  };

  const addSupplier = async (supplierData) => {
    try {
      setLoading(true);
      const newSupplier = await createSupplier(supplierData);
      enqueueSnackbar('Supplier added successfully', { variant: 'success' });
      await loadSuppliers();
      return newSupplier;
    } catch (error) {
      const handledError = handleApiError(error, 'Failed to add supplier');
      setError(handledError);
      throw handledError;
    } finally {
      setLoading(false);
    }
  };

  // Location actions
  const loadLocations = async () => {
    try {
      setLoading(true);
      await fetchLocations();
    } catch (error) {
      setError(error);
    } finally {
      setLoading(false);
    }
  };

  // Inventory actions
  const loadInventory = async (locationId) => {
    try {
      setLoading(true);
      await fetchInventory(locationId);
    } catch (error) {
      setError(error);
    } finally {
      setLoading(false);
    }
  };

  // Purchase Order actions
  const loadPurchaseOrders = async (params = {}) => {
    try {
      setLoading(true);
      await fetchPurchaseOrders(params);
    } catch (error) {
      setError(error);
    } finally {
      setLoading(false);
    }
  };

  // Context value
  const value = {
    ...state,
    setLoading,
    setError,
    
    // Products
    loadProducts,
    addProduct,
    editProduct,
    removeProduct,
    
    // Categories
    loadCategories,
    addCategory,
    
    // Suppliers
    loadSuppliers,
    addSupplier,
    
    // Locations
    loadLocations,
    
    // Inventory
    loadInventory,
    adjustInventory,
    transferInventory,
    
    // Purchase Orders
    loadPurchaseOrders,
    createPurchaseOrder,
    updatePurchaseOrderStatus,
    receivePurchaseOrderItems,
    
    // Utility
    setFilters: (filters) => dispatch({ type: actionTypes.SET_FILTERS, payload: filters }),
    setPagination: (pagination) => dispatch({ type: actionTypes.SET_PAGINATION, payload: pagination }),
    setSelectedItem: (type, data) => dispatch({ 
      type: actionTypes.SET_SELECTED_ITEM, 
      payload: { type, data } 
    }),
    resetState: () => dispatch({ type: actionTypes.RESET_STATE }),
  };

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
};

// Custom hook to use inventory context
export const useInventoryContext = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventoryContext must be used within an InventoryProvider');
  }
  return context;
};

// Export the provider component as default for backward compatibility
export default InventoryContext.Provider;

// Also export the context itself for direct usage
export { InventoryContext };
