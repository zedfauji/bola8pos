import { useEffect, useState } from 'react';
import api from '../services/api';
import TableCard from '../components/tables/TableCard';
import TableModal from '../components/tables/TableModal';

export default function Tables() {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);

  useEffect(() => {
    const loadTables = async () => {
      try {
        const { data } = await api.get('/tables');
        setTables(data);
      } catch (error) {
        console.error('Failed to load tables:', error);
      }
    };
    loadTables();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Table Management</h1>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {tables.map(table => (
          <TableCard 
            key={table.id} 
            table={table}
            onClick={() => setSelectedTable(table)}
          />
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
