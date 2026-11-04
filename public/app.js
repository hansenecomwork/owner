// 念念 · 前端（无需构建，直接运行）
// 设计原则：一屏只做一件事；按钮大、字大；所有按钮都有文字；任何时候都能返回。

const $app = document.getElementById('app');
const $toasts = document.getElementById('toasts');

// ---------- 图标（线性，24px） ----------
const ICON = {
  back: '<path d="m15 18-6-6 6-6"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  keyboard: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/>',
  sound: '<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5Z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.4 18.4a9 9 0 0 0 0-12.7"/>',
  mute: '<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5Z"/><path d="m22 9-6 6M16 9l6 6"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M12 13.5s-3-1.7-3-3.6A1.6 1.6 0 0 1 12 9a1.6 1.6 0 0 1 3 .9c0 1.9-3 3.6-3 3.6Z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  play: '<path d="m7 4 13 8-13 8Z"/>',
  spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

// ---------- 小工具 ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ta = (p) => (p?.gender === 'male' ? '他' : p?.gender === 'female' ? '她' : 'TA');
const store = {
  get: (k, d = null) => { try { const v = localStorage.getItem(`nn.${k}`); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(`nn.${k}`, JSON.stringify(v)); } catch {} },
};

async function api(path, { method = 'GET', json, body, headers = {} } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: json !== undefined ? { 'Content-Type': 'application/json', ...headers } : headers,
    body: json !== undefined ? JSON.stringify(json) : body,
  });
  if (!res.ok) {
    let msg = `出错了（${res.status}）`;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return res.headers.get('content-type')?.includes('json') ? res.json() : res;
}

function toast(html, kind = '', ms = 4200) {
  const el = document.createElement('div');
  el.className = `toast glass ${kind}`;
  el.innerHTML = html;
  $toasts.append(el);
  setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, ms);
}
const fail = (e) => toast(`<b>没成功：</b>${esc(e.message || e)}`, 'err', 5000);

function sheet(html, { onMount, dismissable = true } = {}) {
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = `<div class="sheet glass glass-strong" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => scrim.remove();
  if (dismissable) scrim.addEventListener('click', (e) => { if (e.target === scrim) close(); });
  document.body.append(scrim);
  onMount?.(scrim.firstElementChild, close);
  return close;
}

function avatarHtml(p, size) {
  const style = size ? ` style="--size:${size}px"` : '';
  if (p?.portrait) return `<div class="avatar"${style}><img src="/api/personas/${p.id}/portrait?v=${encodeURIComponent(p.portrait)}" alt="${esc(p.name)}的照片"></div>`;
  return `<div class="avatar"${style}>${esc((p?.name || '念').slice(-1))}</div>`;
}

function ago(iso) {
  if (!iso) return '';
  const d = (Date.now() - new Date(iso)) / 1000;
  if (d < 3600) return '刚刚聊过';
  if (d < 86400) return `${Math.floor(d / 3600)} 小时前聊过`;
  if (d < 86400 * 30) return `${Math.floor(d / 86400)} 天前聊过`;
  return `${new Date(iso).toLocaleDateString('zh-CN')} 聊过`;
}

// 照片在手机上常常很大：先在本地缩小再上传
async function shrinkImage(file, max = 1280) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.88));
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------- 全局状态 ----------
let STATUS = { ai: { live: false }, voice: { enabled: false } };
let cleanup = null; // 离开页面时要做的清理（停止播放、停止录音）

// =====================================================================
// 声音输出：分句排队播放。克隆声音走服务器，否则用设备自带的中文朗读。
// =====================================================================
const voiceOut = {
  muted: store.get('muted', false),
  persona: null,
  queue: [],
  playing: false,
  gen: 0,
  onState: () => {},
  levelEl: null,
  audio: null,
  ctx: null,
  analyser: null,

  useClone() { return Boolean(STATUS.voice.enabled && this.persona?.voiceId); },

  unlock() { // 必须在用户点击时调用一次，iOS 才允许播放声音
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = 'auto';
    }
    if (!this.ctx && window.AudioContext) {
      try {
        this.ctx = new AudioContext();
        const src = this.ctx.createMediaElementSource(this.audio);
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 512;
        src.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
      } catch { this.ctx = null; }
    }
    this.ctx?.resume?.();
    if (window.speechSynthesis && !this.useClone()) speechSynthesis.getVoices();
  },

  enqueue(text) {
    text = text.replace(/[（(][^）)]*演示模式[^）)]*[）)]/g, '').trim();
    if (this.muted || !text) return;
    const item = { text };
    if (this.useClone()) {
      item.blob = fetch(`/api/personas/${this.persona.id}/speak`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
      }).then((r) => (r.ok ? r.blob() : null)).catch(() => null);
    }
    this.queue.push(item);
    if (!this.playing) this.next();
  },

  async next() {
    const gen = this.gen;
    const item = this.queue.shift();
    if (!item) { this.playing = false; this.onState('done'); return; }
    this.playing = true;
    this.onState('speaking', this.useClone() ? 'clone' : 'synth');
    if (this.useClone()) {
      const blob = await item.blob;
      if (gen !== this.gen) return;
      if (blob) await this.playBlob(blob, gen);
      else await this.synth(item.text, gen); // 克隆声音失败时，退回设备朗读，不让对话断掉
    } else {
      await this.synth(item.text, gen);
    }
    if (gen === this.gen) this.next();
  },

  playBlob(blob, gen) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const a = this.audio;
      const done = () => { URL.revokeObjectURL(url); a.onended = a.onerror = null; resolve(); };
      a.onended = done;
      a.onerror = done;
      a.src = url;
      a.play().catch(done);
      const tick = () => {
        if (gen !== this.gen || a.paused) { this.levelEl?.style.setProperty('--level', 0); return; }
        if (this.analyser && this.levelEl) {
          const d = new Uint8Array(this.analyser.fftSize);
          this.analyser.getByteTimeDomainData(d);
          let sum = 0;
          for (const v of d) sum += ((v - 128) / 128) ** 2;
          this.levelEl.style.setProperty('--level', Math.min(1, Math.sqrt(sum / d.length) * 4).toFixed(3));
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  },

  synth(text, gen) {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      const dialect = this.persona?.dialect || '';
      u.lang = /粤|广东|香港|廣東/.test(dialect) ? 'zh-HK' : /台湾|台灣|闽南|閩南/.test(dialect) ? 'zh-TW' : 'zh-CN';
      const voices = speechSynthesis.getVoices().filter((v) => v.lang.replace('_', '-').startsWith(u.lang.slice(0, 5)));
      if (voices.length) u.voice = voices.find((v) => v.localService) || voices[0];
      u.rate = 0.95;
      u.pitch = this.persona?.gender === 'male' ? 0.85 : this.persona?.gender === 'female' ? 1.05 : 1;
      const timer = setTimeout(resolve, 2000 + text.length * 400); // 某些浏览器不触发 onend，兜底
      u.onend = u.onerror = () => { clearTimeout(timer); resolve(); };
      if (gen !== this.gen) return resolve();
      speechSynthesis.speak(u);
    });
  },

  stop() {
    this.gen++;
    this.queue = [];
    this.playing = false;
    try { this.audio?.pause(); } catch {}
    try { window.speechSynthesis?.cancel(); } catch {}
    this.levelEl?.style.setProperty('--level', 0);
  },
};

// 把流式文字切成句子，边生成边朗读
function sentenceSplitter(onSentence) {
  let buf = '';
  return {
    push(t) {
      buf += t;
      let m;
      while ((m = buf.match(/^[\s\S]*?[。！？!?…~～\n]+["”’」』]?/)) || (buf.length > 60 && (m = buf.match(/^[\s\S]{20,}?[，,；;]/)))) {
        const s = m[0].trim();
        buf = buf.slice(m[0].length);
        if (s) onSentence(s);
      }
    },
    flush() { const s = buf.trim(); buf = ''; if (s) onSentence(s); },
  };
}

// =====================================================================
// 声音输入：优先用服务器识别（各地都能用），否则用浏览器自带识别。
// =====================================================================
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const canServerSTT = () => STATUS.voice.enabled && window.MediaRecorder && navigator.mediaDevices?.getUserMedia;
const canListen = () => Boolean(canServerSTT() || SR);

function speechLang(p) {
  return /粤|广东|香港|廣東/.test(p?.dialect || '') ? 'zh-HK' : /台湾|台灣/.test(p?.dialect || '') ? 'zh-TW' : 'zh-CN';
}

function createListener({ lang = 'zh-CN', onInterim = () => {}, onFinal = () => {}, onEnd = () => {} }) {
  let stopFn = null;
  let aborted = false;

  async function startServer() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported?.(m)) || '';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    // 简单的静音检测：说完话停顿 1.6 秒自动结束，老人不用再按一次
    const ctx = new AudioContext();
    const an = ctx.createAnalyser();
    ctx.createMediaStreamSource(stream).connect(an);
    const data = new Uint8Array(an.fftSize);
    let heard = false, lastLoud = performance.now(), startAt = performance.now(), raf;
    const watch = () => {
      an.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) sum += ((v - 128) / 128) ** 2;
      const rms = Math.sqrt(sum / data.length);
      const now = performance.now();
      if (rms > 0.03) { heard = true; lastLoud = now; }
      if ((heard && now - lastLoud > 1600) || now - startAt > 60000 || (!heard && now - startAt > 8000)) return stopFn();
      raf = requestAnimationFrame(watch);
    };
    raf = requestAnimationFrame(watch);
    rec.onstop = async () => {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
      ctx.close();
      if (aborted || !heard) return onEnd('');
      onInterim('（正在听写…）');
      try {
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        const r = await api(`/transcribe${/HK/.test(lang) ? '?lang=yue' : ''}`, { method: 'POST', body: blob, headers: { 'Content-Type': blob.type.split(';')[0] } });
        if (r.text) onFinal(r.text);
        onEnd(r.text || '');
      } catch (e) {
        fail(e);
        onEnd('');
      }
    };
    stopFn = () => { if (rec.state !== 'inactive') rec.stop(); };
    rec.start(250);
  }

  function startBrowser() {
    const r = new SR();
    r.lang = lang;
    r.interimResults = true;
    r.continuous = false;
    let finalText = '';
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      onInterim(finalText + interim);
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed') toast('<b>需要麦克风权限：</b>请在浏览器设置里允许使用麦克风。', 'err');
      else if (e.error === 'network') toast('<b>语音识别连不上网络。</b>可以点键盘图标打字，或用输入法自带的语音输入。', 'err', 6000);
    };
    r.onend = () => {
      if (aborted) return onEnd('');
      if (finalText.trim()) onFinal(finalText.trim());
      onEnd(finalText.trim());
    };
    stopFn = () => r.stop();
    r.start();
  }

  return {
    async start() {
      if (canServerSTT()) await startServer();
      else if (SR) startBrowser();
      else throw new Error('这个浏览器不支持语音输入，请打字，或用输入法自带的语音输入');
    },
    stop() { stopFn?.(); },
    abort() { aborted = true; stopFn?.(); },
  };
}

// 文本框旁的「说」按钮：用嘴代替打字
function attachDictation(root, persona) {
  root.querySelectorAll('[data-dictate]').forEach((btn) => {
    if (!canListen()) { btn.remove(); return; }
    let listener = null;
    btn.addEventListener('click', async () => {
      const field = root.querySelector(`#${btn.dataset.dictate}`);
      if (listener) { listener.stop(); return; }
      const base = field.value ? `${field.value.replace(/\s+$/, '')}\n` : '';
      btn.classList.add('on');
      listener = createListener({
        lang: speechLang(persona),
        onInterim: (t) => { field.value = base + t; },
        onFinal: (t) => { field.value = base + t; field.dispatchEvent(new Event('input')); },
        onEnd: () => { btn.classList.remove('on'); listener = null; },
      });
      try { await listener.start(); } catch (e) { fail(e); btn.classList.remove('on'); listener = null; }
    });
  });
}

// =====================================================================
// 首页
// =====================================================================
async function viewHome() {
  const people = await api('/personas');
  $app.innerHTML = `
    <div class="page">
      <header class="hero">
        <h1>念念</h1>
        <p>让思念，有个地方说话</p>
      </header>
      <section class="people" aria-label="家人">
        ${people.map((p) => `
          <a class="person glass" href="#/p/${p.id}">
            ${avatarHtml(p)}
            <div>
              <div class="name">${esc(p.callName || p.name)}</div>
              <div class="meta">${p.lastTalkedAt ? ago(p.lastTalkedAt) : '还没有聊过'}${p.pendingCount ? ` · ${p.pendingCount} 条回忆待确认` : ''}</div>
            </div>
            <span class="btn icon-btn edit" role="button" tabindex="0" data-edit="${p.id}" aria-label="修改${esc(p.name)}的资料">${icon('edit')}</span>
          </a>`).join('')}
        <a class="person glass add" href="#/new">
          <span class="plus">${icon('plus')}</span>
          <span class="name" style="font-size:1.1rem">添加一位家人</span>
        </a>
      </section>
      ${!STATUS.ai.live ? `<div class="notice glass"><b>现在是演示模式。</b>还没有配置对话服务的密钥（ANTHROPIC_API_KEY），所以回复只是示例句子。请家里懂电脑的人按照说明设置一下。</div>` : ''}
      <p class="footer-note">所有资料只保存在你们自己的服务器上。<br>这里的每一位，都是用家人的回忆生成的回声，不是本人。</p>
    </div>`;
  $app.querySelectorAll('[data-edit]').forEach((b) => {
    const go = (e) => { e.preventDefault(); e.stopPropagation(); location.hash = `#/p/${b.dataset.edit}/edit`; };
    b.addEventListener('click', go);
    b.addEventListener('keydown', (e) => e.key === 'Enter' && go(e));
  });
}

// =====================================================================
// 建档向导（新建和修改共用）
// =====================================================================
const TRAITS = ['温柔', '乐观', '幽默', '爱唠叨', '急性子', '慢性子', '严厉', '心软', '要强', '节俭', '大方', '爱操心', '话少', '爱笑', '倔强', '细心', '浪漫', '爱面子', '豁达', '护短'];

const STEPS = [
  {
    title: (p) => `${ta(p)}是谁？`,
    desc: () => '先从名字开始。只有名字是必填的，其余想到了再补。',
    body: (p, mode) => `
      ${field('name', '名字', { ph: '例如：林秀兰', required: true })}
      ${field('callName', '家里人怎么叫', { ph: '例如：妈、奶奶、老伴、秀兰', hint: '对话时会用这个称呼' })}
      <div class="field"><span class="label">性别</span>
        <div class="chips" data-single="gender">
          <button type="button" class="chip" data-v="female" aria-pressed="${p.gender === 'female'}">她（女）</button>
          <button type="button" class="chip" data-v="male" aria-pressed="${p.gender === 'male'}">他（男）</button>
        </div>
      </div>
      <div class="row">${field('birthYear', '出生年份', { ph: '1952', type: 'number' })}${field('passedYear', '离开的年份', { ph: '2025', type: 'number' })}</div>
      <div class="row">${field('hometown', '家乡', { ph: '例如：福建泉州' })}${field('occupation', '职业 / 一辈子做的事', { ph: '例如：小学老师' })}</div>
      ${mode === 'new' ? `
      <label class="check"><input type="checkbox" id="consent">
        <span>我们是${ta(p)}的家人，家里人都同意做这件事。我们明白：这里的${ta(p)}是用回忆生成的，不是本人。</span>
      </label>` : ''}`,
  },
  {
    title: (p) => `一张${ta(p)}的照片`,
    desc: (p) => `选一张${ta(p)}笑着、看着镜头的照片。对话时会一直陪着你。`,
    body: (p) => `
      <label class="photo-drop" for="photo-input">
        ${p.portrait ? `<img src="/api/personas/${p.id}/portrait?v=${encodeURIComponent(p.portrait)}" alt="">` : `<span>${icon('image')}<br>点这里选照片</span>`}
      </label>
      <input type="file" id="photo-input" accept="image/*" class="sr-only">
      <p class="tip" style="text-align:center">照片只保存在你们自己的服务器上。</p>`,
  },
  {
    title: (p) => `${ta(p)}的声音`,
    desc: (p) => `上传${ta(p)}以前的语音、视频或电话录音。最好一共有 1～3 分钟清楚的说话声，背景越安静越像。`,
    body: (p) => `
      ${p.voiceId && STATUS.voice.enabled ? `<div class="voice-state">${icon('check')} 已经生成${ta(p)}的声音
        <button type="button" class="btn small" id="voice-try" style="margin-left:auto">${icon('play')}试听</button></div>` : ''}
      <div class="samples">${(p.voiceSamples || []).map((s) => `
        <div class="sample">
          <button type="button" class="btn icon-btn" data-play="${s.id}" aria-label="播放">${icon('play')}</button>
          <span class="n">${esc(s.name)}</span>
          <button type="button" class="btn icon-btn" data-del-sample="${s.id}" aria-label="删除这段声音">${icon('trash')}</button>
        </div>`).join('') || `<p class="tip" style="margin:0 0 6px">还没有声音。</p>`}
      </div>
      <div class="btn-row">
        <label class="btn" for="voice-input">${icon('upload')}上传录音或视频</label>
        ${window.MediaRecorder ? `<button type="button" class="btn" id="voice-rec">${icon('mic')}<span>现在录一段</span></button>` : ''}
      </div>
      <input type="file" id="voice-input" accept="audio/*,video/*" multiple class="sr-only">
      ${STATUS.voice.enabled
        ? `<button type="button" class="btn primary block" id="voice-clone" style="margin-top:16px" ${(p.voiceSamples || []).length ? '' : 'disabled'}>${icon('spark')}${p.voiceId ? '用这些声音重新生成' : `生成${ta(p)}的声音`}</button>`
        : `<p class="tip">没有开启「声音克隆」，对话时会用手机自带的声音朗读。声音样本会先保存下来，以后开启了就能用。</p>`}
      <p class="tip">「现在录一段」可以用来录下手机里播放的老语音。</p>`,
  },
  {
    title: (p) => `${ta(p)}是个什么样的人`,
    desc: () => '点选合适的词，再用自己的话说说。可以点麦克风直接说。',
    body: (p) => `
      <div class="field"><span class="label">性格（可多选）</span>
        <div class="chips" data-multi="traits">${TRAITS.map((t) => `<button type="button" class="chip" aria-pressed="${(p.traits || []).includes(t)}" data-v="${t}">${t}</button>`).join('')}</div>
      </div>
      ${area('personality', '用一段话形容', { ph: '例如：刀子嘴豆腐心，嘴上嫌我们乱花钱，转头就偷偷塞红包。' })}
      ${area('catchphrases', '口头禅', { ph: '例如：「吃了没？」「天冷了多穿点」「哎呀你这个孩子」', hint: '最能让人一听就认出是谁' })}
      ${area('speakingStyle', '说话的样子', { ph: '例如：说话慢，爱用反问句，结尾常带个「啊」，发微信喜欢发语音不打字。' })}
      ${field('dialect', '方言 / 语言', { ph: '例如：闽南话夹普通话、粤语' })}`,
  },
  {
    title: () => '家里都有谁',
    desc: (p) => `写下常来说话的家人，和${ta(p)}平时怎么叫他们。这样${ta(p)}就能认出是谁来了。`,
    body: (p) => `
      <div id="family-rows">${(p.family?.length ? p.family : [{}]).map(familyRow).join('')}</div>
      <button type="button" class="btn small" id="add-family">${icon('plus')}再加一位</button>`,
  },
  {
    title: () => '喜好与习惯',
    desc: (p) => `那些只有家人才知道的小事，最能让${ta(p)}像${ta(p)}。`,
    body: () => `
      ${area('likes', '喜欢什么', { ph: '爱吃的菜、爱听的歌、爱看的戏、爱去的地方……' })}
      ${area('dislikes', '不喜欢什么', { ph: '例如：最讨厌浪费粮食，怕坐飞机' })}
      ${area('habits', '生活习惯', { ph: '例如：每天早上五点去公园打太极，睡前一定要泡脚' })}
      ${area('loveStyle', `怎么表达爱、怎么安慰人`, { ph: '例如：不会说「我爱你」，但会一直给你夹菜；你哭的时候会拍拍你的背说「没事，有我在」' })}
      ${area('angerStyle', '生气或担心时的样子', { ph: '例如：生气就不说话，去厨房剁菜' })}
      ${area('values', '在意的事、人生信条', { ph: '例如：做人要老实；一家人最要紧是整整齐齐' })}`,
  },
  {
    title: (p) => `${ta(p)}的故事`,
    desc: (p) => `${ta(p)}常讲的故事、一生的经历，还有以前发过的消息。越多越像。`,
    body: (p) => `
      ${area('stories', `${ta(p)}常讲的故事`, { ph: '例如：年轻时下乡插队，冬天走十里路去挑水……', rows: 6 })}
      ${area('timeline', '人生经历', { ph: '例如：1952 年出生；1975 年结婚；1980 年生了大女儿……', rows: 5 })}
      ${area('wishes', '没完成的心愿', { ph: '例如：想看到孙子结婚；想再回一次老家' })}
      ${area('chatSamples', `${ta(p)}以前发过的消息（复制粘贴）`, { ph: '从微信里复制一些' + ta(p) + '发过的文字消息粘贴到这里，用来学' + ta(p) + '说话的语气。', rows: 6, hint: '这是最有用的资料之一', noDictate: true })}`,
  },
  {
    title: () => '最后几件小事',
    desc: () => '这些是「边界」，帮助回声守住本人的样子。',
    body: (p, mode) => `
      ${area('neverSay', `${ta(p)}绝对不会说的话、不会做的事`, { ph: '例如：从不骂人，从不说丧气话' })}
      ${area('aboutPassing', `如果有人问起${ta(p)}的离开，希望${ta(p)}怎么回答`, { ph: '例如：别难过，我这辈子很满足，你们好好过日子就是对我最好的纪念。' })}
      ${area('extra', '还有什么想补充的', {})}
      ${mode === 'edit' ? `<button type="button" class="btn danger block" id="delete-persona" style="margin-top:12px">${icon('trash')}删除${ta(p)}的全部资料</button>` : ''}`,
  },
];

let WIZ = null; // 当前向导的草稿

function field(key, label, { ph = '', hint = '', type = 'text', required = false } = {}) {
  const v = WIZ?.draft?.[key] ?? '';
  return `<label class="field"><span class="label"><span>${label}${required ? ' <span style="color:var(--warm)">*</span>' : ''}${hint ? `<span class="hint">${hint}</span>` : ''}</span></span>
    <input class="input" id="f-${key}" data-key="${key}" type="${type}" ${type === 'number' ? 'inputmode="numeric"' : ''} placeholder="${esc(ph)}" value="${esc(v)}"></label>`;
}

function area(key, label, { ph = '', hint = '', rows = 4, noDictate = false } = {}) {
  const v = WIZ?.draft?.[key] ?? '';
  return `<div class="field"><label class="label" for="f-${key}"><span>${label}${hint ? `<span class="hint">${hint}</span>` : ''}</span></label>
    <div class="textarea-wrap"><textarea class="textarea" id="f-${key}" data-key="${key}" rows="${rows}" placeholder="${esc(ph)}">${esc(v)}</textarea>
    ${noDictate ? '' : `<button type="button" class="btn icon-btn dictate" data-dictate="f-${key}" aria-label="用说的">${icon('mic')}</button>`}</div></div>`;
}

function familyRow(m = {}) {
  return `<div class="family-row">
    <input class="input" data-fam="name" placeholder="名字，如：小美" value="${esc(m.name || '')}" aria-label="名字">
    <input class="input" data-fam="relation" placeholder="关系，如：女儿" value="${esc(m.relation || '')}" aria-label="关系">
    <input class="input" data-fam="calledAs" placeholder="${'叫TA什么，如：美美'}" value="${esc(m.calledAs || '')}" aria-label="平时怎么叫">
    <button type="button" class="btn icon-btn del" aria-label="删除这一行">${icon('close')}</button>
  </div>`;
}

function collectStep(root) {
  const d = WIZ.draft;
  root.querySelectorAll('[data-key]').forEach((el) => { d[el.dataset.key] = el.value.trim(); });
  root.querySelectorAll('[data-single]').forEach((g) => {
    const on = g.querySelector('[aria-pressed="true"]');
    d[g.dataset.single] = on ? on.dataset.v : '';
  });
  root.querySelectorAll('[data-multi]').forEach((g) => {
    d[g.dataset.multi] = [...g.querySelectorAll('[aria-pressed="true"]')].map((b) => b.dataset.v);
  });
  const rows = root.querySelectorAll('.family-row');
  if (rows.length) {
    d.family = [...rows].map((r) => Object.fromEntries([...r.querySelectorAll('[data-fam]')].map((i) => [i.dataset.fam, i.value.trim()]))).filter((m) => m.name);
  }
}

async function persist() {
  const { draft } = WIZ;
  const payload = { ...draft };
  for (const k of ['id', 'portrait', 'voiceSamples', 'voiceId', 'createdAt', 'memoryCount', 'pendingCount']) delete payload[k];
  if (!draft.id) {
    const created = await api('/personas', { method: 'POST', json: payload });
    WIZ.draft = { ...draft, ...created };
  } else {
    WIZ.draft = { ...draft, ...(await api(`/personas/${draft.id}`, { method: 'PUT', json: payload })) };
  }
}

async function viewWizard(id) {
  const mode = id ? 'edit' : 'new';
  const draft = id ? await api(`/personas/${id}`) : { traits: [], family: [], voiceSamples: [] };
  WIZ = { mode, step: 0, draft };
  renderWizard();
}

function renderWizard() {
  const { mode, step, draft: p } = WIZ;
  const S = STEPS[step];
  const last = step === STEPS.length - 1;
  $app.innerHTML = `
    <div class="page">
      <nav class="topbar glass">
        <a class="btn icon-btn" href="${mode === 'edit' ? `#/p/${p.id}` : '#/'}" aria-label="返回">${icon('back')}</a>
        <div class="title">${mode === 'new' ? '添加一位家人' : `${esc(p.name)}的资料`}<span class="sub">第 ${step + 1} 步，共 ${STEPS.length} 步</span></div>
        ${mode === 'edit' ? `<button class="btn pill-btn" id="save-exit">保存</button>` : '<span style="width:52px"></span>'}
      </nav>
      <div class="steps" role="tablist">${STEPS.map((_, i) => `<button type="button" role="tab" aria-label="第 ${i + 1} 步" class="${i === step ? 'on' : i < step ? 'done' : ''}" data-go="${i}" ${mode === 'new' && !p.id ? 'disabled' : ''}></button>`).join('')}</div>
      <section class="card glass" id="step">
        <h2 class="step-title">${S.title(p)}</h2>
        <p class="step-desc">${S.desc(p)}</p>
        ${S.body(p, mode)}
      </section>
      <div class="wizard-nav">
        ${step > 0 ? `<button class="btn" id="prev">${icon('back')}上一步</button>` : ''}
        <button class="btn primary" id="next">${last ? (mode === 'new' ? `完成，去见${ta(p)}` : '保存') : '下一步'}</button>
      </div>
      ${step > 0 && !last ? `<button class="skip" id="skip">先跳过这一步</button>` : ''}
    </div>`;
  bindWizard();
  window.scrollTo({ top: 0 });
}

function bindWizard() {
  const root = $app.querySelector('#step');
  const p = WIZ.draft;
  attachDictation(root, p);

  root.querySelectorAll('[data-single] .chip').forEach((b) => b.addEventListener('click', () => {
    b.parentElement.querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-pressed', String(x === b && x.getAttribute('aria-pressed') !== 'true')));
  }));
  root.querySelectorAll('[data-multi] .chip').forEach((b) => b.addEventListener('click', () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'))));

  // 家人
  root.querySelector('#add-family')?.addEventListener('click', () => {
    root.querySelector('#family-rows').insertAdjacentHTML('beforeend', familyRow());
    bindFamilyDel();
    root.querySelector('.family-row:last-child input')?.focus();
  });
  const bindFamilyDel = () => root.querySelectorAll('.family-row .del').forEach((b) => { b.onclick = () => b.parentElement.remove(); });
  bindFamilyDel();

  // 照片
  root.querySelector('#photo-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const blob = await shrinkImage(file);
      WIZ.draft = { ...WIZ.draft, ...(await api(`/personas/${p.id}/portrait`, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } })) };
      collectStep(root);
      renderWizard();
    } catch (err) { fail(err); }
  });

  // 声音
  root.querySelector('#voice-input')?.addEventListener('change', async (e) => {
    for (const f of e.target.files) {
      try {
        toast(`正在上传「${esc(f.name)}」…`, '', 2000);
        WIZ.draft = await api(`/personas/${p.id}/voice-samples?name=${encodeURIComponent(f.name)}`, { method: 'POST', body: f, headers: { 'Content-Type': f.type || 'audio/mpeg' } });
      } catch (err) { fail(err); }
    }
    collectStep(root);
    renderWizard();
  });
  let rec = null;
  root.querySelector('#voice-rec')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (rec) { rec.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported?.(m)) || '';
      rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
      const chunks = [];
      rec.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: (rec.mimeType || 'audio/webm').split(';')[0] });
        rec = null;
        try {
          WIZ.draft = await api(`/personas/${p.id}/voice-samples?name=${encodeURIComponent(`录音 ${new Date().toLocaleString('zh-CN')}`)}`, { method: 'POST', body: blob, headers: { 'Content-Type': blob.type } });
        } catch (err) { fail(err); }
        collectStep(root);
        renderWizard();
      };
      rec.start();
      btn.classList.add('dictate', 'on');
      btn.style.position = 'static';
      btn.querySelector('span').textContent = '正在录…点一下结束';
    } catch (err) { fail(err); rec = null; }
  });
  root.querySelectorAll('[data-play]').forEach((b) => b.addEventListener('click', () => new Audio(`/api/personas/${p.id}/voice-samples/${b.dataset.play}`).play().catch(fail)));
  root.querySelectorAll('[data-del-sample]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('删除这段声音？')) return;
    try { WIZ.draft = await api(`/personas/${p.id}/voice-samples/${b.dataset.delSample}`, { method: 'DELETE' }); collectStep(root); renderWizard(); } catch (err) { fail(err); }
  }));
  root.querySelector('#voice-clone')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = '正在生成，大约需要半分钟…';
    try {
      WIZ.draft = await api(`/personas/${p.id}/voice/clone`, { method: 'POST' });
      toast(`<b>好了。</b>点「试听」听听像不像。`);
    } catch (err) { fail(err); }
    collectStep(root);
    renderWizard();
  });
  root.querySelector('#voice-try')?.addEventListener('click', () => {
    voiceOut.persona = WIZ.draft;
    voiceOut.unlock();
    voiceOut.stop();
    voiceOut.enqueue('我在呢。最近过得好不好？');
  });

  root.querySelector('#delete-persona')?.addEventListener('click', async () => {
    const name = prompt(`这会永久删除${p.name}的照片、声音、回忆和所有对话，无法恢复。\n\n如果确定，请输入${ta(p)}的名字：`);
    if (name === null) return;
    if (name.trim() !== p.name) return toast('名字不对，没有删除。', 'err');
    try { await api(`/personas/${p.id}`, { method: 'DELETE' }); location.hash = '#/'; } catch (err) { fail(err); }
  });

  // 导航
  const go = async (to) => {
    collectStep(root);
    if (WIZ.step === 0) {
      if (!WIZ.draft.name) { toast('请先写下名字', 'err'); root.querySelector('#f-name')?.focus(); return; }
      if (WIZ.mode === 'new' && !WIZ.draft.id) {
        if (!root.querySelector('#consent')?.checked) { toast('请先勾选：家里人都同意', 'err'); return; }
        WIZ.draft.consent = true;
      }
    }
    try { await persist(); } catch (err) { return fail(err); }
    if (to === 'finish') { location.hash = `#/p/${WIZ.draft.id}`; return; }
    WIZ.step = to;
    renderWizard();
  };
  $app.querySelector('#next').addEventListener('click', () => go(WIZ.step === STEPS.length - 1 ? 'finish' : WIZ.step + 1));
  $app.querySelector('#prev')?.addEventListener('click', () => go(WIZ.step - 1));
  $app.querySelector('#skip')?.addEventListener('click', () => { WIZ.step++; renderWizard(); });
  $app.querySelector('#save-exit')?.addEventListener('click', () => go('finish'));
  $app.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(Number(b.dataset.go))));
}

// =====================================================================
// 对话页：一张脸、一句话、一个大按钮
// =====================================================================
const HOTLINES = [
  ['全国心理援助热线（中国大陆）', '12356'],
  ['北京心理危机研究与干预中心', '010-82951332'],
  ['香港撒玛利亚防止自杀会', '2389 2222'],
  ['台湾安心专线', '1925'],
];

function showCare(p) {
  sheet(`
    <h2>先停一下，好吗？</h2>
    <p>${esc(p.callName || p.name)}最希望的，是你好好地活着。现在就给身边信任的人打个电话，或者拨打下面的热线，有人会认真听你说。</p>
    <ul class="hotlines">${HOTLINES.map(([n, t]) => `<li><a href="tel:${t.replace(/\D/g, '')}"><span>${n}</span><b>${t}</b></a></li>`).join('')}</ul>
    <button class="btn primary block" data-close>我知道了</button>`, {
    dismissable: false,
    onMount: (el, close) => el.querySelector('[data-close]').addEventListener('click', close),
  });
}

async function viewTalk(id) {
  const [p, history] = await Promise.all([api(`/personas/${id}`), api(`/personas/${id}/history`)]);
  const family = p.family || [];
  let who = store.get(`who.${id}`, '');
  if (who && !family.some((f) => f.name === who)) who = '';

  $app.innerHTML = `
    <div class="talk state-idle" id="talk">
      <nav class="topbar glass">
        <a class="btn icon-btn" href="#/" aria-label="返回首页">${icon('back')}</a>
        <div class="title">${esc(p.callName || p.name)}<span class="sub">回忆生成 · 非本人</span></div>
        <button class="btn icon-btn" id="open-log" aria-label="对话记录">${icon('list')}</button>
        <a class="btn pill-btn" href="#/p/${id}/memories">${icon('book')}<span>回忆本</span>${p.pendingCount ? `<span class="badge">${p.pendingCount}</span>` : ''}</a>
      </nav>
      <section class="stage">
        ${family.length ? `<button class="btn who-chip" id="who">${icon('user')}<span>${who ? `我是 ${esc(who)}` : '我是谁？'}</span></button>` : ''}
        <div class="portrait" id="portrait"><div class="halo"></div><div class="ring"></div>${avatarHtml(p)}</div>
        <div class="caption" id="caption" aria-live="polite"></div>
      </section>
      <div class="typebar glass hidden" id="typebar">
        <input class="input" id="type-input" placeholder="在这里打字…" enterkeyhint="send" autocomplete="off">
        <button class="btn icon-btn primary" id="type-send" aria-label="发送">${icon('send')}</button>
      </div>
      <div class="dock glass" style="margin-top:12px">
        <button class="btn icon-btn side" id="kbd" aria-label="打字">${icon('keyboard')}</button>
        <div class="mic-wrap">
          <button class="mic" id="mic" aria-label="点一下说话">${icon('mic')}</button>
          <span class="mic-label" id="mic-label"></span>
        </div>
        <button class="btn icon-btn side" id="mute" aria-label="${voiceOut.muted ? '打开声音' : '关闭声音'}">${icon(voiceOut.muted ? 'mute' : 'sound')}</button>
      </div>
    </div>`;

  const $talk = $app.querySelector('#talk');
  const $caption = $app.querySelector('#caption');
  const $mic = $app.querySelector('#mic');
  const $label = $app.querySelector('#mic-label');
  const $typebar = $app.querySelector('#typebar');
  const $input = $app.querySelector('#type-input');
  const name = esc(p.callName || p.name);

  voiceOut.persona = p;
  voiceOut.levelEl = $app.querySelector('#portrait');

  let state = 'idle';
  let listener = null;
  let abort = null;
  let streamDone = true;

  const LABELS = {
    idle: canListen() ? `点一下，跟${ta(p)}说话` : '点一下，打字跟' + ta(p) + '说',
    listening: '我在听…说完点一下',
    thinking: `${ta(p)}在想…`,
    speaking: '点一下可以打断',
  };
  function setState(s, mode) {
    state = s;
    $talk.className = `talk state-${s}${mode === 'synth' ? ' synth' : ''}`;
    $mic.className = `mic${s === 'listening' ? ' listening' : s === 'thinking' || s === 'speaking' ? ' busy' : ''}`;
    $mic.innerHTML = icon(s === 'listening' || s === 'speaking' ? 'stop' : 'mic');
    $label.textContent = LABELS[s];
  }
  voiceOut.onState = (s, mode) => {
    if (s === 'speaking') setState('speaking', mode);
    else if (s === 'done' && streamDone && state === 'speaking') setState('idle');
  };
  setState('idle');

  const showReply = (text) => { $caption.innerHTML = esc(text); $caption.scrollTop = $caption.scrollHeight; };

  async function runStream(path, body, userText) {
    voiceOut.stop();
    setState('thinking');
    $caption.innerHTML = userText ? `<span class="me">你：${esc(userText)}</span>` : '';
    abort = new AbortController();
    streamDone = false;
    let reply = '';
    const splitter = sentenceSplitter((s) => voiceOut.enqueue(s));
    try {
      const res = await fetch(`/api/personas/${id}/${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: abort.signal,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '出错了');
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const line = buf.slice(0, i).replace(/^data: /, '');
          buf = buf.slice(i + 2);
          let ev;
          try { ev = JSON.parse(line); } catch { continue; }
          if (ev.type === 'text') {
            reply += ev.text;
            $caption.innerHTML = `${userText ? `<span class="me">你：${esc(userText)}</span>` : ''}${esc(reply)}`;
            $caption.scrollTop = $caption.scrollHeight;
            splitter.push(ev.text);
          } else if (ev.type === 'done') {
            splitter.flush();
            streamDone = true;
            if (!voiceOut.playing) setState('idle');
          } else if (ev.type === 'care') {
            showCare(p);
          } else if (ev.type === 'memories') {
            for (const m of ev.items) {
              if (m.source === 'life') toast(`<b>${name}记住了：</b>${esc(m.text)}`);
              else toast(`<b>有一段新回忆，</b>等你在「回忆本」里确认。`);
            }
            const pending = ev.items.filter((m) => m.status === 'pending').length;
            if (pending) {
              const badge = $app.querySelector('.pill-btn .badge');
              if (badge) badge.textContent = Number(badge.textContent) + pending;
              else $app.querySelector('.pill-btn')?.insertAdjacentHTML('beforeend', `<span class="badge">${pending}</span>`);
            }
          } else if (ev.type === 'error') {
            throw new Error(ev.message);
          }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        $caption.innerHTML += `<br><span class="err">${esc(e.message || '网络好像不太好，请再说一次')}</span>`;
      }
      voiceOut.stop();
      setState('idle');
    } finally {
      streamDone = true;
      abort = null;
      if (state === 'thinking') setState('idle');
    }
  }

  const send = (text) => {
    text = text.trim();
    if (!text) return;
    runStream('chat', { text, speaker: who }, text);
  };

  async function startListening() {
    voiceOut.unlock();
    setState('listening');
    $caption.innerHTML = `<span class="me">（请说吧）</span>`;
    listener = createListener({
      lang: speechLang(p),
      onInterim: (t) => { $caption.innerHTML = `<span class="me">你：${esc(t)}</span>`; },
      onFinal: () => {},
      onEnd: (text) => {
        listener = null;
        if (text) send(text);
        else { setState('idle'); $caption.innerHTML = `<span class="me">没听清，再点一下说一次吧。</span>`; }
      },
    });
    try { await listener.start(); } catch (e) { listener = null; setState('idle'); fail(e); showTypebar(); }
  }

  function showTypebar() { $typebar.classList.remove('hidden'); $input.focus(); }

  $mic.addEventListener('click', () => {
    voiceOut.unlock();
    if (state === 'listening') return listener?.stop();
    if (state === 'speaking') { voiceOut.stop(); return setState('idle'); }
    if (state === 'thinking') { abort?.abort(); return setState('idle'); }
    if (!canListen()) return showTypebar();
    startListening();
  });
  $app.querySelector('#kbd').addEventListener('click', () => {
    voiceOut.unlock();
    if ($typebar.classList.contains('hidden')) showTypebar(); else $typebar.classList.add('hidden');
  });
  const submitTyped = () => { const t = $input.value; $input.value = ''; voiceOut.unlock(); send(t); };
  $app.querySelector('#type-send').addEventListener('click', submitTyped);
  $input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) submitTyped(); });
  $app.querySelector('#mute').addEventListener('click', (e) => {
    voiceOut.muted = !voiceOut.muted;
    store.set('muted', voiceOut.muted);
    if (voiceOut.muted) { voiceOut.stop(); if (state === 'speaking') setState('idle'); }
    e.currentTarget.innerHTML = icon(voiceOut.muted ? 'mute' : 'sound');
    e.currentTarget.setAttribute('aria-label', voiceOut.muted ? '打开声音' : '关闭声音');
    toast(voiceOut.muted ? '已静音，只显示文字' : '声音已打开', '', 1800);
  });

  $app.querySelector('#open-log').addEventListener('click', async () => {
    const log = await api(`/personas/${id}/history`).catch(() => []);
    sheet(`
      <h2>对话记录</h2>
      <div class="log">${log.map((m) => `<div class="m ${m.role}">${m.role === 'user' && m.speaker ? `<small>${esc(m.speaker)}</small>` : ''}${esc(m.text)}</div>`).join('') || '<p class="empty">还没有对话。</p>'}</div>
      <div class="btn-row" style="margin-top:20px">
        <button class="btn" data-close>关闭</button>
        ${log.length ? `<button class="btn danger" data-clear>清空记录</button>` : ''}
      </div>`, {
      onMount: (el, close) => {
        el.querySelector('[data-close]').addEventListener('click', close);
        el.querySelector('[data-clear]')?.addEventListener('click', async () => {
          if (!confirm('清空所有对话记录？（回忆本里的回忆不会被删除）')) return;
          await api(`/personas/${id}/history`, { method: 'DELETE' }).catch(fail);
          close();
          $caption.innerHTML = '';
        });
        el.scrollTop = el.scrollHeight;
      },
    });
  });

  function pickWho(then) {
    sheet(`
      <h2>你好，你是谁呀？</h2>
      <p>选一下，${name}就知道是谁来了。</p>
      <div class="who-grid">
        ${family.map((f) => `<button class="btn" data-who="${esc(f.name)}">${esc(f.name)}${f.relation ? `<small>${esc(f.relation)}</small>` : ''}</button>`).join('')}
        <button class="btn" data-who="">其他人</button>
      </div>`, {
      dismissable: false,
      onMount: (el, close) => el.querySelectorAll('[data-who]').forEach((b) => b.addEventListener('click', () => {
        who = b.dataset.who;
        store.set(`who.${id}`, who);
        const chip = $app.querySelector('#who span');
        if (chip) chip.textContent = who ? `我是 ${who}` : '我是谁？';
        close();
        voiceOut.unlock();
        then?.();
      })),
    });
  }
  $app.querySelector('#who')?.addEventListener('click', () => pickWho());

  // 进门打招呼：距离上次说话超过 20 分钟（或第一次），由 TA 主动开口
  const lastAt = history.length ? new Date(history[history.length - 1].at || 0) : null;
  const greet = () => runStream('greet', { speaker: who });
  const shouldGreet = !lastAt || Date.now() - lastAt > 20 * 60 * 1000;
  if (!shouldGreet) {
    const lastAi = [...history].reverse().find((m) => m.role === 'assistant');
    if (lastAi) showReply(lastAi.text);
  }
  const askWho = family.length && store.get(`who.${id}`, null) === null;
  if (askWho) pickWho(shouldGreet ? greet : null);
  else if (shouldGreet) greet();

  cleanup = () => { voiceOut.stop(); listener?.abort(); abort?.abort(); voiceOut.levelEl = null; };
}

// =====================================================================
// 回忆本
// =====================================================================
const SOURCE_LABEL = { family: '家人写下', told: '聊天中讲起', life: '近况' };

async function viewMemories(id) {
  const [p, all] = await Promise.all([api(`/personas/${id}`), api(`/personas/${id}/memories`)]);
  let tab = all.some((m) => m.status === 'pending') ? 'pending' : 'all';
  let list = all;
  const name = esc(p.callName || p.name);

  const render = () => {
    const pending = list.filter((m) => m.status === 'pending');
    const shown = (tab === 'pending' ? pending : list.filter((m) => m.status === 'confirmed')).slice().reverse();
    $app.innerHTML = `
      <div class="page">
        <nav class="topbar glass">
          <a class="btn icon-btn" href="#/p/${id}" aria-label="返回对话">${icon('back')}</a>
          <div class="title">回忆本<span class="sub">${name}记得的事</span></div>
          <a class="btn icon-btn" href="#/p/${id}/edit" aria-label="修改资料">${icon('edit')}</a>
        </nav>
        <div class="segmented glass" role="tablist">
          <button role="tab" aria-selected="${tab === 'pending'}" data-tab="pending">待确认${pending.length ? `（${pending.length}）` : ''}</button>
          <button role="tab" aria-selected="${tab === 'all'}" data-tab="all">全部回忆</button>
        </div>
        ${tab === 'pending'
          ? `<p class="tip" style="margin:0 0 16px">这些是聊天时你们讲起的往事。确认是真的，${name}才会把它当成自己的回忆。</p>`
          : `<button class="btn primary block" id="add" style="margin-bottom:18px">${icon('plus')}写下一段回忆</button>
             <div id="composer"></div>`}
        <div id="list">
          ${shown.map((m) => `
            <article class="memory glass ${m.status}" data-id="${m.id}">
              <div class="text">${esc(m.text)}</div>
              <div class="meta"><span class="tag ${m.source}">${SOURCE_LABEL[m.source] || ''}</span>${m.speaker ? `<span>${esc(m.speaker)}</span>` : ''}<span>${new Date(m.createdAt).toLocaleDateString('zh-CN')}</span></div>
              <div class="actions">
                ${m.status === 'pending' ? `<button class="btn small primary" data-act="ok">${icon('check')}是真的，记住</button>` : ''}
                <button class="btn small" data-act="edit">${icon('edit')}改一改</button>
                <button class="btn small danger" data-act="del">${icon('trash')}${m.status === 'pending' ? '不对，删掉' : '删除'}</button>
              </div>
            </article>`).join('') || `<p class="empty">${tab === 'pending' ? '没有需要确认的回忆。' : `还没有回忆。写下第一段和${name}有关的事吧。`}</p>`}
        </div>
      </div>`;
    bind();
  };

  const bind = () => {
    $app.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
    $app.querySelector('#add')?.addEventListener('click', (e) => {
      e.currentTarget.classList.add('hidden');
      const c = $app.querySelector('#composer');
      c.innerHTML = `<div class="card glass">
        <div class="textarea-wrap"><textarea class="textarea" id="new-mem" rows="5" placeholder="例如：每年除夕，${name}都会包一个放了硬币的饺子，谁吃到谁来年最有福气。"></textarea>
        <button type="button" class="btn icon-btn dictate" data-dictate="new-mem" aria-label="用说的">${icon('mic')}</button></div>
        <div class="btn-row" style="margin-top:14px"><button class="btn" id="cancel">取消</button><button class="btn primary" id="save">保存这段回忆</button></div></div>`;
      attachDictation(c, p);
      c.querySelector('#new-mem').focus();
      c.querySelector('#cancel').addEventListener('click', render);
      c.querySelector('#save').addEventListener('click', async () => {
        const text = c.querySelector('#new-mem').value.trim();
        if (!text) return;
        try {
          const m = await api(`/personas/${id}/memories`, { method: 'POST', json: { text, speaker: store.get(`who.${id}`, '') } });
          list = [...list, m];
          toast(`<b>${name}记住了。</b>`);
          render();
        } catch (err) { fail(err); }
      });
    });
    $app.querySelectorAll('.memory').forEach((card) => {
      const mid = card.dataset.id;
      card.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
        try {
          if (b.dataset.act === 'ok') {
            const m = await api(`/personas/${id}/memories/${mid}`, { method: 'PATCH', json: { status: 'confirmed' } });
            list = list.map((x) => (x.id === mid ? m : x));
            toast(`<b>${name}记住了。</b>`);
          } else if (b.dataset.act === 'del') {
            if (!confirm('删除这段回忆？')) return;
            await api(`/personas/${id}/memories/${mid}`, { method: 'DELETE' });
            list = list.filter((x) => x.id !== mid);
          } else if (b.dataset.act === 'edit') {
            const cur = list.find((x) => x.id === mid);
            const text = prompt('改一改这段回忆：', cur.text);
            if (!text || text.trim() === cur.text) return;
            const m = await api(`/personas/${id}/memories/${mid}`, { method: 'PATCH', json: { text } });
            list = list.map((x) => (x.id === mid ? m : x));
          }
          render();
        } catch (err) { fail(err); }
      }));
    });
  };
  render();
}

// =====================================================================
// 路由
// =====================================================================
async function route() {
  cleanup?.();
  cleanup = null;
  document.querySelectorAll('.scrim').forEach((s) => s.remove());
  const h = location.hash.replace(/^#/, '') || '/';
  let m;
  try {
    if (h === '/') await viewHome();
    else if (h === '/new') await viewWizard(null);
    else if ((m = h.match(/^\/p\/([a-f0-9]{12})$/))) await viewTalk(m[1]);
    else if ((m = h.match(/^\/p\/([a-f0-9]{12})\/edit$/))) await viewWizard(m[1]);
    else if ((m = h.match(/^\/p\/([a-f0-9]{12})\/memories$/))) await viewMemories(m[1]);
    else location.hash = '#/';
  } catch (e) {
    $app.innerHTML = `<div class="page"><div class="notice glass"><b>打不开这一页：</b>${esc(e.message)}</div><a class="btn block" href="#/" style="margin-top:16px">回到首页</a></div>`;
  }
}

window.addEventListener('hashchange', route);
STATUS = await api('/status').catch(() => STATUS);
route();
