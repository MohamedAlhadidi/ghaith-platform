param([string]$Pdf, [string]$OutDir, [int]$From, [int]$To, [int]$PerImage = 14)
# يعرض الصفحات ثم يقتطع شريط الذيل (رمز الوحدة والنشاط) وعنوان الدرس ويكدّسها في صور مجمّعة لقراءة أسرع
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$render = Join-Path $PSScriptRoot 'render-pdf.ps1'
$tmp = Join-Path $OutDir 'tmp'
& $render -Pdf $Pdf -OutDir $tmp -Pages @($From..$To) -Width 900 | Out-Null
$strips = @()
foreach ($p in $From..$To) {
  $img = [System.Drawing.Image]::FromFile((Join-Path $tmp ('p{0:D3}.png' -f $p)))
  $h = $img.Height; $w = $img.Width
  # شريط العنوان أعلى الصفحة وشريط الذيل أسفلها
  $top = New-Object System.Drawing.Bitmap $w, 70
  $g = [System.Drawing.Graphics]::FromImage($top); $g.DrawImage($img, (New-Object System.Drawing.Rectangle 0,0,$w,70), (New-Object System.Drawing.Rectangle 0,10,$w,70), [System.Drawing.GraphicsUnit]::Pixel); $g.Dispose()
  $bot = New-Object System.Drawing.Bitmap $w, 50
  $g = [System.Drawing.Graphics]::FromImage($bot); $g.DrawImage($img, (New-Object System.Drawing.Rectangle 0,0,$w,50), (New-Object System.Drawing.Rectangle 0,($h-62),$w,50), [System.Drawing.GraphicsUnit]::Pixel); $g.Dispose()
  $strips += @{Page=$p; Top=$top; Bot=$bot}
  $img.Dispose()
}
$i = 0; $n = 0
while ($i -lt $strips.Count) {
  $chunk = $strips[$i..([Math]::Min($i + $PerImage - 1, $strips.Count - 1))]
  $w = $chunk[0].Top.Width
  $sheet = New-Object System.Drawing.Bitmap $w, (($chunk.Count) * 130)
  $g = [System.Drawing.Graphics]::FromImage($sheet); $g.Clear([System.Drawing.Color]::White)
  $font = New-Object System.Drawing.Font('Segoe UI', 14, [System.Drawing.FontStyle]::Bold)
  $y = 0
  foreach ($s in $chunk) {
    $g.DrawImage($s.Top, 0, $y); $g.DrawImage($s.Bot, 0, $y + 72)
    $g.DrawString(("PDF p{0} = printed {1}" -f $s.Page, ($s.Page - 11)), $font, [System.Drawing.Brushes]::Red, 10, ($y + 76))
    $g.DrawLine([System.Drawing.Pens]::Gray, 0, ($y + 128), $w, ($y + 128))
    $y += 130
  }
  $g.Dispose()
  $n++
  $out = Join-Path $OutDir ("footers-{0}.png" -f $n)
  $sheet.Save($out, [System.Drawing.Imaging.ImageFormat]::Png); $sheet.Dispose()
  "saved $out"
  $i += $PerImage
}
Remove-Item $tmp -Recurse -Force
