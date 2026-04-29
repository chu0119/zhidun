// 构建脚本 - 处理 electron-builder 在 Windows 上无法复制 electron.exe 的问题
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'release', 'win-unpacked')
const ELECTRON_DIST = path.join(ROOT, 'node_modules', 'electron', 'dist')

function copyRecursive(src, dst) {
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true })
    for (const f of fs.readdirSync(src)) {
      copyRecursive(path.join(src, f), path.join(dst, f))
    }
  } else {
    fs.copyFileSync(src, dst)
  }
}

console.log('=== 星川智盾 构建脚本 ===\n')

// Step 1: TypeScript check
console.log('[1/4] TypeScript 类型检查...')
execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'inherit' })
console.log('  ✓ 通过\n')

// Step 2: Vite build
console.log('[2/4] Vite 构建...')
execSync('npx vite build', { cwd: ROOT, stdio: 'inherit' })
console.log('  ✓ 完成\n')

// Step 3: Package electron
console.log('[3/4] 打包 Electron 应用...')
fs.rmSync(path.join(ROOT, 'release'), { recursive: true, force: true })
fs.mkdirSync(OUT_DIR, { recursive: true })
fs.mkdirSync(path.join(OUT_DIR, 'resources'), { recursive: true })
fs.mkdirSync(path.join(OUT_DIR, 'locales'), { recursive: true })

// Copy electron dist
for (const f of fs.readdirSync(ELECTRON_DIST)) {
  copyRecursive(path.join(ELECTRON_DIST, f), path.join(OUT_DIR, f))
}

// Rename electron.exe
const exeSrc = path.join(OUT_DIR, 'electron.exe')
const exeDst = path.join(OUT_DIR, 'zhidun.exe')
fs.renameSync(exeSrc, exeDst)

// Copy app files
copyRecursive(path.join(ROOT, 'dist'), path.join(OUT_DIR, 'resources', 'app', 'dist'))
copyRecursive(path.join(ROOT, 'dist-electron'), path.join(OUT_DIR, 'resources', 'app', 'dist-electron'))

// Copy package.json (without devDependencies)
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
delete pkg.devDependencies
fs.writeFileSync(path.join(OUT_DIR, 'resources', 'app', 'package.json'), JSON.stringify(pkg, null, 2))

// Copy asar unpacked modules
if (pkg.build && pkg.build.asarUnpack) {
  for (const pattern of pkg.build.asarUnpack) {
    const dir = pattern.replace('/**/*', '')
    const srcDir = path.join(ROOT, 'node_modules', path.basename(dir))
    const dstDir = path.join(OUT_DIR, 'resources', 'app', dir)
    if (fs.existsSync(srcDir)) {
      copyRecursive(srcDir, dstDir)
    }
  }
}
console.log('  ✓ 完成\n')

// Step 4: Create installer
console.log('[4/4] 创建安装程序...')
execSync('npx electron-builder --win --prepackaged release/win-unpacked', { cwd: ROOT, stdio: 'inherit' })
console.log('  ✓ 完成\n')

// List output
const releaseDir = path.join(ROOT, 'release')
const files = fs.readdirSync(releaseDir).filter(f => f.endsWith('.exe'))
console.log('=== 构建完成 ===')
for (const f of files) {
  const size = fs.statSync(path.join(releaseDir, f)).size
  console.log(`  ${f} (${(size / 1024 / 1024).toFixed(1)} MB)`)
}
