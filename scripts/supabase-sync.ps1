param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRef,

  [string]$DiffName = ("auto_" + (Get-Date -Format "yyyyMMdd_HHmmss")),

  [ValidateSet("linked","local")]
  [string]$DiffTarget = "linked"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $PSCommandPath
$RepoRoot = Split-Path -Parent $ScriptDir

function Validate-ProjectRef([string]$Ref) {
  if ($Ref -notmatch '^[a-z0-9]{20}$') {
    Fail "check:project-ref" "Invalid project ref format. Expected 20 lowercase letters/numbers like 'abcdefghijklmnopqrst'."
  }
}

function Write-Status([string]$Level, [string]$Step, [string]$Detail = "") {
  $ts = (Get-Date).ToString("s")
  if ($Detail) {
    Write-Host "[$Level] $ts $Step :: $Detail"
  } else {
    Write-Host "[$Level] $ts $Step"
  }
}

function Fail([string]$Step, [string]$Message, [int]$Code = 1) {
  Write-Status "ERR" $Step $Message
  exit $Code
}

function Require-Cmd([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Fail "check:$Name" "$Name not found in PATH"
  }
}

$SupabaseExe = $null
$SupabaseArgsPrefix = @()

function Resolve-SupabaseCli() {
  if (Get-Command "supabase" -ErrorAction SilentlyContinue) {
    $script:SupabaseExe = "supabase"
    $script:SupabaseArgsPrefix = @()
    Write-Status "OK" "check:supabase" "found in PATH"
    return
  }

  $localCmd = Join-Path $RepoRoot "node_modules\\.bin\\supabase.cmd"
  if (Test-Path $localCmd) {
    $script:SupabaseExe = $localCmd
    $script:SupabaseArgsPrefix = @()
    Write-Status "OK" "check:supabase" "found in node_modules\\.bin"
    return
  }

  if (Get-Command "npx" -ErrorAction SilentlyContinue) {
    $script:SupabaseExe = "npx"
    $script:SupabaseArgsPrefix = @("--yes", "supabase")
    Write-Status "OK" "check:supabase" "using npx"
    return
  }

  Fail "check:supabase" "Supabase CLI not found. Install via 'npm install supabase --save-dev' or use npx."
}

function Format-Command([string]$Exe, [string[]]$CmdArgs) {
  if (-not $CmdArgs) { return $Exe }
  $display = @()
  $skipNext = $false
  foreach ($a in $CmdArgs) {
    if ($skipNext) {
      $display += "****"
      $skipNext = $false
      continue
    }
    if ($a -eq "--password") {
      $display += $a
      $skipNext = $true
      continue
    }
    $display += $a
  }
  return $Exe + " " + ($display -join " ")
}

function Invoke-Step(
  [string]$Step,
  [string]$Exe,
  [string[]]$CmdArgs,
  [string]$Stdin = $null,
  [switch]$Interactive
) {
  Write-Status "RUN" $Step (Format-Command $Exe $CmdArgs)
  if ($Interactive) {
    if ($null -ne $Stdin) {
      $null = $Stdin | & $Exe @CmdArgs
    } else {
      $null = & $Exe @CmdArgs
    }
    $code = $LASTEXITCODE
    if ($code -ne 0) {
      Write-Status "ERR" $Step ("exit " + $code)
      exit $code
    }
    Write-Status "OK" $Step
    return
  }

  if ($null -ne $Stdin) {
    $output = $Stdin | & $Exe @CmdArgs 2>&1
  } else {
    $output = & $Exe @CmdArgs 2>&1
  }
  $code = $LASTEXITCODE
  if ($code -ne 0) {
    Write-Status "ERR" $Step ("exit " + $code)
    if ($output) { $output | ForEach-Object { Write-Host $_ } }
    exit $code
  }
  Write-Status "OK" $Step
  if ($output) { $output | ForEach-Object { Write-Host $_ } }
}

function Invoke-Supabase([string]$Step, [string[]]$CmdArgs, [string]$Stdin = $null, [switch]$Interactive) {
  $allArgs = @()
  if ($SupabaseArgsPrefix.Count -gt 0) { $allArgs += $SupabaseArgsPrefix }
  $allArgs += $CmdArgs
  Invoke-Step $Step $SupabaseExe $allArgs $Stdin -Interactive:$Interactive
}

# 1) Verify tools
Require-Cmd "docker"
Resolve-SupabaseCli
try {
  $null = & docker info 2>$null
  if ($LASTEXITCODE -ne 0) { throw "docker info failed" }
  Write-Status "OK" "check:docker" "Docker daemon running"
} catch {
  Fail "check:docker" "Docker daemon not running. Start Docker Desktop (WSL2) and retry."
}

# 2) Init Supabase locally if needed
if (-not (Test-Path "supabase\\config.toml")) {
  Invoke-Supabase "supabase:init" @("init")
} else {
  Write-Status "OK" "supabase:init" "already initialized"
}

# 3) Import SQL files -> local migrations (skip duplicates)
$migrationsDir = "supabase\\migrations"
if (-not (Test-Path $migrationsDir)) {
  New-Item -ItemType Directory -Path $migrationsDir | Out-Null
}

$existingHashes = @{}
Get-ChildItem -Path $migrationsDir -Filter *.sql -File -ErrorAction SilentlyContinue | ForEach-Object {
  $h = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash
  $existingHashes[$h] = $_.Name
}

$sourceDirs = @("sql","migrations") | Where-Object { Test-Path $_ }
if ($sourceDirs.Count -eq 0) {
  Write-Status "OK" "migrations:scan" "no sql/ or migrations/ directories found"
} else {
  $sqlFiles = Get-ChildItem -Path $sourceDirs -Recurse -Filter *.sql -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notlike "*\\supabase\\migrations\\*" }

  if ($sqlFiles.Count -eq 0) {
    Write-Status "OK" "migrations:scan" "no sql files found"
  } else {
    foreach ($file in $sqlFiles) {
      $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $file.FullName).Hash
      if ($existingHashes.ContainsKey($hash)) {
        Write-Status "OK" "migrations:import" ("skip duplicate " + $file.FullName)
        continue
      }
      $safeName = ($file.BaseName -replace '[^a-zA-Z0-9_]+','_').Trim('_')
      if ([string]::IsNullOrWhiteSpace($safeName)) { $safeName = "import_sql" }
      $content = Get-Content -Raw -LiteralPath $file.FullName
      Invoke-Supabase ("migrations:import:" + $file.Name) @("migration","new",$safeName) $content
      $existingHashes[$hash] = $file.Name
    }
  }
}

# 4) Link project
Validate-ProjectRef $ProjectRef
$linkArgs = @("link","--project-ref",$ProjectRef)
if ($env:SUPABASE_DB_PASSWORD) { $linkArgs += @("--password",$env:SUPABASE_DB_PASSWORD) }
if (-not $env:SUPABASE_DB_PASSWORD) {
  Write-Status "WARN" "check:db-password" "SUPABASE_DB_PASSWORD not set; you may be prompted during db diff/push."
}
Invoke-Supabase "supabase:link" $linkArgs -Interactive

# 5) Generate diff migration
$diffArgs = @("db","diff","-f",$DiffName)
if ($DiffTarget -eq "linked") { $diffArgs += "--linked" }
Invoke-Supabase "supabase:db-diff" $diffArgs -Interactive

# 6) Push migrations
Invoke-Supabase "supabase:db-push" @("db","push") -Interactive

Write-Status "OK" "done" "migrations pushed"
