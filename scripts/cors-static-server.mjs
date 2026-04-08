/**
 * 从 dist/ 提供静态文件，并为所有响应设置 CORS，供酒馆页面跨域 $('body').load(...) 使用。
 *
 * jQuery 的 $.ajax/load 会带 X-Requested-With，属于「非简单请求」，浏览器会先发 OPTIONS 预检；
 * 仅给 GET 加 Access-Control-Allow-Origin 不够，必须正确处理 OPTIONS 并允许对应请求头。
 *
 * 用法：pnpm build && pnpm serve:dist
 * 默认 http://localhost:5500（与 Live Server 工作区端口一致）。可选备用，不替代本机已配置的 Live Server。
 */
import http from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from 'serve-handler';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', 'dist');

/** @param {import('node:http').ServerResponse} res */
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Requested-With, Accept, Accept-Language, Accept-Encoding, Authorization',
  );
  res.setHeader('Access-Control-Max-Age', '86400');
  // 从公网页访问 localhost 时 Chrome 可能要求（本地开发一般可忽略）
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
}

const server = http.createServer((req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  return handler(req, res, {
    public: root,
    cleanUrls: false,
    etag: true,
  });
});

const PORT = Number(process.env.PORT || 5500);
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.info(`[cors-static-server] http://127.0.0.1:${PORT}/  →  ${root}`);
});
