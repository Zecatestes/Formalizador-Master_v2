import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle, ArrowDownToLine, Check, Copy, Database, ExternalLink,
  Loader2, Search, Sparkles, TriangleAlert,
} from 'lucide-react';
import { AlertGenerator } from '@/components/alert-generator';
import {
  EMPTY_VEHICLE_DATA, extrairDadosVeiculo, gerarLinkGoogleMaps,
  preencherDadosVeiculo, type ScrapeResult, type VehicleData,
  type VehicleLookupSource,
} from '@/lib/vehicle-integration';

const DETAIL_SELECTOR = '.template-middle .site-content > p:first-of-type';
const SOURCE_FIELDS: Record<VehicleLookupSource, Array<{ key: string; selector: string; attribute: 'text' }>> = {
  keplaca: [
    { key: 'h1', selector: 'h1', attribute: 'text' },
    { key: 'detalhe', selector: DETAIL_SELECTOR, attribute: 'text' },
  ],
  dadosdaplaca: [
    { key: 'h1', selector: 'h1', attribute: 'text' },
    { key: 'marca', selector: '.dados-bloco .dado:has(> .dado__label:-soup-contains("Marca")) > .dado__valor', attribute: 'text' },
    { key: 'modelo', selector: '.dados-bloco .dado:has(> .dado__label:-soup-contains("Modelo")) > .dado__valor', attribute: 'text' },
    { key: 'ano', selector: '.dados-bloco .dado:has(> .dado__label:-soup-contains("Ano")) > .dado__valor', attribute: 'text' },
    { key: 'cor', selector: '.dados-bloco .dado:has(> .dado__label:-soup-contains("Cor")) > .dado__valor', attribute: 'text' },
    { key: 'chassi', selector: '.dados-bloco .dado:has(> .dado__label:-soup-contains("Chassi")) > .dado__valor', attribute: 'text' },
  ],
};

function normalizePlate(value: string) {
  return value.trim().replace(/^\/+|\/+$/g, '').replace(/\s/g, '').replace(/-/g, '').toUpperCase();
}
function formatPlateWithHyphen(plate: string) {
  return plate.length > 3 ? `${plate.slice(0, 3)}-${plate.slice(3)}` : plate;
}
function normalizeHeading(value: unknown, source: VehicleLookupSource) {
  const text = String(value ?? '');
  if (source === 'dadosdaplaca') return text.toUpperCase();
  return text.replace(/^(Placa\s+)([A-Za-z0-9-]+)$/i, (_, prefix: string, p: string) => `${prefix}${p.replace(/-/g, '').toUpperCase()}`);
}
function csvEscape(value: unknown) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }
function downloadCsv(result: ScrapeResult) {
  const lines = [result.columns.map(csvEscape).join(','), ...result.rows.map(row => result.columns.map(column => csvEscape(row[column])).join(','))];
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `consulta-placa-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
const API_URL = import.meta.env.VITE_SCRAPER_API_URL || '/api/scrape';
const PLATE_PATTERN = /^(?:[A-Z]{3}\d{4}|[A-Z]{3}\d[A-Z]\d{2})$/;

export default function ConsultaAlertaPanel() {
  const [plate, setPlate] = useState('');
  const [source, setSource] = useState<VehicleLookupSource>('keplaca');
  const [matriz, setMatriz] = useState('');
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [vehicleData, setVehicleData] = useState<VehicleData>(EMPTY_VEHICLE_DATA);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const normalizedPlate = normalizePlate(plate);
  const validPlate = PLATE_PATTERN.test(normalizedPlate);
  const sourceUrl = source === 'keplaca'
    ? `https://www.keplaca.com/placa/${encodeURIComponent(normalizedPlate)}`
    : `https://dadosdaplaca.com.br/${encodeURIComponent(formatPlateWithHyphen(normalizedPlate))}?fonte=busca`;

  useEffect(() => {
    setVehicleData(current => current.matriz === matriz ? current : { ...current, matriz });
  }, [matriz]);

  async function runLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setResult(null);
    if (!validPlate) {
      setError('Informe uma placa válida com 7 caracteres. Exemplos: ABC1234 ou ABC1D23.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: sourceUrl,
          itemSelector: null,
          fields: SOURCE_FIELDS[source].map(({ key, selector, attribute }) => ({ key, selector, attribute })),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `A consulta falhou (HTTP ${response.status}).`);
      const data = (payload.data ?? payload) as ScrapeResult;
      if (!data || !Array.isArray(data.rows) || !Array.isArray(data.columns)) {
        throw new Error('A resposta da consulta está em formato inesperado.');
      }
      setResult(data);
      const parsed = extrairDadosVeiculo(data, normalizedPlate, source);
      setVehicleData(current => preencherDadosVeiculo(current, { ...parsed, matriz: current.matriz }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível consultar a placa. Verifique a conexão com o serviço de consulta.');
    } finally {
      setLoading(false);
    }
  }

  function updateVehicleField(field: keyof VehicleData, value: string) {
    if (field === 'matriz') setMatriz(value);
    setVehicleData(current => {
      const next = { ...current, [field]: value };
      if (field === 'latitude' || field === 'longitude') next.maps = gerarLinkGoogleMaps(next.latitude, next.longitude);
      return next;
    });
  }

  function resetAll() {
    setPlate('');
    setResult(null);
    setError('');
    setVehicleData(EMPTY_VEHICLE_DATA);
    setMatriz('');
  }

  const displayRows = useMemo(() => {
    if (!result) return [];
    const parsed = extrairDadosVeiculo(result, normalizedPlate, source);
    return result.rows.map(row => ({
      ...row,
      h1: normalizeHeading(row.h1, source),
      marca: parsed.marca ?? row.marca ?? '',
      modelo: parsed.modelo ?? row.modelo ?? '',
      ano: parsed.ano ?? row.ano ?? '',
      cor: parsed.cor ?? row.cor ?? '',
      chassi: parsed.chassi ?? row.chassi ?? '',
    }));
  }, [result, normalizedPlate, source]);

  return (
    <section className="space-y-6" data-testid="page-consulta-alerta">
      <div className="panel-odeen overflow-hidden">
        <div className="flex items-start gap-3 border-b border-border p-5 sm:p-6">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Search size={19} /></div>
          <div>
            <h2 className="text-lg font-bold">Consulta de placa</h2>
            <p className="mt-1 text-sm text-muted-foreground">Consulte os dados públicos disponíveis e use o resultado para montar o alerta de roubo/furto.</p>
          </div>
        </div>
        <form onSubmit={runLookup} className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold">Fonte da consulta</span>
            <select className="input-odeen" value={source} onChange={e => { setSource(e.target.value as VehicleLookupSource); setResult(null); setError(''); }}>
              <option value="keplaca">KePlaca</option>
              <option value="dadosdaplaca">Dados da Placa</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold">Placa do veículo</span>
            <input className="input-odeen uppercase" value={plate} onChange={e => setPlate(e.target.value.toUpperCase())} placeholder="ABC1D23" maxLength={8} autoComplete="off" />
          </label>
          <button type="submit" disabled={!validPlate || loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? <><Loader2 className="size-4 animate-spin" />Consultando...</> : <><Sparkles size={16} />Consultar placa</>}
          </button>
          <div className="lg:col-span-3">
            <p className="text-xs text-muted-foreground">URL preparada: <a className="break-all underline" href={sourceUrl} target="_blank" rel="noreferrer">{sourceUrl}</a></p>
          </div>
          {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive lg:col-span-3"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div>}
        </form>
      </div>

      {result && (
        <section className="panel-odeen overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
            <div className="flex items-center gap-2"><Database size={18} className="text-primary" /><div><h2 className="font-bold">Resultado da consulta</h2><p className="text-xs text-muted-foreground">{result.title} · {result.count} registro(s)</p></div></div>
            <button type="button" onClick={() => downloadCsv({ ...result, rows: displayRows })} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-bold"><ArrowDownToLine size={14} />Exportar CSV</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-xs">
              <thead><tr className="bg-muted">{result.columns.map(col => <th key={col} className="border-b border-border px-4 py-3 font-bold">{col}</th>)}</tr></thead>
              <tbody>{displayRows.slice(0, 50).map((row, index) => <tr key={index} className="border-b border-border/70">{result.columns.map(col => { const value = row[col]; const isUrl = typeof value === 'string' && /^https?:\/\//.test(value); return <td key={col} className="max-w-[420px] px-4 py-3">{isUrl ? <a href={value as string} target="_blank" rel="noreferrer" className="break-all text-primary underline"><ExternalLink className="mr-1 inline size-3" />{value}</a> : String(value ?? '—')}</td>; })}</tr>)}</tbody>
            </table>
          </div>
          {result.warnings.length > 0 && <p className="flex gap-2 border-t border-amber-300 bg-amber-50 p-4 text-xs text-amber-900"><TriangleAlert size={15} className="shrink-0" />{result.warnings.join(' ')}</p>}
          <div className="border-t border-border p-4 text-xs text-muted-foreground">Consultado em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(result.fetchedAt))} · {result.url}</div>
        </section>
      )}

      <div className="panel-odeen overflow-hidden">
        <div className="border-b border-border p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Check size={19} className="text-primary" />Gerador de alerta R/F</h2>
          <p className="mt-1 text-sm text-muted-foreground">Os dados encontrados são preenchidos automaticamente. Confira e ajuste os campos antes de copiar o alerta.</p>
        </div>
        <div className="p-4 sm:p-6">
          <AlertGenerator data={vehicleData} onChange={updateVehicleField} onReset={() => setVehicleData(current => ({ ...EMPTY_VEHICLE_DATA, matriz: current.matriz }))} />
        </div>
      </div>
    </section>
  );
}
