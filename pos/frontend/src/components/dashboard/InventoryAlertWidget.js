import React, { useState, useEffect, useContext } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  List, 
  ListItem, 
  ListItemText, 
  Chip, 
  IconButton, 
  Badge,
  Button
} from '@mui/material';
import { 
  Notifications as NotificationsIcon,
  NotificationsActive as NotificationsActiveIcon,
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';
import { SocketContext } from '../../contexts/socketContext';
import { AuthContext } from '../../contexts/authContext';
import { useNavigate } from 'react-router-dom';

/**
 * A compact widget for displaying inventory alerts on the dashboard
 */
const InventoryAlertWidget = () => {
  const { socket } = useContext(SocketContext);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Check if user has permission to view alerts
  const hasPermission = user && (user.role === 'admin' || user.role === 'manager');

  useEffect(() => {
    if (!socket || !hasPermission) return;

    // Listen for inventory alerts
    socket.on('inventory:alert', handleAlert);

    // Subscribe to alerts on component mount with default settings
    socket.emit('inventory:subscribe', { threshold: 15 });
    setIsSubscribed(true);

    return () => {
      if (socket) {
        socket.off('inventory:alert', handleAlert);
      }
    };
  }, [socket, hasPermission]);

  const handleAlert = (alert) => {
    // Add new alert to the beginning of the list
    setAlerts(prevAlerts => {
      // Check if alert already exists
      const exists = prevAlerts.some(a => 
        a.product._id === alert.product._id && 
        a.location._id === alert.location._id
      );

      if (exists) {
        // Update existing alert
        return prevAlerts.map(a => 
          (a.product._id === alert.product._id && a.location._id === alert.location._id) 
            ? { ...alert, timestamp: new Date() } 
            : a
        );
      } else {
        // Add new alert and limit to 5 most recent
        return [{ ...alert, timestamp: new Date() }, ...prevAlerts].slice(0, 5);
      }
    });
  };

  const handleViewAllAlerts = () => {
    navigate('/inventory/alerts');
  };

  if (!hasPermission) {
    return null;
  }

  return (
    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Badge badgeContent={alerts.length} color="error" sx={{ mr: 1 }}>
            {isSubscribed ? <NotificationsActiveIcon color="primary" /> : <NotificationsIcon />}
          </Badge>
          <Typography variant="h6">Low Stock Alerts</Typography>
        </Box>
      </Box>

      {alerts.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4, flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body1" color="textSecondary">
            No alerts to display
          </Typography>
        </Box>
      ) : (
        <List sx={{ flexGrow: 1, overflow: 'auto' }}>
          {alerts.slice(0, 5).map((alert) => (
            <ListItem key={`${alert.product._id}-${alert.location._id}`} dense divider>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', mr: 1 }}>
                      {alert.product.name}
                    </Typography>
                    <Chip 
                      label={alert.stockPercentage <= 0 ? 'Out' : `${alert.stockPercentage}%`}
                      color={alert.stockPercentage <= 0 ? 'error' : 'warning'}
                      size="small"
                    />
                  </Box>
                }
                secondary={
                  <Typography variant="caption" component="span">
                    {alert.location.name} | Current: {alert.currentStock} | Min: {alert.minStock}
                  </Typography>
                }
              />
            </ListItem>
          ))}
        </List>
      )}

      <Box sx={{ mt: 2, textAlign: 'right' }}>
        <Button 
          variant="text" 
          color="primary" 
          endIcon={<ArrowForwardIcon />}
          onClick={handleViewAllAlerts}
          size="small"
        >
          View All
        </Button>
      </Box>
    </Paper>
  );
};

export default InventoryAlertWidget;
