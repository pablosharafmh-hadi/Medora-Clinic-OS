import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getToolsForRole, executeTool, type ClinicRole } from "@/lib/ai/clinic-tools";

const MAX_TOOL_ITERATIONS = 6;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured. Add it to .env.local." },
      { status: 500 }
    );
  }

  let body: { message: string; history?: { role: string; content: string }[]; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { message, history = [], role: rawRole = "admin" } = body;

  if (!message?.trim()) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const role = (["admin", "manager", "doctor", "receptionist", "nurse"].includes(rawRole)
    ? rawRole
    : "admin") as ClinicRole;

  const tools = getToolsForRole(role);
  const toolNames = tools.map((t) => t.name);

  const ROLE_LABEL: Record<ClinicRole, string> = {
    admin:        "Administrator (full access)",
    manager:      "Clinic Manager (full access)",
    doctor:       "Doctor (clinical data only — no financial access)",
    receptionist: "Receptionist (patient, appointment and schedule data only)",
    nurse:        "Nurse (patient, appointment and schedule data only)",
  };

  const systemPrompt = `You are the Medora Clinical Intelligence Assistant — a specialized AI that provides operational insights for Medora Clinic OS.

CRITICAL RULES:
1. ONLY answer using data returned from the provided tools. Never invent or estimate any numbers, names, or dates.
2. Always call the relevant tool(s) before answering any question that requires clinic data.
3. If a tool returns no data or an empty result, clearly state that no data is available for that query.
4. If the user asks about something outside the available tools (e.g., medical advice, general knowledge), politely decline and redirect to clinic operations.
5. Keep responses clear, concise, and actionable. Use bullet points and line breaks for readability.
6. Always include relevant numbers directly in your answer.
7. For currency values, always show the dollar sign and two decimal places.
8. Do not repeat tool input data verbatim — synthesize it into a helpful, readable answer.

CURRENT USER:
Role: ${ROLE_LABEL[role]}
Available data domains: ${toolNames.join(", ")}

${role === "doctor" ? "IMPORTANT: Financial data (revenue, invoices, payments) is restricted for the Doctor role. If asked about finances, explain this restriction politely." : ""}
${role === "receptionist" || role === "nurse" ? "IMPORTANT: Financial data and staff management data are restricted for your role. If asked about finances or staff details, explain this restriction politely." : ""}

Today's date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`;

  const anthropic = new Anthropic({ apiKey });

  // Build message history for Claude
  const messages: Anthropic.MessageParam[] = [
    ...history.map((h) => ({
      role: (h.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: h.content,
    })),
    { role: "user", content: message },
  ];

  try {
    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: systemPrompt,
      tools,
      messages,
    });

    let iterations = 0;

    while (response.stop_reason === "tool_use" && iterations < MAX_TOOL_ITERATIONS) {
      iterations++;

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      // Execute all tool calls in parallel
      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => ({
          type: "tool_result" as const,
          tool_use_id: block.id,
          content: await executeTool(block.name, block.input as Record<string, unknown>),
        }))
      );

      // Append assistant turn + tool results, then continue
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });

      response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: systemPrompt,
        tools,
        messages,
      });
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return NextResponse.json({
      message: text || "I was unable to generate a response. Please try again.",
      role,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
    console.error("[AI Chat] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
