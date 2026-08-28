# Conversational AI Buyer Agent

## Overview
The AI buyer agent has been converted from a single-message handler to a fully interactive conversational agent that maintains context across multiple messages.

## What Changed

### File Modified
**`src/agent.js`** - Converted from single-execution to interactive conversation

## Key Changes

### 1. Added Readline Module
```javascript
const readline = require("readline");
```
Uses Node's built-in readline for terminal input/output.

### 2. Conversation History (In-Memory)
```javascript
const conversationHistory = [];
```
**Location:** Global scope (outside functions)
**Purpose:** Persists across all user messages in the session
**Contains:** 
- User messages
- Gemini responses
- Tool calls and results

This allows Gemini to understand context like:
- "Show me gaming laptops" → lists products
- "Which one has the best GPU?" → knows "one" refers to laptops from previous message

### 3. MCP Connection Lifetime
**Before:** Connected and disconnected for each message
**Now:** 
- Connects ONCE at startup
- Stays alive for entire session
- Closes only on exit

```javascript
// At startup (once):
await connectMCP();
const mcpTools = await getMCPTools();
geminiTools = mcpTools.map(convertMCPToolToGemini);

// For each message (reuses connection):
await processMessage(userMessage);

// On exit:
await mcpClient.close();
```

### 4. processMessage() Function
Extracted the agent loop into a reusable function:

```javascript
async function processMessage(userMessage) {
  // 1. Add user message to conversationHistory
  // 2. Send full conversation to Gemini
  // 3. Handle tool calls via MCP
  // 4. Continue until final text response
  // 5. Return final text
}
```

**Key Points:**
- Does NOT reset conversation history
- Uses global `conversationHistory` array
- Uses global `geminiTools` array
- Returns only the final text response

### 5. Interactive Terminal Loop

```javascript
async function startInteractiveAgent() {
  // Connect MCP once
  // Discover tools once
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const askQuestion = () => {
    rl.question("You: ", async (input) => {
      
      // Check for exit
      if (input === "exit" || input === "quit") {
        // Close readline
        // Close MCP
        // Exit
      }
      
      // Process message
      const response = await processMessage(input);
      console.log("Agent:", response);
      
      // Continue loop
      askQuestion();
    });
  };
  
  askQuestion();
}
```

**Features:**
- Recursive prompt pattern
- Exit commands: "exit" or "quit"
- Error handling (continues on error)
- Clean shutdown

### 6. SIGINT Handler (Ctrl+C)
```javascript
process.on("SIGINT", async () => {
  console.log("Received Ctrl+C, shutting down...");
  await mcpClient.close();
  process.exit(0);
});
```

### 7. Updated System Prompt
Added conversational context awareness:
```
14. Remember the conversation context - if the customer refers to "that one" 
    or "which one", they're referring to products mentioned earlier.
15. You can handle follow-up questions naturally.
```

## What Stayed the Same

### ✅ MCP Architecture (Unchanged)
- MCP server (`src/mcp/server.js`) - not modified
- MCP tools (search_products, get_product, check_inventory) - not modified
- MCP client connection logic - preserved
- Tool discovery via `client.listTools()` - unchanged
- Tool execution via `client.callTool()` - unchanged

### ✅ Gemini Integration (Unchanged)
- Tool calling logic - preserved
- Function call detection - same
- Tool result formatting - same
- Multi-tool support - works as before

### ✅ MongoDB Integration (Unchanged)
- No direct MongoDB access from agent
- All product data via MCP tools
- Service layer untouched

## How It Works

### Architecture Flow

```
Application Start
    ↓
Connect to MCP Server (ONCE)
    ↓
Discover MCP Tools (ONCE)
    ↓
Initialize Gemini
    ↓
┌─────────────────────────────────┐
│  Interactive Conversation Loop  │
│                                 │
│  You: [user message]           │
│      ↓                         │
│  processMessage()              │
│      ↓                         │
│  Add to conversationHistory    │
│      ↓                         │
│  Send to Gemini                │
│      ↓                         │
│  Tool calls? → MCP Client      │
│      ↓                         │
│  Add results to history        │
│      ↓                         │
│  Final response → Agent:       │
│      ↓                         │
│  You: [next message]           │
│      ↓                         │
│  (Repeat with full context)    │
└─────────────────────────────────┘
    ↓
Type "exit" or Ctrl+C
    ↓
Close MCP Connection
    ↓
Exit
```

### Conversation History Structure

```javascript
conversationHistory = [
  {
    role: "user",
    parts: [{ text: "I need a gaming laptop" }]
  },
  {
    role: "model", 
    parts: [{ functionCall: { name: "search_products", args: {...} }}]
  },
  {
    role: "user",
    parts: [{ functionResponse: { name: "search_products", response: {...} }}]
  },
  {
    role: "model",
    parts: [{ text: "I found 3 gaming laptops..." }]
  },
  {
    role: "user",
    parts: [{ text: "Which one has the best GPU?" }]
  },
  // ... continues
]
```

## Usage

### Start the Agent
```bash
cd backend
node src/agent.js
```

### Example Session
```
=================================
AI BUYER AGENT
=================================
[Agent] Connecting to Merchant MCP Server...
[MCP] Starting Merchant Commerce Server...
[MCP] MongoDB connected
[MCP] Server ready
[MCP] Tools:
  - search_products
  - get_product
  - check_inventory
[Agent] ✓ Connected to MCP server
[Agent] Discovering available tools...
[Agent] Available tools:
  - search_products
  - get_product
  - check_inventory
[Agent] MCP tools ready for Gemini

=================================
AI BUYER AGENT READY
=================================
Type your shopping request.
Type "exit" or "quit" to stop.

You: I need a gaming laptop under ₹80,000 with 32GB RAM

[LLM] Thinking...
[LLM] Calling tool: search_products
[LLM] Arguments: {
  "category": "Gaming Laptop",
  "maxPrice": 80000,
  "ram": 32
}
[MCP] Calling tool: search_products
[MCP] Arguments:
{
  "category": "Gaming Laptop",
  "maxPrice": 80000,
  "ram": 32
}
[MCP] ✓ Tool result received
[LLM] Thinking...

Agent: I found one gaming laptop that matches your requirements: the ASUS ROG Strix G16...

You: Which one has the best GPU?

[LLM] Thinking...

Agent: The ASUS ROG Strix G16 has an RTX 5070 GPU, which is excellent for gaming...

You: Is that one in stock?

[LLM] Thinking...
[LLM] Calling tool: check_inventory
[LLM] Arguments: {
  "productId": "..."
}
[MCP] Calling tool: check_inventory
[MCP] ✓ Tool result received
[LLM] Thinking...

Agent: Yes! The ASUS ROG Strix G16 is currently in stock with 12 units available...

You: exit

Agent: Goodbye! Happy shopping!

[Agent] MCP connection closed
```

## Exit Commands
- Type `exit` - graceful shutdown
- Type `quit` - graceful shutdown  
- Press `Ctrl+C` - handled gracefully

## Error Handling

### Per-Message Errors
If Gemini or MCP fails for one message:
```
❌ Agent error: [error message]

You: [can continue chatting]
```
The session continues - doesn't crash.

### Fatal Errors
If MCP connection fails at startup:
```
❌ Failed to start agent:
[error details]
```
Application exits with error code 1.

## Testing Scenarios

### Scenario 1: Basic Search
```
You: Show me gaming laptops under 80k
Agent: [lists products]
```

### Scenario 2: Follow-up Question
```
You: I need a gaming laptop
Agent: [lists options]
You: Which one has the best GPU?
Agent: [references previous results]
```

### Scenario 3: Multiple Tools
```
You: Tell me about the ASUS ROG and check if it's in stock
Agent: [uses search_products → get_product → check_inventory]
```

### Scenario 4: No Match
```
You: I want a laptop with 64GB RAM under ₹40,000
Agent: I couldn't find any products matching those requirements...
```

### Scenario 5: Natural Language Variation
```
You: Show me an ASUS gaming laptop below 80k
Agent: [correctly interprets brand=ASUS, category=Gaming Laptop, maxPrice=80000]
```

## Technical Details

### Memory Management
- **Conversation history:** Grows with each message
- **Not persisted:** Resets when application restarts
- **No database:** Pure in-memory storage
- **Future enhancement:** Add LangGraph for persistence

### Connection Management
- **MCP connection:** Created once, reused for all messages
- **Gemini API:** New request per message (with full history)
- **MongoDB:** Accessed only through MCP server

### Thread Safety
- **Not applicable:** Node.js single-threaded
- **Async handling:** Proper async/await throughout
- **No race conditions:** Sequential message processing

## What's NOT Included

- ❌ Frontend UI
- ❌ Database persistence
- ❌ LangGraph integration
- ❌ Multi-user support
- ❌ Authentication
- ❌ Razorpay payments
- ❌ Order creation
- ❌ Session management

These will be added in future days.

## Performance Notes

- **First message:** ~2-5 seconds (MCP startup + tool discovery)
- **Subsequent messages:** ~1-3 seconds (depends on tool calls)
- **History size:** No limit (may grow large in long sessions)
- **Memory usage:** Increases with conversation length

## Debugging

Enable detailed logging:
- `[Agent]` - Agent lifecycle events
- `[MCP]` - MCP tool calls
- `[LLM]` - Gemini thinking/tool calls

All logging goes to stdout.

## Known Limitations

1. **No history persistence** - Conversation resets on restart
2. **Single user** - One conversation at a time
3. **No UI** - Terminal only
4. **Growing memory** - History never cleared during session
5. **No typing indicators** - User doesn't see "thinking..." in real-time for long operations

## Future Enhancements (Not Day 3)

- Day 4: Add LangGraph for proper state management
- Day 5: Add Razorpay payment integration
- Day 6: Build React frontend
- Day 7: Multi-user sessions with authentication
- Day 8: Merchant dashboard
- Day 9: Analytics and insights

## Summary

The agent successfully converted from:
- **Single hardcoded message** → **Interactive conversation**
- **One-shot execution** → **Continuous session**
- **No context** → **Full conversation memory**

All while preserving the working MCP architecture and Gemini tool-calling logic.
