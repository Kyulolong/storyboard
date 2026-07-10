@echo off
REM Prefer the system Node (Program Files\nodejs); fall back to the session portable Node.
set "SYS_NODE=%ProgramFiles%\nodejs"
set "PORT_NODE=C:\Users\user\AppData\Local\Temp\claude\D--Develop-storyboard\c440c995-0eb8-4c05-b424-f5d3bc564a29\scratchpad\node\node-v24.18.0-win-x64"
if exist "%SYS_NODE%\node.exe" (
  set "PATH=%SYS_NODE%;%PATH%"
) else (
  set "PATH=%PORT_NODE%;%PATH%"
)
call npm run dev
