# Builds dist/friend-labels.zip for Chrome Web Store upload
$files = "manifest.json","background.js","content.js","content.css","lib.js","dashboard.html","dashboard.js","dashboard.css","popup.html","popup.js","icon16.png","icon32.png","icon48.png","icon128.png"
New-Item -ItemType Directory -Force dist | Out-Null
Remove-Item dist\friend-labels.zip -ErrorAction SilentlyContinue
Compress-Archive -Path $files -DestinationPath dist\friend-labels.zip
Write-Host "Created dist\friend-labels.zip"
