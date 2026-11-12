import fs from "node:fs";
import path from "node:path";

/**
 * PayGuardian Knowledge Context and System Instruction
 */
const SYSTEM_INSTRUCTION = `You are a distinguished Principal Systems & Security Engineer at PayGuardian. You possess complete, authoritative knowledge of PayGuardian's architecture, cryptographic security models, agentic delegation hierarchy, integer ledger mechanics, and payment rail integration.

Your mission is to explain PayGuardian's technology, design principles, security guarantees, and developer integrations to technical architects, developers, and business stakeholders with exceptional clarity, depth, rigor, and precision.

Core Invariants to Always Emphasize:
1. Delegating tasks to subagents is easy; delegating spending authority safely with full accountability is not.
2. Authority is mathematically bounded along a Directed Acyclic Graph (DAG) with maximum depth <= 2.
3. Integer-only accounting in minor currency units (e.g. cents, paise) eliminates floating-point errors entirely.
4. Conservation Invariant: Total Allocated Ceiling = Available Reserve + Active Reservations + Captured Spend at all times.
5. Tamper-evident audit integrity with rolling SHA-256 cryptographic hash digests.
6. Default-deny security model with no implicit privilege escalation.
7. Two-phase payment execution (Reserve -> Capture/Release) backed by PayPal Sandbox integration.
8. Hardware FIDO2 passkeys for high-value human-in-the-loop approvals.

Format your responses in structured GitHub Flavored Markdown with clean headings, bullet points, code snippets, or architectural flowcharts where helpful. Be direct, authoritative, technically precise, and engaging.`;

/**
 * Singleton Service for handling the "About PayGuardian" independent explainer agent.
 * Completely decoupled from worker queues, LangGraph orchestrators, and database migrations.
 */
export class AboutPayGuardianService {
  private static instance: AboutPayGuardianService | null = null;
  private knowledgeMarkdown: string = "";

  private constructor() {
    this.loadKnowledge();
  }

  public static getInstance(): AboutPayGuardianService {
    if (!AboutPayGuardianService.instance) {
      AboutPayGuardianService.instance = new AboutPayGuardianService();
    }
    return AboutPayGuardianService.instance;
  }

  private loadKnowledge(): void {
    try {
      const filePath = path.join(
        process.cwd(),
        "lib",
        "about-payguardian",
        "payguardian-knowledge.md",
      );
      if (fs.existsSync(filePath)) {
        this.knowledgeMarkdown = fs.readFileSync(filePath, "utf-8");
        return;
      }
      // Alternative paths if run from different root
      const altPath = path.join(
        process.cwd(),
        "apps",
        "web",
        "lib",
        "about-payguardian",
        "payguardian-knowledge.md",
      );
      if (fs.existsSync(altPath)) {
        this.knowledgeMarkdown = fs.readFileSync(altPath, "utf-8");
        return;
      }
    } catch {
      // Fallback inline knowledge
    }

    this.knowledgeMarkdown = `
# PayGuardian Architecture & Invariants
- Purpose: Bounded, auditable spending authority for delegated multi-agent hierarchies.
- Invariant 1: DAG Depth <= 2 (Human -> Personal Orchestrator -> Specialist Subagent).
- Invariant 2: Integer Minor Unit Accounting (0 floating point math errors).
- Invariant 3: Ceiling = Available + Reserved + Spent.
- Invariant 4: Tamper-Evident SHA-256 rolling audit digest.
- Invariant 5: Two-Phase Commit with PayPal Sandbox (Hold then Capture/Release).
- Invariant 6: Biometric FIDO2 hardware passkeys for human-in-the-loop approvals.
- Integration: Model Context Protocol (MCP) and REST API v1.
`;
  }

  public getKnowledge(): string {
    if (!this.knowledgeMarkdown) {
      this.loadKnowledge();
    }
    return this.knowledgeMarkdown;
  }

  public getSystemInstruction(): string {
    return `${SYSTEM_INSTRUCTION}\n\n# PAYGUARDIAN TECHNICAL SPECIFICATIONS & KNOWLEDGE BASE:\n${this.getKnowledge()}`;
  }

  /**
   * Streams response chunks from the LLM based on user prompt.
   * Emits tokens as an async generator.
   */
  public async *streamResponse(
    prompt: string,
    modelId: string = "gemini-3.8-flash",
  ): AsyncGenerator<string, void, unknown> {
    const googleApiKey =
      process.env.GOOGLE_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    const apinexApiKey = process.env.APINEX_API_KEY || process.env.OPENAI_API_KEY;

    // 1. Try Google Gemini API if key is present
    if (googleApiKey && (modelId.includes("gemini") || !apinexApiKey)) {
      try {
        const cleanModel = modelId.startsWith("gemini") ? modelId : "gemini-2.5-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:streamGenerateContent?key=${googleApiKey}&alt=sse`;

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: this.getSystemInstruction() }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 2048,
            },
          }),
        });

        if (response.ok && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder("utf-8");
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith("data: ")) {
                const jsonStr = trimmed.slice(6);
                if (jsonStr === "[DONE]") break;
                try {
                  const parsed = JSON.parse(jsonStr);
                  const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (text) {
                    yield text;
                  }
                } catch {
                  // ignore malformed SSE line
                }
              }
            }
          }
          return;
        }
      } catch (err) {
        // Fall through to next provider
      }
    }

    // 2. Try APInex / OpenAI API if available
    if (apinexApiKey) {
      try {
        const baseUrl = process.env.APINEX_BASE_URL || "https://api.apinex.bond/v1";
        const targetModel = modelId.includes("gpt") ? modelId : "free/gpt-6-luna";

        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apinexApiKey}`,
          },
          body: JSON.stringify({
            model: targetModel,
            stream: true,
            temperature: 0.4,
            messages: [
              { role: "system", content: this.getSystemInstruction() },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (response.ok && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder("utf-8");
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith("data: ")) {
                const dataPart = trimmed.slice(6);
                if (dataPart === "[DONE]") break;
                try {
                  const parsed = JSON.parse(dataPart);
                  const chunk = parsed?.choices?.[0]?.delta?.content;
                  if (chunk) {
                    yield chunk;
                  }
                } catch {
                  // ignore
                }
              }
            }
          }
          return;
        }
      } catch (err) {
        // Fall through to resilient fallback generator
      }
    }

    // 3. Resilient Deterministic Fallback Stream (ensures 100% reliability even if external APIs are unreachable)
    const fallbackResponse = this.generateFallbackExplanation(prompt);
    const words = fallbackResponse.split(" ");
    for (let i = 0; i < words.length; i++) {
      yield (i === 0 ? "" : " ") + words[i];
      // Micro-pause simulation for natural reading stream
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  private generateFallbackExplanation(query: string): string {
    const q = query.toLowerCase();

    if (q.includes("architecture") || q.includes("how it works") || q.includes("system")) {
      return `### PayGuardian System Architecture

PayGuardian is structured as an authoritative **Delegation Gateway** connecting user agents to real-world financial settlement rails:

1. **Gateway Enforcement Core (Node.js/Fastify)**: Authenticates all participating agents, validates cryptographic mandate signatures, and strictly gates financial mutations.
2. **Mandate & Authority Engine (Bounded DAG)**: Enforces delegation down a Directed Acyclic Graph with **maximum depth ≤ 2** (Human Root → Personal Orchestrator → Specialist Subagent). Budget limits are transferred between balances and cannot exceed parent headroom.
3. **Integer Accounting Ledger**: Replaces IEEE 754 floating points with exact integer minor units (e.g. cents). Eliminates calculation drift across distributed micro-transactions.
4. **Two-Phase Settlement Engine (Reserve & Capture)**: Automatically holds funds in the ledger prior to provider dispatch (PayPal Sandbox), and only transitions to captured spend upon verified settlement webhooks.
5. **Tamper-Evident SHA-256 Audit Chain**: Every state change produces a cryptographically chained rolling digest for audit immutability.`;
    }

    if (q.includes("invariant") || q.includes("security") || q.includes("guarantee")) {
      return `### PayGuardian Security Model & Cryptographic Invariants

PayGuardian guarantees absolute financial safety through strict mathematical invariants:

- **Invariant 1: Budget Conservation**:
  $$\\sum \\text{Child Mandate Ceilings} \\le \\text{Parent Mandate Limit}$$
  Headroom is carved and transferred—never duplicated or inflated.
- **Invariant 2: Constant Ledger Equilibrium**:
  $$\\text{Available Reserve} + \\text{Active Reservations} + \\text{Captured Spend} = \\text{Allocated Ceiling}$$
  Holds true concurrently across all subagent threads and transactions.
- **Invariant 3: Bounded Hierarchy (Depth ≤ 2)**:
  Prevents runaway recursive agent loops from endlessly spawning descendant agents with compounding spend limits.
- **Invariant 4: Tamper-Proof Audit Chaining**:
  Each event is sealed using $H_n = \\text{SHA-256}(H_{n-1} \\parallel \\text{Event}_n)$.
- **Invariant 5: Human-in-the-Loop Passkeys (FIDO2)**:
  Routine sub-threshold micro-transactions execute autonomously in milliseconds; high-value actions halt for cryptographic biometric sign-off.`;
    }

    if (q.includes("why") || q.includes("problem") || q.includes("solve")) {
      return `### Why We Built PayGuardian

**Delegating work to subagents is easy. But delegating spending authority safely, with full accountability, is not.**

Conventional agent frameworks hand autonomous LLMs binary, unrestricted API keys or corporate credit cards. If an agent hallucinates, loops recursively, or is compromised by prompt injection, it can drain accounts in seconds.

**PayGuardian fixes this at the foundation:**
- Humans authorize a single root budget ceiling with explicit purpose policies and expiration windows.
- The Personal Orchestrator carves out strictly bounded sub-mandates to specialists (Travel, Hotel, Procurement).
- Subagents execute within mathematically isolated envelopes. They never see raw banking secrets, and they cannot spend a single cent above their delegated allocation.`;
    }

    return `### PayGuardian Overview

**PayGuardian** is the trust and authority layer for multi-agent financial delegation.

- **Bounded Authority**: Mathematically constrained mandate delegation along a DAG (depth ≤ 2).
- **Exact Ledger**: Zero floating-point drift with integer-only minor units.
- **Two-Phase Commit**: Explicit reservation before capture on payment rails (PayPal Sandbox).
- **Tamper-Evident Audit**: Append-only SHA-256 cryptographic digest verification.
- **Framework Agnostic**: Native Model Context Protocol (MCP) server & REST API v1 for Claude, Gemini, GPT-4, and custom LangGraph agents.

Feel free to ask about our cryptographic invariants, DAG authority engine, PayPal Sandbox integration, or multi-agent orchestration architecture!`;
  }
}
