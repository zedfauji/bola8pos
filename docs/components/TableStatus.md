# TableStatus (`src/components/tables/TableStatus.jsx`)

Summary
Displays a responsive grid of all tables and updates in real time via Socket.IO.

Data Flow
- On mount: `GET /tables` to fetch initial state
- Socket listener: `table-updated` – merges updates into local list

Usage
```jsx
import TableStatus from '../components/tables/TableStatus';

function Dashboard() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <TableStatus />
      </div>
    </div>
  );
}
```

Notes
- Requires `SocketProvider` to be present higher in the tree.