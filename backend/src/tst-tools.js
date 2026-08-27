const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
  StdioClientTransport
} = require("@modelcontextprotocol/sdk/client/stdio.js");

async function main() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["src/mcp/server.js"]
  });

  const client = new Client({
    name: "schema-test",
    version: "1.0.0"
  });

  try {
    await client.connect(transport);

    console.log("CONNECTED");

    const result = await client.listTools();

    console.log("\nTOOLS:");
    console.log(JSON.stringify(result, null, 2));

    await client.close();
  } catch (error) {
    console.error("\nFAILED:");
    console.error(error);
  }
}

main();