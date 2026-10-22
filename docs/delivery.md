# Step 1: delivery format

## Assumptions and open questions
- SDK generation is future scope; no SDK is required for initial-release completion.
- Hosted service providers and remaining libraries await Step 4 approval.

## Status
Approved by the user. This approval is a planning decision, not an implementation claim.

## Deliverables
1. **Next.js website/dashboard:** configure environments, root authority, agents, policies and approvals; inspect budgets, payments and audit history.
2. **REST API:** canonical, versioned external contract shared with website workflows and future SDKs.
3. **Remote MCP server:** authenticated agent integration using the same gateway enforcement.
4. **Python ADK agent runtime:** Personal, Travel, Hotel, Transport, Food and Activities agents using Gemini, deployed separately from the gateway on Render.
5. **One monorepo:** shared contracts, isolated runtime boundaries, reproducible development, and future SDK extension points.

APIMatic is included for API documentation and contract validation; SDK generation is deferred. The gateway remains framework-agnostic for external integrations.
