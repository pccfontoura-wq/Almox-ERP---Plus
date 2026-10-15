import { Product, User, CostCenter, Asset, Requisition, PurchaseRequest, PurchaseOrder, Transfer, InventoryAudit, AuditLog, SystemNotification, SystemSettings, BranchInfo } from '../types';

export const INITIAL_BRANCHES: BranchInfo[] = [
  {
    id: 'branch-sp',
    code: 'SP',
    name: 'Unidade São Paulo (Matriz)',
    corporateName: 'Almox Plus Tecnologia e Logística S.A. - Matriz',
    unitType: 'MATRIZ',
    cnpj: '12.345.678/0001-90',
    stateRegistration: '110.042.490.114',
    municipalRegistration: '4.892.104-8',
    zipCode: '01310-200',
    street: 'Av. Paulista',
    number: '1500',
    complement: '12º Andar, Conj. 121 e Galpão Logístico G1',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
    address: 'Av. Paulista, 1500 - 12º Andar, Conj. 121 - Bela Vista - São Paulo/SP - CEP 01310-200',
    managerName: 'Carlos Eduardo Silva',
    managerRole: 'Diretor de Operações e Suprimentos',
    phone: '(11) 3254-8900',
    whatsapp: '(11) 98765-4321',
    email: 'sp.matriz@almoxplus.com.br',
    operatingHours: 'Seg a Sex, 07:00 às 19:00 | Sáb, 08:00 às 12:00',
    areaM2: 4500,
    notes: 'Sede administrativa e centro de distribuição central. Recebimento pelas Docas 01 a 04.',
    active: true,
    createdAt: '2025-01-01T08:00:00Z'
  },
  {
    id: 'branch-rj',
    code: 'RJ',
    name: 'Unidade Rio de Janeiro',
    corporateName: 'Almox Plus Tecnologia e Logística S.A. - Unidade RJ',
    unitType: 'UNIDADE_OPERACIONAL',
    cnpj: '12.345.678/0002-71',
    stateRegistration: '78.451.230',
    municipalRegistration: '0.512.390-1',
    zipCode: '20040-009',
    street: 'Av. Rio Branco',
    number: '240',
    complement: 'Galpão Industrial B2',
    neighborhood: 'Centro',
    city: 'Rio de Janeiro',
    state: 'RJ',
    address: 'Av. Rio Branco, 240 - Galpão Industrial B2 - Centro - Rio de Janeiro/RJ - CEP 20040-009',
    managerName: 'Juliana Costa e Souza',
    managerRole: 'Coordenadora de Almoxarifado Regional',
    phone: '(21) 2240-5500',
    whatsapp: '(21) 99887-1122',
    email: 'rj.almox@almoxplus.com.br',
    operatingHours: 'Seg a Sex, 07:30 às 17:30',
    areaM2: 2200,
    notes: 'Atendimento às operações de manutenção predial e infraestrutura do estado do RJ.',
    active: true,
    createdAt: '2025-01-05T08:00:00Z'
  },
  {
    id: 'branch-sjrp',
    code: 'SJRP',
    name: 'Unidade São José do Rio Preto',
    corporateName: 'Almox Plus Tecnologia e Logística S.A. - CD Interior SP',
    unitType: 'CENTRO_DISTRIBUICAO',
    cnpj: '12.345.678/0003-52',
    stateRegistration: '647.189.002.110',
    municipalRegistration: '129.401-5',
    zipCode: '15080-000',
    street: 'Rodovia Washington Luís',
    number: 'KM 430',
    complement: 'Condomínio Logístico Norte - Módulo 08',
    neighborhood: 'Distrito Industrial',
    city: 'São José do Rio Preto',
    state: 'SP',
    address: 'Rodovia Washington Luís, KM 430 - Condomínio Logístico Norte, Módulo 08 - Distrito Industrial - São José do Rio Preto/SP - CEP 15080-000',
    managerName: 'Marcos Roberto Oliveira',
    managerRole: 'Supervisor de Logística Interior',
    phone: '(17) 3215-6700',
    whatsapp: '(17) 99123-4567',
    email: 'sjrp.logistica@almoxplus.com.br',
    operatingHours: 'Seg a Sex, 07:00 às 18:00',
    areaM2: 3100,
    notes: 'Hub logístico para abastecimento de obras e contratos no interior paulista e Triângulo Mineiro.',
    active: true,
    createdAt: '2025-01-10T08:00:00Z'
  },
  {
    id: 'branch-bsb',
    code: 'BSB',
    name: 'Unidade Brasília (Distrito Federal)',
    corporateName: 'Almox Plus Tecnologia e Logística S.A. - Unidade Centro-Oeste',
    unitType: 'UNIDADE_OPERACIONAL',
    cnpj: '12.345.678/0004-33',
    stateRegistration: '07.654.321/001-89',
    municipalRegistration: 'CF/DF 0765432100189',
    zipCode: '71200-030',
    street: 'SIA Trecho 3',
    number: 'Lotes 620/640',
    complement: 'Armazém 03',
    neighborhood: 'Zona Industrial (Guará)',
    city: 'Brasília',
    state: 'DF',
    address: 'SIA Trecho 3, Lotes 620/640 - Armazém 03 - Zona Industrial (Guará) - Brasília/DF - CEP 71200-030',
    managerName: 'Rodrigo Albuquerque',
    managerRole: 'Gestor de Suprimentos Centro-Oeste',
    phone: '(61) 3361-9000',
    whatsapp: '(61) 98450-9000',
    email: 'bsb.suprimentos@almoxplus.com.br',
    operatingHours: 'Seg a Sex, 08:00 às 18:00',
    areaM2: 1850,
    notes: 'Unidade estratégica de atendimento aos contratos corporativos do Centro-Oeste.',
    active: true,
    createdAt: '2025-01-15T08:00:00Z'
  }
];

export const INITIAL_USERS: User[] = [
  {
    id: 'user-master-1',
    name: 'Carlos Eduardo Silva',
    email: 'admin@almoxplus.com.br',
    password: 'senha123',
    role: 'Master',
    branch: 'SP',
    active: true,
    firstAccess: false,
    createdAt: '2025-01-10T08:00:00Z',
    department: 'Diretoria de Operações e Suprimentos',
    phone: '(11) 98765-4321',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'
  },
  {
    id: 'user-rj-1',
    name: 'Juliana Costa e Souza',
    email: 'juliana.rj@almoxplus.com.br',
    password: 'senha123',
    role: 'Regular',
    branch: 'RJ',
    active: true,
    firstAccess: false,
    createdAt: '2025-01-15T09:30:00Z',
    department: 'Almoxarifado Geral RJ',
    phone: '(21) 99887-1122'
  },
  {
    id: 'user-sjrp-1',
    name: 'Marcos Roberto Oliveira',
    email: 'marcos.sjrp@almoxplus.com.br',
    password: 'senha123',
    role: 'Regular',
    branch: 'SJRP',
    active: true,
    firstAccess: false,
    createdAt: '2025-01-20T10:15:00Z',
    department: 'Logística SJRP',
    phone: '(17) 99123-4567'
  },
  {
    id: 'user-sp-1',
    name: 'Fernanda Lima Mendes',
    email: 'fernanda.sp@almoxplus.com.br',
    password: 'senha123',
    role: 'Regular',
    branch: 'SP',
    active: true,
    firstAccess: false,
    createdAt: '2025-02-01T11:00:00Z',
    department: 'Gestão de Suprimentos SP',
    phone: '(11) 97112-3344'
  },
  {
    id: 'user-bsb-1',
    name: 'Rodrigo Albuquerque',
    email: 'rodrigo.bsb@almoxplus.com.br',
    password: 'senha123',
    role: 'Regular',
    branch: 'BSB',
    active: true,
    firstAccess: false,
    createdAt: '2025-02-05T14:20:00Z',
    department: 'Almoxarifado BSB',
    phone: '(61) 98111-2233'
  },
  {
    id: 'user-almoxarife-1',
    name: 'Lucas Mendes (Almoxarife)',
    email: 'lucas.almoxarife@almoxplus.com.br',
    password: 'senha123',
    role: 'Almoxarife',
    branch: 'SP',
    active: true,
    firstAccess: false,
    createdAt: '2025-02-08T08:30:00Z',
    department: 'Operações de Almoxarifado & Doca',
    phone: '(11) 97722-1100'
  },
  {
    id: 'user-comprador-1',
    name: 'Mariana Duarte (Compradora)',
    email: 'mariana.compras@almoxplus.com.br',
    password: 'senha123',
    role: 'Comprador',
    branch: 'SP',
    active: true,
    firstAccess: false,
    createdAt: '2025-02-09T09:00:00Z',
    department: 'Suprimentos, Cotações & Compras',
    phone: '(11) 98833-2211'
  },
  {
    id: 'user-gestor-1',
    name: 'Roberto Valença (Gestor)',
    email: 'roberto.gestor@almoxplus.com.br',
    password: 'senha123',
    role: 'Gestor',
    branch: 'SP',
    active: true,
    firstAccess: false,
    createdAt: '2025-02-10T10:00:00Z',
    department: 'Diretoria & Controladoria',
    phone: '(11) 99944-3322'
  },
  {
    id: 'user-visitor-1',
    name: 'Patricia Nogueira (Auditoria)',
    email: 'patricia.auditoria@almoxplus.com.br',
    password: 'senha123',
    role: 'Visitante',
    branch: 'SP',
    active: true,
    firstAccess: false,
    createdAt: '2025-02-10T16:00:00Z',
    department: 'Auditoria Externa',
    phone: '(11) 96554-3210'
  }
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-001',
    code: 'EPI-001',
    name: 'Capacete de Segurança Abafador Classe B',
    category: 'EPI & Segurança',
    unit: 'UN',
    minStock: 25,
    maxStock: 200,
    stockByBranch: { RJ: 45, SJRP: 12, SP: 85, BSB: 30 },
    unitPrice: 68.50,
    expirationDate: '2028-12-31',
    locationSlot: 'PRAT-A1-S1',
    description: 'Capacete de proteção em PEAD com suspensão de catraca e jugular em tecido.',
    active: true,
    createdAt: '2025-01-10T08:00:00Z',
    updatedAt: '2025-08-01T10:00:00Z'
  },
  {
    id: 'prod-002',
    code: 'EPI-002',
    name: 'Luva de Vaqueta Cano Curto Tam G',
    category: 'EPI & Segurança',
    unit: 'PAR',
    minStock: 50,
    maxStock: 500,
    stockByBranch: { RJ: 8, SJRP: 120, SP: 310, BSB: 65 }, // RJ is below minStock!
    unitPrice: 24.90,
    expirationDate: '2027-06-30',
    locationSlot: 'PRAT-A1-S3',
    description: 'Luva de proteção confeccionada em couro bovino vaqueta macia com reforço interno.',
    active: true,
    createdAt: '2025-01-10T08:30:00Z',
    updatedAt: '2025-08-02T11:15:00Z'
  },
  {
    id: 'prod-003',
    code: 'INF-001',
    name: 'Cabo de Rede UTP Cat6 Furukawa (Caixa 305m)',
    category: 'Informática & TI',
    unit: 'CX',
    minStock: 5,
    maxStock: 30,
    stockByBranch: { RJ: 6, SJRP: 4, SP: 18, BSB: 3 }, // SJRP & BSB below minStock!
    unitPrice: 780.00,
    locationSlot: 'PRAT-B2-S1',
    description: 'Cabo de rede par trançado 4 pares 24AWG 100% cobre homologado Anatel.',
    active: true,
    createdAt: '2025-01-12T09:00:00Z',
    updatedAt: '2025-07-28T14:00:00Z'
  },
  {
    id: 'prod-004',
    code: 'INF-002',
    name: 'Nobreak Senoidal 1500VA Bivolt SMS',
    category: 'Informática & TI',
    unit: 'UN',
    minStock: 4,
    maxStock: 20,
    stockByBranch: { RJ: 5, SJRP: 6, SP: 12, BSB: 4 },
    unitPrice: 1450.00,
    locationSlot: 'PRAT-B2-S4',
    description: 'Nobreak para proteção de servidores e equipamentos de missão crítica.',
    active: true,
    createdAt: '2025-01-12T10:00:00Z',
    updatedAt: '2025-07-29T16:20:00Z'
  },
  {
    id: 'prod-005',
    code: 'MAT-001',
    name: 'Papel A4 Report 75g Alvo (Caixa 10 Reams)',
    category: 'Material de Escritório',
    unit: 'CX',
    minStock: 15,
    maxStock: 150,
    stockByBranch: { RJ: 32, SJRP: 48, SP: 110, BSB: 22 },
    unitPrice: 225.00,
    locationSlot: 'PRAT-C1-S1',
    description: 'Caixa com 10 liame/reams de 500 folhas de papel sulfite A4 alcalino.',
    active: true,
    createdAt: '2025-01-05T08:00:00Z',
    updatedAt: '2025-08-03T09:00:00Z'
  },
  {
    id: 'prod-006',
    code: 'QUI-001',
    name: 'Álcool Isopropílico 99,8% Galão 5 Litros',
    category: 'Produtos Químicos & Limpeza',
    unit: 'UN',
    minStock: 10,
    maxStock: 60,
    stockByBranch: { RJ: 14, SJRP: 8, SP: 25, BSB: 2 }, // BSB below min!
    unitPrice: 115.00,
    expirationDate: '2026-08-25', // Expiring soon!
    locationSlot: 'PRAT-D3-S2',
    description: 'Solvente de alta pureza para limpeza de componentes eletrônicos e placas.',
    active: true,
    createdAt: '2025-01-15T11:00:00Z',
    updatedAt: '2025-08-01T08:00:00Z'
  },
  {
    id: 'prod-007',
    code: 'MAN-001',
    name: 'Disjuntor Bipolar Din 32A 3kA Schneider',
    category: 'Manutenção Elétrica',
    unit: 'UN',
    minStock: 20,
    maxStock: 150,
    stockByBranch: { RJ: 35, SJRP: 42, SP: 88, BSB: 18 }, // BSB below min
    unitPrice: 42.00,
    locationSlot: 'PRAT-E1-S2',
    description: 'Disjuntor termomagnético para proteção de circuitos residenciais e comerciais.',
    active: true,
    createdAt: '2025-01-18T13:00:00Z',
    updatedAt: '2025-07-30T10:00:00Z'
  },
  {
    id: 'prod-008',
    code: 'MAN-002',
    name: 'Fita Isolante 3M Imperial 18mm x 20m',
    category: 'Manutenção Elétrica',
    unit: 'ROLO',
    minStock: 50,
    maxStock: 400,
    stockByBranch: { RJ: 110, SJRP: 140, SP: 290, BSB: 85 },
    unitPrice: 9.80,
    locationSlot: 'PRAT-E1-S4',
    description: 'Fita isolante antichama de PVC com alta flexibilidade e excelente aderência.',
    active: true,
    createdAt: '2025-01-18T14:00:00Z',
    updatedAt: '2025-08-02T15:00:00Z'
  },
  {
    id: 'prod-009',
    code: 'FER-001',
    name: 'Jogo de Chaves de Fenda e Philips Isoladas 1000V (7 Pçs)',
    category: 'Ferramentas',
    unit: 'CX',
    minStock: 6,
    maxStock: 40,
    stockByBranch: { RJ: 12, SJRP: 8, SP: 24, BSB: 9 },
    unitPrice: 189.90,
    locationSlot: 'PRAT-F2-S1',
    description: 'Jogo de chaves profissionais com isolamento VDE conforme norma NR-10.',
    active: true,
    createdAt: '2025-01-22T15:00:00Z',
    updatedAt: '2025-07-25T11:00:00Z'
  },
  {
    id: 'prod-010',
    code: 'MED-001',
    name: 'Kit de Primeiros SocorrosNR-7 Completo',
    category: 'Saúde & Medicina',
    unit: 'UN',
    minStock: 10,
    maxStock: 50,
    stockByBranch: { RJ: 15, SJRP: 11, SP: 32, BSB: 8 }, // BSB below min
    unitPrice: 240.00,
    expirationDate: '2026-08-15', // Expiring soon
    locationSlot: 'PRAT-G1-S1',
    description: 'Maleta em ABS equipada conforme diretrizes do Ministério do Trabalho.',
    active: true,
    createdAt: '2025-02-01T09:00:00Z',
    updatedAt: '2025-08-01T14:30:00Z'
  }
];

export const INITIAL_COST_CENTERS: CostCenter[] = [
  {
    id: 'cc-101',
    code: 'CC-101',
    name: 'Operações e Logística',
    branch: 'SP',
    budget: 250000.00,
    spent: 142300.00,
    responsible: 'Carlos Eduardo Silva',
    active: true
  },
  {
    id: 'cc-102',
    code: 'CC-102',
    name: 'Manutenção Infraestrutura RJ',
    branch: 'RJ',
    budget: 180000.00,
    spent: 98450.00,
    responsible: 'Juliana Costa',
    active: true
  },
  {
    id: 'cc-103',
    code: 'CC-103',
    name: 'Tecnologia da Informação',
    branch: 'SP',
    budget: 320000.00,
    spent: 215600.00,
    responsible: 'Fernanda Mendes',
    active: true
  },
  {
    id: 'cc-104',
    code: 'CC-104',
    name: 'Manutenção e Campo SJRP',
    branch: 'SJRP',
    budget: 120000.00,
    spent: 64200.00,
    responsible: 'Marcos Roberto',
    active: true
  },
  {
    id: 'cc-105',
    code: 'CC-105',
    name: 'Suporte Administrativo BSB',
    branch: 'BSB',
    budget: 110000.00,
    spent: 72100.00,
    responsible: 'Rodrigo Albuquerque',
    active: true
  }
];

export const INITIAL_TRANSFERS: Transfer[] = [
  {
    id: 'trans-001',
    code: 'TRF-2025-089',
    originBranch: 'SP',
    destinationBranch: 'RJ',
    productId: 'prod-002',
    productCode: 'EPI-002',
    productName: 'Luva de Vaqueta Cano Curto Tam G',
    quantity: 40,
    status: 'EM_TRANSITO',
    requestedBy: 'Juliana Costa e Souza',
    approvedBy: 'Carlos Eduardo Silva',
    sentAt: '2025-08-03T14:30:00Z',
    notes: 'Transferência de emergência devido ao estoque crítico na unidade RJ.'
  },
  {
    id: 'trans-002',
    code: 'TRF-2025-088',
    originBranch: 'SP',
    destinationBranch: 'BSB',
    productId: 'prod-003',
    productCode: 'INF-001',
    productName: 'Cabo de Rede UTP Cat6 Furukawa (Caixa 305m)',
    quantity: 5,
    status: 'EM_TRANSITO',
    requestedBy: 'Rodrigo Albuquerque',
    approvedBy: 'Carlos Eduardo Silva',
    sentAt: '2025-08-02T10:00:00Z',
    notes: 'Atendimento de expansão da rede em Brasília.'
  },
  {
    id: 'trans-003',
    code: 'TRF-2025-085',
    originBranch: 'SJRP',
    destinationBranch: 'SP',
    productId: 'prod-001',
    productCode: 'EPI-001',
    productName: 'Capacete de Segurança Abafador Classe B',
    quantity: 20,
    status: 'CONCLUIDO',
    requestedBy: 'Fernanda Mendes',
    approvedBy: 'Marcos Roberto',
    receivedBy: 'Fernanda Mendes',
    sentAt: '2025-07-28T09:00:00Z',
    receivedAt: '2025-07-29T16:00:00Z',
    notes: 'Devolução de excedente de projeto concluído.'
  }
];

export const INITIAL_REQUISITIONS: Requisition[] = [
  {
    id: 'req-101',
    code: 'SOL-2025-142',
    branch: 'RJ',
    costCenterId: 'cc-102',
    costCenterName: 'Manutenção Infraestrutura RJ',
    requestedBy: 'Juliana Costa e Souza',
    requestedByEmail: 'juliana.rj@almoxplus.com.br',
    status: 'PENDENTE',
    priority: 'ALTA',
    items: [
      {
        productId: 'prod-002',
        productCode: 'EPI-002',
        productName: 'Luva de Vaqueta Cano Curto Tam G',
        unit: 'PAR',
        requestedQuantity: 30,
        notes: 'Equipe de manutenção preventiva campo.'
      },
      {
        productId: 'prod-008',
        productCode: 'MAN-002',
        productName: 'Fita Isolante 3M Imperial 18mm x 20m',
        unit: 'ROLO',
        requestedQuantity: 20
      }
    ],
    createdAt: '2025-08-04T09:15:00Z'
  },
  {
    id: 'req-102',
    code: 'SOL-2025-140',
    branch: 'SP',
    costCenterId: 'cc-103',
    costCenterName: 'Tecnologia da Informação',
    requestedBy: 'Fernanda Mendes',
    requestedByEmail: 'fernanda.sp@almoxplus.com.br',
    status: 'APROVADO',
    priority: 'MEDIA',
    items: [
      {
        productId: 'prod-004',
        productCode: 'INF-002',
        productName: 'Nobreak Senoidal 1500VA Bivolt SMS',
        unit: 'UN',
        requestedQuantity: 2,
        approvedQuantity: 2
      }
    ],
    createdAt: '2025-08-02T11:00:00Z',
    approvedAt: '2025-08-02T15:30:00Z',
    approvedBy: 'Carlos Eduardo Silva'
  }
];

export const INITIAL_PURCHASE_REQUESTS: PurchaseRequest[] = [
  {
    id: 'req-buy-001',
    code: 'SC-2026-042',
    branch: 'RJ',
    costCenterId: 'cc-102',
    costCenterName: 'Manutenção Infraestrutura RJ',
    department: 'Manutenção e Obras',
    requestedBy: 'Juliana Costa e Souza',
    requestedByEmail: 'juliana.rj@almoxplus.com.br',
    priority: 'ALTA',
    justification: 'Reposição urgente de itens de segurança e consumo elétrico para os novos contratos de campo.',
    status: 'PENDENTE',
    createdAt: '2026-08-20T10:30:00Z',
    items: [
      {
        id: 'sc-item-1',
        productId: 'prod-001',
        productCode: 'EPI-001',
        productName: 'Capacete de Segurança Abafador Classe B',
        unit: 'UN',
        quantity: 50,
        estimatedUnitPrice: 68.50,
        status: 'PENDENTE',
        notes: 'Capacetes com jugular e abafador para nova equipe'
      },
      {
        id: 'sc-item-2',
        productId: 'prod-007',
        productCode: 'MAN-001',
        productName: 'Disjuntor Bipolar Din 32A 3kA Schneider',
        unit: 'UN',
        quantity: 40,
        estimatedUnitPrice: 42.00,
        status: 'PENDENTE',
        notes: 'Quadros elétricos dos galpões A e B'
      },
      {
        id: 'sc-item-3',
        productId: 'prod-008',
        productCode: 'MAN-002',
        productName: 'Fita Isolante 3M Imperial 18mm x 20m',
        unit: 'ROLO',
        quantity: 100,
        estimatedUnitPrice: 8.90,
        status: 'PENDENTE',
        notes: 'Uso contínuo das oficinas'
      }
    ]
  },
  {
    id: 'req-buy-002',
    code: 'SC-2026-039',
    branch: 'SP',
    costCenterId: 'cc-103',
    costCenterName: 'Tecnologia da Informação',
    department: 'TI & Infraestrutura',
    requestedBy: 'Fernanda Mendes',
    requestedByEmail: 'fernanda.sp@almoxplus.com.br',
    priority: 'MEDIA',
    justification: 'Aquisição de infraestrutura para cabeamento estruturado e nobreaks da nova sala de servidores.',
    status: 'PARCIALMENTE_ATENDIDA',
    createdAt: '2026-08-15T14:00:00Z',
    items: [
      {
        id: 'sc-item-4',
        productId: 'prod-003',
        productCode: 'INF-001',
        productName: 'Cabo de Rede UTP Cat6 Furukawa (Caixa 305m)',
        unit: 'CX',
        quantity: 10,
        estimatedUnitPrice: 750.00,
        status: 'APROVADO',
        generatedPurchaseOrderId: 'po-502',
        generatedPurchaseOrderCode: 'OC-2025-095',
        supplierName: 'Furukawa Electric LatAm S/A',
        negotiatedUnitPrice: 750.00,
        approvedAt: '2026-08-16T09:00:00Z',
        approvedBy: 'Carlos Eduardo Silva',
        notes: 'Homologado com fornecedor Furukawa'
      },
      {
        id: 'sc-item-5',
        productId: 'prod-004',
        productCode: 'INF-002',
        productName: 'Nobreak Senoidal 1500VA Bivolt SMS',
        unit: 'UN',
        quantity: 5,
        estimatedUnitPrice: 1450.00,
        status: 'PENDENTE',
        notes: 'Aguardando 3ª cotação'
      }
    ]
  }
];

export const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: 'po-501',
    code: 'OC-2025-098',
    branch: 'RJ',
    costCenterId: 'cc-102',
    costCenterName: 'Manutenção Infraestrutura RJ',
    supplierName: 'Proteção & Cia Distribuidora de EPIs Ltda',
    supplierCnpj: '12.345.678/0001-90',
    status: 'AGUARDANDO_APROVACAO',
    items: [
      {
        productId: 'prod-002',
        productCode: 'EPI-002',
        productName: 'Luva de Vaqueta Cano Curto Tam G',
        unit: 'PAR',
        quantity: 200,
        unitPrice: 22.50,
        totalPrice: 4500.00
      }
    ],
    totalValue: 4500.00,
    requestedBy: 'Juliana Costa e Souza',
    createdAt: '2025-08-03T16:00:00Z',
    estimatedDeliveryDate: '2025-08-15',
    paymentTerms: '28 dias faturado'
  },
  {
    id: 'po-502',
    code: 'OC-2025-095',
    branch: 'SP',
    costCenterId: 'cc-103',
    costCenterName: 'Tecnologia da Informação',
    purchaseRequestId: 'req-buy-002',
    purchaseRequestCode: 'SC-2026-039',
    supplierName: 'Furukawa Electric LatAm S/A',
    supplierCnpj: '43.210.987/0001-12',
    status: 'EM_TRANSITO',
    items: [
      {
        productId: 'prod-003',
        productCode: 'INF-001',
        productName: 'Cabo de Rede UTP Cat6 Furukawa (Caixa 305m)',
        unit: 'CX',
        quantity: 10,
        unitPrice: 750.00,
        totalPrice: 7500.00
      }
    ],
    totalValue: 7500.00,
    requestedBy: 'Fernanda Mendes',
    approvedBy: 'Carlos Eduardo Silva',
    createdAt: '2025-07-25T10:00:00Z',
    approvedAt: '2025-07-26T08:30:00Z',
    estimatedDeliveryDate: '2025-08-06',
    paymentTerms: '30/60 dias'
  },
  {
    id: 'po-503',
    code: 'OC-2025-092',
    branch: 'SP',
    costCenterId: 'cc-101',
    costCenterName: 'Operações e Logística',
    supplierName: 'LogiEquip Máquinas e Embalagens',
    supplierCnpj: '22.333.444/0001-55',
    status: 'ENTREGUE',
    items: [
      {
        productId: 'prod-005',
        productCode: 'LOG-001',
        productName: 'Paleteira Manual Hidráulica 2500kg Roda Dupla',
        unit: 'UN',
        quantity: 2,
        unitPrice: 1850.00,
        totalPrice: 3700.00
      }
    ],
    totalValue: 3700.00,
    requestedBy: 'Carlos Eduardo Silva',
    approvedBy: 'Carlos Eduardo Silva',
    createdAt: '2025-07-10T09:00:00Z',
    approvedAt: '2025-07-11T14:00:00Z',
    deliveredAt: '2025-07-18T10:00:00Z',
    paymentTerms: '14 dias faturado'
  }
];

export const INITIAL_ASSETS: Asset[] = [
  {
    id: 'asset-001',
    assetTag: 'PAT-SP-0412',
    name: 'Analisador de Qualidade de Energia Fluke 435 II',
    category: 'Instrumentação & Medição',
    branch: 'SP',
    location: 'Laboratório Elétrico SP - Sala 104',
    value: 48500.00,
    status: 'EMPRESTADO',
    borrowedTo: 'Eng. Ricardo Vasconcelos',
    borrowedToDepartment: 'Engenharia de Campo',
    borrowedDate: '2025-07-20',
    expectedReturnDate: '2025-08-10',
    previousBorrower: 'Téc. Lucas Marcondes',
    previousBorrowerDepartment: 'Manutenção Predial SP',
    lastReturnedDate: '2025-07-15',
    custodyHistory: [
      {
        id: 'cust-1',
        user: 'Téc. Lucas Marcondes',
        department: 'Manutenção Predial SP',
        borrowedDate: '2025-06-01',
        returnedDate: '2025-07-15',
        notes: 'Devolvido com estojo e cabos completos.',
        returnedBy: 'Carlos Eduardo Silva',
        condition: 'Perfeito Estado'
      },
      {
        id: 'cust-2',
        user: 'Eng. Ricardo Vasconcelos',
        department: 'Engenharia de Campo',
        borrowedDate: '2025-07-20',
        expectedReturnDate: '2025-08-10',
        notes: 'Auditoria técnica no cliente Votorantim.'
      }
    ],
    acquisitionDate: '2023-05-15',
    serialNumber: 'FLK-4352-998812',
    notes: 'Equipamento de alta precisão com calibração RBC válida.',
    active: true
  },
  {
    id: 'asset-002',
    assetTag: 'PAT-RJ-0189',
    name: 'Máquina de Solda Inversora Bambozzi 250A',
    category: 'Máquinas & Equipamentos',
    branch: 'RJ',
    location: 'Oficina de Manutenção RJ',
    value: 3800.00,
    status: 'EM_USO',
    previousBorrower: 'Marcos Antônio Ribeiro',
    previousBorrowerDepartment: 'Serralheria & Estruturas RJ',
    lastReturnedDate: '2025-07-28',
    custodyHistory: [
      {
        id: 'cust-3',
        user: 'Marcos Antônio Ribeiro',
        department: 'Serralheria & Estruturas RJ',
        borrowedDate: '2025-07-10',
        returnedDate: '2025-07-28',
        notes: 'Utilizado na reforma e montagem dos racks de estoque.',
        returnedBy: 'Juliana Costa e Souza',
        condition: 'Bom Estado de Conservação'
      }
    ],
    acquisitionDate: '2024-02-10',
    serialNumber: 'BMZ-250-771',
    active: true
  },
  {
    id: 'asset-003',
    assetTag: 'PAT-SJRP-0055',
    name: 'Empilhadeira Elétrica Patolada Still 1.6T',
    category: 'Veículos & Movimentação',
    branch: 'SJRP',
    location: 'Galpão Principal SJRP',
    value: 125000.00,
    status: 'EM_MANUTENCAO',
    previousBorrower: 'Operador Roberto Dias',
    previousBorrowerDepartment: 'Logística & Expedição SJRP',
    lastReturnedDate: '2025-08-01',
    custodyHistory: [
      {
        id: 'cust-4',
        user: 'Operador Roberto Dias',
        department: 'Logística & Expedição SJRP',
        borrowedDate: '2025-05-10',
        returnedDate: '2025-08-01',
        notes: 'Apresentou estalo na torre hidráulica de elevação durante o turno B.',
        returnedBy: 'Rodrigo Lima',
        condition: 'Com Avaria Mecânica'
      }
    ],
    acquisitionDate: '2022-11-01',
    serialNumber: 'STL-1600-3341',
    notes: 'Em revisão preventiva do sistema hidráulico com garantia contratual.',
    active: true
  },
  {
    id: 'asset-004',
    assetTag: 'PAT-BSB-0082',
    name: 'Notebook Dell Latitude 5430 i7 16GB 512GB SSD',
    category: 'Tecnologia da Informação',
    branch: 'BSB',
    location: 'Escritório Administrativo BSB',
    value: 6200.00,
    status: 'EMPRESTADO',
    borrowedTo: 'Patrícia Alcantara',
    borrowedToDepartment: 'Controladoria & Finanças',
    borrowedDate: '2025-08-01',
    expectedReturnDate: '2025-12-20',
    previousBorrower: 'Fernando Gusmão',
    previousBorrowerDepartment: 'Auditoria Interna BSB',
    lastReturnedDate: '2025-07-30',
    custodyHistory: [
      {
        id: 'cust-5',
        user: 'Fernando Gusmão',
        department: 'Auditoria Interna BSB',
        borrowedDate: '2025-03-01',
        returnedDate: '2025-07-30',
        notes: 'Devolvido após encerramento do ciclo de auditoria fiscal.',
        returnedBy: 'Amanda Souza',
        condition: 'Perfeito Estado'
      },
      {
        id: 'cust-6',
        user: 'Patrícia Alcantara',
        department: 'Controladoria & Finanças',
        borrowedDate: '2025-08-01',
        expectedReturnDate: '2025-12-20',
        notes: 'Equipamento para fechamento contábil e orçamentário anual.'
      }
    ],
    acquisitionDate: '2024-01-10',
    serialNumber: 'DELL-LAT-88219',
    active: true
  }
];

export const INITIAL_INVENTORIES: InventoryAudit[] = [
  {
    id: 'inv-001',
    code: 'INV-2025-Q2-RJ',
    branch: 'RJ',
    title: 'Inventário Físico Trimestral Q2 - Unidade RJ',
    status: 'CONCLUIDO',
    createdBy: 'Juliana Costa e Souza',
    startedAt: '2025-06-28T08:00:00Z',
    finishedAt: '2025-06-28T17:30:00Z',
    reconciledAt: '2025-06-29T09:00:00Z',
    reconciledBy: 'Carlos Eduardo Silva',
    totalDivergenceCount: 2,
    totalDivergenceValue: -120.00,
    items: [
      {
        productId: 'prod-001',
        productCode: 'EPI-001',
        productName: 'Capacete de Segurança Abafador Classe B',
        unit: 'UN',
        systemQuantity: 45,
        countedQuantity: 45,
        divergence: 0,
        divergenceValue: 0
      },
      {
        productId: 'prod-002',
        productCode: 'EPI-002',
        productName: 'Luva de Vaqueta Cano Curto Tam G',
        unit: 'PAR',
        systemQuantity: 10,
        countedQuantity: 8,
        divergence: -2,
        divergenceValue: -49.80,
        notes: 'Avarias descartadas sem baixa no sistema.'
      }
    ]
  }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-001',
    userId: 'user-master-1',
    userName: 'Carlos Eduardo Silva',
    userEmail: 'admin@almoxplus.com.br',
    operation: 'CRIAR',
    module: 'Almoxarifado',
    previousValue: null,
    newValue: 'Produto EPI-001 cadastrado com sucesso.',
    branch: 'SP',
    timestamp: '2025-08-04T08:00:00Z',
    ip: '189.120.45.10',
    details: 'Inclusão de novo item na categoria EPI & Segurança.'
  },
  {
    id: 'log-002',
    userId: 'user-rj-1',
    userName: 'Juliana Costa e Souza',
    userEmail: 'juliana.rj@almoxplus.com.br',
    operation: 'TRANSFERIR',
    module: 'Transferências',
    previousValue: 'Pendente',
    newValue: 'Em trânsito (40x Luva Vaqueta SP -> RJ)',
    branch: 'RJ',
    timestamp: '2025-08-03T14:30:00Z',
    ip: '177.100.88.23',
    details: 'Solicitação de transferência entre unidades devido a estoque crítico.'
  }
];

export const INITIAL_NOTIFICATIONS: SystemNotification[] = [
  {
    id: 'notif-001',
    title: 'Estoque Crítico (Abaixo do Mínimo)',
    message: 'A unidade RJ está com apenas 8 unidades de Luva de Vaqueta (Mínimo: 50).',
    type: 'WARNING',
    read: false,
    createdAt: '2025-08-04T08:00:00Z',
    branch: 'RJ',
    linkModule: 'Almoxarifado'
  },
  {
    id: 'notif-002',
    title: 'Transferência em Trânsito',
    message: 'Transferência TRF-2025-089 enviada de SP para RJ. Confirme o recebimento ao chegar.',
    type: 'INFO',
    read: false,
    createdAt: '2025-08-03T14:30:00Z',
    branch: 'RJ',
    linkModule: 'Transferencias'
  },
  {
    id: 'notif-003',
    title: 'Produto Próximo da Validade',
    message: 'Álcool Isopropílico 5L (Unidade BSB) vence em 25/08/2026.',
    type: 'WARNING',
    read: false,
    createdAt: '2025-08-02T10:00:00Z',
    branch: 'BSB',
    linkModule: 'Almoxarifado'
  }
];

export const INITIAL_SETTINGS: SystemSettings = {
  companyName: 'Almox Plus Tecnologia e Logística S.A.',
  cnpj: '10.987.654/0001-32',
  autoApproveRequisitionsBelow: 500.00,
  minStockAlertEnabled: true,
  expirationDaysWarning: 30,
  requireTransferApproval: true,
  emailNotificationsEnabled: true,
  backupIntervalDays: 7
};
