export default function TableCard({ table, onClick }) {
  const statusColors = {
    available: 'bg-green-100 border-green-500',
    occupied: 'bg-red-100 border-red-500',
    maintenance: 'bg-yellow-100 border-yellow-500'
  };

  return (
    <div 
      className={`${statusColors[table.status]} border-2 rounded-lg p-4 cursor-pointer transition hover:shadow-md`}
      onClick={onClick}
    >
      <div className="flex justify-between items-start">
        <h3 className="font-bold text-lg">{table.table_number}</h3>
        <span className="px-2 py-1 text-xs rounded-full bg-white">
          {table.table_type}
        </span>
      </div>
      <div className="mt-2">
        <p className="text-sm capitalize">{table.status}</p>
        {table.status === 'occupied' && (
          <p className="text-xs mt-1">
            {Math.floor(table.current_session_minutes / 60)}h {table.current_session_minutes % 60}m
          </p>
        )}
      </div>
    </div>
  );
}
