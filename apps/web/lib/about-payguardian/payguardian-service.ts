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
    modelId: string = "gemini-4-hydrogen",
  ): AsyncGenerator<string, void, unknown> {
    const googleApiKey =
      process.env.GOOGLE_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    const openrouterApiKey = process.env.OPENROUTER_API_KEY;
    const openrouterBaseUrl =
      process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";

    let targetModelId = typeof modelId === "string" && modelId.trim() ? modelId.trim() : "gemini-4-hydrogen";
    if (targetModelId === "gemini-3.1-pro") {
      targetModelId = "gemini-3.1-pro-preview";
    }

    const isOpenRouterSelected =
      targetModelId.includes("/") ||
      targetModelId.includes("nemotron") ||
      targetModelId.includes("ernie") ||
      targetModelId.includes("openrouter");

    // Helper: Stream from OpenRouter / OpenAI-compatible endpoint
    const tryStreamOpenRouter = async function* (
      thisContext: AboutPayGuardianService,
      targetModel: string,
    ): AsyncGenerator<string, { ok: boolean; error?: string }, unknown> {
      if (!openrouterApiKey) return { ok: false, error: "Missing OpenRouter API key" };
      try {
        const response = await fetch(`${openrouterBaseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openrouterApiKey}`,
            "HTTP-Referer": "https://payguardian.ai",
            "X-Title": "PayGuardian",
          },
          body: JSON.stringify({
            model: targetModel,
            stream: true,
            temperature: 0.4,
            max_tokens: 4096,
            messages: [
              { role: "system", content: thisContext.getSystemInstruction() },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (!response.ok || !response.body) {
          const errData = await response.json().catch(() => ({}));
          const errMsg = errData?.error?.message || `HTTP ${response.status}`;
          return { ok: false, error: errMsg };
        }

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
              if (dataPart === "[DONE]") return { ok: true };
              try {
                const parsed = JSON.parse(dataPart);
                if (parsed.error) {
                  return { ok: false, error: parsed.error.message || "OpenRouter stream error" };
                }
                const chunk = parsed?.choices?.[0]?.delta?.content;
                if (typeof chunk === "string" && chunk.length > 0) {
                  yield chunk;
                  streamedAny = true;
                }
              } catch (e: any) {
                if (e?.message && !e.message.includes("JSON")) throw e;
              }
            }
          }
        }
        return { ok: streamedAny };
      } catch (err: any) {
        return { ok: false, error: err?.message || "OpenRouter connection error" };
      }
    };

    // Helper: Stream from Google Gemini endpoint
    const tryStreamGemini = async function* (
      thisContext: AboutPayGuardianService,
      targetModel: string,
    ): AsyncGenerator<string, { ok: boolean; error?: string }, unknown> {
      if (!googleApiKey) return { ok: false, error: "Missing Google API key" };
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:streamGenerateContent?key=${googleApiKey}&alt=sse`;

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: thisContext.getSystemInstruction() }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 4096,
            },
          }),
        });

        if (!response.ok || !response.body) {
          const errData = await response.json().catch(() => ({}));
          const errMsg = errData?.error?.message || `HTTP ${response.status}`;
          return { ok: false, error: errMsg };
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let streamedAnyText = false;
        let finishedCleanly = false;

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
              if (jsonStr === "[DONE]") {
                finishedCleanly = true;
                break;
              }
              try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.error) {
                  return { ok: false, error: parsed.error.message || "Gemini stream error" };
                }
                const candidate = parsed?.candidates?.[0];
                const text = candidate?.content?.parts?.[0]?.text;
                if (typeof text === "string" && text.length > 0) {
                  yield text;
                  streamedAnyText = true;
                }
                if (candidate?.finishReason === "STOP") {
                  finishedCleanly = true;
                }
              } catch (e: any) {
                if (e?.message && !e.message.includes("JSON")) throw e;
              }
            }
          }
        }

        return { ok: finishedCleanly || streamedAnyText };
      } catch (err: any) {
        return { ok: false, error: err?.message || "Gemini connection error" };
      }
    };

    let successfullyCompleted = false;

    // Strategy 1: User explicitly selected an OpenRouter model
    if (isOpenRouterSelected) {
      if (openrouterApiKey) {
        const openrouterGen = tryStreamOpenRouter(this, targetModelId);
        let result = await openrouterGen.next();
        while (!result.done) {
          yield result.value;
          successfullyCompleted = true;
          result = await openrouterGen.next();
        }

        const status = result.value as { ok: boolean; error?: string } | undefined;
        if (successfullyCompleted || status?.ok) {
          return;
        }

        // If OpenRouter failed, notify the user and route to Gemini
        if (status?.error) {
          yield `> ⚠️ **OpenRouter Note**: Model \`${targetModelId}\` could not be reached (${status.error}). Routed response via Google Gemini.\n\n`;
        }
      }

      // Secondary fallback to Gemini (Gemini 4 Hydrogen as default)
      if (googleApiKey) {
        const fallbackGemini = ["gemini-4-hydrogen", "gemini-3.8-flash", "gemini-3.6-flash"];
        for (const candidate of fallbackGemini) {
          const geminiGen = tryStreamGemini(this, candidate);
          let result = await geminiGen.next();
          while (!result.done) {
            yield result.value;
            successfullyCompleted = true;
            result = await geminiGen.next();
          }
          if (successfullyCompleted) return;
        }
      }
    } else {
      // Strategy 2: User explicitly selected a Gemini model (or default)
      if (googleApiKey) {
        // First try the EXACT model requested by the user!
        const primaryGen = tryStreamGemini(this, targetModelId);
        let result = await primaryGen.next();
        while (!result.done) {
          yield result.value;
          successfullyCompleted = true;
          result = await primaryGen.next();
        }

        const status = result.value as { ok: boolean; error?: string } | undefined;
        if (successfullyCompleted || status?.ok) {
          return;
        }

        // If the primary requested Gemini model failed, try candidate alternatives with 4 Hydrogen first:
        const candidateFallbacks = ["gemini-4-hydrogen", "gemini-3.8-flash", "gemini-3.6-flash"].filter(
          (m) => m !== targetModelId
        );

        if (status?.error) {
          yield `> ⚠️ **Gemini Model Note**: \`${targetModelId}\` returned: "${status.error}". Falling back to \`${candidateFallbacks[0]}\`.\n\n`;
        }

        for (const candidate of candidateFallbacks) {
          const geminiGen = tryStreamGemini(this, candidate);
          let candidateRes = await geminiGen.next();
          while (!candidateRes.done) {
            yield candidateRes.value;
            successfullyCompleted = true;
            candidateRes = await geminiGen.next();
          }
          if (successfullyCompleted) return;
        }
      }
    }

    // Strategy 3: Dynamic architectural fallback if external models are unreachable
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
