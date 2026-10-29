import { jsPDF } from 'jspdf';
import { buildAutomaticText, formatDate, formatTime, type EvidenceImage, type ReportForm } from './reportTypes';

const logoUrl = `${import.meta.env.BASE_URL}logo-odeen.png`;
const coverLogoUrl = `${import.meta.env.BASE_URL}logo-odeen-capa.jpeg`;
const watermarkUrl = `${import.meta.env.BASE_URL}marca-dagua-odeen.jpeg`;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const HEADER_BOTTOM = 43;
const CONTENT_START_Y = 51;
const CONTENT_END_Y = 250;
const FOOTER_TOP = 258;
const NAVY: [number, number, number] = [17, 17, 17];
const GREEN: [number, number, number] = [23, 59, 50];
const GREEN_LIGHT: [number, number, number] = [31, 74, 61];
const DARK_GRAY: [number, number, number] = [51, 51, 51];
const MID_GRAY: [number, number, number] = [102, 102, 102];
const LIGHT_GRAY: [number, number, number] = [229, 229, 229];

type Color = [number, number, number];

function setText(doc: jsPDF, color: Color, size: number, font = 'helvetica', style = 'normal') {
  doc.setTextColor(...color);
  doc.setFont(font, style);
  doc.setFontSize(size);
}

async function loadImage(url: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function loadLogo() {
  return loadImage(logoUrl);
}

function addImageContain(doc: jsPDF, dataUrl: string, x: number, y: number, maxWidth: number, maxHeight: number, format: 'PNG' | 'JPEG') {
  const properties = doc.getImageProperties(dataUrl);
  const ratio = Math.min(maxWidth / properties.width, maxHeight / properties.height);
  const width = properties.width * ratio;
  const height = properties.height * ratio;
  doc.addImage(dataUrl, format, x + (maxWidth - width) / 2, y + (maxHeight - height) / 2, width, height, undefined, 'FAST');
}

function drawWatermark(doc: jsPDF, watermarkDataUrl: string) {
  addImageContain(doc, watermarkDataUrl, MARGIN + 5, 78, CONTENT_WIDTH - 10, 142, 'JPEG');
}

function drawHeader(doc: jsPDF, form: ReportForm, logoDataUrl: string) {
  doc.addImage(logoDataUrl, 'PNG', MARGIN, 6, CONTENT_WIDTH, 23.5, undefined, 'FAST');
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.55);
  doc.line(MARGIN, HEADER_BOTTOM, PAGE_WIDTH - MARGIN, HEADER_BOTTOM);
  setText(doc, GREEN, 7.5, 'helvetica', 'bold');
  doc.text('RELATÓRIO DE RECUPERAÇÃO', MARGIN, 39);
  setText(doc, MID_GRAY, 7, 'helvetica', 'normal');
  doc.text(`Sinistro ${form.sinistro || '—'}`, PAGE_WIDTH - MARGIN, 39, { align: 'right' });
}

function drawFooter(doc: jsPDF, page: number, total: number) {
  doc.setDrawColor(...LIGHT_GRAY);
  doc.setLineWidth(0.35);
  doc.line(MARGIN, FOOTER_TOP, PAGE_WIDTH - MARGIN, FOOTER_TOP);
  setText(doc, GREEN, 7, 'helvetica', 'bold');
  doc.text('Odeen & Co.  ·  55.520.395/0001-45', MARGIN, FOOTER_TOP + 9);
  setText(doc, DARK_GRAY, 6.2, 'helvetica', 'bold');
  doc.text('INFORMAÇÕES BÁSICAS SOBRE PROTEÇÃO DE DADOS.', MARGIN, FOOTER_TOP + 16);
  setText(doc, MID_GRAY, 5.8, 'helvetica', 'normal');
  const privacy = 'A Odeen respeita e cumpre as exigências previstas na Lei nº 13.709/2018 que dispõe sobre a proteção de dados pessoais zelando pelo correto tratamento dos dados pessoais. Responsável pelo tratamento: Odeen; Finalidade: Autorização de imagem';
  const privacyLines = doc.splitTextToSize(privacy, 125) as string[];
  doc.text(privacyLines.slice(0, 3), MARGIN, FOOTER_TOP + 22, { lineHeightFactor: 1.2 });
  setText(doc, GREEN, 7, 'helvetica', 'bold');
  doc.text('CLASSIFICAÇÃO CONFIDENCIAL', PAGE_WIDTH - MARGIN, FOOTER_TOP + 16, { align: 'right' });
  setText(doc, DARK_GRAY, 7, 'helvetica', 'bold');
  doc.text(`Página ${page} de ${total}`, PAGE_WIDTH - MARGIN, FOOTER_TOP + 29, { align: 'right' });
}

class PdfLayout {
  y = CONTENT_START_Y;

  constructor(
    private readonly doc: jsPDF,
    private readonly form: ReportForm,
    private readonly logoDataUrl: string,
    private readonly watermarkDataUrl: string,
  ) {}

  newPage() {
    this.doc.addPage();
    drawHeader(this.doc, this.form, this.logoDataUrl);
    drawWatermark(this.doc, this.watermarkDataUrl);
    this.y = CONTENT_START_Y;
  }

  ensure(height: number) {
    if (this.y + height > CONTENT_END_Y) this.newPage();
  }

  title(text: string) {
    this.ensure(17);
    setText(this.doc, GREEN, 11, 'helvetica', 'bold');
    this.doc.text(text, MARGIN, this.y);
    this.doc.setDrawColor(...GREEN_LIGHT);
    this.doc.setLineWidth(0.45);
    this.doc.line(MARGIN, this.y + 3.5, PAGE_WIDTH - MARGIN, this.y + 3.5);
    this.y += 15;
  }

  subtitle(text: string) {
    this.ensure(13);
    const page = this.doc.getNumberOfPages();
    setText(this.doc, DARK_GRAY, 8.5, 'helvetica', 'bold');
    this.doc.text(text, MARGIN, this.y);
    this.y += 11;
    return page;
  }

  textBlock(text: string, options: { size?: number; lineHeight?: number; color?: Color; spaceBefore?: number; spaceAfter?: number } = {}) {
    const size = options.size ?? 9.5;
    const lineHeight = options.lineHeight ?? 5.2;
    const color = options.color ?? DARK_GRAY;
    const spaceBefore = options.spaceBefore ?? 3;
    const spaceAfter = options.spaceAfter ?? 8;
    setText(this.doc, color, size);
    const lines = docLines(this.doc, text, CONTENT_WIDTH);
    let offset = 0;

    if (!lines.length) return;
    if (this.y + spaceBefore + lineHeight > CONTENT_END_Y) this.newPage();
    this.y += spaceBefore;

    while (offset < lines.length) {
      const availableLines = Math.floor((CONTENT_END_Y - this.y) / lineHeight);
      if (availableLines <= 0) {
        this.newPage();
        continue;
      }
      const count = Math.min(availableLines, lines.length - offset);
      drawLines(this.doc, lines.slice(offset, offset + count), MARGIN, this.y, lineHeight);
      this.y += count * lineHeight;
      offset += count;
      if (offset < lines.length) this.newPage();
    }
    this.y += spaceAfter;
  }

  paragraph(text: string) {
    this.textBlock(text, { size: 9.5, lineHeight: 5.2, spaceBefore: 3, spaceAfter: 9 });
  }

  field(label: string, value: string) {
    const valueSize = 8.8;
    const valueLineHeight = 5;
    const labelGap = 5.5;
    const bottomGap = 5;
    setText(this.doc, DARK_GRAY, valueSize);
    const lines = docLines(this.doc, value || '—', CONTENT_WIDTH);
    const needed = labelGap + lines.length * valueLineHeight + bottomGap;
    this.ensure(needed);
    setText(this.doc, MID_GRAY, 6.8, 'helvetica', 'bold');
    this.doc.text(label.toUpperCase(), MARGIN, this.y);
    const valueY = this.y + labelGap;
    setText(this.doc, DARK_GRAY, valueSize);
    drawLines(this.doc, lines, MARGIN, valueY, valueLineHeight);
    this.doc.setDrawColor(...LIGHT_GRAY);
    this.doc.setLineWidth(0.25);
    this.doc.line(MARGIN, valueY + lines.length * valueLineHeight + 1.5, PAGE_WIDTH - MARGIN, valueY + lines.length * valueLineHeight + 1.5);
    this.y = valueY + lines.length * valueLineHeight + bottomGap;
  }
}

function docLines(doc: jsPDF, text: string, width: number) {
  return doc.splitTextToSize(text || '—', width) as string[];
}

function drawLines(doc: jsPDF, lines: string[], x: number, y: number, lineHeight: number) {
  lines.forEach((line, index) => doc.text(line, x, y + index * lineHeight));
}

function addManualBlock(layout: PdfLayout, text: string) {
  if (text.trim()) layout.paragraph(text);
}

function drawCover(doc: jsPDF, form: ReportForm, logoDataUrl: string, coverLogoDataUrl: string) {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_WIDTH, 4, 'F');
  drawHeader(doc, form, logoDataUrl);
  addImageContain(doc, coverLogoDataUrl, MARGIN + 12, 49, 125, 39, 'JPEG');
  doc.setFillColor(...GREEN);
  doc.rect(MARGIN, 93, 5, 63, 'F');
  setText(doc, NAVY, 23, 'helvetica', 'bold');
  doc.text('RELATÓRIO DE', MARGIN + 12, 109);
  doc.text('RECUPERAÇÃO DE ATIVO', MARGIN + 12, 122);
  setText(doc, GREEN, 9, 'helvetica', 'bold');
  doc.text('CONFIDENCIAL', MARGIN + 12, 138);
  setText(doc, DARK_GRAY, 10, 'helvetica', 'bold');
  doc.text(`APÓLICE ${form.apolice}`, MARGIN + 12, 151);
  setText(doc, MID_GRAY, 8, 'helvetica', 'bold');
  doc.text('CLASSIFICAÇÃO CONFIDENCIAL', MARGIN + 12, 162);
}

function drawContents(doc: jsPDF, form: ReportForm, entries: Array<[string, string, number]>, logoDataUrl: string, watermarkDataUrl: string) {
  doc.setPage(2);
  drawHeader(doc, form, logoDataUrl);
  drawWatermark(doc, watermarkDataUrl);
  let y = CONTENT_START_Y;
  setText(doc, NAVY, 19, 'helvetica', 'bold');
  doc.text('Sumário', MARGIN, y);
  y += 17;
  entries.forEach(([number, title, page]) => {
    setText(doc, GREEN, 8.5, 'helvetica', 'bold');
    doc.text(number, MARGIN, y);
    setText(doc, DARK_GRAY, 8.5);
    doc.text(title, MARGIN + 13, y);
    doc.setDrawColor(...LIGHT_GRAY);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(MARGIN + 75, y - 1, PAGE_WIDTH - MARGIN - 9, y - 1);
    doc.setLineDashPattern([], 0);
    setText(doc, NAVY, 8.5, 'helvetica', 'bold');
    doc.text(String(page), PAGE_WIDTH - MARGIN, y, { align: 'right' });
    y += 9;
  });
}

async function addPhotoPage(doc: jsPDF, form: ReportForm, logoDataUrl: string, watermarkDataUrl: string, image: EvidenceImage, index: number) {
  doc.addPage();
  drawHeader(doc, form, logoDataUrl);
  drawWatermark(doc, watermarkDataUrl);
  let y = CONTENT_START_Y;
  setText(doc, GREEN, 11, 'helvetica', 'bold');
  doc.text('2. IMAGENS DA RECUPERAÇÃO', MARGIN, y);
  doc.setDrawColor(...GREEN_LIGHT);
  doc.setLineWidth(0.45);
  doc.line(MARGIN, y + 3.5, PAGE_WIDTH - MARGIN, y + 3.5);
  y += 13;
  setText(doc, DARK_GRAY, 8.5, 'helvetica', 'bold');
  doc.text(`2.${index} LOCALIZAÇÃO E VISUAL DO VEÍCULO`, MARGIN, y);
  y += 8;

  const dataUrl = await fileToDataUrl(image.file);
  const properties = doc.getImageProperties(dataUrl);
  const maxWidth = CONTENT_WIDTH;
  const maxHeight = CONTENT_END_Y - y - 12;
  const ratio = Math.min(maxWidth / properties.width, maxHeight / properties.height);
  const width = properties.width * ratio;
  const height = properties.height * ratio;
  const x = MARGIN + (maxWidth - width) / 2;
  const boxY = y;
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(...LIGHT_GRAY);
  doc.rect(MARGIN, boxY, CONTENT_WIDTH, maxHeight, 'FD');
  doc.addImage(dataUrl, image.file.type.includes('png') ? 'PNG' : 'JPEG', x, boxY + (maxHeight - height) / 2, width, height, undefined, 'FAST');
  setText(doc, GREEN, 7.5, 'helvetica', 'bold');
  doc.text('CLASSIFICAÇÃO CONFIDENCIAL', PAGE_WIDTH / 2, CONTENT_END_Y + 3, { align: 'center' });
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function createReportPdf(form: ReportForm, images: EvidenceImage[]) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const logoDataUrl = await loadLogo();
  const coverLogoDataUrl = await loadImage(coverLogoUrl);
  const watermarkDataUrl = await loadImage(watermarkUrl);

  drawCover(doc, form, logoDataUrl, coverLogoDataUrl);
  doc.addPage();
  drawHeader(doc, form, logoDataUrl);

  const reportStartPage = 3;
  const layout = new PdfLayout(doc, form, logoDataUrl, watermarkDataUrl);
  layout.newPage();
  layout.title('1. RELATO DE INVESTIGAÇÃO');
  layout.field('Data', formatDate(form.data));
  layout.field('Hora', formatTime(form.hora));
  layout.field('Placa', form.placa);
  layout.field('Produto', form.produto);
  layout.field('Auxílio do rastreador', form.rastreador === 'SIM' ? 'SIM' : 'NÃO');
  layout.field('Local da recuperação', form.localRec);
  layout.y += 3;

  layout.paragraph(buildAutomaticText(form));

  const reportEntries: Array<[string, string, number]> = [
    ['1.', 'RELATO DE INVESTIGAÇÃO', reportStartPage],
  ];

  if (form.formalizacaoManual.trim()) {
    const sectionPage = layout.subtitle('FORMALIZAÇÃO / COMPLEMENTO DA OCORRÊNCIA');
    reportEntries.push(['1.1', 'FORMALIZAÇÃO / COMPLEMENTO DA OCORRÊNCIA', sectionPage]);
    addManualBlock(layout, form.formalizacaoManual);
  }

  if (form.apreendido === 'SIM') {
    const sectionPage = layout.subtitle('DADOS DA RECUPERAÇÃO');
    reportEntries.push(['1.2', 'DADOS DA RECUPERAÇÃO', sectionPage]);
    layout.field('Pátio de Apreensão', form.delegacia);
    layout.field('Endereço', form.endereco);
    layout.field('Telefone', form.telefone);
    layout.field(`${form.documento} nº`, form.numeroDoc);
    if (form.roOrigem.trim()) layout.field('RO de Origem', form.roOrigem);
    layout.field('Sinistro', form.sinistro);
    layout.field('Apólice', form.apolice);
  } else {
    const sectionPage = layout.subtitle('DADOS DA LIBERAÇÃO');
    reportEntries.push(['1.2', 'DADOS DA LIBERAÇÃO', sectionPage]);
    layout.field('Responsável', form.nome);
    layout.field('CPF', form.cpf);
    layout.field(`${form.documentoLiberacao} nº`, form.numeroDocLiberacao);
    layout.field('Sinistro', form.sinistro);
    layout.field('Apólice', form.apolice);
  }

  if (form.conclusao.trim()) {
    const sectionPage = layout.subtitle('CONCLUSÃO / ENCERRAMENTO');
    reportEntries.push(['1.3', 'CONCLUSÃO / ENCERRAMENTO', sectionPage]);
    addManualBlock(layout, form.conclusao);
  }

  const photoPages: number[] = [];
  if (images.length) {
    for (let index = 0; index < images.length; index += 1) {
      const page = doc.getNumberOfPages() + 1;
      photoPages.push(page);
      await addPhotoPage(doc, form, logoDataUrl, watermarkDataUrl, images[index], index + 1);
    }
  }

  const entries = [...reportEntries];
  if (images.length) {
    entries.push(['2.', 'IMAGENS DA RECUPERAÇÃO', photoPages[0]]);
    photoPages.forEach((page, index) => entries.push([`2.${index + 1}`, 'LOCALIZAÇÃO E VISUAL DO VEÍCULO', page]));
  }
  drawContents(doc, form, entries, logoDataUrl, watermarkDataUrl);

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    drawFooter(doc, page, totalPages);
  }

  const safePlate = form.placa.replace(/[^A-Z0-9]/gi, '').toUpperCase() || 'SEM_PLACA';
  doc.save(`RELATORIO_HDI_${safePlate}.pdf`);
}