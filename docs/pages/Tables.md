# Tables Page (`src/pages/Tables.jsx`)

Summary
Fetches tables from the API and renders a grid of `TableCard` components. Opens `TableModal` for actions on a selected table.

Data
- `GET /tables` on mount

Usage
```jsx
import Tables from '../../pages/Tables';

<Route path="tables" element={<Tables />} />
```

Notes
- Clicking a card sets `selectedTable` and renders `<TableModal table={selectedTable} onClose={...} />`.