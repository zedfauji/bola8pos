import React, { useState, useEffect } from 'react';
import { useToast } from '../../hooks/use-toast';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Clock, Users, DollarSign, Play, Pause, Stop, Trash2, RotateCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

// PIN verification modal for manager actions
const PinVerificationModal = ({ isOpen, onClose, onVerify, action }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleVerify = async () => {
    if (!pin.trim()) {
      setError('Please enter a PIN');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/verify-manager-pin', { pin });
      if (response.data.success) {
        onVerify();
        onClose();
      } else {
        setError('Invalid PIN');
      }
    } catch (err) {
      console.error('PIN verification error:', err);
      toast({
        title: 'Verification Failed',
        description: err.response?.data?.message || 'Failed to verify PIN',
        variant: 'destructive',
      });
      setError('Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manager Verification Required</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Please enter manager PIN to {action}
          </p>
          <Input
            type="password"
            placeholder="Enter PIN"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setError('');
            }}
            className="mb-2"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleVerify} disabled={loading}>
            {loading ? 'Verifying...' : 'Verify'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const SessionManager = ({ tableId, onSessionUpdate }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch session data
  const fetchSession = async () => {
    if (!tableId) return;
    
    setLoading(true);
    try {
      const response = await api.get(`/tables/${tableId}/session`);
      setSession(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching session:', err);
      setError('Failed to load session data');
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, [tableId]);

  // Handle session actions
  const handleAction = async (action) => {
    // Check if manager approval is needed
    const requiresManagerApproval = ['end', 'finalize', 'delete'].includes(action);
    
    if (requiresManagerApproval && user?.role !== 'admin' && user?.role !== 'manager') {
      setPendingAction(action);
      setIsPinModalOpen(true);
      return;
    }
    
    await executeAction(action);
  };

  const executeAction = async (action) => {
    if (!tableId) return;
    
    setLoading(true);
    try {
      let response;
      
      switch (action) {
        case 'start':
          response = await api.post(`/tables/${tableId}/start`);
          toast({ title: 'Session Started', description: 'Table session has been started successfully' });
          break;
        case 'pause':
          response = await api.post(`/tables/${tableId}/pause`);
          toast({ title: 'Session Paused', description: 'Table session has been paused' });
          break;
        case 'resume':
          response = await api.post(`/tables/${tableId}/resume`);
          toast({ title: 'Session Resumed', description: 'Table session has been resumed' });
          break;
        case 'end':
          response = await api.post(`/tables/${tableId}/end`);
          toast({ title: 'Session Ended', description: 'Table session has been ended' });
          break;
        case 'finalize':
          response = await api.post(`/tables/${tableId}/finalize`);
          toast({ title: 'Bill Finalized', description: 'Table bill has been finalized' });
          break;
        case 'clean':
          response = await api.post(`/tables/${tableId}/clean`);
          toast({ title: 'Table Cleaned', description: 'Table has been marked as clean' });
          break;
        default:
          throw new Error('Invalid action');
      }
      
      // Update session data
      setSession(response.data);
      
      // Notify parent component
      if (onSessionUpdate) {
        onSessionUpdate(response.data);
      }
    } catch (err) {
      console.error(`Error executing ${action} action:`, err);
      toast({
        title: 'Action Failed',
        description: err.response?.data?.message || `Failed to ${action} session`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return '00:00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return [hours, minutes, secs]
      .map(v => v < 10 ? `0${v}` : v)
      .join(':');
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const statusMap = {
      'active': { color: 'bg-green-100 text-green-800', label: 'Active' },
      'paused': { color: 'bg-yellow-100 text-yellow-800', label: 'Paused' },
      'ended': { color: 'bg-gray-100 text-gray-800', label: 'Ended' },
      'cleaning': { color: 'bg-blue-100 text-blue-800', label: 'Cleaning' },
      'finalized': { color: 'bg-purple-100 text-purple-800', label: 'Finalized' }
    };
    
    const statusInfo = statusMap[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    
    return (
      <Badge className={`${statusInfo.color} font-medium`}>
        {statusInfo.label}
      </Badge>
    );
  };

  if (loading && !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        <p>{error}</p>
        <Button onClick={fetchSession} variant="outline" size="sm" className="mt-2">
          <RotateCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {session ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              Session #{session.id.substring(0, 8)}
              {getStatusBadge(session.status)}
            </CardTitle>
            <CardDescription>
              Started: {new Date(session.startTime).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center">
                <Clock className="h-5 w-5 mr-2 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Duration</p>
                  <p className="text-lg">{formatDuration(session.duration)}</p>
                </div>
              </div>
              <div className="flex items-center">
                <Users className="h-5 w-5 mr-2 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Players</p>
                  <p className="text-lg">{session.playerCount || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center">
                <DollarSign className="h-5 w-5 mr-2 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Current Cost</p>
                  <p className="text-lg">${session.currentCost?.toFixed(2) || '0.00'}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium">Tariff</p>
                <p className="text-lg">{session.tariffName || 'Standard'}</p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            {session.status === 'active' && (
              <>
                <Button variant="outline" size="sm" onClick={() => handleAction('pause')}>
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleAction('finalize')}>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Finalize
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleAction('end')}>
                  <Stop className="h-4 w-4 mr-2" />
                  End
                </Button>
              </>
            )}
            {session.status === 'paused' && (
              <>
                <Button variant="outline" size="sm" onClick={() => handleAction('resume')}>
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleAction('finalize')}>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Finalize
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleAction('end')}>
                  <Stop className="h-4 w-4 mr-2" />
                  End
                </Button>
              </>
            )}
            {session.status === 'ended' && (
              <Button variant="outline" size="sm" onClick={() => handleAction('clean')}>
                <RotateCw className="h-4 w-4 mr-2" />
                Mark as Clean
              </Button>
            )}
            {session.status === 'cleaning' && (
              <Button variant="outline" size="sm" disabled>
                Awaiting Cleaning
              </Button>
            )}
            {session.status === 'finalized' && (
              <Button variant="outline" size="sm" onClick={() => handleAction('end')}>
                <Stop className="h-4 w-4 mr-2" />
                End Session
              </Button>
            )}
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Active Session</CardTitle>
            <CardDescription>
              This table is currently available
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Start a new session to begin tracking time and billing
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => handleAction('start')}>
              <Play className="h-4 w-4 mr-2" />
              Start Session
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* PIN Verification Modal */}
      <PinVerificationModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setPendingAction(null);
        }}
        onVerify={() => {
          executeAction(pendingAction);
          setPendingAction(null);
        }}
        action={pendingAction || ''}
      />
    </div>
  );
};

export default SessionManager;
