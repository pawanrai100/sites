import OpenAI from "openai";

export const handler = async (event) => {
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing OPENAI_API_KEY env var" })
      };
    }

    const type = String(event.queryStringParameters?.type || "sweet").toLowerCase();
    const isJoke = type === "joke";

    // Optional: let the site send extra context in the body (POST).
    let extra = "";
    if (event.httpMethod === "POST" && event.body) {
      try {
        const body = JSON.parse(event.body);
        if (typeof body?.extra === "string") extra = body.extra.slice(0, 400);
      } catch (_) {}
    }

    const instructions = isJoke
      ? "Write ONE short funny joke for a gamer girl. Keep it friendly and cute. No em dashes. Output only the joke."
      : "Write ONE short sweet message that feels human and genuine. Keep it friendly and cute. No em dashes. Output only the message.";

    const input = isJoke
      ? "Make it playful and gaming themed, like cozy gamer humor."
      : "Make it warm and simple, like something you would text someone you care about.";

    const client = new OpenAI({ apiKey: key });

   const resp = await client.chat.completions.create({
  	model: "gpt-4o-mini",
  	messages: [
    	{ role: "system", content: instructions },
    	{ role: "user", content: extra ? `${input}\n\nExtra context: ${extra}` : input }
  	],
  	temperature: 0.9,
  	max_tokens: 80
	});

	const text = resp.choices?.[0]?.message?.content?.trim() || "";

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({
        text: text || (isJoke ? "I tried to be productive but my bed used Taunt." : "You make today feel easier.")
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Function error", details: String(err?.message || err) })
    };
  }
};
