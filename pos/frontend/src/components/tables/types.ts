export interface TableType {
  id: string;
  name: string;
  type: 'regular' | 'bar' | 'billiard';
  floor: string;
  position: { x: number; y: number };
  rotation: number;
  width: number;
  height: number;
  seats?: number;
  status?: 'available' | 'occupied' | 'reserved';
}

export interface TableLayout {
  id: string;
  name: string;
  width: number;
  height: number;
  tables: TableType[];
  updatedAt?: string;
}

export interface TableDropItem {
  id: string;
  type: string;
  x?: number;
  y?: number;
}

export interface TableContextType {
  tables: TableType[];
  activeLayout: TableLayout | null;
  addTable: (table: Omit<TableType, 'id'>) => Promise<void>;
  updateTable: (id: string, updates: Partial<TableType>) => Promise<void>;
  deleteTable: (id: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}
