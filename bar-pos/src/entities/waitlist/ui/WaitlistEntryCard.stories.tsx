import type { Meta, StoryObj } from '@storybook/react-vite';

import type { WaitlistEntry, WaitlistNotification } from '@entities/waitlist/model/types';
import { WaitlistEntryCard } from './WaitlistEntryCard';

const meta: Meta<typeof WaitlistEntryCard> = {
  title: 'Entities/Waitlist/WaitlistEntryCard',
  component: WaitlistEntryCard,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof WaitlistEntryCard>;

const baseEntry: WaitlistEntry = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'García',
  partySize: 3,
  phoneE164: null,
  status: 'waiting',
  tableId: null,
  seatedAt: null,
  notifiedAt: null,
  createdAt: new Date(Date.now() - 4 * 60 * 1000), // 4 minutes ago
};

const noop = () => undefined;

/** Waiting entry with no phone — notifySlot not provided */
export const Waiting: Story = {
  args: {
    entry: baseEntry,
    quotedWait: 15,
    lastNotification: null,
    notifySlot: undefined,
    onSeat: noop,
    onNoShow: noop,
    onCancel: noop,
    isSeating: false,
  },
};

/** Waiting entry with phone — notifySlot provided as a plain button */
export const WaitingWithPhone: Story = {
  args: {
    entry: {
      ...baseEntry,
      phoneE164: '+525512345678',
    },
    quotedWait: 20,
    lastNotification: null,
    notifySlot: <button type="button">Notify via WhatsApp</button>,
    onSeat: noop,
    onNoShow: noop,
    onCancel: noop,
    isSeating: false,
  },
};

const whatsappSentNotification: WaitlistNotification = {
  id: '00000000-0000-0000-0000-000000000010',
  waitlistEntryId: baseEntry.id,
  channel: 'whatsapp',
  status: 'sent',
  providerMessageId: 'wa-msg-001',
  error: null,
  createdAt: new Date(Date.now() - 2 * 60 * 1000),
};

/** Entry has been notified via WhatsApp successfully */
export const Notified: Story = {
  args: {
    entry: {
      ...baseEntry,
      phoneE164: '+525512345678',
      status: 'notified',
      notifiedAt: new Date(Date.now() - 2 * 60 * 1000),
    },
    quotedWait: 10,
    lastNotification: whatsappSentNotification,
    notifySlot: undefined,
    onSeat: noop,
    onNoShow: noop,
    onCancel: noop,
    isSeating: false,
  },
};

const whatsappFailedNotification: WaitlistNotification = {
  id: '00000000-0000-0000-0000-000000000011',
  waitlistEntryId: baseEntry.id,
  channel: 'whatsapp',
  status: 'failed',
  providerMessageId: null,
  error: 'Invalid phone number',
  createdAt: new Date(Date.now() - 3 * 60 * 1000),
};

/** Entry notification failed */
export const NotificationFailed: Story = {
  args: {
    entry: {
      ...baseEntry,
      phoneE164: '+525512345678',
      status: 'notified',
      notifiedAt: new Date(Date.now() - 3 * 60 * 1000),
    },
    quotedWait: 10,
    lastNotification: whatsappFailedNotification,
    notifySlot: undefined,
    onSeat: noop,
    onNoShow: noop,
    onCancel: noop,
    isSeating: false,
  },
};

/** Entry has been seated — no action buttons */
export const Seated: Story = {
  args: {
    entry: {
      ...baseEntry,
      status: 'seated',
      tableId: '00000000-0000-0000-0000-000000000020',
      seatedAt: new Date(Date.now() - 5 * 60 * 1000),
    },
    quotedWait: 0,
    lastNotification: null,
    notifySlot: undefined,
    onSeat: noop,
    onNoShow: noop,
    onCancel: noop,
    isSeating: false,
  },
};

/** Entry marked as no-show — danger border styling */
export const NoShow: Story = {
  args: {
    entry: {
      ...baseEntry,
      status: 'no_show',
    },
    quotedWait: 0,
    lastNotification: null,
    notifySlot: undefined,
    onSeat: noop,
    onNoShow: noop,
    onCancel: noop,
    isSeating: false,
  },
};
