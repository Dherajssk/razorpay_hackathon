# Pre-Search Clarification Feature

## Overview
Enhanced the AI Buyer Agent to intelligently determine when to ask clarifying questions vs. when to perform product searches.

## Problem Solved
**Before:** Agent would call `search_products` too eagerly for vague requests like "I need a laptop"

**After:** Agent evaluates request sufficiency and asks ONE relevant clarifying question when needed

## Implementation Approach

### Strategy: Enhanced System Prompt
**No code logic changes** - The decision is made by the LLM based on improved instructions in the system prompt.

This approach:
- ✅ Leverages Gemini's natural language understanding
- ✅ Flexible and context-aware (not rigid rules)
- ✅ Preserves all existing MCP architecture
- ✅ No additional packages needed
- ✅ Easy to tune by adjusting prompt

## Files Modified

### 1. `src/agent.js`
Two changes:

#### A. Enhanced System Prompt
Added **PRE-SEARCH CLARIFICATION RULES** section with clear criteria:

**SUFFICIENT INFORMATION - Search immediately:**
- Clear category + meaningful constraint (e.g., "gaming laptop under ₹80k")
- Clear category + specific brand (e.g., "ASUS gaming laptop")
- Clear category + key specification (e.g., "144Hz monitor")
- Multiple constraints provided

**INSUFFICIENT INFORMATION - Ask ONE question:**
- Vague category (e.g., "I need a laptop")
- Unclear product type (e.g., "something for gaming")
- Too broad without constraints (e.g., "show me monitors")
- Category known but no constraints (e.g., "gaming laptop")

**CLARIFICATION GUIDELINES:**
- Ask only 1-2 highly relevant questions
- Don't ask for every possible attribute
- Don't ask unnecessary questions
- Remember information from previous messages
- Search immediately once sufficient info available

**CONTEXT AWARENESS:**
- Combine information from multiple messages
- Preserve all previously mentioned requirements

#### B. Decision Logging
Added visibility into the agent's decision process:

```javascript
// When no tool call (clarification or general response)
if (functionCalls.length === 0) {
  const text = parts.filter(part => part.text).map(part => part.text).join("\n");
  
  // Detect clarification
  if (text.includes("?") && conversationHistory.length <= 3) {
    console.log("\n[Agent] Request needs clarification");
    console.log("[Agent] Asking clarifying question");
  }
  
  return text;
}

// When tool call detected (sufficient information)
console.log("\n[Agent] Request is sufficient for search");
console.log("[Agent] Proceeding with MCP tool call(s)");
```

## How It Works

### Decision Flow

```
User Message
    ↓
Add to conversationHistory
    ↓
Send to Gemini (with enhanced system prompt)
    ↓
Gemini evaluates sufficiency
    ↓
    ├─→ INSUFFICIENT → Generate clarifying question
    │                  ↓
    │                  Return text to user (no tool call)
    │                  ↓
    │                  Wait for user response
    │                  ↓
    │                  Combine with previous context
    │                  ↓
    │                  Re-evaluate
    │
    └─→ SUFFICIENT → Generate tool call
                      ↓
                      Call MCP tool
                      ↓
                      Return results
```

### Key Principles

1. **LLM-Driven Decision:** Gemini makes the sufficiency determination based on the system prompt guidelines

2. **Context Preservation:** Full conversation history maintained, so Gemini can combine info from multiple messages

3. **One Question at a Time:** System prompt instructs to ask 1-2 relevant questions, not interrogate

4. **No Hard-Coded Rules:** No `if (!budget)` logic - flexible and natural

5. **Existing Tools Unchanged:** MCP tools, server, and MongoDB integration untouched

## Test Cases

### TEST 1: Vague Request - Laptop

**Input:**
```
You: I need a laptop.
```

**Expected Behavior:**
- ❌ No `search_products` call
- ✅ Ask clarifying question
- Likely: "What's your approximate budget?" or "What will you use it for?"

**Logs:**
```
[Agent] Request needs clarification
[Agent] Asking clarifying question
```

---

### TEST 2: Category Without Constraints - Gaming Laptop

**Input:**
```
You: I need a gaming laptop.
```

**Expected Behavior:**
- ❌ No `search_products` call yet
- ✅ Ask for important missing requirement (probably budget)

**Example Response:**
```
Agent: What's your approximate budget for the gaming laptop?
```

---

### TEST 3: Sufficient - Gaming Laptop with Budget

**Input:**
```
You: I need a gaming laptop under ₹80k.
```

**Expected Behavior:**
- ✅ Immediate `search_products` call
- Arguments: `{"category": "Gaming Laptop", "maxPrice": 80000}`

**Logs:**
```
[Agent] Request is sufficient for search
[Agent] Proceeding with MCP tool call(s)
[LLM] Calling tool: search_products
[LLM] Arguments: {"category": "Gaming Laptop", "maxPrice": 80000}
```

---

### TEST 4: Multi-Turn - Context Preservation

**Input:**
```
You: I need a gaming laptop.
Agent: What's your approximate budget?
You: Under ₹80k.
```

**Expected Behavior:**
- First message: Ask clarification
- Second message: Remember "gaming laptop" + combine with "under ₹80k"
- ✅ Call `search_products` with: `{"category": "Gaming Laptop", "maxPrice": 80000}`

**Key:** Gemini uses full `conversationHistory` to combine constraints

---

### TEST 5: Sufficient - Multiple Constraints

**Input:**
```
You: I need a gaming laptop under ₹80k with 32GB RAM.
```

**Expected Behavior:**
- ✅ Immediate search
- ❌ No additional clarification questions
- Arguments: `{"category": "Gaming Laptop", "maxPrice": 80000, "ram": 32}`

---

### TEST 6: Sufficient - Brand + Category + Price

**Input:**
```
You: Show me an ASUS gaming laptop below 70k.
```

**Expected Behavior:**
- ✅ Immediate search
- Arguments should include:
  - `brand: "ASUS"`
  - `category: "Gaming Laptop"`
  - `maxPrice: 70000`

---

### TEST 7: Unclear Product Type

**Input:**
```
You: I want something for gaming.
```

**Expected Behavior:**
- ❌ No search (product type unclear)
- ✅ Ask: "What type of product are you looking for — a laptop, monitor, or something else?"

---

### TEST 8: Specification-Based Search

**Input:**
```
You: I need a 144Hz monitor.
```

**Expected Behavior:**
- LLM determines if this is sufficiently searchable
- **Option A:** Search immediately (specification is meaningful)
- **Option B:** Ask ONE concise question if critical info missing (e.g., budget if needed)
- ❌ Should NOT ask for every attribute

**Most Likely:** Immediate search with `{"category": "Monitor", "refreshRate": 144}`

---

## Logging Output Examples

### Clarification Scenario
```
You: I need a laptop.

[LLM] Thinking...
[Agent] Request needs clarification
[Agent] Asking clarifying question

Agent: Sure! What's your approximate budget?
```

### Sufficient Scenario
```
You: I need a gaming laptop under ₹80k.

[LLM] Thinking...
[Agent] Request is sufficient for search
[Agent] Proceeding with MCP tool call(s)
[LLM] Calling tool: search_products
[LLM] Arguments: {
  "category": "Gaming Laptop",
  "maxPrice": 80000
}
[MCP] Calling tool: search_products
[MCP] ✓ Tool result received

Agent: I found 3 gaming laptops under ₹80,000...
```

### Multi-Turn Context Preservation
```
You: I need a gaming laptop.

[LLM] Thinking...
[Agent] Request needs clarification
[Agent] Asking clarifying question

Agent: What's your approximate budget?

You: Under ₹80k.

[LLM] Thinking...
[Agent] Request is sufficient for search
[Agent] Proceeding with MCP tool call(s)
[LLM] Calling tool: search_products
[LLM] Arguments: {
  "category": "Gaming Laptop",
  "maxPrice": 80000
}
```

## What Didn't Change

✅ **MCP Server** - `src/mcp/server.js` untouched  
✅ **MCP Tools** - All 3 tools unchanged  
✅ **Tool Schemas** - `search_products`, `get_product`, `check_inventory` unchanged  
✅ **MCP Client Logic** - Connection and tool calling unchanged  
✅ **Conversation History** - Same in-memory storage  
✅ **Agent Architecture** - Same MCP flow  
✅ **MongoDB Integration** - Unchanged  
✅ **No New Packages** - Zero dependencies added  

## How Agent Logic Changed

**Before:**
```
User Message → Gemini → Tool Call (often too eager)
```

**After:**
```
User Message 
    ↓
Gemini (with enhanced prompt)
    ↓
Evaluate Sufficiency
    ↓
Insufficient? → Clarifying Question
Sufficient? → Tool Call
```

**Implementation:** Entirely through system prompt - no code logic changes to decision flow

## Benefits

1. **Better User Experience:** No premature searches with vague criteria
2. **Fewer Wasted Searches:** Only search when meaningful
3. **Natural Conversation:** Feels like talking to a helpful assistant
4. **Context-Aware:** Combines info across multiple messages
5. **Flexible:** LLM adapts to different product types and contexts
6. **Maintainable:** System prompt easier to tune than hard-coded rules

## Limitations

1. **LLM-Dependent:** Quality depends on Gemini's reasoning
2. **Not Deterministic:** Same input might occasionally produce different behavior
3. **No Hard Guarantees:** Can't force "always ask budget first"
4. **Prompt Engineering:** May need tuning based on real usage patterns

## Future Enhancements (Not Implemented)

- Configurable strictness (more/less clarification)
- Analytics on clarification effectiveness
- User preference learning (some users prefer more/less questions)
- Domain-specific clarification strategies per product category

## Summary

Successfully added pre-search clarification through:
- ✅ Enhanced system prompt with clear sufficiency criteria
- ✅ Decision logging for visibility
- ✅ Zero architectural changes
- ✅ Zero new dependencies
- ✅ Preserved all existing MCP functionality
- ✅ LLM-driven flexible decision making

The agent now intelligently asks clarifying questions for vague requests while immediately searching when sufficient information is provided.
