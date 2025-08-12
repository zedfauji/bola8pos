import express from 'express';
import { z } from 'zod';
import { db } from '../firebase';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Get sales report by date range
router.get('/sales', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Validate input
    const schema = z.object({
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    });
    
    const { data, error } = schema.safeParse({
      startDate,
      endDate,
    });
    
    if (error) {
      return res.status(400).json({ error: error.errors });
    }
    
    // Build query
    let query = db.collection('orders');
    
    if (data.startDate) {
      query = query.where('createdAt', '>=', new Date(data.startDate));
    }
    
    if (data.endDate) {
      query = query.where('createdAt', '<=', new Date(data.endDate));
    }
    
    const snapshot = await query.get();
    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    // Calculate report data
    const totalSales = orders.reduce((sum, order) => sum + (order.total || 0), 0);
    const totalItems = orders.reduce((sum, order) => {
      return sum + (order.items?.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0) || 0);
    }, 0);
    
    // Group by category
    const salesByCategory = {};
    orders.forEach(order => {
      order.items?.forEach(item => {
        const category = item.category || 'Uncategorized';
        if (!salesByCategory[category]) {
          salesByCategory[category] = 0;
        }
        salesByCategory[category] += (item.price || 0) * (item.quantity || 0);
      });
    });
    
    // Group by hour of day
    const salesByHour = Array(24).fill(0);
    orders.forEach(order => {
      const hour = new Date(order.createdAt?.toDate()).getHours();
      salesByHour[hour] += order.total || 0;
    });
    
    res.json({
      summary: {
        totalSales,
        totalOrders: orders.length,
        totalItems,
        averageOrderValue: orders.length > 0 ? totalSales / orders.length : 0,
      },
      salesByCategory,
      salesByHour,
      orders,
    });
    
  } catch (error) {
    console.error('Error generating sales report:', error);
    res.status(500).json({ error: 'Failed to generate sales report' });
  }
});

// Get inventory report
router.get('/inventory', authenticateToken, async (req, res) => {
  try {
    const { lowStockThreshold = '5' } = req.query;
    const threshold = parseInt(lowStockThreshold, 10) || 5;
    
    // Get all products
    const productsSnapshot = await db.collection('products').get();
    const products = productsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    // Get current inventory levels
    const inventorySnapshot = await db.collection('inventory').get();
    const inventory = {};
    inventorySnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!inventory[data.productId]) {
        inventory[data.productId] = 0;
      }
      inventory[data.productId] += data.quantityAvailable || 0;
    });
    
    // Combine product and inventory data
    const report = products.map(product => ({
      id: product.id,
      name: product.name,
      category: product.category || 'Uncategorized',
      currentStock: inventory[product.id] || 0,
      lowStock: (inventory[product.id] || 0) <= threshold,
      price: product.sellingPrice || 0,
      cost: product.costPrice || 0,
      value: (inventory[product.id] || 0) * (product.costPrice || 0),
    }));
    
    // Calculate summary
    const summary = {
      totalProducts: products.length,
      totalValue: report.reduce((sum, item) => sum + item.value, 0),
      lowStockItems: report.filter(item => item.lowStock).length,
      outOfStockItems: report.filter(item => item.currentStock <= 0).length,
    };
    
    res.json({
      summary,
      products: report,
    });
    
  } catch (error) {
    console.error('Error generating inventory report:', error);
    res.status(500).json({ error: 'Failed to generate inventory report' });
  }
});

// Get employee performance report
router.get('/employee-performance', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build query
    let query = db.collection('orders');
    
    if (startDate) {
      query = query.where('createdAt', '>=', new Date(startDate));
    }
    
    if (endDate) {
      query = query.where('createdAt', '<=', new Date(endDate));
    }
    
    const snapshot = await query.get();
    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    // Group by employee
    const employeeStats = {};
    
    orders.forEach(order => {
      if (!order.employeeId) return;
      
      if (!employeeStats[order.employeeId]) {
        employeeStats[order.employeeId] = {
          employeeId: order.employeeId,
          employeeName: order.employeeName || 'Unknown',
          totalSales: 0,
          orderCount: 0,
          itemsSold: 0,
          averageOrderValue: 0,
        };
      }
      
      employeeStats[order.employeeId].totalSales += order.total || 0;
      employeeStats[order.employeeId].orderCount += 1;
      employeeStats[order.employeeId].itemsSold += order.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
    });
    
    // Calculate averages
    Object.values(employeeStats).forEach(stats => {
      stats.averageOrderValue = stats.orderCount > 0 ? stats.totalSales / stats.orderCount : 0;
    });
    
    res.json({
      summary: {
        totalEmployees: Object.keys(employeeStats).length,
        totalSales: Object.values(employeeStats).reduce((sum, emp) => sum + emp.totalSales, 0),
        totalOrders: Object.values(employeeStats).reduce((sum, emp) => sum + emp.orderCount, 0),
      },
      employees: Object.values(employeeStats).sort((a, b) => b.totalSales - a.totalSales),
    });
    
  } catch (error) {
    console.error('Error generating employee performance report:', error);
    res.status(500).json({ error: 'Failed to generate employee performance report' });
  }
});

export default router;
