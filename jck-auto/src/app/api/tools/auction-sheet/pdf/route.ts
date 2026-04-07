/**
 * @file route.ts
 * @description Генерация PDF-отчёта по результатам расшифровки аукционного листа.
 * @runs VDS
 * @rule Rate limit НЕ применяется (PDF генерируется из уже полученных данных)
 * @lastModified 2026-04-02
 */

import { NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import path from 'path';
import { CONTACTS } from '@/lib/constants';

export async function POST(request: Request) {
  let data: Record<string, unknown>;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!data || typeof data !== 'object') {
    return NextResponse.json({ error: 'invalid_data' }, { status: 400 });
  }

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const fontDir = path.join(process.cwd(), 'public', 'fonts');
  doc.registerFont('Body', path.join(fontDir, 'Roboto-Regular.ttf'));
  doc.registerFont('BodyBold', path.join(fontDir, 'Roboto-Bold.ttf'));
  const chunks: Buffer[] = [];

  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  // Header
  doc.fontSize(18).font('BodyBold').text('Расшифровка аукционного листа', { align: 'center' });
  doc.fontSize(10).font('Body').text('JCK AUTO — импорт авто из Китая, Кореи, Японии', { align: 'center' });
  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
  doc.moveDown();

  // Auction & Grade
  const grade = data.overallGrade as string | null;
  const interior = data.interiorGrade as string | null;
  doc.fontSize(14).font('BodyBold').text('Аукцион и оценка');
  doc.fontSize(10).font('Body');
  if (data.auctionName) doc.text(`Аукцион: ${data.auctionName}`);
  if (data.lotNumber) doc.text(`Лот: ${data.lotNumber}`);
  if (grade) doc.text(`Общая оценка: ${grade}`);
  if (interior) doc.text(`Салон: ${interior}`);
  if (data.recommendation) { doc.moveDown(0.5); doc.font('Body').text(`${data.recommendation}`).font('Body'); }
  doc.moveDown();

  // Car
  doc.fontSize(14).font('BodyBold').text('Автомобиль');
  doc.fontSize(10).font('Body');
  const fields: [string, unknown][] = [
    ['Марка', data.make], ['Модель', data.model], ['Год', data.year],
    ['Двигатель', data.engineVolume ? `${data.engineVolume} см³` : null],
    ['Тип двигателя', data.engineType], ['КПП', data.transmission],
    ['Пробег', data.mileage ? `${data.mileage} км${data.mileageWarning ? ' ⚠' : ''}` : null],
    ['Цвет', data.color], ['Владение', data.ownership],
  ];
  for (const [label, value] of fields) {
    if (value) doc.text(`${label}: ${value}`);
  }
  doc.moveDown();

  // Damages
  const damages = data.bodyDamages as Array<{ location: string; code: string; description: string; severity: string }> | undefined;
  doc.fontSize(14).font('BodyBold').text('Состояние кузова');
  doc.fontSize(10).font('Body');
  if (damages && damages.length > 0) {
    for (const d of damages) {
      doc.text(`• ${d.location} — ${d.code}: ${d.description} (${d.severity})`);
    }
  } else {
    doc.text('Дефекты не обнаружены');
  }
  doc.moveDown();

  // Equipment
  const equipment = data.equipment as string[] | undefined;
  if (equipment && equipment.length > 0) {
    doc.fontSize(14).font('BodyBold').text('Комплектация');
    doc.fontSize(10).font('Body').text(equipment.join(', '));
    doc.moveDown();
  }

  // Comments
  if (data.expertComments) {
    doc.fontSize(14).font('BodyBold').text('Комментарии эксперта');
    doc.fontSize(10).font('Body').text(data.expertComments as string);
    doc.moveDown();
  }

  // Warnings
  const warnings = data.warnings as string[] | undefined;
  if (warnings && warnings.length > 0) {
    doc.fontSize(14).font('BodyBold').text('Предупреждения');
    doc.fontSize(10).font('Body');
    for (const w of warnings) doc.text(`⚠ ${w}`);
    doc.moveDown();
  }

  // Unrecognized
  const unrecognized = data.unrecognized as string[] | undefined;
  if (unrecognized && unrecognized.length > 0) {
    doc.fontSize(14).font('BodyBold').text('Не распознано');
    doc.fontSize(10).font('Body');
    for (const u of unrecognized) doc.text(`• ${u}`);
    doc.moveDown();
  }

  // Footer
  doc.moveDown(2);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
  doc.moveDown(0.8);
  doc.fontSize(12).font('BodyBold').fillColor('#1e3a8a');
  doc.text('jckauto.ru', { align: 'center', link: 'https://jckauto.ru', underline: true });
  doc.moveDown(0.4);
  doc.fontSize(9).font('Body').fillColor('#666666');
  doc.text(`${CONTACTS.company} | ${CONTACTS.phone} | ${CONTACTS.telegramHandle}`, { align: 'center' });
  doc.text('Импорт автомобилей из Китая, Кореи и Японии', { align: 'center' });
  doc.fillColor('black');

  doc.end();
  const pdfBuffer = await done;

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="auction-sheet-report.pdf"',
    },
  });
}
