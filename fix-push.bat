@echo off
setlocal
set GIT=C:\Users\moura\AppData\Local\GitHubDesktop\app-3.5.8\resources\app\git\cmd\git.exe
set REPO=C:\Users\moura\OneDrive\Desktop\Projet Caroline\latelier-caroline

echo === 1. Config auteur ===
"%GIT%" -C "%REPO%" config user.email "mourad.maziere@gmail.com"
"%GIT%" -C "%REPO%" config user.name "Braxilia91"

echo === 2. Stage tout ===
"%GIT%" -C "%REPO%" add --all
"%GIT%" -C "%REPO%" restore --staged "vite.config.js.timestamp-1778013210705-8e359d4be1078.mjs" 2>nul
"%GIT%" -C "%REPO%" restore --staged "src_extracted" 2>nul

echo === 3. Status ===
"%GIT%" -C "%REPO%" status --short

echo === 4. Commit ===
"%GIT%" -C "%REPO%" commit -m "feat: restore all features — DicoCaroModal, PIN/OTP, sync, tests, VracModal, PlanModal, ambient player"

echo === 5. Push ===
"%GIT%" -C "%REPO%" push origin main

echo.
echo === DONE ===
"%GIT%" -C "%REPO%" log --oneline -5
pause
