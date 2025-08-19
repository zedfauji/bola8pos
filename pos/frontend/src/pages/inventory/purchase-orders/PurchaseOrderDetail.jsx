import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Print as PrintIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

/**
 * Purchase Order Detail component
 * @param {Object} props
 * @param {Object} props.purchaseOrder - Purchase order data
 * @param {Function} props.onBack - Function to handle back button click
 * @returns {JSX.Element}
 */
const PurchaseOrderDetail = ({ purchaseOrder, onBack }) => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [processing, setProcessing] = useState(false);
  
  // Format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };
  
  // Get status chip color
  const getStatusChipColor = (status) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'received':
        return 'success';
      case 'cancelled':
        return 'error';
      case 'partial':
        return 'info';
      default:
        return 'default';
    }
  };
  
  // Handle edit
  const handleEdit = () => {
    navigate(`/inventory/purchase-orders/edit/${purchaseOrder.id}`);
  };
  
  // Handle print
  const handlePrint = () => {
    // In a real app, this would generate a printable version
    enqueueSnackbar('Printing purchase order...', { variant: 'info' });
  };
  
  // Open confirm dialog
  const openConfirmDialog = (action) => {
    setConfirmAction(action);
    setConfirmDialogOpen(true);
  };
  
  // Handle confirm dialog close
  const handleConfirmDialogClose = () => {
    setConfirmDialogOpen(false);
    setConfirmAction(null);
  };
  
  // Handle confirm action
  const handleConfirmAction = async () => {
    try {
      setProcessing(true);
      
      // In a real app, this would be an API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      if (confirmAction === 'receive') {
        enqueueSnackbar('Purchase order marked as received', { variant: 'success' });
      } else if (confirmAction === 'cancel') {
        enqueueSnackbar('Purchase order cancelled', { variant: 'success' });
      } else if (confirmAction === 'delete') {
        enqueueSnackbar('Purchase order deleted', { variant: 'success' });
        onBack();
        return;
      }
      
      // Close dialog
      handleConfirmDialogClose();
      
      // Refresh data (in a real app)
      // fetchPurchaseOrder();
      
    } catch (err) {
      enqueueSnackbar(`Error: ${err.message || 'Something went wrong'}`, { variant: 'error' });
    } finally {
      setProcessing(false);
    }
  };
  
  // Get confirm dialog content
  const getConfirmDialogContent = () => {
    switch (confirmAction) {
      case 'receive':
        return {
          title: 'Confirm Receive',
          content: 'Are you sure you want to mark this purchase order as received? This action cannot be undone.',
          confirmText: 'Mark as Received',
        };
      case 'cancel':
        return {
          title: 'Confirm Cancellation',
          content: 'Are you sure you want to cancel this purchase order? This action cannot be undone.',
          confirmText: 'Cancel Order',
        };
      case 'delete':
        return {
          title: 'Confirm Deletion',
          content: 'Are you sure you want to delete this purchase order? This action cannot be undone.',
          confirmText: 'Delete',
        };
      default:
        return {
          title: 'Confirm',
          content: 'Are you sure?',
          confirmText: 'Confirm',
        };
    }
  };
  
  // Get action buttons based on status
  const getActionButtons = () => {
    const buttons = [];
    
    // Print button (always available)
    buttons.push(
      <Button
        key="print"
        variant="outlined"
        startIcon={<PrintIcon />}
        onClick={handlePrint}
        sx={{ mr: 1 }}
      >
        Print
      </Button>
    );
    
    // Status-specific buttons
    if (purchaseOrder.status === 'pending') {
      buttons.push(
        <Button
          key="edit"
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={handleEdit}
          sx={{ mr: 1 }}
        >
          Edit
        </Button>
      );
      
      buttons.push(
        <Button
          key="receive"
          variant="contained"
          color="success"
          startIcon={<CheckCircleIcon />}
          onClick={() => openConfirmDialog('receive')}
          sx={{ mr: 1 }}
        >
          Mark as Received
        </Button>
      );
      
      buttons.push(
        <Button
          key="cancel"
          variant="outlined"
          color="error"
          startIcon={<CancelIcon />}
          onClick={() => openConfirmDialog('cancel')}
        >
          Cancel Order
        </Button>
      );
    }
    
    // Delete button (always available but with different styling)
    buttons.push(
      <Button
        key="delete"
        variant="text"
        color="error"
        startIcon={<DeleteIcon />}
        onClick={() => openConfirmDialog('delete')}
        sx={{ ml: 'auto' }}
      >
        Delete
      </Button>
    );
    
    return buttons;
  };
  
  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
        <IconButton onClick={onBack} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5">Purchase Order Details</Typography>
      </Box>
      
      {/* Order Info */}
      <Card sx={{ mb: 3 }}>
        <CardHeader
          title={
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="h6" sx={{ mr: 2 }}>
                {purchaseOrder.id}
              </Typography>
              <Chip
                label={purchaseOrder.status.charAt(0).toUpperCase() + purchaseOrder.status.slice(1)}
                color={getStatusChipColor(purchaseOrder.status)}
                size="small"
              />
            </Box>
          }
        />
        <Divider />
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Supplier
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {purchaseOrder.supplierName}
              </Typography>
              
              <Typography variant="subtitle2" color="text.secondary">
                Order Date
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {formatDate(purchaseOrder.orderDate)}
              </Typography>
              
              <Typography variant="subtitle2" color="text.secondary">
                Expected Delivery Date
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {formatDate(purchaseOrder.expectedDeliveryDate)}
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Created By
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {purchaseOrder.createdBy}
              </Typography>
              
              <Typography variant="subtitle2" color="text.secondary">
                Created At
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {formatDate(purchaseOrder.createdAt)}
              </Typography>
              
              {purchaseOrder.status === 'received' && (
                <>
                  <Typography variant="subtitle2" color="text.secondary">
                    Received By
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {purchaseOrder.receivedBy || 'N/A'}
                  </Typography>
                  
                  <Typography variant="subtitle2" color="text.secondary">
                    Received At
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {formatDate(purchaseOrder.receivedAt)}
                  </Typography>
                </>
              )}
              
              {purchaseOrder.status === 'cancelled' && (
                <>
                  <Typography variant="subtitle2" color="text.secondary">
                    Cancelled By
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {purchaseOrder.cancelledBy || 'N/A'}
                  </Typography>
                  
                  <Typography variant="subtitle2" color="text.secondary">
                    Cancelled At
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {formatDate(purchaseOrder.cancelledAt)}
                  </Typography>
                  
                  <Typography variant="subtitle2" color="text.secondary">
                    Cancellation Reason
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {purchaseOrder.cancellationReason || 'No reason provided'}
                  </Typography>
                </>
              )}
            </Grid>
            
            {purchaseOrder.notes && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  Notes
                </Typography>
                <Typography variant="body1">
                  {purchaseOrder.notes}
                </Typography>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>
      
      {/* Order Items */}
      <Card sx={{ mb: 3 }}>
        <CardHeader title="Order Items" />
        <Divider />
        <CardContent>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell align="right">Quantity</TableCell>
                  <TableCell align="right">Unit Price</TableCell>
                  <TableCell align="right">Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {purchaseOrder.items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell align="right">{item.quantity}</TableCell>
                    <TableCell align="right">${item.unitPrice.toFixed(2)}</TableCell>
                    <TableCell align="right">${item.total.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3} align="right">
                    <Typography variant="subtitle1">Total:</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="subtitle1">${purchaseOrder.totalAmount.toFixed(2)}</Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
      
      {/* Action Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 3 }}>
        {getActionButtons()}
      </Box>
      
      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={handleConfirmDialogClose}
        aria-labelledby="confirm-dialog-title"
      >
        <DialogTitle id="confirm-dialog-title">
          {getConfirmDialogContent().title}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {getConfirmDialogContent().content}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfirmDialogClose} disabled={processing}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmAction}
            color={confirmAction === 'delete' || confirmAction === 'cancel' ? 'error' : 'primary'}
            variant="contained"
            disabled={processing}
            autoFocus
          >
            {processing ? 'Processing...' : getConfirmDialogContent().confirmText}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

PurchaseOrderDetail.propTypes = {
  purchaseOrder: PropTypes.shape({
    id: PropTypes.string.isRequired,
    supplierId: PropTypes.number.isRequired,
    supplierName: PropTypes.string.isRequired,
    orderDate: PropTypes.instanceOf(Date).isRequired,
    expectedDeliveryDate: PropTypes.instanceOf(Date).isRequired,
    status: PropTypes.oneOf(['pending', 'received', 'cancelled', 'partial']).isRequired,
    totalAmount: PropTypes.number.isRequired,
    items: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.number,
        productId: PropTypes.number.isRequired,
        productName: PropTypes.string.isRequired,
        quantity: PropTypes.number.isRequired,
        unitPrice: PropTypes.number.isRequired,
        total: PropTypes.number.isRequired,
      })
    ).isRequired,
    notes: PropTypes.string,
    createdBy: PropTypes.string.isRequired,
    createdAt: PropTypes.instanceOf(Date).isRequired,
    receivedBy: PropTypes.string,
    receivedAt: PropTypes.instanceOf(Date),
    cancelledBy: PropTypes.string,
    cancelledAt: PropTypes.instanceOf(Date),
    cancellationReason: PropTypes.string,
  }).isRequired,
  onBack: PropTypes.func.isRequired,
};

export default PurchaseOrderDetail;
