import { useState, useEffect } from "react";
import { getConfig, saveConfig, changeSenha, importarDados, getAlunas, getPagamentos, exportarDados } from "../lib/api";

interface Props {
  config: any;
  onConfigChange: (cfg: any) => void;
  onToast: (msg: string, type?: "success"|"danger"|"gold") => void;
}

const inputStyle: React.CSSProperties = {
  background: "#faf8f4", border: "1.5px solid rgba(180,155,90,0.25)", borderRadius: 6,
  padding: "9px 12px", color: "#1e1a16", fontSize: 13, fontFamily: "'DM Sans', sans-serif",
  outline: "none", width: "100%",
};
const labelStyle: React.CSSProperties = {
  fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#a8998a", fontWeight: 600,
};

function FG({ label, children, span2 }: { label: string; children: React.ReactNode; span2?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, gridColumn: span2 ? "span 2" : "span 1" }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export function AdminPage({ config, onConfigChange, onToast }: Props) {
  const [form, setForm] = useState({ escola: "", nomeAdmin: "", whatsapp: "", email: "", endereco: "", cidade: "", instagram: "", cnpj: "", pix: "", msgCobranca: "" });
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confSenha, setConfSenha] = useState("");
  const [apiKey, setApiKey] = useState(localStorage.getItem("spl_apikey") || "");
  const [saving, setSaving] = useState(false);
  const [importando, setImportando] = useState(false);

  useEffect(() => {
    if (config) {
      setForm({
        escola: config.escola || "",
        nomeAdmin: config.nomeAdmin || "",
        whatsapp: config.whatsapp || "",
        email: config.email || "",
        endereco: config.endereco || "",
        cidade: config.cidade || "",
        instagram: config.instagram || "",
        cnpj: config.cnpj || "",
        pix: config.pix || "",
        msgCobranca: config.msgCobranca || "",
      });
    }
  }, [config]);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await saveConfig(form);
      onConfigChange(form);
      onToast("Configurações salvas!", "success");
    } catch (e: any) {
      onToast(e.message, "danger");
    } finally {
      setSaving(false);
    }
  };

  const handleSenha = async () => {
    if (novaSenha !== confSenha) { onToast("As senhas não coincidem", "danger"); return; }
    if (novaSenha.length < 4) { onToast("Senha muito curta", "danger"); return; }
    try {
      const r = await changeSenha(senhaAtual, novaSenha);
      if (r.ok) {
        onToast("Senha alterada com sucesso!", "success");
        setSenhaAtual(""); setNovaSenha(""); setConfSenha("");
      } else {
        onToast(r.error || "Senha atual incorreta", "danger");
      }
    } catch (e: any) {
      onToast(e.message, "danger");
    }
  };

  const handleBackup = async () => {
    try {
      const blob = await exportarDados();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-splendore-completo-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onToast("✓ Backup completo exportado!", "success");
    } catch(e: any) { onToast(e.message, "danger"); }
  };

  const handleExportCSV = async () => {
    try {
      const alunas = await getAlunas();
      const header = ['Nome','Responsável','WhatsApp','Email','Modalidade','Nível','Mensalidade','Vencimento','Status','Cadastro'];
      const rows = alunas.map((a: any) => [
        a.nome, a.responsavel, a.whatsapp || '', a.email || '',
        a.modalidade, a.nivel || '', `R$ ${(a.valor||0).toFixed(2)}`,
        `Dia ${a.vencimento || 10}`,
        a.bolsista ? 'Bolsista' : 'Pagante',
        a.cadastro || '',
      ].map((v: any) => `"${String(v).replace(/"/g,'""')}"`).join(','));
      const csv = [header.join(','), ...rows].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const el = document.createElement('a');
      el.href = url; el.download = `alunas-splendore-${new Date().toISOString().slice(0,10)}.csv`;
      el.click(); URL.revokeObjectURL(url);
      onToast(`✓ CSV exportado: ${alunas.length} alunas`, "success");
    } catch(e: any) { onToast(e.message, "danger"); }
  };

  const handleImportar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportando(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.alunas) throw new Error("Formato inválido — arquivo não tem campo 'alunas'");
        if (!confirm(`Importar backup?\n• ${data.alunas?.length || 0} alunas\n• ${data.pagamentos?.length || 0} pagamentos\n\nDados existentes serão mantidos (não substitui).`)) {
          setImportando(false); return;
        }
        const r = await importarDados(data);
        onToast(`✦ Importados ${r.importados} registros!`, "success");
      } catch (e: any) {
        onToast("Erro: " + e.message, "danger");
      } finally {
        setImportando(false);
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  const F = (key: keyof typeof form) => (e: any) => setForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <div className="animate-fade-up" style={{ maxWidth: 800 }}>
      {/* Dados da escola */}
      <Section title="Dados da Escola">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
          <FG label="Nome da Escola *"><input value={form.escola} onChange={F("escola")} style={inputStyle} /></FG>
          <FG label="Nome da Diretora *"><input value={form.nomeAdmin} onChange={F("nomeAdmin")} style={inputStyle} /></FG>
          <FG label="WhatsApp da Escola"><input value={form.whatsapp} onChange={F("whatsapp")} placeholder="(65) 99999-9999" style={inputStyle} /></FG>
          <FG label="E-mail"><input value={form.email} onChange={F("email")} type="email" style={inputStyle} /></FG>
          <FG label="Endereço"><input value={form.endereco} onChange={F("endereco")} style={inputStyle} /></FG>
          <FG label="Cidade"><input value={form.cidade} onChange={F("cidade")} style={inputStyle} /></FG>
          <FG label="Instagram"><input value={form.instagram} onChange={F("instagram")} placeholder="@suaescola" style={inputStyle} /></FG>
          <FG label="CNPJ / CPF"><input value={form.cnpj} onChange={F("cnpj")} style={inputStyle} /></FG>
          <FG label="Chave Pix" span2><input value={form.pix} onChange={F("pix")} placeholder="CPF, CNPJ, e-mail ou telefone" style={inputStyle} /></FG>
          <FG label="Mensagem padrão de cobrança (use {responsavel}, {aluna}, {valor}, {vencimento})" span2>
            <textarea value={form.msgCobranca} onChange={F("msgCobranca")} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
          </FG>
        </div>
        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={handleSaveConfig} disabled={saving} style={{ padding: "10px 22px", background: "#b8923a", border: "none", borderRadius: 6, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            {saving ? "Salvando..." : "Salvar Configurações"}
          </button>
        </div>
      </Section>

      {/* API Key IA */}
      <Section title="🤖 API Key — IA (OpenRouter)">
        <div style={{ background: "rgba(184,146,58,0.06)", border: "1px solid rgba(184,146,58,0.18)", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 12, color: "#6b5f4e", lineHeight: 1.7 }}>
          Ativa o Assistente IA. Grátis em <strong>openrouter.ai</strong> → Keys → Create Key.<br/>
          <span style={{ color: "#c0444e", fontWeight: 500 }}>Atenção: a chave é armazenada apenas no seu navegador e nunca enviada para terceiros pelo sistema.</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>API Key OpenRouter</label>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-or-v1-..." style={{ ...inputStyle, marginTop: 5 }} />
          </div>
          <button
            onClick={() => { if (!apiKey) return; localStorage.setItem("spl_apikey", apiKey); onToast("API Key salva! IA ativada.", "success"); }}
            style={{ padding: "10px 18px", background: "#b8923a", border: "none", borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
          >Salvar Key</button>
        </div>
        {apiKey && <div style={{ marginTop: 10, fontSize: 11, color: "#3d7a72" }}>✓ API Key configurada</div>}
      </Section>

      {/* Segurança */}
      <Section title="🔐 Segurança — Alterar Senha">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 13 }}>
          <FG label="Senha Atual *"><input type="password" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} style={inputStyle} /></FG>
          <FG label="Nova Senha *"><input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} style={inputStyle} /></FG>
          <FG label="Confirmar Nova Senha *"><input type="password" value={confSenha} onChange={e => setConfSenha(e.target.value)} style={inputStyle} /></FG>
        </div>
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={handleSenha} style={{ padding: "10px 22px", background: "rgba(192,68,78,0.1)", border: "1.5px solid rgba(192,68,78,0.25)", borderRadius: 6, color: "#c0444e", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            Alterar Senha
          </button>
        </div>
      </Section>

      {/* Efí Bank */}
      <Section title="🏦 Efí Bank — Boletos & Pix Cobrança">
        <div style={{ background: "rgba(58,111,168,0.05)", border: "1px solid rgba(58,111,168,0.18)", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 12, color: "#6b5f4e", lineHeight: 1.7 }}>
          <strong style={{ color: "#3a6fa8" }}>Como configurar:</strong> Acesse <strong>efipay.com.br</strong> → API → Minhas Aplicações → crie uma aplicação → copie Client ID e Client Secret.<br/>
          <span style={{ fontSize: 11, color: "#a8998a" }}>Use Sandbox (teste) primeiro. Quando confirmar que está funcionando, mude para Produção.</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
          <FG label="Client ID *">
            <input type="text" id="cfg-efi-client-id" placeholder="Client_Id_..." style={inputStyle} defaultValue={config?.efiClientId || ""} />
          </FG>
          <FG label="Client Secret *">
            <input type="password" id="cfg-efi-client-secret" placeholder="Client_Secret_..." style={inputStyle} defaultValue={config?.efiClientSecret || ""} />
          </FG>
          <FG label="Chave Pix (para cobranças Pix)">
            <input type="text" id="cfg-efi-chave-pix" placeholder="CPF, CNPJ, e-mail ou aleatória" style={inputStyle} defaultValue={config?.efiChavePix || config?.pix || ""} />
          </FG>
          <FG label="Ambiente">
            <select id="cfg-efi-sandbox" style={inputStyle} defaultValue={config?.efiSandbox === false ? "false" : "true"}>
              <option value="true">🧪 Sandbox (testes)</option>
              <option value="false">🚀 Produção (real)</option>
            </select>
          </FG>
        </div>
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={async () => {
              const clientId = (document.getElementById("cfg-efi-client-id") as HTMLInputElement)?.value?.trim();
              const clientSecret = (document.getElementById("cfg-efi-client-secret") as HTMLInputElement)?.value?.trim();
              const chavePix = (document.getElementById("cfg-efi-chave-pix") as HTMLInputElement)?.value?.trim();
              const sandbox = (document.getElementById("cfg-efi-sandbox") as HTMLSelectElement)?.value !== "false";
              if (!clientId || !clientSecret) { onToast("Client ID e Client Secret são obrigatórios", "danger"); return; }
              try {
                await saveConfig({ ...config, efiClientId: clientId, efiClientSecret: clientSecret, efiChavePix: chavePix, efiSandbox: sandbox });
                onConfigChange({ ...config, efiClientId: clientId, efiClientSecret: clientSecret, efiChavePix: chavePix, efiSandbox: sandbox });
                onToast(sandbox ? "✦ Efí configurada (Sandbox)!" : "✦ Efí configurada (Produção)!", "success");
              } catch (e: any) { onToast(e.message, "danger"); }
            }}
            style={{ padding: "10px 22px", background: "#3a6fa8", border: "none", borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
          >
            Salvar Credenciais Efí
          </button>
        </div>
      </Section>

      {/* Sicoob */}
      <Section title="🏦 Sicoob — Pix & Boletos">
        <div style={{ background: "rgba(0,100,60,0.05)", border: "1px solid rgba(0,100,60,0.18)", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 12, color: "#6b5f4e", lineHeight: 1.7 }}>
          <strong style={{ color: "#006430" }}>Como configurar:</strong> Acesse o portal <strong>developers.sicoob.com.br</strong> → Meus Apps → Crie um app → copie Client ID e Client Secret.<br/>
          <span style={{ fontSize: 11, color: "#a8998a" }}>Certificado digital: emita via ICP-Brasil (e-CPF/e-CNPJ) e cole o conteúdo base64 aqui.</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
          <FG label="Client ID *">
            <input type="text" id="cfg-sicoob-client-id" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" style={inputStyle} defaultValue={config?.sicoobClientId || ""} />
          </FG>
          <FG label="Client Secret *">
            <input type="password" id="cfg-sicoob-client-secret" placeholder="Client Secret..." style={inputStyle} defaultValue={config?.sicoobClientSecret || ""} />
          </FG>
          <FG label="Chave Pix">
            <input type="text" id="cfg-sicoob-chave-pix" placeholder="CPF, CNPJ, telefone ou chave aleatória" style={inputStyle} defaultValue={config?.sicoobChavePix || config?.pix || ""} />
          </FG>
          <FG label="Agência">
            <input type="text" id="cfg-sicoob-agencia" placeholder="Ex: 0101" style={inputStyle} defaultValue={config?.sicoobAgencia || ""} />
          </FG>
          <FG label="Conta Corrente">
            <input type="text" id="cfg-sicoob-conta" placeholder="Ex: 12345-6" style={inputStyle} defaultValue={config?.sicoobContaCorrente || ""} />
          </FG>
          <FG label="Ambiente">
            <select id="cfg-sicoob-sandbox" style={inputStyle} defaultValue={config?.sicoobSandbox === false ? "false" : "true"}>
              <option value="true">🧪 Sandbox (testes)</option>
              <option value="false">🚀 Produção (real)</option>
            </select>
          </FG>
          <FG label="Certificado Digital (base64 — opcional)" span2>
            <textarea id="cfg-sicoob-cert" rows={3} placeholder="Cole aqui o certificado em base64..." style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 11 }} defaultValue={config?.sicoobCertificado || ""} />
          </FG>
        </div>
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={async () => {
              const clientId     = (document.getElementById("cfg-sicoob-client-id") as HTMLInputElement)?.value?.trim();
              const clientSecret = (document.getElementById("cfg-sicoob-client-secret") as HTMLInputElement)?.value?.trim();
              const chavePix     = (document.getElementById("cfg-sicoob-chave-pix") as HTMLInputElement)?.value?.trim();
              const agencia      = (document.getElementById("cfg-sicoob-agencia") as HTMLInputElement)?.value?.trim();
              const conta        = (document.getElementById("cfg-sicoob-conta") as HTMLInputElement)?.value?.trim();
              const sandbox      = (document.getElementById("cfg-sicoob-sandbox") as HTMLSelectElement)?.value !== "false";
              const cert         = (document.getElementById("cfg-sicoob-cert") as HTMLTextAreaElement)?.value?.trim();
              if (!clientId || !clientSecret) { onToast("Client ID e Client Secret são obrigatórios", "danger"); return; }
              try {
                const upd = { ...config, sicoobClientId: clientId, sicoobClientSecret: clientSecret, sicoobChavePix: chavePix, sicoobAgencia: agencia, sicoobContaCorrente: conta, sicoobSandbox: sandbox, sicoobCertificado: cert || null };
                await saveConfig(upd);
                onConfigChange(upd);
                onToast(sandbox ? "✦ Sicoob configurado (Sandbox)!" : "✦ Sicoob configurado (Produção)!", "success");
              } catch (e: any) { onToast(e.message, "danger"); }
            }}
            style={{ padding: "10px 22px", background: "#006430", border: "none", borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
          >
            Salvar Credenciais Sicoob
          </button>
        </div>
      </Section>

      {/* Backup e Exportação */}
      <Section title="💾 Backup & Exportação de Dados">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
          <button onClick={handleBackup} style={{ padding: "16px 14px", background: "rgba(22,163,74,0.07)", border: "1.5px solid rgba(22,163,74,0.25)", borderRadius: 10, color: "#16A34A", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>📦</div>
            Backup JSON Completo<br/>
            <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.7 }}>Alunas + pagamentos + config</span>
          </button>
          <button onClick={handleExportCSV} style={{ padding: "16px 14px", background: "rgba(37,99,235,0.07)", border: "1.5px solid rgba(37,99,235,0.25)", borderRadius: 10, color: "#2563EB", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>📊</div>
            Exportar CSV — Alunas<br/>
            <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.7 }}>Abre no Excel / Google Sheets</span>
          </button>
          <label style={{ padding: "16px 14px", background: "rgba(184,146,58,0.07)", border: "1.5px solid rgba(184,146,58,0.25)", borderRadius: 10, color: "#b8923a", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", textAlign: "center", display: "block" }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>📥</div>
            {importando ? "Importando..." : "Importar Backup JSON"}<br/>
            <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.7 }}>Restaurar dados anteriores</span>
            <input type="file" accept=".json" onChange={handleImportar} style={{ display: "none" }} />
          </label>
        </div>
        <div style={{ background: "rgba(61,122,114,0.05)", border: "1px solid rgba(61,122,114,0.16)", borderRadius: 8, padding: "10px 14px", fontSize: 11, color: "#6b5f4e" }}>
          💡 Recomendamos fazer backup mensal. O arquivo JSON contém todos os dados do sistema e pode ser restaurado a qualquer momento.
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 700, marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid rgba(180,155,90,0.18)", color: "#1e1a16" }}>
        {title}
      </div>
      <div style={{ background: "#fff", border: "1px solid rgba(180,155,90,0.18)", borderRadius: 10, padding: 24, boxShadow: "0 1px 5px rgba(0,0,0,0.05)" }}>
        {children}
      </div>
    </div>
  );
}
