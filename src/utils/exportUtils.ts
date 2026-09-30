import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

/**
 * Exports JSON array data to an Excel file (.xlsx)
 */
export function exportToExcel(data: Record<string, any>[], filename: string = 'exportacao-almoxplus') {
  if (!data || data.length === 0) {
    alert('Não há dados para exportar.');
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'AlmoxPlus');

  // Auto-fit column widths
  const maxCols = Object.keys(data[0]).length;
  const colWidths = Object.keys(data[0]).map(key => ({
    wch: Math.max(key.length, ...data.map(row => String(row[key] || '').length)) + 3
  }));
  worksheet['!cols'] = colWidths;

  XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

/**
 * Generates an executive PDF document with Almox Plus header and professional table layout
 */
export function exportToPDF(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string = 'relatorio-almoxplus',
  subTitle?: string
) {
  if (!headers || headers.length === 0) {
    alert('Não há colunas para gerar o relatório em PDF.');
    return;
  }

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const leftMargin = 14;
  const rightMargin = 14;
  const tableWidth = pageWidth - leftMargin - rightMargin;

  // Header Banner
  doc.setFillColor(15, 23, 42); // Navy Blue
  doc.rect(0, 0, pageWidth, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('ALMOX PLUS - ERP EMPRESARIAL', leftMargin, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth - rightMargin, 13, { align: 'right' });

  // Title and Subtitle
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), leftMargin, 32);

  if (subTitle) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(subTitle, leftMargin, 38);
  }

  let startY = subTitle ? 44 : 38;

  // Calculate dynamic proportional column widths based on content lengths
  const colCount = headers.length;
  doc.setFontSize(8.5);

  // Compute character weight per column
  const rawWeights: number[] = headers.map((header, colIdx) => {
    const headerLen = header.length;
    let maxContentLen = headerLen;
    // Check first 50 rows for max content length
    const sampleRows = rows.slice(0, 50);
    for (const row of sampleRows) {
      const cellText = String(row[colIdx] ?? '');
      if (cellText.length > maxContentLen) {
        maxContentLen = cellText.length;
      }
    }
    // Base weight between 15 and 45 characters
    return Math.max(12, Math.min(maxContentLen, 40));
  });

  const totalWeight = rawWeights.reduce((acc, w) => acc + w, 0);
  const colWidths: number[] = rawWeights.map(w => Math.max(18, (w / totalWeight) * tableWidth));

  // Re-scale colWidths to exactly sum to tableWidth
  const calculatedTotal = colWidths.reduce((acc, w) => acc + w, 0);
  const scaleRatio = tableWidth / calculatedTotal;
  for (let i = 0; i < colWidths.length; i++) {
    colWidths[i] = colWidths[i] * scaleRatio;
  }

  // Precompute X positions
  const colPositions: number[] = [];
  let currentX = leftMargin;
  for (let i = 0; i < colWidths.length; i++) {
    colPositions.push(currentX);
    currentX += colWidths[i];
  }

  // Helper to fit text strictly inside a column width
  const fitText = (text: string, maxWidth: number, isBold: boolean = false): string => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    if (doc.getTextWidth(text) <= maxWidth) {
      return text;
    }
    let trimmed = text;
    while (trimmed.length > 0 && doc.getTextWidth(trimmed + '...') > maxWidth) {
      trimmed = trimmed.slice(0, -1);
    }
    return trimmed.length > 0 ? trimmed + '...' : '';
  };

  // Table header background
  doc.setFillColor(241, 245, 249);
  doc.rect(leftMargin, startY, tableWidth, 7.5, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(leftMargin, startY, tableWidth, 7.5, 'S');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);

  headers.forEach((header, index) => {
    const colX = colPositions[index];
    const colW = colWidths[index];
    const safeText = fitText(header, colW - 3, true);
    doc.text(safeText, colX + 2, startY + 5);
  });

  startY += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);

  const rowHeight = 6.5;

  rows.forEach((row, rowIndex) => {
    if (startY + rowHeight > pageHeight - 16) {
      doc.addPage();
      startY = 18;

      // Repeat header on new page
      doc.setFillColor(241, 245, 249);
      doc.rect(leftMargin, startY, tableWidth, 7.5, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(leftMargin, startY, tableWidth, 7.5, 'S');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);

      headers.forEach((header, index) => {
        const colX = colPositions[index];
        const colW = colWidths[index];
        const safeText = fitText(header, colW - 3, true);
        doc.text(safeText, colX + 2, startY + 5);
      });

      startY += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
    }

    if (rowIndex % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(leftMargin, startY - 0.5, tableWidth, rowHeight, 'F');
    }

    // Light bottom border for row
    doc.setDrawColor(241, 245, 249);
    doc.line(leftMargin, startY + rowHeight - 0.5, leftMargin + tableWidth, startY + rowHeight - 0.5);

    row.forEach((cell, cellIndex) => {
      if (cellIndex >= colCount) return;
      const colX = colPositions[cellIndex];
      const colW = colWidths[cellIndex];
      const cellText = String(cell ?? '');
      const safeText = fitText(cellText, colW - 3, false);
      doc.text(safeText, colX + 2, startY + 4.2);
    });

    startY += rowHeight;
  });

  // Footer on all pages
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Página ${i} de ${pageCount} — Almox Plus ERP Empresarial (Documento Oficial)`,
      pageWidth / 2,
      pageHeight - 7,
      { align: 'center' }
    );
  }

  doc.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
}

/**
 * Triggers clean browser print dialog for an HTML element
 */
export function printPage() {
  window.print();
}

/**
 * Generates an executive Blind Inventory Count Sheet (Folha de Contagem Cega)
 * specifically designed for physical warehouse stocktaking without system quantities.
 */
export function exportInventoryCountSheetPDF(
  audit: {
    code: string;
    branch: string;
    title: string;
    startedAt: string;
    auditorUser?: string;
    createdBy?: string;
    items: Array<{
      productId: string;
      productCode: string;
      productName: string;
      unit?: string;
    }>;
  },
  productsList?: Array<{ id: string; locationSlot?: string; unit?: string; category?: string }>
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const leftMargin = 12;
  const rightMargin = 12;
  const tableWidth = pageWidth - leftMargin - rightMargin;

  // Map product details like shelf/location
  const productLocations: Record<string, string> = {};
  const productUnits: Record<string, string> = {};
  if (productsList) {
    productsList.forEach(p => {
      if (p.locationSlot) productLocations[p.id] = p.locationSlot;
      if (p.unit) productUnits[p.id] = p.unit;
    });
  }

  // Header Banner
  doc.setFillColor(15, 23, 42); // Navy Blue 900
  doc.rect(0, 0, pageWidth, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('ALMOX PLUS - ERP EMPRESARIAL', leftMargin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Emissão: ${new Date().toLocaleString('pt-BR')}`, pageWidth - rightMargin, 12, { align: 'right' });

  // Document Title
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text('FOLHA DE CONTAGEM FÍSICA DE ESTOQUE (CONTAGEM CEGA)', leftMargin, 30);

  // Subtitle / Campaign metadata block
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.rect(leftMargin, 33, tableWidth, 14, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text(`Código Auditoria:`, leftMargin + 3, 38);
  doc.setFont('helvetica', 'normal');
  doc.text(audit.code, leftMargin + 30, 38);

  doc.setFont('helvetica', 'bold');
  doc.text(`Unidade / Almoxarifado:`, leftMargin + 65, 38);
  doc.setFont('helvetica', 'normal');
  doc.text(audit.branch, leftMargin + 98, 38);

  doc.setFont('helvetica', 'bold');
  doc.text(`Campanha:`, leftMargin + 120, 38);
  doc.setFont('helvetica', 'normal');
  doc.text(audit.title || 'Inventário Periódico Geral', leftMargin + 140, 38);

  doc.setFont('helvetica', 'bold');
  doc.text(`Responsável Abertura:`, leftMargin + 3, 44);
  doc.setFont('helvetica', 'normal');
  doc.text(audit.createdBy || audit.auditorUser || 'Administrador', leftMargin + 35, 44);

  doc.setFont('helvetica', 'bold');
  doc.text(`Inventariante de Campo:`, leftMargin + 65, 44);
  doc.setFont('helvetica', 'normal');
  doc.text('_____________________________', leftMargin + 102, 44);

  doc.setFont('helvetica', 'bold');
  doc.text(`Data da Contagem:`, leftMargin + 160, 44);
  doc.setFont('helvetica', 'normal');
  doc.text('____ / ____ / ________', leftMargin + 190, 44);

  // Table Columns Definition
  // 1: Item (12mm), 2: SKU (28mm), 3: Descrição (75mm), 4: UN (12mm), 5: Localização (28mm), 6: 1ª Contagem (32mm), 7: 2ª Contagem (32mm), 8: Visto/Obs (tableWidth - remainder)
  const colW = {
    item: 10,
    sku: 26,
    desc: 75,
    un: 12,
    loc: 28,
    count1: 32,
    count2: 32,
    obs: tableWidth - (10 + 26 + 75 + 12 + 28 + 32 + 32) // ~58mm
  };

  const headers = [
    { text: 'Nº', w: colW.item, align: 'center' },
    { text: 'SKU / Código', w: colW.sku, align: 'left' },
    { text: 'Descrição do Material / Produto', w: colW.desc, align: 'left' },
    { text: 'UN', w: colW.un, align: 'center' },
    { text: 'Endereço / Prateleira', w: colW.loc, align: 'left' },
    { text: '1ª Contagem Física', w: colW.count1, align: 'center' },
    { text: '2ª Contagem (Reconf.)', w: colW.count2, align: 'center' },
    { text: 'Lote / Validade / Obs.', w: colW.obs, align: 'left' }
  ];

  let startY = 51;

  const renderTableHeader = (yPos: number) => {
    doc.setFillColor(226, 232, 240); // slate-200
    doc.rect(leftMargin, yPos, tableWidth, 7, 'F');
    doc.setDrawColor(148, 163, 184);
    doc.rect(leftMargin, yPos, tableWidth, 7, 'S');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);

    let curX = leftMargin;
    headers.forEach(h => {
      if (h.align === 'center') {
        doc.text(h.text, curX + (h.w / 2), yPos + 4.8, { align: 'center' });
      } else {
        doc.text(h.text, curX + 2, yPos + 4.8);
      }
      curX += h.w;
    });
  };

  renderTableHeader(startY);
  startY += 7;

  const rowHeight = 7.5; // Roomy height for physical manual handwriting

  audit.items.forEach((item, index) => {
    // Check if new page is needed
    if (startY + rowHeight > pageHeight - 32) {
      doc.addPage();
      startY = 16;
      renderTableHeader(startY);
      startY += 7;
    }

    // Row alternating background
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(leftMargin, startY, tableWidth, rowHeight, 'F');
    }

    // Draw cell borders / guides
    doc.setDrawColor(203, 213, 225);
    doc.rect(leftMargin, startY, tableWidth, rowHeight, 'S');

    let curX = leftMargin;

    // 1. Item number
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(String(index + 1).padStart(2, '0'), curX + (colW.item / 2), startY + 4.8, { align: 'center' });
    curX += colW.item;
    doc.line(curX, startY, curX, startY + rowHeight);

    // 2. SKU
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(item.productCode, curX + 2, startY + 4.8);
    curX += colW.sku;
    doc.line(curX, startY, curX, startY + rowHeight);

    // 3. Description
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    let descText = item.productName;
    if (doc.getTextWidth(descText) > colW.desc - 4) {
      while (descText.length > 0 && doc.getTextWidth(descText + '...') > colW.desc - 4) {
        descText = descText.slice(0, -1);
      }
      descText = descText + '...';
    }
    doc.text(descText, curX + 2, startY + 4.8);
    curX += colW.desc;
    doc.line(curX, startY, curX, startY + rowHeight);

    // 4. UN
    const un = item.unit || productUnits[item.productId] || 'UN';
    doc.text(un, curX + (colW.un / 2), startY + 4.8, { align: 'center' });
    curX += colW.un;
    doc.line(curX, startY, curX, startY + rowHeight);

    // 5. Localização
    const loc = productLocations[item.productId] || 'ALMOX-GERAL';
    doc.setTextColor(100, 116, 139);
    doc.text(loc, curX + 2, startY + 4.8);
    curX += colW.loc;
    doc.line(curX, startY, curX, startY + rowHeight);

    // 6. 1ª Contagem Box (Blank for pen writing)
    doc.setFillColor(255, 255, 255);
    doc.rect(curX + 2, startY + 1.2, colW.count1 - 4, rowHeight - 2.4, 'FD');
    curX += colW.count1;
    doc.line(curX, startY, curX, startY + rowHeight);

    // 7. 2ª Contagem Box (Blank for recheck)
    doc.setFillColor(255, 255, 255);
    doc.rect(curX + 2, startY + 1.2, colW.count2 - 4, rowHeight - 2.4, 'FD');
    curX += colW.count2;
    doc.line(curX, startY, curX, startY + rowHeight);

    // 8. Obs / Lote
    // Empty area for write
    startY += rowHeight;
  });

  // Check if signatures fit on current page, if not add a page
  if (startY + 26 > pageHeight - 12) {
    doc.addPage();
    startY = 20;
  } else {
    startY += 6;
  }

  // Signature Block
  const sigBoxW = (tableWidth - 20) / 2;
  
  // Signature 1: Inventariante
  doc.setDrawColor(148, 163, 184);
  doc.line(leftMargin + 10, startY + 12, leftMargin + 10 + sigBoxW, startY + 12);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Assinatura do Inventariante / Conferente', leftMargin + 10 + (sigBoxW / 2), startY + 16, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Declaro que a contagem física acima foi realizada integralmente em campo.', leftMargin + 10 + (sigBoxW / 2), startY + 20, { align: 'center' });

  // Signature 2: Supervisor Almoxarifado
  const sig2X = leftMargin + 10 + sigBoxW + 20;
  doc.line(sig2X, startY + 12, sig2X + sigBoxW, startY + 12);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Visto do Supervisor / Auditor de Estoque', sig2X + (sigBoxW / 2), startY + 16, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Aprovado para reconciliação e ajuste contábil/fiscal no ERP.', sig2X + (sigBoxW / 2), startY + 20, { align: 'center' });

  // Footers on all pages
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Folha de Contagem Cega de Inventário • ${audit.code} • Página ${i} de ${pageCount} — Almox Plus ERP`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  doc.save(`folha-contagem-cega-${audit.code.toLowerCase()}_${audit.branch}.pdf`);
}
