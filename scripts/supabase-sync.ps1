param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRef,

  [string]$DiffName = ("auto_" + (Get-Date -Format "yyyyMMdd_HHmmss")),

  [ValidateSet("linked","local")]
  [string]$DiffTarget = "linked"
)

$ErrorActionPreference = "Stop"

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

function Invoke-Step([string]$Step, [string]$Exe, [string[]]$Args, [string]$Stdin = $null) {
  Write-Status "RUN" $Step ($Exe + " " + ($Args -join " "))
  if ($null -ne $Stdin) {
    $output = $Stdin | & $Exe @Args 2>&1
  } else {
    $output = & $Exe @Args 2>&1
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

# 1) Verify tools
Require-Cmd "supabase"
Write-Status "OK" "check:supabase" "found"

Require-Cmd "docker"
try {
  $null = & docker info 2>$null
  if ($LASTEXITCODE -ne 0) { throw "docker info failed" }
  Write-Status "OK" "check:docker" "Docker daemon running"
} catch {
  Fail "check:docker" "Docker daemon not running. Start Docker Desktop (WSL2) and retry."
}

# 2) Init Supabase locally if needed
if (-not (Test-Path "supabase\\config.toml")) {
  Invoke-Step "supabase:init" "supabase" @("init")
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
      Invoke-Step ("migrations:import:" + $file.Name) "supabase" @("migration","new",$safeName) $content
      $existingHashes[$hash] = $file.Name
    }
  }
}

# 4) Link project
$linkArgs = @("link","--project-ref",$ProjectRef)
if ($env:SUPABASE_DB_PASSWORD) { $linkArgs += @("--password",$env:SUPABASE_DB_PASSWORD) }
Invoke-Step "supabase:link" "supabase" $linkArgs

# 5) Generate diff migration
$diffArgs = @("db","diff","-f",$DiffName)
if ($DiffTarget -eq "linked") { $diffArgs += "--linked" }
Invoke-Step "supabase:db-diff" "supabase" $diffArgs

# 6) Push migrations
Invoke-Step "supabase:db-push" "supabase" @("db","push")

Write-Status "OK" "done" "migrations pushed"
