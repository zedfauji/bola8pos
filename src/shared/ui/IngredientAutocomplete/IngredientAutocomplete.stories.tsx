import type { Meta, StoryObj } from '@storybook/react-vite';
import { IngredientAutocomplete } from './IngredientAutocomplete';

const meta: Meta<typeof IngredientAutocomplete> = {
  title: 'Shared/IngredientAutocomplete',
  component: IngredientAutocomplete,
  tags: ['autodocs'],
  args: { value: null, onSelect: () => {}, onClear: () => {} },
};
export default meta;
type Story = StoryObj<typeof IngredientAutocomplete>;

export const Default: Story = {};
export const WithValue: Story = { args: { value: 'some-ingredient-id' } };
export const Disabled: Story = { args: { disabled: true } };
