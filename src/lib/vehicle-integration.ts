export type ScrapeResult = {
  url: string;
  title: string;
  fetchedAt: string;
  count: number;
  columns: string[];
  rows: Array<Record<string, string | null>>;
  warnings: string[];
};

export type VehicleLookupSource = 'keplaca' | 'dadosdaplaca';

export type VehicleData = {
  matriz: string;
  placa: string;
  modelo: string;
  chassi: string;
  cor: string;
  corPlaca: string;
  marca: string;
  ano: string;
  latitude: string;
  longitude: string;
  maps: string;
};

export const EMPTY_VEHICLE_DATA: VehicleData = {
  matriz: '',
  placa: '',
  modelo: '',
  chassi: '',
  cor: '',
  corPlaca: '',
  marca: '',
  ano: '',
  latitude: '',
  longitude: '',
  maps: '',
};

const VEHICLE_KEYS = [
  'matriz',
  'placa',
  'modelo',
  'chassi',
  'cor',
  'corPlaca',
  'marca',
  'ano',
  'latitude',
  'longitude',
  'maps',
] as const satisfies readonly (keyof VehicleData)[];

function normalizeValue(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function normalizePlateValue(value: string) {
  return value.replace(/-/g, '').trim().toUpperCase();
}

/**
 * Gera um link oficial do Google Maps sem expor uma chave de API.
 * A URL é criada somente quando as duas coordenadas são válidas.
 */
export function gerarLinkGoogleMaps(
  latitude: string,
  longitude: string,
): string {
  const normalizedLatitude = Number(latitude.trim().replace(',', '.'));
  const normalizedLongitude = Number(longitude.trim().replace(',', '.'));

  if (
    !Number.isFinite(normalizedLatitude) ||
    !Number.isFinite(normalizedLongitude) ||
    normalizedLatitude < -90 ||
    normalizedLatitude > 90 ||
    normalizedLongitude < -180 ||
    normalizedLongitude > 180
  ) {
    return '';
  }

  return `https://www.google.com/maps?q=${normalizedLatitude},${normalizedLongitude}`;
}

export function coordenadasError(latitude: string, longitude: string) {
  if (!latitude.trim() && !longitude.trim()) return '';
  if (!latitude.trim() || !longitude.trim()) {
    return 'Informe latitude e longitude para gerar o link do Maps.';
  }
  if (!gerarLinkGoogleMaps(latitude, longitude)) {
    return 'Latitude deve estar entre -90 e 90 e longitude entre -180 e 180.';
  }
  return '';
}

/**
 * Mantém a função de integração preparada para uma API externa futura.
 * Campos vazios não sobrescrevem o que o usuário já digitou manualmente.
 */
export function preencherDadosVeiculo(
  atual: VehicleData,
  dados: Partial<VehicleData>,
): VehicleData {
  const next = { ...atual };
  for (const key of VEHICLE_KEYS) {
    const value = dados[key];
    if (typeof value === 'string' && value.trim()) {
      next[key] = value.trim();
    }
  }
  return next;
}

function parseTitle(title: string) {
  const match = title.match(/^Placa\s+[^-]+-\s+(.+?)\s+-\s+Ke Placa$/i);
  const vehicleText = normalizeValue(match?.[1]);
  if (!vehicleText) return {};

  const yearMatch = vehicleText.match(/\b(19|20)\d{2}\b/);
  const ano = yearMatch?.[0] ?? '';
  const withoutYear = vehicleText.replace(/\s+(19|20)\d{2}\b/, '').trim();
  const [marca = '', ...modelParts] = withoutYear.split(/\s+/);

  return {
    marca,
    modelo: modelParts.join(' ') || withoutYear,
    ano,
  };
}

function parseColors(detail: string) {
  const vehicleColorMatch = detail.match(
    /\bde\s+cor\s+(.+?)\s+final\b/i,
  );
  const vehicleColor = normalizeValue(vehicleColorMatch?.[1])
    .replace(/[.,]+$/, '')
    .toUpperCase();

  const explicitPlateColorMatch =
    detail.match(
      /\bcor\s+(?:da|de)\s+placa\s*(?::|é|e|de)?\s*([A-Za-zÀ-ÿ-]+)/i,
    ) ??
    detail.match(
      /\bplaca(?:\s+[A-Z0-9-]{3,8})?\s+(?:(?:é|e)\s+)?de\s+cor\s+([A-Za-zÀ-ÿ-]+)/i,
    );

  return {
    cor: vehicleColor,
    corPlaca: normalizeValue(explicitPlateColorMatch?.[1])
      .replace(/[.,]+$/, '')
      .toUpperCase(),
  };
}

function parseChassi(detail: string) {
  const match = detail.match(
    /\bchassi\s*(?:[:\-]\s*)?((?:[A-Za-z0-9](?:\s*[A-Za-z0-9])?){1,8})(?=\s*(?:e\s+com|,|\.|$))/i,
  );

  return normalizeValue(match?.[1]).replace(/\s+/g, '').toUpperCase();
}

/**
 * Converte a resposta real do scraper para o contrato do gerador de alerta.
 * O título da página é usado porque contém marca, modelo e ano no KePlaca.
 */
export function extrairDadosVeiculo(
  result: ScrapeResult,
  plateInput: string,
  source: VehicleLookupSource = 'keplaca',
): Partial<VehicleData> {
  const firstRow = result.rows[0] ?? {};
  if (source === 'dadosdaplaca') {
    return {
      placa: normalizePlateValue(plateInput),
      marca: normalizeValue(firstRow.marca),
      modelo: normalizeValue(firstRow.modelo),
      ano: normalizeValue(firstRow.ano),
      cor: normalizeValue(firstRow.cor).toUpperCase(),
      chassi: normalizeValue(firstRow.chassi)
        .replace(/\*/g, '')
        .toUpperCase(),
    };
  }

  const titleData = parseTitle(result.title);
  const detail = result.rows
    .map((row) => normalizeValue(row.detalhe))
    .find(Boolean) ?? '';
  const colorData = parseColors(detail);
  const heading = normalizeValue(firstRow.h1);
  const plateMatch = heading.match(/^Placa\s+(.+)$/i);

  return {
    placa: normalizePlateValue(plateMatch?.[1] ?? plateInput),
    ...titleData,
    ...colorData,
    chassi: parseChassi(detail),
  };
}

export function gerarTextoAlerta(data: VehicleData) {
  return [
    data.matriz
      ? `ALERTA DE ROUBO/FURTO – ${data.matriz}`
      : 'ALERTA DE ROUBO/FURTO',
    '',
    data.placa && `Placa: ${data.placa}`,
    data.modelo && `Modelo: ${data.modelo}`,
    data.marca && `Marca: ${data.marca}`,
    data.ano && `Ano: ${data.ano}`,
    data.chassi && `Chassi: ${data.chassi}`,
    data.cor && `Cor: ${data.cor}`,
    data.corPlaca && `Cor da placa: ${data.corPlaca}`,
    data.maps && `Localização: ${data.maps}`,
    '',
    'Caso o veículo seja localizado ou haja qualquer informação sobre seu paradeiro, pedimos que entrem em contato conosco imediatamente!',
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}