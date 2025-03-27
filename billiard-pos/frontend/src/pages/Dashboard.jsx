import TableStatus from '../components/tables/TableStatus';
import SalesChart from '../components/charts/SalesChart';

export default function Dashboard() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TableStatus />
        </div>
        <div className="lg:col-span-1">
          <SalesChart />
        </div>
      </div>
    </div>
  );
}
