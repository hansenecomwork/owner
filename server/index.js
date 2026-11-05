import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import * as store from './store.js';
import { aiStatus, streamReply, extractMemories, greetingInstruction, analyzeChat } from './ai.js';
import { describeSpeaker } from './prompt.js';
import { voiceStatus, cloneVoice, deleteVoice, synthesize, transcribe } from './voice.js';

const app = express();
const PORT = Number(process.env.PORT || 3000);

// ---------- 访问口令（部署到公网前务必设置 APP_PASSCODE） ----------
const PASSCODE = process.env.APP_PASSCODE;
if (PASSCODE) {
  app.use((req, res, next) => {
    const [scheme, encoded] = (req.headers.authorization || '').split(' ');
    const pass = scheme === 'Basic' && encoded ? Buffer.from(encoded, 'base64').toString().split(':').slice(1).join(':') : '';
    const a = Buffer.from(pass);
    const b = Buffer.from(PASSCODE);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return next();
    res.set('WWW-Authenticate', 'Basic realm="niannian", charset="UTF-8"').status(401).send('需要口令');
  });
}

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.resolve('public'), { extensions: ['html'] }));

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- 人物资料字段白名单 ----------
const TEXT_FIELDS = {
  name: 60, callName: 60, relationship: 60, gender: 10, birthYear: 10, passedYear: 10, hometown: 60, occupation: 60,
  personality: 3000, speakingStyle: 3000, chatStyle: 4000, catchphrases: 2000, dialect: 1000, likes: 3000, dislikes: 2000, habits: 3000,
  values: 3000, loveStyle: 3000, angerStyle: 2000, stories: 8000, timeline: 8000, wishes: 3000, neverSay: 2000,
  aboutPassing: 2000, chatSamples: 20000, extra: 5000,
};

function pickPersonaFields(body) {
  const out = {};
  for (const [k, max] of Object.entries(TEXT_FIELDS)) {
    if (body[k] !== undefined) out[k] = String(body[k] ?? '').slice(0, max);
  }
  if (out.gender !== undefined && !['male', 'female', ''].includes(out.gender)) out.gender = '';
  if (Array.isArray(body.traits)) out.traits = body.traits.map((t) => String(t).slice(0, 20)).filter(Boolean).slice(0, 30);
  if (Array.isArray(body.family)) {
    out.family = body.family
      .map((m) => ({
        name: String(m?.name || '').slice(0, 40).trim(),
        relation: String(m?.relation || '').slice(0, 40).trim(),
        calledAs: String(m?.calledAs || '').slice(0, 40).trim(),
        note: String(m?.note || '').slice(0, 300).trim(),
      }))
      .filter((m) => m.name)
      .slice(0, 30);
  }
  if (body.consent !== undefined) out.consent = Boolean(body.consent);
  return out;
}

async function summary(p) {
  const memories = await store.getMemories(p.id);
  return {
    ...p,
    memoryCount: memories.filter((m) => m.status === 'confirmed').length,
    pendingCount: memories.filter((m) => m.status === 'pending').length,
  };
}

async function mustPersona(id) {
  const p = await store.getPersona(id);
  if (!p) throw Object.assign(new Error('找不到这位家人'), { status: 404 });
  return p;
}

// ---------- 状态 ----------
app.get('/api/status', (req, res) => res.json({ ai: aiStatus, voice: voiceStatus }));

// ---------- 人物 ----------
app.get('/api/personas', wrap(async (req, res) => {
  res.json(await Promise.all((await store.listPersonas()).map(summary)));
}));

app.post('/api/personas', wrap(async (req, res) => {
  const fields = pickPersonaFields(req.body || {});
  if (!fields.name?.trim()) return res.status(400).json({ error: '请填写名字' });
  if (!fields.consent) return res.status(400).json({ error: '请先确认已获得家人的同意' });
  const persona = {
    id: store.newId(),
    traits: [],
    family: [],
    voiceSamples: [],
    portrait: null,
    voiceId: null,
    ...fields,
    createdAt: new Date().toISOString(),
  };
  await store.savePersona(persona);
  res.status(201).json(await summary(persona));
}));

app.get('/api/personas/:id', wrap(async (req, res) => res.json(await summary(await mustPersona(req.params.id)))));

app.put('/api/personas/:id', wrap(async (req, res) => {
  const fields = pickPersonaFields(req.body || {});
  const p = await store.updatePersona(req.params.id, (p) => ({ ...p, ...fields, updatedAt: new Date().toISOString() }));
  if (!p) return res.status(404).json({ error: '找不到这位家人' });
  res.json(await summary(p));
}));

app.delete('/api/personas/:id', wrap(async (req, res) => {
  const p = await mustPersona(req.params.id);
  await deleteVoice(p.voiceId);
  await store.deletePersona(p.id);
  res.json({ ok: true });
}));

// ---------- 照片 ----------
const IMAGE_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

app.put('/api/personas/:id/portrait', express.raw({ type: Object.keys(IMAGE_EXT), limit: '15mb' }), wrap(async (req, res) => {
  const p = await mustPersona(req.params.id);
  const ext = IMAGE_EXT[req.headers['content-type']];
  if (!ext || !Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: '请上传 JPG / PNG / WebP 照片' });
  if (p.portrait) await store.removeFile(p.id, p.portrait);
  const file = `portrait-${Date.now()}.${ext}`;
  await store.saveFile(p.id, file, req.body);
  res.json(await summary(await store.updatePersona(p.id, (x) => ({ ...x, portrait: file }))));
}));

app.get('/api/personas/:id/portrait', wrap(async (req, res) => {
  const p = await mustPersona(req.params.id);
  if (!p.portrait) return res.status(404).end();
  res.set('Cache-Control', 'private, max-age=31536000, immutable');
  res.sendFile(path.join(store.personaDir(p.id), p.portrait));
}));

// ---------- 声音样本 ----------
const AUDIO_EXT = {
  'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a',
  'audio/m4a': 'm4a', 'audio/aac': 'aac', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav', 'audio/flac': 'flac',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
};
const MAX_SAMPLES = 10;

app.post('/api/personas/:id/voice-samples', express.raw({ type: () => true, limit: '30mb' }), wrap(async (req, res) => {
  const p = await mustPersona(req.params.id);
  const mime = String(req.headers['content-type'] || '').split(';')[0].trim();
  const ext = AUDIO_EXT[mime];
  if (!ext || !Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: '请上传音频或视频文件（mp3 / m4a / wav / mp4 等）' });
  if ((p.voiceSamples || []).length >= MAX_SAMPLES) return res.status(400).json({ error: `最多上传 ${MAX_SAMPLES} 段声音` });
  const sid = store.newId();
  const file = `voice/${sid}.${ext}`;
  await store.saveFile(p.id, file, req.body);
  const sample = { id: sid, file, mime, name: String(req.query.name || '一段声音').slice(0, 60), size: req.body.length, createdAt: new Date().toISOString() };
  res.json(await summary(await store.updatePersona(p.id, (x) => ({ ...x, voiceSamples: [...(x.voiceSamples || []), sample] }))));
}));

app.get('/api/personas/:id/voice-samples/:sid', wrap(async (req, res) => {
  const p = await mustPersona(req.params.id);
  const s = (p.voiceSamples || []).find((v) => v.id === req.params.sid);
  if (!s) return res.status(404).end();
  res.type(s.mime).sendFile(path.join(store.personaDir(p.id), s.file));
}));

app.delete('/api/personas/:id/voice-samples/:sid', wrap(async (req, res) => {
  const p = await mustPersona(req.params.id);
  const s = (p.voiceSamples || []).find((v) => v.id === req.params.sid);
  if (s) await store.removeFile(p.id, s.file);
  res.json(await summary(await store.updatePersona(p.id, (x) => ({ ...x, voiceSamples: (x.voiceSamples || []).filter((v) => v.id !== req.params.sid) }))));
}));

app.post('/api/personas/:id/voice/clone', wrap(async (req, res) => {
  const p = await mustPersona(req.params.id);
  if (!p.consent) return res.status(400).json({ error: '需要先确认家人同意' });
  if (!p.voiceSamples?.length) return res.status(400).json({ error: '请先上传至少一段声音' });
  const files = await Promise.all(
    p.voiceSamples.map(async (s) => ({ buffer: await store.readFileBuffer(p.id, s.file), filename: path.basename(s.file), mime: s.mime })),
  );
  const voiceId = await cloneVoice(p.name, files);
  if (p.voiceId) await deleteVoice(p.voiceId);
  res.json(await summary(await store.updatePersona(p.id, (x) => ({ ...x, voiceId }))));
}));

app.delete('/api/personas/:id/voice/clone', wrap(async (req, res) => {
  const p = await mustPersona(req.params.id);
  await deleteVoice(p.voiceId);
  res.json(await summary(await store.updatePersona(p.id, (x) => ({ ...x, voiceId: null }))));
}));

app.post('/api/personas/:id/speak', wrap(async (req, res) => {
  const p = await mustPersona(req.params.id);
  const text = String(req.body?.text || '').slice(0, 1500);
  if (!p.voiceId || !voiceStatus.enabled) return res.status(404).json({ error: '还没有生成声音' });
  if (!text.trim()) return res.status(400).end();
  const body = await synthesize(p.voiceId, text);
  res.type('audio/mpeg');
  Readable.fromWeb(body).pipe(res);
}));

app.post('/api/transcribe', express.raw({ type: () => true, limit: '20mb' }), wrap(async (req, res) => {
  if (!voiceStatus.enabled) return res.status(404).json({ error: '未开启语音识别' });
  const mime = String(req.headers['content-type'] || 'audio/webm').split(';')[0].trim();
  if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: '没有收到声音' });
  res.json({ text: await transcribe(req.body, mime, req.query.lang === 'yue' ? 'yue' : undefined) });
}));

// ---------- 记忆 ----------
app.get('/api/personas/:id/memories', wrap(async (req, res) => {
  await mustPersona(req.params.id);
  res.json(await store.getMemories(req.params.id));
}));

app.post('/api/personas/:id/memories', wrap(async (req, res) => {
  await mustPersona(req.params.id);
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: '内容是空的' });
  const source = req.body?.source === 'chat' ? 'chat' : 'family';
  const m = store.makeMemory({ text, source, status: 'confirmed', speaker: req.body?.speaker });
  if (source === 'chat' && req.body?.evidence) m.evidence = String(req.body.evidence).slice(0, 200);
  await store.mutateMemories(req.params.id, (list) => list.push(m));
  res.status(201).json(m);
}));

app.patch('/api/personas/:id/memories/:mid', wrap(async (req, res) => {
  await mustPersona(req.params.id);
  const updated = await store.mutateMemories(req.params.id, (list) => {
    const m = list.find((x) => x.id === req.params.mid);
    if (!m) return null;
    if (typeof req.body?.text === 'string' && req.body.text.trim()) m.text = req.body.text.trim().slice(0, 2000);
    if (req.body?.status === 'confirmed') m.status = 'confirmed';
    m.updatedAt = new Date().toISOString();
    return m;
  });
  if (!updated) return res.status(404).json({ error: '找不到这条记忆' });
  res.json(updated);
}));

app.delete('/api/personas/:id/memories/:mid', wrap(async (req, res) => {
  await mustPersona(req.params.id);
  await store.mutateMemories(req.params.id, (list) => {
    const i = list.findIndex((x) => x.id === req.params.mid);
    if (i >= 0) list.splice(i, 1);
  });
  res.json({ ok: true });
}));

// ---------- 导入微信聊天记录 ----------
// 浏览器在本地解析聊天记录，只把挑出的 TA 的消息样本（已隐藏手机号等）和统计结果发过来。
app.post('/api/personas/:id/import/analyze', express.json({ limit: '1mb' }), wrap(async (req, res) => {
  const p = await mustPersona(req.params.id);
  const { who, other, stats, samples } = req.body || {};
  if (!who || !stats || !samples) return res.status(400).json({ error: '缺少聊天内容' });
  const revive = (x) => (x ? new Date(x) : null);
  const clean = {
    who: String(who).slice(0, 40),
    other: String(other || '').slice(0, 40),
    stats: { ...stats, from: revive(stats.from), to: revive(stats.to) },
    samples: {
      pairs: (samples.pairs || []).slice(0, 80).map((x) => ({ text: String(x.text).slice(0, 200), time: revive(x.time), prev: x.prev ? { sender: String(x.prev.sender).slice(0, 40), text: String(x.prev.text).slice(0, 200) } : null })).filter((x) => x.prev),
      solo: (samples.solo || []).slice(0, 160).map((x) => ({ text: String(x.text).slice(0, 200), time: revive(x.time) })),
    },
  };
  res.json(await analyzeChat(p, clean));
}));

// ---------- 对话 ----------
app.get('/api/personas/:id/history', wrap(async (req, res) => {
  await mustPersona(req.params.id);
  const h = await store.getHistory(req.params.id);
  res.json(h.filter((x) => !x.hidden).slice(-60).map(({ role, text, speaker, at }) => ({ role, text, speaker, at })));
}));

app.delete('/api/personas/:id/history', wrap(async (req, res) => {
  await mustPersona(req.params.id);
  await store.clearHistory(req.params.id);
  res.json({ ok: true });
}));

// 情绪危机关键词：命中时前端会显示求助热线（不依赖模型判断，保底）
const CARE_RE = /(不想活|活不下去|活着没意思|想死|去死|自杀|轻生|结束(我的)?生命|去找你|来找你|陪你走|跟你走|随你去|一起走吧|没有你我活)/;

function sse(res) {
  res.set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  return (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

async function runTurn(req, res, { userEntry, hiddenPrompt }) {
  const p = await mustPersona(req.params.id);
  const speaker = String(req.body?.speaker || '').slice(0, 40);
  const speakerNote = describeSpeaker(p, speaker);
  const send = sse(res);
  const abort = new AbortController();
  res.on('close', () => abort.abort());

  const [memories, history] = await Promise.all([store.getMemories(p.id), store.getHistory(p.id)]);
  const now = new Date().toISOString();
  const newEntries = [];
  if (userEntry) newEntries.push({ role: 'user', text: userEntry, speaker, speakerNote: speakerNote ? `【${speakerNote}】` : '', at: now });
  if (hiddenPrompt) newEntries.push({ role: 'user', text: hiddenPrompt, hidden: true, at: now });

  if (userEntry && CARE_RE.test(userEntry)) send({ type: 'care' });

  try {
    const reply = await streamReply({
      persona: p,
      memories,
      history: [...history, ...newEntries],
      onText: (t) => send({ type: 'text', text: t }),
      signal: abort.signal,
    });
    newEntries.push({ role: 'assistant', text: reply, at: new Date().toISOString() });
    await store.appendHistory(p.id, newEntries);
    await store.updatePersona(p.id, (x) => ({ ...x, lastTalkedAt: new Date().toISOString() }));
    send({ type: 'done', text: reply });

    // 对话结束后，悄悄把家人说的新事情沉淀成记忆
    if (userEntry && !abort.signal.aborted) {
      const found = await extractMemories({ persona: p, existing: memories, userText: userEntry, speakerNote, aiText: reply });
      if (found.length) {
        const items = found.map((f) =>
          store.makeMemory({ text: f.text, source: f.kind === 'life' ? 'life' : 'told', status: f.kind === 'life' ? 'confirmed' : 'pending', speaker }),
        );
        await store.mutateMemories(p.id, (list) => list.push(...items));
        send({ type: 'memories', items });
      }
    }
  } catch (e) {
    if (!abort.signal.aborted) {
      console.error('[chat]', e);
      const msg = e?.status === 401 ? 'API Key 不正确，请检查 ANTHROPIC_API_KEY' : e?.status === 429 ? '说话的人太多了，请稍等一下再试' : '网络好像不太好，请再说一次';
      send({ type: 'error', message: msg });
    }
  } finally {
    res.end();
  }
}

app.post('/api/personas/:id/chat', wrap(async (req, res) => {
  const text = String(req.body?.text || '').trim().slice(0, 4000);
  if (!text) return res.status(400).json({ error: '内容是空的' });
  await runTurn(req, res, { userEntry: text });
}));

app.post('/api/personas/:id/greet', wrap(async (req, res) => {
  const p = await mustPersona(req.params.id);
  await runTurn(req, res, { hiddenPrompt: greetingInstruction(p, String(req.body?.speaker || '')) });
}));

// ---------- 错误处理 ----------
app.use('/api', (req, res) => res.status(404).json({ error: '没有这个接口' }));
app.use((err, req, res, next) => {
  if (res.headersSent) return res.end();
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 && !err.expose ? (err.message || '出错了') : err.message });
});

app.listen(PORT, () => {
  console.log(`\n  念念 已启动：http://localhost:${PORT}`);
  console.log(`  对话：${aiStatus.live ? `Claude（${aiStatus.model}）` : '演示模式（未配置 ANTHROPIC_API_KEY）'}`);
  console.log(`  声音克隆：${voiceStatus.enabled ? 'ElevenLabs 已开启' : '未开启，使用设备自带朗读'}`);
  if (!PASSCODE) console.log('  提醒：未设置 APP_PASSCODE，请只在自己的电脑或家庭网络里使用。\n');
});
