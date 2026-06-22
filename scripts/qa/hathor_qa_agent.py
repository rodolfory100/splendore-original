#!/usr/bin/env python3
# HATHOR QA AGENT v2 — API-first (sem chave de banco; cleanup por SQL impresso)
import os, sys, json, time, uuid, base64, urllib.request, urllib.error
HATHOR=os.environ.get("HATHOR_URL","https://hathor.rodolfory100.workers.dev").rstrip("/")
BALLET="splendore001"
R=[]; B=[]; GHOST=[None]
def log(f,p,s,e=""):
    R.append((f,p,s,e)); ic={"PASS":"✅","FAIL":"❌","SKIP":"⚠️"}.get(s,"·")
    print(f"  {ic} [{f}] {p}: {s}  {str(e)[:90]}")
def bug(sev,f,d): B.append((sev,f,d))
def http(m,u,h=None,b=None):
    h=h or {}; data=json.dumps(b).encode() if b is not None else None
    if data: h["Content-Type"]="application/json"
    h["User-Agent"]="Mozilla/5.0 (QA-Agent Hathor)"
    rq=urllib.request.Request(u,data=data,headers=h,method=m)
    try:
        with urllib.request.urlopen(rq,timeout=20) as r:
            raw=r.read().decode()
            try: return r.status,json.loads(raw)
            except: return r.status,raw
    except urllib.error.HTTPError as e:
        raw=e.read().decode()
        try: return e.code,json.loads(raw)
        except: return e.code,raw
    except Exception as e: return 0,str(e)
def api(m,p,tok=None,b=None):
    h={}
    if tok: h["Authorization"]="Bearer "+tok
    return http(m,f"{HATHOR}/api{p}",h,b)
def f1():
    print("\n━━ FASE 1: Escola + Login + JWT ━━")
    em=f"qa-{uuid.uuid4().hex[:8]}@qa-hathor.test"; pw="qa-test-123456"
    st,r=api("POST","/saas/cadastrar",b={"nome":"QA Fantasma","email":em,"whatsapp":"65999990000","cidade":"Cuiaba","estado":"MT","senha":pw})
    if st!=200 or not isinstance(r,dict) or not r.get("ok"):
        log("F1","criar escola","FAIL",f"HTTP {st} {str(r)[:50]}"); bug("P0","F1","Cadastro falhou: "+str(r)[:60]); return None,None
    eid=r.get("escola_id"); tok=r.get("token"); GHOST[0]=eid; log("F1","criar escola","PASS",f"escola_id={eid}")
    parts=(tok or "").split(".")
    if len(parts)==3:
        try:
            pad=parts[1]+"="*(-len(parts[1])%4); pl=json.loads(base64.urlsafe_b64decode(pad))
            if pl.get("escola_id")==eid: log("F1","validar JWT","PASS",f"escola_id={pl.get('escola_id')}")
            else: log("F1","validar JWT","FAIL","escola_id divergente"); bug("P0","F1","JWT != cadastro")
        except Exception as e: log("F1","validar JWT","FAIL",str(e)[:40]); bug("P1","F1","JWT nao decodificavel")
    else: log("F1","validar JWT","FAIL","token != 3 partes"); bug("P0","F1","Token malformado")
    st,r=api("POST","/auth/login",b={"email":em,"senha":pw})
    if st==200 and isinstance(r,dict) and r.get("token"): log("F1","login email+senha","PASS",""); tok=r["token"]
    else: log("F1","login email+senha","FAIL",f"HTTP {st} {str(r)[:40]}"); bug("P0","F1","Login email+senha falhou")
    return eid,tok
def f2(tok):
    print("\n━━ FASE 2: Turmas ━━")
    st,r=api("POST","/turmas",tok,{"nome":"Ballet QA"})
    if st!=200: log("F2","criar turma","FAIL",f"HTTP {st} {str(r)[:60]}"); bug("P1","F2",f"Criar turma HTTP {st}: {str(r)[:50]}"); return
    log("F2","criar turma","PASS","")
    st,r=api("GET","/turmas",tok)
    if st==200 and isinstance(r,list) and len(r)>=1: log("F2","listar turma","PASS",f"{len(r)} turma(s)")
    else: log("F2","listar turma","FAIL",f"HTTP {st}"); bug("P1","F2","Turma nao persiste")
def f3(tok):
    print("\n━━ FASE 3: Aluna + 12 mensalidades auto (via API) ━━")
    st,r=api("POST","/alunas",tok,{"nome":"Aluna QA","responsavel":"Resp QA","whatsapp":"65988887777","valor":200,"vencimento":"10"})
    if st!=200: log("F3","criar aluna","FAIL",f"HTTP {st} {str(r)[:40]}"); bug("P0","F3","Criar aluna falhou"); return None
    log("F3","criar aluna","PASS",""); time.sleep(1)
    st,al=api("GET","/alunas",tok)
    if st==200 and isinstance(al,list) and len(al)==1:
        aid=al[0].get("id"); log("F3","persistencia (API)","PASS",f"aluna_id={aid}")
    else:
        log("F3","persistencia (API)","FAIL",f"GET /alunas veio {str(al)[:50]}"); bug("P0","F3","Aluna nao persistiu via API"); return None
    st,m=api("GET",f"/mensalidades/{aid}",tok)
    mens=m.get("mensalidades") if isinstance(m,dict) else (m if isinstance(m,list) else [])
    n=len(mens) if mens else 0
    if n==12: log("F3","12 mensalidades (API)","PASS",f"{n}")
    elif n>0: log("F3","mensalidades (API)","FAIL",f"esperava 12 veio {n}"); bug("P0","F3",f"Gerou {n}, esperado 12")
    else: log("F3","mensalidades (API)","FAIL","0 geradas"); bug("P0","F3","Geracao automatica NAO funcionou")
    return aid
def f4(tok,aid):
    print("\n━━ FASE 4: Pagamento (via API) ━━")
    if not aid: log("F4","todos","SKIP","sem aluna"); return
    st,m=api("GET",f"/mensalidades/{aid}",tok)
    mens=m.get("mensalidades") if isinstance(m,dict) else (m if isinstance(m,list) else [])
    pend=[x for x in mens if not x.get("data")] if mens else []
    if not pend: log("F4","pagamento","SKIP","sem mensalidade pendente"); return
    mes_alvo=pend[0].get("mes")
    st,r=api("POST","/pagamentos",tok,{"aluna_id":aid,"mes":mes_alvo,"data":"2026-06-10","valor":200,"forma":"pix"})
    if st==200:
        log("F4","registrar pgto","PASS",f"mes={mes_alvo}")
        st,m2=api("GET",f"/mensalidades/{aid}",tok)
        mm=m2.get("mensalidades") if isinstance(m2,dict) else m2
        paga=[x for x in (mm or []) if x.get("mes")==mes_alvo and x.get("data")]
        if paga: log("F4","conferir baixa (API)","PASS",f"data={paga[0].get('data')}")
        else: log("F4","conferir baixa (API)","FAIL","data nao gravada"); bug("P1","F4","Baixa nao refletiu na API")
    else: log("F4","registrar pgto","FAIL",f"HTTP {st} {str(r)[:40]}"); bug("P1","F4","POST pagamento falhou")
def f5(tok,aid):
    print("\n━━ FASE 5: Inadimplencia + dashboard + risco ━━")
    st,r=api("GET","/inadimplentes",tok); log("F5","inadimplencia","PASS" if st==200 else "FAIL",f"HTTP {st}")
    if st!=200: bug("P1","F5","Inadimplentes falhou")
    st,r=api("GET","/observabilidade/dashboard",tok); log("F5","dashboard","PASS" if st==200 else "FAIL",f"HTTP {st}")
    if st!=200: bug("P1","F5","Dashboard falhou")
    if aid:
        st,r=api("GET",f"/motor/risco/{aid}",tok); log("F5","motor risco","PASS" if st==200 else "FAIL",f"HTTP {st}")
        if st!=200: bug("P1","F5","Motor risco falhou")
def f6(tok):
    print("\n━━ FASE 6: DRE + fluxo ━━")
    st,r=api("GET","/financeiro/dre",tok)
    if st==200 and isinstance(r,dict): log("F6","DRE","PASS",f"receita={r.get('totalReceita',r.get('receita','?'))}")
    else: log("F6","DRE","FAIL",f"HTTP {st}"); bug("P1","F6","DRE falhou")
    st,r=api("GET","/financeiro/fluxo",tok); log("F6","fluxo","PASS" if st==200 else "FAIL",f"HTTP {st}")
    if st!=200: bug("P1","F6","Fluxo falhou")
def f7(tok,aid):
    print("\n━━ FASE 7: Contrato ━━")
    if not aid: log("F7","todos","SKIP","sem aluna"); return
    st,r=api("POST","/contratos/gerar",tok,{"alunaId":aid,"mesInicio":"2026-07","valorDesconto":200,"valorCheio":250,"diaVencimento":10,"formaPagamento1":"pix"})
    if st==200 and isinstance(r,dict) and r.get("ok"): log("F7","gerar contrato","PASS",f"parcelas={r.get('totalParcelas','?')}")
    else: log("F7","gerar contrato","FAIL",f"HTTP {st} {str(r)[:50]}"); bug("P1","F7",f"Contrato HTTP {st}")
def f8():
    print("\n━━ FASE 8: Security Scanner ━━")
    sc="scripts/security/hathor_secscan.py"; idx="src/api/index.ts"
    if os.path.exists(sc) and os.path.exists(idx):
        import subprocess; rc=subprocess.run([sys.executable,sc,idx]).returncode
        if rc==0: log("F8","security scan","PASS","APPROVED")
        elif rc==1: log("F8","security scan","PASS","APPROVED WITH WARNINGS")
        else: log("F8","security scan","FAIL","BLOCKED"); bug("P0","F8","Scanner P0")
    else: log("F8","security scan","SKIP","scanner/index nao encontrado")
def cleanup_sql():
    eid=GHOST[0]
    print("\n"+"🧹"*20)
    if not eid or eid==BALLET:
        print("Nenhuma escola-fantasma criada. Nada a limpar."); return
    print(f"LIMPEZA NECESSARIA — escola-fantasma {eid} ficou no banco.")
    print("Cole no SQL Editor do Supabase (guardrail != splendore001):\n")
    for t in ("pagamentos","parcelas","contratos","turmas","alunas","sentimento_alunas","cache_perfil_risco","config"):
        print(f"  DELETE FROM {t} WHERE escola_id != '{BALLET}';")
    print(f"  DELETE FROM escolas WHERE id != '{BALLET}';")
    print(f"  SELECT (SELECT count(*) FROM escolas) AS escolas, (SELECT count(*) FROM alunas WHERE escola_id='{BALLET}') AS alunas_ballet;")
    print("\n(esperado: escolas=1, alunas_ballet=158)")
def rel():
    print("\n"+"="*60); print("  HATHOR QA AGENT v2 — RELATORIO FINAL"); print("="*60)
    tot=len([r for r in R if r[2] in("PASS","FAIL")]); ps=len([r for r in R if r[2]=="PASS"])
    fl=len([r for r in R if r[2]=="FAIL"]); sk=len([r for r in R if r[2]=="SKIP"])
    cov=(ps/tot*100) if tot else 0
    print(f"\n  Executados: {tot} | PASS {ps} FAIL {fl} SKIP {sk}")
    print(f"  Cobertura operacional: {cov:.1f}%")
    p0=[b for b in B if b[0]=="P0"]; p1=[b for b in B if b[0]=="P1"]
    print(f"\n  BUGS: {len(p0)} P0 | {len(p1)} P1")
    for s,f,d in B: print(f"    [{s}] {f}: {d}")
    if p0: dec,code="REPROVADO",2
    elif fl>0 or p1: dec,code="APROVADO COM RESSALVAS",1
    else: dec,code="APROVADO",0
    print(f"\n  GO-LIVE OPERACIONAL: {dec}"); print("="*60); return code
def main():
    print(f"HATHOR QA AGENT v2 (API-first) | alvo {HATHOR}")
    try:
        eid,tok=f1()
        if not tok: print("\n⛔ F1 sem token, abortando fluxo")
        else:
            f2(tok); aid=f3(tok); f4(tok,aid); f5(tok,aid); f6(tok); f7(tok,aid)
        f8()
    finally: cleanup_sql()
    sys.exit(rel())
if __name__=="__main__": main()
