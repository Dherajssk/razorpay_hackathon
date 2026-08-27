require('dotenv').config();
const mongoose = require('mongoose');
const Merchant = require('./models/Merchant');
const Product = require('./models/Product');

const sampleMerchant = {
  name: 'John Doe',
  businessName: 'TechStore India',
  email: 'john@techstore.in'
};

const sampleProducts = [
  {
    name: 'ASUS ROG Strix G16',
    brand: 'ASUS',
    category: 'Gaming Laptop',
    price: 78999,
    currency: 'INR',
    stock: 12,
    description: 'High-performance gaming laptop with RTX 5070 graphics for demanding games and development workloads.',
    specifications: {
      ram: 32,
      storage: 1024,
      processor: 'Intel Core i7',
      gpu: 'RTX 5070',
      refreshRate: 165,
      screenSize: 16
    },
    rating: 4.7,
    deliveryDays: 2,
    isActive: true
  },
  {
    name: 'MSI Katana 15',
    brand: 'MSI',
    category: 'Gaming Laptop',
    price: 54999,
    currency: 'INR',
    stock: 8,
    description: 'Affordable gaming laptop with solid performance for casual gaming and productivity.',
    specifications: {
      ram: 16,
      storage: 512,
      processor: 'Intel Core i5',
      gpu: 'RTX 4050',
      refreshRate: 144,
      screenSize: 15.6
    },
    rating: 4.3,
    deliveryDays: 3,
    isActive: true
  },
  {
    name: 'Acer Predator Helios Neo',
    brand: 'Acer',
    category: 'Gaming Laptop',
    price: 129999,
    currency: 'INR',
    stock: 3,
    description: 'Premium gaming laptop with cutting-edge specs and exceptional build quality.',
    specifications: {
      ram: 32,
      storage: 2048,
      processor: 'Intel Core i9',
      gpu: 'RTX 5080',
      refreshRate: 240,
      screenSize: 16
    },
    rating: 4.8,
    deliveryDays: 2,
    isActive: true
  },
  {
    name: 'LG UltraGear 27GN950',
    brand: 'LG',
    category: 'Monitor',
    price: 42999,
    currency: 'INR',
    stock: 15,
    description: '4K gaming monitor with 144Hz refresh rate and HDR support.',
    specifications: {
      refreshRate: 144,
      screenSize: 27
    },
    rating: 4.6,
    deliveryDays: 1,
    isActive: true
  },
  {
    name: 'Samsung Odyssey G7',
    brand: 'Samsung',
    category: 'Monitor',
    price: 38999,
    currency: 'INR',
    stock: 0,
    description: 'Curved gaming monitor with exceptional color accuracy and fast response time.',
    specifications: {
      refreshRate: 240,
      screenSize: 27
    },
    rating: 4.5,
    deliveryDays: 2,
    isActive: true
  },
  {
    name: 'Logitech G Pro X Superlight',
    brand: 'Logitech',
    category: 'Gaming Mouse',
    price: 11999,
    currency: 'INR',
    stock: 25,
    description: 'Ultra-lightweight wireless gaming mouse designed for esports professionals.',
    specifications: {},
    rating: 4.9,
    deliveryDays: 1,
    isActive: true
  },
  {
    name: 'Keychron Q6',
    brand: 'Keychron',
    category: 'Keyboard',
    price: 18999,
    currency: 'INR',
    stock: 10,
    description: 'Premium mechanical keyboard with hot-swappable switches and RGB lighting.',
    specifications: {},
    rating: 4.7,
    deliveryDays: 2,
    isActive: true
  },
  {
    name: 'SteelSeries Arctis Nova Pro',
    brand: 'SteelSeries',
    category: 'Headset',
    price: 24999,
    currency: 'INR',
    stock: 7,
    description: 'High-fidelity gaming headset with active noise cancellation and premium audio.',
    specifications: {},
    rating: 4.6,
    deliveryDays: 2,
    isActive: true
  },
  {
    name: 'Samsung 980 Pro NVMe SSD',
    brand: 'Samsung',
    category: 'SSD',
    price: 12999,
    currency: 'INR',
    stock: 30,
    description: 'Ultra-fast PCIe 4.0 NVMe SSD with 1TB capacity for lightning-speed storage.',
    specifications: {
      storage: 1024
    },
    rating: 4.8,
    deliveryDays: 1,
    isActive: true
  },
  {
    name: 'Corsair Vengeance DDR5 RAM',
    brand: 'Corsair',
    category: 'RAM',
    price: 15999,
    currency: 'INR',
    stock: 20,
    description: 'High-performance DDR5 RAM kit with 32GB capacity for demanding applications.',
    specifications: {
      ram: 32
    },
    rating: 4.7,
    deliveryDays: 1,
    isActive: true
  }
];

async function seedDatabase() {
  try {
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      console.error('MONGODB_URI not found in .env file');
      process.exit(1);
    }

    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Product.deleteMany({});
    await Merchant.deleteMany({});
    console.log('Cleared existing data');

    // Create merchant
    const merchant = await Merchant.create(sampleMerchant);
    console.log('Created merchant:', merchant.businessName);

    // Add merchantId to all products
    const productsWithMerchant = sampleProducts.map(product => ({
      ...product,
      merchantId: merchant._id
    }));

    // Create products
    const products = await Product.insertMany(productsWithMerchant);
    console.log(`Created ${products.length} products`);

    console.log('\nSeed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seedDatabase();
