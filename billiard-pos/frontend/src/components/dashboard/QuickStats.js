export default function QuickStats({ stats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-gray-500">Active Tables</h3>
        <p className="text-2xl font-bold">{stats.activeTables}</p>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-gray-500">Today's Revenue</h3>
        <p className="text-2xl font-bold">₱{stats.dailyRevenue.toLocaleString()}</p>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-gray-500">Active Members</h3>
        <p className="text-2xl font-bold">{stats.activeMembers}</p>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-gray-500">Inventory Alerts</h3>
        <p className="text-2xl font-bold">{stats.inventoryAlerts}</p>
      </div>
    </div>
  );
}
