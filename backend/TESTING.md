# API Testing Guide - Day 1

## Prerequisites
1. Add your MongoDB URI to `.env`:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/commerce
```

2. Seed the database:
```bash
npm run seed
```

3. Start the server:
```bash
npm run dev
```

Server should be running on `http://localhost:5000`

## Test Commands (using curl)

### Test 1: Root Endpoint
```bash
curl http://localhost:5000
```
**Expected:** API information with success message

### Test 2: Get All Products
```bash
curl http://localhost:5000/api/products
```
**Expected:** List of 10 products with pagination

### Test 3: Search by Category
```bash
curl "http://localhost:5000/api/products/search?category=Gaming%20Laptop"
```
**Expected:** Only gaming laptops (3 products)

### Test 4: Search by Max Price
```bash
curl "http://localhost:5000/api/products/search?maxPrice=80000"
```
**Expected:** Products under ₹80,000

### Test 5: Combined Search - Gaming Laptop + Price + RAM
```bash
curl "http://localhost:5000/api/products/search?category=Gaming%20Laptop&maxPrice=80000&ram=32"
```
**Expected:** High-end gaming laptops with 32GB RAM under ₹80,000 (should return ASUS ROG Strix G16)

### Test 6: Search by Refresh Rate
```bash
curl "http://localhost:5000/api/products/search?refreshRate=144"
```
**Expected:** Products with refresh rate >= 144Hz (monitors and some laptops)

### Test 7: In-Stock Only
```bash
curl "http://localhost:5000/api/products/search?inStock=true"
```
**Expected:** All products except Samsung Odyssey G7 (which has 0 stock)

### Test 8: GPU Search
```bash
curl "http://localhost:5000/api/products/search?gpu=RTX%205070"
```
**Expected:** Products with RTX 5070 GPU

### Test 9: Impossible Query (IMPORTANT - Zero Results)
```bash
curl "http://localhost:5000/api/products/search?category=Gaming%20Laptop&maxPrice=40000&ram=64"
```
**Expected:** Empty array with count: 0
**Why Important:** This represents unfulfilled buyer demand that will be tracked in future days

### Test 10: Get Single Product
First, get a product ID from Test 2, then:
```bash
curl http://localhost:5000/api/products/YOUR_PRODUCT_ID_HERE
```
**Expected:** Single product details

### Test 11: Create Product
```bash
curl -X POST http://localhost:5000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "YOUR_MERCHANT_ID_FROM_SEED",
    "name": "Test Product",
    "brand": "Test Brand",
    "category": "Test Category",
    "price": 9999,
    "stock": 5,
    "description": "Test description",
    "specifications": {
      "ram": 16
    },
    "rating": 4.5,
    "deliveryDays": 3
  }'
```
**Expected:** 201 Created with product data

### Test 12: Update Product
```bash
curl -X PATCH http://localhost:5000/api/products/YOUR_PRODUCT_ID \
  -H "Content-Type: application/json" \
  -d '{
    "price": 74999,
    "stock": 20
  }'
```
**Expected:** Updated product data

### Test 13: Delete Product
```bash
curl -X DELETE http://localhost:5000/api/products/YOUR_PRODUCT_ID
```
**Expected:** Success message

### Test 14: Invalid Product ID
```bash
curl http://localhost:5000/api/products/invalid-id-123
```
**Expected:** 400 Bad Request - "Invalid product ID"

### Test 15: Non-existent Product
```bash
curl http://localhost:5000/api/products/507f1f77bcf86cd799439011
```
**Expected:** 404 Not Found - "Product not found"

## Using Postman

Import this collection or manually create requests:

### GET Requests
- Root: `GET http://localhost:5000`
- All Products: `GET http://localhost:5000/api/products`
- Search: `GET http://localhost:5000/api/products/search?category=Gaming Laptop&maxPrice=80000`

### POST Request
- URL: `POST http://localhost:5000/api/products`
- Headers: `Content-Type: application/json`
- Body (raw JSON): See Test 11 above

### PATCH Request
- URL: `PATCH http://localhost:5000/api/products/:id`
- Headers: `Content-Type: application/json`
- Body: `{"price": 74999, "stock": 20}`

### DELETE Request
- URL: `DELETE http://localhost:5000/api/products/:id`

## Key Test Cases

### ✅ MUST PASS
1. All products return successfully
2. Category filter works (case-insensitive)
3. Price range filtering works
4. Multiple filters work together
5. RAM/GPU/Refresh rate specs filter correctly
6. In-stock filtering works
7. Invalid IDs return 400
8. Missing products return 404
9. **Empty results for impossible queries** (critical for AI demand tracking)

### Sample Data Verification
After seeding, verify:
- 1 merchant exists
- 10 products exist
- Categories include: Gaming Laptop, Monitor, Keyboard, Gaming Mouse, Headset, SSD, RAM
- Some products have 32GB RAM (high-end laptops)
- Most products have 16GB RAM (mid-range)
- Samsung Odyssey G7 has 0 stock (out of stock scenario)

## Troubleshooting

### Server won't start
- Check if MONGODB_URI is set in `.env`
- Verify MongoDB Atlas allows your IP address
- Check if port 5000 is available

### Empty results
- Run `npm run seed` to populate database
- Check MongoDB Atlas connection
- Verify database name in connection string

### Validation errors
- Check request body matches Product schema
- Ensure required fields are present
- Verify data types (price should be number, not string)
