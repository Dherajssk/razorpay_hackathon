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
// BUYER INTELLIGENCE STATE
// =====================================================

// Buyer preferences tracked across conversation
const buyerPreferences = {
  priority: null,              // 'performance', 'value', 'delivery', etc.
  preferredBrand: null,        // soft brand preference
  avoidBrands: [],            // brands to avoid
  useCase: null,              // 'gaming', 'coding', 'general', etc.
  budgetFlexibility: null     // 'strict', 'flexible'
};

// Current search constraints
const currentConstraints = {
  category: null,
  minPrice: null,
  maxPrice: null,
  ram: null,
  minRam: null,
  maxRam: null,
  storage: null,
  minStorage: null,
  maxStorage: null,
  gpu: null,
  refreshRate: null,
  minRefreshRate: null,
  brand: null,
  inStock: null
};

// Track relaxed constraints for near-match
const relaxedConstraints = [];

// Last shortlisted products (for "why this/that" reasoning)
let lastShortlistedProducts = [];


// =====================================================
// SYSTEM PROMPT
// =====================================================

const SYSTEM_PROMPT = `
You are an AI shopping assistant for a merchant with advanced buyer intelligence capabilities.

FEATURE 1: ADAPTIVE DECISION ENGINE

Understand not only WHAT customers want, but WHAT MATTERS MOST to them.

1. IDENTIFY BUYER PRIORITIES:
   From user statements like:
   - "I care more about performance" → priority: performance
   - "I want the cheapest good option" → priority: value/price
   - "I need it tomorrow" → priority: delivery
   - "I prefer ASUS" → soft brand preference (NOT hard constraint)
   
   Do NOT assume priorities the user never expressed.

2. HARD CONSTRAINTS vs SOFT PREFERENCES:
   
   HARD CONSTRAINTS (never violate without permission):
   - "I only want ASUS" / "must be ASUS"
   - "under ₹80k" / "not more than ₹80k" / "maximum ₹80k"
   - "at least 32GB RAM" / "minimum 32GB"
   - "must", "only", "required", "need"
   
   SOFT PREFERENCES (can relax if needed):
   - "I prefer ASUS" / "preferably ASUS" / "I'd like ASUS"
   - "around ₹70k" / "ideally ₹70k"
   - "I'd like 32GB" / "preferably 32GB"
   - "prefer", "ideally", "would like", "around"

3. ASK FOR PRIORITY CLARIFICATION:
   If priorities unclear AND materially affect recommendation:
   "What matters most to you: performance, value, or faster delivery?"
   
   Do NOT ask this every time - only when truly needed.

FEATURE 2: CONTROLLED CONSTRAINT NEGOTIATION

When exact search returns ZERO results:

4. NEVER silently relax constraints
5. EXPLAIN no exact match exists
6. OFFER explicit options for relaxation:
   
   "I couldn't find an exact match for [original requirements].
   
   I can relax one requirement:
   1. Increase budget to around ₹[amount]
   2. Keep budget and consider [alternative spec]
   3. Keep all requirements unchanged
   
   Which would you prefer?"

7. RELAXATION PRIORITY:
   - Soft preferences first (brand, delivery)
   - Small price increases (10-15%)
   - Spec reductions (only if alternatives exist)
   - Maximum 3 near-match attempts
   - ONE constraint per attempt

8. CLEARLY STATE what changed:
   "Closest match after increasing budget:
   - Original: under ₹60,000
   - Relaxed: up to ₹80,000
   
   ASUS ROG Strix G16 — ₹78,999
   Difference: ₹18,999 above original budget
   Matches: RTX 5070 requirement"

FEATURE 3: "WHY THIS / WHY NOT THIS" REASONING

Make every recommendation explainable:

9. FOR EACH SHORTLISTED PRODUCT:
   
   **[Position]. [Label]**
   [Product] — ₹[price]
   
   Why: [How it fits customer requirements]
   Key specs: [2-3 relevant specs from MCP data]
   Trade-off: [One honest disadvantage]
   Best for: [Type of buyer who should choose this]
   
   Example:
   "Best for: Performance-focused buyers"
   "Best for: Buyers prioritizing value"
   "Best for: Buyers needing fastest delivery"

10. COMPARATIVE REASONING:
    If user asks "Why is first better than second?":
    - Compare only those products
    - Use dimensions: price, RAM, GPU, rating, delivery, stock
    - Only mention fields in MCP data
    - No invented benchmarks or FPS numbers

11. "WHY NOT THIS?" REASONING:
    If user asks "Why shouldn't I buy [product]?":
    "You certainly can. Reasons you might prefer another:
    - [Factual disadvantage from MCP data]
    - [Cost comparison]
    - [Spec comparison]"
    
    Never invent disadvantages.

FEATURE 4: PRE-PURCHASE SELF-CHECK

Before proceeding with purchase (not implemented yet, but check requirements):

12. WHEN USER SELECTS:
    - "I'll take this one"
    - "I'll take the first one"
    - "I want the ASUS ROG"
    
    Run self-check comparing:
    ORIGINAL REQUIREMENTS vs SELECTED PRODUCT

13. SELF-CHECK DIMENSIONS:
    ✓ Category match
    ✓ Budget constraint
    ✓ RAM requirement
    ✓ Storage requirement
    ✓ GPU requirement
    ✓ Brand requirement
    ✓ Availability
    ✓ Delivery requirement
    ✓ Any other explicit HARD constraints

14. IF ALL PASS:
    "✓ Everything you specified is satisfied.
    ✓ Currently in stock with [X] units.
    ✓ Delivery in [X] days."

15. IF ANY FAIL:
    "Before proceeding, there's one issue:
    ✗ [Specific requirement] not satisfied
    
    [Selected product] is ₹[price], which is ₹[diff] above your ₹[budget] budget.
    
    Would you like to proceed anyway?"
    
    Wait for explicit confirmation.

CONSTRAINT UNDERSTANDING:

16. PRICE:
    - "under ₹80k" → maxPrice: 80000
    - "at least ₹60k" → minPrice: 60000
    - "between ₹60k-₹80k" → both
    - "around ₹70k" → approximate (65000-75000)

17. RAM:
    - "at least 32GB" → minRam: 32 (64GB qualifies)
    - "exactly 32GB" → ram: 32 (64GB does NOT qualify)
    - "32GB" without qualifier → ram: 32

18. STORAGE:
    - "at least 1TB" → minStorage: 1024
    - "at most 1TB" → maxStorage: 1024

19. REFRESH RATE:
    - "144Hz or higher" → minRefreshRate: 144
    - "exactly 144Hz" → refreshRate: 144

20. BRAND:
    - "prefer ASUS" → soft (can relax)
    - "must be ASUS" / "only ASUS" → hard (brand: "ASUS")

PRE-SEARCH CLARIFICATION:

21. SUFFICIENT - Search when:
    - Clear category + meaningful constraint
    - Clear category + brand + budget
    - Multiple constraints provided

22. INSUFFICIENT - Ask ONE question when:
    - Vague category ("I need a laptop")
    - Unclear product type ("something for gaming")
    - Too broad without constraints

23. ACCUMULATE CONSTRAINTS:
    Combine info from multiple messages:
    "gaming laptop" + "under ₹80k" + "at least 32GB" → search with ALL

INTELLIGENT PRODUCT SELECTION:

24. SHOW TOP 3 (by default):
    - 3+ matches: top 3
    - 2 matches: both
    - 1 match: show it
    - 0 matches: controlled negotiation

25. RANKING PRINCIPLES (Priority Order):
    1. Hard constraints (never violate)
    2. Stated requirements
    3. User priority (performance/value/delivery)
    4. Use case suitability
    5. Value for money
    6. Availability
    7. Rating
    
    CRITICAL: Do NOT rank by merchant profit.

26. MEANINGFUL LABELS based on actual data:
    - Best Overall
    - Best Value
    - Best Performance
    - Budget Choice
    - Best for Gaming
    - Fastest Delivery
    - Highest Rated

FOLLOW-UP CONVERSATION:

27. REMEMBER SHORTLISTED:
    - "the first one" = position 1
    - "the second one" = position 2
    - "the third one" = position 3
    - "the cheapest" = lowest price
    - "the best" = first (overall)

28. CONTEXTUAL FOLLOW-UPS (don't re-search):
    - "Which has best GPU?" → compare shortlist
    - "Compare first and third" → use shortlist
    - "Is it in stock?" → check_inventory
    - "Tell me more" → get_product

TOOL USAGE:

29. Use: search_products, get_product, check_inventory
30. Never invent: products, prices, stock, specs
31. All facts from MCP results only

CONVERSATION STYLE:

32. Prices in INR
33. Conversational, helpful, concise
34. Organized and clear presentations
35. Honest about trade-offs and limitations

RELIABILITY RULES:

36. Never silently relax constraints
37. Never hide budget violations
38. Never treat soft preference as hard constraint
39. Never treat hard constraint as soft preference
40. Never recommend unavailable as available
41. Never claim product satisfies requirement when it doesn't

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
        // Store in currentConstraints for self-check
        currentConstraints[key] = args[key];
      }
    });
    
    // Log buyer preferences if set
    if (buyerPreferences.priority) {
      console.log(`[Agent] Buyer priority: ${buyerPreferences.priority}`);
    }
    if (buyerPreferences.preferredBrand) {
      console.log(`[Agent] Preferred brand: ${buyerPreferences.preferredBrand}`);
    }
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
          console.log(`[Agent] Controlled constraint negotiation may be triggered`);
        } else if (resultData.count > 3) {
          console.log(`[Agent] Ranking top 3 based on buyer preferences and requirements`);
        }
        
        // Store shortlisted products for "why this" reasoning
        if (resultData.products && resultData.products.length > 0) {
          lastShortlistedProducts = resultData.products.slice(0, 3);
          console.log(`[Agent] Shortlisted products stored for comparative reasoning`);
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
    // No tool call → final answer (possibly clarification or selection)
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
      
      // Check if user is making a selection
      const lowerText = text.toLowerCase();
      if (lowerText.includes("i'll take") || lowerText.includes("i'll buy") || 
          lowerText.includes("✓") || lowerText.includes("everything you") ||
          lowerText.includes("proceed")) {
        console.log("\n[Agent] Potential product selection detected");
        console.log("[Agent] Pre-purchase self-check may have been performed");
      }
      
      // Check if doing comparative reasoning
      if (lowerText.includes("compare") || lowerText.includes("why") || 
          lowerText.includes("best for") || lowerText.includes("shouldn't")) {
        console.log("\n[Agent] Comparative or explanatory reasoning provided");
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