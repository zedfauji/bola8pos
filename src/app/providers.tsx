import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { PoolRealtimeListener } from '@app/PoolRealtimeListener';
import { AuthProvider } from '@entities/staff/model/AuthContext';
import { supabase } from '@shared/lib/supabase';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  useEffect(() => {
    // Subscriptions are set up in individual entity stores.
    // Global cleanup for all Supabase channels on unmount.
    return () => {
      void supabase.removeAllChannels();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <PoolRealtimeListener />
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
