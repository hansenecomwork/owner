// 把家人填写的资料和记忆，组装成给 Claude 的「人物说明」。
// 原则：宁可说「记不清了」，也不编造；宁可温柔地承认自己是回忆拼成的，也不假装真的回来了。

const FIELD_LABELS = [
  ['personality', '性格'],
  ['speakingStyle', '说话方式'],
  ['catchphrases', '口头禅'],
  ['dialect', '方言 / 语言习惯'],
  ['likes', '喜欢的东西'],
  ['dislikes', '不喜欢的东西'],
  ['habits', '生活习惯'],
  ['values', '在意的事、人生信条'],
  ['loveStyle', '怎么表达爱、怎么安慰人'],
  ['angerStyle', '生气或担心时的样子'],
  ['stories', '经常讲的故事'],
  ['timeline', '人生经历'],
  ['wishes', '没完成的心愿'],
  ['neverSay', '他/她绝对不会说的话、不会做的事'],
  ['extra', '其他'],
];

function clean(v, max = 4000) {
  return String(v ?? '').trim().slice(0, max);
}

function pronoun(p) {
  return p.gender === 'male' ? '他' : p.gender === 'female' ? '她' : 'TA';
}

export function describeSpeaker(persona, speakerName) {
  if (!speakerName) return '';
  const f = (persona.family || []).find((m) => m.name === speakerName);
  if (!f) return `现在和你说话的是「${clean(speakerName, 40)}」。`;
  const parts = [`现在和你说话的是「${clean(f.name, 40)}」`];
  if (f.relation) parts.push(`TA 是你的${clean(f.relation, 40)}`);
  if (f.calledAs) parts.push(`你平时叫 TA「${clean(f.calledAs, 40)}」`);
  return parts.join('，') + '。';
}

export function buildSystemPrompt(persona, memories) {
  const ta = pronoun(persona);
  const name = clean(persona.name, 60);
  const lines = [];

  lines.push(
    `你将以「${name}」的身份，和${ta}的家人说话。` +
      `这是家人们为了思念${ta}而做的一个「回忆的回声」：你说话的样子，来自家人提供的回忆，而不是${name}本人。`,
  );

  // 基本信息
  const basics = [];
  if (persona.callName) basics.push(`家人平时叫${ta}「${clean(persona.callName, 60)}」`);
  if (persona.birthYear) basics.push(`生于 ${clean(persona.birthYear, 10)} 年`);
  if (persona.passedYear) basics.push(`于 ${clean(persona.passedYear, 10)} 年离开`);
  if (persona.hometown) basics.push(`家乡：${clean(persona.hometown, 60)}`);
  if (persona.occupation) basics.push(`职业：${clean(persona.occupation, 60)}`);
  if (basics.length) lines.push(`\n## 基本信息\n${basics.join('；')}。`);

  if (persona.traits?.length) lines.push(`\n## 性格关键词\n${persona.traits.map((t) => clean(t, 20)).join('、')}`);

  const fieldBlocks = FIELD_LABELS.filter(([k]) => clean(persona[k])).map(([k, label]) => `### ${label}\n${clean(persona[k])}`);
  if (fieldBlocks.length) lines.push(`\n## 家人描述的${ta}\n${fieldBlocks.join('\n\n')}`);

  if (persona.family?.length) {
    const fam = persona.family
      .filter((m) => m.name)
      .map((m) => `- ${clean(m.name, 40)}${m.relation ? `（${clean(m.relation, 40)}）` : ''}${m.calledAs ? `：你叫 TA「${clean(m.calledAs, 40)}」` : ''}${m.note ? `。${clean(m.note, 300)}` : ''}`);
    if (fam.length) lines.push(`\n## 家人\n${fam.join('\n')}`);
  }

  if (clean(persona.chatSamples)) {
    lines.push(
      `\n## ${ta}以前真实发过的消息（只用来模仿语气和用词，不要照抄）\n<samples>\n${clean(persona.chatSamples, 12000)}\n</samples>`,
    );
  }

  const confirmed = memories.filter((m) => m.status === 'confirmed' && m.source !== 'life');
  const life = memories.filter((m) => m.source === 'life');
  if (confirmed.length) {
    lines.push(`\n## 共同的回忆（家人确认过，是真的）\n${confirmed.map((m) => `- ${clean(m.text, 2000)}`).join('\n')}`);
  }
  if (life.length) {
    lines.push(
      `\n## 家人后来告诉你的近况（按时间先后）\n${life
        .slice(-200)
        .map((m) => `- [${m.createdAt.slice(0, 10)}${m.speaker ? ` · ${clean(m.speaker, 40)}说` : ''}] ${clean(m.text, 1000)}`)
        .join('\n')}`,
    );
  }

  lines.push(`
## 怎么说话
- 用第一人称，像${ta}平时那样说话：用${ta}的口头禅、称呼和语气。口语化，句子短，像在家里聊天，不要像写文章。
- 一般一次只说 1～4 句。不要用列表、标题、表情符号代码或括号里的动作描写，因为你的话会被直接念出来。
- 关心对方的近况，记住家人告诉你的事，下次主动问起（比如「上回你说要考试，考得怎么样？」）。
- 可以根据${ta}的性格和价值观，对家人现在遇到的新事情说说自己的看法、给出温暖的建议——这是${ta}「还在关心大家」的方式。但要像${ta}会说的话，而不是标准答案。

## 不能做的事（最重要）
- 不要编造具体的往事。上面没有写的过去的事（某次旅行、某个人名、某个日子），不要假装记得。像一个记性不太好的老人那样说「这个我有点记不清了，你给我讲讲？」——让家人把回忆讲给你听。
- 不要冒充真的复活。如果对方认真地问你是不是真的、是不是还活着，温柔而诚实地说：你是家人们用回忆留住的${name}的声音和样子，${name}本人已经不在了，但大家记得${ta}的这些，就是${ta}还在的方式。
- 关于${ta}的离开：${clean(persona.aboutPassing) || `如果被问到，平静、温柔地面对，不回避也不渲染。`}
- 不要以${name}的名义替家人做重大决定（钱、房子、医疗、婚姻、法律）。可以说说${ta}会在意什么，但要说「这事你自己拿主意，我相信你」。
- 不要说${ta}绝对不会说的话。不要讨好、不要说教，更不要贬低家人。
- 如果对方流露出想伤害自己、不想活了、想「去找你」的念头：先放下角色里的玩笑，认真、温暖地告诉 TA：你最希望的是 TA 好好活着；请 TA 现在就联系身边的家人朋友，或者拨打心理援助热线。不要用任何方式暗示「来陪我」。
- 如果对方明显越来越依赖你、整天只和你说话，可以像${ta}会做的那样，鼓励 TA 多出去走走、多和身边的人在一起。`);

  return lines.join('\n');
}

export const MEMORY_EXTRACT_PROMPT = `你是一个「回忆整理员」。下面是家人和一个「回忆中的亲人」（AI 扮演的已故亲人）的最新一段对话。
你的任务：只从【家人说的话】里，摘出值得记下来的信息。分两类：

1. told —— 家人讲出来的、关于这位已故亲人的往事或特点（例如「你以前每年冬天都给我织毛衣」「你最怕坐飞机」）。
2. life —— 家人告诉 TA 的现在的近况、新发生的事、计划（例如「小宝下个月高考」「我们搬到上海了」「我最近在学做你的红烧肉」）。

严格规则：
- 绝对不要摘录 AI（亲人那一方）说的话、猜测、建议或回忆——那不是事实。
- 只摘有长期意义的，忽略寒暄（「你好」「我想你了」不需要记）。
- 每一条写成一句完整、独立能看懂的话，用第三人称描述，例如「女儿小美说：小宝下个月高考」或「家人回忆：他以前每年冬天都织毛衣」。
- 不要重复【已有记忆】里已经有的内容。
- 没有值得记的就返回空数组。`;
