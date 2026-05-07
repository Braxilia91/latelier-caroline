$git  = "C:\Users\moura\AppData\Local\GitHubDesktop\app-3.5.8\resources\app\git\cmd\git.exe"
$repo = "C:\Users\moura\OneDrive\Desktop\Projet Caroline\latelier-caroline"

Write-Host "=== 1. Config auteur ===" -ForegroundColor Cyan
& $git -C $repo config user.email "mourad.maziere@gmail.com"
& $git -C $repo config user.name  "Braxilia91"

Write-Host "=== 2. Re-stage tout (propre) ===" -ForegroundColor Cyan
& $git -C $repo add --all
& $git -C $repo restore --staged "vite.config.js.timestamp-1778013210705-8e359d4be1078.mjs" 2>$null
& $git -C $repo restore --staged "src_extracted/" 2>$null

Write-Host "=== 3. Status avant commit ===" -ForegroundColor Cyan
& $git -C $repo status --short

Write-Host "=== 4. Commit ===" -ForegroundColor Cyan
& $git -C $repo commit -m "feat: restore all features — DicoCaroModal, PIN/OTP, sync, tests, VracModal, PlanModal, ambient player"

Write-Host "=== 5. Push ===" -ForegroundColor Cyan
& $git -C $repo push origin main

Write-Host ""
Write-Host "=== DONE ===" -ForegroundColor Green
Write-Host "Derniers commits :" -ForegroundColor Green
& $git -C $repo log --oneline -5
