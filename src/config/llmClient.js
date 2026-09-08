import dotenv from "dotenv";
dotenv.config();

import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function generateText({ system, prompt, maxTokens = 1024 }) {
  const response = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    max_tokens: maxTokens,
    messages: [
      ...(system ? [{ role: "system", content: system }] : []),
      { role: "user", content: prompt },
    ],
  });

  return response.choices[0].message.content;
}
