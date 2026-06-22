#!/usr/bin/env python3
"""
HATHOR SECURITY AGENT — Regression Scanner (PHASE 2)
Security gate estatico para multi-tenancy. NAO toca dados reais.
APPROVED(0) / WARNINGS(1) / BLOCKED(2). Baseline: Version 000de739.
"""
import sys, re, argparse

TENANT_TABLES = {
    "alunas","pagamentos","config","contratos","parcelas","despesas",
    "turmas","cameras","estoque","emprestimos","alertas","sentimento_alunas",
    "cache_perfil_risco","alertas_motor","saude_motor","logs_ia_agente",
    "logs_performance","logs_seguranca","alertas_saude","metricas_motor",
    "fila_cobrancas","eventos_cobranca",
}
GLOBAL_TABLES = {"escolas","webhooks_recebidos","conciliacao","dashboard_fila"}

TENANT_GUARD = re.compile(r'escola_id')
ID_ACCESS = re.compile(r'\.eq\("(id|aluna_id|contrato_id|parcela_id|professor_id|turma_id|pagamento_id)"')
HARDCODE_MAIN = re.compile(r'\.eq\("id"\s*,\s*"main"\)')
WRITE_OP = re.compile(r'\.(update|delete|insert|upsert)\(')
NEIGHBORHOOD = 2

def load_lines(path):
    with open(path, encoding="utf-8") as f: return f.readlines()

def neighborhood_has_tenant(lines, idx, radius=NEIGHBORHOOD):
    lo=max(0,idx-radius); hi=min(len(lines),idx+radius+1)
    return any(TENANT_GUARD.search(lines[j]) for j in range(lo,hi))

def table_of(line):
    m=re.search(r'\.from\("([a-z_]+)"\)',line); return m.group(1) if m else None

def scan_lines(lines, label="full"):
    findings=[]
    for i,line in enumerate(lines):
        if HARDCODE_MAIN.search(line):
            findings.append(("P0",i+1,"config",'Hardcode id="main" (classe H-08: account-takeover)',line.strip())); continue
        if ID_ACCESS.search(line):
            tbl=table_of(line)
            if not tbl:
                for j in range(i,max(-1,i-5),-1):
                    t=table_of(lines[j])
                    if t: tbl=t; break
            if tbl in GLOBAL_TABLES: continue
            if tbl is None: continue
            if tbl in TENANT_TABLES and not neighborhood_has_tenant(lines,i):
                is_write=bool(WRITE_OP.search(line)) or any(WRITE_OP.search(lines[k]) for k in range(max(0,i-2),i+1))
                sev="P0" if is_write else "P1"; kind="ESCRITA" if is_write else "LEITURA"
                findings.append((sev,i+1,tbl,f"Acesso por id SEM escola_id ({kind} / IDOR)",line.strip()))
    return findings

def scan_diff(diff_text):
    added=[]
    for raw in diff_text.splitlines():
        if raw.startswith("+") and not raw.startswith("+++"): added.append(raw[1:])
        else: added.append("\x00")
    return scan_lines(added,"diff")

def report(findings, mode):
    p0=[f for f in findings if f[0]=="P0"]; p1=[f for f in findings if f[0]=="P1"]
    print("="*64); print("  HATHOR SECURITY AGENT — PHASE 2 REGRESSION SCAN")
    print(f"  Baseline: Version 000de739 (78/78 SAFE)   |   modo: {mode}"); print("="*64)
    print(f"\n[1] VULNERABILITIES FOUND: {len(p0)} P0 | {len(p1)} P1\n")
    if not findings: print("    Nenhum achado. Isolamento multi-tenant preservado.")
    for sev,ln,tbl,motivo,txt in findings:
        print(f"    [{sev}] L{ln} ({tbl}) — {motivo}"); print(f"          > {txt[:96]}")
    if p0: decision="BLOCKED"; code=2
    elif p1: decision="APPROVED WITH WARNINGS"; code=1
    else: decision="APPROVED"; code=0
    print(f"\n[2] CRITERIO: P0 bloqueia deploy. P1 so registra.")
    print(f"\n[3] DEPLOY DECISION: {decision}"); print("="*64)
    return code

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("path",nargs="?"); ap.add_argument("--diff",action="store_true")
    ap.add_argument("--stdin-diff",action="store_true")
    a=ap.parse_args()
    if a.stdin_diff: sys.exit(report(scan_diff(sys.stdin.read()),"diff/stdin"))
    if not a.path: print("uso: hathor_secscan.py <index.ts> [--diff] | --stdin-diff",file=sys.stderr); sys.exit(3)
    if a.diff: sys.exit(report(scan_diff(open(a.path,encoding="utf-8").read()),"diff"))
    sys.exit(report(scan_lines(load_lines(a.path)),"full-source"))

if __name__=="__main__": main()
