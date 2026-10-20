@echo off
rem Start npx met de standalone Node uit node_bin\. Zie npm.cmd.
setlocal
set "PATH=%~dp0node_bin;%PATH%"
call "%~dp0node_bin\npx.cmd" %*
exit /b %ERRORLEVEL%
