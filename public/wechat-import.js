// 微信聊天记录导入：解析 → 统计说话习惯 → 挑样本 → 隐藏隐私 → 生成给 Claude 的分析请求。
// 纯函数、无依赖：浏览器（App 与原型页）和 Node 服务器共用同一份代码。
// 一切解析都在本地完成；只有挑选出的「TA 的部分消息」（已隐藏手机号等）才会发给 Claude。

// ---------- 1. 解析 ----------

const KIND_RULES = [
  ['voice', /^\[?(语音|voice)\]?\s*(\d+(\.\d+)?\s*(秒|″|"|s))?$|^\[语音\]/i],
  ['image', /^\[(图片|照片|image)\]$/i],
  ['video', /^\[(视频|video)\]$/i],
  ['sticker', /^\[(动画表情|表情|sticker)\]$/i],
  ['call', /^\[?(语音通话|视频通话)\]?|通话时长|已取消|对方已拒绝|^\[通话\]/],
  ['money', /^\[(红包|转账|微信红包)\]|^\[转账\]/],
  ['system', /撤回了一条消息|拍了拍|以上是打招呼的内容|^<msg>|^<\?xml|加入了群聊|^\[系统消息\]/],
  ['other', /^\[(文件|链接|位置|名片|小程序|音乐|聊天记录)\]/],
];

export function messageKind(text) {
  const t = String(text || '').trim();
  if (!t) return 'other';
  for (const [kind, re] of KIND_RULES) if (re.test(t)) return kind;
  return 'text';
}

const D_FULL = String.raw`\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?(?:\s+|T)\d{1,2}:\d{2}(?::\d{2})?`;
const D_MD = String.raw`\d{1,2}月\d{1,2}日\s*\d{1,2}:\d{2}(?::\d{2})?`;
const D_HM = String.raw`\d{1,2}:\d{2}(?::\d{2})?`;
const TIME = `(${D_FULL}|${D_MD}|${D_HM})`;
const NAME = String.raw`([^\s:：，。！？,!?\[\]【】][^:：，。！？,!?\[\]【】\n]{0,31}?)`;
const HEADERS = [
  { id: 'time-name-inline', re: new RegExp(String.raw`^\[?${TIME}\]?\s+${NAME}\s*[:：]\s*(.+)$`), order: ['time', 'name', 'text'] },
  { id: 'time-name', re: new RegExp(String.raw`^\[?${TIME}\]?\s+${NAME}\s*[:：]?$`), order: ['time', 'name'] },
  { id: 'name-time', re: new RegExp(String.raw`^${NAME}\s+[(（]?${TIME}[)）]?\s*[:：]?$`), order: ['name', 'time'] },
  { id: 'name-time-inline', re: new RegExp(String.raw`^${NAME}\s+[(（]?${TIME}[)）]?\s*[:：]\s*(.+)$`), order: ['name', 'time', 'text'] },
];
const DATE_LINE = /^[-—=\s]*(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?[^:\d]*[-—=\s]*$/;

function toDate(timeStr, currentDate) {
  let m = timeStr.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?(?:\s+|T)(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  m = timeStr.match(/(\d{1,2})月(\d{1,2})日\s*(\d{1,2}):(\d{2})/);
  if (m) return new Date((currentDate || new Date()).getFullYear(), +m[1] - 1, +m[2], +m[3], +m[4]);
  m = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (m && currentDate) return new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), +m[1], +m[2]);
  return null;
}

function parseCsvRows(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const pick = (obj, keys) => {
  for (const k of keys) {
    const hit = Object.keys(obj).find((x) => x.toLowerCase() === k.toLowerCase());
    if (hit && obj[hit] !== undefined && obj[hit] !== '') return obj[hit];
  }
  return undefined;
};
const CONTENT_KEYS = ['StrContent', 'content', 'text', 'message', 'msg', '内容', '消息内容', '消息'];
const SENDER_KEYS = ['Sender', 'senderName', 'sender', 'NickName', 'nickname', 'talkerName', '发送人', '发送者', '昵称', '说话人', 'from'];
const TIME_KEYS = ['StrTime', 'time', 'createTime', 'CreateTime', 'timestamp', '时间', '发送时间', 'date'];
const ISME_KEYS = ['IsSender', 'isSender', 'is_sender', 'isSelf', '是否发送者'];

function fromRecords(records) {
  return records
    .map((r) => {
      let text = pick(r, CONTENT_KEYS);
      if (text && typeof text === 'object') text = text.text || JSON.stringify(text);
      text = String(text ?? '').trim();
      let sender = pick(r, SENDER_KEYS);
      const isMe = pick(r, ISME_KEYS);
      if (isMe !== undefined && String(isMe).trim() !== '') {
        if (String(isMe) === '1' || isMe === true || String(isMe).toLowerCase() === 'true') sender = '我';
        else if (!sender) sender = pick(r, ['Remark', 'remark', '备注']) || '对方';
      }
      let t = pick(r, TIME_KEYS);
      let time = null;
      if (typeof t === 'number' || /^\d{10,13}$/.test(String(t ?? ''))) time = new Date(Number(t) * (String(t).length <= 10 ? 1000 : 1));
      else if (t) time = toDate(String(t)) || (isNaN(Date.parse(t)) ? null : new Date(t));
      return { sender: String(sender || '').trim() || '未知', time, text, kind: messageKind(text) };
    })
    .filter((m) => m.text);
}

/** 自动识别格式并解析。返回 { messages, format, senders: [{name, count}] } */
export function parseWeChat(raw) {
  const text = String(raw || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').replace(/ | /g, ' ');
  let messages = [];
  let format = '';

  // JSON（部分导出工具）
  const trimmed = text.trim();
  if (/^[[{]/.test(trimmed)) {
    try {
      const j = JSON.parse(trimmed);
      const arr = Array.isArray(j) ? j : j.messages || j.data || j.items || [];
      if (Array.isArray(arr) && arr.length) { messages = fromRecords(arr); format = 'JSON'; }
    } catch {}
  }

  // CSV（留痕 / WeChatMsg 等导出）
  if (!messages.length) {
    const first = trimmed.split('\n', 1)[0];
    if (first.includes(',') && CONTENT_KEYS.some((k) => first.toLowerCase().includes(k.toLowerCase()))) {
      const rows = parseCsvRows(trimmed);
      const head = rows.shift().map((h) => h.trim());
      messages = fromRecords(rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]]))));
      format = 'CSV';
    }
  }

  // 纯文本（复制粘贴 / TXT 导出）
  if (!messages.length) {
    const lines = text.split('\n');
    const sample = lines.slice(0, 2000);
    let best = null;
    for (const h of HEADERS) {
      let n = 0, dated = 0;
      for (const l of sample) {
        const m = l.trim().match(h.re);
        if (m) { n++; if (!new RegExp(`^${D_HM}$`).test(m[h.order.indexOf('time') + 1])) dated++; }
      }
      const score = n + dated * 2;
      if (n >= 2 && (!best || score > best.score)) best = { ...h, score };
    }

    if (best) {
      format = '文本';
      // 第一遍：只有时间是 HH:MM 的头，名字必须是常见发送者，避免把「明天 8:30」误认成一条消息
      const nameCount = new Map();
      for (const l of lines) {
        const m = l.trim().match(best.re);
        if (m) { const name = m[best.order.indexOf('name') + 1].trim(); nameCount.set(name, (nameCount.get(name) || 0) + 1); }
      }
      let cur = null, curDate = null;
      const push = () => { if (cur && cur.text.trim()) { cur.text = cur.text.trim(); cur.kind = messageKind(cur.text); messages.push(cur); } };
      for (const line of lines) {
        const l = line.trim();
        const dl = l.match(DATE_LINE);
        if (dl) { curDate = new Date(+dl[1], +dl[2] - 1, +dl[3]); continue; }
        const m = l.match(best.re);
        if (m) {
          const get = (k) => (best.order.includes(k) ? m[best.order.indexOf(k) + 1] : '');
          const name = get('name').trim();
          const timeStr = get('time');
          const onlyHM = new RegExp(`^${D_HM}$`).test(timeStr);
          if (!onlyHM || (nameCount.get(name) || 0) >= 2 || nameCount.size <= 3) {
            push();
            const time = toDate(timeStr, curDate);
            if (time && !onlyHM) curDate = time;
            cur = { sender: name, time, text: get('text') || '' };
            continue;
          }
        }
        if (cur) cur.text += (cur.text ? '\n' : '') + line;
      }
      push();
    } else {
      // 兜底：「名字：内容」逐行
      format = '名字：内容';
      for (const l of lines) {
        const m = l.trim().match(/^([^\s:：，。！？]{1,16})[:：]\s*(.+)$/);
        if (m) messages.push({ sender: m[1], time: null, text: m[2].trim(), kind: messageKind(m[2]) });
      }
    }
  }

  const counts = new Map();
  for (const m of messages) counts.set(m.sender, (counts.get(m.sender) || 0) + 1);
  const senders = [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  return { messages, format, senders };
}

// ---------- 2. 隐私 ----------

export function redact(s) {
  return String(s)
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[邮箱已隐藏]')
    .replace(/\b\d{17}[\dXx]\b/g, '[证件号已隐藏]')
    .replace(/\b\d{15,19}\b/g, '[卡号已隐藏]')
    .replace(/(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d[-\s]?\d{4}[-\s]?\d{4}(?!\d)/g, '[手机号已隐藏]')
    .replace(/(?<!\d)0\d{2,3}-?\d{7,8}(?!\d)/g, '[电话已隐藏]')
    .replace(/(密码|验证码|口令|pin)\s*[:：是为]?\s*\S+/gi, '$1[已隐藏]');
}

// ---------- 3. 说话习惯统计（本地，不需要 AI） ----------

const PARTICLES = ['啊', '呀', '呢', '吧', '嘛', '哦', '噢', '哈', '啦', '咯', '嘞', '呗', '哎', '唉', '嗯', '哟', '喔'];
const GENERIC = new Set(['我们', '你们', '他们', '一个', '什么', '这个', '那个', '没有', '可以', '就是', '还是', '不是', '知道', '现在', '今天', '时候', '自己', '已经', '一下', '怎么', '因为', '所以', '但是', '然后', '如果', '这样', '那样', '的话', '一点', '这么', '那么']);
const WX_EMOJI = /\[[一-龥A-Za-z]{1,4}\]/g;
const UNI_EMOJI = /\p{Extended_Pictographic}/gu;

function periodOf(h) {
  return h < 5 ? '深夜' : h < 9 ? '清晨' : h < 12 ? '上午' : h < 14 ? '中午' : h < 18 ? '下午' : h < 21 ? '傍晚' : '晚上';
}

export function analyzeSpeaker(messages, who) {
  const mine = messages.filter((m) => m.sender === who);
  const texts = mine.filter((m) => m.kind === 'text').map((m) => m.text.replace(WX_EMOJI, '').trim()).filter(Boolean);
  const times = mine.map((m) => m.time).filter((t) => t && !isNaN(t));
  const n = Math.max(texts.length, 1);
  const kindCount = (k) => mine.filter((m) => m.kind === k).length;

  // 表情
  const emo = new Map();
  for (const m of mine) for (const e of [...(m.text.match(WX_EMOJI) || []), ...(m.text.match(UNI_EMOJI) || [])]) {
    if (/^\[(图片|语音|视频|表情|动画表情|文件|链接|位置|红包|转账|名片|通话)\]$/.test(e)) continue;
    emo.set(e, (emo.get(e) || 0) + 1);
  }
  // 语气词（句末）
  const part = new Map();
  for (const t of texts) {
    const m = t.match(/([一-龥])[~～!！。？?…\s]*$/);
    if (m && PARTICLES.includes(m[1])) part.set(m[1], (part.get(m[1]) || 0) + 1);
  }
  // 标点习惯
  const punct = [];
  const share = (re) => texts.filter((t) => re.test(t)).length / n;
  if (share(/[~～]/) > 0.08) punct.push('爱用波浪号「~」');
  if (share(/[!！]{2,}|！/) > 0.15) punct.push('常用感叹号');
  if (share(/[。.]{3,}|…/) > 0.08) punct.push('爱用省略号');
  if (share(/[?？]{2,}/) > 0.03) punct.push('会连打问号');
  if (share(/[。]$/) < 0.05) punct.push('句尾很少加句号');
  if (share(/哈{2,}/) > 0.05) punct.push('常打「哈哈哈」');

  // 口头禅：重复出现的短句 + 高频词组（按出现在多少条消息里计）
  const whole = new Map();
  for (const t of texts) {
    const s = t.replace(/[\s。！!？?~～，,.…]+$/g, '');
    if (s.length >= 2 && s.length <= 12) whole.set(s, (whole.get(s) || 0) + 1);
  }
  const grams = new Map();
  for (const t of texts) {
    const seen = new Set();
    const clean = t.replace(/[^一-龥]+/g, '|');
    for (const seg of clean.split('|')) {
      for (let len = 3; len <= 6; len++) for (let i = 0; i + len <= seg.length; i++) seen.add(seg.slice(i, i + len));
    }
    for (const g of seen) grams.set(g, (grams.get(g) || 0) + 1);
  }
  const minDf = Math.max(3, Math.round(texts.length * 0.012));
  let gramList = [...grams].filter(([g, c]) => c >= minDf && !GENERIC.has(g) && ![...GENERIC].some((w) => g === w)).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
  const keptGrams = [];
  for (const [g, c] of gramList) {
    if (keptGrams.some(([k, kc]) => (k.includes(g) && kc >= c * 0.7) || (g.includes(k) && c >= kc * 0.7))) continue;
    keptGrams.push([g, c]);
    if (keptGrams.length >= 12) break;
  }
  const phrases = new Map();
  for (const [s, c] of whole) if (c >= 2) phrases.set(s, c);
  for (const [g, c] of keptGrams) if (![...phrases.keys()].some((p) => p.includes(g))) phrases.set(g, c);
  const catchphrases = [...phrases].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([text, count]) => ({ text, count }));

  // 怎么称呼对方：消息开头的称呼
  const voc = new Map();
  for (const t of texts) {
    const m = t.match(/^([一-龥]{1,3})[，,！!~～\s]/);
    if (m && !GENERIC.has(m[1]) && !/^(好|嗯|哦|对|是|不|没|我|你|他|她|在|要|就|也|还|天|今|明|昨|这|那)/.test(m[1]) && !/[了吗呢吧啊没的过着]$/.test(m[1])) voc.set(m[1], (voc.get(m[1]) || 0) + 1);
  }

  // 作息
  const hours = new Array(24).fill(0);
  for (const t of times) hours[t.getHours()]++;
  const periods = new Map();
  hours.forEach((c, h) => periods.set(periodOf(h), (periods.get(periodOf(h)) || 0) + c));
  const topPeriod = [...periods].sort((a, b) => b[1] - a[1])[0];

  const lens = texts.map((t) => [...t].length).sort((a, b) => a - b);
  const sorted = times.slice().sort((a, b) => a - b);
  return {
    who,
    total: mine.length,
    textCount: texts.length,
    voiceShare: mine.length ? kindCount('voice') / mine.length : 0,
    stickerShare: mine.length ? (kindCount('sticker') + kindCount('image')) / mine.length : 0,
    medianLength: lens.length ? lens[Math.floor(lens.length / 2)] : 0,
    from: sorted[0] || null,
    to: sorted[sorted.length - 1] || null,
    hours,
    topPeriod: topPeriod && topPeriod[1] ? topPeriod[0] : '',
    emojis: [...emo].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([text, count]) => ({ text, count })),
    particles: [...part].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([text, count]) => ({ text, count })),
    punctuation: punct,
    catchphrases,
    vocatives: [...voc].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([text, count]) => ({ text, count })),
  };
}

// ---------- 4. 挑样本：均匀覆盖时间、去重、带上对方的上一句 ----------

export function pickSamples(messages, who, { maxPairs = 60, maxSolo = 140 } = {}) {
  const pairs = [];
  const solo = [];
  const seen = new Set();
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.sender !== who || m.kind !== 'text') continue;
    const t = m.text.trim();
    const len = [...t].length;
    if (len < 2 || len > 160 || seen.has(t)) continue;
    seen.add(t);
    let prev = null;
    for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
      if (messages[j].sender !== who) {
        const near = !m.time || !messages[j].time || m.time - messages[j].time < 6 * 3600 * 1000; // 隔了半天的不算一问一答
        if (messages[j].kind === 'text' && near) prev = messages[j];
        break;
      }
    }
    const item = { text: redact(t), time: m.time, prev: prev ? { sender: prev.sender, text: redact(prev.text.slice(0, 120)) } : null };
    (prev ? pairs : solo).push(item);
  }
  const spread = (arr, k) => (arr.length <= k ? arr : Array.from({ length: k }, (_, i) => arr[Math.floor((i * arr.length) / k)]));
  return { pairs: spread(pairs, maxPairs), solo: spread(solo, maxSolo) };
}

/** 存进人物资料的「以前发过的消息」：对方一句、TA 一句，最能教会模型语气 */
export function formatSamplesForProfile(samples, who, max = 9000) {
  const lines = [];
  for (const p of samples.pairs) lines.push(`对方：${p.prev.text}\n${who}：${p.text}`);
  for (const s of samples.solo) lines.push(`${who}：${s.text}`);
  let out = '';
  for (const l of lines) { if (out.length + l.length > max) break; out += (out ? '\n' : '') + l; }
  return out;
}

// ---------- 5. 给 Claude 的分析请求 ----------

const fmtDate = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '');

export function describeStats(st) {
  const p = (x) => `${Math.round(x * 100)}%`;
  const lines = [
    `共 ${st.total} 条消息${st.from ? `（${fmtDate(st.from)} 至 ${fmtDate(st.to)}）` : ''}，文字消息中位长度 ${st.medianLength} 个字。`,
    `语音占 ${p(st.voiceShare)}，图片/表情占 ${p(st.stickerShare)}。`,
    st.topPeriod ? `最常在${st.topPeriod}发消息。` : '',
    st.catchphrases.length ? `反复出现的说法：${st.catchphrases.map((c) => `「${c.text}」×${c.count}`).join('、')}。` : '',
    st.particles.length ? `句末语气词：${st.particles.map((c) => `${c.text}×${c.count}`).join('、')}。` : '',
    st.emojis.length ? `常用表情：${st.emojis.map((c) => `${c.text}×${c.count}`).join(' ')}。` : '',
    st.punctuation.length ? `标点习惯：${st.punctuation.join('，')}。` : '',
    st.vocatives.length ? `消息开头常用的称呼：${st.vocatives.map((c) => `「${c.text}」×${c.count}`).join('、')}。` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

export const ANALYSIS_FIELDS = {
  personality: '2～3 句话的性格描述，必须能从消息里看出来',
  traits: '最多 6 个性格词（字符串数组）',
  speakingStyle: '说话的样子：句子长短、语气、用词、爱用的表达。具体，附 1～2 个原话例子',
  catchphrases: '口头禅（字符串数组，必须是消息里的原话，最多 8 个）',
  addressesOtherAs: 'TA 怎么称呼聊天的另一方（没有就空字符串）',
  loveStyle: 'TA 怎么表达关心和爱（例如反复叮嘱、问吃饭没有），附原话例子',
  habits: '从消息里看得出的生活习惯和作息',
  likes: '从消息里看得出的喜好',
  memories: '数组，每项 {text, evidence, date}：消息里明确提到的、值得记住的事实或共同经历；text 用第三人称写成一句话，evidence 是支撑它的原话（不超过 40 字），date 是 YYYY-MM-DD 或空字符串。最多 12 条',
  gaps: '一句话：这些聊天记录看不出 TA 的哪些方面（例如生气时的样子），提醒家人补充',
};

export function buildAnalysisPrompt({ who, other, stats, samples }) {
  const pairText = samples.pairs.map((p) => `[${fmtDate(p.time)}] ${p.prev.sender}：${p.prev.text}\n[${fmtDate(p.time)}] ${who}：${p.text}`).join('\n');
  const soloText = samples.solo.map((s) => `[${fmtDate(s.time)}] ${who}：${s.text}`).join('\n');
  return `下面是一位已经离开的亲人「${who}」生前和家人「${other || '家人'}」的微信聊天片段（已隐藏手机号等隐私）。家人想用这些记录，让一个 AI 回声尽量像 TA 说话。

请你只根据这些消息，总结 TA 的说话方式和为人。规则：
- 每一条结论都必须能在消息里找到依据。看不出来的就留空，绝对不要编造或美化。
- 口头禅和例子必须是原话。
- 「memories」只收录消息里明确提到的事实（人名、地点、事情、计划），不要推测。
- 用简体中文，语气平实、温暖。

【本地统计】
${describeStats(stats)}

【对话片段（对方一句，TA 回一句）】
${pairText || '（无）'}

【TA 的其他消息】
${soloText || '（无）'}

只输出一个 JSON 对象，不要任何其他文字。字段：
${Object.entries(ANALYSIS_FIELDS).map(([k, v]) => `- ${k}：${v}`).join('\n')}`;
}

/** 把模型返回的 JSON 收拾干净（字段缺失、类型不对都不报错） */
export function normalizeAnalysis(a) {
  const s = (v, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const arr = (v) => (Array.isArray(v) ? v : []);
  return {
    personality: s(a?.personality),
    traits: arr(a?.traits).map((t) => s(t, 20)).filter(Boolean).slice(0, 6),
    speakingStyle: s(a?.speakingStyle),
    catchphrases: arr(a?.catchphrases).map((t) => s(t, 40)).filter(Boolean).slice(0, 8),
    addressesOtherAs: s(a?.addressesOtherAs, 40),
    loveStyle: s(a?.loveStyle),
    habits: s(a?.habits),
    likes: s(a?.likes),
    memories: arr(a?.memories)
      .map((m) => ({ text: s(m?.text, 300), evidence: s(m?.evidence, 120), date: s(m?.date, 10) }))
      .filter((m) => m.text)
      .slice(0, 12),
    gaps: s(a?.gaps, 400),
  };
}
