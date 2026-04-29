// 报告生成器 - DOCX + PDF 导出

import { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType, PageBreak, BorderStyle, TabStopPosition, TabStopType } from 'docx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { APP_VERSION } from './constants'

// 字体回退链：优先使用可用的中文字体
const CN_FONT_CANDIDATES = ['Microsoft YaHei', 'SimHei', 'STHeiti', 'PingFang SC', 'Noto Sans SC', 'WenQuanYi Micro Hei', 'Arial']

function getAvailableCJKFont(): string {
  // 在 Electron 环境中，Microsoft YaHei 通常可用
  // 如果不可用，docx 库会自动回退到默认字体
  return CN_FONT_CANDIDATES[0]
}

// ==================== 报告文本解析 ====================

interface ReportLine {
  type: 'main-title' | 'numbered-title' | 'bullet' | 'sub-item' | 'risk-line' | 'plain' | 'empty'
  content: string
  raw: string
}

function parseReportLines(text: string): ReportLine[] {
  return text.split('\n').map(line => {
    const stripped = line.trim()
    if (!stripped) return { type: 'empty' as const, content: '', raw: line }

    if (stripped.startsWith('【') && stripped.endsWith('】')) {
      return { type: 'main-title' as const, content: stripped.slice(1, -1), raw: line }
    }

    const titleMatch = stripped.match(/^(\d+)\.\s+(.+)/)
    if (titleMatch) {
      return { type: 'numbered-title' as const, content: titleMatch[2].replace(/\*\*/g, ''), raw: line }
    }

    if (/(危急|高危|中危|低危)/.test(stripped)) {
      return { type: 'risk-line' as const, content: stripped.replace(/\*\*/g, ''), raw: line }
    }

    if (stripped.startsWith('•') || stripped.startsWith('-')) {
      return { type: 'bullet' as const, content: stripped.slice(1).trim().replace(/\*\*/g, ''), raw: line }
    }

    if (stripped.startsWith('  -') || stripped.startsWith('  ├') || stripped.startsWith('  └') || stripped.includes('└─')) {
      const content = stripped.replace(/^\s*[-└├│]\s*/, '').replace(/\*\*/g, '')
      return { type: 'sub-item' as const, content, raw: line }
    }

    return { type: 'plain' as const, content: stripped.replace(/\*\*/g, ''), raw: line }
  })
}

// ==================== 风险等级颜色 ====================

const RISK_COLORS: Record<string, string> = {
  '危急': '#dc2626',
  '高危': '#ea580c',
  '中危': '#ca8a04',
  '低危': '#2563eb',
}

function getRiskColor(text: string): string | null {
  for (const [level, color] of Object.entries(RISK_COLORS)) {
    if (text.includes(level)) return color
  }
  return null
}

// ==================== DOCX 导出（美化版） ====================

export async function exportToDocx(reportText: string, fileName: string): Promise<void> {
  const lines = parseReportLines(reportText)
  const timestamp = new Date().toLocaleString('zh-CN')

  const children: any[] = []

  // ---- 封面页 ----
  children.push(
    new Paragraph({ text: '', spacing: { after: 2400 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({
        text: '星川智盾',
        bold: true,
        size: 56,
        color: '0066cc',
        font: getAvailableCJKFont(),
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({
        text: '安全分析报告',
        bold: true,
        size: 40,
        color: '333333',
        font: getAvailableCJKFont(),
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [new TextRun({
        text: 'AI 驱动的网站日志安全分析系统',
        size: 22,
        color: '666666',
        font: getAvailableCJKFont(),
      })],
    }),
    new Paragraph({ text: '', spacing: { after: 600 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: '生成时间: ', size: 20, color: '888888', font: getAvailableCJKFont() }),
        new TextRun({ text: timestamp, size: 20, color: '333333', font: getAvailableCJKFont() }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: '分析文件: ', size: 20, color: '888888', font: getAvailableCJKFont() }),
        new TextRun({ text: fileName, size: 20, color: '333333', font: getAvailableCJKFont() }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: '分析引擎: ', size: 20, color: '888888', font: getAvailableCJKFont() }),
        new TextRun({ text: '星川智盾 AI 分析引擎', size: 20, color: '333333', font: getAvailableCJKFont() }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: '版本: ', size: 20, color: '888888', font: getAvailableCJKFont() }),
        new TextRun({ text: `v${APP_VERSION}`, size: 20, color: '333333', font: getAvailableCJKFont() }),
      ],
    }),
    new Paragraph({
      children: [new PageBreak()],
    }),
  )

  // ---- 报告正文 ----
  for (const line of lines) {
    switch (line.type) {
      case 'main-title':
        children.push(new Paragraph({
          spacing: { before: 400, after: 300 },
          alignment: AlignmentType.CENTER,
          children: [new TextRun({
            text: line.content,
            bold: true,
            size: 32,
            color: '0066cc',
            font: getAvailableCJKFont(),
          })],
        }))
        break

      case 'numbered-title':
        children.push(new Paragraph({
          spacing: { before: 360, after: 200, line: 360 },
          border: {
            left: { style: BorderStyle.SINGLE, size: 6, color: '0066cc', space: 10 },
          },
          // 主要章节标题前强制分页（避免标题在页尾孤立）
          ...(line.content.includes('安全评估') || line.content.includes('风险分析') || line.content.includes('攻击详情') || line.content.includes('建议')
            ? { pageBreakBefore: true }
            : {}),
          children: [new TextRun({
            text: line.content,
            bold: true,
            size: 26,
            color: '1a1a2e',
            font: getAvailableCJKFont(),
          })],
        }))
        break

      case 'risk-line': {
        const riskColor = getRiskColor(line.content) || '333333'
        const parts = line.content.split(/(危急|高危|中危|低危)/)
        children.push(new Paragraph({
          spacing: { before: 100, after: 100 },
          indent: { left: 360 },
          children: parts.flatMap(part => {
            if (['危急', '高危', '中危', '低危'].includes(part)) {
              return [new TextRun({
                text: ` ${part} `,
                bold: true,
                size: 20,
                color: 'ffffff',
                font: getAvailableCJKFont(),
                shading: { type: 'clear' as any, fill: RISK_COLORS[part]?.replace('#', '') || '666666' },
              })]
            }
            return [new TextRun({ text: part, size: 20, color: '444444', font: getAvailableCJKFont() })]
          }),
        }))
        break
      }

      case 'bullet':
        children.push(new Paragraph({
          spacing: { before: 80, after: 80 },
          indent: { left: 480 },
          children: [
            new TextRun({ text: '  ', size: 20 }),
            new TextRun({ text: line.content, size: 20, color: '444444', font: getAvailableCJKFont() }),
          ],
        }))
        break

      case 'sub-item':
        children.push(new Paragraph({
          spacing: { before: 60, after: 60 },
          indent: { left: 960 },
          children: [
            new TextRun({ text: '└ ', size: 18, color: '999999', font: getAvailableCJKFont() }),
            new TextRun({ text: line.content, size: 18, color: '777777', font: getAvailableCJKFont() }),
          ],
        }))
        break

      case 'plain':
        children.push(new Paragraph({
          spacing: { before: 80, after: 80, line: 340 },
          indent: { left: 360 },
          children: [new TextRun({ text: line.content, size: 20, color: '444444', font: getAvailableCJKFont() })],
        }))
        break

      case 'empty':
        children.push(new Paragraph({ text: '', spacing: { after: 120 } }))
        break
    }
  }

  // ---- 页脚信息 ----
  children.push(
    new Paragraph({ text: '', spacing: { before: 600 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc', space: 10 },
      },
      spacing: { before: 200 },
      children: [new TextRun({
        text: `星川智盾 v${APP_VERSION} | 星川智盾安全团队 | ${new Date().getFullYear()}`,
        size: 16,
        color: 'aaaaaa',
        font: getAvailableCJKFont(),
      })],
    }),
  )

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        },
      },
      children,
    }],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `安全分析报告_${fileName}_${Date.now()}.docx`)
}

// ==================== PDF 导出（jsPDF html 方法） ====================

function buildReportHtml(reportText: string, fileName: string): string {
  const lines = parseReportLines(reportText)
  const timestamp = new Date().toLocaleString('zh-CN')

  let bodyHtml = ''

  for (const line of lines) {
    switch (line.type) {
      case 'main-title':
        bodyHtml += `<h1 style="text-align:center;color:#0066cc;font-size:20px;margin:30px 0 20px;letter-spacing:2px;">${line.content}</h1>`
        break

      case 'numbered-title':
        bodyHtml += `<h2 style="color:#1a1a2e;font-size:16px;margin:24px 0 12px;padding-left:12px;border-left:4px solid #0066cc;">${line.content}</h2>`
        break

      case 'risk-line': {
        const riskColor = getRiskColor(line.content) || '#666'
        const parts = line.content.split(/(危急|高危|中危|低危)/)
        let html = '<div style="margin:6px 0 6px 20px;font-size:13px;color:#444;">'
        for (const part of parts) {
          if (['危急', '高危', '中危', '低危'].includes(part)) {
            const bg = RISK_COLORS[part] || '#666'
            html += `<span style="display:inline-block;background:${bg};color:#fff;padding:1px 8px;border-radius:3px;font-weight:bold;font-size:12px;margin:0 4px;">${part}</span>`
          } else {
            html += part
          }
        }
        html += '</div>'
        bodyHtml += html
        break
      }

      case 'bullet':
        bodyHtml += `<div style="margin:4px 0 4px 30px;font-size:13px;color:#444;"><span style="color:#0066cc;margin-right:6px;">&#9654;</span>${line.content}</div>`
        break

      case 'sub-item':
        bodyHtml += `<div style="margin:3px 0 3px 56px;font-size:12px;color:#777;"><span style="color:#b400ff;margin-right:4px;">└</span>${line.content}</div>`
        break

      case 'plain':
        bodyHtml += `<div style="margin:4px 0 4px 20px;font-size:13px;color:#444;">${line.content}</div>`
        break

      case 'empty':
        bodyHtml += '<div style="height:8px;"></div>'
        break
    }
  }

  return `
    <div style="font-family:'Microsoft YaHei','SimHei','Helvetica Neue',sans-serif;color:#333;padding:0;max-width:700px;">
      <!-- 封面 -->
      <div style="text-align:center;padding:60px 0 40px;border-bottom:2px solid #e0e6f0;margin-bottom:30px;">
        <div style="font-size:32px;font-weight:bold;color:#0066cc;letter-spacing:4px;margin-bottom:12px;">星川智盾</div>
        <div style="font-size:20px;color:#333;margin-bottom:8px;">安全分析报告</div>
        <div style="font-size:13px;color:#888;margin-bottom:30px;">AI 驱动的网站日志安全分析系统</div>
        <div style="font-size:12px;color:#aaa;line-height:2;">
          <div>生成时间: <span style="color:#666;">${timestamp}</span></div>
          <div>分析文件: <span style="color:#666;">${fileName}</span></div>
          <div>版本: <span style="color:#666;">v${APP_VERSION}</span></div>
        </div>
      </div>
      <!-- 正文 -->
      ${bodyHtml}
      <!-- 页脚 -->
      <div style="text-align:center;margin-top:40px;padding-top:16px;border-top:1px solid #e0e6f0;font-size:11px;color:#aaa;">
        星川智盾 v${APP_VERSION} | 星川智盾安全团队 | ${new Date().getFullYear()}
      </div>
    </div>
  `
}

export async function exportToPdf(reportText: string, fileName: string): Promise<void> {
  const htmlContent = buildReportHtml(reportText, fileName)

  // 创建隐藏容器
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-9999px'
  container.style.top = '0'
  container.style.width = '750px'
  container.innerHTML = htmlContent
  document.body.appendChild(container)

  try {
    // 用 html2canvas 将 HTML 渲染为 canvas
    // scale=3 提高清晰度，allowTaint 允许跨域字体
    const canvas = await html2canvas(container, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    })

    // A4 尺寸 (mm)
    const pageWidth = 210
    const pageHeight = 297
    const margin = 12
    const contentWidth = pageWidth - margin * 2
    const contentHeight = pageHeight - margin * 2

    // canvas 尺寸 (px)
    const canvasWidth = canvas.width
    const canvasHeight = canvas.height

    // 每页可容纳的 canvas 像素高度
    const pxPerMm = canvasWidth / contentWidth
    const pageContentPx = contentHeight * pxPerMm
    const totalPages = Math.ceil(canvasHeight / pageContentPx)

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    })

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) doc.addPage()

      // 当前页在 canvas 中的 Y 偏移和高度
      const srcY = page * pageContentPx
      const srcHeight = Math.min(pageContentPx, canvasHeight - srcY)

      // 创建当前页的 canvas 切片
      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = canvasWidth
      pageCanvas.height = Math.ceil(srcHeight)
      const ctx = pageCanvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvasWidth, pageCanvas.height)
      ctx.drawImage(canvas, 0, Math.floor(srcY), canvasWidth, Math.ceil(srcHeight), 0, 0, canvasWidth, pageCanvas.height)

      // 将切片转为图片数据 (PNG 保持清晰度)
      const imgData = pageCanvas.toDataURL('image/png')

      // 计算图片在 PDF 中的实际高度
      const imgHeightMm = srcHeight / pxPerMm

      doc.addImage(imgData, 'PNG', margin, margin, contentWidth, imgHeightMm)

      // 页码
      doc.setFontSize(9)
      doc.setTextColor(170, 170, 170)
      doc.text(
        `第 ${page + 1} 页 / 共 ${totalPages} 页`,
        pageWidth / 2,
        pageHeight - 5,
        { align: 'center' }
      )
    }

    doc.save(`安全分析报告_${fileName}_${Date.now()}.pdf`)
  } finally {
    document.body.removeChild(container)
  }
}
