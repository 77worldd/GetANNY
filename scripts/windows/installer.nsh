; Only native-host manifests and extension files are prepared. Browser security
; and consent are not bypassed: no policies, profile edits or silent add-on installs.
!macro customInstall
  DetailPrint "Preparing GetANNY browser connection files for this user..."
  ExecWait '"$INSTDIR\GetANNY.exe" --setup-browser-hosts --quiet' $0
  ${If} $0 != 0
    DetailPrint "Browser preparation needs attention. Use Browser integration after launching GetANNY."
  ${EndIf}
!macroend
!macro customUnInstall
  ${IfNot} ${isUpdated}
    DetailPrint "Removing GetANNY native messaging registrations for this user..."
    ; ExecWait tracks the actual GUI-subsystem Electron helper until it exits;
    ; the app records browser-uninstall-report.json in its own user-data root.
    ExecWait '"$INSTDIR\GetANNY.exe" --unregister-browser-hosts --quiet' $0
    ${If} $0 != 0
      DetailPrint "Some browser bridge files were locked. Close browsers to remove remaining files."
    ${EndIf}
  ${EndIf}
!macroend
