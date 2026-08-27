# AI-Native Commerce Platform - Backend (Day 1)

## Project Purpose
AI-Native Commerce Platform is a hackathon project building an intelligent e-commerce system. This backend powers the merchant's product catalog and will serve as the foundation for AI-powered buyer interactions.

## Day 1 Scope
**Current Implementation:** Merchant commerce backend with product management and search

**What's Built:**
- MongoDB product database with structured specifications
- RESTful APIs for product CRUD operations
- Advanced product search and filtering
- Clean, modular architecture ready for MCP integration

## Technology Stack
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB
- **ODM:** Mongoose
- **Environment:** dotenv
- **CORS:** enabled for frontend integration

## Architecture
```
backend/
├── src/
│   ├── config/
│   │   └── db.js                 # MongoDB connection
│   ├── models/
│   │   ├── Product.js            # Product schema with specifications
│   │   └── Merchant.js           # Merchant schema
│   ├── controllers/
│   │   └── productController.js  # Request handling
│   ├── services/
│   │   └── productService.js     # Business logic
│   ├── routes/
│   │   └── productRoutes.js      # API routes
│   ├── middleware/
│   │   └── errorMiddleware.js    # Error handling
│   ├── server.js                 # App entry point
│   └── seed.js                   # Sample data seeder
├── .env                          # Environment variables
└── package.json
```

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure MongoDB
Edit `.env` file and add your MongoDB Atlas connection string:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/commerce?retryWrites=true&w=majority
```

### 3. Seed Sample Data (Optional)
```bash
npm run seed
```

This creates:
- 1 demo merchant
- 10 sample products (gaming laptops, monitors, peripherals, etc.)

### 4. Start Server
```bash
npm run dev
```

Server runs on: `http://localhost:5000`

## API Endpoints

### Root
```
GET /
Returns API information
```

### Products

#### Create Product
```
POST /api/products
Content-Type: application/json

{
  "merchantId": "507f1f77bcf86cd799439011",
  "name": "ASUS ROG Strix G16",
  "brand": "ASUS",
  "category": "Gaming Laptop",
  "price": 78999,
  "stock": 12,
  "description": "High-performance gaming laptop...",
  "specifications": {
    "ram": 32,
    "storage": 1024,
    "processor": "Intel Core i7",
    "gpu": "RTX 5070",
    "refreshRate": 165,
    "screenSize": 16
  },
  "rating": 4.7,
  "deliveryDays": 2
}
```

#### Get All Products
```
GET /api/products
GET /api/products?page=1&limit=20

Returns paginated product list
```

#### Get Single Product
```
GET /api/products/:id

Returns product by MongoDB ObjectId
```

#### Update Product
```
PATCH /api/products/:id
Content-Type: application/json

{
  "price": 74999,
  "stock": 15
}
```

#### Delete Product
```
DELETE /api/products/:id

Removes product from database
```

#### Search Products
```
GET /api/products/search?[filters]

Available Filters:
- category        (case-insensitive, e.g., "Gaming Laptop")
- brand          (case-insensitive, e.g., "ASUS")
- minPrice       (number, e.g., 50000)
- maxPrice       (number, e.g., 80000)
- ram            (number in GB, e.g., 32)
- storage        (number in GB, e.g., 1024)
- gpu            (partial match, e.g., "RTX 5070")
- refreshRate    (minimum Hz, e.g., 144)
- inStock        (boolean string "true" for available products)

Examples:
/api/products/search?category=Gaming%20Laptop
/api/products/search?maxPrice=80000&ram=32
/api/products/search?category=Gaming%20Laptop&maxPrice=80000&ram=32&inStock=true
/api/products/search?refreshRate=144
/api/products/search?gpu=RTX%205070
```

## Product Schema

### Structured Specifications
Products use structured fields instead of unstructured descriptions:

```javascript
{
  specifications: {
    ram: 32,              // GB
    storage: 1024,        // GB
    processor: "Intel Core i7",
    gpu: "RTX 5070",
    refreshRate: 165,     // Hz
    screenSize: 16        // inches
  }
}
```

This enables:
- Precise filtering by technical specs
- Future AI agent searches with structured queries
- Accurate inventory gap detection

## Testing

### Test Search Filters
```bash
# All gaming laptops
curl "http://localhost:5000/api/products/search?category=Gaming%20Laptop"

# Budget gaming laptops
curl "http://localhost:5000/api/products/search?category=Gaming%20Laptop&maxPrice=60000"

# High-end gaming laptops with 32GB RAM
curl "http://localhost:5000/api/products/search?category=Gaming%20Laptop&ram=32&maxPrice=80000"

# High refresh rate monitors
curl "http://localhost:5000/api/products/search?category=Monitor&refreshRate=144"

# In-stock products only
curl "http://localhost:5000/api/products/search?inStock=true"

# Impossible query (should return empty results)
curl "http://localhost:5000/api/products/search?category=Gaming%20Laptop&maxPrice=40000&ram=64"
```

## Future Enhancements (Not Day 1)

The following features will be added in subsequent days:
- **Day 2:** MCP (Model Context Protocol) server integration
- **Day 3:** AI buyer agent with LLM integration (OpenAI/Gemini/Claude)
- **Day 4:** Demand intelligence and analytics
- **Day 5:** Razorpay payment integration
- **Day 6:** Merchant dashboard UI
- **Day 7:** Authentication and authorization

## Important Notes

### Why Structured Specifications?
Traditional e-commerce stores specs in unstructured descriptions:
```
"Powerful gaming laptop with 32GB RAM and RTX graphics..."
```

We use structured fields:
```javascript
specifications: { ram: 32, gpu: "RTX 5070" }
```

This enables:
1. **Precise filtering:** Users can search exactly "32GB RAM + RTX 5070"
2. **AI agent compatibility:** MCP tools can query structured data
3. **Gap detection:** Identify missing inventory (e.g., no 64GB laptops under ₹40,000)

### MCP-Ready Architecture
Service layer is designed for MCP tool integration:
```javascript
// Future MCP tool will call:
productService.searchProducts({ category: "Gaming Laptop", ram: 32 })
```

No MCP code exists yet. Day 2 will add the MCP server.

## Environment Variables
```
MONGODB_URI=    # Your MongoDB Atlas connection string (required)
```

## Development
```bash
npm run dev     # Start with nodemon (auto-reload)
npm start       # Production mode
npm run seed    # Seed sample data
```

## License
MIT
