@echo off
rem Start npm met de standalone Node uit node_bin\. Door node_bin vooraan in
rem PATH te zetten, gebruiken ook alle npm-scripts (vite, vitest, ...) die Node.
rem Gebruik: .\npm install, .\npm run dev
setlocal
set "PATH=%~dp0node_bin;%PATH%"
call "%~dp0node_bin\npm.cmd" %*
exit /b %ERRORLEVEL%
