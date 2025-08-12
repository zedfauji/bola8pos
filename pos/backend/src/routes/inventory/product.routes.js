const express = require('express');
const router = express.Router();
const productController = require('../../controllers/inventory/product.controller');
const { productSchema, variantSchema } = require('../../validators/inventory.validator');
const validate = require('../../middleware/validate');

// Get all products with variants
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, includeInactive } = req.query;
    const products = await productController.findWithVariants(
      null, 
      includeInactive === 'true'
    );
    res.json(products);
  } catch (error) {
    next(error);
  }
});

// Get a single product with variants
router.get('/:id', async (req, res, next) => {
  try {
    const product = await productController.findWithVariants(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    next(error);
  }
});

// Create a new product
router.post('/', validate(productSchema), async (req, res, next) => {
  try {
    const product = await productController.create(req.validated || req.body);
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

// Update a product
router.put('/:id', validate(productSchema.partial()), async (req, res, next) => {
  try {
    const product = await productController.update(req.params.id, req.validated || req.body);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    next(error);
  }
});

// Delete a product
router.delete('/:id', async (req, res, next) => {
  try {
    await productController.delete(req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// Get product inventory
router.get('/:id/inventory', async (req, res, next) => {
  try {
    const inventory = await productController.getInventory(req.params.id);
    res.json(inventory);
  } catch (error) {
    next(error);
  }
});

// Add variant to product
router.post('/:id/variants', validate(variantSchema), async (req, res, next) => {
  try {
    const variant = await productController.addVariant(req.params.id, req.body);
    res.status(201).json(variant);
  } catch (error) {
    next(error);
  }
});

// Update variant
router.put('/variants/:variantId', validate(variantSchema.partial()), async (req, res, next) => {
  try {
    const variant = await productController.updateVariant(req.params.variantId, req.body);
    if (!variant) {
      return res.status(404).json({ error: 'Variant not found' });
    }
    res.json(variant);
  } catch (error) {
    next(error);
  }
});

// Delete variant
router.delete('/variants/:variantId', async (req, res, next) => {
  try {
    await productController.deleteVariant(req.params.variantId);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
