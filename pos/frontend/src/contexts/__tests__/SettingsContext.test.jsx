import { render, screen, act } from '../../../test-utils';
import { SettingsProvider, useSettings } from '../SettingsContext';
import { mockApi } from '../../../test-utils';

// Test component that uses the hook
const TestComponent = () => {
  const {
    isPinRequired,
    hasPermission,
    checkAccess,
    verifyPin,
    formatCurrency,
  } = useSettings();

  return (
    <div>
      <div data-testid="pin-required-void">
        {isPinRequired('void') ? 'yes' : 'no'}
      </div>
      <div data-testid="has-permission">
        {hasPermission('admin.dashboard') ? 'yes' : 'no'}
      </div>
      <div data-testid="check-access">
        {checkAccess('shifts', 'open') ? 'yes' : 'no'}
      </div>
      <div data-testid="currency">
        {formatCurrency(10.5)}
      </div>
    </div>
  );
};

describe('SettingsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage mocks
    Storage.prototype.getItem = vi.fn();
    Storage.prototype.setItem = vi.fn();
  });

  test('provides default settings', () => {
    render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    );

    // Default PIN required for void
    expect(screen.getByTestId('pin-required-void')).toHaveTextContent('yes');
    
    // Default permission check (false)
    expect(screen.getByTestId('has-permission')).toHaveTextContent('no');
    
    // Default checkAccess (false)
    expect(screen.getByTestId('check-access')).toHaveTextContent('no');
    
    // Default currency formatting
    expect(screen.getByTestId('currency')).toHaveTextContent('$10.50');
  });

  test('verifies PIN via API', async () => {
    mockApi.verifyManagerPin.mockResolvedValueOnce({ ok: true });
    
    let verifyResult;
    const TestVerify = () => {
      const { verifyPin } = useSettings();
      
      const handleVerify = async () => {
        verifyResult = await verifyPin('1234');
      };
      
      return <button onClick={handleVerify}>Verify</button>;
    };
    
    render(
      <SettingsProvider>
        <TestVerify />
      </SettingsProvider>
    );
    
    fireEvent.click(screen.getByText('Verify'));
    
    await waitFor(() => {
      expect(mockApi.verifyManagerPin).toHaveBeenCalledWith('1234');
      expect(verifyResult).toEqual({ ok: true });
    });
  });

  test('handles dev override', () => {
    // Set dev override
    Storage.prototype.getItem.mockImplementation((key) => 
      key === 'pos_dev_allow_all' ? '1' : null
    );
    
    render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    );
    
    // With dev override, permission checks should pass
    expect(screen.getByTestId('has-permission')).toHaveTextContent('yes');
    expect(screen.getByTestId('check-access')).toHaveTextContent('yes');
  });
});
