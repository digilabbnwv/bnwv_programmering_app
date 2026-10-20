@echo off
rem Start de standalone Node uit node_bin\. Zie npm.cmd.
setlocal
set "PATH=%~dp0node_bin;%PATH%"
"%~dp0node_bin\node.exe" %*
exit /b %ERRORLEVEL%
