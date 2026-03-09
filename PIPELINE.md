# Code Generation Pipeline

All references are to `playground.html` unless noted.

## Overview

```
User prompt
    |
    v
[Phase 1: Streaming Generation]
    |  generate() -> buildMessages() -> streamFetch() -> SSE parse
    |  Progressive render every 300ms
    |  Continuation on truncation (max 2)
    |  Retry on parse failure (max 3) -> fallback model
    v
Spec rendered in preview iframe
    |
    v
[Phase 2: Interactivity Pipeline]
    |
    +-- Analyze -> Visual Check -> Route by complexity:
    |
    |   none -----> done
    |   trivial --> single-shot code -> verify loop -> done
    |   simple ---> plan -> parallel chunks -> assemble -> verify loop -> done
    |   complex --> plan -> parallel chunks -> retry failed -> assemble
    |                   -> test -> review -> verify loop -> done
    v
  Done
```

## Backend Proxy

`functions/api/generate.js` — Cloudflare Pages Function that proxies to OpenRouter.

- Default model: `google/gemini-3-flash-preview`
- Passthrough params: `model`, `messages`, `max_tokens`, `reasoning`, `response_format`
- Streams SSE responses back to the client

## Phase 1: Streaming Generation (lines 3072–3203)

### Entry point

`generate()` (line 3072) — orchestrates the standard chat flow:
1. Attaches media (images, web contexts)
2. Sets UI state (loading, error vars)
3. Delegates to streaming logic

### Message building

`buildMessages(userPrompt, images, webContexts)` (line 2796) — assembles the system prompt + conversation context + attached images/web snapshots.

### Provider routing

Four stream functions handle different API formats:
- `streamDefault` / `streamOpenAI` / `streamAnthropic` / `streamOpenRouter`

All use `streamFetch()` (line 1857), a shared SSE parser.

### Rendering

- Progressive rendering every 300ms during streaming
- On `finish_reason: 'length'`: automatic continuation (max 2)
- On parse failure: retry (max 3), then fallback to `moonshotai/kimi-k2.5`

### JSON repair

`cleanJSON()` -> `JSON.parse()` -> `repairJSON()` fallback

## Phase 2: Interactivity Pipeline (lines 3204–3635)

Triggered after the spec renders successfully in the preview iframe.

### Step 1: Analyze (line 3338)

`analyzeInteractivity(spec, signal)` (line 2123)

- Model: always `google/gemini-3.1-flash-lite-preview`
- Output: `{ needed, complexity, description, elements, scaffold }`
- Complexity levels: `none` | `trivial` | `simple` | `complex`

### Step 2: Visual Check (line 3351)

`selfCheck(spec, screenshotDataUrl, signal)` (line 2073)

- Captures screenshot via `capturePreview()`
- Sends screenshot + spec + LAYOUT_RULES to AI
- Returns fixed spec or unchanged

### Step 3: Complexity Routing (line 3373)

Four paths based on `_complexity`:

#### Path A: `none` (line 3379)

Skip all remaining steps, finish immediately.

#### Path B: `trivial` (line 3454)

1. Skip plan
2. `_singleShotPath()` -> `generateInteractiveCode()` (line 2177)
   - Model: `fastModel() || 'google/gemini-3.1-pro-preview'`
3. Skip test, skip review
4. Run verify loop

#### Path C: `simple` (line 3462)

1. Plan via `planCodeArchitecture()` (line 2341)
   - Model: `fastModel() || 'google/gemini-3.1-pro-preview'`
   - If <= 1 chunk: fall back to single-shot
2. Execute chunks in parallel via `executeChunksParallel()` (line 2506)
   - Model: `fastModel() || 'google/gemini-3-flash-preview'`
   - If all fail: fall back to single-shot
3. Skip test, skip review
4. Assemble via `assembleChunkResults()` (line 2534)
5. Run verify loop

#### Path D: `complex` (line 3499)

1. Plan (same as simple)
2. Execute chunks in parallel
3. Retry failed chunks with `retryFailedChunks()` (line 2517)
   - Model: `fastModel() || 'moonshotai/kimi-k2.5'`
4. Assemble chunks
5. Test via `runChunkTests()` (line 2633) — iframe postMessage, 2s timeout
6. Review via `reviewAndAssemble()` (line 2667)
   - Model: `fastModel() || 'google/gemini-3.1-pro-preview'`
   - Inputs: plan, assembled spec, conflicts, failed chunks, test failures
   - Returns reviewed/fixed spec (or null -> use raw assembly)
7. Verify loop

### Verify Loop (line 3392)

- Toggle: `#pg-verify-loop` checkbox
- `verifyGeneratedCode(spec)` (line 2244): syntax check + ref check for `data-spec-id`
- If errors: `retryCodeGeneration()` (line 2279)
  - Model: always `google/gemini-3.1-pro-preview`
  - Max 2 retries

## Fast Mode

- Toggle: `#pg-fast-mode` checkbox
- `FAST_MODEL = 'google/gemini-3.1-flash-lite-preview'` (line 970)
- `fastModel()` (line 972): returns model override or null
- `fastEffort(stage)` (line 974): returns reduced reasoning effort

Effects:
- Uses Flash Lite for all pipeline models
- Reduces reasoning effort per stage

### Effort levels

| Stage | Standard | Fast |
|-------|----------|------|
| generate | medium | medium |
| selfCheck | medium | low |
| plan | — | low |
| chunk | varies | low |
| code | medium | medium |
| review | — | medium |

## Model Summary

| Stage | Standard Model | Fast Model |
|-------|---------------|------------|
| Generate (main chat) | gemini-3-flash-preview | gemini-3.1-flash-lite-preview |
| Analyze | gemini-3.1-flash-lite-preview | gemini-3.1-flash-lite-preview |
| Visual Check | (default) | gemini-3.1-flash-lite-preview |
| Plan | gemini-3.1-pro-preview | gemini-3.1-flash-lite-preview |
| Execute chunks | gemini-3-flash-preview | gemini-3.1-flash-lite-preview |
| Single-shot code | gemini-3.1-pro-preview | gemini-3.1-flash-lite-preview |
| Retry failed | moonshotai/kimi-k2.5 | gemini-3.1-flash-lite-preview |
| Review | gemini-3.1-pro-preview | gemini-3.1-flash-lite-preview |
| Verify fix | gemini-3.1-pro-preview | gemini-3.1-pro-preview |
| Fallback | moonshotai/kimi-k2.5 | moonshotai/kimi-k2.5 |
