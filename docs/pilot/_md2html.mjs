// Minimal Markdown -> print-friendly HTML converter for the pilot docs.
// No dependencies; supports the subset of Markdown these docs use:
// headings, hr, blockquotes, tables, ordered/unordered lists, task lists,
// bold, inline code, and links.
//
// Usage:
//   node docs/pilot/_md2html.mjs                      regenerate HTML for every *.md in docs/pilot
//   node docs/pilot/_md2html.mjs <input.md> <out.html>  convert a single file
//
// The generated .html/.docx/.pdf exports are git-ignored — run this (or
// `npm run docs:pilot`) to regenerate them on demand. See README.md.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const inline = (s) =>
  esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) =>
      `<a href="${href.replace(/\.md$/, '.html')}">${text}</a>`)
    .replace(/\[ \]/g, '<span class="cb">&#9744;</span>')
    .replace(/\[x\]/gi, '<span class="cb">&#9745;</span>')

function convert(input, output) {
  const lines = readFileSync(input, 'utf8').split(/\r?\n/)
  const out = []
  const listStack = [] // 'ul' | 'ol'
  let inQuote = false
  let tableRows = null

  const closeLists = (depth = 0) => {
    while (listStack.length > depth) out.push(`</${listStack.pop()}>`)
  }
  const closeQuote = () => { if (inQuote) { out.push('</blockquote>'); inQuote = false } }
  const flushTable = () => {
    if (!tableRows) return
    const [head, ...body] = tableRows
    out.push('<table><thead><tr>')
    head.forEach((c) => out.push(`<th>${inline(c)}</th>`))
    out.push('</tr></thead><tbody>')
    body.forEach((row) => {
      out.push('<tr>')
      row.forEach((c) => out.push(`<td>${inline(c)}</td>`))
      out.push('</tr>')
    })
    out.push('</tbody></table>')
    tableRows = null
  }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')

    // table rows
    if (/^\s*\|.*\|\s*$/.test(line)) {
      closeLists(); closeQuote()
      const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
      if (cells.every((c) => /^:?-{3,}:?$/.test(c))) continue // separator row
      tableRows = tableRows || []
      tableRows.push(cells)
      continue
    }
    flushTable()

    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      closeLists(); closeQuote()
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`)
      continue
    }
    if (/^---+$/.test(line.trim())) {
      closeLists(); closeQuote()
      out.push('<hr>')
      continue
    }
    if (/^>\s?/.test(line)) {
      closeLists()
      if (!inQuote) { out.push('<blockquote>'); inQuote = true }
      out.push(`<p>${inline(line.replace(/^>\s?/, ''))}</p>`)
      continue
    }
    const li = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/)
    if (li) {
      closeQuote()
      const depth = Math.floor(li[1].length / 2) + 1
      const type = /\d/.test(li[2]) ? 'ol' : 'ul'
      closeLists(depth)
      while (listStack.length < depth) { out.push(`<${type}>`); listStack.push(type) }
      out.push(`<li>${inline(li[3])}</li>`)
      continue
    }
    if (line.trim() === '') {
      closeLists(); closeQuote()
      continue
    }
    closeLists(); closeQuote()
    out.push(`<p>${inline(line)}</p>`)
  }
  closeLists(); closeQuote(); flushTable()

  const title = (lines.find((l) => /^#\s/.test(l)) || '# Document').replace(/^#\s+/, '')

  writeFileSync(output, `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; max-width: 50em; margin: 2em auto; padding: 0 1.5em; line-height: 1.45; }
  h1 { color: #0f172a; border-bottom: 3px solid #f47c20; padding-bottom: .25em; font-size: 1.6em; }
  h2 { color: #0f172a; margin-top: 1.4em; font-size: 1.25em; }
  h3 { font-size: 1.05em; }
  blockquote { border-left: 4px solid #f47c20; background: #fff7f0; margin: 1em 0; padding: .5em 1em; }
  blockquote p { margin: .3em 0; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #cbd5e1; padding: .4em .6em; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; }
  code { background: #f1f5f9; padding: .1em .3em; border-radius: 3px; font-size: .92em; }
  hr { border: none; border-top: 1px solid #cbd5e1; margin: 1.5em 0; }
  ul, ol { padding-left: 1.4em; }
  li { margin: .2em 0; }
  .cb { font-size: 1.1em; }
  a { color: #1d4ed8; }
  @media print { body { margin: 0 auto; font-size: 11pt; } }
</style></head><body>
${out.join('\n')}
</body></html>
`, 'utf8')

  console.log(`Wrote ${output}`)
}

const [argInput, argOutput] = process.argv.slice(2)

if (argInput && argOutput) {
  convert(argInput, argOutput)
} else if (argInput && !argOutput) {
  console.error('Usage: node _md2html.mjs [<input.md> <output.html>]  (no args = regenerate all pilot docs)')
  process.exit(1)
} else {
  // No args: regenerate HTML for every Markdown source in this directory.
  const dir = dirname(fileURLToPath(import.meta.url))
  const sources = readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
    .sort()
  if (sources.length === 0) {
    console.error(`No Markdown sources found in ${dir}`)
    process.exit(1)
  }
  for (const file of sources) {
    convert(join(dir, file), join(dir, `${basename(file, '.md')}.html`))
  }
}
