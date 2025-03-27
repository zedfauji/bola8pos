import { useEffect, useState } from 'react';
import { useSocket } from '../../context/SocketContext';
import api from '../../services/api';

export default function TableStatus() {
  const [tables, setTables] = useState([]);
  const socket = useSocket();

  useEffect(() => {
    const loadTables = async () => {
      const { data } = await api.get('/tables');
      setTables(data);
    };
    loadTables();

    socket?.on('table-updated', (updatedTable) => {
      setTables(prev => prev.map(t => 
        t.id === updatedTable.id ? updatedTable : t
      ));
    });

    return () => {
      socket?.off('table-updated');
    };
  }, [socket]);

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Table Status</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {tables.map(table => (
          <div key={table.id} className={`p-3 rounded border ${
            table.status === 'occupied' 
              ? 'bg-red-50 border-red-200' 
              : 'bg-green-50 border-green-200'
          }`}>
            <div className="font-medium">{table.table_number}</div>
            <div className="text-sm text-gray-600">{table.status}</div>
            {table.status === 'occupied' && (
              <div className="text-xs mt-1">
                {Math.floor(table.current_session_minutes/60)}h {table.current_session_minutes%60}m
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
