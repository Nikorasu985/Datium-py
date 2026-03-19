$ErrorActionPreference = 'Stop'

$ProjectRoot = 'C:\Users\Nico9\OneDrive\Escritorio\Datium-py'
$DjangoRoot = Join-Path $ProjectRoot 'Datium'
$PythonExe = Join-Path $ProjectRoot 'venv\Scripts\python.exe'
$EnvFile = Join-Path $ProjectRoot '.env'
$MysqlAdmin = 'C:\xampp\mysql\bin\mysqladmin.exe'
$MysqlExe = 'C:\xampp\mysql\bin\mysql.exe'
$MysqlServer = 'C:\xampp\mysql\bin\mysqld.exe'
$MysqlDefaults = 'C:\xampp\mysql\bin\my.ini'
$DatiumUrl = 'http://127.0.0.1:8000/'
$DatiumHost = '127.0.0.1'
$DatiumPort = 8000
$LogDir = Join-Path $ProjectRoot 'runtime'
$LogFile = Join-Path $LogDir 'datium-server.log'
$ErrFile = Join-Path $LogDir 'datium-server.err.log'

if (!(Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }

function Load-EnvFile($path) {
    $map = @{}
    if (Test-Path $path) {
        Get-Content $path | ForEach-Object {
            $line = $_.Trim()
            if (-not $line -or $line.StartsWith('#') -or -not $line.Contains('=')) { return }
            $idx = $line.IndexOf('=')
            $key = $line.Substring(0, $idx).Trim()
            $value = $line.Substring($idx + 1).Trim()
            $map[$key] = $value
            [System.Environment]::SetEnvironmentVariable($key, $value, 'Process')
        }
    }
    return $map
}

function Test-PortListening($port) {
    try {
        $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop | Select-Object -First 1
        return $null -ne $conn
    } catch {
        return $false
    }
}

function Invoke-MySqlAdminPing($user, $password, $dbHost, $dbPort) {
    $args = @('ping', '-h', $dbHost, '-P', $dbPort, '-u', $user)
    if ($password) { $args += "--password=$password" }
    & $MysqlAdmin @args | Out-Null
    return ($LASTEXITCODE -eq 0)
}

function Ensure-MySql($envMap) {
    $dbHost = if ($envMap['MYSQL_HOST']) { $envMap['MYSQL_HOST'] } else { '127.0.0.1' }
    $dbPort = if ($envMap['MYSQL_PORT']) { $envMap['MYSQL_PORT'] } else { '3306' }
    $dbUser = if ($envMap['MYSQL_USER']) { $envMap['MYSQL_USER'] } else { 'root' }
    $dbPass = if ($envMap.ContainsKey('MYSQL_PASSWORD')) { $envMap['MYSQL_PASSWORD'] } else { '' }
    $dbName = if ($envMap['MYSQL_DATABASE']) { $envMap['MYSQL_DATABASE'] } else { 'datium' }

    $alive = $false
    try { $alive = Invoke-MySqlAdminPing $dbUser $dbPass $dbHost $dbPort } catch { $alive = $false }

    if (-not $alive) {
        if (Test-Path $MysqlServer) {
            Write-Host 'Iniciando MySQL/XAMPP...'
            Start-Process -FilePath $MysqlServer -WorkingDirectory (Split-Path $MysqlServer) -ArgumentList @("--defaults-file=$MysqlDefaults", '--standalone') -WindowStyle Hidden
            Start-Sleep -Seconds 5
            $alive = Invoke-MySqlAdminPing $dbUser $dbPass $dbHost $dbPort
        }
    }

    if (-not $alive) {
        throw 'No pude levantar MySQL automáticamente.'
    }

    $createArgs = @('-h', $dbHost, '-P', $dbPort, '-u', $dbUser)
    if ($dbPass) { $createArgs += "--password=$dbPass" }
    $createArgs += @('-e', "CREATE DATABASE IF NOT EXISTS $dbName CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
    & $MysqlExe @createArgs | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'No pude asegurar la base de datos datium.' }
    Write-Host "Base de datos lista: $dbName"
}

function Ensure-OpenClaw() {
    try {
        openclaw gateway status | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'status failed' }
        Write-Host 'OpenClaw ya está activo.'
    } catch {
        Write-Host 'Iniciando OpenClaw gateway...'
        openclaw gateway start | Out-Null
    }
}

function Ensure-Datium() {
    if (!(Test-Path $PythonExe)) { throw "Python del venv no encontrado: $PythonExe" }

    Push-Location $DjangoRoot
    try {
        & $PythonExe manage.py migrate
        if ($LASTEXITCODE -ne 0) { throw 'Falló migrate.' }

        if (Test-PortListening $DatiumPort) {
            Write-Host 'Datium ya está activo en 127.0.0.1:8000.'
        } else {
            Write-Host 'Iniciando Datium...'
            Start-Process -FilePath $PythonExe -WorkingDirectory $DjangoRoot -ArgumentList @('manage.py', 'runserver', "$DatiumHost`:$DatiumPort") -RedirectStandardOutput $LogFile -RedirectStandardError $ErrFile -WindowStyle Hidden
            Start-Sleep -Seconds 4
        }
    } finally {
        Pop-Location
    }
}

$envMap = Load-EnvFile $EnvFile
Ensure-MySql $envMap
Ensure-OpenClaw
Ensure-Datium
Start-Process $DatiumUrl
Write-Host 'Datium listo.'
