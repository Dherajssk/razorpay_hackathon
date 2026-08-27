# Merchant Commerce MCP Server - Day 2

## Overview
The Merchant Commerce MCP Server exposes the merchant's product catalog capabilities as MCP (Model Context Protocol) tools that can be used by AI agents.

## Architecture

```
AI AGENT
    ↓
MCP CLIENT
    ↓
MCP PROTOCOL (stdio)
    ↓
MERCHANT MCP SERVER
    ↓
    ├── search_products    → productService.searchProducts()
    ├── get_product        → productService.getProductById()
    └── check_inventory    → productService.getProductById()
    ↓
MONGODB
```

Both REST API and MCP Server share the same service layer - no duplicated business logic.

## Installation

MCP SDK is already installed:
```bash
npm install @modelcontextprotocol/sdk
```

Version: Check `package.json` for `@modelcontextprotocol/sdk`

## Starting the Servers

### REST API (Day 1 - unchanged)
```bash
npm run dev
```
Runs on: `http://localhost:5000`

### MCP Server (Day 2 - new)
```bash
npm run mcp
```
Uses: stdio transport (standard input/output)

## Available MCP Tools

### 1. search_products

**Purpose:** Search the merchant's product catalog using structured filters

**Input Schema:**
```json
{
  "category": "string (optional)",
  "brand": "string (optional)",
  "minPrice": "number (optional)",
  "maxPrice": "number (optional)",
  "ram": "number (optional)",
  "storage": "number (optional)",
  "gpu": "string (optional)",
  "refreshRate": "number (optional)",
  "inStock": "boolean (optional)"
}
```

**Example Calls:**

1. Find gaming laptops:
```json
{
  "category": "Gaming Laptop"
}
```

2. Gaming laptops under ₹80,000:
```json
{
  "category": "Gaming Laptop",
  "maxPrice": 80000
}
```

3. High-end gaming laptops with 32GB RAM:
```json
{
  "category": "Gaming Laptop",
  "maxPrice": 80000,
  "ram": 32,
  "inStock": true
}
```

4. Products with RTX 5070 GPU:
```json
{
  "gpu": "RTX 5070"
}
```

5. Monitors with 144Hz or higher:
```json
{
  "category": "Monitor",
  "refreshRate": 144
}
```

**Response Format:**
```json
{
  "count": 3,
  "products": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "ASUS ROG Strix G16",
      "brand": "ASUS",
      "category": "Gaming Laptop",
      "price": 78999,
      "currency": "INR",
      "stock": 12,
      "specifications": {
        "ram": 32,
        "storage": 1024,
        "processor": "Intel Core i7",
        "gpu": "RTX 5070",
        "refreshRate": 165,
        "screenSize": 16
      },
      "rating": 4.7,
      "deliveryDays": 2,
      "description": "..."
    }
  ]
}
```

**Zero Results (Important for demand tracking):**
```json
{
  "count": 0,
  "products": []
}
```

### 2. get_product

**Purpose:** Retrieve complete details of a specific product

**Input Schema:**
```json
{
  "productId": "string (required) - MongoDB ObjectId"
}
```

**Example Call:**
```json
{
  "productId": "507f1f77bcf86cd799439011"
}
```

**Response Format:**
```json
{
  "id": "507f1f77bcf86cd799439011",
  "name": "ASUS ROG Strix G16",
  "brand": "ASUS",
  "category": "Gaming Laptop",
  "price": 78999,
  "currency": "INR",
  "stock": 12,
  "specifications": {
    "ram": 32,
    "storage": 1024,
    "processor": "Intel Core i7",
    "gpu": "RTX 5070",
    "refreshRate": 165,
    "screenSize": 16
  },
  "rating": 4.7,
  "deliveryDays": 2,
  "description": "...",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Response:**
```json
{
  "error": "Product not found",
  "productId": "507f1f77bcf86cd799439011"
}
```

### 3. check_inventory

**Purpose:** Check if a product is currently available in stock (read-only)

**Input Schema:**
```json
{
  "productId": "string (required) - MongoDB ObjectId"
}
```

**Example Call:**
```json
{
  "productId": "507f1f77bcf86cd799439011"
}
```

**Response Format (In Stock):**
```json
{
  "productId": "507f1f77bcf86cd799439011",
  "name": "ASUS ROG Strix G16",
  "available": true,
  "stock": 12,
  "isActive": true
}
```

**Response Format (Out of Stock):**
```json
{
  "productId": "507f1f77bcf86cd799439011",
  "name": "Samsung Odyssey G7",
  "available": false,
  "stock": 0,
  "isActive": true
}
```

## Testing the MCP Server

### Prerequisites
1. MongoDB URI must be set in `.env`
2. Database should be seeded with products (`npm run seed`)

### Method 1: Using MCP Inspector (Recommended)

The MCP Inspector is a browser-based tool for testing MCP servers.

1. Install globally (if not already installed):
```bash
npm install -g @modelcontextprotocol/inspector
```

2. Start the inspector:
```bash
npx @modelcontextprotocol/inspector node src/mcp/server.js
```

3. Open the provided URL in your browser
4. You'll see the three tools listed
5. Test each tool with the examples above

### Method 2: Using Claude Desktop (if configured)

Add to your Claude Desktop config:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "merchant-commerce": {
      "command": "node",
      "args": ["/absolute/path/to/backend/src/mcp/server.js"],
      "env": {
        "MONGODB_URI": "your-mongodb-connection-string"
      }
    }
  }
}
```

Restart Claude Desktop and the tools will be available.

### Method 3: Programmatic Testing

Create a test script:

```javascript
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { spawn } = require('child_process');

async function testMCP() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['src/mcp/server.js']
  });

  const client = new Client({
    name: 'test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  await client.connect(transport);

  // List tools
  const tools = await client.request({ method: 'tools/list' }, {});
  console.log('Available tools:', tools);

  // Call search_products
  const result = await client.request({
    method: 'tools/call',
    params: {
      name: 'search_products',
      arguments: {
        category: 'Gaming Laptop',
        maxPrice: 80000
      }
    }
  }, {});
  
  console.log('Search result:', result);
}

testMCP();
```

## Test Cases

### TEST 1: Server Starts
```bash
npm run mcp
```
**Expected:** Server starts without errors, shows "MongoDB connected successfully"

### TEST 2: Tool Discovery
Using MCP Inspector, verify all three tools are listed:
- search_products
- get_product
- check_inventory

### TEST 3: Simple Search
```json
{
  "category": "Gaming Laptop",
  "maxPrice": 80000
}
```
**Expected:** Returns gaming laptops under ₹80,000

### TEST 4: Multiple Filters
```json
{
  "category": "Gaming Laptop",
  "maxPrice": 80000,
  "ram": 32,
  "inStock": true
}
```
**Expected:** Returns only products matching ALL conditions

### TEST 5: Zero Results (Critical)
```json
{
  "category": "Gaming Laptop",
  "maxPrice": 40000,
  "ram": 64
}
```
**Expected:** `{"count": 0, "products": []}`
This represents unfulfilled buyer demand - important for future AI analysis

### TEST 6: Get Product (Valid)
First run search to get a product ID, then:
```json
{
  "productId": "YOUR_PRODUCT_ID_HERE"
}
```
**Expected:** Complete product details

### TEST 7: Get Product (Invalid ID)
```json
{
  "productId": "invalid-id-123"
}
```
**Expected:** Error response with "Invalid product ID format"

### TEST 8: Check Inventory (In Stock)
```json
{
  "productId": "PRODUCT_ID_WITH_STOCK"
}
```
**Expected:** `{"available": true, "stock": 12}`

### TEST 9: Check Inventory (Out of Stock)
```json
{
  "productId": "PRODUCT_ID_WITH_ZERO_STOCK"
}
```
**Expected:** `{"available": false, "stock": 0}`

### TEST 10: REST API Still Works
```bash
curl http://localhost:5000/api/products
```
**Expected:** REST API continues working independently

## File Structure

```
backend/
├── src/
│   ├── mcp/
│   │   ├── server.js              ← MCP server entry point
│   │   └── tools/
│   │       ├── searchProducts.js  ← search_products tool
│   │       ├── getProduct.js      ← get_product tool
│   │       └── checkInventory.js  ← check_inventory tool
│   ├── services/
│   │   └── productService.js      ← Shared business logic
│   ├── models/
│   ├── config/
│   └── server.js                  ← REST API server
├── mcp-config.json                ← MCP client configuration
├── package.json
└── MCP-README.md                  ← This file
```

## Key Design Decisions

### 1. Reusing Service Layer
All MCP tools call the existing `productService` methods:
- ✅ No duplicated business logic
- ✅ Single source of truth
- ✅ Easy to maintain

### 2. Stdio Transport
Using stdio (standard input/output) for MCP communication:
- ✅ Standard MCP transport
- ✅ Works with Claude Desktop
- ✅ Works with MCP Inspector
- ✅ Secure (no network ports)

### 3. AI-Friendly Responses
Tool responses are structured JSON optimized for AI agents:
- Clean field names
- Consistent format
- Includes counts for search results
- No unnecessary MongoDB internals

### 4. Read-Only Tools
All Day 2 tools are read-only:
- ✅ Safe to test
- ✅ No risk of data corruption
- ✅ No inventory modifications
Future days will add write operations (create_order, update_stock, etc.)

### 5. Error Handling
All tools gracefully handle:
- Invalid product IDs
- Missing products
- Database errors
- Invalid arguments

## Logging

MCP server logs tool invocations:
```
[MCP] Starting Merchant Commerce MCP Server...
[MCP] MongoDB connected successfully
[MCP] Server ready and listening on stdio
[MCP] Available tools:
  - search_products: Search the merchant's product catalog...
  - get_product: Retrieve complete details...
  - check_inventory: Check whether a specific product...
[MCP] search_products called with filters: {"category":"Gaming Laptop"}
[MCP] get_product called with ID: 507f1f77bcf86cd799439011
[MCP] check_inventory called with ID: 507f1f77bcf86cd799439011
```

## Future Enhancements (Not Day 2)

Day 3 and beyond will add:
- AI buyer agent with LLM integration
- Natural language understanding ("find cheap gaming laptops" → structured query)
- Demand intelligence tracking
- Write operations (create_order, update_inventory)
- Payment integration tools
- Notification tools

## Troubleshooting

### MCP server won't start
- Check MONGODB_URI in `.env`
- Verify MongoDB connection works with REST API first
- Check Node.js version compatibility

### Tools not discovered
- Ensure server is running
- Check MCP Inspector connection
- Verify tool registration in server.js

### Empty search results
- Run `npm run seed` to populate database
- Verify filters match existing products
- Check MongoDB connection

### REST API broken
- MCP should not affect REST API
- Test REST API independently: `npm run dev`
- Check for port conflicts

## Environment Variables

Same `.env` as Day 1:
```
MONGODB_URI=your-mongodb-connection-string
```

No additional environment variables needed for MCP.

## Dependencies

New dependency added:
- `@modelcontextprotocol/sdk` - Official MCP SDK for Node.js

Existing dependencies (unchanged):
- express
- mongoose
- dotenv
- cors
- nodemon (dev)

## Summary

Day 2 MCP Server:
- ✅ Three read-only tools: search, get, check inventory
- ✅ Reuses existing service layer (no duplication)
- ✅ Stdio transport for standard MCP communication
- ✅ AI-friendly JSON responses
- ✅ Comprehensive error handling
- ✅ REST API continues working independently
- ✅ Ready for Day 3 LLM integration

The architecture is clean, modular, and ready for AI agents to interact with the merchant's product catalog!
