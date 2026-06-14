@echo off
title SimCO - Restaurant Dashboard
color 0A

echo.
echo  ==========================================
echo   SimCO - Restaurant Dashboard
echo  ==========================================
echo.
echo  Demarrage du serveur...
echo.

:: Aller dans le dossier du fichier bat
cd /d "%~dp0"

:: Verifier que node est installe
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERREUR : Node.js n'est pas installe !
    echo  Telecharge-le sur https://nodejs.org
    echo.
    pause
    exit
)

:: Ouvrir sur Chrome apres 2 secondes
timeout /t 2 >nul
set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
set CHROME86="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

if exist %CHROME% (
    start "" %CHROME% "http://localhost:3001/simco-restaurant.html"
) else if exist %CHROME86% (
    start "" %CHROME86% "http://localhost:3001/simco-restaurant.html"
) else (
    echo  Chrome non trouve, ouverture avec le navigateur par defaut...
    start "" "http://localhost:3001/simco-restaurant.html"
)

:: Lancer le serveur
echo  Serveur demarre sur http://localhost:3001/simco-restaurant.html
echo.
echo  Ne ferme pas cette fenetre !
echo  Pour arreter : ferme cette fenetre ou fais Ctrl+C
echo.
node server-restaurant.js

pause
