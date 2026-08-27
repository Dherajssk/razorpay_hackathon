const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
  StdioClientTransport
} = require("@modelcontextprotocol/sdk/client/stdio.js");

async function main() {
  console.log("=================================");
  console.log("      MCP SERVER TEST");
  console.log("=================================\n");

  const transport = new StdioClientTransport({
    command: "node",
    args: ["src/mcp/server.js"]
  });

  const client = new Client({
    name: "test-client",
    version: "1.0.0"
  });

  try {
    // ----------------------------------------
    // 1. CONNECT
    // ----------------------------------------

    console.log("1. Connecting to MCP server...");

    await client.connect(transport);

    console.log("✓ Connected!\n");


    // ----------------------------------------
    // 2. LIST TOOLS
    // ----------------------------------------

    console.log("2. Discovering MCP tools...");

    const tools = await client.listTools();

    tools.tools.forEach((tool) => {
      console.log(`✓ ${tool.name}`);
    });

    console.log();


    // ----------------------------------------
    // 3. SEARCH PRODUCTS
    // ----------------------------------------

    console.log("3. Testing search_products...");

    const searchResult = await client.callTool({
      name: "search_products",
      arguments: {
        category: "Gaming Laptop",
        maxPrice: 80000
      }
    });

    const searchData = JSON.parse(
      searchResult.content[0].text
    );

    console.log(
      `✓ Found ${searchData.count} products`
    );

    if (searchData.count === 0) {
      throw new Error(
        "search_products returned 0 products unexpectedly"
      );
    }

    const product = searchData.products[0];

    console.log(
      `  First product: ${product.name}`
    );

    console.log(
      `  Price: ₹${product.price}`
    );

    console.log(
      `  Product ID: ${product.id}`
    );

    console.log();


    // ----------------------------------------
    // 4. GET PRODUCT
    // ----------------------------------------

    console.log("4. Testing get_product...");

    const productResult = await client.callTool({
      name: "get_product",
      arguments: {
        productId: product.id
      }
    });

    const productData = JSON.parse(
      productResult.content[0].text
    );

    if (productData.error) {
      throw new Error(productData.error);
    }

    console.log("✓ Product retrieved successfully");

    console.log(
      `  Name: ${productData.name}`
    );

    console.log(
      `  Brand: ${productData.brand}`
    );

    console.log(
      `  Price: ₹${productData.price}`
    );

    console.log(
      `  Stock: ${productData.stock}`
    );

    console.log();


    // ----------------------------------------
    // 5. CHECK INVENTORY
    // ----------------------------------------

    console.log("5. Testing check_inventory...");

    const inventoryResult = await client.callTool({
      name: "check_inventory",
      arguments: {
        productId: product.id
      }
    });

    const inventoryData = JSON.parse(
      inventoryResult.content[0].text
    );

    if (inventoryData.error) {
      throw new Error(inventoryData.error);
    }

    console.log(
      "✓ Inventory retrieved successfully"
    );

    console.log(
      `  Product: ${inventoryData.name}`
    );

    console.log(
      `  Available: ${inventoryData.available}`
    );

    console.log(
      `  Stock: ${inventoryData.stock}`
    );

    console.log();


    // ----------------------------------------
    // 6. ZERO RESULT SEARCH
    // ----------------------------------------

    console.log(
      "6. Testing zero-result search..."
    );

    const zeroResult = await client.callTool({
      name: "search_products",
      arguments: {
        category: "Gaming Laptop",
        maxPrice: 40000,
        ram: 64
      }
    });

    const zeroData = JSON.parse(
      zeroResult.content[0].text
    );

    console.log(
      `✓ Found ${zeroData.count} products`
    );

    if (zeroData.count !== 0) {
      throw new Error(
        "Expected zero products but received results"
      );
    }

    console.log(
      "  ✓ Correctly returned zero results"
    );

    console.log();


    // ----------------------------------------
    // SUCCESS
    // ----------------------------------------

    console.log("=================================");
    console.log("       ALL TESTS PASSED ✓");
    console.log("=================================");

    await client.close();

  } catch (error) {

    console.error("\n=================================");
    console.error("          TEST FAILED");
    console.error("=================================");

    console.error(error);

    try {
      await client.close();
    } catch {}

    process.exit(1);
  }
}

main();