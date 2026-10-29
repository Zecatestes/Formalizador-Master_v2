import { useMemo, useState } from 'react';
import {
  Check,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Info,
  Link2,
  MapPinned,
  RotateCcw,
} from 'lucide-react';
import {
  coordenadasError,
  gerarTextoAlerta,
  type VehicleData,
} from '../lib/vehicle-integration';

type AlertGeneratorProps = {
  data: VehicleData;
  onChange: (field: keyof VehicleData, value: string) => void;
  onReset: () => void;
};

const vehicleFields: Array<{
  id: keyof VehicleData;
  label: string;
  placeholder: string;
  auto?: boolean;
}> = [
  { id: 'matriz', label: 'Matriz', placeholder: 'Ex.: MATRIZ SP' },
  { id: 'placa', label: 'Placa', placeholder: 'ABC1D23', auto: true },
  { id: 'modelo', label: 'Modelo', placeholder: 'Preenchido pela consulta', auto: true },
  { id: 'marca', label: 'Marca', placeholder: 'Ex.: Volkswagen', auto: true },
  { id: 'ano', label: 'Ano', placeholder: 'Ex.: 1979', auto: true },
  { id: 'chassi', label: 'Chassi', placeholder: 'Opcional' },
  { id: 'cor', label: 'Cor do veículo', placeholder: 'Ex.: Prata', auto: true },
  { id: 'corPlaca', label: 'Cor da placa', placeholder: 'Não informada' },
];

function Field({
  id,
  label,
  placeholder,
  value,
  auto,
  onChange,
}: {
  id: keyof VehicleData;
  label: string;
  placeholder: string;
  value: string;
  auto?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between gap-2 text-xs font-bold">
        {label}
        {auto && value && (
          <span className="font-mono text-[9px] font-normal uppercase tracking-[0.08em] text-emerald-700">
            consulta
          </span>
        )}
      </span>
      <input
        className="h-11 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background)/0.62)] px-3.5 text-sm text-[hsl(var(--foreground))] outline-none transition placeholder:text-[hsl(var(--muted-foreground)/0.65)] focus:border-[hsl(var(--primary))] focus:ring-4 focus:ring-[hsl(var(--primary)/0.1)]"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

export function AlertGenerator({
  data,
  onChange,
  onReset,
}: AlertGeneratorProps) {
  const [copied, setCopied] = useState(false);
  const coordinatesMessage = coordenadasError(data.latitude, data.longitude);
  const alertText = useMemo(() => gerarTextoAlerta(data), [data]);
  const hasVehicleData = Object.entries(data).some(
    ([key, value]) => key !== 'maps' && Boolean(value),
  );

  async function copyAlert() {
    await navigator.clipboard?.writeText(alertText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section
      className="mt-8 animate-reveal overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[0_18px_42px_rgba(22,66,73,0.07)]"
      data-testid="section-alert-generator"
    >
      <div className="flex flex-col gap-4 border-b border-[hsl(var(--border))] px-4 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
            <ClipboardCheck className="size-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-bold tracking-[-0.03em]">
                Gerador de alerta
              </h2>
              <span className="rounded-full bg-[hsl(var(--accent)/0.55)] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-[hsl(var(--accent-foreground))]">
                integrado
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-[hsl(var(--muted-foreground))]">
              O resultado da consulta preenche os dados disponíveis. Confira e
              edite os campos antes de copiar o alerta.
            </p>
          </div>
        </div>
        <button
          className="inline-flex h-9 items-center gap-1.5 self-start rounded-lg px-2 py-1.5 text-xs font-semibold text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
          data-testid="button-reset-alert"
          onClick={onReset}
          type="button"
        >
          <RotateCcw className="size-3.5" /> Limpar alerta
        </button>
      </div>

      <div className="grid gap-6 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)]">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-[hsl(var(--foreground))] font-mono text-[10px] font-bold text-[hsl(var(--background))]">
              1
            </span>
            <h3 className="font-display text-base font-bold tracking-[-0.03em]">
              Dados do veículo
            </h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {vehicleFields.map((field) => (
              <Field
                {...field}
                key={field.id}
                onChange={(value) => onChange(field.id, value)}
                value={data[field.id]}
              />
            ))}
          </div>

          <div className="my-6 h-px bg-[hsl(var(--border))]" />

          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-[hsl(var(--foreground))] font-mono text-[10px] font-bold text-[hsl(var(--background))]">
              2
            </span>
            <h3 className="font-display text-base font-bold tracking-[-0.03em]">
              Localização opcional
            </h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="latitude"
              label="Latitude"
              onChange={(value) => onChange('latitude', value)}
              placeholder="-23.550520"
              value={data.latitude}
            />
            <Field
              id="longitude"
              label="Longitude"
              onChange={(value) => onChange('longitude', value)}
              placeholder="-46.633308"
              value={data.longitude}
            />
          </div>
          <label className="mt-4 block">
            <span className="mb-1.5 flex items-center gap-2 text-xs font-bold">
              Link do Google Maps
              <Link2 className="size-3.5 text-[hsl(var(--primary))]" />
            </span>
            <div className="flex min-h-11 items-center gap-2 rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--muted)/0.4)] px-3.5">
              <input
                className="min-w-0 flex-1 bg-transparent text-xs text-[hsl(var(--foreground))] outline-none"
                id="maps"
                readOnly
                value={data.maps}
              />
              {data.maps && (
                <a
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[hsl(var(--primary))] hover:underline"
                  href={data.maps}
                  rel="noreferrer"
                  target="_blank"
                >
                  Abrir <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          </label>
          {coordinatesMessage ? (
            <p
              className="mt-2 text-xs text-amber-800"
              data-testid="status-coordinates"
            >
              {coordinatesMessage}
            </p>
          ) : (
            <p className="mt-2 text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">
              O link só é criado quando latitude e longitude válidas são
              informadas.
            </p>
          )}
        </div>

        <div className="flex flex-col rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-4">
          <div className="flex items-center gap-2">
            <MapPinned className="size-4 text-[hsl(var(--primary))]" />
            <h3 className="text-sm font-bold">Texto final do alerta</h3>
          </div>
          <textarea
            className="mt-3 min-h-[240px] flex-1 resize-y rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] p-3.5 font-mono text-xs leading-5 text-[hsl(var(--foreground))] outline-none focus:border-[hsl(var(--primary))] focus:ring-4 focus:ring-[hsl(var(--primary)/0.1)]"
            data-testid="textarea-alert-text"
            readOnly
            value={alertText}
          />
          <button
            className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 text-sm font-bold text-[hsl(var(--primary-foreground))] shadow-[0_8px_20px_hsl(var(--primary)/0.2)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            data-testid="button-copy-alert"
            disabled={!hasVehicleData}
            onClick={copyAlert}
            type="button"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? 'Alerta copiado' : 'Copiar alerta'}
          </button>
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/0.6)] p-3">
            <Info className="mt-0.5 size-3.5 shrink-0 text-[hsl(var(--primary))]" />
            <p className="text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">
              O link usa a URL oficial do Google Maps e não exige chave de API
              para esta função.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}