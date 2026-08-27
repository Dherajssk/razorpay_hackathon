const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Search must come before /:id to avoid route conflicts
router.get('/search', productController.searchProducts.bind(productController));

router.post('/', productController.createProduct.bind(productController));
router.get('/', productController.getProducts.bind(productController));
router.get('/:id', productController.getProductById.bind(productController));
router.patch('/:id', productController.updateProduct.bind(productController));
router.delete('/:id', productController.deleteProduct.bind(productController));

module.exports = router;
