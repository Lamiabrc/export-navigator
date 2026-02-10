param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRef,

  [string]$MigrationName = "cleanup_unused",

  [string[]]$KeepNames = @(),

  [switch]$Execute
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $PSCommandPath
$RepoRoot = Split-Path -Parent $ScriptDir

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

function Validate-ProjectRef([string]$Ref) {
  if ($Ref -notmatch '^[a-z0-9]{20}$') {
    Fail "check:project-ref" "Invalid project ref format. Expected 20 lowercase letters/numbers like 'abcdefghijklmnopqrst'."
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

function Get-ObjectNames([string]$Dump, [string]$Pattern) {
  $set = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  $matches = [regex]::Matches($Dump, $Pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase -bor [System.Text.RegularExpressions.RegexOptions]::Multiline)
  foreach ($m in $matches) {
    $name = $m.Groups[1].Value
    if ($name) { $null = $set.Add($name.ToLowerInvariant()) }
  }
  return $set
}

function Get-CodeFiles([string]$Root) {
  $exts = @(".ts",".tsx",".js",".jsx",".mjs",".cjs",".sql")
  $exclude = @(
    "\\node_modules\\",
    "\\.git\\",
    "\\dist\\",
    "\\build\\",
    "\\.next\\",
    "\\out\\",
    "\\coverage\\",
    "\\public\\",
    "\\supabase\\migrations\\",
    "\\supabase\\_tmp_",
    "\\docs\\"
  )

  return Get-ChildItem -Path $Root -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
    $path = $_.FullName
    if ($exts -notcontains $_.Extension.ToLowerInvariant()) { return $false }
    foreach ($ex in $exclude) {
      if ($path -match $ex) { return $false }
    }
    return $true
  }
}

function Build-TokenSet([System.IO.FileInfo[]]$Files) {
  $set = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  foreach ($f in $Files) {
    try {
      $text = Get-Content -LiteralPath $f.FullName -Raw -ErrorAction Stop
    } catch {
      continue
    }
    $matches = [regex]::Matches($text, '\b[a-zA-Z0-9_]+\b')
    foreach ($m in $matches) {
      $null = $set.Add($m.Value.ToLowerInvariant())
    }
  }
  return $set
}

function Extract-Definition([string]$Dump, [string]$RegexPattern) {
  $m = [regex]::Match($Dump, $RegexPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase -bor [System.Text.RegularExpressions.RegexOptions]::Singleline)
  if ($m.Success) { return $m.Value }
  return $null
}

function Format-SqlArray([string[]]$Items) {
  if (-not $Items -or $Items.Count -eq 0) { return "ARRAY[]::text[]" }
  $escaped = $Items | ForEach-Object { $_.Replace("'", "''") }
  return "ARRAY['" + ($escaped -join "','") + "']::text[]"
}

Write-Status "INFO" "mode" "remote cleanup using code references"
Validate-ProjectRef $ProjectRef
Resolve-SupabaseCli

if (-not $env:SUPABASE_DB_PASSWORD) {
  Write-Status "WARN" "check:db-password" "SUPABASE_DB_PASSWORD not set; you may be prompted."
} elseif ($env:SUPABASE_DB_PASSWORD -match 'ton_mot_de_passe_db|<.*>') {
  Write-Status "WARN" "check:db-password" "SUPABASE_DB_PASSWORD looks like a placeholder. Use the real DB password from Supabase dashboard."
}

Invoke-Supabase "supabase:link" @("link","--project-ref",$ProjectRef) -Interactive

$tmpDir = Join-Path $RepoRoot "supabase\\_tmp"
if (-not (Test-Path $tmpDir)) { New-Item -ItemType Directory -Path $tmpDir | Out-Null }
$dumpPath = Join-Path $tmpDir "schema_public.sql"

$dumpArgs = @("db","dump","--schema","public","--linked","--file",$dumpPath)
if ($env:SUPABASE_DB_PASSWORD) { $dumpArgs += @("--password",$env:SUPABASE_DB_PASSWORD) }
Invoke-Supabase "supabase:db-dump" $dumpArgs -Interactive

$dumpText = Get-Content -LiteralPath $dumpPath -Raw

$tables = Get-ObjectNames $dumpText '(?im)^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)\b'
$views = Get-ObjectNames $dumpText '(?im)^\s*CREATE\s+VIEW\s+(?:public\.)?([a-zA-Z0-9_]+)\b'
$matviews = Get-ObjectNames $dumpText '(?im)^\s*CREATE\s+MATERIALIZED\s+VIEW\s+(?:public\.)?([a-zA-Z0-9_]+)\b'
$functions = Get-ObjectNames $dumpText '(?im)^\s*CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)\b'

$allRelations = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
foreach ($n in $tables) { $null = $allRelations.Add($n) }
foreach ($n in $views) { $null = $allRelations.Add($n) }
foreach ($n in $matviews) { $null = $allRelations.Add($n) }

$codeFiles = Get-CodeFiles $RepoRoot
$tokenSet = Build-TokenSet $codeFiles

$keepNamesSet = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
foreach ($k in $KeepNames) { if ($k) { $null = $keepNamesSet.Add($k.ToLowerInvariant()) } }

$keepRelations = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
foreach ($name in $allRelations) {
  if ($tokenSet.Contains($name) -or $keepNamesSet.Contains($name)) { $null = $keepRelations.Add($name) }
}

$keepFunctions = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
foreach ($name in $functions) {
  if ($tokenSet.Contains($name) -or $keepNamesSet.Contains($name)) { $null = $keepFunctions.Add($name) }
}

# Expand keep tables based on view/function definitions
$keepTables = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
foreach ($t in $tables) { if ($keepRelations.Contains($t)) { $null = $keepTables.Add($t) } }

foreach ($v in $views) {
  if (-not $keepRelations.Contains($v)) { continue }
  $pattern = "(?is)CREATE\\s+VIEW\\s+(?:public\\.)?$([regex]::Escape($v))\\b.*?;"
  $def = Extract-Definition $dumpText $pattern
  if ($def) {
    foreach ($t in $tables) {
      if ($def -match ("\b" + [regex]::Escape($t) + "\b")) { $null = $keepTables.Add($t) }
    }
  }
}

foreach ($v in $matviews) {
  if (-not $keepRelations.Contains($v)) { continue }
  $pattern = "(?is)CREATE\\s+MATERIALIZED\\s+VIEW\\s+(?:public\\.)?$([regex]::Escape($v))\\b.*?;"
  $def = Extract-Definition $dumpText $pattern
  if ($def) {
    foreach ($t in $tables) {
      if ($def -match ("\b" + [regex]::Escape($t) + "\b")) { $null = $keepTables.Add($t) }
    }
  }
}

foreach ($fn in $functions) {
  if (-not $keepFunctions.Contains($fn)) { continue }
  $pattern = "(?is)CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+(?:public\\.)?$([regex]::Escape($fn))\\b.*?\\$\\$.*?\\$\\$;"
  $def = Extract-Definition $dumpText $pattern
  if ($def) {
    foreach ($t in $tables) {
      if ($def -match ("\b" + [regex]::Escape($t) + "\b")) { $null = $keepTables.Add($t) }
    }
  }
}

foreach ($t in $keepTables) { $null = $keepRelations.Add($t) }

$dropTables = $tables | Where-Object { -not $keepRelations.Contains($_) }
$dropViews = $views | Where-Object { -not $keepRelations.Contains($_) }
$dropMatViews = $matviews | Where-Object { -not $keepRelations.Contains($_) }
$dropFunctions = $functions | Where-Object { -not $keepFunctions.Contains($_) }

Write-Status "INFO" "keep:tables" ($keepTables.Count.ToString())
Write-Status "INFO" "keep:relations" ($keepRelations.Count.ToString())
Write-Status "INFO" "keep:functions" ($keepFunctions.Count.ToString())

if ($dropTables.Count -eq 0 -and $dropViews.Count -eq 0 -and $dropMatViews.Count -eq 0 -and $dropFunctions.Count -eq 0) {
  Write-Status "OK" "cleanup" "no objects to drop"
  exit 0
}

Write-Status "WARN" "drop:tables" ($dropTables -join ", ")
Write-Status "WARN" "drop:views" ($dropViews -join ", ")
Write-Status "WARN" "drop:matviews" ($dropMatViews -join ", ")
Write-Status "WARN" "drop:functions" ($dropFunctions -join ", ")

$keepRelArray = Format-SqlArray (($keepRelations | Sort-Object))
$keepFnArray = Format-SqlArray (($keepFunctions | Sort-Object))

$cleanupSql = @"
-- Auto-generated cleanup migration (remote) on $(Get-Date -Format "s")
-- Keep relations: $($keepRelations.Count)
-- Keep functions: $($keepFunctions.Count)

DO \$\$
DECLARE
  keep_relations text[] := $keepRelArray;
  r record;
BEGIN
  -- Drop views and materialized views not in keep list (skip extension-owned objects)
  FOR r IN
    SELECT c.relname AS name, n.nspname AS schema, c.relkind AS kind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_depend d ON d.objid = c.oid AND d.deptype = 'e'
    WHERE n.nspname = 'public'
      AND c.relkind IN ('v','m')
      AND d.objid IS NULL
      AND NOT (c.relname = ANY(keep_relations))
  LOOP
    IF r.kind = 'm' THEN
      EXECUTE format('DROP MATERIALIZED VIEW IF EXISTS %I.%I', r.schema, r.name);
    ELSE
      EXECUTE format('DROP VIEW IF EXISTS %I.%I', r.schema, r.name);
    END IF;
  END LOOP;
END
\$\$;

DO \$\$
DECLARE
  keep_relations text[] := $keepRelArray;
  r record;
BEGIN
  -- Drop tables not in keep list (skip extension-owned objects)
  FOR r IN
    SELECT c.relname AS name, n.nspname AS schema
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_depend d ON d.objid = c.oid AND d.deptype = 'e'
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND d.objid IS NULL
      AND NOT (c.relname = ANY(keep_relations))
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS %I.%I', r.schema, r.name);
  END LOOP;
END
\$\$;

DO \$\$
DECLARE
  keep_functions text[] := $keepFnArray;
  r record;
BEGIN
  -- Drop functions not in keep list (skip extension-owned objects)
  FOR r IN
    SELECT n.nspname AS schema, p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
    WHERE n.nspname = 'public'
      AND d.objid IS NULL
      AND NOT (p.proname = ANY(keep_functions))
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s)', r.schema, r.name, r.args);
  END LOOP;
END
\$\$;
"@

$migrationsDir = Join-Path $RepoRoot "supabase\\migrations"
if (-not (Test-Path $migrationsDir)) { New-Item -ItemType Directory -Path $migrationsDir | Out-Null }
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$migrationFile = Join-Path $migrationsDir ("{0}_{1}.sql" -f $timestamp, $MigrationName)
Set-Content -LiteralPath $migrationFile -Value $cleanupSql -Encoding UTF8

Write-Status "OK" "migration" $migrationFile

if (-not $Execute) {
  Write-Status "WARN" "execute" "Not applied. Re-run with -Execute to push to remote."
  exit 0
}

Invoke-Supabase "supabase:db-push" @("db","push") -Interactive
Write-Status "OK" "done" "cleanup applied"
