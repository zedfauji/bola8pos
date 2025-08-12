import { lazy } from 'react';

// Use a default export for lazy loading
const ReportsPage = lazy(() => import('./ReportsPage'));

export default ReportsPage;
