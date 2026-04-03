/**
 * @file route.ts
 * @description Генерация PDF-отчёта по данным авто с Encar.
 * @runs VDS
 * @rule Rate limit НЕ применяется (PDF из уже полученных данных)
 * @lastModified 2026-04-03
 */

import PDFDocument from 'pdfkit';
import { CONTACTS } from '@/lib/constants';

export async function POST(request: Request) {
  let body: { data?: Record<string, unknown>; costBreakdown?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  const d = body.data;
  if (!d) return new Response('missing data', { status: 400 });

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => { doc.on('end', () => resolve(Buffer.concat(chunks))); });

  // Header
  doc.fontSize(18).font('Helvetica-Bold').text('Анализ автомобиля с Encar.com', { align: 'center' });
  doc.fontSize(10).font('Helvetica').text('JCK AUTO — импорт авто из Китая, Кореи, Японии', { align: 'center' });
  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
  doc.moveDown();

  // Car
  doc.fontSize(14).font('Helvetica-Bold').text('Автомобиль');
  doc.fontSize(10).font('Helvetica');
  const fields: [string, unknown][] = [
    ['Марка', d.make], ['Модель', d.model], ['Комплектация', d.grade], ['Год', d.year],
    ['Пробег', d.mileage ? `${Number(d.mileage).toLocaleString('ru-RU')} км` : null],
    ['Двигатель', d.displacement ? `${d.displacement} см³` : null],
    ['Топливо', d.fuelType], ['КПП', d.transmission], ['Кузов', d.bodyType],
    ['Цвет', d.color], ['VIN', d.vin], ['Регион', d.region],
  ];
  for (const [label, value] of fields) { if (value) doc.text(`${label}: ${value}`); }
  doc.moveDown();

  // Condition
  const accidentFree = d.accidentFree as boolean | undefined;
  if (d.inspectionSummary || accidentFree !== undefined) {
    doc.fontSize(14).font('Helvetica-Bold').text('Состояние');
    doc.fontSize(10).font('Helvetica');
    if (accidentFree !== undefined) doc.text(accidentFree ? 'ДТП: не зафиксировано' : 'ДТП: имеются');
    if (d.inspectionSummary) doc.text(`${d.inspectionSummary}`);
    doc.moveDown();
  }

  // Price
  doc.fontSize(14).font('Helvetica-Bold').text('Цена');
  doc.fontSize(10).font('Helvetica');
  const priceKRW = d.priceKRW as number | undefined;
  if (priceKRW) doc.text(`Цена на Encar: ${priceKRW.toLocaleString('ru-RU')} ₩`);

  const cb = body.costBreakdown as { totalRub?: number; breakdown?: Array<{ label: string; value: number; details?: string }>; currencyRate?: { date?: string; rate?: number } } | undefined;
  if (cb?.breakdown) {
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('Расчёт стоимости в РФ:');
    doc.font('Helvetica');
    for (const item of cb.breakdown) {
      doc.text(`  ${item.label}: ${item.value.toLocaleString('ru-RU')} ₽${item.details ? ` (${item.details})` : ''}`);
    }
    if (cb.totalRub) {
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').text(`  ИТОГО: ${cb.totalRub.toLocaleString('ru-RU')} ₽`);
    }
    if (cb.currencyRate?.date) {
      doc.font('Helvetica').text(`  Курс ЦБ на ${cb.currencyRate.date}`);
    }
  }
  doc.moveDown();

  // Source
  if (d.sourceUrl) {
    doc.fontSize(10).font('Helvetica').text(`Источник: ${d.sourceUrl}`);
    doc.moveDown();
  }

  // Footer
  doc.moveDown(2);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
  doc.moveDown(0.5);
  doc.fontSize(9).font('Helvetica').fillColor('#666666');
  doc.text(`${CONTACTS.company} | ${CONTACTS.phone} | ${CONTACTS.telegramHandle}`, { align: 'center' });
  doc.text('Импорт автомобилей из Китая, Кореи и Японии', { align: 'center' });

  doc.end();
  const pdfBuffer = await done;

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="encar-report.pdf"`,
    },
  });
}
