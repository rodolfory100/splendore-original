import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { getContratoPublico, assinarContrato } from "../lib/api";

export function AssinarContratoPage() {
  const [, params] = useRoute("/contratos/assinar/:token");
  const token = params?.token || "";

  const [contrato, setContrato] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [assinando, setAssinando] = useState(false);
  const [assinado, setAssinado] = useState(false);
  const [lido, setLido] = useState(false);

  useEffect(() => {
    if (!token) { setErro("Link inválido"); setLoading(false); return; }
    getContratoPublico(token)
      .then(data => {
        if (data.error) setErro(data.error);
        else setContrato(data);
      })
      .catch(() => setErro("Erro ao carregar contrato"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAssinar = async () => {
    if (!nome.trim()) { alert("Preencha seu nome completo"); return; }
    if (!codigo.trim()) { alert("Informe o código de confirmação recebido por WhatsApp"); return; }
    if (!lido) { alert("Você precisa confirmar que leu o contrato"); return; }
    setAssinando(true);
    try {
      const r = await assinarContrato(token, { nomeAssinatura: nome.trim(), codigo: codigo.trim() });
      if (r.error) { alert("Erro: " + r.error); return; }
      setAssinado(true);
    } catch (e: any) { alert("Erro: " + e.message); }
    finally { setAssinando(false); }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0e1a18" }}>
      <div style={{ color: "#d4af64", fontSize: 16 }}>Carregando contrato...</div>
    </div>
  );

  if (erro) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0e1a18" }}>
      <div style={{ textAlign: "center", color: "#fff", padding: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Contrato não encontrado</div>
        <div style={{ color: "#aaa", fontSize: 14 }}>{erro}</div>
      </div>
    </div>
  );

  if (assinado) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0e1a18" }}>
      <div style={{ textAlign: "center", color: "#fff", padding: 40, maxWidth: 480 }}>
        <div style={{ fontSize: 52, marginBottom: 20 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#d4af64", marginBottom: 12 }}>Contrato Assinado!</div>
        <div style={{ color: "#ccc", fontSize: 14, lineHeight: 1.6 }}>
          O contrato foi assinado digitalmente com sucesso.<br />
          Você receberá uma confirmação em breve.
        </div>
        <div style={{ marginTop: 24, fontSize: 12, color: "#666" }}>Hathor Escola de Dança</div>
      </div>
    </div>
  );

  if (contrato?.status === "assinado") return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0e1a18" }}>
      <div style={{ textAlign: "center", color: "#fff", padding: 40, maxWidth: 480 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#d4af64", marginBottom: 8 }}>Contrato já assinado</div>
        <div style={{ color: "#aaa", fontSize: 13 }}>Este contrato foi assinado por <strong style={{ color: "#fff" }}>{contrato.assinadoPor}</strong></div>
        {contrato.assinadoEm && <div style={{ color: "#aaa", fontSize: 12, marginTop: 4 }}>em {new Date(contrato.assinadoEm).toLocaleString("pt-BR")}</div>}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0e1a18", fontFamily: "'DM Sans', sans-serif", padding: "40px 20px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Logo / Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "#d4af64", marginBottom: 6 }}>Hathor</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 4 }}>Escola de Dança</div>
          <div style={{ fontSize: 13, color: "#888" }}>Contrato de Matrícula — Assinatura Digital</div>
        </div>

        {/* Contrato HTML */}
        <div style={{
          background: "#fff", borderRadius: 12, overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          marginBottom: 28,
        }}>
          {/* Scrollable content */}
          <div
            style={{ maxHeight: 450, overflowY: "auto", padding: "32px 36px", color: "#1a1a1a", lineHeight: 1.7 }}
            dangerouslySetInnerHTML={{ __html: contrato?.conteudoHtml || "" }}
          />
        </div>

        {/* Assinatura form */}
        <div style={{ background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(212,175,100,0.2)", borderRadius: 12, padding: 28 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#d4af64", marginBottom: 20 }}>
            Assinar contrato
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#888", fontWeight: 700, marginBottom: 6 }}>
              Seu nome completo *
            </label>
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Digite seu nome como aparece no documento"
              style={{
                width: "100%", padding: "11px 14px", background: "rgba(255,255,255,0.07)",
                border: "1.5px solid rgba(212,175,100,0.3)", borderRadius: 8,
                color: "#fff", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#888", fontWeight: 700, marginBottom: 6 }}>
              Código de confirmação *
            </label>
            <input
              value={codigo}
              onChange={e => setCodigo(e.target.value)}
              placeholder="Código recebido por WhatsApp"
              style={{
                width: "100%", padding: "11px 14px", background: "rgba(255,255,255,0.07)",
                border: "1.5px solid rgba(212,175,100,0.3)", borderRadius: 8,
                color: "#fff", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box",
                letterSpacing: 3,
              }}
            />
          </div>

          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 24 }}>
            <input
              type="checkbox"
              checked={lido}
              onChange={e => setLido(e.target.checked)}
              style={{ marginTop: 2, accentColor: "#d4af64", width: 16, height: 16 }}
            />
            <span style={{ fontSize: 13, color: "#ccc", lineHeight: 1.5 }}>
              Declaro que li e concordo com todos os termos e condições deste contrato de matrícula.
            </span>
          </label>

          <button
            onClick={handleAssinar}
            disabled={assinando || !lido}
            style={{
              width: "100%", padding: "14px 0",
              background: lido ? "#d4af64" : "#555",
              border: "none", borderRadius: 9,
              color: lido ? "#0e1a18" : "#999",
              fontSize: 15, fontWeight: 800, cursor: lido ? "pointer" : "not-allowed",
              letterSpacing: 0.5,
            }}
          >
            {assinando ? "Assinando..." : "✍ Assinar Contrato"}
          </button>

          <div style={{ fontSize: 11, color: "#555", textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
            Ao assinar, você concorda com os termos acima.<br />
            IP e timestamp serão registrados para validade jurídica.
          </div>
        </div>
      </div>
    </div>
  );
}
