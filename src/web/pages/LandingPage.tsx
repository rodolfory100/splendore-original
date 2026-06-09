import { useState } from "react";

const FEATURES = [
  { icon: "🧠", title: "IA de retenção preditiva", desc: "Identifica alunas com risco de cancelamento antes que elas somem. Score de churn atualizado em tempo real." },
  { icon: "📱", title: "Cobrança automática", desc: "WhatsApp automático para inadimplentes com mensagem personalizada. Zero trabalho manual." },
  { icon: "📊", title: "DRE + Fluxo de caixa", desc: "Relatório financeiro completo com projeção de receita. Sabe exatamente o que vai entrar nos próximos meses." },
  { icon: "🔄", title: "Contratos com renovação automática", desc: "Nunca mais aluna com contrato vencido sem você saber. Alertas 30 dias antes e renovação em 1 clique." },
];

export function LandingPage() {
  const [form, setForm] = useState({ nome: "", responsavel: "", email: "", whatsapp: "", senha: "" });
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{msg:string,type:string}|null>(null);

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const validate = () => {
    const e: Record<string,string> = {};
    if (form.nome.length < 2) e.nome = "Informe o nome da escola";
    if (form.responsavel.length < 2) e.responsavel = "Informe seu nome";
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) e.email = "E-mail inválido";
    if (form.whatsapp.replace(/\D/g,"").length < 10) e.whatsapp = "WhatsApp inválido";
    if (form.senha.length < 6) e.senha = "Mínimo 6 caracteres";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/saas/cadastrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: form.nome, responsavel_nome: form.responsavel, email: form.email, whatsapp: form.whatsapp.replace(/\D/g,""), senha: form.senha }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao cadastrar");
      showToast("Escola criada! Entrando no sistema...");
      localStorage.setItem("spl_token", data.token);
      localStorage.setItem("spl_escola", data.escola_id);
      setTimeout(() => window.location.href = "/", 1500);
    } catch (e: any) {
      showToast(e.message, "error");
      setLoading(false);
    }
  };

  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }));

  const inputStyle = { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border2)", background: "var(--surface)", color: "var(--text)", fontSize: 14, outline: "none" };
  const labelStyle = { fontSize: 13, color: "var(--text3)", marginBottom: 6, display: "block" as const };
  const errStyle = { fontSize: 12, color: "var(--red)", marginTop: 4, display: "block" as const };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "Inter, sans-serif" }}>
      {/* Navbar */}
      <div style={{ padding: "0 32px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "var(--brand)" }}>⚡ Hathor</div>
        <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 99, background: "var(--brand-bg)", color: "var(--brand)", fontWeight: 600 }}>30 dias grátis</span>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px" }}>
        {/* Hero */}
        <div style={{ textAlign: "center", padding: "64px 0 48px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "4px 14px", borderRadius: 99, background: "var(--brand-bg)", color: "var(--brand)", marginBottom: 24 }}>
            ✦ Hathor — Gestão Inteligente
          </div>
          <h1 style={{ fontSize: "clamp(28px,5vw,42px)", fontWeight: 800, lineHeight: 1.2, marginBottom: 16, color: "var(--text)", letterSpacing: "-0.02em" }}>
            Gestão completa para sua escola.<br />
            <span style={{ color: "var(--brand)" }}>IA que retém alunas antes de cancelarem.</span>
          </h1>
          <p style={{ fontSize: 16, color: "var(--text2)", lineHeight: 1.7, maxWidth: 520, margin: "0 auto 32px" }}>
            Automatize cobranças, controle inadimplência e tome decisões com dados reais — tudo em um único sistema.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" as const, marginBottom: 48 }}>
            {[["2.223+", "pagamentos processados"], ["155", "alunas gerenciadas"], ["R$27k", "receita monitorada"]].map(([v, l]) => (
              <div key={l} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 24px", textAlign: "center" as const }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--brand)" }}>{v}</div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div style={{ marginBottom: 64 }}>
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.8px", color: "var(--text3)", marginBottom: 24, textAlign: "center" as const }}>Por que o Hathor?</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px" }}>
                <div style={{ fontSize: 24, marginBottom: 10 }}>{f.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: "var(--text)" }}>{f.title}</div>
                <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <div style={{ marginBottom: 64 }}>
          <div style={{ textAlign: "center" as const, marginBottom: 32 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: "var(--text)" }}>Comece agora — 30 dias grátis</h2>
            <p style={{ fontSize: 14, color: "var(--text3)" }}>Configure sua escola em menos de 2 minutos. Sem cartão de crédito.</p>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, maxWidth: 560, margin: "0 auto", boxShadow: "var(--shadow-md)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Nome da escola</label>
                <input style={inputStyle} value={form.nome} onChange={set("nome")} placeholder="Ballet Exemplo" />
                {errors.nome && <span style={errStyle}>{errors.nome}</span>}
              </div>
              <div>
                <label style={labelStyle}>Seu nome</label>
                <input style={inputStyle} value={form.responsavel} onChange={set("responsavel")} placeholder="Maria Silva" />
                {errors.responsavel && <span style={errStyle}>{errors.responsavel}</span>}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>E-mail</label>
                <input style={inputStyle} type="email" value={form.email} onChange={set("email")} placeholder="voce@escola.com" />
                {errors.email && <span style={errStyle}>{errors.email}</span>}
              </div>
              <div>
                <label style={labelStyle}>WhatsApp</label>
                <input style={inputStyle} type="tel" value={form.whatsapp} onChange={set("whatsapp")} placeholder="65 99999-0000" />
                {errors.whatsapp && <span style={errStyle}>{errors.whatsapp}</span>}
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Senha de acesso</label>
              <input style={inputStyle} type="password" value={form.senha} onChange={set("senha")} placeholder="Mínimo 6 caracteres" />
              {errors.senha && <span style={errStyle}>{errors.senha}</span>}
            </div>
            <button onClick={handleSubmit} disabled={loading} className="btn btn-primary" style={{ width: "100%", justifyContent: "center", fontSize: 15, padding: "12px 24px" }}>
              {loading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Criando sua escola...</> : "Começar trial gratuito →"}
            </button>
            <p style={{ fontSize: 12, color: "var(--text3)", textAlign: "center" as const, marginTop: 12 }}>
              Ao cadastrar você concorda com os termos de uso. Cancele quando quiser.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid var(--border)", padding: "24px 32px", textAlign: "center" as const }}>
        <p style={{ fontSize: 12, color: "var(--text3)" }}>Hathor — Hathor — Gestão inteligente para escolas de dança · Cuiabá, MT</p>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed" as const, bottom: 24, right: 24, padding: "12px 18px", borderRadius: 12, fontSize: 13, fontWeight: 500, background: toast.type === "error" ? "var(--red-bg)" : "var(--green-bg)", color: toast.type === "error" ? "var(--red)" : "var(--green)", border: `1px solid ${toast.type === "error" ? "var(--red)" : "var(--green)"}`, zIndex: 999 }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
