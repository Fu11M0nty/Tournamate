# Regenerate the pilot doc exports on demand (Windows + Microsoft Word).
#
# The .html / .docx / .pdf files in this folder are git-ignored. Run this to
# rebuild them from the Markdown sources:
#
#   pwsh docs/pilot/export-pilot-docs.ps1
#
# Steps:
#   1. Regenerate every <doc>.html from <doc>.md via _md2html.mjs (no deps).
#   2. Use Word COM to save each .html as .docx and .pdf.
#
# HTML-only (no Word, cross-platform) is enough for most needs:
#   npm run docs:pilot
#
# Requires: Node.js, and Microsoft Word installed for the .docx/.pdf step.

$ErrorActionPreference = 'Stop'
$dir = $PSScriptRoot

# 1. Markdown -> HTML (portable).
node "$dir\_md2html.mjs"

# 2. HTML -> DOCX + PDF via Word.
$wdFormatXMLDocument = 16
$wdFormatPDF = 17

$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
  Get-ChildItem -Path $dir -Filter '*.html' | ForEach-Object {
    $base = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
    $doc = $word.Documents.Open($_.FullName)
    $doc.SaveAs([ref]"$dir\$base.docx", [ref]$wdFormatXMLDocument)
    $doc.SaveAs([ref]"$dir\$base.pdf", [ref]$wdFormatPDF)
    $doc.Close($false)
    Write-Output "Exported $base.docx and $base.pdf"
  }
} finally {
  $word.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
