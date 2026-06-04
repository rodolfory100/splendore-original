import { useState, useEffect } from "react";
import { fmt, initials } from "../lib/api";
import { getArquivoMorto, restaurarAluna } from "../lib/api";

interface Props {
  onRefresh: () => void;
  onToast: (msg: string, type?: "success"|"danger"|"gold") => void;
  config: any;
}

export function ArquivoMortoPage({ onRefresh, onToast, config }: Props) {
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [restaurandoId, setRestaurandoId] = useState<string|null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const d = await getArquivoMorto();
      setLista(d);
    } catch(e:any) { onToast(e.message,"danger"); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const filtrada = lista.filter(a => !busca || a.nome?.toLowerCase().includes(busca.toLowerCase()));

  const handleRestaurar = async (a: any) => {
    if (!confirm(`Reativar ${a.nome}?\n\nEla voltará como aluna ativa.`)) return;
    setRestaurandoId(a.id);
    try {
      await restaurarAluna(a.id);
      onToast(`✦ ${a.nome} reativada!`, "success");
      carregar();
      onRefresh();
    } catch(e:any) { onToast(e.message,"danger"); }
    finally { setRestaurandoId(null); }
  };

  const convidar = (a: any) => {
    const escola = config?.escola || "Splendore Escola de Dança";
    const wpp = (a.whatsapp||'').replace(/\D/g,'');
    const msg = encodeURIComponent(`Olá! 🌸\n\nSentimos a falta de *${a.nome}* aqui na *${escola}*!\n\nQue tal voltarmos? Temos uma vaga esperando por ela. 🩰\n\nEntre em contato para saber mais!\n\nCom carinho, *${escola}* ✨`);
    if (wpp) window.open(`https://wa.me/55${wpp}?text=${msg}`, '_blank');
    else onToast("WhatsApp não cadastrado","danger");
  };

  const totalReceita = filtrada.reduce((s,a) => s+(a.valor||0), 0);

  return (
    <div className="animate-fade-up">
      <div className="section-header">
        <div>
          <div className="section-title">Arquivo Morto</div>
          <div className="section-sub">Alunas desligadas que podem ser recuperadas</div>
        </div>
      </div>

      {/* Alerta receita perdida */}
      {filtrada.length > 0 && (
        <div style={{ background:'rgba(184,112,42,0.07)', border:'1.5px solid rgba(184,112,42,0.22)', borderRadius:12, padding:'14px 18px', marginBottom:20, display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
          <span style={{ fontSize:24 }}>⚠️</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--amber)' }}>{filtrada.length} aluna{filtrada.length!==1?'s':''} no arquivo morto</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>Receita mensal perdida: <strong style={{ color:'var(--red)' }}>{fmt(totalReceita)}</strong></div>
          </div>
          <button onClick={() => filtrada.forEach((a,i) => setTimeout(()=>convidar(a),i*1200))} className="btn btn-sm" style={{ background:'rgba(184,112,42,0.1)', color:'var(--amber)', border:'1px solid rgba(184,112,42,0.3)' }}>
            📱 Convidar todas
          </button>
        </div>
      )}

      {/* Busca */}
      <div className="search-wrap" style={{ marginBottom:16, maxWidth:360 }}>
        <span className="search-icon">🔍</span>
        <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar aluna..." />
      </div>

      {loading ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:48, gap:12, color:'var(--text3)' }}>
          <div className="spinner" /> Carregando...
        </div>
      ) : !filtrada.length ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--text3)' }}>
          <div style={{ fontSize:40, marginBottom:12, opacity:0.2 }}>🗄️</div>
          <div style={{ fontSize:14, fontWeight:600, color:'var(--text2)', marginBottom:6 }}>
            {busca ? 'Nenhuma aluna encontrada' : 'Arquivo morto vazio'}
          </div>
          <div style={{ fontSize:13 }}>
            {busca ? 'Tente outra busca.' : 'Ótimo! Nenhuma aluna foi desligada ainda.'}
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Alunas Desligadas</div>
              <div className="panel-sub">{filtrada.length} registro{filtrada.length!==1?'s':''}</div>
            </div>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table className="splendore-table">
              <thead>
                <tr><th>Aluna</th><th>Responsável</th><th>WhatsApp</th><th>Modalidade</th><th>Mensalidade</th><th>Desligada em</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {filtrada.map(a => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div className="avatar avatar-sm" style={{ background:'rgba(184,112,42,0.1)', color:'var(--amber)', fontSize:10 }}>
                          {initials(a.nome)}
                        </div>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600 }}>{a.nome}</div>
                          {a.motivo && <div style={{ fontSize:10, color:'var(--text3)' }}>{a.motivo}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize:13, color:'var(--text2)' }}>{a.responsavel||'—'}</td>
                    <td>
                      {a.whatsapp ? (
                        <a href={`https://wa.me/55${(a.whatsapp).replace(/\D/g,'')}`} target="_blank" style={{ color:'var(--green)', fontSize:12, textDecoration:'none' }}>
                          📱 {a.whatsapp}
                        </a>
                      ) : '—'}
                    </td>
                    <td><span style={{ fontSize:12, padding:'2px 9px', borderRadius:99, background:'var(--gold-bg)', color:'var(--gold-dark)', fontWeight:600 }}>{a.modalidade||'—'}</span></td>
                    <td style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:13 }}>{a.valor ? fmt(a.valor) : '—'}</td>
                    <td style={{ fontSize:12, color:'var(--text3)' }}>{a.arquivadaEm||'—'}</td>
                    <td>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={()=>convidar(a)} className="btn btn-xs btn-success">📱 Convidar</button>
                        <button
                          onClick={()=>handleRestaurar(a)}
                          disabled={restaurandoId===a.id}
                          className="btn btn-primary btn-xs"
                        >
                          {restaurandoId===a.id ? '...' : '↩ Reativar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
