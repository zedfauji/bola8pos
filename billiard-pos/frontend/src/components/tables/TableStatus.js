import { useState, useEffect } from 'react';
import api from '../../services/api';
import TableActions from './TableActions';
import TableModal from './TableModal';

export default function TableStatus() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState(null);

  const fetchTables = async () => {
    try {
      const { data } = await api.get('/tables');
      setTables(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  if (loading) return <div>Loading tables...</div>;

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Table Status</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {tables.map(table => (
          <div 
            key={table.id}
            className={`p-3 rounded-lg border-2 ${
              table.status === 'occupied' ? 'bg-red-50 border-red-200' :
              table.status === 'available' ? 'bg-green-50 border-green-200' :
              'bg-yellow-50 border-yellow-200'
            }`}
          >
            <div className="font-bold">{table.table_number}</div>
            <div className="text-sm text-gray-600 capitalize">{table.table_type}</div>
            <div className="text-sm mt-1">
              Status: <span className="capitalize font-medium">{table.status}</span>
            </div>
            {table.status === 'occupied' && (
              <div className="text-xs mt-1">
                {Math.floor(table.current_session_minutes/60)}h {table.current_session_minutes%60}m
              </div>
            )}
            <TableActions table={table} onUpdate={fetchTables} />
            <button
              onClick={() => setSelectedTable(table)}
              className="mt-2 text-sm text-blue-500 hover:underline"
            >
              View Details
            </button>
          </div>
        ))}
      </div>
      {selectedTable && (
        <TableModal 
          table={selectedTable}
          onClose={() => setSelectedTable(null)}
        />
      )}
    </div>
  );
}
