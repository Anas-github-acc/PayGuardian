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
    modelId: string = "gemini-3.5-flash-lite",
  ): AsyncGenerator<string, void, unknown> {
    const googleApiKey =
      process.env.GOOGLE_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    const apinexApiKey = process.env.APINEX_API_KEY || process.env.OPENAI_API_KEY;

    // 1. Try Google Gemini API with verified active models
    if (googleApiKey) {
      const candidateModels = [
        "gemini-3.5-flash-lite",
        "gemini-3.5-flash",
        "gemini-3.8-flash",
      ];

      // If caller specifically requested another Gemini model, prepend it
      if (modelId && modelId.startsWith("gemini") && !candidateModels.includes(modelId)) {
        candidateModels.unshift(modelId);
      }

      for (const targetGeminiModel of candidateModels) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetGeminiModel}:streamGenerateContent?key=${googleApiKey}&alt=sse`;

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
            let streamedAnyText = false;

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
                    if (typeof text === "string" && text.length > 0) {
                      yield text;
                      streamedAnyText = true;
                    }
                  } catch {
                    // ignore malformed SSE line
                  }
                }
              }
            }

            if (streamedAnyText) {
              return;
            }
          }
        } catch {
          // Try next candidate model
        }
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
          let streamedAny = false;

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
                  if (typeof chunk === "string" && chunk.length > 0) {
                    yield chunk;
                    streamedAny = true;
                  }
                } catch {
                  // ignore
                }
              }
            }
          }

          if (streamedAny) {
            return;
          }
        }
      } catch {
        // Fall through to resilient fallback generator
      }
    }

    // 3. Resilient Dynamic Fallback (only reached if external networks are completely offline)
    const fallbackResponse = this.generateDynamicFallback(prompt);
    const words = fallbackResponse.split(" ");
    for (let i = 0; i < words.length; i++) {
      yield (i === 0 ? "" : " ") + words[i];
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
  }

  private generateDynamicFallback(query: string): string {
    return `### PayGuardian Architecture & Security

Regarding your query: **"${query}"**

- **Bounded DAG Authority**: Delegation is mathematically constrained to a maximum depth $\\le$ 2 (Human Owner $\\rightarrow$ Personal Orchestrator $\\rightarrow$ Specialist Subagents).
- **Exact Integer Accounting**: Zero floating-point approximation error. Headroom is allocated, reserved, and captured strictly in integer minor units (cents, paise).
- **Conservation Law**: Total Allocated Ceiling $\\equiv$ Available Reserve + Active Reservations + Captured Spend at all times.
- **Two-Phase Commit**: Funds are first held in the ledger before provider dispatch (PayPal Sandbox), and only captured on verified settlement webhooks.
- **Audit Integrity**: Append-only tamper-evident logs chained via rolling SHA-256 cryptographic digests.

*(Note: Live upstream LLM inference was momentarily unavailable; displayed from local technical specifications).*`;
  }
}
