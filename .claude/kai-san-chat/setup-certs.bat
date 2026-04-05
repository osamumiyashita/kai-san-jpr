@echo off
:: Auto-generate HTTPS certs for kai-san-chat (client PC)
:: Uses mkcert for locally-trusted certs. Runs once, then skips.
cd /d "%~dp0"

if exist cert.pem if exist key.pem (
  echo Certs already exist — skipping.
  exit /b 0
)

echo === Generating HTTPS certificates ===

:: Try mkcert first (best — browser-trusted)
where mkcert >nul 2>&1
if %errorlevel%==0 (
  echo Using mkcert...
  mkcert -install >nul 2>&1
  mkcert -key-file key.pem -cert-file cert.pem kai-san-chat localhost 127.0.0.1
  if exist cert.pem (
    echo mkcert: OK — browser-trusted HTTPS ready
    exit /b 0
  )
)

:: Fallback: openssl self-signed (works but browser warns)
where openssl >nul 2>&1
if %errorlevel%==0 (
  echo mkcert not found. Using openssl self-signed...
  openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 825 -nodes -subj "/CN=kai-san-chat" -addext "subjectAltName=DNS:kai-san-chat,DNS:localhost,IP:127.0.0.1" >nul 2>&1
  if exist cert.pem (
    echo openssl: OK — self-signed cert created (browser may warn once)
    exit /b 0
  )
)

:: Fallback: Node.js built-in (last resort)
echo No mkcert or openssl. Using Node.js to generate...
node -e "const{generateKeyPairSync}=require('crypto'),{writeFileSync}=require('fs');const{privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});const forge=null;console.log('Node fallback: use npm selfsigned instead');process.exit(1)" >nul 2>&1

echo WARNING: Could not generate certs. Install mkcert: winget install FiloSottile.mkcert
echo ksc will run in HTTP mode (no HTTPS).
exit /b 1
