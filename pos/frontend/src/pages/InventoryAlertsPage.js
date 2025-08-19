import React from 'react';
import { Container, Typography, Box, Breadcrumbs, Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import InventoryAlerts from '../components/inventory/InventoryAlerts';

const InventoryAlertsPage = () => {
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Breadcrumbs aria-label="breadcrumb">
          <Link component={RouterLink} to="/" color="inherit">
            Dashboard
          </Link>
          <Link component={RouterLink} to="/inventory" color="inherit">
            Inventory
          </Link>
          <Typography color="text.primary">Alerts</Typography>
        </Breadcrumbs>
      </Box>
      
      <Typography variant="h4" gutterBottom>
        Inventory Alerts
      </Typography>
      
      <InventoryAlerts />
    </Container>
  );
};

export default InventoryAlertsPage;
