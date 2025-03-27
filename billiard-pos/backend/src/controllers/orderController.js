const { Order, OrderItem, InventoryItem, Table, Member } = require('../models');
const { calculateDiscount } = require('../services/billingService');

exports.createOrder = async (req, res) => {
  try {
    const { tableId, memberId, items, notes } = req.body;
    
    const table = await Table.findByPk(tableId);
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Get active session if exists
    let sessionId = null;
    if (table.table_type === 'billiard' && table.status === 'occupied') {
      const session = await table.getTableSessions({
        where: { is_paid: false },
        order: [['createdAt', 'DESC']],
        limit: 1
      });
      if (session.length > 0) {
        sessionId = session[0].id;
      }
    }

    // Create order
    const order = await Order.create({
      table_id: tableId,
      member_id: memberId || null,
      session_id: sessionId,
      employee_id: req.employee.id,
      status: 'pending',
      notes
    });

    // Add order items
    let totalAmount = 0;
    let discountAmount = 0;
    
    for (const item of items) {
      const inventoryItem = await InventoryItem.findByPk(item.itemId);
      if (!inventoryItem) {
        continue;
      }

      // Calculate discount if member exists
      let itemDiscount = 0;
      if (memberId) {
        const member = await Member.findByPk(memberId);
        if (member) {
          itemDiscount = calculateDiscount(member.membership_tier, inventoryItem.category);
        }
      }

      const unitPrice = inventoryItem.unit_price;
      const finalPrice = unitPrice * (1 - itemDiscount);

      await OrderItem.create({
        order_id: order.id,
        item_id: item.itemId,
        quantity: item.quantity,
        unit_price: unitPrice,
        discount_percentage: itemDiscount * 100,
        notes: item.notes
      });

      totalAmount += unitPrice * item.quantity;
      discountAmount += unitPrice * itemDiscount * item.quantity;

      // Update inventory
      await inventoryItem.decrement('current_stock', { by: item.quantity });
    }

    // Update order totals
    await order.update({
      total_amount: totalAmount,
      discount_amount: discountAmount,
      final_amount: totalAmount - discountAmount
    });

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [
        { model: OrderItem, include: [InventoryItem] },
        Table,
        Member
      ]
    });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const { status } = req.body;
    await order.update({ status });
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getTableOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { table_id: req.params.tableId },
      include: [OrderItem],
      order: [['createdAt', 'DESC']]
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
