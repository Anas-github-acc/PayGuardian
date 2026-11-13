import { describe, expect, it } from "vitest";
import { AboutPayGuardianService } from "../payguardian-service";
import { POST } from "../../../app/api/about-payguardian/route";
import { NextRequest } from "next/server";

describe("AboutPayGuardianService Singleton & Explainer", () => {
  it("enforces a strict singleton instance", () => {
    const instanceA = AboutPayGuardianService.getInstance();
    const instanceB = AboutPayGuardianService.getInstance();
    expect(instanceA).toBe(instanceB);
  });

  it("loads the complete PayGuardian knowledge base", () => {
    const service = AboutPayGuardianService.getInstance();
    const knowledge = service.getKnowledge();

    expect(knowledge).toBeDefined();
    expect(knowledge.length).toBeGreaterThan(100);
    expect(knowledge).toContain("DAG");
    expect(knowledge).toContain("Integer");
    expect(knowledge).toContain("PayPal");
    expect(knowledge).toContain("Invariant");
  });

  it("provides the experienced systems & security engineering system instruction", () => {
    const service = AboutPayGuardianService.getInstance();
    const instruction = service.getSystemInstruction();

    expect(instruction).toContain("Principal Systems & Security Engineer");
    expect(instruction).toContain("PayGuardian");
    expect(instruction).toContain("PAYGUARDIAN TECHNICAL SPECIFICATIONS");
  });

  it("streams response tokens for PayGuardian architecture queries", async () => {
    const service = AboutPayGuardianService.getInstance();
    const generator = service.streamResponse("What is the architecture of PayGuardian?");

    let fullText = "";
    let chunkCount = 0;
    for await (const chunk of generator) {
      fullText += chunk;
      chunkCount++;
      if (chunkCount >= 3) break;
    }

    expect(chunkCount).toBeGreaterThan(0);
    expect(fullText.length).toBeGreaterThan(0);
  }, 15000);

  it("handles POST /api/about-payguardian endpoint and validates prompt input", async () => {
    // Missing prompt returns 400
    const emptyReq = new NextRequest("http://localhost:3000/api/about-payguardian", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const emptyRes = await POST(emptyReq);
    expect(emptyRes.status).toBe(400);

    // Valid prompt returns 200 with text/event-stream
    const validReq = new NextRequest("http://localhost:3000/api/about-payguardian", {
      method: "POST",
      body: JSON.stringify({ prompt: "Explain the DAG depth <= 2 invariant" }),
    });
    const validRes = await POST(validReq);
    expect(validRes.status).toBe(200);
    expect(validRes.headers.get("content-type")).toContain("text/event-stream");
  });
});
