# AI Buyer Agent - Quick Start Guide

## What is This?

An AI shopping assistant that uses Google Gemini to understand natural language and interact with the merchant's product catalog through MCP (Model Context Protocol).

## Architecture

```
Customer Question
       ↓
   Gemini AI (understands intent)
       ↓
   MCP Tools (structured queries)
       ↓
   Product Database
       ↓
   Natural Language Answer
```

## Setup

### 1. Get Gemini API Key

Visit: https://makersuite.google.com/app/apikey

Create a free API key (no credit card required).

### 2. Add to .env

```bash
GEMINI_API_