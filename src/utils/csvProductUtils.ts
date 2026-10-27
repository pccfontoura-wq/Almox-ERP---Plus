import { Product, Branch } from '../types';

/**
 * Header columns definition for Product CSV Import
 */
export const PRODUCT_CSV_COLUMNS = [
  { key: 'codigo', label: 'Código / SKU', required: true, example: 'EPI-001', desc: 'Identificador único do material' },
  { key: 'nome', label: 'Nome do Produto', required: true, example: 'Luva de Vaqueta Mista Cano Curto', desc: 'Descrição comercial ou técnica' },
  { key: 'categoria', label: 'Categoria', required: true, example: 'EPI & Segurança', desc: 'Ex: Elétrica, EPI & Segurança, Ferramentas, TI, Hidráulica' },
  { key: 'unidade', label: 'Unidade de Medida', required: true, example: 'PAR', desc: 'Ex: UN, PAR, CX, KG, M, L, PCT, ROLO' },
  { key: 'preco_unitario', label: 'Preço Médio (R$)', required: true, example: '28.50', desc: 'Valor unitário de aquisição' },
  { key: 'estoque_minimo', label: 'Estoque Mínimo', required: false, example: '15', desc: 'Gatilho para alerta de reposição' },
  { key: 'estoque_maximo', label: 'Estoque Máximo', required: false, example: '100', desc: 'Capacidade máxima de armazenamento' },
  { key: 'localizacao', label: 'Prateleira / Endereço', required: false, example: 'PRAT-A1-S2', desc: 'Local físico no almoxarifado' },
  { key: 'saldo_sp', label: 'Saldo SP', required: false, example: '50', desc: 'Estoque inicial na Unidade São Paulo (Matriz)' },
  { key: 'saldo_rj', label: 'Saldo RJ', required: false, example: '20', desc: 'Estoque inicial na Unidade Rio de Janeiro' },
  { key: 'saldo_bsb', label: 'Saldo BSB', required: false, example: '15', desc: 'Estoque inicial na Unidade Brasília' },
  { key: 'saldo_sjrp', label: 'Saldo SJRP', required: false, example: '10', desc: 'Estoque inicial na Unidade São José do Rio Preto' },
  { key: 'lote', label: 'Lote de Fabricação', required: false, example: 'LT-2026/01', desc: 'Código do lote (opcional)' },
  { key: 'validade', label: 'Data de Validade', required: false, example: '31/12/2026', desc: 'Formato DD/MM/AAAA ou AAAA-MM-DD' },
  { key: 'descricao', label: 'Descrição Detalhada', required: false, example: 'Com reforço palmar em vaqueta e dorso em raspa', desc: 'Especificação técnica adicional' }
];

/**
 * Generates official template CSV content with UTF-8 BOM for flawless Excel compatibility
 */
export function generateProductCSVTemplate(): string {
  const headers = [
    'codigo',
    'nome',
    'categoria',
    'unidade',
    'preco_unitario',
    'estoque_minimo',
    'estoque_maximo',
    'localizacao',
    'saldo_sp',
    'saldo_rj',
    'saldo_bsb',
    'saldo_sjrp',
    'lote',
    'validade',
    'descricao'
  ];

  const sampleRows = [
    [
      'EPI-010',
      'Luva de Vaqueta Cano Curto Punho Elástico',
      'EPI & Segurança',
      'PAR',
      '28.50',
      '20',
      '150',
      'PRAT-A1-S1',
      '60',
      '25',
      '15',
      '10',
      'LT-2026/LV-01',
      '31/12/2027',
      'Luva para proteção mecânica e solda leve conforme NR-6'
    ],
    [
      'ELE-025',
      'Disjuntor Termomagnético Bipolar 32A Curva C',
      'Elétrica',
      'UN',
      '42.90',
      '10',
      '60',
      'PRAT-B2-E4',
      '30',
      '15',
      '8',
      '6',
      'LT-2025/SCH-32',
      '',
      'Disjuntor norma IEC 60898 para quadros elétricos de distribuição'
    ],
    [
      'QUI-005',
      'Álcool Isopropílico 99,8% Galão 5 Litros',
      'Produtos Químicos & Limpeza',
      'UN',
      '115.00',
      '8',
      '40',
      'PRAT-D1-Q2',
      '18',
      '10',
      '5',
      '4',
      'LT-QUI-2026/02',
      '28/11/2027',
      'Para limpeza de placas e componentes eletrônicos com FISPQ homologada'
    ],
    [
      'FER-018',
      'Jogo de Chaves Isoladas Fenda e Philips 1000V (6 Peças)',
      'Ferramentas',
      'JG',
      '89.90',
      '5',
      '30',
      'PRAT-C3-F1',
      '12',
      '8',
      '4',
      '2',
      'LT-2026/FER-10',
      '',
      'Certificação NR-10 isolação até 1000V AC'
    ],
    [
      'INF-012',
      'Cabo de Rede UTP Cat6 Furukawa Caixa 305 Metros Azul',
      'Tecnologia da Informação',
      'CX',
      '480.00',
      '3',
      '20',
      'DOCA-TI-01',
      '6',
      '4',
      '2',
      '1',
      'LT-FUR-2026',
      '',
      'Condutores 100% cobre homologado Anatel'
    ]
  ];

  const delimiter = ';';
  const csvLines = [
    headers.join(delimiter),
    ...sampleRows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(delimiter))
  ];

  // Prepend UTF-8 BOM (\uFEFF) so Excel opens directly with correct Brazilian accents (ç, ã, é)
  return '\uFEFF' + csvLines.join('\r\n');
}

/**
 * Downloads the ready-to-use CSV template to the user's computer
 */
export function downloadProductCSVTemplate(): void {
  const content = generateProductCSVTemplate();
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `modelo_importacao_produtos_almoxplus_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface CSVParseResult {
  products: Array<{
    code: string;
    name: string;
    category: string;
    unit: string;
    unitPrice: number;
    minStock: number;
    maxStock: number;
    locationSlot: string;
    stockByBranch: Record<Branch, number>;
    batchNumber?: string;
    expirationDate?: string;
    description?: string;
  }>;
  totalRows: number;
  importedCount: number;
  warnings: string[];
  errors: string[];
}

/**
 * Parses CSV/TSV text file and extracts structured product records
 */
export function parseProductsCSV(csvText: string): CSVParseResult {
  const result: CSVParseResult = {
    products: [],
    totalRows: 0,
    importedCount: 0,
    warnings: [],
    errors: []
  };

  if (!csvText || !csvText.trim()) {
    result.errors.push('O arquivo informado está vazio.');
    return result;
  }

  // Strip UTF-8 BOM if present
  let cleanText = csvText.replace(/^\uFEFF/, '');

  // Detect line breaks
  const rawLines = cleanText.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
  if (rawLines.length < 2) {
    result.errors.push('O arquivo deve conter pelo menos a linha de cabeçalho e 1 linha de dados.');
    return result;
  }

  // Detect delimiter (; or , or \t)
  const firstLine = rawLines[0];
  const countSemicolon = (firstLine.match(/;/g) || []).length;
  const countComma = (firstLine.match(/,/g) || []).length;
  const countTab = (firstLine.match(/\t/g) || []).length;

  let delimiter = ';';
  if (countComma > countSemicolon && countComma > countTab) delimiter = ',';
  if (countTab > countSemicolon && countTab > countComma) delimiter = '\t';

  // Helper to parse CSV line respecting quotes
  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentField += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    fields.push(currentField.trim());
    return fields;
  };

  const headers = parseLine(rawLines[0]).map(h =>
    h.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
  );

  // Map canonical keys
  const keyAliases: Record<string, string[]> = {
    code: ['codigo', 'sku', 'cod', 'cod_produto', 'codigo_produto', 'item'],
    name: ['nome', 'descricao', 'nome_produto', 'descricao_resumida', 'material', 'produto'],
    category: ['categoria', 'grupo', 'familia', 'depto', 'departamento'],
    unit: ['unidade', 'un', 'unidade_medida', 'um', 'und'],
    unitPrice: ['preco', 'preco_unitario', 'valor', 'valor_unitario', 'custo', 'preco_medio', 'custo_medio'],
    minStock: ['estoque_minimo', 'minimo', 'min', 'est_min', 'ponto_pedido'],
    maxStock: ['estoque_maximo', 'maximo', 'max', 'est_max'],
    locationSlot: ['localizacao', 'prateleira', 'endereco', 'slot', 'posicao', 'local'],
    stock_sp: ['saldo_sp', 'estoque_sp', 'sp', 'quantidade_sp', 'qtd_sp'],
    stock_rj: ['saldo_rj', 'estoque_rj', 'rj', 'quantidade_rj', 'qtd_rj'],
    stock_bsb: ['saldo_bsb', 'estoque_bsb', 'bsb', 'quantidade_bsb', 'qtd_bsb', 'df'],
    stock_sjrp: ['saldo_sjrp', 'estoque_sjrp', 'sjrp', 'quantidade_sjrp', 'qtd_sjrp', 'riopreto'],
    batchNumber: ['lote', 'numero_lote', 'num_lote', 'batch'],
    expirationDate: ['validade', 'data_validade', 'vencimento', 'dt_validade', 'expiracao'],
    description: ['descricao_detalhada', 'especificacao', 'detalhes', 'obs', 'observacao', 'observacoes']
  };

  const headerIndexMap: Record<string, number> = {};
  for (const [canonicalKey, aliases] of Object.entries(keyAliases)) {
    const idx = headers.findIndex(h => aliases.includes(h) || aliases.some(a => h.startsWith(a)));
    if (idx !== -1) {
      headerIndexMap[canonicalKey] = idx;
    }
  }

  // Validate mandatory fields
  if (headerIndexMap['code'] === undefined) {
    result.errors.push('Coluna obrigatória não encontrada: "codigo" (ou "sku").');
  }
  if (headerIndexMap['name'] === undefined) {
    result.errors.push('Coluna obrigatória não encontrada: "nome" (ou "descricao").');
  }

  if (result.errors.length > 0) {
    return result;
  }

  const seenCodes = new Set<string>();
  result.totalRows = rawLines.length - 1;

  for (let lineIdx = 1; lineIdx < rawLines.length; lineIdx++) {
    const line = rawLines[lineIdx];
    if (!line.trim()) continue;

    const cells = parseLine(line);
    const getVal = (key: string): string => {
      const idx = headerIndexMap[key];
      return idx !== undefined && cells[idx] !== undefined ? cells[idx].trim() : '';
    };

    const rawCode = getVal('code');
    const rawName = getVal('name');

    if (!rawCode || !rawName) {
      result.warnings.push(`Linha ${lineIdx + 1}: Ignorada por não conter Código/SKU ou Nome.`);
      continue;
    }

    const cleanCode = rawCode.toUpperCase();
    if (seenCodes.has(cleanCode)) {
      result.warnings.push(`Linha ${lineIdx + 1}: Código SKU "${cleanCode}" duplicado no mesmo arquivo CSV. O registro anterior será preservado.`);
      continue;
    }
    seenCodes.add(cleanCode);

    // Parse numeric price (handle Brazilian comma)
    const rawPrice = getVal('unitPrice').replace(/R\$\s?/, '').replace(/\./g, '').replace(',', '.');
    const unitPrice = parseFloat(rawPrice) > 0 ? parseFloat(rawPrice) : 0;

    const rawMin = parseInt(getVal('minStock'), 10);
    const minStock = !isNaN(rawMin) && rawMin >= 0 ? rawMin : 10;

    const rawMax = parseInt(getVal('maxStock'), 10);
    const maxStock = !isNaN(rawMax) && rawMax >= minStock ? rawMax : Math.max(100, minStock * 5);

    // Parse branch stocks
    const parseQty = (key: string): number => {
      const v = parseInt(getVal(key), 10);
      return !isNaN(v) && v >= 0 ? v : 0;
    };

    const stockByBranch: Record<Branch, number> = {
      SP: parseQty('stock_sp'),
      RJ: parseQty('stock_rj'),
      BSB: parseQty('stock_bsb'),
      SJRP: parseQty('stock_sjrp')
    };

    // Parse date if present
    let expirationDate: string | undefined = undefined;
    const rawDate = getVal('expirationDate');
    if (rawDate) {
      // Check DD/MM/YYYY
      const brDateMatch = rawDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (brDateMatch) {
        const day = brDateMatch[1].padStart(2, '0');
        const month = brDateMatch[2].padStart(2, '0');
        const year = brDateMatch[3];
        expirationDate = `${year}-${month}-${day}`;
      } else {
        const isoMatch = rawDate.match(/^\d{4}-\d{2}-\d{2}$/);
        if (isoMatch) {
          expirationDate = rawDate;
        }
      }
    }

    result.products.push({
      code: cleanCode,
      name: rawName,
      category: getVal('category') || 'Geral',
      unit: (getVal('unit') || 'UN').toUpperCase(),
      unitPrice,
      minStock,
      maxStock,
      locationSlot: getVal('locationSlot') || 'PRAT-GERAL',
      stockByBranch,
      batchNumber: getVal('batchNumber') || undefined,
      expirationDate,
      description: getVal('description') || undefined
    });
  }

  result.importedCount = result.products.length;
  return result;
}
