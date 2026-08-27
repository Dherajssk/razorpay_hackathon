require("dotenv").config();

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");

const connectDB = require("../config/db");

const searchProductsTool = require("./tools/searchProducts");
const getProductTool = require("./tools/getProduct");
const checkInventoryTool = require("./tools/checkInventory");

const server = new McpServer({
  name: "merchant-commerce-server",
  version: "1.0.0"
});

server.registerTool(
  searchProductsTool.name,
  {
    description: searchProductsTool.description,
    inputSchema: searchProductsTool.inputSchema
  },
  searchProductsTool.execute
);

server.registerTool(
  getProductTool.name,
  {
    description: getProductTool.description,
    inputSchema: getProductTool.inputSchema
  },
  getProductTool.execute
);

server.registerTool(
  checkInventoryTool.name,
  {
    description: checkInventoryTool.description,
    inputSchema: checkInventoryTool.inputSchema
  },
  checkInventoryTool.execute
);

async function main() {
  try {
    console.error("[MCP] Starting Merchant Commerce Server...");

    await connectDB();

    console.error("[MCP] MongoDB connected");

    const transport = new StdioServerTransport();

    await server.connect(transport);

    console.error("[MCP] Server ready");
    console.error("[MCP] Tools:");
    console.error("  - search_products");
    console.error("  - get_product");
    console.error("  - check_inventory");

  } catch (error) {
    console.error("[MCP] Failed to start:", error);
    process.exit(1);
  }
}

main();