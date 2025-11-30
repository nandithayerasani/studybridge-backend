const OpenAI = require('openai');

const apiKey = process.env.OPENAI_API_KEY;

let client = null;
if (apiKey) {
  client = new OpenAI({ apiKey });
}

async function chatCompletion(messages, options = {}) {
  if (!client) return null;

  try {
    const response = await client.chat.completions.create({
      model: options.model || 'gpt-4o-mini',
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 512,
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) return null;
    if (Array.isArray(content)) {
      return content.map((c) => c.text || '').join('').trim();
    }
    return typeof content === 'string' ? content.trim() : null;
  } catch (err) {
    console.error('OpenAI chatCompletion error:', err.response?.data || err.message || err);
    return null;
  }
}

module.exports = {
  chatCompletion,
  hasOpenAIKey: !!apiKey,
};
