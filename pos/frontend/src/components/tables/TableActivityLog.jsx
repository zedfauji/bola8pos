import React from 'react';
import { Activity, PlayCircle, PauseCircle, StopCircle, Settings, AlertTriangle } from 'lucide-react';

const TableActivityLog = ({ activities = [] }) => {
  // Helper function to format time
  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Helper function to get activity icon
  const getActivityIcon = (type) => {
    switch (type) {
      case 'session_start':
        return <PlayCircle className="h-4 w-4 text-green-500" />;
      case 'session_pause':
        return <PauseCircle className="h-4 w-4 text-yellow-500" />;
      case 'session_end':
        return <StopCircle className="h-4 w-4 text-red-500" />;
      case 'table_update':
        return <Settings className="h-4 w-4 text-blue-500" />;
      case 'session_update':
        return <Activity className="h-4 w-4 text-purple-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  // Helper function to get activity message
  const getActivityMessage = (activity) => {
    switch (activity.type) {
      case 'session_start':
        return `Session started on ${activity.tableName}`;
      case 'session_pause':
        return `Session paused on ${activity.tableName}`;
      case 'session_end':
        return `Session ended on ${activity.tableName}${activity.amount ? ` ($${activity.amount.toFixed(2)})` : ''}`;
      case 'table_update':
        return `Table ${activity.tableName} status changed to ${activity.status || 'updated'}`;
      case 'session_update':
        return `Session on ${activity.tableName} ${activity.sessionStatus || 'updated'}`;
      default:
        return `Activity on ${activity.tableName || 'unknown table'}`;
    }
  };

  if (!activities || activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-4">
        <AlertTriangle className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground text-center">
          No recent activity
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div key={activity.id} className="flex items-start gap-3 py-2">
          <div className="mt-0.5">
            {getActivityIcon(activity.type)}
          </div>
          <div className="flex-grow">
            <p className="text-sm">{getActivityMessage(activity)}</p>
            <p className="text-xs text-muted-foreground">
              {formatTime(activity.timestamp)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TableActivityLog;
