# Notification Service (`src/services/notify.js`)

Summary
Lightweight helpers around `react-hot-toast`.

Exports
- `notifySuccess(message: string)`
- `notifyError(message: string)`
- `notifyPromise(promise: Promise, messages: { loading: string; success: string; error: string })`

Setup
Render the toast container once in your app shell.
```jsx
import { Toaster } from 'react-hot-toast';

function Shell() {
  return (
    <>
      {/* ... */}
      <Toaster position="top-right" />
    </>
  );
}
```

Examples
```js
import { notifySuccess, notifyError, notifyPromise } from '../services/notify';

notifySuccess('Saved successfully');
notifyError('Something went wrong');

await notifyPromise(api.post('/orders', payload), {
  loading: 'Submitting order…',
  success: 'Order created',
  error: 'Failed to create order',
});
```