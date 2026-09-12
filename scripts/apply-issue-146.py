from pathlib import Path

app_path = Path("src/App.tsx")
app = app_path.read_text(encoding="utf-8")

import_anchor = 'import CloudLibrary from "./CloudLibrary";\n'
import_line = 'import HeaderUtilityMenu from "./HeaderUtilityMenu";\n'
if import_line not in app:
    if import_anchor not in app:
        raise SystemExit("Could not find App.tsx import anchor")
    app = app.replace(import_anchor, import_anchor + import_line, 1)

new_header_marker = '        <div className="header-actions workspace-header-actions">'
if new_header_marker not in app:
    old_header_marker = '        <div className="header-actions">\n          {PUBLISHER_API_URL && ('
    start = app.find(old_header_marker)
    if start < 0:
        raise SystemExit("Could not find workspace header actions")
    end_marker = '        </div>\n      </header>'
    end = app.find(end_marker, start)
    if end < 0:
        raise SystemExit("Could not find workspace header end")
    old_block = app[start : end + len('        </div>')]
    for required in (
        "Biblioteca online",
        "Exportar cópia de segurança",
        "Importar cópia de segurança",
        "Exportar PDF para celular",
        "backupInputRef",
    ):
        if required not in old_block:
            raise SystemExit(f"Unexpected workspace header: missing {required}")

    new_block = '''        <div className="header-actions workspace-header-actions">
          {PUBLISHER_API_URL && (
            <button className="backup-button cloud-trigger" onClick={() => setCloudOpen((open) => !open)}>
              Biblioteca online
            </button>
          )}
          <HeaderUtilityMenu
            onExportBackup={exportBackup}
            onImportBackup={() => backupInputRef.current?.click()}
            onExportPdf={(trigger) => setPdfTrigger(trigger)}
          />
          <input
            ref={backupInputRef}
            className="backup-input"
            type="file"
            accept="application/json,.json"
            onChange={importBackup}
            aria-label="Importar cópia de segurança do Psaltikon"
          />
        </div>'''
    app = app[:start] + new_block + app[end + len('        </div>') :]

app_path.write_text(app, encoding="utf-8")

guide_path = Path("src/AppGuide.tsx")
guide = guide_path.read_text(encoding="utf-8")
replacements = (
    (
        "          <strong>Exportar PDF para celular</strong> prepara os hinos",
        "          Em <strong>Mais ações (⋯)</strong>, <strong>Exportar PDF para celular</strong> prepara os hinos",
    ),
    (
        "          <strong>Exportar cópia de segurança</strong> baixa um arquivo",
        "          Em <strong>Mais ações (⋯)</strong>, <strong>Exportar cópia de segurança</strong> baixa um arquivo",
    ),
    (
        "          <strong>Importar cópia de segurança</strong> recupera um arquivo",
        "          No mesmo menu, <strong>Importar cópia de segurança</strong> recupera um arquivo",
    ),
)
for old, new in replacements:
    if new in guide:
        continue
    if guide.count(old) != 1:
        raise SystemExit(f"Expected exactly one guide occurrence: {old.strip()}")
    guide = guide.replace(old, new, 1)
guide_path.write_text(guide, encoding="utf-8")
