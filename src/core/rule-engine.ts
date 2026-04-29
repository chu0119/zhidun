// 本地规则分析引擎 - 基于 OWASP CRS 规则库
// 参考: ModSecurity CRS v4, OWASP Top 10 2021
// 设计原则: 高置信度检测, 低误报率, 面向 Web 日志分析

export interface Rule {
  id: string
  name: string
  category: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  patterns: RegExp[]
  description: string
  remediation: string
  mitre?: {
    tactic: string
    tacticName: string
    technique?: string
    techniqueName?: string
  }
  cwe?: string
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
  aggregatedAlerts: AggregatedAlert[]
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
// 设计准则:
//   1. 每条规则必须有高置信度, 避免匹配正常流量
//   2. 使用 \b 词边界防止子串误匹配
//   3. 需要多个特征组合时使用 .{0,N} 连接
//   4. 严重级别准确反映实际威胁程度
//   5. 移除过于宽泛的规则 (如匹配所有 POST 请求、所有 HTML 标签等)

export const BUILT_IN_RULES: Rule[] = [

  // =====================================================================
  // SQL 注入 (CWE-89) - 参考 CRS REQUEST-942
  // =====================================================================
  {
    id: 'SQL-001', name: 'UNION SELECT 注入', category: 'SQL注入', severity: 'critical',
    patterns: [
      /\bunion\b.{0,30}\bselect\b/i,                    // UNION ... SELECT (允许中间有空白/注释)
      /\bunion\b.{0,20}\b(all|distinct)\b.{0,10}\bselect\b/i,  // UNION ALL SELECT
    ],
    description: '检测到 UNION SELECT 联合查询注入攻击',
    remediation: '使用参数化查询，部署 WAF 规则拦截 UNION SELECT'
  },
  {
    id: 'SQL-002', name: '布尔盲注', category: 'SQL注入', severity: 'critical',
    patterns: [
      /'\s*(or|and)\s+'[^']*'\s*=\s*'[^']*'/i,         // 'or 'a'='a'
      /'\s*(or|and)\s+\d+\s*=\s*\d+/i,                  // 'or 1=1
      /\b(or|and)\b\s+\d+\s*=\s*\d+\s*(--|#|\/\*)/i,   // or 1=1 --
      /'\s*(or|and)\s+true\b/i,                           // 'or true
      /'\s*;\s*(or|and)\s+/i,                             // '; or
    ],
    description: '检测到布尔盲注攻击特征',
    remediation: '使用参数化查询，过滤特殊字符'
  },
  {
    id: 'SQL-003', name: '时间盲注', category: 'SQL注入', severity: 'critical',
    patterns: [
      /\bsleep\s*\(\s*\d+\s*\)/i,                       // sleep(N)
      /\bbenchmark\s*\(\s*\d+/i,                         // benchmark(N,...)
      /\bwaitfor\s+delay\b/i,                            // WAITFOR DELAY
      /\bpg_sleep\s*\(/i,                                // pg_sleep()
      /\bdbms_lock\.sleep\s*\(/i,                        // dbms_lock.sleep()
      /\bselect\b.*\bfrom\b.*\bsleep\b/i,               // select ... from ... sleep
    ],
    description: '检测到时间盲注攻击',
    remediation: '限制数据库查询超时时间，使用参数化查询'
  },
  {
    id: 'SQL-004', name: '报错注入', category: 'SQL注入', severity: 'high',
    patterns: [
      /\bextractvalue\s*\(/i,                            // extractvalue()
      /\bupdatexml\s*\(/i,                               // updatexml()
      /\bfloor\s*\(\s*\brand\s*\(/i,                     // floor(rand())
      /\bexp\s*\(\s*~/i,                                 // exp(~)
      /\bcount\s*\(\s*\*\s*\).{0,30}\bgroup\s+by\b/i,   // count(*) ... group by (error-based)
    ],
    description: '检测到报错注入攻击',
    remediation: '关闭数据库错误回显，使用参数化查询'
  },
  {
    id: 'SQL-005', name: '堆叠注入', category: 'SQL注入', severity: 'critical',
    patterns: [
      /;\s*(drop|truncate)\s+(table|database)\b/i,       // ; DROP TABLE
      /;\s*delete\s+from\b/i,                            // ; DELETE FROM
      /;\s*insert\s+into\b/i,                            // ; INSERT INTO
      /;\s*update\b.*\bset\b/i,                          // ; UPDATE ... SET
      /;\s*exec\s*\(/i,                                  // ; exec(
      /;\s*create\s+(table|user|procedure)\b/i,          // ; CREATE TABLE
    ],
    description: '检测到堆叠注入攻击',
    remediation: '禁止多语句执行，使用参数化查询'
  },
  {
    id: 'SQL-006', name: '注释绕过注入', category: 'SQL注入', severity: 'high',
    patterns: [
      /\/\*!?\s*(union|select|insert|update|delete|drop|alter)\b/i,  // /*!union*/
      /\bunion\b.*\/\*\*\//i,                           // union/**/
      /'\s*(or|and)\s+.*\/\*\//i,                        // 'or ... /**/
    ],
    description: '检测到 SQL 注释绕过攻击',
    remediation: '过滤注释符号，使用参数化查询'
  },
  {
    id: 'SQL-007', name: '系统存储过程注入', category: 'SQL注入', severity: 'critical',
    patterns: [
      /\bxp_cmdshell\b/i,                               // xp_cmdshell
      /\bsp_executesql\b/i,                             // sp_executesql
      /\binformation_schema\b/i,                        // information_schema
      /\bload_file\s*\(/i,                              // load_file()
      /\binto\s+(outfile|dumpfile)\b/i,                 // into outfile/dumpfile
      /\bunhex\s*\(/i,                                  // unhex()
      /\bchar\s*\(\s*\d+(\s*,\s*\d+){3,}\s*\)/i,       // char(104,116,116,112) - hex decode
    ],
    description: '检测到系统存储过程/函数注入',
    remediation: '过滤 SQL 关键字，限制数据库权限'
  },
  {
    id: 'SQL-008', name: '自动化注入工具', category: 'SQL注入', severity: 'high',
    patterns: [
      /\bsqlmap\b/i,                                     // sqlmap
      /\bhavij\b/i,                                      // havij
      /\bnetsparker\b/i,                                 // netsparker
    ],
    description: '检测到自动化 SQL 注入工具',
    remediation: '封禁来源 IP，部署 WAF'
  },

  // =====================================================================
  // XSS 攻击 (CWE-79) - 参考 CRS REQUEST-941
  // =====================================================================
  {
    id: 'XSS-001', name: 'Script 标签注入', category: 'XSS攻击', severity: 'critical',
    patterns: [
      /<script[\s>]/i,                                   // <script> or <script
      /<script\b[^>]*\bsrc\s*=/i,                        // <script src=
      /<\/script\s*>/i,                                  // </script>
    ],
    description: '检测到 Script 标签 XSS 注入',
    remediation: '对输出进行 HTML 编码，设置 CSP 策略'
  },
  {
    id: 'XSS-002', name: '事件处理器 XSS', category: 'XSS攻击', severity: 'high',
    patterns: [
      /\bon(error|load|click|focus|blur|mouse\w+|key\w+|abort|resize|scroll|submit|reset|select|change|input|invalid|search|touch\w+|pointer\w+)\s*=\s*[^>\s]/i,
      /\bon\w+\s*=\s*["']?[^"'>\s]{3,}/i,               // onXXX= with value (3+ chars)
    ],
    description: '检测到事件处理器型 XSS 攻击',
    remediation: '过滤事件属性，设置 CSP 策略'
  },
  {
    id: 'XSS-003', name: 'URL 编码 XSS', category: 'XSS攻击', severity: 'high',
    patterns: [
      /%3[cC]\s*script/i,                                // %3Cscript
      /%3[cC]\s*img/i,                                   // %3Cimg
      /%3[cC]\s*iframe/i,                                // %3Ciframe
      /%3[cC]\s*svg/i,                                   // %3Csvg
      /%3[cC]\s*body/i,                                  // %3Cbody
      /%3[cC]\s*embed/i,                                 // %3Cembed
      /javascript\s*:/i,                                 // javascript:
      /vbscript\s*:/i,                                   // vbscript:
    ],
    description: '检测到 URL 编码型 XSS 攻击',
    remediation: '多层解码后再过滤'
  },
  {
    id: 'XSS-004', name: 'DOM 操作 XSS', category: 'XSS攻击', severity: 'high',
    patterns: [
      /document\s*\.\s*(cookie|location|write|domain)\b/i,  // document.cookie/location
      /\.innerHTML\s*=/i,                                // .innerHTML=
      /\beval\s*\(\s*document/i,                         // eval(document...)
      /\bdocument\s*\.\s*createElement\s*\(\s*['"]script/i,  // createElement('script')
    ],
    description: '检测到 DOM 型 XSS 攻击',
    remediation: '避免使用 innerHTML，使用 textContent'
  },
  {
    id: 'XSS-005', name: 'SVG/Img 标签 XSS', category: 'XSS攻击', severity: 'high',
    patterns: [
      /<svg\b[^>]*\bon\w+\s*=/i,                        // <svg onload=
      /<svg\b[^>]*>.*?<script/i,                         // <svg>...<script>
      /<img\b[^>]*\bonerror\s*=/i,                       // <img onerror=
      /<iframe\b[^>]*\bsrc\s*=\s*["']?javascript/i,     // <iframe src=javascript:
      /<details\b[^>]*\bon\w+\s*=/i,                    // <details ontoggle=
    ],
    description: '检测到 SVG/HTML 标签型 XSS 攻击',
    remediation: '过滤 HTML 标签，设置 CSP 策略'
  },
  {
    id: 'XSS-006', name: 'data: 协议 XSS', category: 'XSS攻击', severity: 'high',
    patterns: [
      /data\s*:\s*text\/html/i,                          // data:text/html
      /data\s*:\s*text\/html;\s*base64/i,                // data:text/html;base64
    ],
    description: '检测到 data: 协议 XSS',
    remediation: '过滤 data: 协议'
  },

  // =====================================================================
  // 命令注入 (CWE-78) - 参考 CRS REQUEST-932
  // =====================================================================
  {
    id: 'CMD-001', name: 'Shell 命令执行', category: '命令注入', severity: 'critical',
    patterns: [
      /;\s*(cat|ls|whoami|id|pwd|uname|ifconfig|netstat|ip\s+addr|hostname)\s/i,
      /\|\s*(cat|ls|whoami|id|pwd|uname)\b/i,
      /`[^`]{3,}`/,                                       // `command` (backticks, 3+ chars)
      /\$\([^)]{3,}\)/,                                   // $(command)
    ],
    description: '检测到系统命令注入',
    remediation: '禁止调用系统命令，使用白名单校验'
  },
  {
    id: 'CMD-002', name: '反弹 Shell', category: '命令注入', severity: 'critical',
    patterns: [
      /\/dev\/tcp\//i,                                   // /dev/tcp/
      /\bnc\s+-[elv]/i,                                  // nc -e/-l/-v
      /\bmkfifo\b/i,                                    // mkfifo
      /\bbash\s+-i\b/i,                                  // bash -i
      /\bpython\b.*\bsocket\b/i,                         // python socket
      /\bperl\b.*\bsocket\b/i,                           // perl socket
      /\bphp\b.*\bfsockopen\b/i,                         // php fsockopen
    ],
    description: '检测到反弹 Shell 攻击',
    remediation: '封禁外连端口，限制网络访问'
  },
  {
    id: 'CMD-003', name: '命令注入工具', category: '命令注入', severity: 'high',
    patterns: [
      /\bcommix\b/i,                                     // commix
      /\breGeorg\b/i,                                    // reGeorg
      /\breDuh\b/i,                                      // reDuh
    ],
    description: '检测到命令注入工具',
    remediation: '封禁来源 IP'
  },
  {
    id: 'CMD-004', name: 'DNSLog 外带', category: '命令注入', severity: 'high',
    patterns: [
      /dnslog\.cn/i,                                     // dnslog.cn
      /\bceye\.io\b/i,                                   // ceye.io
      /\boast\.(fun|pro|site|online|live)\b/i,           // oast.fun etc.
      /\binteract\.sh\b/i,                               // interact.sh
      /\bburpcollaborator\b/i,                           // burpcollaborator
    ],
    description: '检测到 DNSlog/带外数据外带攻击',
    remediation: '限制出站 DNS 请求，监控异常域名解析'
  },
  {
    id: 'CMD-005', name: '环境变量注入', category: '命令注入', severity: 'high',
    patterns: [
      /\$\{.*\$\{/,                                      // ${...${...  (nested)
      /\$\{IFS\}/i,                                      // ${IFS}
      /\$\{PATH\}/i,                                     // ${PATH}
    ],
    description: '检测到环境变量注入',
    remediation: '过滤环境变量引用'
  },

  // =====================================================================
  // 目录遍历 (CWE-22) - 参考 CRS REQUEST-930
  // =====================================================================
  {
    id: 'DIR-001', name: '路径穿越', category: '目录遍历', severity: 'critical',
    patterns: [
      /\.\.\//g,                                         // ../ (with g flag for multiple matches)
      /\.\.\\/g,                                         // ..\
      /%2e%2e(%2f|%5c)/i,                                // %2e%2e%2f
      /%252e%252e%252f/i,                                // double-encoded
      /\.\.%00/i,                                        // ..%00 (null byte)
      /\.\.%2f/i,                                        // ..%2f
      /\.\.%5c/i,                                        // ..%5c
      /%c0%ae%c0%ae/i,                                   // UTF-8 overlong
      /%c1%9c/i,                                         // UTF-8 overlong
    ],
    description: '检测到目录遍历攻击',
    remediation: '使用 chroot 限制访问范围，校验路径'
  },
  {
    id: 'DIR-002', name: '敏感系统文件访问', category: '目录遍历', severity: 'critical',
    patterns: [
      /\/etc\/passwd/i,                                  // /etc/passwd
      /\/etc\/shadow/i,                                  // /etc/shadow
      /\/etc\/hosts/i,                                   // /etc/hosts
      /\/etc\/(issue|motd|resolv\.conf)/i,               // /etc/issue etc.
      /\bboot\.ini\b/i,                                  // boot.ini
      /\bwin\.ini\b/i,                                   // win.ini
      /\/windows\/system32/i,                            // /windows/system32
    ],
    description: '检测到敏感系统文件访问尝试',
    remediation: '限制文件访问权限，部署 WAF'
  },
  {
    id: 'DIR-003', name: '配置文件读取', category: '目录遍历', severity: 'high',
    patterns: [
      /\/\.env\b/,                                       // /.env
      /\/\.htaccess\b/i,                                 // /.htaccess
      /\/\.htpasswd\b/i,                                 // /.htpasswd
      /\/web\.config\b/i,                                // /web.config
      /\/wp-config\.php\b/i,                             // /wp-config.php
      /\/config\.php\b/i,                                // /config.php
      /\/settings\.py\b/i,                               // /settings.py
      /\/application\.yml\b/i,                           // /application.yml
    ],
    description: '检测到配置文件读取尝试',
    remediation: '将配置文件移出 web 目录'
  },
  {
    id: 'DIR-004', name: '编码绕过遍历', category: '目录遍历', severity: 'high',
    patterns: [
      /%c0%ae%c0%ae/i,                                   // overlong UTF-8
      /\.\.%00.*\//i,                                    // ..%00/
      /\.\.\%00/i,                                       // ..%00
    ],
    description: '检测到编码绕过目录遍历',
    remediation: '规范化路径后再校验'
  },

  // =====================================================================
  // SSRF 攻击 (CWE-918) - 参考 CRS REQUEST-931
  // =====================================================================
  {
    id: 'SSRF-001', name: '内网地址探测', category: 'SSRF攻击', severity: 'critical',
    patterns: [
      /https?:\/\/127\.0\.0\.1/i,                        // http://127.0.0.1
      /https?:\/\/localhost\b/i,                         // http://localhost
      /https?:\/\/0\.0\.0\.0/i,                          // http://0.0.0.0
      /https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}/i,      // 10.x.x.x
      /https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}/i,  // 172.16-31.x.x
      /https?:\/\/192\.168\.\d{1,3}\.\d{1,3}/i,         // 192.168.x.x
    ],
    description: '检测到 SSRF 内网探测',
    remediation: '限制出站请求目标，使用白名单'
  },
  {
    id: 'SSRF-002', name: '云元数据探测', category: 'SSRF攻击', severity: 'critical',
    patterns: [
      /169\.254\.169\.254/i,                             // AWS/GCP metadata
      /metadata\.google\.internal/i,                     // GCP metadata
      /\[fd00::ec2\]/i,                                  // AWS IPv6 metadata
      /\/latest\/meta-data\//i,                          // AWS metadata path
      /\/computeMetadata\/v1/i,                          // GCP metadata path
    ],
    description: '检测到云元数据 SSRF 攻击',
    remediation: '限制访问元数据地址，使用 IMDSv2'
  },
  {
    id: 'SSRF-003', name: '协议型 SSRF', category: 'SSRF攻击', severity: 'critical',
    patterns: [
      /\bfile:\/\//i,                                    // file://
      /\bgopher:\/\//i,                                  // gopher://
      /\bdict:\/\//i,                                    // dict://
      /php:\/\/input/i,                                  // php://input
      /php:\/\/filter/i,                                 // php://filter
      /\bexpect:\/\//i,                                  // expect://
    ],
    description: '检测到协议型 SSRF 攻击',
    remediation: '限制出站协议，仅允许 http/https'
  },

  // =====================================================================
  // 文件包含 (CWE-98) - 参考 CRS REQUEST-930/931
  // =====================================================================
  {
    id: 'LFI-001', name: 'PHP 包装器利用', category: '文件包含', severity: 'critical',
    patterns: [
      /php:\/\/filter/i,                                 // php://filter
      /php:\/\/input/i,                                  // php://input
      /php:\/\/data/i,                                   // php://data
      /\b(zlib|glob|phar|ssh2|rar|ogg):\/\//i,          // wrapper://
      /convert\.base64/i,                                // convert.base64
    ],
    description: '检测到 PHP 包装器文件包含利用',
    remediation: '过滤协议包装器'
  },
  {
    id: 'LFI-002', name: '日志注入包含', category: '文件包含', severity: 'critical',
    patterns: [
      /\/var\/log\/(apache2|nginx|httpd|auth\.log)/i,   // log file paths
      /\/proc\/self\//i,                                 // /proc/self/
      /\/proc\/version\b/i,                              // /proc/version
    ],
    description: '检测到日志注入/proc 文件包含',
    remediation: '限制日志文件和 /proc 访问权限'
  },

  // =====================================================================
  // 模板注入 SSTI (CWE-1336)
  // =====================================================================
  {
    id: 'SSTI-001', name: '模板注入检测', category: '模板注入', severity: 'critical',
    patterns: [
      /\{\{7\s*\*\s*7\}\}/,                             // {{7*7}} (classic test)
      /\{\{config\}\}/i,                                 // {{config}}
      /\{\{self\}\}/i,                                   // {{self}}
      /\{\{.*\bclass\b.*\b__mro__\b/i,                  // {{...class...__mro__}}
      /\{\{.*\b__globals__\b/i,                          // {{...__globals__}}
      /\{\{.*\bimport\b.*\}\}/i,                         // {{import...}}
      /\{\{.*\b(os|subprocess|system|exec|eval)\b.*\}\}/i, // {{os/subprocess/...}}
    ],
    description: '检测到服务端模板注入攻击',
    remediation: '使用沙箱环境渲染模板，过滤特殊字符'
  },
  {
    id: 'SSTI-002', name: '表达式注入', category: '模板注入', severity: 'critical',
    patterns: [
      /\$\{T\s*\(\s*java/i,                              // ${T(java.lang.Runtime)}
      /\$\{\s*\d+\s*\*\s*\d+\s*\}/,                      // ${7*7}
      /#\{.*\bRuntime\b/i,                               // #{Runtime}
      /#\{.*\bProcessBuilder\b/i,                        // #{ProcessBuilder}
    ],
    description: '检测到表达式语言注入',
    remediation: '限制模板引擎执行范围，使用白名单'
  },

  // =====================================================================
  // Log4j / JNDI 注入 (CWE-502) - CVE-2021-44228
  // =====================================================================
  {
    id: 'LOG4J-001', name: 'Log4Shell JNDI 注入', category: 'Log4j注入', severity: 'critical',
    patterns: [
      /\$\{jndi:(ldap|rmi|dns|ldaps|iiop|corba|nds|http):\/\//i,
      /\$\{jndi:/i,
    ],
    description: '检测到 Log4Shell (CVE-2021-44228) JNDI 注入攻击',
    remediation: '升级 Log4j 至 2.17.0+，设置 log4j2.formatMsgNoLookups=true'
  },
  {
    id: 'LOG4J-002', name: 'Log4j 编码绕过', category: 'Log4j注入', severity: 'critical',
    patterns: [
      /%24%7Bjndi/i,                                     // ${jndi URL-encoded
      /\$\{lower:j\$\{lower:n\$\{lower:d/i,             // ${lower:j${lower:n${lower:d
      /\$\{::-j\$\{::-n\$\{::-d/i,                      // ${::-j${::-n${::-d
      /\$\{[^}]*jndi[^}]*:/i,                           // ${...jndi...:}
    ],
    description: '检测到 Log4j 编码绕过攻击',
    remediation: '升级 Log4j 至 2.17.0+，WAF 规则需覆盖编码变体'
  },
  {
    id: 'LOG4J-003', name: 'Log4j 查找注入', category: 'Log4j注入', severity: 'high',
    patterns: [
      /\$\{(env|sys|lower|upper|date|::-):/i,            // ${env:} ${sys:} etc.
    ],
    description: '检测到 Log4j 查找注入',
    remediation: '升级 Log4j 至 2.17.0+'
  },

  // =====================================================================
  // 反序列化攻击 (CWE-502)
  // =====================================================================
  {
    id: 'DESER-001', name: 'Java 反序列化', category: '反序列化攻击', severity: 'critical',
    patterns: [
      /\baced0005\b/i,                                   // Java serialized magic
      /\brO0AB\b/i,                                      // Base64 Java serialized
      /\bjavax?\.(xml\.bind|faces)\b/i,                  // JAXB/Faces deserialization
    ],
    description: '检测到 Java 反序列化攻击特征',
    remediation: '禁用 Java 反序列化，使用白名单过滤类'
  },
  {
    id: 'DESER-002', name: 'PHP 反序列化', category: '反序列化攻击', severity: 'high',
    patterns: [
      /^O:\d+:"[^"]*"/,                                  // O:N:"ClassName"
      /\bunserialize\s*\(/i,                             // unserialize()
    ],
    description: '检测到 PHP 反序列化攻击',
    remediation: '避免使用 unserialize，使用 JSON 替代'
  },
  {
    id: 'DESER-003', name: '.NET 反序列化', category: '反序列化攻击', severity: 'critical',
    patterns: [
      /\bObjectStateFormatter\b/i,                       // ObjectStateFormatter
      /\bLosFormatter\b/i,                               // LosFormatter
      /\bBinaryFormatter\b/i,                            // BinaryFormatter
      /\bTypeNameHandling\b/i,                           // TypeNameHandling
    ],
    description: '检测到 .NET 反序列化攻击',
    remediation: '避免使用 BinaryFormatter，使用安全的序列化方式'
  },

  // =====================================================================
  // WebShell 检测 (CWE-94)
  // =====================================================================
  {
    id: 'WEBSHELL-001', name: 'PHP WebShell', category: 'WebShell', severity: 'critical',
    patterns: [
      /\beval\s*\(\s*\$_(GET|POST|REQUEST|COOKIE)\b/i,   // eval($_GET)
      /\bbase64_decode\s*\(\s*\$/i,                      // base64_decode($)
      /\bsystem\s*\(\s*\$/i,                             // system($)
      /\bpassthru\s*\(\s*\$/i,                           // passthru($)
      /\bshell_exec\s*\(\s*\$/i,                         // shell_exec($)
      /\bexec\s*\(\s*\$/i,                               // exec($)
      /\bpopen\s*\(\s*\$/i,                              // popen($)
      /\bproc_open\s*\(\s*\$/i,                          // proc_open($)
    ],
    description: '检测到 PHP WebShell 特征代码',
    remediation: '删除 WebShell 文件，检查上传漏洞，部署 WAF'
  },
  {
    id: 'WEBSHELL-002', name: 'JSP WebShell', category: 'WebShell', severity: 'critical',
    patterns: [
      /Runtime\.getRuntime\(\)\.exec/i,                  // Runtime.exec
      /ProcessBuilder.*\.start\(\)/i,                    // ProcessBuilder.start()
      /request\.getParameter.*Runtime/i,                 // request.getParameter...Runtime
    ],
    description: '检测到 JSP WebShell 特征代码',
    remediation: '删除 WebShell 文件，限制上传目录执行权限'
  },
  {
    id: 'WEBSHELL-003', name: 'WebShell 工具特征', category: 'WebShell', severity: 'critical',
    patterns: [
      /\b(behinder|冰蝎)\b/i,                            // 冰蝎
      /\b(antsword|蚁剑)\b/i,                            // 蚁剑
      /\b(godzilla|哥斯拉)\b/i,                          // 哥斯拉
      /\bchopper\b/i,                                    // chopper (菜刀)
      /\bcaidao\b/i,                                     // 菜刀
    ],
    description: '检测到常见 WebShell 管理工具特征',
    remediation: '删除 WebShell，检查服务器权限，排查入侵路径'
  },
  {
    id: 'WEBSHELL-004', name: 'WebShell 文件上传', category: 'WebShell', severity: 'critical',
    patterns: [
      /Content-Disposition.*\.(php|jsp|asp|aspx|cgi|phtml|phar)\b/i,
      /multipart\/form-data.*\.(php|jsp|asp|aspx)\b/i,
    ],
    description: '检测到疑似 WebShell 文件上传',
    remediation: '限制上传文件类型，禁止上传目录执行脚本'
  },
  {
    id: 'WEBSHELL-005', name: '一句话木马', category: 'WebShell', severity: 'critical',
    patterns: [
      /\<\?php\s*\$\w+\s*=\s*\$_(GET|POST|REQUEST)/i,   // <?php $x=$_POST
      /\$\w+\s*\(\s*\$\w+\s*\.\s*\$\w+\s*\)/,            // $a($b.$c) pattern
      /\$\{param\[/i,                                    // ${param[ (JSP)
    ],
    description: '检测到一句话木马',
    remediation: '删除木马文件，检查上传漏洞'
  },

  // =====================================================================
  // JWT 攻击 (CWE-287)
  // =====================================================================
  {
    id: 'JWT-001', name: 'JWT None 算法', category: 'JWT攻击', severity: 'critical',
    patterns: [
      /["\s]alg["\s]*:["\s]*none["\s}]/i,               // "alg":"none"
      /eyJhbGciOiJub25lIi/i,                             // base64({"alg":"none"
    ],
    description: '检测到 JWT None 算法攻击',
    remediation: '服务端强制验证 JWT 算法，拒绝 none 算法'
  },
  {
    id: 'JWT-002', name: 'JWT 异常长度', category: 'JWT攻击', severity: 'medium',
    patterns: [
      /eyJ[A-Za-z0-9_-]{1000,}/,                        // JWT with 1000+ chars in header
    ],
    description: '检测到异常长度的 JWT Token',
    remediation: '限制 JWT Token 大小，检查 payload 内容'
  },

  // =====================================================================
  // HTTP 请求走私 (CWE-444)
  // =====================================================================
  {
    id: 'SMUGGLE-001', name: 'Transfer-Encoding 异常', category: 'HTTP请求走私', severity: 'critical',
    patterns: [
      /transfer-encoding\s*:\s*(identity|gzip|deflate|br)\s*chunked/i,
      /transfer-encoding[^:]*:\s*chunked\s*,\s*chunked/i,
      /transfer-encoding\s*:\s*[\w\s,]*chunked[\s,]*chunked/i,
    ],
    description: '检测到 Transfer-Encoding 头异常（请求走私）',
    remediation: '严格校验 Transfer-Encoding 头格式'
  },

  // =====================================================================
  // CRLF 注入 (CWE-113)
  // =====================================================================
  {
    id: 'CRLF-001', name: 'CRLF 头注入', category: 'HTTP头注入', severity: 'critical',
    patterns: [
      /%0[dD]%0[aA]/i,                                  // %0D%0A
      /%0[aA]%0[dD]/i,                                  // %0A%0D
      /\r\n\s*(Location|Set-Cookie|Content-Type)\s*:/i,  // \r\nHeader:
    ],
    description: '检测到 CRLF 头注入攻击',
    remediation: '过滤 URL 中的换行符，使用安全的 HTTP 客户端库'
  },
  {
    id: 'CRLF-002', name: 'Host 头注入', category: 'HTTP头注入', severity: 'high',
    patterns: [
      /Host:\s*[^,\r\n]*[;'"<>(){}[\]\\]/i,             // Host with special chars
    ],
    description: '检测到 HTTP Host 头注入攻击',
    remediation: '白名单校验 Host 头，使用虚拟主机配置'
  },

  // =====================================================================
  // 漏洞利用框架 / 攻击工具
  // =====================================================================
  {
    id: 'TOOL-001', name: '漏洞利用框架', category: '攻击工具', severity: 'critical',
    patterns: [
      /\bmetasploit\b/i,                                // Metasploit
      /\bcobalt\s*strike\b/i,                           // Cobalt Strike
      /\bmeterpreter\b/i,                               // Meterpreter
      /\bempire\b/i,                                    // Empire
      /\bcovenant\b/i,                                  // Covenant
      /\bmsfconsole\b/i,                                // msfconsole
    ],
    description: '检测到漏洞利用框架攻击',
    remediation: '立即封禁来源 IP，全面排查系统安全'
  },
  {
    id: 'TOOL-002', name: '漏洞扫描器', category: '攻击工具', severity: 'medium',
    patterns: [
      /\bnikto\b/i,                                     // Nikto
      /\bnuclei\b/i,                                    // Nuclei
      /\bdirsearch\b/i,                                 // dirsearch
      /\bgobuster\b/i,                                  // gobuster
      /\bffuf\b/i,                                      // ffuf
      /\bdirbuster\b/i,                                 // DirBuster
      /\bferoxbuster\b/i,                               // feroxbuster
      /\bwfuzz\b/i,                                     // wfuzz
    ],
    description: '检测到漏洞/目录扫描器',
    remediation: '封禁来源 IP，部署 WAF'
  },
  {
    id: 'TOOL-003', name: '专业扫描工具', category: '攻击工具', severity: 'medium',
    patterns: [
      /\bburpsuite\b/i,                                 // Burp Suite
      /\bacunetix\b/i,                                  // Acunetix
      /\bw3af\b/i,                                      // w3af
      /\bowasp\s*zap\b/i,                               // OWASP ZAP
    ],
    description: '检测到专业安全扫描工具',
    remediation: '封禁来源 IP'
  },

  // =====================================================================
  // Spring 漏洞 (CWE-94)
  // =====================================================================
  {
    id: 'SPRING-001', name: 'Spring4Shell RCE', category: 'Spring漏洞', severity: 'critical',
    patterns: [
      /class\.module\.classLoader/i,                     // class.module.classLoader
      /class\.module\.classLoader\.resources/i,
    ],
    description: '检测到 Spring4Shell (CVE-2022-22965) RCE 攻击',
    remediation: '升级 Spring Framework 至 5.3.18+ / 5.2.20+'
  },
  {
    id: 'SPRING-002', name: 'Spring Cloud Function SpEL', category: 'Spring漏洞', severity: 'critical',
    patterns: [
      /spring\.cloud\.function/i,                        // spring.cloud.function
      /\bfunctionRouter\b/i,                             // functionRouter
    ],
    description: '检测到 Spring Cloud Function (CVE-2022-22963) SpEL 注入',
    remediation: '升级 spring-cloud-function 至 3.2.3+'
  },
  {
    id: 'SPRING-003', name: 'Spring Actuator 未授权', category: 'Spring漏洞', severity: 'high',
    patterns: [
      /\/actuator(\/|$)/i,                              // /actuator
      /\/heapdump(\/|$)/i,                              // /heapdump
      /\/env\b(\/|$)/i,                                 // /env
      /\/mappings(\/|$)/i,                              // /mappings
      /\/configprops(\/|$)/i,                           // /configprops
      /\/beans(\/|$)/i,                                 // /beans
    ],
    description: '检测到 Spring Actuator 端点未授权访问',
    remediation: '限制 Actuator 端点访问，配置 management.endpoints.web.exposure.include'
  },

  // =====================================================================
  // 敏感文件访问 (CWE-538)
  // =====================================================================
  {
    id: 'SENSITIVE-001', name: '版本控制文件泄露', category: '敏感文件', severity: 'high',
    patterns: [
      /\/\.git(\/|$)/i,                                 // /.git/
      /\/\.svn(\/|$)/i,                                 // /.svn/
      /\/\.hg(\/|$)/i,                                  // /.hg/
      /\/\.DS_Store\b/i,                                // /.DS_Store
    ],
    description: '检测到版本控制目录/文件访问',
    remediation: '删除 Web 目录中的 .git/.svn 等目录'
  },
  {
    id: 'SENSITIVE-002', name: '备份文件探测', category: '敏感文件', severity: 'medium',
    patterns: [
      /\.(bak|old|backup|orig|save|swp)\b/i,            // .bak .old .backup
      /\.(sql\.gz|tar\.gz|tar\.bz2)\b/i,               // .sql.gz .tar.gz
      /\/(backup|dump|export)\//i,                       // /backup/ /dump/
      /\/dump\.sql\b/i,                                  // /dump.sql
    ],
    description: '检测到备份文件探测',
    remediation: '删除不必要的备份文件，配置访问控制'
  },
  {
    id: 'SENSITIVE-003', name: '调试端点访问', category: '敏感文件', severity: 'medium',
    patterns: [
      /\/phpinfo\b/i,                                    // /phpinfo
      /\/server-status\b/i,                              // /server-status
      /\/server-info\b/i,                                // /server-info
      /\/_profiler\b/i,                                  // /_profiler
      /\/debug_console\b/i,                              // /debug_console
    ],
    description: '检测到调试/测试端点访问',
    remediation: '生产环境禁用调试端点，配置访问白名单'
  },

  // =====================================================================
  // 爬虫/Bot 检测
  // =====================================================================
  {
    id: 'BOT-001', name: '自动化工具 UA', category: '爬虫Bot', severity: 'low',
    patterns: [
      /HeadlessChrome/i,                                 // HeadlessChrome
      /\bPhantomJS\b/i,                                  // PhantomJS
      /\bSelenium\b/i,                                   // Selenium
      /\bwebdriver\b/i,                                  // webdriver
      /\bpuppeteer\b/i,                                  // puppeteer
      /\bplaywright\b/i,                                 // playwright
    ],
    description: '检测到无头浏览器/自动化工具',
    remediation: '部署 Bot 检测（如 reCAPTCHA），检查自动化行为特征'
  },
  {
    id: 'BOT-002', name: 'AI 爬虫', category: '爬虫Bot', severity: 'low',
    patterns: [
      /\b(GPTBot|ChatGPT-User|ClaudeBot|CCBot|Google-Extended|Bytespider)\b/i,
    ],
    description: '检测到 AI 训练数据抓取爬虫',
    remediation: '在 robots.txt 中禁止 AI 训练爬虫'
  },

  // =====================================================================
  // 信息泄露 (CWE-200)
  // =====================================================================
  {
    id: 'LEAK-001', name: 'AWS 密钥泄露', category: '信息泄露', severity: 'critical',
    patterns: [
      /AKIA[0-9A-Z]{16}/i,                              // AWS Access Key ID
      /\baws_secret_access_key\b/i,                     // aws_secret_access_key
    ],
    description: '检测到 AWS 密钥泄露',
    remediation: '立即轮换泄露的 AWS 密钥'
  },
  {
    id: 'LEAK-002', name: '调试信息泄露', category: '信息泄露', severity: 'high',
    patterns: [
      /\bstack\s*trace\b/i,                             // stack trace
      /\bexception\s+in\s+line\b/i,                     // exception in line
      /\btraceback\s*\(\s*most\s+recent\b/i,           // Traceback (most recent)
      /\bfatal\s+error\b/i,                             // Fatal error
      /\bdebug\s*mode\b/i,                              // debug mode
    ],
    description: '检测到调试信息泄露',
    remediation: '关闭调试模式，使用自定义错误页面'
  },
  {
    id: 'LEAK-003', name: '内网信息泄露', category: '信息泄露', severity: 'medium',
    patterns: [
      /\b(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b.*\b(password|secret|token|key)\b/i,
    ],
    description: '检测到内网 IP 伴随敏感凭据泄露',
    remediation: '检查响应中是否泄露了内部凭据'
  },

  // =====================================================================
  // 暴力破解 (CWE-307)
  // =====================================================================
  {
    id: 'BRUTE-001', name: '认证爆破工具', category: '暴力破解', severity: 'high',
    patterns: [
      /\bhydra\b/i,                                      // Hydra
      /\bmedusa\b/i,                                     // Medusa
      /\bthc-hydra\b/i,                                  // THC-Hydra
      /\bjohn\b.*\b(password|hash)\b/i,                  // John the Ripper
      /\bhashcat\b/i,                                    // hashcat
    ],
    description: '检测到密码爆破工具',
    remediation: '封禁来源 IP，实施强密码策略'
  },
  {
    id: 'BRUTE-002', name: '凭据填充', category: '暴力破解', severity: 'medium',
    patterns: [
      /Authorization:\s*Basic\s+[A-Za-z0-9+/=]{50,}/i,  // Very long Basic auth
    ],
    description: '检测到疑似凭据填充攻击',
    remediation: '实施账户锁定策略，添加验证码'
  },
]

// ==================== MITRE ATT&CK 映射 ====================

const MITRE_MAPPING: Record<string, { tactic: string; tacticName: string; technique?: string; techniqueName?: string }> = {
  'SQL注入':       { tactic: 'TA0001', tacticName: 'Initial Access', technique: 'T1190', techniqueName: 'Exploit Public-Facing Application' },
  'XSS攻击':      { tactic: 'TA0001', tacticName: 'Initial Access', technique: 'T1189', techniqueName: 'Drive-by Compromise' },
  '命令注入':      { tactic: 'TA0002', tacticName: 'Execution', technique: 'T1059', techniqueName: 'Command and Scripting Interpreter' },
  '目录遍历':      { tactic: 'TA0001', tacticName: 'Initial Access', technique: 'T1190', techniqueName: 'Exploit Public-Facing Application' },
  '暴力破解':      { tactic: 'TA0006', tacticName: 'Credential Access', technique: 'T1110', techniqueName: 'Brute Force' },
  '攻击工具':      { tactic: 'TA0043', tacticName: 'Reconnaissance', technique: 'T1595', techniqueName: 'Active Scanning' },
  'SSRF攻击':     { tactic: 'TA0001', tacticName: 'Initial Access', technique: 'T1190', techniqueName: 'Exploit Public-Facing Application' },
  '文件包含':      { tactic: 'TA0001', tacticName: 'Initial Access', technique: 'T1190', techniqueName: 'Exploit Public-Facing Application' },
  'WebShell':     { tactic: 'TA0003', tacticName: 'Persistence', technique: 'T1505', techniqueName: 'Server Software Component' },
  'HTTP请求走私':  { tactic: 'TA0001', tacticName: 'Initial Access', technique: 'T1190', techniqueName: 'Exploit Public-Facing Application' },
  '反序列化攻击':  { tactic: 'TA0002', tacticName: 'Execution', technique: 'T1059', techniqueName: 'Command and Scripting Interpreter' },
  'JWT攻击':      { tactic: 'TA0006', tacticName: 'Credential Access', technique: 'T1556', techniqueName: 'Modify Authentication Process' },
  '模板注入':      { tactic: 'TA0002', tacticName: 'Execution', technique: 'T1059', techniqueName: 'Command and Scripting Interpreter' },
  'HTTP头注入':   { tactic: 'TA0001', tacticName: 'Initial Access', technique: 'T1190', techniqueName: 'Exploit Public-Facing Application' },
  '信息泄露':      { tactic: 'TA0007', tacticName: 'Discovery', technique: 'T1082', techniqueName: 'System Information Discovery' },
  'Log4j注入':    { tactic: 'TA0001', tacticName: 'Initial Access', technique: 'T1190', techniqueName: 'Exploit Public-Facing Application' },
  'Spring漏洞':   { tactic: 'TA0001', tacticName: 'Initial Access', technique: 'T1190', techniqueName: 'Exploit Public-Facing Application' },
  '爬虫Bot':      { tactic: 'TA0043', tacticName: 'Reconnaissance', technique: 'T1595', techniqueName: 'Active Scanning' },
  '敏感文件':      { tactic: 'TA0007', tacticName: 'Discovery', technique: 'T1083', techniqueName: 'File and Directory Discovery' },
}

// CWE 编号映射
const CWE_MAPPING: Record<string, string> = {
  'SQL注入': 'CWE-89',
  'XSS攻击': 'CWE-79',
  '命令注入': 'CWE-78',
  '目录遍历': 'CWE-22',
  '暴力破解': 'CWE-307',
  '攻击工具': 'CWE-200',
  'SSRF攻击': 'CWE-918',
  '文件包含': 'CWE-98',
  'WebShell': 'CWE-94',
  'HTTP请求走私': 'CWE-444',
  '反序列化攻击': 'CWE-502',
  'JWT攻击': 'CWE-287',
  '模板注入': 'CWE-1336',
  'HTTP头注入': 'CWE-113',
  '信息泄露': 'CWE-200',
  'Log4j注入': 'CWE-502',
  'Spring漏洞': 'CWE-94',
  '爬虫Bot': 'CWE-200',
  '敏感文件': 'CWE-538',
}

// 为规则批量注入 MITRE ATT&CK 映射和 CWE 编号
for (const rule of BUILT_IN_RULES) {
  if (!rule.mitre && MITRE_MAPPING[rule.category]) {
    rule.mitre = MITRE_MAPPING[rule.category]
  }
  if (!rule.cwe && CWE_MAPPING[rule.category]) {
    rule.cwe = CWE_MAPPING[rule.category]
  }
}

// ==================== 智能告警去重 ====================

export interface AggregatedAlert {
  rule: Rule
  sourceIP: string
  count: number
  lineNumbers: number[]
  firstSeen: string
  lastSeen: string
  sampleLine: string
}

// 从日志行提取源 IP
function extractSourceIP(line: string): string {
  const ipMatch = line.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/)
  return ipMatch ? ipMatch[1] : 'unknown'
}

// 从日志行提取时间戳
function extractTimestamp(line: string): string {
  const tsMatch = line.match(/\d{4}[-/]\d{2}[-/]\d{2}[T ]\d{2}:\d{2}:\d{2}/)
    || line.match(/\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2}/)
    || line.match(/\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}/)
  return tsMatch ? tsMatch[0] : ''
}

export function deduplicateMatches(matches: RuleMatch[]): AggregatedAlert[] {
  const map = new Map<string, AggregatedAlert>()

  for (const match of matches) {
    const ip = extractSourceIP(match.line)
    const key = `${match.rule.id}::${ip}`

    if (map.has(key)) {
      const agg = map.get(key)!
      agg.count++
      agg.lineNumbers.push(match.lineNumber)
      const ts = extractTimestamp(match.line)
      if (ts) {
        if (!agg.firstSeen || ts < agg.firstSeen) agg.firstSeen = ts
        if (!agg.lastSeen || ts > agg.lastSeen) agg.lastSeen = ts
      }
    } else {
      map.set(key, {
        rule: match.rule,
        sourceIP: ip,
        count: 1,
        lineNumbers: [match.lineNumber],
        firstSeen: extractTimestamp(match.line),
        lastSeen: extractTimestamp(match.line),
        sampleLine: match.line,
      })
    }
  }

  return [...map.values()].sort((a, b) => b.count - a.count)
}

// ==================== 分析引擎 ====================

export function analyzeWithRules(lines: string[], progressCallback?: (msg: string) => void, customRules?: Rule[]): RuleAnalysisResult {
  const matches: RuleMatch[] = []
  const categoryStats: Record<string, number> = {}
  const summary = { critical: 0, high: 0, medium: 0, low: 0 }

  const allRules = customRules ? [...BUILT_IN_RULES, ...customRules] : BUILT_IN_RULES

  const totalLines = lines.length
  progressCallback?.(`规则引擎开始扫描 ${totalLines} 行日志...（${allRules.length} 条规则）`)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    for (const rule of allRules) {
      for (const pattern of rule.patterns) {
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
          break
        }
      }
    }

    if (i > 0 && i % 1000 === 0) {
      progressCallback?.(`已扫描 ${i}/${totalLines} 行，发现 ${matches.length} 条告警...`)
    }
  }

  progressCallback?.(`规则扫描完成: 共 ${totalLines} 行，发现 ${matches.length} 条告警`)

  const aggregatedAlerts = deduplicateMatches(matches)
  progressCallback?.(`去重聚合完成: ${matches.length} 条告警 → ${aggregatedAlerts.length} 条聚合告警`)

  const report = generateRuleReport(lines, matches, summary, categoryStats, aggregatedAlerts)

  return {
    totalLines,
    matchedLines: new Set(matches.map(m => m.lineNumber)).size,
    matches,
    aggregatedAlerts,
    summary,
    categoryStats,
    report,
  }
}

function generateRuleReport(
  lines: string[],
  matches: RuleMatch[],
  summary: { critical: number; high: number; medium: number; low: number },
  categoryStats: Record<string, number>,
  aggregatedAlerts: AggregatedAlert[]
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
    const grouped: Record<string, RuleMatch[]> = {}
    for (const m of matches) {
      if (!grouped[m.rule.category]) grouped[m.rule.category] = []
      grouped[m.rule.category].push(m)
    }

    for (const [category, categoryMatches] of Object.entries(grouped)) {
      const uniqueRules = new Set(categoryMatches.map(m => m.rule.id))
      report += `   ▸ ${category} (${categoryMatches.length} 次命中，${uniqueRules.size} 条规则)\n`

      const shownRules = new Set<string>()
      for (const m of categoryMatches) {
        if (shownRules.size >= 3 || shownRules.has(m.rule.id)) continue
        shownRules.add(m.rule.id)
        report += `     - [${m.rule.id}] ${m.rule.name}: ${m.rule.description}\n`
        if (m.rule.cwe) {
          report += `       ${m.rule.cwe}`
          if (m.rule.mitre) {
            report += ` | ATT&CK: ${m.rule.mitre.tactic}(${m.rule.mitre.tacticName})`
            if (m.rule.mitre.technique) report += ` → ${m.rule.mitre.technique}(${m.rule.mitre.techniqueName})`
          }
          report += `\n`
        } else if (m.rule.mitre) {
          report += `       ATT&CK: ${m.rule.mitre.tactic}(${m.rule.mitre.tacticName})`
          if (m.rule.mitre.technique) report += ` → ${m.rule.mitre.technique}(${m.rule.mitre.techniqueName})`
          report += `\n`
        }
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

  report += `\n5. 告警聚合统计\n`
  if (aggregatedAlerts.length > 0) {
    report += `   共 ${aggregatedAlerts.length} 条聚合告警（按规则+源IP去重）:\n`
    for (const agg of aggregatedAlerts.slice(0, 10)) {
      const severityIcon = agg.rule.severity === 'critical' ? '🔴' : agg.rule.severity === 'high' ? '🟠' : agg.rule.severity === 'medium' ? '🟡' : '🔵'
      report += `   ${severityIcon} [${agg.rule.id}] ${agg.rule.name} | IP: ${agg.sourceIP} | ×${agg.count} 次`
      if (agg.firstSeen && agg.lastSeen && agg.firstSeen !== agg.lastSeen) {
        report += ` | ${agg.firstSeen} ~ ${agg.lastSeen}`
      }
      report += `\n`
    }
    if (aggregatedAlerts.length > 10) {
      report += `   ... 共 ${aggregatedAlerts.length} 条聚合告警\n`
    }
  } else {
    report += `   无告警\n`
  }

  report += `\n6. 参考依据\n`
  report += `   • OWASP Top 10 2021\n`
  report += `   • ModSecurity CRS v4 规则库\n`
  report += `   • MITRE ATT&CK 框架\n`

  return report
}

export { BUILT_IN_RULES as RULES }
