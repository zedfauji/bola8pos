import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import api from '../../services/api';

const TablesPage = () => {
  const { isPinRequired, formatCurrency } = useSettings();
  const navigate = useNavigate();
  
  // State for tables and UI
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal states
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    table: null,
    type: null, // 'start', 'finalize', 'end', 'clean', 'pause', 'resume'
    data: null
  });
  const [pinModal, setPinModal] = useState({
    isOpen: false,
    action: null,
    table: null,
    pin: '',
    error: ''
  });

  // Load tables from API
  const loadTables = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getTables();
      setTables(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load tables:', err);
      setError('Failed to load tables. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadTables();
  }, [loadTables]);

  // Handle table actions with PIN verification
  const handleTableAction = async (table, action, actionData = {}) => {
    // Check if PIN is required for this action
    if (isPinRequired(action)) {
      setPinModal({
        isOpen: true,
        action,
        table,
        pin: '',
        error: ''
      });
      return;
    }
    
    // If no PIN required, perform action directly
    await performTableAction(table, action, actionData);
  };

  // Perform the actual table action
  const performTableAction = async (table, action, actionData = {}) => {
    try {
      switch (action) {
        case 'start':
          await api.startTable(table.id, actionData);
          break;
        case 'finalize':
          await api.finalizeTableBill(table.id, actionData);
          // Immediately take cashier to Payment for this table
          try { navigate(`/payment/${table.id}`); } catch {}
          break;
        case 'end':
          await api.endTableSession(table.id, actionData);
          break;
        case 'clean':
          await api.setCleaning(table.id, actionData.minutes || 5);
          break;
        case 'pause':
          await api.pauseTable(table.id);
          break;
        case 'resume':
          await api.resumeTable(table.id);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }
      
      // Refresh tables after action
      await loadTables();
      
      // Close any open modals
      setActionModal({ isOpen: false, table: null, type: null, data: null });
      setPinModal({ isOpen: false, action: null, table: null, pin: '', error: '' });
      
    } catch (error) {
      console.error(`Failed to ${action} table:`, error);
      // Update error state in the appropriate modal
      if (pinModal.isOpen) {
        setPinModal(prev => ({
          ...prev,
          error: `Failed to ${action} table: ${error.message}`
        }));
      } else {
        // Show error in action modal or as a toast
        setActionModal(prev => ({
          ...prev,
          error: `Failed to ${action} table: ${error.message}`
        }));
      }
    }
  };

  // Handle PIN submission for protected actions
  const handlePinSubmit = async () => {
    const { action, table, pin } = pinModal;
    
    try {
      // Verify PIN with the server
      const { ok } = await api.verifyManagerPin(pin);
      
      if (!ok) {
        setPinModal(prev => ({
          ...prev,
          error: 'Invalid manager PIN',
          pin: ''
        }));
        return;
      }
      
      // If PIN is valid, perform the action and include managerPin for backend enforcement
      await performTableAction(table, action, { managerPin: pin });
      
    } catch (error) {
      console.error('Failed to verify PIN:', error);
      setPinModal(prev => ({
        ...prev,
        error: 'Failed to verify PIN. Please try again.',
        pin: ''
      }));
    }
  };

  // Render table card
  const renderTableCard = (table) => {
    const isOccupied = table.status === 'occupied';
    const isCleaning = table.status === 'cleaning';
    const isPaused = table.paused;
    
    return (
      <div 
        key={table.id}
        className={`p-4 rounded-lg shadow-md border ${
          isOccupied ? 'bg-blue-900/20 border-blue-800' : 
          isCleaning ? 'bg-yellow-900/20 border-yellow-800' : 
          'bg-gray-900 border-gray-800'
        } text-gray-100`}
      >
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-lg text-gray-100">{table.name}</h3>
          <div className="flex space-x-2">
            {isOccupied && (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-900/30 text-green-300 border border-green-800">
                Occupied
              </span>
            )}
            {isCleaning && (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-900/30 text-yellow-300 border border-yellow-800">
                Cleaning
              </span>
            )}
            {isPaused && (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-800 text-gray-200 border border-gray-700">
                Paused
              </span>
            )}
          </div>
        </div>
        
        <div className="mt-2 text-sm text-gray-300">
          {isOccupied && (
            <div className="mb-2">
              <div>Time: {formatTime(table.elapsedTime)}</div>
              <div>Total: {formatCurrency(table.revenue)}</div>
            </div>
          )}
          
          <div className="flex space-x-2 mt-3">
            {!isOccupied ? (
              <button
                onClick={() => handleTableAction(table, 'start')}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                Start
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate(`/order/${table.id}`)}
                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                >
                  Order
                </button>
                <button
                  onClick={() => handleTableAction(table, 'finalize')}
                  className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                >
                  Finalize
                </button>
                <button
                  onClick={() => handleTableAction(table, 'end')}
                  className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                >
                  End
                </button>
              </>
            )}
            
            {isPaused ? (
              <button
                onClick={() => handleTableAction(table, 'resume')}
                className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
              >
                Resume
              </button>
            ) : (
              <button
                onClick={() => handleTableAction(table, 'pause')}
                className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                disabled={!isOccupied}
              >
                Pause
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Helper to format time
  const formatTime = (seconds) => {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container mx-auto p-4 text-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Tables</h1>
        <button
          onClick={loadTables}
          className="px-4 py-2 bg-gray-800 text-gray-100 rounded hover:bg-gray-700 border border-gray-700"
        >
          Refresh
        </button>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-900/40 text-red-300 border border-red-700 rounded">
          {error}
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tables.map(renderTableCard)}
        </div>
      )}
      
      {/* PIN Verification Modal */}
      {pinModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 text-gray-100 rounded-lg p-6 w-full max-w-md shadow-xl border border-gray-800">
            <h3 className="text-lg font-semibold mb-4 text-gray-100">Manager Verification Required</h3>
            <form onSubmit={(e)=>{e.preventDefault(); handlePinSubmit();}}>
              <p className="mb-4 text-gray-300">Please enter your manager PIN to {pinModal.action} this table.</p>
              
              <input
                type="password"
                value={pinModal.pin}
                onChange={(e) => setPinModal(prev => ({ ...prev, pin: e.target.value }))}
                className="w-full p-2 rounded mb-4 bg-gray-800 text-gray-100 placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                placeholder="Enter PIN"
                autoFocus
              />
              
              {pinModal.error && (
                <div className="mb-4 p-2 bg-red-900/40 text-red-300 border border-red-700 rounded text-sm">
                  {pinModal.error}
                </div>
              )}
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setPinModal({ isOpen: false, action: null, table: null, pin: '', error: '' })}
                  className="px-4 py-2 text-gray-200 hover:bg-gray-800 border border-gray-700 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  disabled={!pinModal.pin}
                >
                  Verify & Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TablesPage;
