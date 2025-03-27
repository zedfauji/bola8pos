import { useState } from 'react';
import api from '../../services/api';

export default function TableActions({ table, onUpdate }) {
  const [loading, setLoading] = useState(false);

  const startSession = async () => {
    setLoading(true);
    try {
      await api.post(`/tables/${table.id}/start`);
      onUpdate();
    } finally {
      setLoading(false);
    }
  };

  const endSession = async () => {
    setLoading(true);
    try {
      await api.post(`/tables/${table.id}/end`);
      onUpdate();
    } finally {
      setLoading(false);
    }
  };

  const transferTable = async () => {
    const newTableId = prompt("Enter destination table ID:");
    if (newTableId) {
      setLoading(true);
      try {
        await api.post(`/tables/${table.id}/transfer`, { newTableId });
        onUpdate();
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex gap-1 mt-2">
      {table.status === 'available' ? (
        <button
          onClick={startSession}
          disabled={loading}
          className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Starting...' : 'Start'}
        </button>
      ) : (
        <>
          <button
            onClick={endSession}
            disabled={loading}
            className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 disabled:opacity-50"
          >
            {loading ? 'Ending...' : 'End'}
          </button>
          {table.table_type === 'billiard' && (
            <button
              onClick={transferTable}
              disabled={loading}
              className="text-xs bg-purple-500 text-white px-2 py-1 rounded hover:bg-purple-600 disabled:opacity-50"
          >
            {loading ? 'Transferring...' : 'Transfer'}
          </button>
          )}
        </>
      )}
    </div>
  );
}
