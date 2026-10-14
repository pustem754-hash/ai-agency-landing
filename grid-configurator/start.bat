@echo off
REM ВАЖНО: этот файл сохранён в кодировке CP866 (OEM 866).
REM Если пересохранить его в UTF-8, cmd развалит русские строки на команды.
title GRID - 3D-konfigurator
setlocal
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo [!] Не найден Node.js / npm.
  echo     Поставь Node 20+ с https://nodejs.org и запусти снова.
  echo.
  pause
  exit /b 1
)

REM Порт занят - значит сервер уже поднят. Открываем браузер и говорим об этом,
REM а не закрываемся молча.
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul
if not errorlevel 1 (
  echo.
  echo [i] Сервер уже работает: http://127.0.0.1:5173/
  echo     Открываю браузер. Второй сервер не поднимаю.
  echo.
  start "" http://127.0.0.1:5173/
  echo Нажми любую клавишу, чтобы закрыть это окно.
  pause >nul
  exit /b 0
)

if not exist "node_modules" (
  echo.
  echo [1/2] Первый запуск: ставлю зависимости. Это 1-2 минуты...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [!] npm install упал. Смотри ошибку выше.
    pause
    exit /b 1
  )
)

echo.
echo [2/2] Поднимаю сервер: http://127.0.0.1:5173/
echo      Браузер откроется сам. Чтобы остановить - закрой это окно или Ctrl+C.
echo.

REM Адрес задан явно: без --host сервер садится только на IPv6 (::1),
REM и часть браузеров и утилит по localhost туда не достучится.
REM --open открывает браузер, когда сервер готов принимать запросы.
call npm run dev -- --host 127.0.0.1 --port 5173 --strictPort --open

echo.
echo [i] Сервер остановлен.
echo     Если он не запускался - смотри сообщение выше.
echo.
pause >nul

endlocal
