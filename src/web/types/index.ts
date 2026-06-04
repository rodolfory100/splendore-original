export interface Aluna {
  id: string;
  nome: string;
  responsavel: string;
  whatsapp?: string;
  email?: string;
  cpfResponsavel?: string;
  cpfResponsavel2?: string;
  modalidade: string;
  nivel?: string;
  valor: number;
  vencimento?: string;
  nascimento?: string;
  turmaId?: string;
  observacao?: string;
  ativo?: boolean;
  suspenso?: boolean;
  bolsista?: boolean;
  bolsaDesconto?: number;   // 0-100 (100 = gratuito)
  valorOriginal?: number;   // valor antes da bolsa
  contratoNum?: string;
  autorizaImagem?: boolean;
  fotoUrl?: string;
  planoSaude?: string;
  contatoEmergencia?: string;
  tamanhoRoupa?: string;
  obsPedagogicas?: string;
  contratoDe?: string;
  contratoAte?: string;
  cadastro?: string;
  updatedAt?: string;
}

export interface Pagamento {
  id: string;
  alunaId: string;
  mes: string;
  data: string;
  valor: number;
  forma?: string;
  observacao?: string;
}

export interface Turma {
  id: string;
  nome: string;
  modalidade: string;
  nivel?: string;
  dias?: string;
  horario?: string;
  professor?: string;
  vagas?: number;
  faixaEtaria?: string;
  observacao?: string;
}

export interface Aviso {
  id: string;
  mensagem: string;
  tipo?: string;
  createdAt?: string;
}

export interface ConfigEscola {
  id?: number;
  escola?: string;
  nomeAdmin?: string;
  whatsapp?: string;
  email?: string;
  endereco?: string;
  cidade?: string;
  instagram?: string;
  cnpj?: string;
  pix?: string;
  msgCobranca?: string;
}

export interface Inadimplente extends Aluna {
  mesesDevendo: string[];
  totalDebito: number;
  quantidadeMeses: number;
}

export interface RenovacaoAluna extends Aluna {
  diasRestantes: number | null;
  urgencia: 'vencido' | 'critico' | 'atencao' | 'aviso' | 'ok' | 'sem_contrato';
}
