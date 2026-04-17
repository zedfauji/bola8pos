import type { Meta, StoryObj } from '@storybook/react-vite';
import { vi } from 'vitest';
import { useTab, useTabs } from '@entities/tab/model/queries';
import { useTabStore } from '@entities/tab/model/store';
import { mockTab } from '@entities/tab/model/types';
import type { Tab } from '@entities/tab/model/types';
import { ActiveTabSelector } from './ActiveTabSelector';

vi.mock('@entities/tab/model/queries', async importOriginal => {
  // `importOriginal` is typed as unknown; cast for spread (TS2698).
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- cast is required for spread; TS does not narrow `unknown`
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useTab: vi.fn(),
    useTabs: vi.fn(),
  };
});

function stubUseTab(data: Tab | undefined) {
  return {
    data,
    isPending: false,
    isLoading: false,
    isError: false,
    isSuccess: Boolean(data),
    error: null,
    isIdleOrLoading: false,
    isEmpty: !data,
    resultError: undefined,
    refetch: vi.fn(),
  } as never;
}

function stubUseTabs(tabs: Tab[]) {
  return {
    data: tabs,
    isPending: false,
    isLoading: false,
    isError: false,
    isSuccess: true,
    error: null,
    isIdleOrLoading: false,
    isEmpty: tabs.length === 0,
    resultError: undefined,
    refetch: vi.fn(),
  } as never;
}

const meta = {
  title: 'Widgets/OrderPanel/ActiveTabSelector',
  component: ActiveTabSelector,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ActiveTabSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoActiveTab: Story = {
  decorators: [
    Story => {
      useTabStore.setState({
        activeTabId: null,
        selectedTabId: null,
        tabs: [],
      });
      vi.mocked(useTabs).mockReturnValue(stubUseTabs([]));
      vi.mocked(useTab).mockReturnValue(stubUseTab(undefined));
      return <Story />;
    },
  ],
};

export const WithActiveTab: Story = {
  decorators: [
    Story => {
      useTabStore.setState({
        activeTabId: mockTab.id,
        selectedTabId: mockTab.id,
        tabs: [mockTab],
      });
      vi.mocked(useTabs).mockReturnValue(stubUseTabs([mockTab]));
      vi.mocked(useTab).mockImplementation((id: string) =>
        id === mockTab.id ? stubUseTab(mockTab) : stubUseTab(undefined)
      );
      return <Story />;
    },
  ],
};
