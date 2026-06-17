import urllib.request, json, os, glob

SUPABASE_URL = "https://orovbbxhzizbpphggqxa.supabase.co"
KEY = os.environ.get("SUPABASE_SECRET_KEY")
if not KEY:
    raise SystemExit("Defina SUPABASE_SECRET_KEY no ambiente: export SUPABASE_SECRET_KEY=...")

# Acha o backup mais recente
backups = sorted(glob.glob("/workspaces/splendore-original/backups/*/"))
backup_dir = backups[-1]
print(f"═══ TESTE DE RESTORE ═══")
print(f"Backup: {backup_dir}\n")

def req(metodo, tabela, dados=None, filtro=""):
    url = f"{SUPABASE_URL}/rest/v1/{tabela}{filtro}"
    headers = {"apikey": KEY, "Authorization": f"Bearer {KEY}",
               "Content-Type": "application/json", "Prefer": "return=representation"}
    body = json.dumps(dados).encode() if dados else None
    r = urllib.request.Request(url, data=body, headers=headers, method=metodo)
    with urllib.request.urlopen(r) as resp:
        txt = resp.read().decode()
        return json.loads(txt) if txt else []

# ── PASSO 1: Inserir um registro de teste (simula dado real) ──
print("1. Inserindo registro de teste na tabela escolas...")
teste = {"id": "restore_test_99", "nome": "Escola Restore Test", "slug": "restore-test-99",
         "email": "restore@test-c5.com", "plano": "trial", "ativo": True}
req("POST", "escolas", teste)
atual = req("GET", "escolas", filtro="?id=eq.restore_test_99&select=nome")
print(f"   Inserido: {atual[0]['nome'] if atual else 'FALHOU'}")

# ── PASSO 2: Adicionar ao backup (simula que estava no backup) ──
print("\n2. Adicionando o registro ao arquivo de backup...")
with open(f"{backup_dir}/escolas.json") as f:
    escolas_bkp = json.load(f)
escolas_bkp.append(teste)
with open(f"{backup_dir}/escolas.json", "w") as f:
    json.dump(escolas_bkp, f, ensure_ascii=False, indent=2)
print(f"   Backup agora tem {len(escolas_bkp)} escolas")

# ── PASSO 3: DELETAR (simula perda de dados / desastre) ──
print("\n3. DELETANDO o registro (simula perda de dados)...")
req("DELETE", "escolas", filtro="?id=eq.restore_test_99")
existe = req("GET", "escolas", filtro="?id=eq.restore_test_99&select=id")
print(f"   Após delete: {'AINDA EXISTE (erro)' if existe else 'deletado (dado perdido)'}")

# ── PASSO 4: RESTORE a partir do backup ──
print("\n4. RESTAURANDO a partir do backup...")
with open(f"{backup_dir}/escolas.json") as f:
    backup_escolas = json.load(f)
perdido = [e for e in backup_escolas if e["id"] == "restore_test_99"]
if perdido:
    req("POST", "escolas", perdido[0])
    print(f"   Restaurado do backup: {perdido[0]['nome']}")

# ── PASSO 5: VERIFICAR que voltou ──
print("\n5. Verificando que o dado foi recuperado...")
recuperado = req("GET", "escolas", filtro="?id=eq.restore_test_99&select=nome,email")
if recuperado:
    print(f"   ✅ RECUPERADO: {recuperado[0]['nome']} ({recuperado[0]['email']})")
    print("\n   ═══ RESTORE FUNCIONA: dado perdido foi recuperado do backup ═══")
else:
    print("   ❌ FALHOU — dado não voltou")

# ── LIMPEZA ──
print("\n6. Limpando registro de teste...")
req("DELETE", "escolas", filtro="?id=eq.restore_test_99")
final = req("GET", "escolas", filtro="?id=eq.restore_test_99&select=id")
print(f"   {'Limpo' if not final else 'ATENÇÃO: ainda existe'}")
