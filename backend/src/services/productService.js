const Product = require('../models/Product');

class ProductService {
  async createProduct(productData) {
    const product = new Product(productData);
    return await product.save();
  }

  async getProducts(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const products = await Product.find()
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    
    const total = await Product.countDocuments();
    
    return {
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getProductById(id) {
    return await Product.findById(id);
  }

  async updateProduct(id, updateData) {
    return await Product.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
  }

  async deleteProduct(id) {
    return await Product.findByIdAndDelete(id);
  }

  async searchProducts(filters) {
    const query = {};

    // Category filter (case-insensitive)
    if (filters.category) {
      query.category = new RegExp(filters.category, 'i');
    }

    // Brand filter (case-insensitive)
    if (filters.brand) {
      query.brand = new RegExp(filters.brand, 'i');
    }

    // Price filters
    if (filters.minPrice !== undefined) {
      query.price = { ...query.price, $gte: parseFloat(filters.minPrice) };
    }
    if (filters.maxPrice !== undefined) {
      query.price = { ...query.price, $lte: parseFloat(filters.maxPrice) };
    }

    // RAM filter
    if (filters.ram) {
      query['specifications.ram'] = parseInt(filters.ram);
    }

    // Storage filter
    if (filters.storage) {
      query['specifications.storage'] = parseInt(filters.storage);
    }

    // GPU filter (partial match)
    if (filters.gpu) {
      query['specifications.gpu'] = new RegExp(filters.gpu, 'i');
    }

    // Refresh rate filter (greater than or equal)
    if (filters.refreshRate) {
      query['specifications.refreshRate'] = { $gte: parseInt(filters.refreshRate) };
    }

    // Stock filter
    if (filters.inStock === 'true') {
      query.stock = { $gt: 0 };
    }

    // Active products only
    query.isActive = true;

    const products = await Product.find(query).sort({ createdAt: -1 });
    return products;
  }
}

module.exports = new ProductService();
