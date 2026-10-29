import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileImage,
  FileOutput,
  FileText,
  ImagePlus,
  Info,
  Landmark,
  Menu,
  Moon,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sun,
  UploadCloud,
  X,
} from 'lucide-react';
import FormalizadorPanel from '@/components/formalizador-panel';
import ConsultaAlertaPanel from '@/components/consulta-alerta-panel';
import { createReportPdf } from './pdfReport';
import {
  buildFormalization,
  formatDate,
  initialForm,
  validateReport,
  type DocumentType,
  type EvidenceImage,
  type ReleaseDocumentType,
  type ReportForm,
  type ReportValidationErrors,
} from './reportTypes';

function Home() {
  const [form, setForm] = useState<ReportForm>(initialForm);
  const [images, setImages] = useState<EvidenceImage[]>([]);
  const [errors, setErrors] = useState<ReportValidationErrors>({});
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<'report' | 'formalizer' | 'alert'>('report');
  const [isDark, setIsDark] = useState(() => {
    try { return window.localStorage.getItem('odeen-theme') === 'dark'; } catch { return false; }
  });
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const imageId = useRef(0);
  const imagesRef = useRef<EvidenceImage[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const completed = useMemo(() => {
    const required = ['data', 'hora', 'placa', 'localRec', 'produto', 'rastreador', 'apreendido', 'sinistro', 'apolice'] as const;
    const conditional = form.apreendido === 'SIM'
      ? ['delegacia', 'endereco', 'telefone', 'documento', 'numeroDoc'] as const
      : form.apreendido === 'NÃO' ? ['nome', 'cpf', 'documentoLiberacao', 'numeroDocLiberacao'] as const : [];
    return [...required, ...conditional].filter((field) => Boolean(form[field])).length;
  }, [form]);

  const updateField = <K extends keyof ReportForm>(field: K, value: ReportForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
    if (notice?.tone === 'error') setNotice(null);
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    const accepted = files.filter((file) => file.type.startsWith('image/'));
    if (accepted.length !== files.length) {
      setNotice({ tone: 'error', text: 'Apenas arquivos de imagem podem ser anexados como evidência.' });
    }
    setImages((current) => [
      ...current,
      ...accepted.map((file) => ({
        id: imageId.current++,
        name: file.name,
        url: URL.createObjectURL(file),
        size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
        file,
      })),
    ]);
    event.target.value = '';
  };

  const removeImage = (id: number) => {
    setImages((current) => {
      const image = current.find((item) => item.id === id);
      if (image) URL.revokeObjectURL(image.url);
      return current.filter((item) => item.id !== id);
    });
  };

  const generateReport = async () => {
    const nextErrors = validateReport(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setNotice({ tone: 'error', text: 'Revise os campos destacados antes de gerar o relatório.' });
      return;
    }
    setIsGenerating(true);
    setNotice({ tone: 'info', text: 'Montando o relatório e incorporando as evidências...' });
    try {
      await createReportPdf(form, images);
      setNotice({ tone: 'success', text: `PDF gerado: RELATORIO_HDI_${form.placa.replace(/[^A-Z0-9]/gi, '').toUpperCase()}.pdf` });
    } catch (error) {
      console.error(error);
      setNotice({ tone: 'error', text: 'Não foi possível gerar o PDF. Verifique as imagens e tente novamente.' });
    } finally {
      setIsGenerating(false);
    }
  };

  const clearForm = () => {
    images.forEach((image) => URL.revokeObjectURL(image.url));
    setForm(initialForm);
    setImages([]);
    setErrors({});
    setNotice({ tone: 'success', text: 'Formulário limpo. Um novo relatório está pronto para ser preenchido.' });
  };

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    const syncTheme = (event: Event) => {
      const theme = (event as CustomEvent<string>).detail;
      if (theme === 'light' || theme === 'dark') setIsDark(theme === 'dark');
    };
    window.addEventListener('odeen-theme-change', syncTheme);
    return () => window.removeEventListener('odeen-theme-change', syncTheme);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try { window.localStorage.setItem('odeen-theme', isDark ? 'dark' : 'light'); } catch { /* Tema ativo nesta sessão. */ }
    document.querySelector<HTMLIFrameElement>('iframe[title="Gerador de Formalizações — ODEEN"]')
      ?.contentWindow?.postMessage({ type: 'odeen-formalizador:theme', theme: isDark ? 'dark' : 'light' }, '*');
  }, [isDark]);

  useEffect(() => () => imagesRef.current.forEach((image) => URL.revokeObjectURL(image.url)), []);

  return (
    <div className="report-shell min-h-[100dvh] text-foreground">
      <header className="no-print sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground shadow-lg shadow-slate-950/10 md:hidden">
        <Brand compact />
        <button type="button" aria-label="Abrir menu" data-testid="button-toggle-menu" onClick={() => setIsMenuOpen((open) => !open)} className="rounded-md p-2 text-sidebar-foreground hover:bg-sidebar-accent">
          {isMenuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </header>

      <aside className={`no-print fixed inset-y-0 left-0 z-40 flex w-[258px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 md:translate-x-0 ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="hidden h-[102px] items-center border-b border-sidebar-border px-7 md:flex"><Brand /></div>
        <div className="flex h-[88px] items-center border-b border-sidebar-border px-6 md:hidden"><Brand /></div>
        <div className="px-4 pt-7">
          <p className="px-3 text-[10px] font-bold uppercase tracking-[.18em] text-sidebar-foreground/45">Mesa de documentos</p>
          <div className="mt-3 space-y-2">
            <button type="button" aria-current={activeTool === 'report' ? 'page' : undefined} onClick={() => { setActiveTool('report'); setIsMenuOpen(false); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring ${activeTool === 'report' ? 'bg-sidebar-primary/15 text-sidebar-primary-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent'}`}>
              <span className={`grid size-8 place-items-center rounded-md ${activeTool === 'report' ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'bg-sidebar-accent text-sidebar-foreground'}`}><FileText size={16} /></span>
              <span><span className="block text-sm font-semibold">Novo relatório</span><span className="block text-[11px] text-sidebar-foreground/55">HDI · Recuperação</span></span>
            </button>
            <button type="button" aria-current={activeTool === 'formalizer' ? 'page' : undefined} onClick={() => { setActiveTool('formalizer'); setIsMenuOpen(false); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring ${activeTool === 'formalizer' ? 'bg-sidebar-primary/15 text-sidebar-primary-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent'}`}>
              <span className={`grid size-8 place-items-center rounded-md ${activeTool === 'formalizer' ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'bg-sidebar-accent text-sidebar-foreground'}`}><ClipboardCheck size={16} /></span>
              <span><span className="block text-sm font-semibold">Formalizador Faster</span><span className="block text-[11px] text-sidebar-foreground/55">Recuperação · padrões</span></span>
            </button>
            <button type="button" aria-current={activeTool === 'alert' ? 'page' : undefined} onClick={() => { setActiveTool('alert'); setIsMenuOpen(false); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring ${activeTool === 'alert' ? 'bg-sidebar-primary/15 text-sidebar-primary-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent'}`}>
              <span className={`grid size-8 place-items-center rounded-md ${activeTool === 'alert' ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'bg-sidebar-accent text-sidebar-foreground'}`}><Search size={16} /></span>
              <span><span className="block text-sm font-semibold">Consulta/Gerador de Alerta R/F</span><span className="block text-[11px] text-sidebar-foreground/55">Consulta de placa · alertas</span></span>
            </button>
          </div>
        </div>
        <div className="mt-auto border-t border-sidebar-border p-5">
          <div className="flex items-start gap-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-sidebar-accent text-xs font-bold text-sidebar-primary">OC</div>
            <div><p className="text-xs font-semibold">Odeen &amp; Co.</p><p className="mt-0.5 text-[11px] text-sidebar-foreground/50">Ambiente local · seguro</p></div>
          </div>
          <div className="mt-5 flex items-center gap-2 text-[10px] uppercase tracking-wider text-sidebar-foreground/40"><span className="size-1.5 rounded-full bg-sidebar-primary status-pulse" />Dados não saem deste dispositivo</div>
        </div>
      </aside>
      {isMenuOpen && <button type="button" aria-label="Fechar menu" data-testid="button-close-menu-overlay" onClick={() => setIsMenuOpen(false)} className="no-print fixed inset-0 z-30 bg-slate-950/30 md:hidden" />}

      <main className="min-h-[100dvh] md:ml-[258px]">
        <div className="no-print mx-auto max-w-[1460px] px-4 pb-12 sm:px-6 lg:px-10">
          <div className="flex min-h-[112px] items-end justify-between gap-4 border-b border-border pb-6 pt-8">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground"><span>{activeTool === 'report' ? 'Relatórios' : 'Ferramentas'}</span><ArrowRight size={11} /><span className="text-primary">{activeTool === 'report' ? 'Novo HDI' : activeTool === 'formalizer' ? 'Formalizador Faster' : 'Consulta/Gerador de Alerta R/F'}</span></div>
              <h1 className="font-serif text-3xl font-semibold tracking-[-.025em] text-foreground sm:text-4xl">{activeTool === 'report' ? 'Gerador de Relatórios' : activeTool === 'formalizer' ? 'Formalizador Faster' : 'Consulta/Gerador de Alerta R/F'}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{activeTool === 'report' ? 'Converta evidências de recuperação em um documento institucional.' : activeTool === 'formalizer' ? 'Gere formalizações de recuperação e use modelos operacionais padrão.' : 'Consulte placas e prepare alertas de roubo/furto em uma única tela.'}</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] font-semibold text-primary sm:flex"><ShieldCheck size={14} /> Ambiente confidencial</div>
              <button type="button" onClick={() => setIsDark((value) => !value)} aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'} aria-pressed={isDark} className="theme-switch no-print inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-sm transition hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-primary">{isDark ? <Sun size={14} /> : <Moon size={14} />}</span>
                <span className="hidden sm:inline">{isDark ? 'Modo claro' : 'Modo escuro'}</span>
                <span className={`theme-switch-track ${isDark ? 'is-on' : ''}`} aria-hidden="true"><span /></span>
              </button>
            </div>
          </div>

          {activeTool === 'report' && (
            <>
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
            <section className="min-w-0 space-y-5">
              <div className="panel-odeen overflow-hidden">
                 <SectionHeader icon={<ClipboardCheck size={17} />} title="Dados da recuperação" description="Identificação e contexto da ocorrência" count={`${completed}/${form.apreendido === 'SIM' ? 14 : form.apreendido === 'NÃO' ? 13 : 9} completos`} />
                <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-7">
                  <Field label="Data" required error={errors.data}><input id="data" data-testid="input-data" type="date" className="input-odeen" aria-invalid={Boolean(errors.data)} value={form.data} onChange={(event) => updateField('data', event.target.value)} /></Field>
                  <Field label="Hora" required error={errors.hora}><input id="hora" data-testid="input-hora" type="time" className="input-odeen" aria-invalid={Boolean(errors.hora)} value={form.hora} onChange={(event) => updateField('hora', event.target.value)} /></Field>
                  <Field label="Placa" required error={errors.placa}><input id="placa" data-testid="input-placa" className="input-odeen uppercase" aria-invalid={Boolean(errors.placa)} value={form.placa} onChange={(event) => updateField('placa', event.target.value.toUpperCase())} placeholder="ABC1D23" /></Field>
                  <Field label="Produto" required error={errors.produto}><select id="produto" data-testid="select-produto" className="input-odeen" aria-invalid={Boolean(errors.produto)} value={form.produto} onChange={(event) => updateField('produto', event.target.value as ReportForm['produto'])}><option value="">Selecione</option><option value="ROUBO">ROUBO</option><option value="FURTO">FURTO</option></select></Field>
                  <Field label="Auxílio do rastreador?" required error={errors.rastreador}><select id="rastreador" data-testid="select-rastreador" className="input-odeen" aria-invalid={Boolean(errors.rastreador)} value={form.rastreador} onChange={(event) => updateField('rastreador', event.target.value as ReportForm['rastreador'])}><option value="">Selecione</option><option value="SIM">SIM</option><option value="NÃO">NÃO</option></select></Field>
                  <Field label="Sinistro" required error={errors.sinistro}><input id="sinistro" data-testid="input-sinistro" className="input-odeen" aria-invalid={Boolean(errors.sinistro)} value={form.sinistro} onChange={(event) => updateField('sinistro', event.target.value)} placeholder="Número do sinistro" /></Field>
                  <Field label="Apólice" required error={errors.apolice}><input id="apolice" data-testid="input-apolice" className="input-odeen" aria-invalid={Boolean(errors.apolice)} value={form.apolice} onChange={(event) => updateField('apolice', event.target.value)} placeholder="Número da apólice" /></Field>
                  <Field label="Local da recuperação" required error={errors.localRec} className="sm:col-span-2"><textarea id="localRec" data-testid="textarea-local-rec" className="input-odeen min-h-[82px] resize-y" aria-invalid={Boolean(errors.localRec)} value={form.localRec} onChange={(event) => updateField('localRec', event.target.value)} placeholder="Rua, bairro, cidade e UF" /></Field>
                </div>
              </div>

              <div className="panel-odeen overflow-hidden">
                <SectionHeader icon={<FileCheck2 size={17} />} title="Situação do veículo" description="Os campos seguintes mudam conforme a custódia" />
                <div className="grid gap-5 p-5 sm:p-7">
                  <Field label="Veículo ficou apreendido?" required error={errors.apreendido}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <StatusChoice active={form.apreendido === 'SIM'} onClick={() => updateField('apreendido', 'SIM')} icon={<FileText size={17} />} title="SIM" description="Preencher dados da apreensão" testId="button-apreendido-sim" />
                      <StatusChoice active={form.apreendido === 'NÃO'} onClick={() => updateField('apreendido', 'NÃO')} icon={<BadgeCheck size={17} />} title="NÃO" description="Informar proprietário e liberação" testId="button-apreendido-nao" />
                    </div>
                  </Field>
                  {form.apreendido === 'SIM' && <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Delegacia / Pátio" required error={errors.delegacia} className="sm:col-span-2"><input id="delegacia" data-testid="input-delegacia" className="input-odeen" aria-invalid={Boolean(errors.delegacia)} value={form.delegacia} onChange={(event) => updateField('delegacia', event.target.value)} placeholder="Nome da delegacia ou pátio" /></Field>
                    <Field label="Endereço" required error={errors.endereco} className="sm:col-span-2"><textarea id="endereco" data-testid="textarea-endereco" className="input-odeen min-h-[72px] resize-y" aria-invalid={Boolean(errors.endereco)} value={form.endereco} onChange={(event) => updateField('endereco', event.target.value)} placeholder="Endereço completo" /></Field>
                    <Field label="Telefone" required error={errors.telefone}><input id="telefone" data-testid="input-telefone" className="input-odeen" aria-invalid={Boolean(errors.telefone)} value={form.telefone} onChange={(event) => updateField('telefone', event.target.value)} placeholder="(00) 0000-0000" /></Field>
                    <Field label="Documento" required error={errors.documento}><select id="documento" data-testid="select-documento" className="input-odeen" aria-invalid={Boolean(errors.documento)} value={form.documento} onChange={(event) => updateField('documento', event.target.value as DocumentType)}><option value="">Selecione</option><option value="BO">BO</option><option value="GRV">GRV</option><option value="NOC">NOC</option></select></Field>
                    <Field label="Número do documento" required error={errors.numeroDoc}><input id="numeroDoc" data-testid="input-numero-doc" className="input-odeen" aria-invalid={Boolean(errors.numeroDoc)} value={form.numeroDoc} onChange={(event) => updateField('numeroDoc', event.target.value)} /></Field>
                     <Field label="RO de origem"><input id="roOrigem" data-testid="input-ro-origem" className="input-odeen" aria-invalid={Boolean(errors.roOrigem)} value={form.roOrigem} onChange={(event) => updateField('roOrigem', event.target.value)} placeholder="Opcional" /></Field>
                  </div>}
                  {form.apreendido === 'NÃO' && <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Nome completo do responsável" required error={errors.nome} className="sm:col-span-2"><input id="nome" data-testid="input-nome" className="input-odeen" aria-invalid={Boolean(errors.nome)} value={form.nome} onChange={(event) => updateField('nome', event.target.value)} /></Field>
                    <Field label="CPF" required error={errors.cpf}><input id="cpf" data-testid="input-cpf" className="input-odeen" aria-invalid={Boolean(errors.cpf)} value={form.cpf} onChange={(event) => updateField('cpf', event.target.value)} placeholder="000.000.000-00" /></Field>
                    <Field label="Documento da Ocorrência" required error={errors.documentoLiberacao}><select id="documentoLiberacao" data-testid="select-documento-liberacao" className="input-odeen" aria-invalid={Boolean(errors.documentoLiberacao)} value={form.documentoLiberacao} onChange={(event) => updateField('documentoLiberacao', event.target.value as ReleaseDocumentType)}><option value="">Selecione</option><option value="NOC">NOC</option><option value="Talão Token">Talão Token</option><option value="Requisição IC">Requisição IC</option><option value="BO">BO</option><option value="Auto de Entrega">Auto de Entrega</option></select></Field>
                    <Field label="Número do Documento da Ocorrência" required error={errors.numeroDocLiberacao} className="sm:col-span-2"><input id="numeroDocLiberacao" data-testid="input-numero-doc-liberacao" className="input-odeen" aria-invalid={Boolean(errors.numeroDocLiberacao)} value={form.numeroDocLiberacao} onChange={(event) => updateField('numeroDocLiberacao', event.target.value)} /></Field>
                  </div>}
                  {!form.apreendido && <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground"><Info size={14} className="mr-2 inline-block align-text-bottom" />Escolha uma situação para liberar os campos específicos e adaptar a formalização.</div>}
                </div>
              </div>

              <div className="panel-odeen overflow-hidden">
                <SectionHeader icon={<FileText size={17} />} title="Formalização do relatório" description="Escreva os trechos narrativos opcionais do caso" />
                <div className="grid gap-5 p-5 sm:p-7">
                  <Field label="Formalização / Complemento da Ocorrência">
                    <textarea id="formalizacaoManual" data-testid="textarea-formalizacao-manual" className="input-odeen min-h-[150px] resize-y" value={form.formalizacaoManual} onChange={(event) => updateField('formalizacaoManual', event.target.value)} placeholder="Digite aqui o complemento da ocorrência. Você pode usar vários parágrafos." />
                  </Field>
                  <Field label="Conclusão / Encerramento">
                    <textarea id="conclusao" data-testid="textarea-conclusao" className="input-odeen min-h-[120px] resize-y" value={form.conclusao} onChange={(event) => updateField('conclusao', event.target.value)} placeholder="Digite aqui a conclusão ou o encerramento do caso." />
                  </Field>
                </div>
              </div>

              <div className="panel-odeen overflow-hidden">
                <SectionHeader icon={<ImagePlus size={17} />} title="Fotos da recuperação" description="Imagens opcionais incorporadas ao PDF em páginas próprias" count={`${images.length} ${images.length === 1 ? 'arquivo' : 'arquivos'}`} />
                <div className="p-5 sm:p-7">
                  <input id="fotos" ref={fileInput} type="file" accept="image/*" multiple className="hidden" data-testid="input-fotos" onChange={handleFiles} />
                  <button type="button" data-testid="button-upload-fotos" onClick={() => fileInput.current?.click()} className="group flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-primary/35 bg-primary/[.035] px-5 py-7 text-center transition hover:border-primary hover:bg-primary/[.07]">
                    <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary transition group-hover:scale-105"><UploadCloud size={19} /></span>
                    <span className="mt-3 text-sm font-bold text-foreground">Adicionar imagens</span>
                    <span className="mt-1 text-xs text-muted-foreground">PNG, JPG ou WEBP · múltiplos arquivos aceitos</span>
                  </button>
                  {images.length > 0 && <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{images.map((image) => <EvidenceThumb key={image.id} image={image} onRemove={() => removeImage(image.id)} />)}</div>}
                  {!images.length && <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Info size={14} />Você pode gerar o relatório sem fotos e adicioná-las quando disponíveis.</div>}
                </div>
              </div>
            </section>

            <aside className="no-print space-y-5 xl:sticky xl:top-6 xl:self-start">
              <div className="panel-odeen overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Saída em tempo real</p><h2 className="mt-1 text-base font-bold">Prévia da formalização</h2></div><span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary"><FileOutput size={17} /></span></div>
                <div className="bg-muted/35 p-4"><ReportPreview form={form} images={images} /></div>
              </div>
              <Checklist form={form} images={images} errors={errors} />
            </aside>
          </div>

          {notice && <div role="status" data-testid={`status-${notice.tone}`} className={`mt-5 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${notice.tone === 'success' ? 'border-emerald-700/20 bg-emerald-50 text-emerald-900' : notice.tone === 'error' ? 'border-destructive/25 bg-red-50 text-red-900' : 'border-primary/20 bg-primary/5 text-primary'}`}><span className="mt-0.5">{notice.tone === 'success' ? <CheckCircle2 size={16} /> : notice.tone === 'error' ? <AlertCircle size={16} /> : <Info size={16} />}</span><span>{notice.text}</span></div>}
          <div className="no-print mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" data-testid="button-clear-form" onClick={clearForm} className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground transition hover:border-destructive/35 hover:bg-destructive/5 hover:text-destructive"><RefreshCcw size={15} />Limpar formulário</button>
            <button type="button" data-testid="button-generate-pdf" onClick={generateReport} disabled={isGenerating} className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-md shadow-primary/15 transition hover:-translate-y-0.5 hover:bg-primary/90 disabled:cursor-wait disabled:opacity-70">{isGenerating ? <><span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />Gerando documento...</> : <><FileOutput size={16} />Gerar PDF</>}</button>
          </div>
            </>
          )}
          <div className={activeTool === 'formalizer' ? 'mt-6' : 'hidden'} aria-hidden={activeTool !== 'formalizer'}>
            <FormalizadorPanel />
          </div>
          {activeTool === 'alert' && <div className="mt-6"><ConsultaAlertaPanel /></div>}
        </div>
      </main>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-3"><div className="relative grid size-9 place-items-center rounded-md border border-sidebar-primary/40 bg-sidebar-primary/10 text-sidebar-primary"><Landmark size={18} /><span className="absolute -right-1 -top-1 size-2 rounded-full bg-sidebar-primary" /></div><div><p className={`font-serif font-semibold tracking-tight text-sidebar-foreground ${compact ? 'text-base' : 'text-lg'}`}>Odeen <span className="text-sidebar-primary">&amp;</span> Co.</p><p className="text-[9px] font-bold uppercase tracking-[.2em] text-sidebar-foreground/45">Investigações</p></div></div>;
}

function SectionHeader({ icon, title, description, count }: { icon: ReactNode; title: string; description: string; count?: string }) {
  return <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-7"><div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary">{icon}</span><div><h2 className="text-sm font-bold">{title}</h2><p className="text-xs text-muted-foreground">{description}</p></div></div>{count && <span className="text-[11px] font-semibold text-muted-foreground">{count}</span>}</div>;
}

function Field({ label, required, error, className = '', children }: { label: string; required?: boolean; error?: string; className?: string; children: ReactNode }) {
  return <div className={className}><label className="label-odeen">{label} {required && <span className="text-destructive">*</span>}</label>{children}{error && <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-destructive"><AlertCircle size={12} />{error}</p>}</div>;
}

function StatusChoice({ active, onClick, icon, title, description, testId }: { active: boolean; onClick: () => void; icon: ReactNode; title: string; description: string; testId: string }) {
  return <button type="button" data-testid={testId} onClick={onClick} className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${active ? 'border-primary bg-primary/7 text-primary shadow-sm' : 'border-border bg-card hover:border-primary/40'}`}><span className={`grid size-8 place-items-center rounded-md ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{icon}</span><span className="min-w-0 flex-1"><span className="block text-sm font-bold">{title}</span><span className="block text-xs text-muted-foreground">{description}</span></span>{active && <Check size={16} />}</button>;
}

function EvidenceThumb({ image, onRemove }: { image: EvidenceImage; onRemove: () => void }) {
  return <div className="group relative overflow-hidden rounded-lg border border-border bg-muted"><img src={image.url} alt={`Evidência ${image.name}`} className="aspect-[4/3] w-full object-cover" /><div className="absolute inset-x-0 bottom-0 bg-slate-950/70 px-2 py-1.5 text-[10px] text-white"><p className="truncate">{image.name}</p><p className="text-white/60">{image.size}</p></div><button type="button" aria-label={`Remover ${image.name}`} data-testid={`button-remove-fotos-${image.id}`} onClick={onRemove} className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-md bg-slate-950/65 text-white opacity-100 transition hover:bg-destructive sm:opacity-0 sm:group-hover:opacity-100"><X size={14} /></button></div>;
}

function Checklist({ form, images, errors }: { form: ReportForm; images: EvidenceImage[]; errors: ReportValidationErrors }) {
  const items = [
    { label: 'Dados da recuperação', done: Boolean(form.data && form.hora && form.placa && form.localRec) },
    { label: 'Produto e rastreador', done: Boolean(form.produto && form.rastreador) },
    { label: 'Situação do veículo', done: form.apreendido === 'SIM' ? Boolean(form.delegacia && form.endereco && form.telefone && form.documento && form.numeroDoc) : form.apreendido === 'NÃO' ? Boolean(form.nome && form.cpf && form.documentoLiberacao && form.numeroDocLiberacao) : false },
    { label: 'Sinistro e apólice', done: Boolean(form.sinistro && form.apolice) },
    { label: 'Fotos da recuperação', done: images.length > 0, optional: true },
  ];
  const count = items.filter((item) => item.done).length;
  return <div className="panel-odeen p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">Controle de qualidade</p><h2 className="mt-1 text-sm font-bold">Checklist do relatório</h2></div><span className={`text-sm font-bold ${count === items.length - 1 ? 'text-primary' : 'text-muted-foreground'}`}>{count}/{items.length - 1}</span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${(count / (items.length - 1)) * 100}%` }} /></div><div className="mt-4 space-y-2.5">{items.map((item) => <div key={item.label} className="flex items-center gap-2.5 text-xs"><span className={`grid size-4 place-items-center rounded-full border ${item.done ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-transparent'}`}>{item.done && <Check size={10} strokeWidth={3} />}</span><span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>{item.label}{item.optional && <span className="ml-1 text-[10px] text-muted-foreground/70">(opcional)</span>}</span>{!item.done && errors[Object.keys(errors)[0] as keyof ReportValidationErrors] && !item.optional && <AlertCircle size={12} className="ml-auto text-destructive" />}</div>)}</div>{count >= items.length - 1 && <div className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-xs font-semibold text-primary"><BadgeCheck size={15} />Pronto para conferência final</div>}</div>;
}

function ReportPreview({ form, images }: { form: ReportForm; images: EvidenceImage[] }) {
  return <article className="paper-grid overflow-hidden rounded-md border border-border bg-card shadow-sm"><div className="border-b-2 border-accent px-5 py-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[8px] font-bold uppercase tracking-[.18em] text-primary">Odeen &amp; Co. Investigações</p><h3 className="mt-3 font-serif text-lg font-semibold leading-tight text-foreground">Relatório de recuperação de ativo</h3><p className="mt-1 text-[9px] font-semibold uppercase tracking-[.14em] text-muted-foreground">Classificação confidencial</p></div><div className="grid size-9 place-items-center rounded border border-primary/20 bg-primary/5 text-primary"><ShieldCheck size={17} /></div></div></div><div className="space-y-4 px-5 py-5 text-[11px]"><div className="grid grid-cols-2 gap-3"><PreviewLine label="Apólice" value={form.apolice || '—'} /><PreviewLine label="Sinistro" value={form.sinistro || '—'} /></div><div className="grid grid-cols-2 gap-3"><PreviewLine label="Data" value={formatDate(form.data)} /><PreviewLine label="Hora" value={form.hora || '—'} /></div><PreviewLine label="Placa" value={form.placa || 'Aguardando placa'} /><PreviewLine label="Produto" value={form.produto || '—'} /><div className="section-rule" /><div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-muted-foreground">Composição do relatório</p><p className="mt-2 max-h-[310px] overflow-hidden whitespace-pre-wrap leading-relaxed text-muted-foreground">{buildFormalization(form)}</p></div>{images.length > 0 && <div className="flex items-center gap-2 border-t border-border pt-3 text-muted-foreground"><ImagePlus size={13} /><span>{images.length} {images.length === 1 ? 'imagem anexada' : 'imagens anexadas'}</span></div>}</div><div className="border-t border-border px-5 py-3 text-[9px] text-muted-foreground">Prévia local · conteúdo não enviado</div></article>;
}

function PreviewLine({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-muted-foreground">{label}</p><p className="mt-1 truncate font-semibold text-foreground">{value}</p></div>;
}

function Router() {
  return <RoutedErrorBoundary><Switch><Route path="/" component={Home} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter>;
}

export default App;
