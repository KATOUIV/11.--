/**
 * 编年史世界书：二次关键词（节约 token）
 * - key：四位年份 "1996"
 * - keysecondary：优先「月日」→「月」→ 章节名/案名；同年同次键冲突时追加「·短后缀」
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, '《神探夏洛克：27年恐怖罪案编年史》.json');

function yearFromComment(comment) {
  if (!comment || typeof comment !== 'string') return '1996';
  const m = comment.match(/(?:^|[^\d])(\d{4})\s*年/);
  if (m) return m[1];
  const m2 = comment.match(/\b(19[89]\d|20[0-3]\d)\b/);
  if (m2) return m2[1];
  return '1996';
}

function extractMd(text) {
  if (!text) return null;
  const t = text.replace(/\s+/g, ' ');
  const full = t.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (full) {
    const mo = parseInt(full[1], 10);
    const da = parseInt(full[2], 10);
    return { md: `${mo}月${da}日`, m: `${mo}月` };
  }
  const ym = t.match(/(\d{1,2})\s*月(?!\s*日)/);
  if (ym) {
    const mo = parseInt(ym[1], 10);
    return { md: null, m: `${mo}月` };
  }
  return null;
}

function chapterSlug(comment) {
  const m = comment.match(/年\s*[：:]\s*([^，。\n]{2,24})/);
  if (m) return m[1].trim();
  return null;
}

function ordinalTail(comment) {
  const rest = comment.replace(/^\s*\d+\.\s*/, '').trim();
  if (!rest) return null;
  const cut = rest.split(/[，。]/)[0];
  return cut.length > 30 ? cut.slice(0, 30) : cut;
}

function buildBaseSecondary(comment, content, year) {
  const head = `${comment}\n${(content || '').slice(0, 1500)}`;
  const ymd = head.match(
    new RegExp(`${year}\\s*年\\s*(\\d{1,2})\\s*月\\s*(\\d{1,2})\\s*日`),
  );
  if (ymd) {
    const mo = parseInt(ymd[1], 10);
    const da = parseInt(ymd[2], 10);
    return `${mo}月${da}日`;
  }
  const any = extractMd(head);
  if (any?.md) return any.md;
  if (any?.m) return any.m;
  const slug = chapterSlug(comment);
  if (slug) return slug;
  const ord = ordinalTail(comment);
  if (ord) return ord;
  if (comment.includes('《神探夏洛克')) return '背景说明';
  return '编年史';
}

function main() {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ids = Object.keys(data.entries || {}).sort((a, b) => Number(a) - Number(b));

  const planned = [];
  for (const id of ids) {
    const e = data.entries[id];
    const y = yearFromComment(e.comment);
    const base = buildBaseSecondary(e.comment, e.content, y);
    planned.push({ id, y, base, e });
  }

  const count = new Map();
  for (const p of planned) {
    const k = `${p.y}|||${p.base}`;
    count.set(k, (count.get(k) || 0) + 1);
  }

  for (const p of planned) {
    const { e, y, base, id } = p;
    const k = `${y}|||${base}`;
    let sec = base;
    if (count.get(k) > 1) {
      const tail =
        ordinalTail(p.e.comment) ||
        chapterSlug(p.e.comment) ||
        `条目${id}`;
      sec = `${base}·${tail}`;
    }
    e.key = [y];
    e.keysecondary = [sec];
    e.selective = true;
    e.selectiveLogic = 0;
  }

  fs.writeFileSync(file, JSON.stringify(data), 'utf8');
  console.log('OK: secondary date/month/slug; duplicates disambiguated. File:', file);
}

main();
