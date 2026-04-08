/**
 * 将《神探夏洛克：27年恐怖罪案编年史》.json 各条目的触发词改为四位年份，如 "1996"
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, '《神探夏洛克：27年恐怖罪案编年史》.json');

function yearFromComment(comment) {
  if (!comment || typeof comment !== 'string') return '1996';
  // 优先匹配「YYYY年」且避免把「100.」里的数字当年份：取带「年」的 YYYY
  const m = comment.match(/(?:^|[^\d])(\d{4})\s*年/);
  if (m) return m[1];
  // 次选：独立的 1996–2035
  const m2 = comment.match(/\b(19[89]\d|20[0-3]\d)\b/);
  if (m2) return m2[1];
  return '1996';
}

const raw = fs.readFileSync(file, 'utf8');
const data = JSON.parse(raw);

for (const id of Object.keys(data.entries || {})) {
  const e = data.entries[id];
  const y = yearFromComment(e.comment);
  e.key = [y];
}

if (data.originalData && Array.isArray(data.originalData.entries)) {
  for (const row of data.originalData.entries) {
    const y = yearFromComment(row.comment);
    row.keys = [y];
    if (row.key !== undefined) row.key = [y];
  }
}

fs.writeFileSync(file, JSON.stringify(data), 'utf8');
console.log('Updated keys to year strings in', file);
