# Launcher.ps1 - مشغّل غيث البصري
# نافذة ملء الشاشة ببلاطات كبيرة. كل بلاطة تنطق اسمها (ملف WAV بصوت ولي الأمر أو صوت Windows العربي) وتفتح هدفها.
# الخروج للكبار: Ctrl+Shift+Q أو 5 نقرات سريعة على زاوية "للكبار".
param([string]$ConfigPath = (Join-Path $PSScriptRoot 'tiles.json'))

$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$root    = $PSScriptRoot
$cfg     = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$sounds  = Join-Path $root 'أصوات'
$images  = Join-Path $root 'صور'
$school  = [Environment]::ExpandEnvironmentVariables($cfg.schoolFolder)
$logDir  = Join-Path $env:LOCALAPPDATA 'ChildLearning'
if (-not (Test-Path -LiteralPath $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$logFile = Join-Path $logDir 'launcher.log'
function Log($m) { try { Add-Content -LiteralPath $logFile -Value ("{0} {1}" -f (Get-Date -Format s), $m) -Encoding UTF8 } catch {} }

function Expand($s) {
  if ($null -eq $s) { return '' }
  $s = [string]$s
  $s = $s.Replace('%GCOMPRIS%', $cfg.gcompris).Replace('%SCHOOL%', $school).Replace('%EDGE%', $cfg.edge)
  return [Environment]::ExpandEnvironmentVariables($s)
}

# ---------- الصوت ----------
# الترتيب: ملف WAV بصوت ولي الأمر > نسخة مخزنة من صوت Windows العربي > توليد عبر WinRT > System.Speech > صمت
$ttsCache = Join-Path $logDir 'tts-cache'
if (-not (Test-Path -LiteralPath $ttsCache)) { New-Item -ItemType Directory -Path $ttsCache -Force | Out-Null }
$script:winrt = $null
$script:sapi = $null
try {
  $null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media, ContentType = WindowsRuntime]
  $voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.Language -like 'ar*' } | Select-Object -First 1
  if ($voice) {
    $s = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
    $s.Voice = $voice
    $script:winrt = $s
    $script:asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
    Log "WinRT voice: $($voice.DisplayName) $($voice.Language)"
  } else { Log 'WinRT: no Arabic voice' }
} catch { Log "WinRT init failed: $($_.Exception.Message)" }
if (-not $script:winrt) {
  try {
    Add-Type -AssemblyName System.Speech
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $v = $synth.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -like 'ar*' } | Select-Object -First 1
    if ($v) { $synth.SelectVoice($v.VoiceInfo.Name); $synth.Rate = -1; $script:sapi = $synth; Log "SAPI voice: $($v.VoiceInfo.Name)" }
    else { Log 'SAPI: no Arabic voice; WAV only' }
  } catch { Log "SAPI init failed: $($_.Exception.Message)" }
}
function Get-TtsWav([string]$text) {
  if (-not $script:winrt -or [string]::IsNullOrWhiteSpace($text)) { return $null }
  $md5 = [System.Security.Cryptography.MD5]::Create()
  $hash = ([System.BitConverter]::ToString($md5.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($text)))).Replace('-', '').ToLower()
  $wav = Join-Path $ttsCache ($hash + '.wav')
  if (Test-Path -LiteralPath $wav) { return $wav }
  try {
    $op = $script:winrt.SynthesizeTextToStreamAsync($text)
    $task = $script:asTask.MakeGenericMethod([Windows.Media.SpeechSynthesis.SpeechSynthesisStream]).Invoke($null, @($op))
    $task.Wait(10000) | Out-Null
    $stream = $task.Result
    $net = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream.GetInputStreamAt(0))
    $fs = [System.IO.File]::Create($wav); $net.CopyTo($fs); $fs.Dispose(); $net.Dispose(); $stream.Dispose()
    return $wav
  } catch { Log "WinRT synth failed: $($_.Exception.Message)"; return $null }
}

$script:player = New-Object System.Media.SoundPlayer
$script:media = $null
try { Add-Type -AssemblyName PresentationCore; $script:media = New-Object System.Windows.Media.MediaPlayer } catch { Log "MediaPlayer init failed: $($_.Exception.Message)" }
function Play-Wav([string]$path) {
  # يقبل WAV مباشرة، وm4a/mp3 (صيغة Sound Recorder الافتراضية) عبر MediaPlayer
  if ([string]::IsNullOrEmpty($path) -or -not (Test-Path -LiteralPath $path)) { return $false }
  $ext = [IO.Path]::GetExtension($path).ToLower()
  try {
    if ($ext -eq '.wav') { if ($script:media) { $script:media.Stop() }; $script:player.Stop(); $script:player.SoundLocation = $path; $script:player.Load(); $script:player.Play(); return $true }
    if ($script:media) { $script:player.Stop(); $script:media.Stop(); $script:media.Open([Uri]$path); $script:media.Play(); return $true }
    return $false
  } catch { Log "Play failed: $path $($_.Exception.Message)"; return $false }
}
function Find-Recording([string]$dir, [string]$name) {
  foreach ($ext in '.wav', '.m4a', '.mp3', '.wma') { $p = Join-Path $dir ($name + $ext); if (Test-Path -LiteralPath $p) { return $p } }
  return $null
}
function Say([string]$text, [string]$wavName, [string]$wavDir = $sounds) {
  if ($wavName) {
    $wav = Find-Recording $wavDir $wavName
    if ($wav -and (Play-Wav $wav)) { return }
  }
  if (-not $text) { return }
  $gen = Get-TtsWav $text
  if ($gen -and (Play-Wav $gen)) { return }
  if ($script:sapi) { try { $script:sapi.SpeakAsyncCancelAll(); $script:sapi.SpeakAsync($text) | Out-Null } catch {} }
}

# ---------- التسجيل عبر winmm (بلا برامج إضافية) ----------
if (-not ('Win32.MCI' -as [type])) {
  Add-Type -Namespace Win32 -Name MCI -MemberDefinition '[DllImport("winmm.dll", CharSet=CharSet.Unicode)] public static extern int mciSendString(string cmd, System.Text.StringBuilder ret, int retLen, IntPtr hwnd);'
}
function Mci([string]$cmd) { $sb = New-Object System.Text.StringBuilder 256; return [Win32.MCI]::mciSendString($cmd, $sb, 256, [IntPtr]::Zero) }
$script:recording = $false
function Start-Rec {
  if ($script:recording) { return $false }
  $rc = Mci 'open new type waveaudio alias rec'
  if ($rc -ne 0) { Log "MCI open failed $rc"; return $false }
  Mci 'set rec time format ms bitspersample 16 channels 1 samplespersec 22050 bytespersec 44100 alignment 2' | Out-Null
  $rc = Mci 'record rec'
  if ($rc -ne 0) { Mci 'close rec' | Out-Null; Log "MCI record failed $rc"; return $false }
  $script:recording = $true; return $true
}
function Stop-Rec([string]$savePath) {
  if (-not $script:recording) { return $false }
  Mci 'stop rec' | Out-Null
  $rc = Mci ('save rec "' + $savePath + '"')
  Mci 'close rec' | Out-Null
  $script:recording = $false
  if ($rc -ne 0) { Log "MCI save failed $rc"; return $false }
  return (Test-Path -LiteralPath $savePath)
}

# ---------- التشغيل ----------
function Launch($tile) {
  $t = Expand $tile.target
  $a = Expand $tile.args
  Log "Launch $($tile.id) kind=$($tile.kind) target=$t args=$a"
  try {
    switch ($tile.kind) {
      'folder' { if (-not (Test-Path -LiteralPath $t)) { New-Item -ItemType Directory -Path $t -Force | Out-Null }; Start-Process -FilePath 'explorer.exe' -ArgumentList ('"' + $t + '"') }
      'url'    { Start-Process -FilePath $cfg.edge -ArgumentList $t }
      'appid'  { Start-Process -FilePath 'explorer.exe' -ArgumentList ('shell:AppsFolder\' + $t) }
      'speech' { Show-SpeechStation }
      default  { if ($a) { Start-Process -FilePath $t -ArgumentList $a } else { Start-Process -FilePath $t } }
    }
  } catch { Log "Launch failed: $($_.Exception.Message)"; [System.Windows.Forms.MessageBox]::Show('تعذّر فتح هذا النشاط. أخبر بابا أو ماما.', 'مدرستي', 'OK', 'Information') | Out-Null }
}

function New-Color([string]$hex) { try { return [System.Drawing.ColorTranslator]::FromHtml($hex) } catch { return [System.Drawing.Color]::SteelBlue } }

# ---------- محطة تمارين أستاذ النطق ----------
function Get-CurrentWeekFolder {
  $base = Join-Path $school 'تمارين أستاذ النطق'
  if (-not (Test-Path -LiteralPath $base)) { return $null }
  $weeks = Get-ChildItem -LiteralPath $base -Directory | Where-Object { $_.Name -like 'الأسبوع-*' } | Sort-Object Name -Descending
  if ($weeks) { return $weeks[0].FullName }
  return $null
}
function Show-SpeechStation {
  $week = Get-CurrentWeekFolder
  if (-not $week) { [System.Windows.Forms.MessageBox]::Show('لا توجد تمارين هذا الأسبوع بعد. اطلب من بابا أو ماما إضافة كلمات الأسبوع.', 'تمارين أستاذ النطق', 'OK', 'Information') | Out-Null; return }
  $wordsFile = Join-Path $week 'الكلمات.txt'
  if (-not (Test-Path -LiteralPath $wordsFile)) { [System.Windows.Forms.MessageBox]::Show('ملف الكلمات.txt غير موجود في مجلد الأسبوع.', 'تمارين أستاذ النطق', 'OK', 'Information') | Out-Null; return }
  $words = Get-Content -LiteralPath $wordsFile -Encoding UTF8 | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }
  $recDir = Join-Path $school 'تسجيلاتي'
  if (-not (Test-Path -LiteralPath $recDir)) { New-Item -ItemType Directory -Path $recDir -Force | Out-Null }
  $progress = Join-Path $school 'سجل التقدم.csv'
  if (-not (Test-Path -LiteralPath $progress)) { 'التاريخ,الأسبوع,الكلمة,التقييم' | Set-Content -LiteralPath $progress -Encoding UTF8 }
  $weekName = Split-Path $week -Leaf

  $f = New-Object System.Windows.Forms.Form
  $f.Text = 'تمارين أستاذ النطق - ' + $weekName
  $f.RightToLeft = 'Yes'; $f.RightToLeftLayout = $true
  $f.WindowState = 'Maximized'; $f.BackColor = [System.Drawing.Color]::FromArgb(250, 250, 245)
  $f.Font = New-Object System.Drawing.Font('Segoe UI', 16)
  $f.KeyPreview = $true
  $f.Add_KeyDown({ param($s, $e) if ($e.KeyCode -eq 'Escape') { $s.Close() } })

  $top = New-Object System.Windows.Forms.Label
  $top.Text = 'اسمع الكلمة، ثم قلها بصوتك، ثم اسمع نفسك'
  $top.Dock = 'Top'; $top.Height = 70; $top.TextAlign = 'MiddleCenter'
  $top.Font = New-Object System.Drawing.Font('Segoe UI', 22, [System.Drawing.FontStyle]::Bold)
  $top.ForeColor = [System.Drawing.Color]::FromArgb(40, 53, 147)

  $close = New-Object System.Windows.Forms.Button
  $close.Text = 'رجوع'; $close.Dock = 'Bottom'; $close.Height = 60
  $close.Font = New-Object System.Drawing.Font('Segoe UI', 18, [System.Drawing.FontStyle]::Bold)
  $close.Add_Click({ $f.Close() })

  $flow = New-Object System.Windows.Forms.FlowLayoutPanel
  $flow.Dock = 'Fill'; $flow.AutoScroll = $true; $flow.FlowDirection = 'TopDown'; $flow.WrapContents = $false
  $flow.RightToLeft = 'Yes'

  foreach ($w in $words) {
    $word = $w
    $row = New-Object System.Windows.Forms.Panel
    $row.Width = 1400; $row.Height = 120; $row.Margin = New-Object System.Windows.Forms.Padding(10)
    $row.BackColor = [System.Drawing.Color]::White
    $row.BorderStyle = 'FixedSingle'

    $pic = New-Object System.Windows.Forms.PictureBox
    $pic.Size = New-Object System.Drawing.Size(110, 110); $pic.Location = New-Object System.Drawing.Point(5, 5)
    $pic.SizeMode = 'Zoom'
    foreach ($ext in '.png', '.jpg', '.jpeg', '.webp') { $ip = Join-Path $week ($word + $ext); if (Test-Path -LiteralPath $ip) { try { $pic.Image = [System.Drawing.Image]::FromFile($ip) } catch {}; break } }

    $lbl = New-Object System.Windows.Forms.Label
    $lbl.Text = $word; $lbl.Location = New-Object System.Drawing.Point(125, 5); $lbl.Size = New-Object System.Drawing.Size(360, 110)
    $lbl.TextAlign = 'MiddleLeft'; $lbl.Font = New-Object System.Drawing.Font('Segoe UI', 30, [System.Drawing.FontStyle]::Bold)

    $x = 500
    $mk = { param($text, $color, $w) $b = New-Object System.Windows.Forms.Button; $b.Text = $text; $b.Size = New-Object System.Drawing.Size($w, 90); $b.Location = New-Object System.Drawing.Point($x, 15); $b.FlatStyle = 'Flat'; $b.BackColor = $color; $b.ForeColor = 'White'; $b.Font = New-Object System.Drawing.Font('Segoe UI', 16, [System.Drawing.FontStyle]::Bold); return $b }

    $bHear = & $mk 'اسمع' (New-Color '#2E7D32') 150; $x += 160
    $bHear.Tag = $word
    $bHear.Add_Click({ Say $this.Tag $this.Tag $week })

    $bRec = & $mk 'سجّل (4 ث)' (New-Color '#C62828') 190; $x += 200
    $bPlay = & $mk 'اسمع صوتي' (New-Color '#1565C0') 190; $x += 200
    $latest = Join-Path $recDir ($word + '.latest.txt')
    $bRec.Tag = @{ Word = $word; Latest = $latest }
    $bRec.Add_Click({
      $d = $this.Tag; $btn = $this
      if (-not (Start-Rec)) { [System.Windows.Forms.MessageBox]::Show('تعذّر التسجيل. تأكد من الميكروفون.', 'تسجيل', 'OK', 'Information') | Out-Null; return }
      $btn.Text = '... يسجّل'; $btn.Enabled = $false
      $tm = New-Object System.Windows.Forms.Timer; $tm.Interval = 4000
      $tm.Tag = @{ Button = $btn; Word = $d.Word; Latest = $d.Latest }
      $tm.Add_Tick({
        $this.Stop(); $i = $this.Tag
        $file = Join-Path $recDir ((Get-Date -Format 'yyyy-MM-dd-HHmmss') + '-' + $i.Word + '.wav')
        if (Stop-Rec $file) { Set-Content -LiteralPath $i.Latest -Value $file -Encoding UTF8; Log "Recorded $file" }
        $i.Button.Text = 'سجّل (4 ث)'; $i.Button.Enabled = $true
        $this.Dispose()
      })
      $tm.Start()
    })
    $bPlay.Tag = $latest
    $bPlay.Add_Click({ if (Test-Path -LiteralPath $this.Tag) { $p = Get-Content -LiteralPath $this.Tag -Raw -Encoding UTF8; Play-Wav $p.Trim() | Out-Null } else { Say 'سجّل صوتك أولًا' $null } })

    $bOk = & $mk 'قالها' (New-Color '#388E3C') 110; $x += 120
    $bMid = & $mk 'تقريبًا' (New-Color '#F9A825') 120; $x += 130
    $bNo = & $mk 'لم يقلها' (New-Color '#757575') 130
    $bOk.Tag = @{ Word = $word; Rate = 'نعم' }; $bMid.Tag = @{ Word = $word; Rate = 'جزئيًا' }; $bNo.Tag = @{ Word = $word; Rate = 'لا' }
    $rateHandler = { $d = $this.Tag; ('{0},{1},{2},{3}' -f (Get-Date -Format 'yyyy-MM-dd'), $weekName, $d.Word, $d.Rate) | Add-Content -LiteralPath $progress -Encoding UTF8; Say 'أحسنت' 'احسنت' }
    $bOk.Add_Click($rateHandler); $bMid.Add_Click($rateHandler); $bNo.Add_Click($rateHandler)

    $row.Controls.AddRange(@($pic, $lbl, $bHear, $bRec, $bPlay, $bOk, $bMid, $bNo))
    $flow.Controls.Add($row)
  }
  $f.Controls.Add($flow); $f.Controls.Add($top); $f.Controls.Add($close)
  $f.ShowDialog() | Out-Null
  $f.Dispose()
}

# ---------- النافذة الرئيسية ----------
$form = New-Object System.Windows.Forms.Form
$form.Text = $cfg.title
$form.RightToLeft = 'Yes'; $form.RightToLeftLayout = $true
$form.FormBorderStyle = 'None'; $form.WindowState = 'Maximized'
$form.BackColor = [System.Drawing.Color]::FromArgb(236, 239, 241)
$form.KeyPreview = $true
$form.Add_KeyDown({ param($s, $e) if ($e.Control -and $e.Shift -and $e.KeyCode -eq 'Q') { Log 'Exit by hotkey'; $s.Close() } })

$header = New-Object System.Windows.Forms.Label
$header.Text = $cfg.title
$header.Dock = 'Top'; $header.Height = 90; $header.TextAlign = 'MiddleCenter'
$header.Font = New-Object System.Drawing.Font('Segoe UI', 34, [System.Drawing.FontStyle]::Bold)
$header.ForeColor = [System.Drawing.Color]::FromArgb(38, 50, 56)

$footer = New-Object System.Windows.Forms.Panel
$footer.Dock = 'Bottom'; $footer.Height = 50
$adult = New-Object System.Windows.Forms.Label
$adult.Text = 'للكبار'; $adult.AutoSize = $true; $adult.ForeColor = [System.Drawing.Color]::FromArgb(176, 190, 197)
$adult.Font = New-Object System.Drawing.Font('Segoe UI', 10); $adult.Location = New-Object System.Drawing.Point(10, 15)
$script:adultClicks = @()
$adult.Add_Click({
  $now = Get-Date
  $script:adultClicks = @($script:adultClicks | Where-Object { ($now - $_).TotalSeconds -lt 3 }) + $now
  if ($script:adultClicks.Count -ge 5) { Log 'Exit by corner clicks'; $form.Close() }
})
$footer.Controls.Add($adult)

$grid = New-Object System.Windows.Forms.TableLayoutPanel
$grid.Dock = 'Fill'; $grid.ColumnCount = [int]$cfg.columns; $grid.RowCount = [int]$cfg.rows
$grid.Padding = New-Object System.Windows.Forms.Padding(30, 10, 30, 10)
$colPct = [single](100 / $grid.ColumnCount); $rowPct = [single](100 / $grid.RowCount)
for ($i = 0; $i -lt $grid.ColumnCount; $i++) { $grid.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]::Percent, $colPct))) | Out-Null }
for ($i = 0; $i -lt $grid.RowCount; $i++) { $grid.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::Percent, $rowPct))) | Out-Null }

$script:lastHover = @{}
foreach ($tile in $cfg.tiles) {
  $t = $tile
  $b = New-Object System.Windows.Forms.Button
  $b.Text = $t.label
  $b.Dock = 'Fill'; $b.Margin = New-Object System.Windows.Forms.Padding(14)
  $b.FlatStyle = 'Flat'; $b.FlatAppearance.BorderSize = 0
  $b.BackColor = New-Color $t.color; $b.ForeColor = [System.Drawing.Color]::White
  $b.Font = New-Object System.Drawing.Font('Segoe UI', 24, [System.Drawing.FontStyle]::Bold)
  $b.TextImageRelation = 'ImageAboveText'; $b.TextAlign = 'BottomCenter'; $b.ImageAlign = 'TopCenter'
  $b.Cursor = [System.Windows.Forms.Cursors]::Hand
  $b.Padding = New-Object System.Windows.Forms.Padding(0, 10, 0, 14)
  foreach ($ext in '.png', '.jpg') {
    $ip = Join-Path $images ($t.id + $ext)
    if (Test-Path -LiteralPath $ip) { try { $img = [System.Drawing.Image]::FromFile($ip); $b.Image = New-Object System.Drawing.Bitmap($img, (New-Object System.Drawing.Size(160, 160))) } catch {}; break }
  }
  $b.Tag = $t
  $b.Add_MouseEnter({
    $tile = $this.Tag; $k = $tile.id; $now = Get-Date
    if (-not $script:lastHover.ContainsKey($k) -or ($now - $script:lastHover[$k]).TotalSeconds -gt 2) { $script:lastHover[$k] = $now; Say $tile.label $tile.sound }
  })
  $b.Add_Click({ $tile = $this.Tag; Say $tile.label $tile.sound; Launch $tile })
  $grid.Controls.Add($b)
}

$form.Controls.Add($grid); $form.Controls.Add($header); $form.Controls.Add($footer)
$form.Add_Shown({ $form.Activate(); Say 'أهلًا غيث' 'اهلا-غيث' })
if ($env:LAUNCHER_AUTOCLOSE) {
  $auto = New-Object System.Windows.Forms.Timer; $auto.Interval = [int]$env:LAUNCHER_AUTOCLOSE * 1000
  $auto.Add_Tick({ $auto.Stop(); Log ("Autoclose after test; tiles=" + $grid.Controls.Count); $form.Close() }); $auto.Start()
}
Log 'Launcher started'
[System.Windows.Forms.Application]::Run($form)
Log 'Launcher closed'
