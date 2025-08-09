# TableCard (`src/components/tables/TableCard.jsx`)

Summary
Displays a single table summary card with status-aware styling.

Props
- `table`: object with fields `{ id, table_number, table_type, status, current_session_minutes }`
- `onClick: () => void` – invoked when the card is clicked

Status Styles
- `available`: green
- `occupied`: red with duration indicator
- `maintenance`: yellow

Usage
```jsx
<TableCard table={table} onClick={() => setSelectedTable(table)} />
```