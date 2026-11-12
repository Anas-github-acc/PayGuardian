# PayGuardian: Technical Architecture, Security Specifications, & Knowledge Base

## 1. Executive Summary & Core Mission
**PayGuardian** is the trust, authority, and financial settlement layer for autonomous AI multi-agent ecosystems.

### The Core Problem
In autonomous systems, delegating tasks across agent hierarchies is simple. However, delegating **spending authority safely, securely, and with full non-repudiable accountability is exceptionally hard**:
- Conventional API keys grant binary, irrevocable access to bank accounts, corporate credit cards, or provider rails without boundaries.
- When an orchestrator agent spins up child and grandchild subagents (e.g. Personal Orchestrator → Travel Agent → Hotel & Flight Agents), sub-allocations multiply. Without strict mathematical constraints, recursive agent loops, rogue hallucinated transactions, and infinite money drains occur.

### The Solution
PayGuardian solves this by acting as an authoritative **Delegation Gateway**:
- **Bounded DAG Authority**: Authority is delegated along a Directed Acyclic Graph (DAG) with maximum depth ≤ 2.
- **Zero Floating-Point Error**: Strict integer-only accounting in minor currency units (e.g., cents/paisa).
- **Mathematical Invariant**: `Allocated Ceiling = Available Reserve + Active Reservations + Captured Spend` at every node at every instant.
- **Human-in-the-Loop Safeguards**: Sub-second autonomous execution for routine micro-transactions under policy limits, with mandatory hardware FIDO2 / biometric passkey confirmation for high-value operations.
- **Tamper-Evident Audit Chain**: Rolling SHA-256 cryptographic hash digests guarantee append-only immutability.
- **Fail-Closed Security**: Default-deny access policy. No implicit authority, no cross-environment contamination.

---

## 2. Core Architecture & System Topology

The PayGuardian platform is architected around 4 decoupled tiers:

```
[ User Browser / Dashboard ]
           │
           ▼
[ Next.js 16 Web Tier ]  <───────  [ REST API / MCP Tool Protocols ]
           │
           ▼
[ Fastify / Node.js Gateway Core (Vercel / Microservices) ]
    ├── Identity & Environment Registry
    ├── Mandate & DAG Authority Engine
    ├── Integer Accounting Ledger
    ├── Audit Digest Chain (SHA-256)
    └── Outbox / Provider Jobs Lease Fencing
           │
           ▼
[ PostgreSQL / Supabase Database + PGMQ Queues ]
           │
           ▼
[ Agent Runtime & Payment Workers ]
    ├── Python ADK + LangGraph Multi-Agent Orchestrator
    ├── Specialist Agents (Hotel, Flight, Transport, Procurement, Food)
    └── PayPal Sandbox Settlement Worker (2-Phase Reserve & Capture)
```

### Key Components

1. **Gateway Core (Fastify / TypeScript)**:
   - Central enforcement point verifying actor authentication, environment scoping, mandate DAG validity, policy rules, and cryptographic audit logging before any state mutation.

2. **Identity & Environment Registry**:
   - Manages sovereign, cryptographically partitioned environments (Sandbox vs Production).
   - Agent identities, memory vaults, and ledger balances are strictly partitioned. An agent in one environment cannot observe or touch another environment.

3. **Mandate & Authority Engine**:
   - Issues immutable, cryptographically signed mandates.
   - Root mandates are authorized by human owners with an explicit financial ceiling.
   - Sub-mandates are carved out from the parent's ceiling down the DAG.
   - Child mandates cannot exceed parent headroom, cannot have longer expiration dates, and cannot widen permissible scope.

4. **Integer Accounting Ledger**:
   - Tracks every minor unit without floating-point math (e.g., $100.00 is stored and processed strictly as 10,000 minor units).
   - Enforces two-phase commit:
     1. `HOLD / RESERVE`: Locks the exact minor unit amount before dispatching to a payment provider.
     2. `CAPTURE`: Deducts from reserve and marks as spent upon verified provider settlement.
     3. `RELEASE`: Frees the reserved headroom back to available balance if the provider rejects, times out, or cancels.

5. **Tamper-Evident Audit Digest**:
   - Every system mutation (mandate grant, revocation, payment reservation, capture, user message) is serialized and appended to an immutable audit log.
   - Employs rolling cryptographic hash chaining `H_n = SHA-256(H_{n-1} || Event_n)`, enabling mathematical audit proof verification.

6. **Outbox & Worker Architecture**:
   - Provider jobs are queued using durable transactional outbox patterns and Supabase PGMQ.
   - Workers lease jobs with heartbeat fencing to ensure strictly-once execution even during node crashes or network partitions.

---

## 3. Cryptographic Invariants & Product Guarantees

PayGuardian enforces 10 non-negotiable product invariants:

1. **Default-Deny Policy**: Any action not explicitly permitted by an active, unexpired, and unrevoked mandate is immediately rejected.
2. **DAG Depth Invariant (Depth ≤ 2)**:
   - Level 0: Human User (Root Authority)
   - Level 1: Primary Personal Orchestrator Agent
   - Level 2: Specialist Subagent (e.g., Hotel Specialist, Travel Specialist)
   - Subagents cannot spawn further arbitrary deep hierarchies.
3. **Budget Conservation Invariant**:
   `Sum(Child Mandate Limits) <= Parent Mandate Limit`
   Budget is carved and transferred, never cloned.
4. **Ledger Balance Invariant**:
   `Available Balance + Reserved Balance + Spent Balance == Total Authorized Ceiling`
   Holds true across concurrent threads, distributed workers, and subagent trees.
5. **Integer Minor Unit Representation**:
   Zero IEEE 754 floating-point inaccuracies. All currencies are scaled to integer minor units (USD cents, EUR cents, INR paise, JPY yen).
6. **Immutable Action Requests**:
   Every action request payload is hashed (SHA-256) and bound to a unique idempotency key. Repeating an identical request produces the exact cached decision without duplicate charges.
7. **Two-Phase Payment Decoupling**:
   Payment creation reserves funds; payment capture finalizes spend. Provider network failures or timeouts keep funds safely reserved until explicit reconciliation, never erroneously released or double-spent.
8. **Emergency Revocation Cascade**:
   Revoking a parent mandate immediately freezes and invalidates all descendant mandates and subagents in real-time. Pending reservations are safely reconciled according to policy.
9. **Zero Plaintext Secret Exposure**:
   Subagents never receive raw credit card numbers, bank credentials, or root API keys. They operate strictly through scoped capability tokens and MCP tool invocations.
10. **Hardware-Bound Biometric Passkeys (FIDO2 / WebAuthn)**:
    Transactions exceeding user-configured auto-approval thresholds mandate human operator approval via hardware passkeys or biometric signatures.

---

## 4. Multi-Agent Ecosystem & Specialist Roles

PayGuardian orchestrates a cooperative hierarchy of agents:

- **Personal Orchestrator (Primary Agent)**:
  - Deconstructs high-level human objectives (e.g., "Book a 3-day conference trip to San Francisco under $1,500").
  - Evaluates active mandates and available headroom.
  - Generates budget proposals and subagent delegation plans.
  - Dynamically discovers registered specialist capabilities via the Agent Registry.

- **Specialist Subagents**:
  - `Travel Specialist`: Plans routes, evaluates airfare vs train options, coordinates child itineraries.
  - `Hotel Specialist`: Queries lodging inventory, negotiates dates and room rates, requests booking reservations.
  - `Transport Specialist`: Evaluates ride-shares, airport shuttles, and ground transit.
  - `Procurement Specialist`: Handles vendor invoicing, purchase orders, and micro-settlements for computing/API credits.
  - `Food & Activities Specialists`: Manages meal allowances and event ticket authorizations within designated budget envelopes.

---

## 5. Model Context Protocol (MCP) & Developer Integration

PayGuardian is fully framework-agnostic:
- **Model Context Protocol (MCP)**: Native tools expose `request_mandate`, `reserve_budget`, `execute_payment`, `query_balance`, and `check_approval_status` directly into Claude Desktop, Cursor, or any MCP client.
- **REST API v1**: Clean OpenAPI / Swagger specifications under `/v1/environments/{envId}/...`.
- **Supported LLMs**:
  - Google Gemini (Gemini 3.8 Flash, Gemini 2.5 Flash, Gemini 2.5 Pro)
  - APInex GPT-6 Luna
  - Anthropic Claude (3.5 Sonnet, 3 Opus)
  - OpenAI GPT-4o / o1
  - Custom LangGraph, LangChain, CrewAI, AutoGPT, and Google ADK agents.

---

## 6. PayPal Sandbox & Payment Rails

PayGuardian integrates directly with PayPal Sandbox:
- **Order Creation**: Automatically initializes standard PayPal V2 orders with exact line-item breakdowns.
- **Provider Approval Flow**: Generates verifiable buyer checkout URLs (`payer-action`).
- **Webhook Reconciliation**: Listens to `PAYMENT.CAPTURE.COMPLETED`, `CHECKOUT.ORDER.APPROVED`, and cancellation webhooks to atomically transition ledger states from `RESERVED` to `CAPTURED` or `RELEASED`.
- **Merchant Simulation**: Simulates merchant response dynamics for stress testing without real currency risk.

---

## 7. Incognito Explainer Persona
When running in **About PayGuardian** mode:
The agent acts as a Senior Principal Security and Systems Engineer. It answers queries about architecture, security guarantees, mathematical invariants, API design, code implementation, and multi-agent coordination with utmost technical depth, clarity, and authority.
