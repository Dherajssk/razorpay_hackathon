require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
  StdioClientTransport
} = require("@modelcontextprotocol/sdk/client/stdio.js");


// =====================================================
// CONFIG
// =====================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is missing from .env");
  process.exit(1);
}


// =====================================================
// GEMINI
// =====================================================

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY
});


// =====================================================
// MCP CLIENT
// =====================================================

let mcpClient;


// =====================================================
// SYSTEM PROMPT
// =====================================================

const SYSTEM_PROMPT = `
You are an AI shopping assistant for a merchant.

Your job is to help customers find products from the merchant's catalog.

IMPORTANT RULES:

1. When the customer asks about products, use the available MCP tools.
2. Never invent products.
3. Never invent prices.
4. Never invent stock.
5. Never invent specifications.
6. Never claim a product exists unless the MCP server returned it.
7. Use search_products when you need to find products.
8. Use get_product when you need detailed information about a specific product.
9. Use check_inventory when you need to verify product availability.
10. You may use multiple tools if necessary.
11. If no products match the customer's request, clearly say that no matching products were found.
12. Prices are in INR.
13. Be concise and helpful.

The MCP tools are the merchant's source of truth.
`;


// =====================================================
// CONNECT TO MCP SERVER
// =====================================================

async function connectMCP() {

  console.log("[Agent] Connecting to Merchant MCP Server...");

  const transport = new StdioClientTransport({
    command: "node",
    args: ["src/mcp/server.js"]
  });

  mcpClient = new Client({
    name: "ai-buyer-agent",
    version: "1.0.0"
  });

  await mcpClient.connect(transport);

  console.log("[Agent] ✓ Connected to MCP server");
}


// =====================================================
// GET MCP TOOLS
// =====================================================

async function getMCPTools() {

  console.log("\n[Agent] Discovering available tools...");

  /*
   * IMPORTANT:
   *
   * We get the RAW MCP JSON schemas.
   * We do NOT convert them to Zod.
   */

  const result = await mcpClient.listTools();

  console.log("[Agent] Available tools:");

  result.tools.forEach((tool) => {
    console.log(`  - ${tool.name}`);
  });

  return result.tools;
}


// =====================================================
// CONVERT MCP JSON SCHEMA → GEMINI FUNCTION DECLARATION
// =====================================================

function convertMCPToolToGemini(tool) {

  const schema = tool.inputSchema;

  return {
    name: tool.name,
    description: tool.description || "",
    parameters: schema
  };
}


// =====================================================
// CALL MCP TOOL
// =====================================================

async function callMCPTool(name, args) {

  console.log(`\n[MCP] Calling tool: ${name}`);

  console.log("[MCP] Arguments:");
  console.log(JSON.stringify(args, null, 2));

  const result = await mcpClient.callTool({
    name,
    arguments: args
  });

  console.log("[MCP] ✓ Tool result received");

  return result;
}


// =====================================================
// EXTRACT TEXT FROM MCP RESULT
// =====================================================

function extractMCPResult(result) {

  if (!result || !result.content) {
    return "";
  }

  return result.content
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n");
}


// =====================================================
// RUN AGENT
// =====================================================

async function runAgent(userMessage) {

  console.log("\n=================================");
  console.log("USER REQUEST");
  console.log("=================================");
  console.log(userMessage);


  // ---------------------------------------------
  // Connect MCP
  // ---------------------------------------------

  await connectMCP();


  // ---------------------------------------------
  // Discover tools
  // ---------------------------------------------

  const mcpTools = await getMCPTools();


  // ---------------------------------------------
  // Convert tools for Gemini
  // ---------------------------------------------

  const geminiTools = mcpTools.map(
    convertMCPToolToGemini
  );


  console.log("\n[Agent] MCP tools converted for Gemini");


  // ---------------------------------------------
  // Conversation history
  // ---------------------------------------------

  const contents = [
    {
      role: "user",
      parts: [
        {
          text: userMessage
        }
      ]
    }
  ];


  // ---------------------------------------------
  // Agent loop
  // ---------------------------------------------

  while (true) {

    console.log("\n[LLM] Thinking...");


    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,

        tools: [
          {
            functionDeclarations: geminiTools
          }
        ]
      }
    });


    const candidate = response.candidates?.[0];

    if (!candidate) {
      throw new Error("Gemini returned no candidate");
    }


    const parts = candidate.content?.parts || [];


    // ---------------------------------------------
    // Add Gemini response to conversation
    // ---------------------------------------------

    contents.push(candidate.content);


    // ---------------------------------------------
    // Check for tool calls
    // ---------------------------------------------

    const functionCalls = parts.filter(
      (part) => part.functionCall
    );


    // ---------------------------------------------
    // No tool call → final answer
    // ---------------------------------------------

    if (functionCalls.length === 0) {

      const text = parts
        .filter((part) => part.text)
        .map((part) => part.text)
        .join("\n");

      console.log("\n=================================");
      console.log("FINAL AI RESPONSE");
      console.log("=================================");
      console.log(text);

      break;
    }


    // ---------------------------------------------
    // Execute tool calls
    // ---------------------------------------------

    const toolResponseParts = [];


    for (const part of functionCalls) {

      const call = part.functionCall;

      console.log("\n=================================");
      console.log("LLM TOOL CALL");
      console.log("=================================");

      console.log("Tool:", call.name);

      console.log(
        "Arguments:",
        JSON.stringify(call.args, null, 2)
      );


      // Call MCP
      const result = await callMCPTool(
        call.name,
        call.args || {}
      );


      const resultText =
        extractMCPResult(result);


      toolResponseParts.push({
        functionResponse: {
          name: call.name,
          response: {
            result: resultText
          }
        }
      });
    }


    // ---------------------------------------------
    // Send MCP results back to Gemini
    // ---------------------------------------------

    contents.push({
      role: "user",
      parts: toolResponseParts
    });

  }


  // ---------------------------------------------
  // Close MCP connection
  // ---------------------------------------------

  await mcpClient.close();

  console.log("\n[Agent] MCP connection closed");
}


// =====================================================
// START
// =====================================================

async function main() {

  console.log("=================================");
  console.log("AI BUYER AGENT");
  console.log("=================================");


  const message =
    "I need a gaming laptop under ₹80,000 with 32GB RAM.";


  try {

    await runAgent(message);

  } catch (error) {

    console.error("\n❌ Agent failed:");
    console.error(error);

    process.exit(1);
  }
}


main();