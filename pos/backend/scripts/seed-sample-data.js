const { pool } = require('../src/db');

async function seedSampleData() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    console.log('🌱 Seeding sample data for reports...');
    
    // Clear existing data
    await conn.query('DELETE FROM order_items');
    await conn.query('DELETE FROM orders');
    await conn.query('DELETE FROM bills');
    await conn.query('DELETE FROM audit_logs WHERE action IN ("void-item", "comp-item")');
    
    // Create sample menu items if they don't exist
    const [menuItems] = await conn.query('SELECT COUNT(*) as count FROM menu_items');
    if (menuItems[0].count === 0) {
      await conn.query(`
        INSERT INTO menu_items (id, name, price, category, description) VALUES
        ('beer_corona', 'Corona Beer', 4.50, 'drinks', 'Cold Corona beer'),
        ('beer_modelo', 'Modelo Beer', 4.75, 'drinks', 'Cold Modelo beer'),
        ('wings_buffalo', 'Buffalo Wings', 12.99, 'food', '8 pieces with buffalo sauce'),
        ('nachos_supreme', 'Supreme Nachos', 9.99, 'food', 'Loaded nachos with cheese'),
        ('cocktail_margarita', 'Margarita', 8.50, 'cocktails', 'Classic lime margarita'),
        ('wine_red', 'House Red Wine', 6.00, 'wine', 'Glass of house red wine')
      `);
    }
    
    // Create sample orders from the past 24 hours
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const sampleOrders = [];
    const sampleBills = [];
    
    // Generate orders throughout the day
    for (let hour = 0; hour < 24; hour++) {
      const orderTime = new Date(yesterday.getTime() + hour * 60 * 60 * 1000);
      const orderTimeStr = orderTime.toISOString().slice(0, 19).replace('T', ' ');
      
      // 2-4 orders per hour during peak times (6pm-11pm), 0-2 during off hours
      const isPeak = hour >= 18 && hour <= 23;
      const orderCount = isPeak ? Math.floor(Math.random() * 3) + 2 : Math.floor(Math.random() * 3);
      
      for (let i = 0; i < orderCount; i++) {
        const orderId = `order_${hour}_${i}_${Date.now()}`;
        const tableId = Math.floor(Math.random() * 8) + 1; // Tables 1-8
        const total = Math.random() * 50 + 10; // $10-60
        
        sampleOrders.push({
          id: orderId,
          table_id: tableId,
          total: total.toFixed(2),
          status: 'completed',
          order_time: orderTimeStr
        });
        
        // Create a bill for each completed order
        const billId = `bill_${hour}_${i}_${Date.now()}`;
        const paymentMethod = Math.random() > 0.6 ? 'card' : 'cash';
        const tip = total * (Math.random() * 0.15 + 0.05); // 5-20% tip
        const billTotal = parseFloat(total) + tip;
        
        sampleBills.push({
          id: billId,
          table_id: tableId,
          subtotal: total,
          tax: (parseFloat(total) * 0.08).toFixed(2),
          tip: tip.toFixed(2),
          total: billTotal.toFixed(2),
          payment_method: paymentMethod,
          tender_cash: paymentMethod === 'cash' ? billTotal.toFixed(2) : '0.00',
          tender_card: paymentMethod === 'card' ? billTotal.toFixed(2) : '0.00',
          created_at: orderTimeStr
        });
      }
    }
    
    // Insert orders
    for (const order of sampleOrders) {
      await conn.query(
        'INSERT INTO orders (id, table_id, total, status, order_time) VALUES (?, ?, ?, ?, ?)',
        [order.id, order.table_id, order.total, order.status, order.order_time]
      );
      
      // Add order items
      const itemCount = Math.floor(Math.random() * 3) + 1; // 1-3 items per order
      for (let j = 0; j < itemCount; j++) {
        const menuItems = ['beer_corona', 'beer_modelo', 'wings_buffalo', 'nachos_supreme', 'cocktail_margarita', 'wine_red'];
        const menuItem = menuItems[Math.floor(Math.random() * menuItems.length)];
        const quantity = Math.floor(Math.random() * 3) + 1;
        const itemPrice = Math.random() * 15 + 3;
        
        await conn.query(
          'INSERT INTO order_items (order_id, menu_item_id, quantity, item_total) VALUES (?, ?, ?, ?)',
          [order.id, menuItem, quantity, (itemPrice * quantity).toFixed(2)]
        );
      }
    }
    
    // Insert bills
    for (const bill of sampleBills) {
      await conn.query(
        'INSERT INTO bills (id, table_id, subtotal, tax, tip, total, payment_method, tender_cash, tender_card, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [bill.id, bill.table_id, bill.subtotal, bill.tax, bill.tip, bill.total, bill.payment_method, bill.tender_cash, bill.tender_card, bill.created_at]
      );
    }
    
    // Add some audit log entries for voids and comps
    const auditEntries = Math.floor(Math.random() * 5) + 2; // 2-6 audit entries
    for (let i = 0; i < auditEntries; i++) {
      const action = Math.random() > 0.5 ? 'void-item' : 'comp-item';
      const auditTime = new Date(yesterday.getTime() + Math.random() * 24 * 60 * 60 * 1000);
      const auditTimeStr = auditTime.toISOString().slice(0, 19).replace('T', ' ');
      
      await conn.query(
        'INSERT INTO audit_logs (action, entity_type, entity_id, ts, details) VALUES (?, ?, ?, ?, ?)',
        [action, 'order_item', Math.floor(Math.random() * 1000), auditTimeStr, JSON.stringify({ reason: 'Sample data' })]
      );
    }
    
    await conn.commit();
    console.log(`✅ Created ${sampleOrders.length} orders, ${sampleBills.length} bills, and ${auditEntries} audit entries`);
    console.log('📊 Reports should now show rich analytics and charts!');
    
  } catch (error) {
    await conn.rollback();
    console.error('❌ Error seeding sample data:', error);
    throw error;
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  seedSampleData()
    .then(() => {
      console.log('🎉 Sample data seeding complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedSampleData };
