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
  Divider, 
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Grid,
  Badge,
  Snackbar,
  Alert
} from '@mui/material';
import { 
  Notifications as NotificationsIcon,
  NotificationsActive as NotificationsActiveIcon,
  Close as CloseIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { SocketContext } from '../../contexts/socketContext';
import { AuthContext } from '../../contexts/authContext';
import { formatDistanceToNow } from 'date-fns';

const InventoryAlerts = () => {
  const { socket } = useContext(SocketContext);
  const { user } = useContext(AuthContext);
  const [alerts, setAlerts] = useState([]);
  const [filteredAlerts, setFilteredAlerts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [threshold, setThreshold] = useState(10);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });

  // Check if user has permission to view alerts
  const hasPermission = user && (user.role === 'admin' || user.role === 'manager');

  useEffect(() => {
    if (!socket || !hasPermission) return;

    // Fetch categories and locations for filtering
    fetchCategories();
    fetchLocations();

    // Listen for inventory alerts
    socket.on('inventory:alert', handleAlert);

    // Subscribe to alerts on component mount
    handleSubscribe();

    return () => {
      // Unsubscribe and remove listeners on unmount
      if (socket) {
        socket.off('inventory:alert', handleAlert);
        socket.emit('inventory:unsubscribe');
      }
    };
  }, [socket, hasPermission]);

  useEffect(() => {
    // Apply filters whenever alerts or filter selections change
    applyFilters();
  }, [alerts, selectedCategory, selectedLocation]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/inventory/categories');
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/inventory/locations');
      const data = await response.json();
      setLocations(data);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

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
        // Add new alert
        return [{ ...alert, timestamp: new Date() }, ...prevAlerts];
      }
    });

    // Show notification for new alert
    setNotification({
      open: true,
      message: `Low stock alert: ${alert.product.name} at ${alert.location.name}`,
      severity: 'warning'
    });
  };

  const handleSubscribe = () => {
    if (!socket) return;

    socket.emit('inventory:subscribe', {
      threshold: threshold,
      categoryId: selectedCategory !== 'all' ? selectedCategory : undefined,
      locationId: selectedLocation !== 'all' ? selectedLocation : undefined
    });

    setIsSubscribed(true);
    setNotification({
      open: true,
      message: 'Subscribed to inventory alerts',
      severity: 'success'
    });
  };

  const handleUnsubscribe = () => {
    if (!socket) return;

    socket.emit('inventory:unsubscribe');
    setIsSubscribed(false);
    setNotification({
      open: true,
      message: 'Unsubscribed from inventory alerts',
      severity: 'info'
    });
  };

  const handleRefresh = () => {
    if (!socket) return;

    socket.emit('inventory:checkLowStock', {
      threshold: threshold,
      categoryId: selectedCategory !== 'all' ? selectedCategory : undefined,
      locationId: selectedLocation !== 'all' ? selectedLocation : undefined
    });

    setNotification({
      open: true,
      message: 'Refreshing inventory alerts...',
      severity: 'info'
    });
  };

  const applyFilters = () => {
    let filtered = [...alerts];

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(alert => 
        alert.product.category && alert.product.category._id === selectedCategory
      );
    }

    if (selectedLocation !== 'all') {
      filtered = filtered.filter(alert => 
        alert.location._id === selectedLocation
      );
    }

    setFilteredAlerts(filtered);
  };

  const handleUpdateSettings = () => {
    if (!socket) return;

    // Unsubscribe first
    socket.emit('inventory:unsubscribe');

    // Then resubscribe with new settings
    socket.emit('inventory:subscribe', {
      threshold: threshold,
      categoryId: selectedCategory !== 'all' ? selectedCategory : undefined,
      locationId: selectedLocation !== 'all' ? selectedLocation : undefined
    });

    setShowSettings(false);
    setNotification({
      open: true,
      message: 'Alert settings updated',
      severity: 'success'
    });
  };

  const handleDismissAlert = (alertToRemove) => {
    setAlerts(prevAlerts => 
      prevAlerts.filter(alert => 
        !(alert.product._id === alertToRemove.product._id && 
          alert.location._id === alertToRemove.location._id)
      )
    );
  };

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  if (!hasPermission) {
    return (
      <Paper sx={{ p: 3, mt: 2 }}>
        <Typography variant="h6">Unauthorized</Typography>
        <Typography>You don't have permission to view inventory alerts.</Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Badge badgeContent={filteredAlerts.length} color="error" sx={{ mr: 1 }}>
              {isSubscribed ? <NotificationsActiveIcon color="primary" /> : <NotificationsIcon />}
            </Badge>
            <Typography variant="h6">Inventory Alerts</Typography>
          </Box>
          <Box>
            <Button 
              variant="outlined" 
              startIcon={<RefreshIcon />} 
              onClick={handleRefresh}
              sx={{ mr: 1 }}
            >
              Refresh
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<SettingsIcon />} 
              onClick={() => setShowSettings(!showSettings)}
              sx={{ mr: 1 }}
            >
              Settings
            </Button>
            {isSubscribed ? (
              <Button 
                variant="contained" 
                color="secondary" 
                onClick={handleUnsubscribe}
              >
                Unsubscribe
              </Button>
            ) : (
              <Button 
                variant="contained" 
                color="primary" 
                onClick={handleSubscribe}
              >
                Subscribe
              </Button>
            )}
          </Box>
        </Box>

        {showSettings && (
          <Paper elevation={3} sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Alert Settings</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={selectedCategory}
                    label="Category"
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <MenuItem value="all">All Categories</MenuItem>
                    {categories.map(category => (
                      <MenuItem key={category._id} value={category._id}>
                        {category.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Location</InputLabel>
                  <Select
                    value={selectedLocation}
                    label="Location"
                    onChange={(e) => setSelectedLocation(e.target.value)}
                  >
                    <MenuItem value="all">All Locations</MenuItem>
                    {locations.map(location => (
                      <MenuItem key={location._id} value={location._id}>
                        {location.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  label="Threshold %"
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  inputProps={{ min: 0, max: 100 }}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <Button 
                  variant="contained" 
                  color="primary" 
                  fullWidth 
                  onClick={handleUpdateSettings}
                  sx={{ height: '100%' }}
                >
                  Apply
                </Button>
              </Grid>
            </Grid>
          </Paper>
        )}

        {filteredAlerts.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="textSecondary">
              No alerts to display
            </Typography>
          </Box>
        ) : (
          <List>
            {filteredAlerts.map((alert, index) => (
              <React.Fragment key={`${alert.product._id}-${alert.location._id}`}>
                {index > 0 && <Divider />}
                <ListItem
                  secondaryAction={
                    <IconButton edge="end" onClick={() => handleDismissAlert(alert)}>
                      <CloseIcon />
                    </IconButton>
                  }
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mr: 1 }}>
                          {alert.product.name}
                        </Typography>
                        <Chip 
                          label={alert.stockPercentage <= 0 ? 'Out of Stock' : `${alert.stockPercentage}% left`}
                          color={alert.stockPercentage <= 0 ? 'error' : 'warning'}
                          size="small"
                        />
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography variant="body2" component="span">
                          Location: {alert.location.name} | 
                          Current: {alert.currentStock} | 
                          Min: {alert.minStock} | 
                          Deficit: {alert.deficit}
                        </Typography>
                        <Typography variant="caption" display="block" color="textSecondary">
                          {alert.timestamp ? formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true }) : ''}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>

      <Snackbar 
        open={notification.open} 
        autoHideDuration={6000} 
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseNotification} severity={notification.severity} sx={{ width: '100%' }}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default InventoryAlerts;
