import { render, screen, waitFor, fireEvent } from '../../../../test-utils';
import ShiftBar from '../ShiftBar';
import { mockApi } from '../../../../test-utils';

describe('ShiftBar Integration', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Default mock implementations
    mockApi.get.mockResolvedValue({ id: 'shift-123', status: 'open' });
    mockApi.post.mockResolvedValue({ success: true });
    mockApi.verifyManagerPin.mockResolvedValue({ ok: true });
    
    // Mock localStorage
    Storage.prototype.getItem = vi.fn((key) => {
      if (key === 'pos_last_start_cash') return '100';
      return null;
    });
  });

  test('opens and submits shift with PIN when required', async () => {
    render(<ShiftBar />, {
      settings: { access: { requirePinLifecycle: true } }
    });

    // Click Open Shift
    fireEvent.click(screen.getByRole('button', { name: /open shift/i }));
    
    // Verify modal is open with pre-filled amount from localStorage
    expect(screen.getByTestId('modal-open-shift')).toBeInTheDocument();
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /open/i }));
    
    // Verify PIN prompt appears
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toHaveTextContent(/manager approval required/i);
    });
    
    // Enter PIN and submit
    const pinInput = screen.getByLabelText(/enter pin/i);
    fireEvent.change(pinInput, { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    
    // Verify API was called with correct data
    await waitFor(() => {
      expect(mockApi.verifyManagerPin).toHaveBeenCalledWith('1234');
      expect(mockApi.post).toHaveBeenCalledWith('/api/shifts/open', {
        start_cash: 100,
        notes: 'Opened via UI'
      });
    });
  });

  test('shows disabled buttons when user lacks permissions', () => {
    // Mock checkAccess to deny all permissions
    const mockCheckAccess = vi.fn().mockReturnValue(false);
    
    render(<ShiftBar />, {
      settings: { access: { requirePinLifecycle: true } },
      checkAccess: mockCheckAccess
    });
    
    // All action buttons should be disabled
    expect(screen.getByRole('button', { name: /open shift/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /drop/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /payout/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /adjust/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /print/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /close/i })).toBeDisabled();
  });
});
