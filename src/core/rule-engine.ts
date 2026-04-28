// 本地规则分析引擎 - 类似 360 星图的规则匹配分析
// 基于 OWASP Top 10 + ModSecurity CRS 规则库

export interface Rule {
  id: string
  name: string
  category: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  patterns: RegExp[]
  description: string
  remediation: string
}

export interface RuleMatch {
  rule: Rule
  line: string
  lineNumber: number
  matchedText: string
}

export interface RuleAnalysisResult {
  totalLines: number
  matchedLines: number
  matches: RuleMatch[]
  summary: {
    critical: number
    high: number
    medium: number
    low: number
  }
  categoryStats: Record<string, number>
  report: string
}

// ==================== 规则库 ====================

const RULES: Rule[] = [
  // ---- SQL 注入 ----
  {
    id: 'SQL-001', name: 'UNION SELECT 注入', category: 'SQL注入', severity: 'critical',
    patterns: [/union\s+(all\s+)?select/i, /union\s*\d+\s*select/i],
    description: '检测到 UNION SELECT 联合查询注入攻击',
    remediation: '使用参数化查询，部署 WAF 规则拦截 UNION SELECT'
  },
  {
    id: 'SQL-002', name: '布尔盲注', category: 'SQL注入', severity: 'critical',
    patterns: [/'\s*or\s*'1'\s*=\s*'1/i, /'\s*or\s+1\s*=\s*1/i, /or\s+'1'\s*=\s*'1'/i, /admin'\s*--/i],
    description: '检测到布尔盲注攻击特征',
    remediation: '使用参数化查询，过滤特殊字符'
  },
  {
    id: 'SQL-003', name: '时间盲注', category: 'SQL注入', severity: 'critical',
    patterns: [/sleep\s*\(\s*\d+\s*\)/i, /waitfor\s+delay/i, /benchmark\s*\(\s*\d+/i],
    description: '检测到时间盲注攻击',
    remediation: '限制数据库查询超时时间，使用参数化查询'
  },
  {
    id: 'SQL-004', name: '报错注入', category: 'SQL注入', severity: 'high',
    patterns: [/extractvalue/i, /updatexml/i, /exp\s*\(\s*~/i, /floor\s*\(\s*rand/i],
    description: '检测到报错注入攻击',
    remediation: '关闭数据库错误回显，使用参数化查询'
  },
  {
    id: 'SQL-005', name: '堆叠注入', category: 'SQL注入', severity: 'critical',
    patterns: [/;\s*(drop|delete|update|insert|alter|create)\s/i, /;\s*exec\s*\(/i],
    description: '检测到堆叠注入攻击',
    remediation: '禁止多语句执行，使用参数化查询'
  },
  {
    id: 'SQL-006', name: 'SQL 注释绕过', category: 'SQL注入', severity: 'high',
    patterns: [/\bunion\b.*\bselect\b.*\/\*\*/i, /\/\*!\s*(union|select|insert|update|delete)/i],
    description: '检测到 SQL 注释绕过攻击',
    remediation: '过滤注释符号，使用参数化查询'
  },
  {
    id: 'SQL-007', name: 'SQL 特殊字符', category: 'SQL注入', severity: 'medium',
    patterns: [/'\s*;\s*--/, /'\s*\|\|/, /'\s*&&/, /0x[0-9a-f]{6,}/i],
    description: '检测到可疑 SQL 特殊字符',
    remediation: '检查输入参数过滤逻辑'
  },
  {
    id: 'SQL-008', name: 'SQL 关键字', category: 'SQL注入', severity: 'medium',
    patterns: [/\b(xp_cmdshell|sp_executesql|information_schema|load_file|into\s+outfile|into\s+dumpfile)\b/i],
    description: '检测到 SQL 关键字注入',
    remediation: '过滤 SQL 关键字，限制数据库权限'
  },
  {
    id: 'SQL-009', name: 'SQLMap 特征', category: 'SQL注入', severity: 'high',
    patterns: [/sqlmap/i, /x-forwarded-for:\s*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}.*select/i],
    description: '检测到 SQLMap 自动化注入工具',
    remediation: '封禁来源 IP，部署 WAF'
  },
  {
    id: 'SQL-010', name: 'Havij 特征', category: 'SQL注入', severity: 'high',
    patterns: [/havij/i, /appscan/i],
    description: '检测到 Havij/AppScan 注入工具',
    remediation: '封禁来源 IP，更新 WAF 规则'
  },
  {
    id: 'SQL-011', name: '二次注入', category: 'SQL注入', severity: 'high',
    patterns: [/update\s+\w+\s+set\s+.*['"]\s*(or|and|union|select|drop|delete)/i, /insert\s+into\s+.*values\s*\(.*'\s*(or|union|select)/i],
    description: '检测到 SQL 二次注入攻击特征',
    remediation: '所有 SQL 操作使用参数化查询，包括 UPDATE/INSERT'
  },
  {
    id: 'SQL-012', name: 'OOB 数据外带', category: 'SQL注入', severity: 'high',
    patterns: [/utl_http/i, /dbms_pipe/i, /xp_dirtree/i, /xp_cmdshell/i, /dbms_lock\.sleep/i, /utl_inaddr/i],
    description: '检测到 SQL 带外数据外带注入',
    remediation: '限制数据库网络访问，禁用危险存储过程'
  },

  // ---- XSS 攻击 ----
  {
    id: 'XSS-001', name: '反射型 XSS', category: 'XSS攻击', severity: 'high',
    patterns: [/<script[^>]*>.*?<\/script>/i, /<script[^>]*>/i, /javascript\s*:/i],
    description: '检测到反射型 XSS 攻击',
    remediation: '对输出进行 HTML 编码，设置 CSP 策略'
  },
  {
    id: 'XSS-002', name: '事件型 XSS', category: 'XSS攻击', severity: 'high',
    patterns: [/on(error|load|click|mouseover|focus|blur)\s*=/i, /on[a-z]+\s*=\s*["']?[^"'\s>]+/i],
    description: '检测到事件型 XSS 攻击',
    remediation: '过滤事件属性，设置 CSP 策略'
  },
  {
    id: 'XSS-003', name: '标签型 XSS', category: 'XSS攻击', severity: 'high',
    patterns: [/<(img|iframe|svg|embed|object|applet|form|input|body|meta|link|base)[^>]*>/i],
    description: '检测到标签型 XSS 攻击',
    remediation: '过滤 HTML 标签，设置 CSP 策略'
  },
  {
    id: 'XSS-004', name: 'DOM XSS', category: 'XSS攻击', severity: 'high',
    patterns: [/document\.(cookie|location|write|domain)/i, /\.innerHTML\s*=/i, /eval\s*\(/i],
    description: '检测到 DOM 型 XSS 攻击',
    remediation: '避免使用 innerHTML，使用 textContent'
  },
  {
    id: 'XSS-005', name: '编码绕过 XSS', category: 'XSS攻击', severity: 'medium',
    patterns: [/&#\d+;/, /&#x[0-9a-f]+;/i, /\\u00[0-9a-f]{2}/i, /%3[cC]/, /%3[eE]/],
    description: '检测到编码绕过型 XSS',
    remediation: '多层解码后再过滤'
  },
  {
    id: 'XSS-006', name: 'Base64 XSS', category: 'XSS攻击', severity: 'medium',
    patterns: [/base64/i, /data:\s*text\/html/i],
    description: '检测到 Base64 编码 XSS',
    remediation: '过滤 data: 协议和 base64 编码'
  },
  {
    id: 'XSS-007', name: 'SVG XSS', category: 'XSS攻击', severity: 'high',
    patterns: [/<svg[^>]*onload/i, /<svg[^>]*>.*?<script/i],
    description: '检测到 SVG XSS 攻击',
    remediation: '过滤 SVG 标签，设置 CSP 策略'
  },
  {
    id: 'XSS-008', name: 'XSS 工具特征', category: 'XSS攻击', severity: 'medium',
    patterns: [/xsser/i, /beef/i, /xss\s*probe/i],
    description: '检测到 XSS 自动化工具',
    remediation: '封禁来源 IP，部署 WAF'
  },
  {
    id: 'XSS-009', name: 'CSP 绕过', category: 'XSS攻击', severity: 'medium',
    patterns: [/unsafe-eval/i, /unsafe-inline/i, /nonce\s*[=:]/i, /report-uri/i, /content-security-policy/i],
    description: '检测到 CSP 绕过相关特征',
    remediation: '严格配置 CSP 策略，避免 unsafe-eval'
  },
  {
    id: 'XSS-010', name: 'WebSocket XSS', category: 'XSS攻击', severity: 'medium',
    patterns: [/wss?:\/\/[^"'\s>]*<script/i, /wss?:\/\/[^"'\s>]*javascript/i, /onmessage\s*=/i],
    description: '检测到 WebSocket XSS 攻击',
    remediation: '校验 WebSocket 消息内容，过滤 HTML 标签'
  },

  // ---- 命令注入 ----
  {
    id: 'CMD-001', name: '系统命令执行', category: '命令注入', severity: 'critical',
    patterns: [/;\s*(cat|ls|whoami|id|pwd|uname|ifconfig|netstat)\s/i, /\|\s*(cat|ls|whoami)/i],
    description: '检测到系统命令注入',
    remediation: '禁止调用系统命令，使用白名单校验'
  },
  {
    id: 'CMD-002', name: 'Shell 注入', category: '命令注入', severity: 'critical',
    patterns: [/\/bin\/(bash|sh|csh|ksh|zsh)/i, /cmd\.exe/i, /powershell/i, /`[^`]+`/],
    description: '检测到 Shell 注入攻击',
    remediation: '禁止调用 Shell，使用安全的 API'
  },
  {
    id: 'CMD-003', name: '管道命令', category: '命令注入', severity: 'critical',
    patterns: [/\|\s*\w+/, /&&\s*\w+/, /;\s*\w+/],
    description: '检测到管道命令注入',
    remediation: '过滤管道符和命令连接符'
  },
  {
    id: 'CMD-004', name: '反弹 Shell', category: '命令注入', severity: 'critical',
    patterns: [/\/dev\/tcp\//i, /nc\s+-[elv]/i, /mkfifo/i, /bash\s+-i/i],
    description: '检测到反弹 Shell 攻击',
    remediation: '封禁外连端口，限制网络访问'
  },
  {
    id: 'CMD-005', name: '命令注入工具', category: '命令注入', severity: 'high',
    patterns: [/commix/i, /reGeorg/i, /reDuh/i],
    description: '检测到命令注入工具',
    remediation: '封禁来源 IP'
  },
  {
    id: 'CMD-006', name: '环境变量注入', category: '命令注入', severity: 'high',
    patterns: [/\$\{.*\}/, /\$\(.*\)/, /`.*\$\(/],
    description: '检测到环境变量注入',
    remediation: '过滤环境变量引用'
  },
  {
    id: 'CMD-007', name: 'DNSlog 外带', category: '命令注入', severity: 'high',
    patterns: [/dnslog\.cn/i, /ceye\.io/i, /oast\.(fun|pro|site|online)/i, /burpcollaborator/i, /interact\.sh/i],
    description: '检测到 DNSlog/带外数据外带攻击',
    remediation: '限制出站 DNS 请求，监控异常域名解析'
  },
  {
    id: 'CMD-008', name: 'Cron 定时任务注入', category: '命令注入', severity: 'critical',
    patterns: [/\/\*\s*\d+\s+\*\s+\*\s+\*\s+\*/, /crontab\s+-/i, /\/etc\/cron/i, /echo\s+.*>>\s*\/etc\/crontab/i],
    description: '检测到 Cron 定时任务注入',
    remediation: '限制 crontab 写入权限，监控定时任务变更'
  },

  // ---- 目录遍历 ----
  {
    id: 'DIR-001', name: '路径穿越', category: '目录遍历', severity: 'critical',
    patterns: [/\.\.\//g, /\.\.\\/g, /%2e%2e%2f/i, /%252e%252e%252f/i, /\.\.%2f/i, /\.\.%5c/i],
    description: '检测到目录遍历攻击',
    remediation: '使用 chroot 限制访问范围，校验路径'
  },
  {
    id: 'DIR-002', name: '敏感文件访问', category: '目录遍历', severity: 'critical',
    patterns: [/\/etc\/passwd/i, /\/etc\/shadow/i, /\/etc\/hosts/i, /boot\.ini/i, /win\.ini/i, /\/windows\/system32/i],
    description: '检测到敏感文件访问尝试',
    remediation: '限制文件访问权限，部署 WAF'
  },
  {
    id: 'DIR-003', name: '日志文件读取', category: '目录遍历', severity: 'high',
    patterns: [/\/var\/log\//i, /\/var\/www\//i, /\.log\b/i, /access_log/i, /error_log/i],
    description: '检测到日志文件读取尝试',
    remediation: '限制日志文件访问权限'
  },
  {
    id: 'DIR-004', name: '配置文件读取', category: '目录遍历', severity: 'critical',
    patterns: [/\.env\b/, /\.htaccess/i, /\.htpasswd/i, /web\.config/i, /config\.php/i, /wp-config\.php/i],
    description: '检测到配置文件读取尝试',
    remediation: '将配置文件移出 web 目录'
  },
  {
    id: 'DIR-005', name: '编码绕过遍历', category: '目录遍历', severity: 'high',
    patterns: [/%c0%ae%c0%ae/i, /%c1%9c/, /%c1%af/, /\.\.%00/],
    description: '检测到编码绕过目录遍历',
    remediation: '规范化路径后再校验'
  },

  // ---- 暴力破解 ----
  {
    id: 'BRUTE-001', name: '登录暴力破解', category: '暴力破解', severity: 'high',
    patterns: [/POST\s+.*\/(login|signin|auth|admin)/i],
    description: '检测到登录暴力破解尝试',
    remediation: '实施账户锁定策略，添加验证码'
  },
  {
    id: 'BRUTE-002', name: 'HTTP 认证爆破', category: '暴力破解', severity: 'high',
    patterns: [/Authorization:\s*Basic\s+/i],
    description: '检测到 HTTP Basic 认证爆破',
    remediation: '使用 Digest 认证或 OAuth'
  },
  {
    id: 'BRUTE-003', name: '密码字典', category: '暴力破解', severity: 'medium',
    patterns: [/(password|passwd|pwd)\s*[:=]\s*['"]?\w+/i],
    description: '检测到密码字典攻击特征',
    remediation: '实施密码复杂度策略'
  },
  {
    id: 'BRUTE-004', name: 'Hydra 特征', category: '暴力破解', severity: 'high',
    patterns: [/hydra/i, /medusa/i, /thc-hydra/i],
    description: '检测到 Hydra/Medusa 爆破工具',
    remediation: '封禁来源 IP'
  },
  {
    id: 'BRUTE-005', name: '高频请求', category: '暴力破解', severity: 'medium',
    patterns: [/(GET|POST)\s+.*HTTP\/1\.[01]"\s+401/, /HTTP\/1\.[01]"\s+403/],
    description: '检测到高频认证失败请求',
    remediation: '实施请求频率限制'
  },
  {
    id: 'BRUTE-006', name: '密码破解工具', category: '暴力破解', severity: 'high',
    patterns: [/john\b/i, /hashcat/i, /rainbowcrack/i, /ophcrack/i, /l0phtcrack/i],
    description: '检测到密码破解工具特征',
    remediation: '实施强密码策略，使用多因素认证'
  },
  {
    id: 'BRUTE-007', name: '凭据填充', category: '暴力破解', severity: 'medium',
    patterns: [/POST\s+.*\/(login|signin|auth).*HTTP\/1\.[01]"\s+(200|302).*POST\s+.*\/(login|signin|auth)/i],
    description: '检测到凭据填充攻击特征',
    remediation: '实施账户锁定策略，添加验证码，限制登录频率'
  },

  // ---- 扫描探测 ----
  {
    id: 'SCAN-001', name: '漏洞扫描器', category: '扫描探测', severity: 'medium',
    patterns: [/(nikto|nmap|masscan|zmap|nuclei|dirsearch|gobuster|ffuf)/i],
    description: '检测到漏洞扫描器',
    remediation: '封禁来源 IP，部署 WAF'
  },
  {
    id: 'SCAN-002', name: '路径扫描', category: '扫描探测', severity: 'medium',
    patterns: [/(\/admin|\/manager|\/console|\/wp-admin|\/phpmyadmin|\/phpMyAdmin|\/adminer)/i],
    description: '检测到敏感路径扫描',
    remediation: '修改默认管理路径，限制访问 IP'
  },
  {
    id: 'SCAN-003', name: '敏感文件探测', category: '扫描探测', severity: 'medium',
    patterns: [/\.git\//, /\.svn\//, /\.env\b/, /\.DS_Store/, /robots\.txt/, /\.well-known/],
    description: '检测到敏感文件探测',
    remediation: '删除敏感文件，配置访问控制'
  },
  {
    id: 'SCAN-004', name: '备份文件探测', category: '扫描探测', severity: 'medium',
    patterns: [/\.(bak|old|orig|backup|swp|tmp|log|sql|tar\.gz|zip|rar)$/i],
    description: '检测到备份文件探测',
    remediation: '删除备份文件，配置访问控制'
  },
  {
    id: 'SCAN-005', name: 'Burp Suite 特征', category: '扫描探测', severity: 'medium',
    patterns: [/burpsuite/i, /burp\s*scanner/i, /acunetix/i, /appscan/i, /w3af/i, /owasp\s*zap/i],
    description: '检测到专业扫描工具',
    remediation: '封禁来源 IP'
  },
  {
    id: 'SCAN-006', name: '异常 User-Agent', category: '扫描探测', severity: 'low',
    patterns: [/User-Agent:\s*(Mozilla\/[0-9]\.[0-9]$|$)/i, /User-Agent:\s*$/i, /python-requests/i, /curl\//i, /wget/i],
    description: '检测到异常 User-Agent',
    remediation: '限制异常 UA 访问'
  },
  {
    id: 'SCAN-007', name: '目录爆破工具', category: '扫描探测', severity: 'medium',
    patterns: [/dirbuster/i, /feroxbuster/i, /wfuzz/i, /gobuster/i, /dirb\//i, /ffuf/i],
    description: '检测到目录爆破工具',
    remediation: '封禁来源 IP，配置访问频率限制'
  },
  {
    id: 'SCAN-008', name: '子域名枚举', category: '扫描探测', severity: 'medium',
    patterns: [/subfinder/i, /amass/i, /sublist3r/i, /knockpy/i, /dnsrecon/i, /enum4linux/i],
    description: '检测到子域名枚举工具',
    remediation: '监控 DNS 查询，限制区域传送'
  },
  {
    id: 'SCAN-009', name: '漏洞利用框架', category: '扫描探测', severity: 'high',
    patterns: [/metasploit/i, /cobalt\s*strike/i, /msfconsole/i, /meterpreter/i, /empire/i, /covenant/i],
    description: '检测到漏洞利用框架攻击',
    remediation: '立即封禁来源 IP，全面排查系统安全'
  },

  // ---- SSRF 攻击 ----
  {
    id: 'SSRF-001', name: '内网探测', category: 'SSRF攻击', severity: 'critical',
    patterns: [/http:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)/i],
    description: '检测到 SSRF 内网探测',
    remediation: '限制出站请求目标，使用白名单'
  },
  {
    id: 'SSRF-002', name: '云元数据探测', category: 'SSRF攻击', severity: 'critical',
    patterns: [/169\.254\.169\.254/i, /metadata\.google\.internal/i, /\[fd00::ec2\]/i],
    description: '检测到云元数据 SSRF 攻击',
    remediation: '限制访问元数据地址，使用 IMDSv2'
  },
  {
    id: 'SSRF-003', name: '协议 SSRF', category: 'SSRF攻击', severity: 'critical',
    patterns: [/(file|gopher|dict|ftp):\/\//i, /php:\/\/input/i, /expect:\/\//i],
    description: '检测到协议型 SSRF 攻击',
    remediation: '限制出站协议，仅允许 http/https'
  },
  {
    id: 'SSRF-004', name: 'URL 参数 SSRF', category: 'SSRF攻击', severity: 'high',
    patterns: [/(url|dest|target|endpoint|redirect|proxy|src|href|path|uri|feed|page)\s*=\s*https?:\/\//i],
    description: '检测到 URL 参数 SSRF',
    remediation: '校验 URL 参数，使用白名单'
  },

  // ---- 文件包含 ----
  {
    id: 'LFI-001', name: '本地文件包含', category: '文件包含', severity: 'critical',
    patterns: [/(include|require|include_once|require_once)\s*\(\s*['"]?\$/i, /php:\/\/filter/i, /php:\/\/input/i],
    description: '检测到本地文件包含攻击',
    remediation: '使用白名单限制可包含文件'
  },
  {
    id: 'LFI-002', name: '远程文件包含', category: '文件包含', severity: 'critical',
    patterns: [/(include|require)\s*\(\s*['"]?https?:\/\//i, /(include|require)\s*\(\s*['"]?ftp:\/\//i],
    description: '检测到远程文件包含攻击',
    remediation: '关闭 allow_url_include，使用白名单'
  },
  {
    id: 'LFI-003', name: '日志注入包含', category: '文件包含', severity: 'critical',
    patterns: [/\/var\/log\/(apache2|nginx|httpd)/i, /access\.log/i, /error\.log/i, /\/proc\/self\//i],
    description: '检测到日志注入文件包含',
    remediation: '限制日志文件访问权限'
  },
  {
    id: 'LFI-004', name: '包装器利用', category: '文件包含', severity: 'critical',
    patterns: [/(zlib|data|glob|phar|ssh2|rar|ogg):\/\//i, /convert\.base64/i],
    description: '检测到 PHP 包装器利用',
    remediation: '过滤协议包装器'
  },

  // ---- 文件上传 ----
  {
    id: 'UPLOAD-001', name: 'WebShell 上传', category: '文件上传', severity: 'critical',
    patterns: [/multipart\/form-data.*\.(php|jsp|asp|aspx|cgi|phtml|shtml|htaccess)/i, /filename\s*=\s*['"]?.*\.(php|jsp|asp)/i],
    description: '检测到 WebShell 上传',
    remediation: '限制上传文件类型，使用白名单'
  },
  {
    id: 'UPLOAD-002', name: '双扩展名绕过', category: '文件上传', severity: 'high',
    patterns: [/\.(jpg|png|gif|pdf)\.(php|jsp|asp)/i, /\.(php|jsp|asp)\.(jpg|png|gif)/i],
    description: '检测到双扩展名上传绕过',
    remediation: '仅检查最终扩展名'
  },
  {
    id: 'UPLOAD-003', name: '特殊扩展名', category: '文件上传', severity: 'high',
    patterns: [/\.(exe|msi|bat|cmd|com|scr|pif|vbs|js|ws|wsf)/i],
    description: '检测到可执行文件上传',
    remediation: '禁止上传可执行文件'
  },
  {
    id: 'UPLOAD-004', name: '大文件上传', category: '文件上传', severity: 'medium',
    patterns: [/Content-Length:\s*\d{7,}/i],
    description: '检测到超大文件上传',
    remediation: '限制上传文件大小'
  },

  // ---- WebShell 检测 ----
  {
    id: 'WEBSHELL-001', name: 'PHP WebShell', category: 'WebShell', severity: 'critical',
    patterns: [/(eval|assert|system|passthru|exec|shell_exec|popen|proc_open)\s*\(\s*\$/i, /base64_decode\s*\(\s*\$/i, /\$\{.*\$\{.*\}/],
    description: '检测到 PHP WebShell',
    remediation: '删除 WebShell 文件，检查服务器安全'
  },
  {
    id: 'WEBSHELL-002', name: 'JSP WebShell', category: 'WebShell', severity: 'critical',
    patterns: [/Runtime\.getRuntime\(\)\.exec/i, /ProcessBuilder/i, /<%.*Runtime/i],
    description: '检测到 JSP WebShell',
    remediation: '删除 WebShell 文件，检查服务器安全'
  },
  {
    id: 'WEBSHELL-003', name: '一句话木马', category: 'WebShell', severity: 'critical',
    patterns: [/\<\?php\s*\$\w+\s*=\s*\$/i, /\$\w+\(\$\w+,\s*\$\w+\)/, /\$\{param\[/i],
    description: '检测到一句话木马',
    remediation: '删除木马文件，检查上传漏洞'
  },
  {
    id: 'WEBSHELL-004', name: '冰蝎/蚁剑特征', category: 'WebShell', severity: 'critical',
    patterns: [/behinder/i, /antsword/i, /chopper/i, /caidao/i, /\$key\s*=\s*['"]e45e/i],
    description: '检测到冰蝎/蚁剑/菜刀 WebShell 工具',
    remediation: '删除 WebShell，封禁攻击 IP'
  },
  {
    id: 'WEBSHELL-005', name: 'WebShell 密码', category: 'WebShell', severity: 'high',
    patterns: [/\$\w+\s*=\s*['"]?(cmd|exec|command|pass|password|shell|code)['"]?\s*;/i],
    description: '检测到 WebShell 密码特征',
    remediation: '删除 WebShell 文件'
  },

    // ---- HTTP 请求走私 ----
  {
    id: 'SMUGGLE-001', name: 'CL-TE 走私', category: 'HTTP请求走私', severity: 'critical',
    patterns: [/transfer-encoding:\s*chunked/i, /content-length:\s*\d+.*\r\n.*transfer-encoding/i],
    description: '检测到 CL-TE/TE-CL HTTP 请求走私攻击',
    remediation: '统一前端/后端对 Transfer-Encoding 的处理，拒绝歧义请求'
  },
  {
    id: 'SMUGGLE-002', name: 'Transfer-Encoding 异常', category: 'HTTP请求走私', severity: 'high',
    patterns: [/transfer-encoding:\s*(identity|gzip|deflate|br)\s*chunked/i, /transfer-encoding[^:]*:\s*chunked,\s*chunked/i],
    description: '检测到 Transfer-Encoding 头异常',
    remediation: '严格校验 Transfer-Encoding 头格式'
  },
  {
    id: 'SMUGGLE-003', name: '分块编码异常', category: 'HTTP请求走私', severity: 'high',
    patterns: [/\r\n0\r\n\r\n[A-Z]/i, /^[0-9a-f]+\r\n.*\r\n0\r\n\r\n/i],
    description: '检测到异常分块编码',
    remediation: '严格解析分块编码，拒绝格式异常的请求'
  },

  // ---- 反序列化攻击 ----
  {
    id: 'DESER-001', name: 'Java 反序列化', category: '反序列化攻击', severity: 'critical',
    patterns: [/aced0005/i, /rO0AB/i, /java\.io\.Serializable/i, /java\.lang\.Runtime/i, /ObjectInputStream/i],
    description: '检测到 Java 反序列化攻击特征',
    remediation: '禁用 Java 反序列化，使用白名单过滤类'
  },
  {
    id: 'DESER-002', name: 'PHP 反序列化', category: '反序列化攻击', severity: 'high',
    patterns: [/^O:\d+:"[^"]*"/, /^a:\d+:\{/, /^s:\d+:"/, /unserialize\s*\(/i, /__wakeup|__destruct|__toString/i],
    description: '检测到 PHP 反序列化攻击',
    remediation: '避免使用 unserialize，使用 JSON 替代'
  },

  // ---- JWT 攻击 ----
  {
    id: 'JWT-001', name: 'JWT None 算法', category: 'JWT攻击', severity: 'critical',
    patterns: [/alg["\s]*:["\s]*none/i, /"alg"\s*:\s*"none"/i, /eyJhbGciOiJub25lIi/i],
    description: '检测到 JWT None 算法攻击',
    remediation: '服务端强制验证 JWT 算法，拒绝 none 算法'
  },
  {
    id: 'JWT-002', name: 'JWT 弱密钥', category: 'JWT攻击', severity: 'high',
    patterns: [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.(([A-Za-z0-9_-]{10,})|)/],
    description: '检测到 JWT Token，可能存在弱密钥风险',
    remediation: '使用强密钥签名 JWT，定期轮换密钥'
  },
  {
    id: 'JWT-003', name: 'JWT 异常长度', category: 'JWT攻击', severity: 'medium',
    patterns: [/eyJ[A-Za-z0-9_-]{500,}/],
    description: '检测到异常长度的 JWT Token',
    remediation: '限制 JWT Token 大小，检查 payload 内容'
  },

  // ---- 模板注入 (SSTI) ----
  {
    id: 'SSTI-001', name: 'Jinja2/Twig 模板注入', category: '模板注入', severity: 'critical',
    patterns: [/\{\{.*\}\}/, /\{%.*%\}/, /\{\{7\s*\*\s*7\}\}/, /\{\{config\}\}/i, /\{\{self\}\}/i],
    description: '检测到 Jinja2/Twig 模板注入攻击',
    remediation: '使用沙箱环境渲染模板，过滤特殊字符'
  },
  {
    id: 'SSTI-002', name: 'Freemarker/Velocity 注入', category: '模板注入', severity: 'critical',
    patterns: [/\$\{.*\}/, /#\{.*\}/, /\$\{7\s*\*\s*7\}/, /<#assign/i, /\$\{T\(java/i],
    description: '检测到 Freemarker/Velocity 模板注入',
    remediation: '限制模板引擎执行范围，使用白名单'
  },
  {
    id: 'SSTI-003', name: '模板标签检测', category: '模板注入', severity: 'high',
    patterns: [/\{\{.*system.*\}\}/i, /\{\{.*exec.*\}\}/i, /\{\{.*import.*\}\}/i, /\$\{Runtime/i],
    description: '检测到模板注入中的命令执行特征',
    remediation: '禁止模板中调用系统命令'
  },

  // ---- NoSQL 注入 ----
  {
    id: 'NOSQL-001', name: 'MongoDB 注入', category: 'NoSQL注入', severity: 'critical',
    patterns: [/\$gt/i, /\$ne/i, /\$where/i, /\$regex/i, /\$exists/i, /\$nin/i, /{"\$gt"\s*:\s*""}/],
    description: '检测到 MongoDB NoSQL 注入攻击',
    remediation: '使用 MongoDB 驱动的参数化查询，严格校验输入类型'
  },
  {
    id: 'NOSQL-002', name: 'CouchDB 注入', category: 'NoSQL注入', severity: 'high',
    patterns: [/\/_all_docs/i, /\/_find/i, /\$where/i, /\/_view/i, /reduce=false/i],
    description: '检测到 CouchDB NoSQL 注入',
    remediation: '限制 CouchDB API 访问权限'
  },
  {
    id: 'NOSQL-003', name: 'NoSQL 操作符注入', category: 'NoSQL注入', severity: 'high',
    patterns: [/"\$(or|and|not|nor|in|nin|exists|type|mod|regex|text|elemMatch|size)"\s*:/i],
    description: '检测到 NoSQL 操作符注入',
    remediation: '过滤 NoSQL 操作符，校验输入类型'
  },

  // ---- HTTP 头注入 ----
  {
    id: 'HEADER-001', name: 'Host 头注入', category: 'HTTP头注入', severity: 'high',
    patterns: [/Host:\s*[^,\r\n]*[;'"<>(){}[\]\\]/i, /Host:\s*\d+\.\d+\.\d+\.\d+/i],
    description: '检测到 HTTP Host 头注入攻击',
    remediation: '白名单校验 Host 头，使用虚拟主机配置'
  },
  {
    id: 'HEADER-002', name: 'CRLF 注入', category: 'HTTP头注入', severity: 'critical',
    patterns: [/%0[dD]%0[aA]/i, /%0[aA]%0[dD]/i, /\\r\\n/i, /\r\n\s*(Location|Set-Cookie|Content-Type)/i],
    description: '检测到 CRLF 头注入攻击',
    remediation: '过滤 URL 中的换行符，使用安全的 HTTP 客户端库'
  },

  // ---- 开放重定向 ----
  {
    id: 'REDIRECT-001', name: 'URL 重定向参数', category: '开放重定向', severity: 'medium',
    patterns: [/(redirect|redirect_url|redirect_uri|return_url|next|url|goto|target|dest|destination|continue|jump)\s*=\s*https?:\/\/[^&\s]+/i],
    description: '检测到 URL 开放重定向参数',
    remediation: '白名单校验重定向目标 URL'
  },
  {
    id: 'REDIRECT-002', name: 'JavaScript 重定向', category: '开放重定向', severity: 'medium',
    patterns: [/javascript\s*:\s*(location|window\.location|document\.location)/i, /location\s*=\s*["']https?:/i],
    description: '检测到 JavaScript 重定向攻击',
    remediation: '过滤 JavaScript 协议，校验重定向目标'
  },

  // ---- WebShell 补充 ----
  {
    id: 'WEBSHELL-006', name: '内存马特征', category: 'WebShell', severity: 'critical',
    patterns: [/ClassLoader/i, /defineClass/i, /Thread\.currentThread/i, /AbstractTranslet/i, /TemplatesImpl/i],
    description: '检测到内存马（无文件 WebShell）攻击特征',
    remediation: '排查 Java 内存马，重启应用清除'
  },

  // ---- 敏感信息泄露 ----
  {
    id: 'LEAK-001', name: 'API Key 泄露', category: '信息泄露', severity: 'high',
    patterns: [/(api[_-]?key|apikey|access[_-]?key|secret[_-]?key)\s*[:=]\s*['"]?[a-zA-Z0-9]{16,}/i],
    description: '检测到 API Key 泄露',
    remediation: '更换泄露的 API Key'
  },
  {
    id: 'LEAK-002', name: 'Token 泄露', category: '信息泄露', severity: 'high',
    patterns: [/(token|bearer|jwt)\s*[:=]\s*['"]?[a-zA-Z0-9\-_\.]{20,}/i],
    description: '检测到 Token 泄露',
    remediation: '更换泄露的 Token'
  },
  {
    id: 'LEAK-003', name: '邮箱泄露', category: '信息泄露', severity: 'low',
    patterns: [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/],
    description: '检测到邮箱地址泄露',
    remediation: '脱敏处理邮箱地址'
  },
  {
    id: 'LEAK-004', name: '手机号泄露', category: '信息泄露', severity: 'medium',
    patterns: [/(?:\+?86)?1[3-9]\d{9}/],
    description: '检测到手机号泄露',
    remediation: '脱敏处理手机号'
  },
  {
    id: 'LEAK-005', name: '身份证号泄露', category: '信息泄露', severity: 'high',
    patterns: [/\d{17}[\dXx]/],
    description: '检测到身份证号泄露',
    remediation: '脱敏处理身份证号'
  },
  {
    id: 'LEAK-006', name: '内网 IP 泄露', category: '信息泄露', severity: 'medium',
    patterns: [/\b(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/],
    description: '检测到内网 IP 地址泄露',
    remediation: '检查响应中是否泄露了内部网络拓扑'
  },
  {
    id: 'LEAK-007', name: '服务器版本泄露', category: '信息泄露', severity: 'low',
    patterns: [/Server:\s*[A-Za-z]+\/[\d.]+/i, /X-Powered-By:\s*[A-Za-z]+\/[\d.]+/i, /X-AspNet-Version:\s*[\d.]+/i],
    description: '检测到服务器版本信息泄露',
    remediation: '移除或伪装 Server/X-Powered-By 响应头'
  },
  {
    id: 'LEAK-008', name: '调试信息泄露', category: '信息泄露', severity: 'high',
    patterns: [/stack\s*trace/i, /exception\s*in\s*line/i, /at\s+line\s+\d+/i, /debug\s*mode/i, /traceback\s*\(most\s+recent/i, /fatal\s*error/i],
    description: '检测到调试信息泄露',
    remediation: '关闭调试模式，使用自定义错误页面'
  },
]

// ==================== 分析引擎 ====================

export function analyzeWithRules(lines: string[], progressCallback?: (msg: string) => void): RuleAnalysisResult {
  const matches: RuleMatch[] = []
  const categoryStats: Record<string, number> = {}
  const summary = { critical: 0, high: 0, medium: 0, low: 0 }

  const totalLines = lines.length
  progressCallback?.(`规则引擎开始扫描 ${totalLines} 行日志...`)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    for (const rule of RULES) {
      for (const pattern of rule.patterns) {
        // 重置 lastIndex 因为 g 标志
        pattern.lastIndex = 0
        const match = pattern.exec(line)
        if (match) {
          matches.push({
            rule,
            line: line.substring(0, 200),
            lineNumber: i + 1,
            matchedText: match[0],
          })

          summary[rule.severity]++
          categoryStats[rule.category] = (categoryStats[rule.category] || 0) + 1
          break // 每条规则只匹配一次
        }
      }
    }

    // 每 1000 行报告进度
    if (i > 0 && i % 1000 === 0) {
      progressCallback?.(`已扫描 ${i}/${totalLines} 行，发现 ${matches.length} 条告警...`)
    }
  }

  progressCallback?.(`规则扫描完成: 共 ${totalLines} 行，发现 ${matches.length} 条告警`)

  // 生成报告
  const report = generateRuleReport(lines, matches, summary, categoryStats)

  return {
    totalLines,
    matchedLines: new Set(matches.map(m => m.lineNumber)).size,
    matches,
    summary,
    categoryStats,
    report,
  }
}

function generateRuleReport(
  lines: string[],
  matches: RuleMatch[],
  summary: { critical: number; high: number; medium: number; low: number },
  categoryStats: Record<string, number>
): string {
  const now = new Date().toLocaleString()
  const totalThreats = summary.critical + summary.high + summary.medium + summary.low

  let report = `【安全分析报告 - 本地规则引擎】\n\n`
  report += `1. 事件概述\n`
  report += `   • 检测时间：${now}\n`
  report += `   • 分析方式：本地规则引擎匹配\n`
  report += `   • 扫描行数：${lines.length}\n`
  report += `   • 告警总数：${totalThreats}\n`
  report += `   • 置信度：${totalThreats > 0 ? '95%' : 'N/A'}\n\n`

  report += `2. 技术分析\n`
  if (matches.length > 0) {
    // 按类别分组
    const grouped: Record<string, RuleMatch[]> = {}
    for (const m of matches) {
      if (!grouped[m.rule.category]) grouped[m.rule.category] = []
      grouped[m.rule.category].push(m)
    }

    for (const [category, categoryMatches] of Object.entries(grouped)) {
      const uniqueRules = new Set(categoryMatches.map(m => m.rule.id))
      report += `   ▸ ${category} (${categoryMatches.length} 次命中，${uniqueRules.size} 条规则)\n`

      // 显示前 3 条不同规则
      const shownRules = new Set<string>()
      for (const m of categoryMatches) {
        if (shownRules.size >= 3 || shownRules.has(m.rule.id)) continue
        shownRules.add(m.rule.id)
        report += `     - [${m.rule.id}] ${m.rule.name}: ${m.rule.description}\n`
        report += `       行号: ${m.lineNumber}, 匹配: "${m.matchedText.substring(0, 60)}"\n`
      }
      if (categoryMatches.length > 3) {
        report += `     ... 共 ${categoryMatches.length} 条匹配\n`
      }
    }
  } else {
    report += `   未检测到明显攻击特征\n`
  }

  report += `\n3. 风险评估\n`
  report += `   • 危急: ${summary.critical}\n`
  report += `   • 高危: ${summary.high}\n`
  report += `   • 中危: ${summary.medium}\n`
  report += `   • 低危: ${summary.low}\n`

  let riskLevel = '低危'
  if (summary.critical > 0) riskLevel = '危急'
  else if (summary.high > 0) riskLevel = '高危'
  else if (summary.medium > 0) riskLevel = '中危'

  report += `   • 风险等级：${riskLevel}\n`

  report += `\n4. 处置建议\n`
  if (matches.length > 0) {
    const uniqueRules = [...new Set(matches.map(m => m.rule))]
    for (const rule of uniqueRules.slice(0, 5)) {
      report += `   • [${rule.id}] ${rule.name}: ${rule.remediation}\n`
    }
    if (uniqueRules.length > 5) {
      report += `   • ... 共 ${uniqueRules.length} 条建议\n`
    }
  } else {
    report += `   • 当前日志未发现明显威胁，建议持续监控\n`
  }

  report += `\n5. 参考依据\n`
  report += `   • OWASP Top 10 2021\n`
  report += `   • ModSecurity CRS 规则库\n`
  report += `   • MITRE ATT&CK 框架\n`

  return report
}

export { RULES }
