# Dashboard Page (`src/pages/Dashboard.jsx`)

Summary
Landing page for authenticated users. Shows table status and a sales chart.

Composition
- `<TableStatus />` (real-time table grid)
- `<SalesChart />` (charts module; see component for details)

Usage
```jsx
<Route index element={<Dashboard />} />
```