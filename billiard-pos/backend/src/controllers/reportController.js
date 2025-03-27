const { TableSession, Order, InventoryMovement, Sequelize } = require('../models');

exports.getDailySalesReport = async (req, res) => {
  try {
    const { date } = req.query;
    const reportDate = date ? new Date(date) : new Date();
    
    const startDate = new Date(reportDate.setHours(0, 0, 0, 0));
    const endDate = new Date(reportDate.setHours(23, 59, 59, 999));

    // Get table sessions
    const sessions = await TableSession.findAll({
      where: {
        end_time: {
          [Sequelize.Op.between]: [startDate, endDate]
        }
      },
      order: [['end_time', 'ASC']]
    });

    // Get orders
    const orders = await Order.findAll({
      where: {
        createdAt: {
          [Sequelize.Op.between]: [startDate, endDate]
        }
      },
      include: [OrderItem]
    });

    // Calculate totals
    const tableRevenue = sessions.reduce((sum, session) => sum + session.total_amount, 0);
    const orderRevenue = orders.reduce((sum, order) => sum + order.final_amount, 0);
    const totalRevenue = tableRevenue + orderRevenue;

    res.json({
      date: startDate.toISOString().split('T')[0],
      tableSessions: sessions,
      orders,
      totals: {
        tableRevenue,
        orderRevenue,
        totalRevenue
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getInventoryReport = async (req, res) => {
  try {
    const inventory = await InventoryItem.findAll({
      include: [InventoryMovement],
      order: [['category', 'ASC'], ['name', 'ASC']]
    });

    res.json(inventory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getMemberActivityReport = async (req, res) => {
  try {
    const members = await Member.findAll({
      include: [TableSession],
      order: [['membership_tier', 'DESC'], ['points_balance', 'DESC']]
    });

    res.json(members);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
