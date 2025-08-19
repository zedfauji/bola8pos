# QuickOrder (`src/components/orders/QuickOrder.jsx`)

Summary
Minimal UI to quickly add a single order item for a given table. Posts the order to the API and maintains a local list of items added during the session.

Props
- `tableId: string | number` – target table identifier

Behavior
- `POST /orders` with payload `{ tableId, items: [{ itemId, quantity }] }`
- Appends the added item to a local `items` state list

Usage
```jsx
import QuickOrder from '../../components/orders/QuickOrder';

function RightSidebar({ tableId }) {
  return <QuickOrder tableId={tableId} />;
}
```

Notes
- Populate the `<select>` with actual inventory items; set its value to a JSON string of the item and parse on change.
- Consider using the notification helpers for UX feedback.