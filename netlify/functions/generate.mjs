import OpenAI from "openai";

export const handler = async (event) => {
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing OPENAI_API_KEY env var" }),
      };
    }

    const type = String(event.queryStringParameters?.type || "sweet").toLowerCase();
    const isJoke = type === "joke";

    let extra = "";
    if (event.httpMethod === "POST" && event.body) {
      try {
        const body = JSON.parse(event.body);
        if (typeof body?.extra === "string") extra = body.extra.slice(0, 400);
      } catch (_) {}
    }

    // Make the model respond fast by forcing SHORT output + one-liners.
    const system = isJoke
      ? "You are a fast comedy writer. Output ONLY one short funny one-liner joke. No emojis. No explanations. No em dashes."
      : "You are a fast romantic texter. Output ONLY one short sweet message. No emojis. No explanations. No em dashes.";

    const user = isJoke
      ? "Make it actually funny. Safe, friendly, slightly gamer/nerdy, one-liner."
      : "Make it warm and simple, like a real text message someone would send.";

    const client = new OpenAI({ apiKey: key });

    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: extra ? `${user}\nExtra context: ${extra}` : user },
      ],
      temperature: isJoke ? 1.2 : 0.9,
      max_tokens: 60,
    });

    const text = (resp.choices?.[0]?.message?.content || "").trim();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify({
        text:
          text ||
          (isJoke
            ? "I tried to be productive, but my bed rolled a critical hit."
            : "Just a reminder: you make my day better."),
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Function error", details: String(err?.message || err) }),
    };
  }
};
