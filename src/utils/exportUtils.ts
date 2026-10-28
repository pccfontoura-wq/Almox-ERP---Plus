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

import { BranchInfo, PurchaseOrder, PurchaseRequest, Requisition, CostCenter } from '../types';
import { dataService } from '../services/dataService';

/**
 * Generates an executive PDF document with Almox Plus header and professional table layout,
 * customized with official company/unit header (Razão Social, CNPJ, IE, Endereço e Gestor).
 */
export function exportToPDF(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string = 'relatorio-almoxplus',
  subTitle?: string,
  branchInfo?: BranchInfo | null
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

  // Header Banner with Official Branch Metadata
  const isSpecificBranch = Boolean(branchInfo && branchInfo.code && branchInfo.code !== 'GLOBAL');
  const bannerHeight = isSpecificBranch ? 25 : 22;

  doc.setFillColor(15, 23, 42); // Navy Blue 900
  doc.rect(0, 0, pageWidth, bannerHeight, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('ALMOX PLUS • ERP CORPORATIVO & SUPRIMENTOS', leftMargin, 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Emissão: ${new Date().toLocaleString('pt-BR')}`, pageWidth - rightMargin, 8, { align: 'right' });

  if (isSpecificBranch && branchInfo) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(226, 232, 240); // slate-200
    doc.text(`${branchInfo.corporateName || 'Almox Plus Tecnologia e Logística S.A.'} • ${branchInfo.name} (${branchInfo.code})`, leftMargin, 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(194, 205, 220);
    const cnpjIe = `CNPJ: ${branchInfo.cnpj || '12.345.678/0001-90'} | Inscr. Estadual: ${branchInfo.stateRegistration || 'Isento'}${branchInfo.phone ? ` | Fone: ${branchInfo.phone}` : ''}`;
    doc.text(cnpjIe, leftMargin, 19);

    const addressLine = `Endereço: ${branchInfo.street || ''}${branchInfo.number ? ', ' + branchInfo.number : ''}${branchInfo.complement ? ' (' + branchInfo.complement + ')' : ''} - ${branchInfo.neighborhood || ''} - ${branchInfo.city}/${branchInfo.state} - CEP: ${branchInfo.zipCode || ''}`;
    doc.text(addressLine, leftMargin, 23);

    if (branchInfo.managerName) {
      doc.text(`Gestor: ${branchInfo.managerName} (${branchInfo.managerRole || 'Responsável'})`, pageWidth - rightMargin, 19, { align: 'right' });
    }
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    doc.text('Sede Matriz Corporativa • Almox Plus Tecnologia e Logística S.A. • CNPJ: 12.345.678/0001-90 • Av. Paulista, 1500 - SP', leftMargin, 14);
    doc.text('Demonstrativo Consolidado de Todas as Unidades Operacionais (SP, RJ, BSB, SJRP)', leftMargin, 19);
  }

  // Title and Subtitle
  const titleY = bannerHeight + 9;
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), leftMargin, titleY);

  if (subTitle) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(subTitle, leftMargin, titleY + 5.5);
  }

  let startY = subTitle ? titleY + 10.5 : titleY + 7;

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
    category?: string;
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
  doc.text(`Unidade:`, leftMargin + 65, 38);
  doc.setFont('helvetica', 'normal');
  doc.text(audit.branch, leftMargin + 80, 38);

  doc.setFont('helvetica', 'bold');
  doc.text(`Campanha:`, leftMargin + 98, 38);
  doc.setFont('helvetica', 'normal');
  doc.text(audit.title || 'Inventário Periódico Geral', leftMargin + 117, 38);

  doc.setFont('helvetica', 'bold');
  doc.text(`Categoria:`, leftMargin + 195, 38);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 99, 235);
  doc.text(audit.category || 'Todas as Categorias', leftMargin + 212, 38);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text(`Responsável Abertura:`, leftMargin + 3, 44);
  doc.setFont('helvetica', 'normal');
  doc.text(audit.createdBy || audit.auditorUser || 'Administrador', leftMargin + 35, 44);

  doc.setFont('helvetica', 'bold');
  doc.text(`Inventariante de Campo:`, leftMargin + 85, 44);
  doc.setFont('helvetica', 'normal');
  doc.text('_____________________________', leftMargin + 122, 44);

  doc.setFont('helvetica', 'bold');
  doc.text(`Data da Contagem:`, leftMargin + 185, 44);
  doc.setFont('helvetica', 'normal');
  doc.text('____ / ____ / ________', leftMargin + 215, 44);

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

/**
 * Generates an executive A4 Portrait PDF for a specific Purchase Order (OC - Ordem de Compra),
 * complete with unit header, supplier data, itemized pricing, budget compliance, and signatures.
 */
export function exportPurchaseOrderPDF(
  order: PurchaseOrder,
  branchInfo?: BranchInfo | null,
  costCenter?: CostCenter | null
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const leftMargin = 14;
  const rightMargin = 14;
  const contentWidth = pageWidth - leftMargin - rightMargin; // 182mm

  // 1. TOP HEADER BANNER (Navy Blue)
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('ALMOX PLUS • ERP CORPORATIVO & SUPRIMENTOS', leftMargin, 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Documento emitido em: ${new Date().toLocaleString('pt-BR')}`, pageWidth - rightMargin, 8, { align: 'right' });

  // Unit Header Information
  const unitName = branchInfo?.name || `Unidade ${order.branch}`;
  const corpName = branchInfo?.corporateName || 'Almox Plus Tecnologia e Logística S.A.';
  const cnpj = branchInfo?.cnpj || '12.345.678/0001-90';
  const ie = branchInfo?.stateRegistration || 'Isento';
  const addr = branchInfo?.street
    ? `${branchInfo.street}, ${branchInfo.number || 'S/N'}${branchInfo.complement ? ' - ' + branchInfo.complement : ''} - ${branchInfo.neighborhood || ''} - ${branchInfo.city}/${branchInfo.state} - CEP ${branchInfo.zipCode || ''}`
    : `Pólo Operacional Unidade ${order.branch}`;
  const contact = `${branchInfo?.phone || branchInfo?.whatsapp ? `Fone/WhatsApp: ${branchInfo?.phone || branchInfo?.whatsapp}` : ''}${branchInfo?.email ? ` | E-mail: ${branchInfo.email}` : ''}`;
  const manager = branchInfo?.managerName ? `Gestor da Unidade: ${branchInfo.managerName} (${branchInfo.managerRole || 'Responsável'})` : '';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(241, 245, 249);
  doc.text(`${corpName} • ${unitName} (${order.branch})`, leftMargin, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(203, 213, 225);
  doc.text(`CNPJ: ${cnpj} | Inscrição Estadual: ${ie}${contact ? ` | ${contact}` : ''}`, leftMargin, 19);
  doc.text(`Endereço: ${addr}${manager ? ` | ${manager}` : ''}`, leftMargin, 24);

  // 2. DOCUMENT TITLE & CODE
  let curY = 35;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(leftMargin, curY, contentWidth, 12, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('ORDEM DE COMPRA (OC) — AUTORIZAÇÃO DE FORNECIMENTO', leftMargin + 4, curY + 7.5);

  doc.setFontSize(11);
  doc.setTextColor(37, 99, 235); // Blue 600
  doc.text(order.code, pageWidth - rightMargin - 4, curY + 7.5, { align: 'right' });

  curY += 15;

  // 3. METADATA CARDS (Two Columns: Order Info & Supplier Info)
  const colW = (contentWidth - 4) / 2;
  const boxH = 29;

  // Box Left: Informações da Ordem
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(leftMargin, curY, colW, boxH, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('DADOS DA ORDEM DE COMPRA', leftMargin + 3, curY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`Data de Emissão: ${new Date(order.createdAt).toLocaleDateString('pt-BR')}`, leftMargin + 3, curY + 10);
  doc.text(`Previsão de Entrega: ${order.estimatedDeliveryDate ? new Date(order.estimatedDeliveryDate).toLocaleDateString('pt-BR') : 'Imediata / Conforme Pedido'}`, leftMargin + 3, curY + 14.5);
  doc.text(`Condição de Pagamento: ${order.paymentTerms || '28 dias faturado'}`, leftMargin + 3, curY + 19);
  doc.text(`Status Atual: ${order.status} • Unidade de Destino: ${order.branch}`, leftMargin + 3, curY + 23.5);
  if (order.purchaseRequestCode) {
    doc.text(`Origem / Solicitação Vinculada: ${order.purchaseRequestCode}`, leftMargin + 3, curY + 27.5);
  }

  // Box Right: Informações do Fornecedor & Centro de Custo
  const rightX = leftMargin + colW + 4;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(rightX, curY, colW, boxH, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('FORNECEDOR HOMOLOGADO & CENTRO DE CUSTO', rightX + 3, curY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`Razão Social: ${order.supplierName || 'Fornecedor Homologado'}`, rightX + 3, curY + 10);
  doc.text(`CNPJ / CPF: ${order.supplierCnpj || '00.000.000/0001-00'}`, rightX + 3, curY + 14.5);
  doc.text(`Centro de Custo: ${order.costCenterName || costCenter?.name || 'Geral Operacional'}`, rightX + 3, curY + 19);
  doc.text(`Comprador / Solicitante: ${order.requestedBy || 'Setor de Suprimentos'}`, rightX + 3, curY + 23.5);

  curY += boxH + 4;

  // 4. BUDGET OVERRUN ALERT (IF APPLICABLE)
  if (order.budgetOverrun) {
    doc.setFillColor(254, 242, 242); // Rose 50
    doc.setDrawColor(248, 113, 113); // Rose 400
    doc.rect(leftMargin, curY, contentWidth, 12, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(185, 28, 28);
    const overrunVal = (order.budgetOverrunAmount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    doc.text(`⚠️ ALÇADA ESPECIAL: ORDEM COM ESTOURO DE TETO ORÇAMENTÁRIO (+ ${overrunVal})`, leftMargin + 3, curY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(153, 27, 27);
    const justif = order.budgetOverrunJustification || 'Aprovado sob alçada especial da Diretoria / Controladoria Financeira.';
    doc.text(`Justificativa / Parecer: ${justif.slice(0, 110)}`, leftMargin + 3, curY + 9);

    curY += 15;
  }

  // 5. ITEM TABLE HEADER
  const tCol = {
    idx: 10,
    code: 28,
    desc: 74,
    un: 12,
    qty: 18,
    unitPrice: 20,
    total: 20
  };

  const renderPoTableHeader = (y: number) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(leftMargin, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);

    let x = leftMargin;
    doc.text('Item', x + 2, y + 4.8); x += tCol.idx;
    doc.text('SKU / Código', x + 2, y + 4.8); x += tCol.code;
    doc.text('Descrição do Material', x + 2, y + 4.8); x += tCol.desc;
    doc.text('UN', x + 2, y + 4.8, { align: 'center' }); x += tCol.un;
    doc.text('Qtd.', x + tCol.qty - 2, y + 4.8, { align: 'right' }); x += tCol.qty;
    doc.text('Unitário', x + tCol.unitPrice - 2, y + 4.8, { align: 'right' }); x += tCol.unitPrice;
    doc.text('Total (R$)', x + tCol.total - 2, y + 4.8, { align: 'right' });
  };

  renderPoTableHeader(curY);
  curY += 7;

  // 6. ITEM TABLE ROWS
  const rowH = 6.5;
  let subtotal = 0;

  order.items.forEach((item, index) => {
    if (curY + rowH > pageHeight - 50) {
      doc.addPage();
      curY = 16;
      renderPoTableHeader(curY);
      curY += 7;
    }

    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(leftMargin, curY, contentWidth, rowH, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.rect(leftMargin, curY, contentWidth, rowH, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);

    const itemTotal = item.totalPrice || (item.quantity * item.unitPrice);
    subtotal += itemTotal;

    let x = leftMargin;
    doc.text(String(index + 1).padStart(2, '0'), x + 2, curY + 4.5); x += tCol.idx;
    doc.setFont('helvetica', 'bold');
    doc.text(item.productCode || '-', x + 2, curY + 4.5); x += tCol.code;

    doc.setFont('helvetica', 'normal');
    let desc = item.productName || 'Material diverso';
    if (doc.getTextWidth(desc) > tCol.desc - 4) {
      while (desc.length > 0 && doc.getTextWidth(desc + '...') > tCol.desc - 4) {
        desc = desc.slice(0, -1);
      }
      desc += '...';
    }
    doc.text(desc, x + 2, curY + 4.5); x += tCol.desc;

    doc.text(item.unit || 'UN', x + (tCol.un / 2), curY + 4.5, { align: 'center' }); x += tCol.un;
    doc.text(String(item.quantity), x + tCol.qty - 2, curY + 4.5, { align: 'right' }); x += tCol.qty;
    doc.text((item.unitPrice || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }), x + tCol.unitPrice - 2, curY + 4.5, { align: 'right' }); x += tCol.unitPrice;
    doc.setFont('helvetica', 'bold');
    doc.text(itemTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), x + tCol.total - 2, curY + 4.5, { align: 'right' });

    curY += rowH;
  });

  // 7. TOTALS BOX
  curY += 2;
  const totalVal = order.totalValue || subtotal;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(leftMargin + (contentWidth - 75), curY, 75, 10, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('VALOR TOTAL DA OC:', leftMargin + (contentWidth - 72), curY + 6.5);
  doc.setFontSize(10.5);
  doc.setTextColor(37, 99, 235);
  doc.text(totalVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), pageWidth - rightMargin - 4, curY + 6.5, { align: 'right' });

  curY += 14;

  // 8. DELIVERY & BILLING INSTRUCTIONS
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(leftMargin, curY, contentWidth, 14, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('INSTRUÇÕES DE FATURAMENTO, ENTREGA E RECEBIMENTO FISCAL:', leftMargin + 3, curY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`1. A Nota Fiscal (DANFE) deve constar obrigatoriamente o número desta OC (${order.code}) e ser emitida contra o CNPJ ${cnpj}.`, leftMargin + 3, curY + 8);
  doc.text(`2. Entrega física no endereço da ${unitName}: ${addr}. Horário de recebimento: 08:00 às 17:00.`, leftMargin + 3, curY + 11.5);

  curY += 18;

  // 9. SIGNATURES BLOCK
  if (curY + 30 > pageHeight - 12) {
    doc.addPage();
    curY = 25;
  }

  const sigW = (contentWidth - 12) / 3;

  // Signature 1: Comprador
  doc.setDrawColor(148, 163, 184);
  doc.line(leftMargin, curY + 12, leftMargin + sigW, curY + 12);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Comprador / Suprimentos', leftMargin + (sigW / 2), curY + 16, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(order.requestedBy || 'Emissor Autorizado', leftMargin + (sigW / 2), curY + 20, { align: 'center' });

  // Signature 2: Gestor da Unidade
  const sig2X = leftMargin + sigW + 6;
  doc.line(sig2X, curY + 12, sig2X + sigW, curY + 12);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Gestor da Unidade / Almoxarifado', sig2X + (sigW / 2), curY + 16, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(branchInfo?.managerName || 'Aprovação Operacional', sig2X + (sigW / 2), curY + 20, { align: 'center' });

  // Signature 3: Recebimento Fornecedor / Transportadora
  const sig3X = sig2X + sigW + 6;
  doc.line(sig3X, curY + 12, sig3X + sigW, curY + 12);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Aceite do Fornecedor / Transportador', sig3X + (sigW / 2), curY + 16, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Nome Legível e Data de Entrega', sig3X + (sigW / 2), curY + 20, { align: 'center' });

  // Footer on all pages
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Ordem de Compra ${order.code} • ${unitName} • Página ${i} de ${pageCount} — Almox Plus ERP Enterprise`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  doc.save(`ordem-compra-${order.code.toLowerCase()}_${order.branch}.pdf`);
}

/**
 * Generates an executive A4 Portrait PDF for a specific Purchase Request (SC - Solicitação de Compra),
 * complete with unit header, department justification, priority, item list, and approval signatures.
 */
export function exportPurchaseRequestPDF(
  request: PurchaseRequest,
  branchInfo?: BranchInfo | null,
  costCenter?: CostCenter | null
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const leftMargin = 14;
  const rightMargin = 14;
  const contentWidth = pageWidth - leftMargin - rightMargin;

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('ALMOX PLUS • ERP CORPORATIVO & SUPRIMENTOS', leftMargin, 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Emissão: ${new Date().toLocaleString('pt-BR')}`, pageWidth - rightMargin, 8, { align: 'right' });

  const unitName = branchInfo?.name || `Unidade ${request.branch}`;
  const corpName = branchInfo?.corporateName || 'Almox Plus Tecnologia e Logística S.A.';
  const cnpj = branchInfo?.cnpj || '12.345.678/0001-90';
  const ie = branchInfo?.stateRegistration || 'Isento';
  const addr = branchInfo?.street
    ? `${branchInfo.street}, ${branchInfo.number || 'S/N'}${branchInfo.complement ? ' - ' + branchInfo.complement : ''} - ${branchInfo.neighborhood || ''} - ${branchInfo.city}/${branchInfo.state} - CEP ${branchInfo.zipCode || ''}`
    : `Pólo Operacional Unidade ${request.branch}`;
  const contact = `${branchInfo?.phone || branchInfo?.whatsapp ? `Fone: ${branchInfo?.phone || branchInfo?.whatsapp}` : ''}${branchInfo?.email ? ` | E-mail: ${branchInfo.email}` : ''}`;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(241, 245, 249);
  doc.text(`${corpName} • ${unitName} (${request.branch})`, leftMargin, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(203, 213, 225);
  doc.text(`CNPJ: ${cnpj} | IE: ${ie}${contact ? ` | ${contact}` : ''}`, leftMargin, 19);
  doc.text(`Endereço: ${addr}`, leftMargin, 24);

  // Title & Code
  let curY = 35;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(leftMargin, curY, contentWidth, 12, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('SOLICITAÇÃO DE COMPRA (SC) — PEDIDO DE AQUISIÇÃO', leftMargin + 4, curY + 7.5);

  doc.setFontSize(11);
  doc.setTextColor(37, 99, 235);
  doc.text(request.code, pageWidth - rightMargin - 4, curY + 7.5, { align: 'right' });

  curY += 15;

  // Metadata Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(leftMargin, curY, contentWidth, 22, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('DADOS DA REQUISIÇÃO:', leftMargin + 3, curY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(`Data de Abertura: ${new Date(request.createdAt).toLocaleDateString('pt-BR')}`, leftMargin + 3, curY + 10);
  doc.text(`Solicitante: ${request.requestedBy} (${request.requestedByEmail || 'Setor Operacional'})`, leftMargin + 3, curY + 14.5);
  doc.text(`Departamento / Finalidade: ${request.department || 'Operações'}`, leftMargin + 3, curY + 19);

  const col2X = leftMargin + 95;
  doc.text(`Unidade Solicitante: ${request.branch} (${unitName})`, col2X, curY + 10);
  doc.text(`Centro de Custo: ${request.costCenterName || costCenter?.name || 'Geral'}`, col2X, curY + 14.5);
  doc.text(`Prioridade: ${request.priority} • Status: ${request.status}`, col2X, curY + 19);

  curY += 25;

  // Justification Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(leftMargin, curY, contentWidth, 12, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('JUSTIFICATIVA DA NECESSIDADE / FINALIDADE DA COMPRA:', leftMargin + 3, curY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(30, 41, 59);
  const just = request.justification || 'Reposição de estoque / atendimento a demandas operacionais.';
  doc.text(just.slice(0, 130), leftMargin + 3, curY + 8.5);

  curY += 16;

  // Table Header
  const scCol = {
    idx: 10,
    code: 26,
    desc: 70,
    un: 12,
    qty: 18,
    estUnit: 23,
    totalEst: 23
  };

  const renderScTableHeader = (y: number) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(leftMargin, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);

    let x = leftMargin;
    doc.text('Item', x + 2, y + 4.8); x += scCol.idx;
    doc.text('SKU / Código', x + 2, y + 4.8); x += scCol.code;
    doc.text('Descrição do Material Requisitado', x + 2, y + 4.8); x += scCol.desc;
    doc.text('UN', x + 2, y + 4.8, { align: 'center' }); x += scCol.un;
    doc.text('Qtd.', x + scCol.qty - 2, y + 4.8, { align: 'right' }); x += scCol.qty;
    doc.text('Estimado UN', x + scCol.estUnit - 2, y + 4.8, { align: 'right' }); x += scCol.estUnit;
    doc.text('Total Estimado', x + scCol.totalEst - 2, y + 4.8, { align: 'right' });
  };

  renderScTableHeader(curY);
  curY += 7;

  // Table Rows
  const rowH = 6.5;
  let totalEstimado = 0;

  request.items.forEach((item, index) => {
    if (curY + rowH > pageHeight - 45) {
      doc.addPage();
      curY = 16;
      renderScTableHeader(curY);
      curY += 7;
    }

    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(leftMargin, curY, contentWidth, rowH, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.rect(leftMargin, curY, contentWidth, rowH, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);

    const estUnit = item.estimatedUnitPrice || 0;
    const itemTotal = item.quantity * estUnit;
    totalEstimado += itemTotal;

    let x = leftMargin;
    doc.text(String(index + 1).padStart(2, '0'), x + 2, curY + 4.5); x += scCol.idx;
    doc.setFont('helvetica', 'bold');
    doc.text(item.productCode || 'NOVO', x + 2, curY + 4.5); x += scCol.code;

    doc.setFont('helvetica', 'normal');
    let desc = item.productName || 'Material';
    if (doc.getTextWidth(desc) > scCol.desc - 4) {
      while (desc.length > 0 && doc.getTextWidth(desc + '...') > scCol.desc - 4) {
        desc = desc.slice(0, -1);
      }
      desc += '...';
    }
    doc.text(desc, x + 2, curY + 4.5); x += scCol.desc;

    doc.text(item.unit || 'UN', x + (scCol.un / 2), curY + 4.5, { align: 'center' }); x += scCol.un;
    doc.text(String(item.quantity), x + scCol.qty - 2, curY + 4.5, { align: 'right' }); x += scCol.qty;
    doc.text(estUnit > 0 ? estUnit.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : 'A Cotar', x + scCol.estUnit - 2, curY + 4.5, { align: 'right' }); x += scCol.estUnit;
    doc.setFont('helvetica', 'bold');
    doc.text(itemTotal > 0 ? itemTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : 'A Cotar', x + scCol.totalEst - 2, curY + 4.5, { align: 'right' });

    curY += rowH;
  });

  // Total Box
  curY += 2;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(leftMargin + (contentWidth - 85), curY, 85, 10, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL ESTIMADO DA SC:', leftMargin + (contentWidth - 82), curY + 6.5);
  doc.setFontSize(9.5);
  doc.setTextColor(37, 99, 235);
  doc.text(totalEstimado > 0 ? totalEstimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Sob Cotação', pageWidth - rightMargin - 4, curY + 6.5, { align: 'right' });

  curY += 18;

  // Signatures Block
  if (curY + 30 > pageHeight - 12) {
    doc.addPage();
    curY = 25;
  }

  const sigW = (contentWidth - 12) / 3;

  doc.setDrawColor(148, 163, 184);
  doc.line(leftMargin, curY + 12, leftMargin + sigW, curY + 12);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Solicitante do Setor', leftMargin + (sigW / 2), curY + 16, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(request.requestedBy, leftMargin + (sigW / 2), curY + 20, { align: 'center' });

  const sig2X = leftMargin + sigW + 6;
  doc.line(sig2X, curY + 12, sig2X + sigW, curY + 12);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Gestor do Centro de Custo', sig2X + (sigW / 2), curY + 16, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Aprovação Orçamentária', sig2X + (sigW / 2), curY + 20, { align: 'center' });

  const sig3X = sig2X + sigW + 6;
  doc.line(sig3X, curY + 12, sig3X + sigW, curY + 12);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Setor de Compras / Cotação', sig3X + (sigW / 2), curY + 16, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Parecer e Abertura de OC', sig3X + (sigW / 2), curY + 20, { align: 'center' });

  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Solicitação de Compra ${request.code} • ${unitName} • Página ${i} de ${pageCount} — Almox Plus ERP`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  doc.save(`solicitacao-compra-${request.code.toLowerCase()}_${request.branch}.pdf`);
}

/**
 * Generates an executive A4 Portrait PDF for a Material Requisition (SM - Solicitação de Material ao Almoxarifado),
 * complete with unit header, requesting user/department, stock withdrawal list, and warehouse signatures.
 */
export function exportRequisitionPDF(
  requisition: Requisition,
  branchInfo?: BranchInfo | null,
  costCenter?: CostCenter | null
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const leftMargin = 14;
  const rightMargin = 14;
  const contentWidth = pageWidth - leftMargin - rightMargin;

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('ALMOX PLUS • ERP CORPORATIVO & GESTÃO DE ESTOQUE', leftMargin, 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Emissão: ${new Date().toLocaleString('pt-BR')}`, pageWidth - rightMargin, 8, { align: 'right' });

  const unitName = branchInfo?.name || `Almoxarifado Unidade ${requisition.branch}`;
  const corpName = branchInfo?.corporateName || 'Almox Plus Tecnologia e Logística S.A.';
  const cnpj = branchInfo?.cnpj || '12.345.678/0001-90';
  const ie = branchInfo?.stateRegistration || 'Isento';
  const addr = branchInfo?.street
    ? `${branchInfo.street}, ${branchInfo.number || 'S/N'}${branchInfo.complement ? ' - ' + branchInfo.complement : ''} - ${branchInfo.neighborhood || ''} - ${branchInfo.city}/${branchInfo.state} - CEP ${branchInfo.zipCode || ''}`
    : `Almoxarifado Central Unidade ${requisition.branch}`;
  const contact = `${branchInfo?.phone || branchInfo?.whatsapp ? `Fone: ${branchInfo?.phone || branchInfo?.whatsapp}` : ''}`;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(241, 245, 249);
  doc.text(`${corpName} • ${unitName} (${requisition.branch})`, leftMargin, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(203, 213, 225);
  doc.text(`CNPJ: ${cnpj} | IE: ${ie}${contact ? ` | ${contact}` : ''}`, leftMargin, 19);
  doc.text(`Endereço: ${addr}`, leftMargin, 24);

  // Title & Code
  let curY = 35;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(leftMargin, curY, contentWidth, 12, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('REQUISIÇÃO INTERNA DE MATERIAL — ALMOXARIFADO', leftMargin + 4, curY + 7.5);

  doc.setFontSize(11);
  doc.setTextColor(37, 99, 235);
  doc.text(requisition.code, pageWidth - rightMargin - 4, curY + 7.5, { align: 'right' });

  curY += 15;

  // Metadata Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(leftMargin, curY, contentWidth, 20, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('DADOS DA SOLICITAÇÃO DE MATERIAL:', leftMargin + 3, curY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(`Data de Emissão: ${new Date(requisition.createdAt).toLocaleDateString('pt-BR')}`, leftMargin + 3, curY + 9);
  doc.text(`Solicitante: ${requisition.requestedBy}`, leftMargin + 3, curY + 13.5);
  doc.text(`Centro de Custo: ${requisition.costCenterName || costCenter?.name || 'Geral'}`, leftMargin + 3, curY + 17.5);

  const col2X = leftMargin + 95;
  doc.text(`Unidade / Almoxarifado: ${requisition.branch} (${unitName})`, col2X, curY + 9);
  doc.text(`Prioridade: ${requisition.priority}`, col2X, curY + 13.5);
  doc.text(`Status do Pedido: ${requisition.status}${requisition.approvedBy ? ` (Aprovado por ${requisition.approvedBy})` : ''}`, col2X, curY + 17.5);

  curY += 24;

  // Items Table Header
  const reqCol = {
    idx: 10,
    code: 28,
    desc: 84,
    un: 14,
    requestedQty: 23,
    fulfilledQty: 23
  };

  const renderReqTableHeader = (y: number) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(leftMargin, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);

    let x = leftMargin;
    doc.text('Item', x + 2, y + 4.8); x += reqCol.idx;
    doc.text('SKU / Código', x + 2, y + 4.8); x += reqCol.code;
    doc.text('Descrição do Material', x + 2, y + 4.8); x += reqCol.desc;
    doc.text('UN', x + 2, y + 4.8, { align: 'center' }); x += reqCol.un;
    doc.text('Qtd. Solicitada', x + reqCol.requestedQty - 2, y + 4.8, { align: 'right' }); x += reqCol.requestedQty;
    doc.text('Qtd. Atendida', x + reqCol.fulfilledQty - 2, y + 4.8, { align: 'right' });
  };

  renderReqTableHeader(curY);
  curY += 7;

  // Table Rows
  const rowH = 6.5;

  requisition.items.forEach((item, index) => {
    if (curY + rowH > pageHeight - 50) {
      doc.addPage();
      curY = 16;
      renderReqTableHeader(curY);
      curY += 7;
    }

    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(leftMargin, curY, contentWidth, rowH, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.rect(leftMargin, curY, contentWidth, rowH, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);

    let x = leftMargin;
    doc.text(String(index + 1).padStart(2, '0'), x + 2, curY + 4.5); x += reqCol.idx;
    doc.setFont('helvetica', 'bold');
    doc.text(item.productCode || '-', x + 2, curY + 4.5); x += reqCol.code;

    doc.setFont('helvetica', 'normal');
    let desc = item.productName || 'Material';
    if (doc.getTextWidth(desc) > reqCol.desc - 4) {
      while (desc.length > 0 && doc.getTextWidth(desc + '...') > reqCol.desc - 4) {
        desc = desc.slice(0, -1);
      }
      desc += '...';
    }
    doc.text(desc, x + 2, curY + 4.5); x += reqCol.desc;

    doc.text(item.unit || 'UN', x + (reqCol.un / 2), curY + 4.5, { align: 'center' }); x += reqCol.un;
    doc.text(String(item.requestedQuantity), x + reqCol.requestedQty - 2, curY + 4.5, { align: 'right' }); x += reqCol.requestedQty;
    doc.setFont('helvetica', 'bold');
    doc.text(String(item.fulfilledQuantity !== undefined ? item.fulfilledQuantity : item.requestedQuantity), x + reqCol.fulfilledQty - 2, curY + 4.5, { align: 'right' });

    curY += rowH;
  });

  curY += 6;

  // Receipt Terms Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(leftMargin, curY, contentWidth, 14, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('TERMO DE RESPONSABILIDADE & RECEBIMENTO FÍSICO:', leftMargin + 3, curY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Declaro haver recebido em perfeita ordem e quantidade os materiais acima relacionados para uso estrito nas atividades operacionais.', leftMargin + 3, curY + 8.5);
  doc.text('A responsabilidade pela guarda, conservação e aplicação correta do material passa a ser do solicitante/receptor.', leftMargin + 3, curY + 11.5);

  curY += 20;

  // Signatures
  if (curY + 28 > pageHeight - 12) {
    doc.addPage();
    curY = 25;
  }

  const sigW = (contentWidth - 10) / 2;

  // Signature 1: Solicitante / Receptor
  doc.setDrawColor(148, 163, 184);
  doc.line(leftMargin + 10, curY + 12, leftMargin + 10 + sigW, curY + 12);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Assinatura do Solicitante / Receptor', leftMargin + 10 + (sigW / 2), curY + 16, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Nome: ${requisition.requestedBy}`, leftMargin + 10 + (sigW / 2), curY + 20, { align: 'center' });

  // Signature 2: Almoxarife Responsável
  const sig2X = leftMargin + 10 + sigW + 10;
  doc.line(sig2X, curY + 12, sig2X + sigW, curY + 12);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Visto do Almoxarife / Baixa no ERP', sig2X + (sigW / 2), curY + 16, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Unidade ${requisition.branch} • Almoxarifado Central`, sig2X + (sigW / 2), curY + 20, { align: 'center' });

  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Requisição de Material ${requisition.code} • ${unitName} • Página ${i} de ${pageCount} — Almox Plus ERP`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  doc.save(`requisicao-material-${requisition.code.toLowerCase()}_${requisition.branch}.pdf`);
}

/**
 * Generates an executive Inventory Audit & Reconciliation Report (Laudo de Reconciliação de Inventário)
 * for finalized campaigns with Unit headers, divergence analysis, financial balance, and signatures.
 */
export function exportInventoryReconciliationPDF(
  audit: {
    code: string;
    branch: string;
    title: string;
    category?: string;
    status: string;
    startedAt: string;
    finishedAt?: string;
    reconciledAt?: string;
    reconciledBy?: string;
    createdBy?: string;
    auditorUser?: string;
    totalDivergenceCount: number;
    totalDivergenceValue: number;
    items: Array<{
      productId: string;
      productCode: string;
      productName: string;
      unit?: string;
      systemQuantity: number;
      countedQuantity: number;
      divergence: number;
      divergenceValue?: number;
      notes?: string;
    }>;
  },
  productsList?: Array<{ id: string; locationSlot?: string; unit?: string; category?: string; unitPrice?: number }>
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
  const contentWidth = pageWidth - leftMargin - rightMargin;

  // Branch Info
  const branchInfo = dataService.getBranches(false).find(b => b.code === audit.branch);
  const corpName = branchInfo?.corporateName || 'Almox Plus Tecnologia e Logística S.A.';
  const unitName = branchInfo?.name || `Unidade ${audit.branch}`;
  const cnpj = branchInfo?.cnpj || '12.345.678/0001-90';
  const ie = branchInfo?.stateRegistration || 'Isento';
  const addr = branchInfo?.address || `${branchInfo?.street || ''}, ${branchInfo?.number || ''} - ${branchInfo?.city || ''}/${branchInfo?.state || ''}`;

  // Header Banner
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(248, 250, 252);
  doc.text(`${corpName} • ${unitName} (${audit.branch})`, leftMargin, 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`CNPJ: ${cnpj} | IE: ${ie} | Almoxarifado Central`, leftMargin, 15);
  doc.text(`Endereço: ${addr}`, leftMargin, 20);

  doc.setFontSize(8);
  doc.text(`Emissão do Laudo: ${new Date().toLocaleString('pt-BR')}`, pageWidth - rightMargin, 12, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.text(`STATUS: ${audit.status === 'CONCLUIDO' ? 'RECONCILIADO & CONCLUÍDO' : 'EM ANDAMENTO'}`, pageWidth - rightMargin, 18, { align: 'right' });

  // Document Title & Bar
  let curY = 28;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(leftMargin, curY, contentWidth, 12, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('LAUDO TÉCNICO DE AUDITORIA & RECONCILIAÇÃO FÍSICA DE ESTOQUE', leftMargin + 4, curY + 7.5);

  doc.setFontSize(11);
  doc.setTextColor(37, 99, 235);
  doc.text(audit.code, pageWidth - rightMargin - 4, curY + 7.5, { align: 'right' });

  curY += 15;

  // Metadata Block
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(leftMargin, curY, contentWidth, 16, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('DADOS DA CAMPANHA:', leftMargin + 3, curY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(`Título: ${audit.title || 'Inventário Periódico'}`, leftMargin + 3, curY + 9);
  doc.text(`Categoria Auditada: ${audit.category || 'Todas as Categorias (Geral)'}`, leftMargin + 3, curY + 13.5);

  const col2X = leftMargin + 95;
  doc.text(`Data de Abertura: ${new Date(audit.startedAt).toLocaleDateString('pt-BR')}`, col2X, curY + 9);
  doc.text(`Responsável Abertura: ${audit.createdBy || audit.auditorUser || 'Administrador'}`, col2X, curY + 13.5);

  const col3X = leftMargin + 185;
  const finDate = audit.reconciledAt || audit.finishedAt;
  doc.text(`Data de Conclusão: ${finDate ? new Date(finDate).toLocaleDateString('pt-BR') : 'Em Andamento'}`, col3X, curY + 9);
  doc.text(`Reconciliado Por: ${audit.reconciledBy || 'Pendente de Reconciliação'}`, col3X, curY + 13.5);

  curY += 19;

  // Summary Metrics KPIs
  const totalItems = audit.items.length;
  const exactItems = audit.items.filter(i => i.divergence === 0).length;
  const divergentItems = audit.items.filter(i => i.divergence !== 0).length;
  const surplusCount = audit.items.filter(i => i.divergence > 0).length;
  const lackCount = audit.items.filter(i => i.divergence < 0).length;
  const accuracyPct = totalItems > 0 ? ((exactItems / totalItems) * 100).toFixed(1) : '100.0';

  const kpiBoxWidth = (contentWidth - 12) / 4;
  const kpiBoxHeight = 13;

  const renderKPIBox = (x: number, title: string, value: string, sub: string, bgColor: number[], textColor: number[]) => {
    doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
    doc.setDrawColor(226, 232, 240);
    doc.rect(x, curY, kpiBoxWidth, kpiBoxHeight, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(title.toUpperCase(), x + 3, curY + 3.8);

    doc.setFontSize(10.5);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(value, x + 3, curY + 8.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text(sub, x + 3, curY + 11.5);
  };

  renderKPIBox(leftMargin, 'Itens Auditados', `${totalItems} produtos`, `${audit.category || 'Todas as categorias'}`, [255, 255, 255], [30, 41, 59]);
  renderKPIBox(leftMargin + kpiBoxWidth + 4, 'Acuracidade Física', `${accuracyPct}%`, `${exactItems} itens com saldo exato`, [240, 253, 244], [22, 101, 52]);
  renderKPIBox(leftMargin + (kpiBoxWidth * 2) + 8, 'Divergências', `${divergentItems} itens`, `+${surplusCount} sobras / -${lackCount} faltas`, [254, 242, 242], [153, 27, 27]);
  renderKPIBox(leftMargin + (kpiBoxWidth * 3) + 12, 'Impacto Financeiro', `R$ ${audit.totalDivergenceValue.toFixed(2)}`, `Ajuste contábil total`, [239, 246, 255], [29, 78, 216]);

  curY += 16;

  // Table Columns Definition
  const recCol = {
    idx: 10,
    code: 26,
    desc: 78,
    cat: 35,
    un: 12,
    sys: 22,
    cnt: 22,
    div: 22,
    price: 22,
    totalDiv: 24
  };

  const renderTableHeader = (y: number) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(leftMargin, y, contentWidth, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);

    let x = leftMargin;
    doc.text('#', x + 2, y + 4.5); x += recCol.idx;
    doc.text('SKU / Código', x + 2, y + 4.5); x += recCol.code;
    doc.text('Descrição do Produto', x + 2, y + 4.5); x += recCol.desc;
    doc.text('Categoria', x + 2, y + 4.5); x += recCol.cat;
    doc.text('UN', x + 2, y + 4.5, { align: 'center' }); x += recCol.un;
    doc.text('Qtd Sistema', x + recCol.sys - 2, y + 4.5, { align: 'right' }); x += recCol.sys;
    doc.text('Qtd Contada', x + recCol.cnt - 2, y + 4.5, { align: 'right' }); x += recCol.cnt;
    doc.text('Divergência', x + recCol.div - 2, y + 4.5, { align: 'right' }); x += recCol.div;
    doc.text('Vl. Unit. (R$)', x + recCol.price - 2, y + 4.5, { align: 'right' }); x += recCol.price;
    doc.text('Diverg. (R$)', x + recCol.totalDiv - 2, y + 4.5, { align: 'right' });
  };

  renderTableHeader(curY);
  curY += 6.5;

  const rowH = 6;
  const prodMap = new Map<string, any>();
  if (productsList) {
    productsList.forEach(p => prodMap.set(p.id, p));
  }

  audit.items.forEach((item, index) => {
    if (curY + rowH > pageHeight - 35) {
      doc.addPage();
      curY = 16;
      renderTableHeader(curY);
      curY += 6.5;
    }

    const prod = prodMap.get(item.productId);
    const cat = prod?.category || 'Geral';
    const uPrice = prod?.unitPrice ?? (item.divergence !== 0 && item.divergenceValue ? Math.abs(item.divergenceValue / item.divergence) : 0);
    const divVal = item.divergenceValue ?? (item.divergence * uPrice);

    if (item.divergence !== 0) {
      doc.setFillColor(item.divergence > 0 ? 240 : 254, item.divergence > 0 ? 253 : 242, item.divergence > 0 ? 244 : 242);
    } else if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.rect(leftMargin, curY, contentWidth, rowH, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(leftMargin, curY, contentWidth, rowH, 'S');

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);

    let x = leftMargin;
    doc.text(String(index + 1), x + 2, curY + 4.2); x += recCol.idx;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(item.productCode, x + 2, curY + 4.2); x += recCol.code;

    doc.setFont('helvetica', 'normal');
    const truncatedName = doc.splitTextToSize(item.productName, recCol.desc - 4)[0];
    doc.text(truncatedName, x + 2, curY + 4.2); x += recCol.desc;

    const truncatedCat = doc.splitTextToSize(cat, recCol.cat - 4)[0];
    doc.text(truncatedCat, x + 2, curY + 4.2); x += recCol.cat;

    doc.text(item.unit || prod?.unit || 'UN', x + (recCol.un / 2), curY + 4.2, { align: 'center' }); x += recCol.un;

    doc.text(String(item.systemQuantity), x + recCol.sys - 2, curY + 4.2, { align: 'right' }); x += recCol.sys;

    doc.setFont('helvetica', 'bold');
    doc.text(String(item.countedQuantity), x + recCol.cnt - 2, curY + 4.2, { align: 'right' }); x += recCol.cnt;

    // Divergence color
    if (item.divergence === 0) {
      doc.setTextColor(100, 116, 139);
      doc.text('0', x + recCol.div - 2, curY + 4.2, { align: 'right' });
    } else if (item.divergence > 0) {
      doc.setTextColor(22, 101, 52);
      doc.text(`+${item.divergence}`, x + recCol.div - 2, curY + 4.2, { align: 'right' });
    } else {
      doc.setTextColor(185, 28, 28);
      doc.text(String(item.divergence), x + recCol.div - 2, curY + 4.2, { align: 'right' });
    }
    x += recCol.div;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`R$ ${uPrice.toFixed(2)}`, x + recCol.price - 2, curY + 4.2, { align: 'right' }); x += recCol.price;

    if (divVal === 0) {
      doc.setTextColor(100, 116, 139);
      doc.text('R$ 0,00', x + recCol.totalDiv - 2, curY + 4.2, { align: 'right' });
    } else if (divVal > 0) {
      doc.setTextColor(22, 101, 52);
      doc.setFont('helvetica', 'bold');
      doc.text(`+R$ ${divVal.toFixed(2)}`, x + recCol.totalDiv - 2, curY + 4.2, { align: 'right' });
    } else {
      doc.setTextColor(185, 28, 28);
      doc.setFont('helvetica', 'bold');
      doc.text(`-R$ ${Math.abs(divVal).toFixed(2)}`, x + recCol.totalDiv - 2, curY + 4.2, { align: 'right' });
    }

    curY += rowH;
  });

  // Check if signatures fit on current page
  if (curY + 28 > pageHeight - 15) {
    doc.addPage();
    curY = 25;
  } else {
    curY += 8;
  }

  // Formal Signatures
  const sigW = (contentWidth - 20) / 3;

  doc.setDrawColor(148, 163, 184);

  // Sig 1: Auditor
  doc.line(leftMargin, curY + 12, leftMargin + sigW, curY + 12);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Auditor / Inventariante', leftMargin + (sigW / 2), curY + 16, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(audit.auditorUser || audit.createdBy || 'Responsável pela Contagem', leftMargin + (sigW / 2), curY + 20, { align: 'center' });

  // Sig 2: Almoxarife
  const sig2X = leftMargin + sigW + 10;
  doc.line(sig2X, curY + 12, sig2X + sigW, curY + 12);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Responsável pelo Almoxarifado', sig2X + (sigW / 2), curY + 16, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Unidade ${audit.branch} • Conferência Física`, sig2X + (sigW / 2), curY + 20, { align: 'center' });

  // Sig 3: Diretoria / Reconciliação
  const sig3X = sig2X + sigW + 10;
  doc.line(sig3X, curY + 12, sig3X + sigW, curY + 12);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Homologação / Reconciliação ERP', sig3X + (sigW / 2), curY + 16, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(audit.reconciledBy ? `Reconciliado por: ${audit.reconciledBy}` : 'Diretoria de Operações', sig3X + (sigW / 2), curY + 20, { align: 'center' });

  // Page numbers
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Laudo de Auditoria de Inventário ${audit.code} • ${unitName} • Página ${i} de ${pageCount} — Almox Plus ERP`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  doc.save(`laudo-reconciliacao-inventario-${audit.code.toLowerCase()}_${audit.branch}.pdf`);
}

