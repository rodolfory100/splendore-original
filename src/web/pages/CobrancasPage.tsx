import { useMemo, useState } from "react";
import { fmt, initials, mesAtual, genId } from "../lib/api";
import { savePagamento } from "../lib/api";
import type { Inadimplente } from "../types";

interface Props {
  inadimplentes: Inadimplente[];
  config: any;
  onRefresh: () => void;
  onToast: (msg: string, type?: "success" | "danger" | "gold") => void;
}

export function CobrancasPage({ inadimplentes, config, onRefresh, onToast }: Props) {
  const [busca, setBusca] = useState("");
  const [filtroMeses, setFiltroMeses] = useState<"todos" | "1" | "2" | "3+">("todos");
  const [pagandoId, setPagandoId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const hoje = new Date();
  const diaHoje = hoje.getDate();

  // Classifica urgência por vencimento
  const comUrgencia = useMemo(() => inadimplentes.map(a => {
    const v = parseInt((a as any).vencimento || '10');
    const diff = v - diaHoje;
    let urgencia: 'venceu_hoje' | 'vence_hoje' | 'vence_3d' | 'vence_7d' | 'normal' = 'normal';
    if (diff === 0) urgencia = 'vence_hoje';
    else if (diff < 0 && diff > -3) urgencia = 'venceu_hoje';
    else if (diff > 0 && diff <= 3) urgencia = 'vence_3d';
    else if (diff > 0 && diff <= 7) urgencia = 'vence_7d';
    return { ...a, urgencia, diffDias: diff };
  }), [inadimplentes, diaHoje]);

  const filtrados = useMemo(() => {
    let lista = comUrgencia;
    if (busca) {
      const q = busca.toLowerCase();
      lista = lista.filter(a => a.nome.toLowerCase().includes(q) || (a.responsavel || '').toLowerCase().includes(q));
    }
    if (filtroMeses === '1') lista = lista.filter(a => (a as any).quantidadeMeses === 1);
    if (filtroMeses === '2') lista = lista.filter(a => (a as any).quantidadeMeses === 2);
    if (filtroMeses === '3+') lista = lista.filter(a => (a as any).quantidadeMeses >= 3);
    return lista;
  }, [comUrgencia, busca, filtroMeses]);

  // Grupos
  const urgentes = filtrados.filter(a => a.urgencia === 'vence_hoje' || a.urgencia === 'venceu_hoje' || a.urgencia === 'vence_3d');
  const cronicas = filtrados.filter(a => (a as any).quantidadeMeses >= 3 && !urgentes.find(u => u.id === a.id));
  const normais = filtrados.filter(a => !urgentes.find(u => u.id === a.id) && !cronicas.find(c => c.id === a.id));

  const montarMensagem = (a: Inadimplente) => {
    const escola = config?.escola || "Splendore Escola de Dança";
    const pix = config?.pix ? `\n• Chave Pix: *${config.pix}*` : "";
    const meses = (a as any).quantidadeMeses > 1 ? `*${(a as any).quantidadeMeses} meses* em aberto` : "mensalidade em aberto";
    if (config?.msgCobranca) {
      return config.msgCobranca
        .replace(/{responsavel}/g, a.responsavel)
        .replace(/{aluna}/g, a.nome)
        .replace(/{valor}/g, fmt((a as any).totalDebito || a.valor))
        .replace(/{vencimento}/g, `dia ${(a as any).vencimento}`);
    }
    return `Olá, ${a.responsavel}! 🌸\n\nEspero que esteja bem! Identificamos ${meses} da *${a.nome}*.\n\n🩰 *Detalhes:*\n• Modalidade: ${a.modalidade}${(a as any).nivel ? ' — ' + (a as any).nivel : ''}\n• Total em aberto: *${fmt((a as any).totalDebito || a.valor)}*${(a as any).quantidadeMeses > 1 ? `\n• ${(a as any).quantidadeMeses}x de ${fmt(a.valor)}` : ''}\n• Vencimento: dia ${(a as any).vencimento}\n\n💳 *Formas aceitas:*\nPix · Dinheiro · Cartão${pix}\n\nApós o pagamento, envie o comprovante. 🙏\n\n*${escola}* 🩰✨`;
  };

  const cobrarAluna = (a: Inadimplente) => {
    const wpp = (a.whatsapp || '').replace(/\D/g, '');
    if (!wpp) { onToast("WhatsApp não cadastrado", "danger"); return; }
    window.open(`https://wa.me/55${wpp}?text=${encodeURIComponent(montarMensagem(a))}`, '_blank');
  };

  const cobrarTodas = async () => {
    if (!filtrados.length) { onToast("Nenhuma inadimplente!", "gold"); return; }
    if (!confirm(`Enviar cobranças para ${filtrados.length} aluna(s)? Abrirá em sequência.`)) return;
    let i = 0;
    const next = () => {
      if (i >= filtrados.length) { onToast(`${filtrados.length} cobranças enviadas!`, "success"); return; }
      cobrarAluna(filtrados[i++]);
      setTimeout(next, 1200);
    };
    next();
  };

  const pagarRapido = async (a: Inadimplente) => {
    const mes = mesAtual();
    const hoje = new Date().toISOString().split("T")[0];
    setPagandoId(a.id);
    try {
      // Busca registro existente para este mês (pode ser pendente gerado automaticamente)
      const todosData = await req<{ mensalidades?: any[] }>(`/mensalidades/${a.id}`);
      const mensalidades: any[] = todosData.mensalidades || [];
      const mesDados = mensalidades.find((m: any) => m.mes === mes);

      if (mesDados?.pagamento?.id) {
        // Já tem registro com ID no banco → dar baixa via PUT
        await req<any>(`/pagamentos/${mesDados.pagamento.id}/pagar`, {
          method: "PUT",
          body: JSON.stringify({ data: hoje, forma: "Pix", valor: a.valor }),
        });
      } else if (mesDados?.status === "pago") {
        onToast("⚠️ Este mês já está pago", "danger");
        return;
      } else {
        // Sem registro ou registro sem ID → buscar na lista completa de pagamentos
        const pags: any[] = await req<any[]>(`/pagamentos`);
        const existente = pags.find((p: any) => p.alunaId === a.id && p.mes === mes);
        if (existente) {
          await req<any>(`/pagamentos/${existente.id}/pagar`, {
            method: "PUT",
            body: JSON.stringify({ data: hoje, forma: "Pix", valor: a.valor }),
          });
        } else {
          // Não existe nenhum → criar direto como pago
          await savePagamento({ id: genId(), alunaId: a.id, mes, data: hoje, valor: a.valor, forma: "Pix" });
        }
      }
      onToast(`✓ ${a.nome.split(' ')[0]} — pago!`, "success");
      onRefresh();
    } catch (e: any) {
      onToast(e.message, "danger");
    } finally { setPagandoId(null); }
  };

  const FILTRO_LABELS: { val: typeof filtroMeses; label: string }[] = [
    { val: 'todos', label: `Todas (${inadimplentes.length})` },
    { val: '1', label: `1 mês (${inadimplentes.filter(a => (a as any).quantidadeMeses === 1).length})` },
    { val: '2', label: `2 meses (${inadimplentes.filter(a => (a as any).quantidadeMeses === 2).length})` },
    { val: '3+', label: `3+ meses (${inadimplentes.filter(a => (a as any).quantidadeMeses >= 3).length})` },
  ];

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>Cobranças WhatsApp</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
            {inadimplentes.length} inadimplente{inadimplentes.length !== 1 ? 's' : ''} · {fmt(inadimplentes.reduce((s, a) => s + ((a as any).totalDebito || a.valor || 0), 0))} em aberto
          </div>
        </div>
        <button onClick={cobrarTodas} className="btn btn-danger" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          📱 Cobrar Todas ({filtrados.length})
        </button>
      </div>

      {/* Alerta urgentes */}
      {urgentes.length > 0 && (
        <div style={{ background: 'rgba(220,38,38,0.07)', border: '1.5px solid rgba(220,38,38,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>⏰</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>
              {urgentes.length} aluna{urgentes.length !== 1 ? 's' : ''} com vencimento imediato
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
              {urgentes.slice(0, 4).map(a => a.nome.split(' ')[0]).join(', ')}{urgentes.length > 4 ? ` +${urgentes.length - 4}` : ''} — envie agora
            </div>
          </div>
          <button className="btn btn-sm btn-danger" onClick={() => { urgentes.forEach((a, i) => setTimeout(() => cobrarAluna(a), i * 1000)); }}>
            Cobrar urgentes
          </button>
        </div>
      )}

      {/* Busca + Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar aluna ou responsável..."
          style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, fontFamily: 'inherit', color: 'var(--text)', background: 'var(--surface)', outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {FILTRO_LABELS.map(f => (
            <button key={f.val} onClick={() => setFiltroMeses(f.val)} style={{
              padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: filtroMeses === f.val ? 'var(--text)' : 'var(--bg2)',
              color: filtroMeses === f.val ? 'var(--surface)' : 'var(--text2)',
              transition: 'all 0.15s',
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* Grupo Urgentes */}
      {urgentes.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--red)', fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            ⏰ Vencimento Imediato
            <span style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: '1px 8px', borderRadius: 20, fontSize: 10 }}>{urgentes.length}</span>
          </div>
          {urgentes.map(a => <InadCard key={a.id} a={a} onCobrar={cobrarAluna} onPagar={pagarRapido} pagandoId={pagandoId} previewId={previewId} setPreviewId={setPreviewId} montarMsg={montarMensagem} config={config} />)}
        </div>
      )}

      {/* Grupo Crônicas */}
      {cronicas.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--red)', fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            🔴 Inadimplência Crônica (3+ meses)
            <span style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: '1px 8px', borderRadius: 20, fontSize: 10 }}>{cronicas.length}</span>
          </div>
          {cronicas.map(a => <InadCard key={a.id} a={a} onCobrar={cobrarAluna} onPagar={pagarRapido} pagandoId={pagandoId} previewId={previewId} setPreviewId={setPreviewId} montarMsg={montarMensagem} config={config} />)}
        </div>
      )}

      {/* Normais */}
      {normais.length > 0 && (
        <div>
          <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 700, marginBottom: 10 }}>
            Em Aberto
            <span style={{ background: 'var(--bg2)', color: 'var(--text3)', padding: '1px 8px', borderRadius: 20, fontSize: 10, marginLeft: 8 }}>{normais.length}</span>
          </div>
          {normais.map(a => <InadCard key={a.id} a={a} onCobrar={cobrarAluna} onPagar={pagarRapido} pagandoId={pagandoId} previewId={previewId} setPreviewId={setPreviewId} montarMsg={montarMensagem} config={config} />)}
        </div>
      )}

      {!filtrados.length && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 40, opacity: 0.2, marginBottom: 10 }}>✦</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>
            {inadimplentes.length === 0 ? 'Nenhuma inadimplente! Todas em dia. 🎉' : 'Nenhuma aluna encontrada com esse filtro.'}
          </div>
        </div>
      )}
    </div>
  );
}

const URGENCIA_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  vence_hoje:  { label: 'Vence hoje', color: '#D97706', bg: 'rgba(217,119,6,0.12)' },
  venceu_hoje: { label: 'Venceu ontem', color: '#DC2626', bg: 'rgba(220,38,38,0.12)' },
  vence_3d:   { label: 'Vence em 3 dias', color: '#D97706', bg: 'rgba(217,119,6,0.08)' },
  vence_7d:   { label: 'Vence em 7 dias', color: '#2563EB', bg: 'rgba(37,99,235,0.06)' },
};

function InadCard({ a, onCobrar, onPagar, pagandoId, previewId, setPreviewId, montarMsg, config }: any) {
  const isPreview = previewId === a.id;
  const urgCfg = URGENCIA_LABELS[a.urgencia];
  const qtdMeses = (a as any).quantidadeMeses || 1;
  const totalDebito = (a as any).totalDebito || a.valor;

  return (
    <div style={{
      background: 'var(--surface)', border: `1px solid ${qtdMeses >= 3 ? 'rgba(220,38,38,0.2)' : 'var(--border)'}`,
      borderRadius: 12, marginBottom: 10, overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Avatar */}
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--red-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--red)', fontWeight: 700, flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
          {(a as any).fotoUrl
            ? <img src={`/api/portal/foto/${a.id}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as any).style.display = 'none'; }} />
            : initials(a.nome)
          }
          {qtdMeses >= 3 && (
            <div style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: 'var(--red)', color: '#fff', fontSize: 8, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)' }}>!</div>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{a.nome}</div>
            {qtdMeses > 1 && (
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'var(--red-bg)', color: 'var(--red)', fontWeight: 700 }}>
                {qtdMeses}x em atraso
              </span>
            )}
            {urgCfg && (
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: urgCfg.bg, color: urgCfg.color, fontWeight: 700 }}>
                {urgCfg.label}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span>{a.responsavel}</span>
            <span>📱 {a.whatsapp}</span>
            <span className={`chip chip-${a.modalidade === 'Ballet' ? 'ballet' : a.modalidade === 'Jazz' ? 'jazz' : a.modalidade === 'Danças Urbanas' ? 'urbanas' : 'outro'}`} style={{ fontSize: 9 }}>{a.modalidade}</span>
            <span>Vence dia {(a as any).vencimento}</span>
          </div>
        </div>

        {/* Valor */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--red)', letterSpacing: -0.5 }}>{fmt(totalDebito)}</div>
          {qtdMeses > 1 && <div style={{ fontSize: 10, color: 'var(--text3)' }}>{qtdMeses}× {fmt(a.valor)}</div>}
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
          <button onClick={() => onPagar(a)} disabled={pagandoId === a.id} className="btn btn-xs btn-success" style={{ minWidth: 72 }}>
            {pagandoId === a.id ? '...' : '💰 Pagar'}
          </button>
          <button onClick={() => onCobrar(a)} className="btn btn-xs" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
            📱 Cobrar
          </button>
          <button onClick={() => setPreviewId(isPreview ? null : a.id)} className="btn btn-xs" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text3)', fontSize: 10 }}>
            {isPreview ? '▲ Fechar' : '👁 Msg'}
          </button>
        </div>
      </div>

      {/* Preview da mensagem */}
      {isPreview && (
        <div style={{ padding: '12px 18px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Preview da mensagem</div>
          <div style={{ background: '#e7f3ff', borderRadius: 12, padding: '12px 14px', fontSize: 12, color: '#1e1a16', lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto', borderTopLeftRadius: 4 }}>
            {montarMsg(a)}
          </div>
          <button onClick={() => onCobrar(a)} className="btn btn-sm btn-success" style={{ marginTop: 10, width: '100%' }}>
            📱 Enviar essa mensagem no WhatsApp
          </button>
        </div>
      )}
    </div>
  );
}
