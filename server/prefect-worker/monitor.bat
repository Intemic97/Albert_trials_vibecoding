@echo off
REM Monitor de ejecuciones de workflows - Windows

echo ========================================
echo Monitor de Ejecuciones de Workflows
echo ========================================
echo.
echo Opciones:
echo   1. Ver ultimas ejecuciones
echo   2. Ver ejecuciones activas (running/pending)
echo   3. Ver logs de una ejecucion especifica
echo   4. Monitoreo en tiempo real (actualiza cada 5s)
echo.

set /p option="Selecciona una opcion (1-4): "

if "%option%"=="1" (
    set /p limit="Cuantas ejecuciones mostrar? (default: 10): "
    if "%limit%"=="" set limit=10
    call venv\Scripts\activate.bat
    python view_executions.py %limit%
    pause
) else if "%option%"=="2" (
    call venv\Scripts\activate.bat
    python view_executions.py active
    pause
) else if "%option%"=="3" (
    set /p exec_id="ID de ejecucion: "
    call venv\Scripts\activate.bat
    python view_executions.py logs %exec_id%
    pause
) else if "%option%"=="4" (
    echo Presiona Ctrl+C para detener...
    echo.
    :loop
    cls
    call venv\Scripts\activate.bat
    python view_executions.py active
    timeout /t 5 /nobreak > nul
    goto loop
) else (
    echo Opcion invalida
    pause
)

