/**
 * STORYBOOK DECORATORS
 *
 * Global decorators for all stories.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Decorator } from '@storybook/react'
import * as React from 'react'

/**
 * withQueryClient - Wraps stories in QueryClientProvider
 *
 * Provides TanStack Query context for components that use queries/mutations.
 */
export const withQueryClient: Decorator = (Story) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <Story />
    </QueryClientProvider>
  )
}

/**
 * withDarkTheme - Wraps stories in dark theme container
 *
 * Applies dark mode styling (bar app is dark by default).
 */
export const withDarkTheme: Decorator = (Story) => {
  return (
    <div className="dark bg-background text-foreground p-4 min-h-screen">
      <Story />
    </div>
  )
}
