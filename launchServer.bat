@echo off
:start
cls
:restart
cls
node server.js %gamemode%
if %errorlevel% == 2 (
    goto restart
)
pause
goto start