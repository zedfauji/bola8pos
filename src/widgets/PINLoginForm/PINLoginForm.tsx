import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@entities/staff/model/authStore';
import { PINKeypad } from '@shared/ui/PINKeypad';

export function PINLoginForm() {
  const { selectedStaff, clearSelection, setAuthenticated } = useAuthStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  if (!selectedStaff) return null;

  const handleComplete = (enteredPin: string) => {
    if (enteredPin === selectedStaff.pin) {
      setAuthenticated(true);
      navigate('/pos');
    } else {
      setError('Incorrect PIN. Try again.');
      setPin('');
    }
  };

  const handleChange = (value: string) => {
    setPin(value);
    if (error) setError('');
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-xs">
      <div className="text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-2xl mx-auto mb-2">
          {selectedStaff.name.charAt(0).toUpperCase()}
        </div>
        <h2 className="text-xl font-bold">{selectedStaff.name}</h2>
        <p className="text-sm text-muted-foreground capitalize">{selectedStaff.role}</p>
      </div>

      <PINKeypad
        value={pin}
        onChange={handleChange}
        onComplete={handleComplete}
        label="Enter PIN"
        error={error}
      />

      <button
        onClick={clearSelection}
        className="text-sm text-muted-foreground underline-offset-2 hover:underline"
      >
        Not you? Go back
      </button>
    </div>
  );
}
