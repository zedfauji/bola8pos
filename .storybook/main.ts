import type { StorybookConfig } from '@storybook/react-vite'
import path from 'path'
import { fileURLToPath } from 'url'
import { mergeConfig } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)', '../src/**/*.mdx'],
  addons: [
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
    '@chromatic-com/storybook',
    '@storybook/addon-onboarding',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  viteFinal: async (config) => {
    return mergeConfig(config, {
      resolve: {
        alias: {
          '@app': path.resolve(__dirname, '../src/app'),
          '@pages': path.resolve(__dirname, '../src/pages'),
          '@widgets': path.resolve(__dirname, '../src/widgets'),
          '@features': path.resolve(__dirname, '../src/features'),
          '@entities': path.resolve(__dirname, '../src/entities'),
          '@shared': path.resolve(__dirname, '../src/shared'),
        },
      },
    })
  },
}

export default config