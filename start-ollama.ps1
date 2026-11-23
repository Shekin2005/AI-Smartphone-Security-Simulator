# ==================================================
# START OLLAMA WITH THE SETTINGS STRIX NEEDS
# ==================================================
# Strix's system prompt plus its 44 tool definitions measured 50,860 tokens.
# Ollama's CPU default window is 4,096, which silently discards most of the
# prompt - the agent then runs with no instructions and no credentials.
#
# OLLAMA_CONTEXT_LENGTH must therefore be larger than the prompt plus room
# for the model to answer. OLLAMA_KV_CACHE_TYPE=q4_0 keeps the KV cache
# small enough for this machine to hold that window at all.
#
# Adjust OLLAMA_MODELS if your model store lives elsewhere.

$env:OLLAMA_MODELS         = 'E:\OllamaModels'
$env:OLLAMA_HOST           = '0.0.0.0:11434'
$env:OLLAMA_CONTEXT_LENGTH = '65536'
$env:OLLAMA_KV_CACHE_TYPE  = 'q4_0'
$env:OLLAMA_LOAD_TIMEOUT   = '15m'

$ollama = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'

if (-not (Test-Path $ollama)) {
    Write-Error "Ollama not found at $ollama"
    exit 1
}

Write-Host "Starting Ollama"
Write-Host "  models   : $env:OLLAMA_MODELS"
Write-Host "  listen   : $env:OLLAMA_HOST"
Write-Host "  context  : $env:OLLAMA_CONTEXT_LENGTH"
Write-Host "  kv cache : $env:OLLAMA_KV_CACHE_TYPE"
Write-Host ""

& $ollama serve
