; Only native-host manifests and extension files are prepared. Browser security
; and consent are not bypassed: no policies, profile edits or silent add-on installs.
!macro customInstall
  DetailPrint "Preparing GetANNY browser connection files for this user..."
  nsExec::ExecToLog '"$INSTDIR\GetANNY.exe" --setup-browser-hosts --quiet'
  Pop $0
  ${If} $0 != 0
    DetailPrint "Browser preparation needs attention. Use Browser integration after launching GetANNY."
  ${EndIf}
!macroend
!macro customUnInstall
  ${IfNot} ${isUpdated}
    DetailPrint "Removing GetANNY native messaging registrations for this user..."
    nsExec::ExecToLog '"$INSTDIR\GetANNY.exe" --unregister-browser-hosts --quiet'
    Pop $0
    ${If} $0 != 0
      DetailPrint "Some browser bridge files were locked. Close browsers to remove remaining files."
    ${EndIf}
  ${EndIf}
!macroend
