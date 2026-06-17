import urllib.request, json, os, datetime

SUPABASE_URL = "https://orovbbxhzizbpphggqxa.supabase.co"
KEY = os.environ.get("SUPABASE_SECRET_KEY")
if not KEY:
    raise SystemExit("Defina SUPABASE_SECRET_KEY no ambiente: export SUPABASE_SECRET_KEY=...")

TABELAS = ["escolas","config","alunas","pagamentos","turmas","despesas",
           "parcelas","contratos","conciliacao","webhooks_recebidos",
           "logs_seguranca","logs_performance","logs_ia_agente"]

ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
backup_dir = f"/workspaces/splendore-original/backups/{ts}"
os.makedirs(backup_dir, exist_ok=True)

def fetch_all(tabela):
    """Pagina de 1000 em 1000 até pegar tudo (Range header)."""
    todos = []
    offset = 0
    while True:
        url = f"{SUPABASE_URL}/rest/v1/{tabela}?select=*&order=id"
        req = urllib.request.Request(url, headers={
            "apikey": KEY, "Authorization": f"Bearer {KEY}",
            "Range-Unit": "items", "Range": f"{offset}-{offset+999}"
        })
        with urllib.request.urlopen(req) as r:
            lote = json.loads(r.read().decode())
        if not lote:
            break
        todos.extend(lote)
        if len(lote) < 1000:
            break
        offset += 1000
    return todos

print(f"═══ BACKUP HATHOR (paginado) — {ts} ═══\n")
manifesto = {"timestamp": ts, "tabelas": {}}
total = 0
for t in TABELAS:
    try:
        dados = fetch_all(t)
        with open(f"{backup_dir}/{t}.json", "w") as f:
            json.dump(dados, f, ensure_ascii=False, indent=2)
        n = len(dados)
        total += n
        manifesto["tabelas"][t] = n
        marca = " ⚠️ VERIFICAR" if (t=="pagamentos" and n < 2000) else ""
        print(f"  ✓ {t}: {n} registros{marca}")
    except Exception as e:
        print(f"  ✗ {t}: ERRO — {e}")
        manifesto["tabelas"][t] = f"ERRO: {e}"

with open(f"{backup_dir}/_manifesto.json", "w") as f:
    json.dump(manifesto, f, indent=2)

print(f"\n  TOTAL: {total} registros")
print(f"  Backup: {backup_dir}")
print(f"\n  CHECK: pagamentos deve ser 2330 (era 1000 antes da paginação)")
print(f"  pagamentos capturados: {manifesto['tabelas'].get('pagamentos')}")
