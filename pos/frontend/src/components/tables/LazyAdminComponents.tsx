import { lazy, Suspense } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

// Placeholder component for missing admin components
const PlaceholderComponent = ({ name }: { name: string }) => (
  <Box sx={{ p: 3, textAlign: 'center' }}>
    <Typography variant="h6" color="text.secondary">
      {name} Component
    </Typography>
    <Typography variant="body2" color="text.secondary">
      This component will be implemented in a future update.
    </Typography>
  </Box>
);

// Lazy load admin-only components for bundle optimization
const LazyTableLayoutEditor = lazy(() => 
  import('./TableLayoutEditor').catch(() => ({ 
    default: () => <PlaceholderComponent name="Table Layout Editor" />
  }))
);

const LazyTariffManager = lazy(() => 
  import('./TariffManager').catch(() => ({ 
    default: () => <PlaceholderComponent name="Tariff Manager" />
  }))
);

const LazyFloorPlanEditor = lazy(() => 
  import('./FloorPlanEditor').catch(() => ({ 
    default: () => <PlaceholderComponent name="Floor Plan Editor" />
  }))
);

const LazyUserManager = lazy(() => 
  import('../admin/UserManager').catch(() => ({ 
    default: () => <PlaceholderComponent name="User Manager" />
  }))
);

const LazySystemSettings = lazy(() => 
  import('../admin/SystemSettings').catch(() => ({ 
    default: () => <PlaceholderComponent name="System Settings" />
  }))
);

// Loading component for lazy-loaded admin components
const AdminComponentLoader = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '200px',
      gap: 2
    }}>
      <CircularProgress />
      <Typography variant="body2" color="text.secondary">
        Loading admin component...
      </Typography>
    </Box>
  }>
    {children}
  </Suspense>
);

// Wrapper components that include lazy loading and suspense
export const LazyTableLayoutEditorWithSuspense = () => (
  <AdminComponentLoader>
    <LazyTableLayoutEditor />
  </AdminComponentLoader>
);

export const LazyTariffManagerWithSuspense = () => (
  <AdminComponentLoader>
    <LazyTariffManager />
  </AdminComponentLoader>
);

export const LazyFloorPlanEditorWithSuspense = () => (
  <AdminComponentLoader>
    <LazyFloorPlanEditor />
  </AdminComponentLoader>
);

export const LazyUserManagerWithSuspense = () => (
  <AdminComponentLoader>
    <LazyUserManager />
  </AdminComponentLoader>
);

export const LazySystemSettingsWithSuspense = () => (
  <AdminComponentLoader>
    <LazySystemSettings />
  </AdminComponentLoader>
);

export {
  LazyTableLayoutEditor,
  LazyTariffManager,
  LazyFloorPlanEditor,
  LazyUserManager,
  LazySystemSettings
};
