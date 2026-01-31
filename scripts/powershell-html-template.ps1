function Generate-HtmlReport {
    param(
        [PSCustomObject]$Report,
        [string]$OutputPath
    )
    
    $gradeColor = switch ($Report.summary.grade) {
        "A" { "#22c55e" }
        "B" { "#84cc16" }
        "C" { "#eab308" }
        "D" { "#f97316" }
        "F" { "#ef4444" }
    }
    
    $targetInfo = if ($Report.metadata.target) { $Report.metadata.target } 
                  elseif ($Report.metadata.hostname) { $Report.metadata.hostname }
                  elseif ($Report.metadata.cluster_name) { "$($Report.metadata.cluster_name) ($($Report.metadata.cluster_ip))" }
                  else { $env:COMPUTERNAME }
    
    $complianceInfo = if ($Report.metadata.compliance) { $Report.metadata.compliance } else { "Security Audit" }
    
    $html = @"
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport d'Audit - Infra Shield Tools</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; line-height: 1.6; }
.container { max-width: 1000px; margin: 0 auto; padding: 24px; }
.header { background: linear-gradient(135deg, #4b5563 0%, #374151 100%); color: white; padding: 32px 40px; border-radius: 12px; margin-bottom: 24px; border: 1px solid #6b7280; }
.header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 16px; }
.header h1 { font-size: 24px; font-weight: 600; margin-bottom: 4px; }
.header .subtitle { opacity: 0.9; font-size: 14px; color: #e5e7eb; }
.header .framework { background: rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 6px; display: inline-block; margin-top: 12px; font-size: 13px; border: 1px solid rgba(255,255,255,0.2); }
.logo { background: white; color: #4b5563; padding: 8px 16px; border-radius: 8px; font-weight: 700; font-size: 14px; white-space: nowrap; }
.summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
.card { background: white; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.score-card { text-align: center; }
.score-circle { width: 140px; height: 140px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 0 auto 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
.score-value { font-size: 42px; font-weight: 700; color: white; line-height: 1; }
.score-label { font-size: 12px; color: rgba(255,255,255,0.9); margin-top: 4px; }
.grade { font-size: 20px; font-weight: 600; margin-top: 8px; color: #374151; }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 16px; }
.stat { text-align: center; padding: 16px 12px; border-radius: 8px; border: 1px solid transparent; }
.stat.pass { background: #f0fdf4; color: #166534; border-color: #bbf7d0; }
.stat.warn { background: #fefce8; color: #854d0e; border-color: #fef08a; }
.stat.fail { background: #fef2f2; color: #991b1b; border-color: #fecaca; }
.stat-value { font-size: 28px; font-weight: 700; line-height: 1; }
.stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
.info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.info-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
.info-label { color: #64748b; font-size: 13px; }
.info-value { font-weight: 500; font-size: 13px; color: #1e293b; text-align: right; }
.section { margin-bottom: 24px; }
.section-title { font-size: 18px; font-weight: 600; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #e5e7eb; color: #374151; }
.category-group { margin-bottom: 24px; }
.category-title { font-size: 14px; font-weight: 600; color: #4b5563; margin-bottom: 12px; padding: 8px 12px; background: #f1f5f9; border-radius: 6px; border-left: 3px solid #4b5563; }
.result-item { background: white; border-radius: 8px; padding: 16px; margin-bottom: 8px; border: 1px solid #e5e7eb; display: grid; grid-template-columns: auto 1fr auto; gap: 16px; align-items: start; }
.result-item.pass { border-left: 3px solid #22c55e; }
.result-item.warn { border-left: 3px solid #eab308; }
.result-item.fail { border-left: 3px solid #ef4444; }
.result-status { width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 600; color: white; font-size: 12px; flex-shrink: 0; }
.result-status.pass { background: #22c55e; }
.result-status.warn { background: #eab308; }
.result-status.fail { background: #ef4444; }
.result-content h4 { font-size: 14px; font-weight: 500; margin-bottom: 4px; color: #1e293b; }
.result-content p { font-size: 13px; color: #64748b; line-height: 1.5; }
.result-content .id { font-family: 'Consolas', 'Monaco', monospace; font-size: 11px; color: #94a3b8; margin-top: 6px; }
.result-badges { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; flex-shrink: 0; }
.badge { padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.3px; white-space: nowrap; }
.badge.critical { background: #fce7f3; color: #be185d; }
.badge.high { background: #fee2e2; color: #b91c1c; }
.badge.medium { background: #fef3c7; color: #b45309; }
.badge.low { background: #f1f5f9; color: #475569; }
.remediation { margin-top: 12px; padding: 12px; background: #f8fafc; border-radius: 6px; font-size: 12px; border: 1px solid #e2e8f0; }
.remediation-label { font-weight: 600; color: #4b5563; margin-bottom: 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
.remediation code { font-family: 'Consolas', 'Monaco', monospace; background: #1e293b; color: #22d3ee; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
.footer { text-align: center; padding: 24px; color: #64748b; font-size: 13px; border-top: 1px solid #e5e7eb; margin-top: 32px; }
.footer a { color: #4b5563; text-decoration: none; font-weight: 500; }
.footer a:hover { text-decoration: underline; }
@media print { body { background: white; } .container { max-width: 100%; padding: 0; } .result-item { break-inside: avoid; } }
@media (max-width: 768px) { .summary-grid { grid-template-columns: 1fr; } .info-grid { grid-template-columns: 1fr; } .result-item { grid-template-columns: auto 1fr; } .result-badges { flex-direction: row; margin-top: 8px; grid-column: 1 / -1; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-top">
                <div>
                    <h1>$($Report.metadata.script_name)</h1>
                    <div class="subtitle">Rapport d'audit de securite genere automatiquement</div>
                    <div class="framework">$complianceInfo</div>
                </div>
                <div class="logo">Infra Shield Tools</div>
            </div>
        </div>
        
        <div class="summary-grid">
            <div class="card score-card">
                <div class="score-circle" style="background: $gradeColor;">
                    <div class="score-value">$($Report.summary.score)%</div>
                    <div class="score-label">Score</div>
                </div>
                <div class="grade">Grade: $($Report.summary.grade)</div>
                <div class="stats">
                    <div class="stat pass">
                        <div class="stat-value">$($Report.summary.passed)</div>
                        <div class="stat-label">Reussis</div>
                    </div>
                    <div class="stat warn">
                        <div class="stat-value">$($Report.summary.warnings)</div>
                        <div class="stat-label">Alertes</div>
                    </div>
                    <div class="stat fail">
                        <div class="stat-value">$($Report.summary.failed)</div>
                        <div class="stat-label">Echecs</div>
                    </div>
                </div>
            </div>
            <div class="card">
                <h3 style="margin-bottom: 16px; color: #374151; font-size: 16px;">Informations Systeme</h3>
                <div class="info-grid">
                    <div class="info-item"><span class="info-label">Cible</span><span class="info-value">$targetInfo</span></div>
                    <div class="info-item"><span class="info-label">Date</span><span class="info-value">$(Get-Date -Format "dd/MM/yyyy HH:mm")</span></div>
                    <div class="info-item"><span class="info-label">Version</span><span class="info-value">$($Report.metadata.version)</span></div>
                    <div class="info-item"><span class="info-label">Niveau</span><span class="info-value">$($Report.metadata.audit_level)</span></div>
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2 class="section-title">Resultats Detailles ($($Report.summary.total_checks) controles)</h2>
"@
    
    $categories = $Report.results | Group-Object -Property category
    foreach ($category in $categories) {
        $html += "<div class='category-group'><div class='category-title'>$($category.Name)</div>"
        foreach ($result in $category.Group) {
            $statusClass = switch ($result.status) { "PASS" { "pass" } "FAIL" { "fail" } "WARN" { "warn" } }
            $statusIcon = switch ($result.status) { "PASS" { "OK" } "FAIL" { "X" } "WARN" { "!" } }
            $html += @"
            <div class="result-item $statusClass">
                <div class="result-status $statusClass">$statusIcon</div>
                <div class="result-content">
                    <h4>$($result.title)</h4>
                    <p>$($result.description)</p>
                    <div class="id">$($result.id)</div>
"@
            if ($result.remediation) {
                $html += "<div class='remediation'><div class='remediation-label'>Remediation</div>$($result.remediation)</div>"
            }
            $html += @"
                </div>
                <div class="result-badges">
                    <span class="badge $($result.severity)">$($result.severity.ToUpper())</span>
                </div>
            </div>
"@
        }
        $html += "</div>"
    }
    
    $html += @"
        </div>
        
        <div class="footer">
            <p>Genere par <a href="https://ist-security.fr">Infra Shield Tools</a></p>
            <p style="margin-top: 8px; font-size: 12px; color: #94a3b8;">www.ist-security.fr</p>
        </div>
    </div>
</body>
</html>
"@
    
    $html | Out-File -FilePath $OutputPath -Encoding UTF8
}
