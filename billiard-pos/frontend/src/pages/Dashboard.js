import { useEffect, useState } from 'react';
import TableStatus from '../components/tables/TableStatus';
import QuickStats from '../components/dashboard/QuickStats';
import RecentOrders from '../components/orders/RecentOrders';

export default function Dashboard() {
  const [stats, setStats] = useState({
    activeTables: 3,
    dailyRevenue: 5280,
    activeMembers: 12,
    inventoryAlerts: 2
  });

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Billiard POS Dashboard</h1>
      
      <QuickStats stats={stats} />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="md:col-span-2">
          <TableStatus />
        </div>
        <div className="md:col-span-1">
          <RecentOrders />
        </div>
      </div>
    </div>
  );
}
