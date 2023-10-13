@echo off
:_RUNNIG
node main.js
if %errorlevel% == 0 (
    echo success
) else (
    echo error, restarting running...
    goto _RUNNIG
)
pause