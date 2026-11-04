// 声音克隆（可选）：使用 ElevenLabs 的「即时声音克隆」。
// 没有配置 ELEVENLABS_API_KEY 时，前端会退回到设备自带的中文朗读。
const KEY = process.env.ELEVENLABS_API_KEY;
const TTS_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const BASE = 'https://api.elevenlabs.io/v1';

export const voiceStatus = { enabled: Boolean(KEY) };

async function check(res) {
  if (res.ok) return res;
  let detail = '';
  try {
    detail = JSON.stringify(await res.json());
  } catch {}
  const err = new Error(`声音服务出错（${res.status}）${detail}`);
  err.status = 502;
  throw err;
}

/** files: [{ buffer, filename, mime }] → voice_id */
export async function cloneVoice(name, files) {
  if (!KEY) throw Object.assign(new Error('没有配置 ELEVENLABS_API_KEY'), { status: 400 });
  const form = new FormData();
  form.append('name', `念念-${name}`.slice(0, 90));
  form.append('description', '念念 App：家人上传的声音样本');
  form.append('remove_background_noise', 'true');
  for (const f of files) form.append('files', new Blob([f.buffer], { type: f.mime }), f.filename);
  const res = await check(await fetch(`${BASE}/voices/add`, { method: 'POST', headers: { 'xi-api-key': KEY }, body: form }));
  const data = await res.json();
  return data.voice_id;
}

export async function deleteVoice(voiceId) {
  if (!KEY || !voiceId) return;
  await fetch(`${BASE}/voices/${encodeURIComponent(voiceId)}`, { method: 'DELETE', headers: { 'xi-api-key': KEY } }).catch(() => {});
}

/** 返回 mp3 的 ReadableStream */
export async function synthesize(voiceId, text) {
  const res = await check(
    await fetch(`${BASE}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: TTS_MODEL,
        voice_settings: { stability: 0.55, similarity_boost: 0.85, style: 0.15, use_speaker_boost: true },
      }),
    }),
  );
  return res.body;
}

/** 语音转文字（ElevenLabs Scribe）。浏览器自带识别不可用（例如在中国大陆用 Chrome）时由前端调用。 */
export async function transcribe(buffer, mime, languageCode) {
  if (!KEY) throw Object.assign(new Error('没有配置 ELEVENLABS_API_KEY'), { status: 400 });
  const form = new FormData();
  form.append('model_id', process.env.ELEVENLABS_STT_MODEL || 'scribe_v1');
  if (languageCode) form.append('language_code', languageCode);
  form.append('file', new Blob([buffer], { type: mime }), 'speech');
  const res = await check(await fetch(`${BASE}/speech-to-text`, { method: 'POST', headers: { 'xi-api-key': KEY }, body: form }));
  const data = await res.json();
  return String(data.text || '').trim();
}
