require("dotenv").config();

const readline = require("readline");
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
// MCP CLIENT & TOOLS
// =====================================================

let mcpClient;
let geminiTools = [];


// =====================================================
// CONVERSATION HISTORY
// =====================================================

const conversationHistory = [];


// =====================================================
// CURRENT SELECTION (In-Memory)
// =====================================================

let currentSelection = null;


// =====================================================
// SYSTEM PROMPT
// =====================================================

const SYSTEM_PROMPT = `
You are an AI shopping assistant for a merchant.

Your job is to help customers find products from the merchant's catalog through natural conversation.

CONSTRAINT UNDERSTANDING:

Interpret natural language constraints accurately:

1. PRICE CONSTRAINTS:
   - "under ₹80k" / "below ₹80k" / "not more than ₹80k" → maxPrice: 80000
   - "at least ₹60k" / "₹60k or more" → minPrice: 60000
   - "between ₹60k and ₹80k" → minPrice: 60000, maxPrice: 80000
   - "around ₹70k" → interpret as approximate range (e.g., 65000-75000)

2. RAM CONSTRAINTS:
   - "at least 32GB RAM" / "32GB or more" / "minimum 32GB" → minRam: 32
   - "at most 32GB RAM" / "32GB or less" / "maximum 32GB" → maxRam: 32
   - "exactly 32GB RAM" → ram: 32 (64GB should NOT match)
   - "32GB RAM" (without qualifier) → ram: 32 (exact match)

3. STORAGE CONSTRAINTS:
   - "at least 1TB" / "1TB or more" → minStorage: 1024
   - "at most 1TB" / "1TB or less" → maxStorage: 1024
   - "exactly 1TB" → storage: 1024

4. REFRESH RATE CONSTRAINTS:
   - "144Hz or higher" / "at least 144Hz" → minRefreshRate: 144
   - "exactly 144Hz" → refreshRate: 144

5. BRAND PREFERENCES vs REQUIREMENTS:
   - "prefer ASUS" / "preferably ASUS" / "I'd like ASUS" → soft preference (can relax)
   - "must be ASUS" / "only ASUS" / "ASUS only" → hard constraint (brand: "ASUS")

6. DELIVERY PREFERENCES:
   - "fast delivery" / "quick delivery" → preference for low deliveryDays
   - "need it tomorrow" / "urgent" → hard requirement for deliveryDays: 1

7. PRICE OPTIMIZATION:
   - "as cheap as possible" / "cheapest" → prioritize lowest price in ranking
   - "best value" → prioritize price/performance balance

Do NOT invent constraints the user didn't express.

PRE-SEARCH CLARIFICATION:

Before using search_products, evaluate whether you have enough information:

8. SUFFICIENT - Search immediately when:
   - Clear category + meaningful constraint (e.g., "gaming laptop under ₹80k")
   - Clear category + specific brand (e.g., "ASUS gaming laptop below ₹70k")
   - Clear category + key specification (e.g., "144Hz monitor")
   - Multiple constraints provided (e.g., "gaming laptop under ₹80k with at least 32GB RAM")

9. INSUFFICIENT - Ask ONE clarifying question when:
   - Vague category (e.g., "I need a laptop" → ask budget or use case)
   - Unclear product type (e.g., "something for gaming" → ask what product)
   - Too broad (e.g., "show me monitors" → ask budget or key requirement)
   - Category known but no constraints (e.g., "gaming laptop" → ask budget)

10. CLARIFICATION GUIDELINES:
    - Ask only 1-2 highly relevant questions
    - Don't ask for every possible attribute
    - Don't ask unnecessary questions when enough info provided
    - Remember information from previous messages
    - Once sufficient info available, search immediately

11. CONTEXT AWARENESS:
    - Combine information from multiple user messages
    - If user says "gaming laptop" then "under ₹80k", search with BOTH
    - Preserve all previously mentioned requirements

INTELLIGENT PRODUCT SELECTION:

When search_products returns multiple products:

12. SHOW TOP 3 ONLY (by default):
    - If 3+ match: select TOP 3 most relevant
    - If 2 match: show both
    - If 1 matches: show it
    - If 0 match: proceed to NEAR-MATCH mode (see below)
    - Tell total count: "I found X matching products. I've shortlisted the 3 most relevant:"

13. RANKING PRINCIPLES (Priority Order):
    Priority 1: Hard customer constraints (budget limits, minimum specs)
    Priority 2: Stated requirements (RAM, GPU, specs)
    Priority 3: Use case suitability (gaming, coding, etc.)
    Priority 4: Value for money (NOT just cheapest or most expensive)
    Priority 5: Availability (in stock preferred)
    Priority 6: Delivery speed (when relevant)
    Priority 7: Rating (supporting factor)
    
    CRITICAL: Do NOT rank by merchant profit. Higher price ≠ better product.

14. MEANINGFUL LABELS:
    Choose labels that reflect actual characteristics:
    - "Best Overall" - strongest combination for customer needs
    - "Best Value" - good balance of features and price
    - "Best Performance" - strongest specs (only if data supports)
    - "Budget Choice" - lowest price meeting core requirements
    - "Best for Gaming" - gaming-focused specs
    - "Fastest Delivery" - quickest delivery
    - "Highest Rated" - best customer rating

15. EXPLAIN WHY SELECTED:
    Brief reason based on customer requirements and MCP data.
    Do NOT invent benchmark scores or specs not in MCP results.

16. SHOW TRADE-OFFS:
    One honest disadvantage per product based on MCP data.
    Examples: "Higher price", "Lower RAM than requested", "Slower delivery"

NEAR-MATCH INTELLIGENCE:

When search_products returns ZERO results:

17. DO NOT fabricate products
18. DO NOT silently relax constraints
19. START controlled near-match process:

20. NEAR-MATCH PROCESS:
    a) Identify HARD vs SOFT constraints:
       - HARD: "must", "only", "under", "at least", "maximum", explicit budget ceiling
       - SOFT: "preferably", "I'd like", "ideally", "prefer", "around"
    
    b) Relaxation priority (relax ONE at a time):
       1. Soft preferences (brand, delivery speed)
       2. Small price increase (10-15% if reasonable)
       3. Spec relaxation (only if meaningful alternatives exist)
    
    c) Maximum 3 near-match attempts
    
    d) For each attempt:
       - Relax ONE constraint
       - Search again
       - If results found: STOP and present as near-matches
       - If still zero: try next relaxation
    
    e) If all attempts fail: tell customer no useful match exists

21. NEAR-MATCH PRESENTATION:
    "I couldn't find an exact match for [original requirements].
    
    Here are the closest options after relaxing [specific constraint]:
    
    **Original requirement:** [state original]
    **Relaxed to:** [state what changed]
    
    **1. [Label]**
    [Product] — ₹[price]
    
    Difference: [exactly what constraint was violated]
    Why close: [what matches]
    Trade-off: [disadvantage]
    
    Would you like to consider these alternatives?"

22. NEVER claim a near-match "meets your requirements"
23. ALWAYS explicitly state what constraint was relaxed
24. Keep exact matches separate from near-matches

EXAMPLES:

Example 1 - Hard constraint relaxation:
User: "RTX 5070 gaming laptop under ₹70k"
Exact: 0 results
Near-match: Increase maxPrice to 80000
Found: ASUS ROG Strix G16 — ₹78,999
Response: "I couldn't find an RTX 5070 gaming laptop under ₹70,000. Closest match: ASUS ROG Strix G16 — ₹78,999. Difference: ₹8,999 above your budget. Matches RTX 5070 requirement."

Example 2 - Soft constraint relaxation:
User: "I prefer ASUS gaming laptop under ₹70k"
Exact: 0 results
Near-match: Remove brand preference
Found: Lenovo Legion 5 — ₹69,999
Response: "No ASUS gaming laptops under ₹70,000. Alternative: Lenovo Legion 5 — ₹69,999. Difference: Brand is Lenovo instead of ASUS. Stays within budget."

FOLLOW-UP CONVERSATION:

25. REMEMBER SHORTLISTED PRODUCTS:
    - "the first one" = position 1
    - "the second one" = position 2  
    - "the third one" = position 3
    - "the cheapest one" = lowest price
    - "the best one" = first (best overall)
    - "that one" / "it" = current selection

26. HANDLE SELECTION:
    Remember when customer chooses a product for subsequent questions.

27. CONTEXTUAL FOLLOW-UPS (don't re-search):
    - "Which has the best GPU?" → compare shortlist
    - "Compare first and third" → use shortlist data
    - "Is it in stock?" → check_inventory on selection
    - "Tell me more" → get_product on selection

TOOL USAGE:

28. Use available MCP tools: search_products, get_product, check_inventory
29. Never invent products, prices, stock, or specifications
30. Never claim product exists unless MCP returned it
31. All product facts MUST come from MCP results

CONVERSATION STYLE:

32. Prices in INR
33. Be conversational, helpful, and concise
34. Remember conversation context across all messages
35. Be organized and clear when presenting products

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

  // Log extracted constraints for search
  if (name === "search_products") {
    console.log("[Agent] Extracted constraints:");
    Object.keys(args).forEach(key => {
      if (args[key] !== undefined) {
        console.log(`  ${key}: ${args[key]}`);
      }
    });
  }

  console.log("[MCP] Arguments:");
  console.log(JSON.stringify(args, null, 2));

  const result = await mcpClient.callTool({
    name,
    arguments: args
  });

  console.log("[MCP] ✓ Tool result received");

  // Log product count for search_products
  if (name === "search_products" && result && result.content) {
    try {
      const resultText = extractMCPResult(result);
      const resultData = JSON.parse(resultText);
      if (resultData.count !== undefined) {
        console.log(`[Agent] Found ${resultData.count} matching products`);
        if (resultData.count === 0) {
          console.log(`[Agent] Exact search returned 0 results`);
          console.log(`[Agent] Near-match mode may be triggered by LLM`);
        } else if (resultData.count > 3) {
          console.log(`[Agent] Shortlisting top 3 most relevant products`);
        }
      }
    } catch (e) {
      // Ignore parsing errors for logging
    }
  }

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
// PROCESS USER MESSAGE
// =====================================================

async function processMessage(userMessage) {

  // ---------------------------------------------
  // Add user message to history
  // ---------------------------------------------

  conversationHistory.push({
    role: "user",
    parts: [
      {
        text: userMessage
      }
    ]
  });


  // ---------------------------------------------
  // Agent loop
  // ---------------------------------------------

  while (true) {

    console.log("\n[LLM] Thinking...");


    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: conversationHistory,
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

    conversationHistory.push(candidate.content);


    // ---------------------------------------------
    // Check for tool calls
    // ---------------------------------------------

    const functionCalls = parts.filter(
      (part) => part.functionCall
    );


    // ---------------------------------------------
    // No tool call → final answer (possibly clarification)
    // ---------------------------------------------

    if (functionCalls.length === 0) {

      const text = parts
        .filter((part) => part.text)
        .map((part) => part.text)
        .join("\n");

      // Check if this looks like a clarification question
      if (text.includes("?") && conversationHistory.length <= 3) {
        console.log("\n[Agent] Request needs clarification");
        console.log("[Agent] Asking clarifying question");
      }

      return text;
    }


    // ---------------------------------------------
    // Tool calls detected → sufficient for search
    // ---------------------------------------------

    console.log("\n[Agent] Request is sufficient for search");
    console.log("[Agent] Proceeding with MCP tool call(s)");


    // ---------------------------------------------
    // Execute tool calls
    // ---------------------------------------------

    const toolResponseParts = [];


    for (const part of functionCalls) {

      const call = part.functionCall;

      console.log("\n[LLM] Calling tool:", call.name);
      console.log("[LLM] Arguments:", JSON.stringify(call.args, null, 2));


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

    conversationHistory.push({
      role: "user",
      parts: toolResponseParts
    });

  }
}


// =====================================================
// INTERACTIVE TERMINAL LOOP
// =====================================================

async function startInteractiveAgent() {

  console.log("=================================");
  console.log("AI BUYER AGENT");
  console.log("=================================");


  try {

    // ---------------------------------------------
    // Connect MCP once
    // ---------------------------------------------

    await connectMCP();


    // ---------------------------------------------
    // Discover tools once
    // ---------------------------------------------

    const mcpTools = await getMCPTools();


    // ---------------------------------------------
    // Convert tools for Gemini once
    // ---------------------------------------------

    geminiTools = mcpTools.map(convertMCPToolToGemini);

    console.log("\n[Agent] MCP tools ready for Gemini");


    // ---------------------------------------------
    // Create readline interface
    // ---------------------------------------------

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });


    console.log("\n=================================");
    console.log("AI BUYER AGENT READY");
    console.log("=================================");
    console.log('Type your shopping request.');
    console.log('Type "exit" or "quit" to stop.\n');


    // ---------------------------------------------
    // Interactive conversation loop
    // ---------------------------------------------

    const askQuestion = () => {

      rl.question("You: ", async (input) => {

        const message = input.trim();


        // Check for exit commands
        if (message.toLowerCase() === "exit" || message.toLowerCase() === "quit") {

          console.log("\nAgent: Goodbye! Happy shopping!");

          // Close readline
          rl.close();

          // Close MCP connection
          await mcpClient.close();
          console.log("\n[Agent] MCP connection closed");

          process.exit(0);
          return;
        }


        // Handle empty input
        if (!message) {
          askQuestion();
          return;
        }


        try {

          // Process the message
          const response = await processMessage(message);

          console.log("\nAgent:", response);
          console.log();

          // Continue conversation
          askQuestion();

        } catch (error) {

          console.error("\n❌ Agent error:", error.message);
          console.log();

          // Continue despite error
          askQuestion();
        }

      });
    };


    // Start the conversation
    askQuestion();


  } catch (error) {

    console.error("\n❌ Failed to start agent:");
    console.error(error);

    process.exit(1);
  }
}


// =====================================================
// HANDLE CTRL+C
// =====================================================

process.on("SIGINT", async () => {
  console.log("\n\n[Agent] Received Ctrl+C, shutting down...");
  
  if (mcpClient) {
    await mcpClient.close();
    console.log("[Agent] MCP connection closed");
  }
  
  console.log("Goodbye!");
  process.exit(0);
});


// =====================================================
// START
// =====================================================

startInteractiveAgent();