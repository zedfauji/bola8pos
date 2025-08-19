import React from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';

const TableStatusSummary = ({ tables }) => {
  // Calculate table statistics
  const totalTables = tables.length;
  const availableTables = tables.filter(t => t.status === 'available').length;
  const occupiedTables = tables.filter(t => t.status === 'occupied').length;
  const reservedTables = tables.filter(t => t.status === 'reserved').length;
  const maintenanceTables = tables.filter(t => t.status === 'maintenance').length;

  // Calculate percentages
  const availablePercent = totalTables ? Math.round((availableTables / totalTables) * 100) : 0;
  const occupiedPercent = totalTables ? Math.round((occupiedTables / totalTables) * 100) : 0;
  const reservedPercent = totalTables ? Math.round((reservedTables / totalTables) * 100) : 0;
  const maintenancePercent = totalTables ? Math.round((maintenanceTables / totalTables) * 100) : 0;

  return (
    <div className="space-y-4">
      {totalTables === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No tables available in this layout
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">{availableTables}</div>
              <div className="text-xs text-muted-foreground">Available</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{occupiedTables}</div>
              <div className="text-xs text-muted-foreground">Occupied</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">{reservedTables}</div>
              <div className="text-xs text-muted-foreground">Reserved</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">{maintenanceTables}</div>
              <div className="text-xs text-muted-foreground">Maintenance</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Available</span>
                <span>{availablePercent}%</span>
              </div>
              <Progress value={availablePercent} className="h-2 bg-gray-100" indicatorClassName="bg-green-500" />
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Occupied</span>
                <span>{occupiedPercent}%</span>
              </div>
              <Progress value={occupiedPercent} className="h-2 bg-gray-100" indicatorClassName="bg-blue-500" />
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Reserved</span>
                <span>{reservedPercent}%</span>
              </div>
              <Progress value={reservedPercent} className="h-2 bg-gray-100" indicatorClassName="bg-yellow-500" />
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Maintenance</span>
                <span>{maintenancePercent}%</span>
              </div>
              <Progress value={maintenancePercent} className="h-2 bg-gray-100" indicatorClassName="bg-purple-500" />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TableStatusSummary;
