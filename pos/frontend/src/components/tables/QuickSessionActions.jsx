import React, { useState, useEffect } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { PlayCircle, PauseCircle, StopCircle, Clock } from 'lucide-react';

const QuickSessionActions = ({ table, onStartSession, onPauseSession, onEndSession }) => {
  const [selectedTariff, setSelectedTariff] = useState('');
  const [tariffs, setTariffs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Fetch available tariffs
  useEffect(() => {
    const fetchTariffs = async () => {
      setIsLoading(true);
      try {
        // In a real implementation, this would be an API call
        // For now, we'll use mock data
        const mockTariffs = [
          { id: '1', name: 'Standard', pricePerHour: 15 },
          { id: '2', name: 'Premium', pricePerHour: 25 },
          { id: '3', name: 'Weekend', pricePerHour: 20 },
          { id: '4', name: 'Happy Hour', pricePerHour: 10 }
        ];
        
        setTariffs(mockTariffs);
        setSelectedTariff(mockTariffs[0].id);
      } catch (error) {
        console.error('Error fetching tariffs:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTariffs();
  }, []);

  // Format duration for display
  const formatDuration = (startTimeString) => {
    if (!startTimeString) return 'N/A';
    
    const startTime = new Date(startTimeString);
    const now = new Date();
    const diffMs = now - startTime;
    
    // Convert to hours, minutes, seconds
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle start session
  const handleStartSession = () => {
    if (onStartSession && selectedTariff) {
      onStartSession(table.id, selectedTariff);
    }
  };

  // Handle pause session
  const handlePauseSession = () => {
    if (onPauseSession && table.currentSession) {
      onPauseSession(table.currentSession.id);
    }
  };

  // Handle end session
  const handleEndSession = () => {
    if (onEndSession && table.currentSession) {
      onEndSession(table.currentSession.id);
    }
  };

  // Render based on table status
  if (!table) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Clock className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No Table Selected</h3>
        <p className="text-muted-foreground mt-2 text-center">
          Please select a table to manage its session
        </p>
      </div>
    );
  }

  if (table.status === 'maintenance') {
    return (
      <div className="bg-purple-50 border border-purple-200 rounded-md p-4 text-center">
        <h3 className="text-lg font-medium text-purple-800">Table Under Maintenance</h3>
        <p className="text-sm text-purple-600 mt-2">
          This table is currently unavailable for sessions
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {table.status === 'available' ? (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-medium mb-4">Start New Session</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Tariff</label>
                <Select
                  value={selectedTariff}
                  onValueChange={setSelectedTariff}
                  disabled={isLoading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a tariff" />
                  </SelectTrigger>
                  <SelectContent>
                    {tariffs.map((tariff) => (
                      <SelectItem key={tariff.id} value={tariff.id}>
                        {tariff.name} (${tariff.pricePerHour}/hour)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                className="w-full" 
                onClick={handleStartSession}
                disabled={!selectedTariff || isLoading}
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                Start Session
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : table.status === 'occupied' ? (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-medium mb-4">Active Session</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Started</p>
                  <p className="font-medium">
                    {table.currentSession?.startTime ? 
                      new Date(table.currentSession.startTime).toLocaleTimeString() : 
                      'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium">
                    {table.currentSession?.startTime ? 
                      formatDuration(table.currentSession.startTime) : 
                      'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tariff</p>
                  <p className="font-medium">
                    {table.currentSession?.tariffName || 'Standard'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Amount</p>
                  <p className="font-medium">
                    ${table.currentSession?.currentAmount?.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={handlePauseSession}
                >
                  <PauseCircle className="h-4 w-4 mr-2" />
                  Pause Session
                </Button>
                <Button 
                  variant="destructive" 
                  className="flex-1"
                  onClick={handleEndSession}
                >
                  <StopCircle className="h-4 w-4 mr-2" />
                  End Session
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : table.status === 'reserved' ? (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-medium mb-4">Paused Session</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Started</p>
                  <p className="font-medium">
                    {table.currentSession?.startTime ? 
                      new Date(table.currentSession.startTime).toLocaleTimeString() : 
                      'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Paused At</p>
                  <p className="font-medium">
                    {table.currentSession?.pausedAt ? 
                      new Date(table.currentSession.pausedAt).toLocaleTimeString() : 
                      'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tariff</p>
                  <p className="font-medium">
                    {table.currentSession?.tariffName || 'Standard'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Amount</p>
                  <p className="font-medium">
                    ${table.currentSession?.currentAmount?.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  className="flex-1"
                  onClick={handleStartSession}
                >
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Resume Session
                </Button>
                <Button 
                  variant="destructive" 
                  className="flex-1"
                  onClick={handleEndSession}
                >
                  <StopCircle className="h-4 w-4 mr-2" />
                  End Session
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4 text-center">
          <h3 className="text-lg font-medium">Unknown Status</h3>
          <p className="text-sm text-muted-foreground mt-2">
            The table status is unknown or not supported
          </p>
        </div>
      )}
    </div>
  );
};

export default QuickSessionActions;
