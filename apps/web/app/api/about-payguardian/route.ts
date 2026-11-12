import { NextRequest, NextResponse } from "next/server";
import { AboutPayGuardianService } from "../../../lib/about-payguardian/payguardian-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const modelId = typeof body.modelId === "string" ? body.modelId : "gemini-3.8-flash";

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const service = AboutPayGuardianService.getInstance();
    const generator = service.streamResponse(prompt, modelId);

    const encoder = new TextEncoder();
    const customReadable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of generator) {
            // Stream SSE formatted event or raw text chunk
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
          }
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (streamError: any) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: streamError?.message || "Stream error" })}\n\n`,
            ),
          );
          controller.close();
        }
      },
    });

    return new Response(customReadable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
