// 和 Claude 对话：生成回复（流式）、主动打招呼、从对话里沉淀记忆。
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { buildSystemPrompt, describeSpeaker, MEMORY_EXTRACT_PROMPT } from './prompt.js';

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
const MEMORY_MODEL = process.env.CLAUDE_MEMORY_MODEL || MODEL;
const HISTORY_TURNS = 40; // 只把最近 40 条对话发给模型；更早的内容靠「记忆」延续

const hasCredentials = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
export const aiStatus = { live: hasCredentials, model: MODEL };

const client = hasCredentials ? new Anthropic() : null;

// 历史记录 → API messages：合并相邻同角色、确保第一条是 user。
function toApiMessages(history) {
  const out = [];
  for (const h of history.slice(-HISTORY_TURNS)) {
    const role = h.role === 'assistant' ? 'assistant' : 'user';
    const text = h.role === 'user' && h.speaker ? `${h.speakerNote || ''}\n${h.text}`.trim() : h.text;
    if (!text) continue;
    const last = out[out.length - 1];
    if (last && last.role === role) last.content += `\n\n${text}`;
    else out.push({ role, content: text });
  }
  if (out[0]?.role === 'assistant') out.unshift({ role: 'user', content: '（家人来看你了）' });
  return out;
}

function systemBlocks(persona, memories) {
  // 人物资料放在最前并开启缓存：同一次聊天里每句话都能复用，省钱也更快。
  return [{ type: 'text', text: buildSystemPrompt(persona, memories), cache_control: { type: 'ephemeral' } }];
}

/**
 * 流式生成回复。onText 每收到一段文字就回调一次。返回完整文本。
 * 不保存模型的 thinking 块：资料/记忆随时会被家人更新，只回放纯文本最稳。
 */
export async function streamReply({ persona, memories, history, onText, signal }) {
  if (!client) return demoReply(persona, history, onText);

  const stream = client.beta.messages.stream(
    {
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default', // 万一被安全分类器误拦，服务端自动换模型继续，不让老人看到报错
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' }, // 聊天要快，低 effort 足够
      system: systemBlocks(persona, memories),
      messages: toApiMessages(history),
    },
    { signal },
  );

  let text = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      text += event.delta.text;
      onText(event.delta.text);
    }
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === 'refusal' && !text) {
    const fallback = '这个我们换个话题聊吧，你最近过得好不好？';
    onText(fallback);
    return fallback;
  }
  return text.trim();
}

export function greetingInstruction(persona, speakerName) {
  const who = describeSpeaker(persona, speakerName) || '家人';
  return `【提示（不是家人说的话）：${who}刚刚打开 App 来看你。请你先开口，像平时见面那样打个招呼。如果近况里有值得关心的事，自然地问一句。只说一到两句。】`;
}

// ---------- 记忆沉淀 ----------

const ExtractSchema = z.object({
  memories: z.array(
    z.object({
      kind: z.enum(['told', 'life']),
      text: z.string(),
    }),
  ),
});

export async function extractMemories({ persona, existing, userText, speakerNote, aiText }) {
  if (!client || !userText.trim()) return [];
  const existingText = existing
    .slice(-150)
    .map((m) => `- ${m.text}`)
    .join('\n');
  try {
    const res = await client.messages.parse({
      model: MEMORY_MODEL,
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low', format: zodOutputFormat(ExtractSchema) },
      system: MEMORY_EXTRACT_PROMPT,
      messages: [
        {
          role: 'user',
          content:
            `已故亲人：${persona.name}\n\n【已有记忆】\n${existingText || '（无）'}\n\n` +
            `【家人说的话】${speakerNote ? `（${speakerNote}）` : ''}\n${userText}\n\n` +
            `【AI 的回应（仅供理解上下文，不得摘录）】\n${aiText}`,
        },
      ],
    });
    if (res.stop_reason === 'refusal') return [];
    return (res.parsed_output?.memories || []).filter((m) => m.text?.trim()).slice(0, 5);
  } catch (e) {
    console.warn('[memory] 抽取失败：', e.message);
    return [];
  }
}

// ---------- 演示模式（没有配置 API Key 时） ----------

async function demoReply(persona, history, onText) {
  const lastUser = [...history].reverse().find((h) => h.role === 'user' && !h.hidden);
  const lines = lastUser
    ? [
        '嗯，我在听呢。你慢慢说。',
        '这个我有点记不清了，你给我讲讲？',
        '你最近有没有好好吃饭？别太累了。',
        '听到你这么说，我心里挺高兴的。',
      ]
    : [`来啦？今天过得怎么样？`];
  const reply = `${lines[Math.floor(Math.random() * lines.length)]}（演示模式：配置 ANTHROPIC_API_KEY 后，我才会真正像${persona.name}那样说话。）`;
  for (const ch of reply.match(/.{1,4}/gsu) || []) {
    onText(ch);
    await new Promise((r) => setTimeout(r, 35));
  }
  return reply;
}
