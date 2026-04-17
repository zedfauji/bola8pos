import type { Preview } from '@storybook/react-vite'
import { withQueryClient, withDarkTheme } from './decorators'

import '../src/app/globals.css'

const preview: Preview = {
  decorators: [withQueryClient, withDarkTheme],
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
      values: [
        {
          name: 'dark',
          value: '#0a0a0a',
        },
        {
          name: 'light',
          value: '#ffffff',
        },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      config: {
        rules: [
          {
            id: 'color-contrast',
            enabled: true,
          },
        ],
      },
    },
  },
}

export default preview
