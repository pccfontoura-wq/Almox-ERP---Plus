export type Branch = string;

export type UnitType = 'MATRIZ' | 'UNIDADE_OPERACIONAL' | 'CENTRO_DISTRIBUICAO' | 'ADMINISTRATIVA' | 'OBRA_PROJETO';

export interface BranchInfo {
  id: string;
  code: string; // Ex: 'SP', 'RJ', 'SJRP', 'BSB', 'MG', 'PR'
  name: string; // Ex: 'Unidade São Paulo (Matriz)'
  corporateName?: string; // Razão Social completa
  unitType?: UnitType;
  cnpj?: string;
  stateRegistration?: string; // Inscrição Estadual (IE)
  municipalRegistration?: string; // Inscrição Municipal (IM)
  zipCode?: string; // CEP
  street?: string; // Logradouro / Rua / Avenida
  number?: string; // Número
  complement?: string; // Complemento / Galpão / Sala
  neighborhood?: string; // Bairro / Distrito
  city: string; // Ex: 'São Paulo'
  state: string; // Ex: 'SP'
  address?: string; // Endereço completo consolidado
  managerName?: string;
  managerRole?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  operatingHours?: string;
  areaM2?: number;
  notes?: string;
  cnae?: string;
  referencePoint?: string;
  manager?: string;
  openingDate?: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type UserRole = 'Master' | 'Regular' | 'Visitante' | 'Almoxarife' | 'Comprador' | 'Gestor';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  branch: Branch;
  active: boolean;
  firstAccess?: boolean;
  isFirstAccess?: boolean;
  avatarUrl?: string;
  createdAt?: string;
  department?: string;
  phone?: string;
}

export interface ProductAttachment {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  category?: 'Ficha Técnica' | 'Certificado / Laudo' | 'Manual' | 'FISPQ' | 'Outro';
  dataUrl?: string;
}

export interface ProductBatch {
  batchNumber: string; // ex: "LT-2025/MED-01"
  expirationDate: string; // ex: "2026-08-14"
  branch?: Branch; // Filial específica ou 'GLOBAL'
  quantity?: number;
  notes?: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: 'UN' | 'KG' | 'M' | 'L' | 'CX' | 'PCT' | 'PAR' | 'ROLO' | string;
  stockByBranch: Record<Branch, number>;
  minStock: number;
  maxStock: number;
  unitPrice: number;
  locationSlot: string; // e.g. "PRAT-A1-S2"
  expirationDate?: string;
  batchNumber?: string; // Código do Lote (ex: "LT-2025/MED-01")
  batches?: ProductBatch[]; // Registro de lotes por unidade ou múltiplos lotes
  description?: string;
  attachments?: ProductAttachment[];
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type MovementType = 'ENTRADA' | 'SAIDA' | 'AJUSTE' | 'TRANSFERENCIA';

export interface Movement {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  type: MovementType;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  branch: Branch;
  costCenterId?: string;
  costCenterName?: string;
  responsibleUser: string;
  requestedBy?: string;
  notes?: string;
  date: string;
  documentNumber?: string;
}

export type TransferStatus = 'EM_TRANSITO' | 'CONCLUIDO' | 'CANCELADO';

export interface Transfer {
  id: string;
  code: string;
  originBranch: Branch;
  destinationBranch: Branch;
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  status: TransferStatus;
  sentBy?: string;
  sentAt: string;
  approvedBy?: string;
  requestedBy?: string;
  receivedBy?: string;
  receivedAt?: string;
  notes?: string;
}

export interface RequisitionItem {
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  requestedQuantity: number;
  fulfilledQuantity?: number;
  approvedQuantity?: number;
  notes?: string;
}

export type RequisitionStatus = 'PENDENTE' | 'APROVADO' | 'ATENDIDO' | 'REJEITADO';

export interface Requisition {
  id: string;
  code: string;
  branch: Branch;
  costCenterId: string;
  costCenterName: string;
  requestedBy: string;
  requestedByEmail?: string;
  items: RequisitionItem[];
  priority: 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';
  status: RequisitionStatus;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  fulfilledAt?: string;
  budgetOverrun?: boolean;
  budgetOverrunAmount?: number;
  budgetOverrunJustification?: string;
  budgetOverrunApprovedBy?: string;
  budgetOverrunApprovedAt?: string;
}

export type PurchaseRequestItemStatus = 'PENDENTE' | 'APROVADO' | 'REJEITADO' | 'CANCELADO';

export interface PurchaseRequestItem {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  quantity: number;
  estimatedUnitPrice?: number;
  status: PurchaseRequestItemStatus;
  generatedPurchaseOrderId?: string;
  generatedPurchaseOrderCode?: string;
  rejectionReason?: string;
  notes?: string;
  approvedAt?: string;
  approvedBy?: string;
  negotiatedUnitPrice?: number;
  supplierName?: string;
  isUnregistered?: boolean;
  category?: string;
  brandOrModel?: string;
}

export type PurchaseRequestStatus = 'PENDENTE' | 'PARCIALMENTE_ATENDIDA' | 'CONCLUIDA' | 'REJEITADA' | 'CANCELADA';

export interface PurchaseRequest {
  id: string;
  code: string; // e.g. SC-2026-001
  branch: Branch;
  costCenterId?: string;
  costCenterName?: string;
  department?: string;
  requestedBy: string;
  requestedByEmail?: string;
  priority: 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';
  justification: string;
  items: PurchaseRequestItem[];
  status: PurchaseRequestStatus;
  createdAt: string;
  updatedAt?: string;
  notes?: string;
  budgetOverrun?: boolean;
  budgetOverrunAmount?: number;
  budgetOverrunJustification?: string;
  budgetOverrunApprovedBy?: string;
  budgetOverrunApprovedAt?: string;
}

export interface PurchaseOrderItem {
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  purchaseRequestId?: string;
  purchaseRequestCode?: string;
  isUnregistered?: boolean;
  category?: string;
  brandOrModel?: string;
}

export type PurchaseOrderStatus = 'COTACAO' | 'AGUARDANDO_APROVACAO' | 'APROVADO' | 'EM_TRANSITO' | 'ENTREGUE' | 'CANCELADO';

export interface PurchaseOrder {
  id: string;
  code: string;
  branch: Branch;
  costCenterId?: string;
  costCenterName?: string;
  supplierName: string;
  supplierCnpj: string;
  items: PurchaseOrderItem[];
  totalValue: number;
  status: PurchaseOrderStatus;
  requestedBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  deliveredAt?: string;
  actualDeliveryDate?: string;
  estimatedDeliveryDate?: string;
  paymentTerms?: string;
  purchaseRequestId?: string;
  purchaseRequestCode?: string;
  budgetOverrun?: boolean;
  budgetOverrunAmount?: number;
  budgetOverrunJustification?: string;
  budgetOverrunApprovedBy?: string;
  budgetOverrunApprovedAt?: string;
}

export interface CostCenterProductBalance {
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  unitPrice: number;
  purchasedQty: number;
  deliveredQty: number;
  inStockForSectorQty: number;
  purchasedValue: number;
  deliveredValue: number;
  inStockForSectorValue: number;
}

export interface CostCenterComparison {
  id: string;
  costCenter: CostCenter;
  budget: number;
  totalPurchased: number; // Valor total adquirido em OCs/SCs
  totalDelivered: number; // Valor total baixado/consumido no almoxarifado
  stockWaitingConsumption: number; // Materiais comprados aguardando consumo (no estoque)
  remainingBudget: number; // Orçamento - Consumido (Orçamento Real Disponível)
  committedRemainingBudget: number; // Orçamento - Comprado (Comprometido)
  purchaseOrders: PurchaseOrder[];
  requisitions: Requisition[];
  movements: Movement[];
  productBalances: CostCenterProductBalance[];
}

export type AssetStatus = 'EM_USO' | 'EMPRESTADO' | 'EM_MANUTENCAO' | 'BAIXADO';

export interface AssetCustodyRecord {
  id: string;
  user: string;
  department?: string;
  borrowedDate: string;
  returnedDate?: string;
  expectedReturnDate?: string;
  notes?: string;
  returnedBy?: string;
  condition?: string;
}

export interface Asset {
  id: string;
  assetTag: string; // Tombamento
  name: string;
  category: string;
  branch: Branch;
  location: string;
  value: number;
  status: AssetStatus;
  responsibleUser?: string;
  borrowedTo?: string;
  borrowedToDepartment?: string;
  borrowedDate?: string;
  expectedReturnDate?: string;
  previousBorrower?: string; // Último Utilizador Anterior (Rastreabilidade)
  previousBorrowerDepartment?: string;
  lastReturnedDate?: string; // Data da Devolução pelo Último Utilizador
  custodyHistory?: AssetCustodyRecord[]; // Histórico completo de custódia e movimentações
  acquisitionDate?: string;
  serialNumber?: string;
  notes?: string;
  active?: boolean;
}

export interface InventoryAuditItem {
  productId: string;
  productCode: string;
  productName: string;
  systemQuantity: number;
  countedQuantity: number;
  divergence: number;
  divergenceValue?: number;
  unit?: string;
  notes?: string;
}

export interface InventoryAudit {
  id: string;
  code: string;
  branch: Branch;
  title: string;
  status: 'EM_ANDAMENTO' | 'CONCLUIDO';
  items: InventoryAuditItem[];
  startedAt: string;
  completedAt?: string;
  finishedAt?: string;
  auditorUser?: string;
  createdBy?: string;
  reconciledAt?: string;
  reconciledBy?: string;
  totalDivergenceCount: number;
  totalDivergenceValue: number;
}

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  branch: Branch;
  budget: number;
  spent: number;
  responsible: string;
  active: boolean;
}

export type AuditOperation = 'CRIAR' | 'ALTERAR' | 'EXCLUIR' | 'LOGIN' | 'TRANSFERIR' | 'RECONCILIAR' | 'RECURSO' | 'EDITAR' | 'COMPRAR' | 'INVENTARIAR' | 'CONFIGURACAO';

export interface AuditLog {
  id: string;
  timestamp: string;
  userId?: string;
  userEmail: string;
  userName: string;
  userRole?: UserRole;
  operation: AuditOperation;
  entity?: string;
  module?: string;
  targetId?: string;
  details: string;
  previousValue?: string | null;
  newValue?: string | null;
  branch: Branch | 'GLOBAL';
  ip?: string;
}

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  branch: Branch | 'GLOBAL';
  createdAt: string;
  read: boolean;
  linkModule?: string;
}

export type BudgetOverrunPolicyMode =
  | 'ALCADA_DIRETORIA_MASTER' // Opção 3: Bloqueio Condicional com Alçada da Diretoria / Master (Padrão Ativo)
  | 'BLOQUEIO_RIGIDO' // Opção 1: Hard Stop - Bloqueio Total sem exceções
  | 'INFORMATIVO_AVISO' // Opção 2: Informativo com Alerta (Sem Bloqueio)
  | 'TOLERANCIA_PERCENTUAL'; // Opção 4: Tolerância Percentual Parametrizada (Margem Flexível)

export type BudgetCalculationBasis =
  | 'COMPROMETIDO' // Base: Comprado (OCs emitidas + entregues)
  | 'CONSUMO_REAL' // Base: Entregue (Consumo efetivo no Almoxarifado)
  | 'AMBOS'; // Base: O mais restritivo entre Comprometido e Consumido

export interface CostCenterBudgetPolicy {
  mode: BudgetOverrunPolicyMode;
  calculationBasis: BudgetCalculationBasis;
  tolerancePercentage: number; // Ex: 0 (sem tolerância) ou 5, 10
  requireJustification: boolean; // Exige justificativa formal de estouro
  allowMasterOverride: boolean; // Usuário Master tem chave de alçada
  allowedApproverRoles: UserRole[]; // Roles com alçada extraordinária: ['Master'] ou ['Master', 'Gestor']
  notifyFinanceOnOverrun: boolean; // Notifica diretoria/financeiro automaticamente
  preventRequisitionExceeding: boolean; // Aplica regra também a solicitações e requisições
  updatedAt?: string;
  updatedBy?: string;
  updatedByEmail?: string;
  changeReason?: string;
}

export interface CostCenterBudgetCheckResult {
  allowed: boolean;
  isOverBudget: boolean;
  overrunAmount: number;
  overrunPercentage: number;
  budget: number;
  currentUsed: number;
  projectedUsed: number;
  remainingBudget: number;
  policyMode: BudgetOverrunPolicyMode;
  requiresSpecialApproval: boolean;
  warningMessage?: string;
  errorMessage?: string;
  costCenterName: string;
  costCenterCode: string;
}

export interface SystemSettings {
  companyName: string;
  cnpj: string;
  allowNegativeStock?: boolean;
  enableAutoPO?: boolean;
  enableEmailAlerts?: boolean;
  smtpServer?: string;
  smtpPort?: string;
  autoApproveRequisitionsBelow?: number;
  minStockAlertEnabled?: boolean;
  expirationDaysWarning?: number;
  requireTransferApproval?: boolean;
  emailNotificationsEnabled?: boolean;
  backupIntervalDays?: number;
  budgetPolicy?: CostCenterBudgetPolicy;
}

export type BackupScope = 'COMPLETO' | 'INVENTARIO_E_COMPRAS' | 'APENAS_INVENTARIO' | 'APENAS_COMPRAS';

export type BackupFrequency = 'A_CADA_6_HORAS' | 'DIARIO' | 'SEMANAL' | 'GATILHO_CRITICO';

export interface BackupRoutineConfig {
  enabled: boolean;
  frequency: BackupFrequency;
  scheduledTime: string; // e.g. '02:00'
  defaultScope: BackupScope;
  retentionLimit: number; // e.g. 10, 15, 30 snapshots
  autoBackupOnInventoryReconcile: boolean;
  autoBackupOnPurchaseOrderApproval: boolean;
  verifyIntegrityOnBackup: boolean;
  notifyOnSuccess: boolean;
  lastRunAt?: string;
  nextScheduledAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface BackupMetricsSummary {
  productsCount: number;
  movementsCount: number;
  transfersCount: number;
  requisitionsCount: number;
  inventoriesCount: number;
  purchaseRequestsCount: number;
  purchaseOrdersCount: number;
  costCentersCount: number;
  assetsCount: number;
  totalInventoryValue: number;
  totalPurchasesValue: number;
}

export interface BackupSnapshot {
  id: string;
  code: string; // e.g. BKP-20261001-0200
  createdAt: string;
  createdBy: string;
  createdByEmail?: string;
  triggerType: 'AUTOMATICO_AGENDADO' | 'MANUAL_SOB_DEMANDA' | 'GATILHO_OPERACIONAL' | 'PRE_RESTAURACAO';
  scope: BackupScope;
  notes?: string;
  sizeBytes: number;
  checksum: string;
  integrityVerified: boolean;
  metrics: BackupMetricsSummary;
  payload: Partial<AppState>;
}

export interface AppState {
  branches: BranchInfo[];
  products: Product[];
  movements: Movement[];
  transfers: Transfer[];
  requisitions: Requisition[];
  purchaseRequests: PurchaseRequest[];
  purchaseOrders: PurchaseOrder[];
  assets: Asset[];
  inventories: InventoryAudit[];
  costCenters: CostCenter[];
  users: User[];
  auditLogs: AuditLog[];
  notifications: SystemNotification[];
  backupConfig?: BackupRoutineConfig;
  backupSnapshots?: BackupSnapshot[];
}

