# Check if venv exists
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ScriptDir

# Check if venv is valid (has activate script)
if ((Test-Path ".venv") -and -not (Test-Path ".\.venv\Scripts\Activate.ps1")) {
    Write-Host "⚠️ Found incomplete virtual environment. Removing..."
    Remove-Item ".venv" -Recurse -Force
}

if (-not (Test-Path ".venv")) {
    Write-Host "📦 Creating Python virtual environment..."
    python -m venv .venv
}

# Activate venv
Write-Host "🔌 Activating virtual environment..."
if (Test-Path ".\.venv\Scripts\Activate.ps1") {
    & ".\.venv\Scripts\Activate.ps1"
} else {
    Write-Error "Virtual environment activation script not found!"
    exit 1
}

# Install requirements
Write-Host "⬇️ Installing dependencies..."
pip install -r requirements.txt

# Run training
Write-Host "🚀 Starting training..."
python train.py
