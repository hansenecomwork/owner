// 本地文件存储：所有资料都留在这台机器的 data/ 目录里，不上传到任何数据库。
// 结构：data/personas/<id>/{persona.json, memories.json, history.json, portrait.*, voice/*}
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = path.resolve(process.env.DATA_DIR || 'data');
const PERSONAS_DIR = path.join(DATA_DIR, 'personas');
const ID_RE = /^[a-f0-9]{12}$/;

// 每个文件一把简单的写锁，避免同时写坏 JSON（聊天抽取记忆和用户编辑可能并发）
const locks = new Map();
async function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  let release;
  const next = new Promise((r) => (release = r));
  locks.set(key, prev.then(() => next));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(key) === next) locks.delete(key);
  }
}

export function newId() {
  return crypto.randomBytes(6).toString('hex');
}

export function assertId(id) {
  if (!ID_RE.test(String(id))) {
    const err = new Error('无效的编号');
    err.status = 400;
    throw err;
  }
  return id;
}

export function personaDir(id) {
  return path.join(PERSONAS_DIR, assertId(id));
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw e;
  }
}

async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, file);
}

// ---------- 人物 ----------

export async function listPersonas() {
  await fs.mkdir(PERSONAS_DIR, { recursive: true });
  const ids = (await fs.readdir(PERSONAS_DIR)).filter((d) => ID_RE.test(d));
  const all = await Promise.all(ids.map((id) => getPersona(id)));
  return all.filter(Boolean).sort((a, b) => (b.lastTalkedAt || b.createdAt).localeCompare(a.lastTalkedAt || a.createdAt));
}

export async function getPersona(id) {
  return readJson(path.join(personaDir(id), 'persona.json'), null);
}

export async function savePersona(persona) {
  const file = path.join(personaDir(persona.id), 'persona.json');
  return withLock(file, () => writeJson(file, persona));
}

export async function updatePersona(id, patchFn) {
  const file = path.join(personaDir(id), 'persona.json');
  return withLock(file, async () => {
    const p = await readJson(file, null);
    if (!p) return null;
    const next = patchFn(p) || p;
    await writeJson(file, next);
    return next;
  });
}

export async function deletePersona(id) {
  await fs.rm(personaDir(id), { recursive: true, force: true });
}

// ---------- 记忆 ----------
// 记忆分三种来源（source），这是整个产品最重要的设计：
//   family   —— 家人亲手写下的回忆（最高可信度）
//   told     —— 聊天时家人说出的关于他/她的往事，AI 摘出来，必须经家人确认才算数
//   life     —— 家人告诉他/她的近况（孙子考试、搬家……），属于「现在」，自动记下
// AI 自己说过的话永远不会被当成记忆存进来，防止「越聊越不像本人」。

export async function getMemories(id) {
  return readJson(path.join(personaDir(id), 'memories.json'), []);
}

export async function mutateMemories(id, fn) {
  const file = path.join(personaDir(id), 'memories.json');
  return withLock(file, async () => {
    const list = await readJson(file, []);
    const result = await fn(list);
    await writeJson(file, list);
    return result;
  });
}

export function makeMemory({ text, source = 'family', status = 'confirmed', speaker = '' }) {
  return {
    id: newId(),
    text: String(text).trim().slice(0, 2000),
    source,
    status,
    speaker: String(speaker || '').slice(0, 40),
    createdAt: new Date().toISOString(),
  };
}

// ---------- 对话记录 ----------
// 只保存纯文本（不保存模型的 thinking 块）。这样资料或记忆更新后重新组装系统提示也不会出错。

const HISTORY_KEEP = 400;

export async function getHistory(id) {
  return readJson(path.join(personaDir(id), 'history.json'), []);
}

export async function appendHistory(id, entries) {
  const file = path.join(personaDir(id), 'history.json');
  return withLock(file, async () => {
    const list = await readJson(file, []);
    list.push(...entries);
    await writeJson(file, list.slice(-HISTORY_KEEP));
  });
}

export async function clearHistory(id) {
  const file = path.join(personaDir(id), 'history.json');
  return withLock(file, () => writeJson(file, []));
}

// ---------- 媒体文件 ----------

export async function saveFile(id, relPath, buffer) {
  const file = path.join(personaDir(id), relPath);
  if (!file.startsWith(personaDir(id) + path.sep)) throw new Error('bad path');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, buffer);
  return file;
}

export async function removeFile(id, relPath) {
  const file = path.join(personaDir(id), relPath);
  if (!file.startsWith(personaDir(id) + path.sep)) throw new Error('bad path');
  await fs.rm(file, { force: true });
}

export async function readFileBuffer(id, relPath) {
  const file = path.join(personaDir(id), relPath);
  if (!file.startsWith(personaDir(id) + path.sep)) throw new Error('bad path');
  return fs.readFile(file);
}
