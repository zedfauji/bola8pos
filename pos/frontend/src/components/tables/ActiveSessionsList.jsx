import React from 'react';
import { Button } from '../../components/ui/button';
import { PauseCircle, StopCircle, Clock } from 'lucide-react';

const ActiveSessionsList = ({ sessions = [], onPauseSession, onEndSession }) => {
  // Helper function to format duration
  const formatDuration = (startTimeString) => {
    if (!startTimeString) return 'Unknown';
    
    const startTime = new Date(startTimeString);
    const now = new Date();
    const diffMs = now - startTime;
    
    // Convert to hours, minutes, seconds
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  // Helper function to format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  if (!sessions || sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Clock className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No Active Sessions</h3>
        <p className="text-muted-foreground mt-2 text-center">
          There are currently no active sessions
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-4 font-medium text-sm text-muted-foreground border-b pb-2">
        <div>Table</div>
        <div>Started</div>
        <div>Duration</div>
        <div>Amount</div>
        <div>Actions</div>
      </div>
      
      {sessions.map((session) => (
        <div key={session.id} className="grid grid-cols-5 gap-4 py-2 border-b border-gray-100 text-sm">
          <div className="font-medium">{session.tableName}</div>
          <div>{new Date(session.startTime).toLocaleTimeString()}</div>
          <div>{formatDuration(session.startTime)}</div>
          <div>{formatCurrency(session.currentAmount)}</div>
          <div className="flex gap-2">
            {onPauseSession && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onPauseSession(session.id)}
                className="h-8 px-2"
              >
                <PauseCircle className="h-4 w-4 mr-1" />
                Pause
              </Button>
            )}
            
            {onEndSession && (
              <Button 
                size="sm" 
                variant="destructive" 
                onClick={() => onEndSession(session.id)}
                className="h-8 px-2"
              >
                <StopCircle className="h-4 w-4 mr-1" />
                End
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ActiveSessionsList;
