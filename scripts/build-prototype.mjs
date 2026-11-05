// 生成可独立打开的原型页：把 App 共用的解析器、人物提示词和示例聊天内联进一个 HTML 文件。
// 用法：node scripts/build-prototype.mjs  → prototype/niannian.html
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const unexport = (src) => src.replace(/^export\s+/gm, '');
const out = read('prototype/template.html')
  .replace('/*__WECHAT__*/', () => unexport(read('public/wechat-import.js')))
  .replace('/*__PROMPT__*/', () => unexport(read('server/prompt.js')))
  .replace("/*__SAMPLE__*/''", () => JSON.stringify(read('prototype/sample-chat.txt')));
fs.writeFileSync(new URL('../prototype/niannian.html', import.meta.url), out);
console.log(`prototype/niannian.html  ${(out.length / 1024).toFixed(1)} KB`);
