; NSIS Custom Installer Hooks for Unlim Clout
; Checks for Docker Desktop dependency on target system during setup

!macro NSIS_HOOK_PREINSTALL
  ; Check common registry locations for Docker Desktop
  ClearErrors
  ReadRegStr $0 HKLM "Software\Docker Inc.\Docker Desktop" "InstallPath"
  ${If} $0 != ""
  ${AndIf} ${FileExists} "$0\Docker Desktop.exe"
    Goto DockerFound
  ${EndIf}

  ; Check standard Program Files path
  ${If} ${FileExists} "$PROGRAMFILES\Docker\Docker\Docker Desktop.exe"
    Goto DockerFound
  ${EndIf}

  ${If} ${FileExists} "$PROGRAMFILES64\Docker\Docker\Docker Desktop.exe"
    Goto DockerFound
  ${EndIf}

  ; Check per-user local appdata installation
  ${If} ${FileExists} "$LOCALAPPDATA\Programs\Docker\Docker\Docker Desktop.exe"
    Goto DockerFound
  ${EndIf}

  ; Docker Desktop is not detected on this system
  MessageBox MB_YESNO|MB_ICONINFORMATION "Unlim Clout - Dependency Notice:$\r$\n$\r$\nDocker Desktop is required only for Google Drive & Colab worker integration.$\r$\n$\r$\nIf you do not plan to use this feature, Docker Desktop is not required and you can safely select $\"No$\".$\r$\n$\r$\nWould you like to download the official Docker Desktop installer now?" IDNO SkipDockerDownload
  ExecShell "open" "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"

SkipDockerDownload:
DockerFound:
!macroend
