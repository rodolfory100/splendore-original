import { useState, useEffect } from "react";

interface Props {
  config: any;
  onToast: (msg: string, type?: "success" | "danger" | "gold") => void;
  onConfigChange: (cfg: any) => void;
}

export function TelegramPage({ config, onToast, onConfigChange }: Props) {
  const [token, setToken] = useState(config?.telegramToken || "");
  const [chatId, setChatId] = useState(config?.telegramChatId || "");
  const [apiKey, setApiKey] = useState(config?.openrouterKey || localStorage.getItem("spl_apikey") || "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => { checkStatus(); }, []);

  const checkStatus = async () => {
    setLoadingStatus(true);
    try {
      const r = await fetch('/api/telegram/status');
      const d = await r.json();
      setStatus(d);
    } catch {}
    setLoadingStatus(false);
  };

  const handleSetup = async () => {
    if (!token) { onToast("Cole o Token do Bot", "danger"); return; }
    if (!chatId) { onToast("Cole seu Chat ID", "danger"); return; }
    setSaving(true);
    try {
      // URL do site publicado
      const webhookUrl = `https://${window.location.hostname}`;
      const r = await fetch('/api/telegram/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, chatId, webhookUrl, openrouterKey: apiKey }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Erro ao configurar");
      onToast("✅ Bot Telegram ativado! Verifique seu Telegram.", "success");
      onConfigChange({ ...config, telegramToken: token, telegramChatId: chatId, telegramAtivo: true, openrouterKey: apiKey });
      await checkStatus();
    } catch (e: any) {
      onToast(e.message, "danger");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testMsg) { onToast("Digite uma mensagem de teste", "danger"); return; }
    setSending(true);
    try {
      // Simular um update do Telegram
      const r = await fetch('/api/telegram/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            text: testMsg,
            from: { id: parseInt(chatId) || 0 },
            chat: { id: parseInt(chatId) || 0 },
          }
        }),
      });
      onToast("Mensagem enviada! Verifique o Telegram.", "success");
      setTestMsg("");
    } catch (e: any) {
      onToast(e.message, "danger");
    } finally {
      setSending(false);
    }
  };

  const COMANDOS = [
    // Relatórios
    { cmd: '/resumo',        desc: 'Visão geral completa do dia e mês',            grupo: '📊 Relatórios' },
    { cmd: '/hoje',          desc: 'Pagamentos registrados hoje',                  grupo: '📊 Relatórios' },
    { cmd: '/mes',           desc: 'Relatório financeiro do mês atual',            grupo: '📊 Relatórios' },
    { cmd: '/alunas',        desc: 'Total de alunas por modalidade e nível',       grupo: '📊 Relatórios' },
    { cmd: '/turmas',        desc: 'Lista de turmas com horários',                 grupo: '📊 Relatórios' },
    // Financeiro
    { cmd: '/inadimplentes', desc: 'Lista completa de quem não pagou',             grupo: '💰 Financeiro' },
    { cmd: '/pagamentos',    desc: 'Pagamentos de hoje e do mês',                  grupo: '💰 Financeiro' },
    { cmd: '/receber',       desc: 'Total a receber por modalidade',               grupo: '💰 Financeiro' },
    { cmd: '/cobrar',        desc: 'Lista com nomes e telefones para cobrar',      grupo: '💰 Financeiro' },
    // Ações
    { cmd: '/pagar [nome]',  desc: 'Registra pagamento de uma aluna pelo nome',    grupo: '✏️ Ações' },
    { cmd: '/buscar [nome]', desc: 'Busca aluna com dados + status de pagamento',  grupo: '✏️ Ações' },
    { cmd: '/aviso [texto]', desc: 'Publica aviso no Portal da Família',           grupo: '✏️ Ações' },
    { cmd: '/avisos',        desc: 'Lista os últimos avisos publicados',            grupo: '✏️ Ações' },
    // IA
    { cmd: 'Pergunta livre', desc: '"Quem pagou hoje?" / "Liste as de Ballet que não pagaram" / "Total desta semana"', grupo: '🤖 IA (com API Key)' },
  ];

  return (
    <div className="animate-fade-up" style={{ maxWidth: 720 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>✈️</span> Bot Telegram
        </div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
          Gerencie a escola diretamente pelo Telegram com IA integrada
        </div>
      </div>

      {/* Status atual */}
      {loadingStatus ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" /> Verificando status...
        </div>
      ) : status?.ativo ? (
        <div style={{ background: 'var(--green-bg)', border: '1.5px solid rgba(22,163,74,0.3)', borderRadius: 'var(--r-lg)', padding: '18px 22px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 32 }}>🤖</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--green)' }}>
              @{status.bot?.username} — Ativo
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
              Chat ID: {status.chatId} · IA: {status.temIA ? '✅ Configurada' : '⚠️ Sem API Key'}
            </div>
          </div>
          <button onClick={checkStatus} className="btn btn-secondary btn-sm">↺ Verificar</button>
        </div>
      ) : (
        <div style={{ background: 'var(--amber-bg)', border: '1.5px solid rgba(217,119,6,0.3)', borderRadius: 'var(--r-lg)', padding: '14px 18px', marginBottom: 24, fontSize: 13, color: '#92400E', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span>⚠️</span>
          <span>Bot não configurado ainda. Siga os passos abaixo.</span>
        </div>
      )}

      {/* Passo a passo */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 24, marginBottom: 20, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 20, color: 'var(--text)' }}>⚙️ Configuração</div>

        {/* Instruções */}
        <div style={{ background: 'var(--bg)', borderRadius: 'var(--r-md)', padding: '14px 16px', marginBottom: 20, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Como obter o Token e Chat ID:</div>
          <ol style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 2, paddingLeft: 16 }}>
            <li>Abra o Telegram e pesquise <strong>@BotFather</strong></li>
            <li>Envie <code style={{ background:'var(--bg2)',padding:'1px 6px',borderRadius:4 }}>/newbot</code></li>
            <li>Dê um nome: <strong>Hathor Gestão</strong></li>
            <li>Dê um username: <strong>splendore_gestao_bot</strong></li>
            <li>Copie o <strong>token</strong> que ele enviar</li>
            <li>Pesquise <strong>@userinfobot</strong> e envie qualquer mensagem</li>
            <li>Copie o <strong>Id</strong> que ele responder</li>
          </ol>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'Token do Bot (do @BotFather) *', value: token, setter: setToken, placeholder: '7123456789:AAHdqTcvAHuABCDEFGHIJKLMNOP...', type: 'password' },
            { label: 'Seu Chat ID (do @userinfobot) *', value: chatId, setter: setChatId, placeholder: 'Ex: 123456789' },
          ].map(({ label, value, setter, placeholder, type }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', letterSpacing: 0.3 }}>{label}</label>
              <input type={type || 'text'} value={value} onChange={e => setter(e.target.value)} placeholder={placeholder} />
            </div>
          ))}

          {/* API Key IA (opcional) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)' }}>
              API Key OpenRouter (para perguntas livres com IA)
              <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--text3)', fontWeight: 400 }}>
                grátis em openrouter.ai
              </span>
            </label>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-or-v1-..." />
          </div>
        </div>

        <button
          onClick={handleSetup}
          disabled={saving || !token || !chatId}
          className="btn btn-primary"
          style={{ width: '100%', marginTop: 20, padding: 13, fontSize: 14 }}
        >
          {saving
            ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Ativando...</>
            : status?.ativo ? '🔄 Atualizar configuração' : '🚀 Ativar Bot Telegram'}
        </button>
      </div>

      {/* Testar bot */}
      {status?.ativo && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 24, marginBottom: 20, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16, color: 'var(--text)' }}>🧪 Testar Bot</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={testMsg}
              onChange={e => setTestMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleTest()}
              placeholder="Digite /resumo ou uma pergunta..."
              style={{ flex: 1 }}
            />
            <button onClick={handleTest} disabled={sending || !testMsg} className="btn btn-primary">
              {sending ? '...' : 'Enviar'}
            </button>
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text3)' }}>
            A resposta aparecerá no seu Telegram em segundos.
          </div>
        </div>
      )}

      {/* Comandos disponíveis */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 24, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16, color: 'var(--text)' }}>📋 Comandos Disponíveis</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(() => {
            const grupos: Record<string, typeof COMANDOS> = {};
            COMANDOS.forEach(c => { if (!grupos[c.grupo]) grupos[c.grupo] = []; grupos[c.grupo].push(c); });
            return Object.entries(grupos).map(([grupo, cmds]) => (
              <div key={grupo} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1, padding: '6px 4px 4px', opacity: 0.7 }}>{grupo}</div>
                {cmds.map(({ cmd, desc }) => (
                  <div key={cmd} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '9px 14px', background: 'var(--bg)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', marginBottom: 4 }}>
                    <code style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold-dark)', background: 'var(--gold-bg)', padding: '3px 10px', borderRadius: 6, flexShrink: 0, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      {cmd}
                    </code>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>{desc}</span>
                  </div>
                ))}
              </div>
            ));
          })()}
        </div>

        <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(37,99,235,0.07)', borderRadius: 'var(--r-sm)', border: '1px solid rgba(37,99,235,0.15)', fontSize: 12, color: '#1D4ED8', lineHeight: 1.7 }}>
          <strong>💡 Com IA ativada:</strong> você pode enviar perguntas em português natural como<br />
          <em>"Quem pagou hoje?", "Qual o total de março?", "Liste as alunas de Ballet"</em><br />
          e receber respostas inteligentes com dados reais da escola.
        </div>
      </div>
    </div>
  );
}
