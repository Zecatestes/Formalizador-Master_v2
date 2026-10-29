export type VehicleCustody = 'SIM' | 'NÃO';
export type ProductType = 'ROUBO' | 'FURTO' | '';
export type TrackerSupport = 'SIM' | 'NÃO' | '';
export type DocumentType = 'BO' | 'GRV' | 'NOC' | '';
export type ReleaseDocumentType = 'NOC' | 'Talão Token' | 'Requisição IC' | 'BO' | 'Auto de Entrega' | '';

export type ReportForm = {
  data: string;
  hora: string;
  placa: string;
  localRec: string;
  produto: ProductType;
  rastreador: TrackerSupport;
  apreendido: VehicleCustody | '';
  delegacia: string;
  endereco: string;
  telefone: string;
  documento: DocumentType;
  numeroDoc: string;
  roOrigem: string;
  documentoLiberacao: ReleaseDocumentType;
  numeroDocLiberacao: string;
  formalizacaoManual: string;
  conclusao: string;
  nome: string;
  cpf: string;
  sinistro: string;
  apolice: string;
};

export type EvidenceImage = {
  id: number;
  name: string;
  url: string;
  size: string;
  file: File;
};

export type ReportValidationErrors = Partial<Record<keyof ReportForm | 'fotos', string>>;

export const initialForm: ReportForm = {
  data: new Date().toISOString().slice(0, 10),
  hora: '',
  placa: '',
  localRec: '',
  produto: '',
  rastreador: '',
  apreendido: '',
  delegacia: '',
  endereco: '',
  telefone: '',
  documento: '',
  numeroDoc: '',
  roOrigem: '',
  documentoLiberacao: '',
  numeroDocLiberacao: '',
  formalizacaoManual: '',
  conclusao: '',
  nome: '',
  cpf: '',
  sinistro: '',
  apolice: '',
};

export function formatDate(value: string) {
  if (!value) return '—';
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('pt-BR');
}

export function formatTime(value: string) {
  return value ? value.replace(':', 'h') : '—';
}

export function buildAutomaticText(form: ReportForm) {
  const date = formatDate(form.data);
  const time = formatTime(form.hora);
  const tracker = form.rastreador === 'SIM' ? 'com auxílio do rastreador' : 'sem auxílio do rastreador';
  const location = form.localRec || 'local informado na ocorrência';
  return `Equipe ODEEN, no dia ${date} às ${time}, prosseguiu com a LOCALIZAÇÃO e RECUPERAÇÃO do veículo de placa ${form.placa || 'não informada'}, possuindo registro de ${form.produto || 'ocorrência'} e ${tracker}, localizado nas imediações da ${location}.`;
}

export function buildRecoveryText(form: ReportForm) {
  if (form.apreendido === 'SIM') {
    return [
      `Pátio de Apreensão: ${form.delegacia}`,
      `Endereço: ${form.endereco}`,
      `Telefone: ${form.telefone}`,
      `${form.documento || 'Documento'} nº: ${form.numeroDoc}`,
      form.roOrigem.trim() ? `RO de Origem: ${form.roOrigem}` : '',
      `Apólice: ${form.apolice}`,
    ].filter(Boolean).join('\n');
  }

  if (form.apreendido === 'NÃO') {
    return [
      `Responsável: ${form.nome}`,
      `CPF: ${form.cpf}`,
      `${form.documentoLiberacao} nº: ${form.numeroDocLiberacao}`,
      `Apólice: ${form.apolice}`,
    ].join('\n');
  }

  return '';
}

export function buildFormalization(form: ReportForm) {
  return [
    buildAutomaticText(form),
    form.formalizacaoManual.trim() ? form.formalizacaoManual : '',
    buildRecoveryText(form),
    form.conclusao.trim() ? form.conclusao : '',
  ].filter(Boolean).join('\n\n');
}

export function validateReport(form: ReportForm): ReportValidationErrors {
  const errors: ReportValidationErrors = {};
  const required: (keyof ReportForm)[] = [
    'data',
    'hora',
    'placa',
    'localRec',
    'produto',
    'rastreador',
    'apreendido',
    'sinistro',
    'apolice',
  ];
  required.forEach((field) => {
    if (!form[field].trim()) errors[field] = 'Preenchimento obrigatório';
  });

  if (form.apreendido === 'SIM') {
    (['delegacia', 'endereco', 'telefone', 'documento', 'numeroDoc'] as const).forEach((field) => {
      if (!form[field].trim()) errors[field] = 'Preenchimento obrigatório';
    });
  }
  if (form.apreendido === 'NÃO') {
    if (!form.nome.trim()) errors.nome = 'Preencha o Nome completo do responsável pela liberação.';
    if (!form.cpf.trim()) errors.cpf = 'Preencha o CPF.';
    if (!form.documentoLiberacao) errors.documentoLiberacao = 'Selecione o Documento da Ocorrência.';
    if (!form.numeroDocLiberacao.trim()) errors.numeroDocLiberacao = 'Preencha o Número do Documento da Ocorrência.';
  }
  return errors;
}