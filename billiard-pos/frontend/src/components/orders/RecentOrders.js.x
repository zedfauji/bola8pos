const mockOrders = [
  { id: 1, table: 'B1', amount: 320, items: 3 },
  { id: 2, table: 'R1', amount: 180, items: 2 },
  { id: 3, table: 'B2', amount: 420, items: 5 },
];

export default function RecentOrders() {
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-3">Recent Orders</h2>
      <div className="space-y-3">
        {mockOrders.map(order => (
          <div key={order.id} className="border-b pb-2 last:border-0">
            <div className="flex justify-between">
              <span className="font-medium">Table {order.table}</span>
              <span className="text-blue-600">₱{order.amount}</span>
            </div>
            <div className="text-sm text-gray-500">{order.items} items</div>
          </div>
        ))}
      </div>
    </div>
  );
}
