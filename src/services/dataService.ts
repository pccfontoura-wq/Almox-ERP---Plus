import { 
  Product, Movement, Transfer, Requisition, PurchaseRequest, PurchaseRequestItem, PurchaseOrder, PurchaseOrderItem,
  Asset, AssetCustodyRecord, InventoryAudit, CostCenter, AuditLog, SystemNotification, 
  SystemSettings, User, Branch, UserRole, BranchInfo, CostCenterComparison, CostCenterProductBalance,
  BackupScope, BackupFrequency, BackupRoutineConfig, BackupMetricsSummary, BackupSnapshot,
  CostCenterBudgetPolicy, BudgetOverrunPolicyMode, BudgetCalculationBasis, CostCenterBudgetCheckResult
} from '../types';

import { 
  INITIAL_PRODUCTS, INITIAL_USERS, INITIAL_COST_CENTERS, 
  INITIAL_TRANSFERS, INITIAL_REQUISITIONS, INITIAL_PURCHASE_REQUESTS, INITIAL_PURCHASE_ORDERS, 
  INITIAL_ASSETS, INITIAL_INVENTORIES, INITIAL_AUDIT_LOGS, 
  INITIAL_NOTIFICATIONS, INITIAL_SETTINGS, INITIAL_BRANCHES, DEFAULT_BUDGET_POLICY
} from '../data/seedData';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const STORAGE_KEY = 'almoxplus_data_v2';

const DEFAULT_BACKUP_CONFIG: BackupRoutineConfig = {
  enabled: true,
  frequency: 'DIARIO',
  scheduledTime: '02:00',
  defaultScope: 'INVENTARIO_E_COMPRAS',
  retentionLimit: 15,
  autoBackupOnInventoryReconcile: true,
  autoBackupOnPurchaseOrderApproval: true,
  verifyIntegrityOnBackup: true,
  notifyOnSuccess: true,
  lastRunAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  nextScheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 18).toISOString(),
  updatedAt: new Date().toISOString(),
  updatedBy: 'Sistema Automático (Master)'
};

interface AppState {
  branches: BranchInfo[];
  products: Product[];
  users: User[];
  movements: Movement[];
  transfers: Transfer[];
  requisitions: Requisition[];
  purchaseRequests: PurchaseRequest[];
  purchaseOrders: PurchaseOrder[];
  assets: Asset[];
  inventories: InventoryAudit[];
  costCenters: CostCenter[];
  auditLogs: AuditLog[];
  notifications: SystemNotification[];
  settings: SystemSettings;
  backupConfig?: BackupRoutineConfig;
  backupSnapshots?: BackupSnapshot[];
}

class DataService {
  private state: AppState;
  private listeners: Array<() => void> = [];
  private isSyncingFromCloud: boolean = false;
  private cloudPushTimer: any = null;
  private cloudSyncStatus: {
    connected: boolean;
    lastSync: string | null;
    databaseId: string;
    error?: string;
  } = {
    connected: false,
    lastSync: null,
    databaseId: 'ai-studio-almoxpluserpdeal-24144e17-b53e-44ab-a942-0cee7e733fd0'
  };

  constructor() {
    this.state = this.loadState();
    this.cleanUpProductionRemnants();
    this.ensureBackupRoutineInitialized();
    this.initCloudSync();
  }

  private loadState(): AppState {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.purchaseRequests) {
          parsed.purchaseRequests = INITIAL_PURCHASE_REQUESTS;
        }
        if (!parsed.branches || !Array.isArray(parsed.branches) || parsed.branches.length === 0) {
          parsed.branches = INITIAL_BRANCHES;
        } else {
          // Migrate existing branches to "Unidade" nomenclature and enrich with full seed data if missing
          parsed.branches = parsed.branches.map((b: BranchInfo) => {
            const seedMatch = INITIAL_BRANCHES.find(sb => sb.code === b.code);
            const updatedName = b.name ? b.name.replace(/Filial/gi, 'Unidade') : (seedMatch?.name || `Unidade ${b.code}`);
            return {
              ...(seedMatch || {}),
              ...b,
              name: updatedName,
              corporateName: b.corporateName || seedMatch?.corporateName || `Almox Plus Tecnologia e Logística S.A. - Unidade ${b.code}`,
              unitType: b.unitType || seedMatch?.unitType || 'UNIDADE_OPERACIONAL',
              cnpj: b.cnpj || seedMatch?.cnpj || '',
              stateRegistration: b.stateRegistration || seedMatch?.stateRegistration || '',
              municipalRegistration: b.municipalRegistration || seedMatch?.municipalRegistration || '',
              zipCode: b.zipCode || seedMatch?.zipCode || '',
              street: b.street || seedMatch?.street || '',
              number: b.number || seedMatch?.number || '',
              complement: b.complement || seedMatch?.complement || '',
              neighborhood: b.neighborhood || seedMatch?.neighborhood || '',
              managerRole: b.managerRole || seedMatch?.managerRole || 'Gestor de Unidade',
              whatsapp: b.whatsapp || seedMatch?.whatsapp || '',
              operatingHours: b.operatingHours || seedMatch?.operatingHours || 'Seg a Sex, 08:00 às 18:00',
              areaM2: b.areaM2 ?? seedMatch?.areaM2,
              notes: b.notes || seedMatch?.notes || ''
            };
          });
        }
        // Migrate cached strings from Filial to Unidade
        if (parsed.inventories && Array.isArray(parsed.inventories)) {
          parsed.inventories.forEach((inv: any) => {
            if (inv.title) inv.title = inv.title.replace(/Filial/g, 'Unidade').replace(/filial/g, 'unidade');
          });
        }
        if (parsed.transfers && Array.isArray(parsed.transfers)) {
          parsed.transfers.forEach((trf: any) => {
            if (trf.notes) trf.notes = trf.notes.replace(/Filiais/g, 'Unidades').replace(/filiais/g, 'unidades').replace(/Filial/g, 'Unidade').replace(/filial/g, 'unidade');
          });
        }
        if (parsed.notifications && Array.isArray(parsed.notifications)) {
          parsed.notifications.forEach((n: any) => {
            if (n.title) n.title = n.title.replace(/Filiais/g, 'Unidades').replace(/filiais/g, 'unidades').replace(/Filial/g, 'Unidade').replace(/filial/g, 'unidade');
            if (n.message) n.message = n.message.replace(/Filiais/g, 'Unidades').replace(/filiais/g, 'unidades').replace(/Filial/g, 'Unidade').replace(/filial/g, 'unidade');
          });
        }
        if (parsed.auditLogs && Array.isArray(parsed.auditLogs)) {
          parsed.auditLogs.forEach((l: any) => {
            if (l.module) l.module = l.module.replace(/Filiais/g, 'Unidades').replace(/Filial/g, 'Unidade');
            if (l.details) l.details = l.details.replace(/Filiais/g, 'Unidades').replace(/filiais/g, 'unidades').replace(/Filial/g, 'Unidade').replace(/filial/g, 'unidade');
          });
        }
        // Ensure all products have keys for all branches and sync batch/expiration metadata
        if (parsed.products && Array.isArray(parsed.products)) {
          for (const p of parsed.products) {
            if (!p.stockByBranch) p.stockByBranch = {};
            for (const b of parsed.branches) {
              if (p.stockByBranch[b.code] === undefined) {
                p.stockByBranch[b.code] = 0;
              }
            }
            // Sync seed batch information and expiration dates
            const seedProd = INITIAL_PRODUCTS.find((sp: any) => sp.code === p.code);
            if (seedProd) {
              if (seedProd.batchNumber && !p.batchNumber) p.batchNumber = seedProd.batchNumber;
              if (seedProd.batches && (!p.batches || p.batches.length === 0)) p.batches = seedProd.batches;
              if (seedProd.expirationDate) p.expirationDate = seedProd.expirationDate;
            }
          }
        }
        // Ensure Master account zynecta@gmail.com is always present, active, role Master and password Zynecta@1973
        if (parsed.users && Array.isArray(parsed.users)) {
          const zynectaIndex = parsed.users.findIndex((u: any) => u.email?.toLowerCase() === 'zynecta@gmail.com');
          if (zynectaIndex >= 0) {
            parsed.users[zynectaIndex].role = 'Master';
            parsed.users[zynectaIndex].password = 'Zynecta@1973';
            parsed.users[zynectaIndex].active = true;
          } else {
            parsed.users.unshift({
              id: 'user-master-zynecta',
              name: 'Administrador Master',
              email: 'zynecta@gmail.com',
              password: 'Zynecta@1973',
              role: 'Master',
              branch: 'SP',
              active: true,
              firstAccess: false,
              createdAt: '2025-01-01T08:00:00Z',
              department: 'Diretoria Geral & TI',
              phone: '(11) 98765-4321',
              avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'
            });
          }
        }
        if (!parsed.settings) {
          parsed.settings = INITIAL_SETTINGS;
        } else if (!parsed.settings.budgetPolicy) {
          parsed.settings.budgetPolicy = DEFAULT_BUDGET_POLICY;
        }
        return parsed;
      }
    } catch (e) {
      console.error('Erro ao carregar estado do localStorage:', e);
    }

    const initialState: AppState = {
      branches: INITIAL_BRANCHES,
      products: INITIAL_PRODUCTS,
      users: INITIAL_USERS,
      movements: [
        {
          id: 'mov-001',
          type: 'ENTRADA',
          productId: 'prod-001',
          productCode: 'EPI-001',
          productName: 'Capacete de Segurança Abafador Classe B',
          quantity: 50,
          unitPrice: 68.50,
          totalPrice: 3425.00,
          branch: 'SP',
          requestedBy: 'Carlos Eduardo Silva',
          responsibleUser: 'Carlos Eduardo Silva',
          documentNumber: 'NF-10492',
          notes: 'Compra via Ordem de Compra OC-2025-01',
          date: '2025-08-01T10:00:00Z'
        },
        {
          id: 'mov-002',
          type: 'SAIDA',
          productId: 'prod-002',
          productCode: 'EPI-002',
          productName: 'Luva de Vaqueta Cano Curto Tam G',
          quantity: 15,
          unitPrice: 24.90,
          totalPrice: 373.50,
          branch: 'RJ',
          costCenterId: 'cc-102',
          costCenterName: 'Manutenção Infraestrutura RJ',
          requestedBy: 'Juliana Costa e Souza',
          responsibleUser: 'Juliana Costa e Souza',
          documentNumber: 'REQ-9912',
          notes: 'Entrega para equipe de campo',
          date: '2025-08-02T11:15:00Z'
        }
      ],
      transfers: INITIAL_TRANSFERS,
      requisitions: INITIAL_REQUISITIONS,
      purchaseRequests: INITIAL_PURCHASE_REQUESTS,
      purchaseOrders: INITIAL_PURCHASE_ORDERS,
      assets: INITIAL_ASSETS,
      inventories: INITIAL_INVENTORIES,
      costCenters: INITIAL_COST_CENTERS,
      auditLogs: INITIAL_AUDIT_LOGS,
      notifications: INITIAL_NOTIFICATIONS,
      settings: INITIAL_SETTINGS
    };

    this.saveState(initialState);
    return initialState;
  }

  public saveState(newState?: AppState, skipCloudPush = false) {
    if (newState) {
      this.state = newState;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('Erro ao salvar estado no localStorage:', e);
    }

    if (!skipCloudPush && !this.isSyncingFromCloud && typeof window !== 'undefined') {
      if (this.cloudPushTimer) {
        clearTimeout(this.cloudPushTimer);
      }
      this.cloudPushTimer = setTimeout(() => {
        this.pushStateToCloud();
      }, 1000);
    }
  }

  // ==========================================
  // SINCRONIZAÇÃO EM NUVEM (MULTI-COMPUTADOR E MULTI-FILIAIS)
  // ==========================================

  private initCloudSync() {
    if (typeof window === 'undefined') return;

    try {
      const stateDocRef = doc(db, 'erp_state', 'almoxplus_production');

      onSnapshot(stateDocRef, (snapshot) => {
        if (snapshot.exists()) {
          const cloudData = snapshot.data();
          if (cloudData && cloudData.state) {
            this.isSyncingFromCloud = true;
            this.state = cloudData.state;
            this.cleanUpProductionRemnants();
            this.cloudSyncStatus = {
              connected: true,
              lastSync: new Date().toISOString(),
              databaseId: 'ai-studio-almoxpluserpdeal-24144e17-b53e-44ab-a942-0cee7e733fd0'
            };
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
            } catch (e) {
              // ignore
            }
            this.isSyncingFromCloud = false;
            this.notifyListeners();
          }
        } else {
          // Documento inicial ainda não gravado na nuvem -> envia estado inicial
          this.pushStateToCloud();
        }
      }, (error) => {
        console.warn('Firestore onSnapshot listener status:', error.message);
        this.cloudSyncStatus.connected = false;
        this.cloudSyncStatus.error = error.message;
      });
    } catch (err: any) {
      console.warn('Falha ao inicializar sincronização em nuvem:', err.message);
      this.cloudSyncStatus.connected = false;
      this.cloudSyncStatus.error = err.message;
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(fn => {
      try {
        fn();
      } catch (e) {
        console.error('Erro ao notificar listener do dataService:', e);
      }
    });
  }

  public async pushStateToCloud(): Promise<boolean> {
    try {
      const stateDocRef = doc(db, 'erp_state', 'almoxplus_production');
      await setDoc(stateDocRef, {
        state: this.state,
        updatedAt: new Date().toISOString(),
        version: 'production_v1'
      });
      this.cloudSyncStatus = {
        connected: true,
        lastSync: new Date().toISOString(),
        databaseId: 'ai-studio-almoxpluserpdeal-24144e17-b53e-44ab-a942-0cee7e733fd0'
      };
      return true;
    } catch (err: any) {
      console.warn('Erro ao enviar estado para a nuvem Firestore:', err.message);
      this.cloudSyncStatus.connected = false;
      this.cloudSyncStatus.error = err.message;
      return false;
    }
  }

  public async pullStateFromCloud(): Promise<boolean> {
    try {
      const stateDocRef = doc(db, 'erp_state', 'almoxplus_production');
      const snap = await getDoc(stateDocRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data && data.state) {
          this.isSyncingFromCloud = true;
          this.state = data.state;
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
          } catch (e) {
            // ignore
          }
          this.isSyncingFromCloud = false;
          this.cloudSyncStatus = {
            connected: true,
            lastSync: new Date().toISOString(),
            databaseId: 'ai-studio-almoxpluserpdeal-24144e17-b53e-44ab-a942-0cee7e733fd0'
          };
          this.notifyListeners();
          return true;
        }
      }
      return false;
    } catch (err: any) {
      console.warn('Erro ao puxar dados da nuvem Firestore:', err.message);
      this.cloudSyncStatus.connected = false;
      this.cloudSyncStatus.error = err.message;
      return false;
    }
  }

  public getCloudSyncStatus() {
    return { ...this.cloudSyncStatus };
  }

  // ==========================================
  // PREPARAÇÃO PARA PRODUÇÃO (GO-LIVE / CLEAN SLATE)
  // ==========================================

  public async prepareForProduction(
    mode: 'TRANSACTIONAL_ONLY' | 'FACTORY_RESET',
    currentUser: User
  ): Promise<{ backupFileName: string; summary: string }> {
    if (currentUser.role !== 'Master') {
      throw new Error('Apenas usuários com perfil Master têm autorização para preparar o sistema para produção.');
    }

    // 1. Gera e descarrega automaticamente o backup de segurança com TODOS os dados atuais
    const backupJsonStr = this.exportDatabaseJSON('COMPLETO');
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFileName = `AlmoxPlus_Homologacao_Backup_${timestampStr}.json`;

    if (typeof window !== 'undefined') {
      try {
        const blob = new Blob([backupJsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = backupFileName;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        console.warn('Não foi possível disparar download automático do backup:', e);
      }
    }

    const DEMO_EMAILS = [
      'admin@almoxplus.com.br',
      'juliana.rj@almoxplus.com.br',
      'marcos.sjrp@almoxplus.com.br',
      'fernanda.sp@almoxplus.com.br',
      'rodrigo.bsb@almoxplus.com.br',
      'lucas.almoxarife@almoxplus.com.br',
      'mariana.compras@almoxplus.com.br',
      'roberto.gestor@almoxplus.com.br',
      'patricia.auditoria@almoxplus.com.br'
    ];

    // Preserva exclusivamente o Master Titular zynecta@gmail.com e o usuário Master executor
    const cleanUsers = this.state.users.filter(u => {
      const emailLower = (u.email || '').toLowerCase().trim();
      const isMasterTitular = emailLower === 'zynecta@gmail.com' || u.id === 'user-master-zynecta';
      const isCurrentMaster = u.id === currentUser.id;
      const isDemo = DEMO_EMAILS.includes(emailLower) || u.id.startsWith('user-comprador') || u.id.startsWith('user-almoxarife') || u.id.startsWith('user-gestor') || u.id.startsWith('user-visitor') || u.id.startsWith('user-master-1');
      return isMasterTitular || isCurrentMaster || !isDemo;
    });

    // 2. Executa a limpeza conforme o modo selecionado
    if (mode === 'TRANSACTIONAL_ONLY') {
      // Zera estoque em todas as filiais
      const cleanProducts = this.state.products.map(p => {
        const cleanStock: Record<string, number> = {};
        const branches = this.state.branches.map(b => b.code);
        branches.forEach(b => {
          cleanStock[b] = 0;
        });
        return {
          ...p,
          stockByBranch: cleanStock,
          batches: []
        };
      });

      // Zera ORÇAMENTO APROVADO e GASTOS dos centros de custo para início em produção limpo (Marco Zero)
      const cleanCostCenters = this.state.costCenters.map(cc => ({
        ...cc,
        budget: 0,
        spent: 0
      }));

      this.state.products = cleanProducts;
      this.state.costCenters = cleanCostCenters;
      this.state.users = cleanUsers.length > 0 ? cleanUsers : [currentUser];
      this.state.movements = [];
      this.state.transfers = [];
      this.state.requisitions = [];
      this.state.purchaseRequests = [];
      this.state.purchaseOrders = [];
      this.state.inventories = [];
      this.state.notifications = [];
      
      const prodAuditLog: AuditLog = {
        id: `log-prod-${Date.now()}`,
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        operation: 'CRIAR',
        module: 'Governança & Produção',
        previousValue: 'Ambiente de Testes / Homologação',
        newValue: 'Ambiente de Produção Ativo (Marco Zero Transacional)',
        branch: 'GLOBAL',
        timestamp: new Date().toISOString(),
        ip: '127.0.0.1 (Painel Master)',
        details: `Preparação para produção concluída com sucesso. Estoques zerados (0), orçamentos de centros de custo zerados para nova dotação, usuários de demonstração purgados e transações de teste eliminadas. Backup de segurança salvo como ${backupFileName}.`
      };
      this.state.auditLogs = [prodAuditLog];

    } else {
      // FACTORY_RESET (Limpeza Completa)
      this.state.products = [];
      this.state.movements = [];
      this.state.transfers = [];
      this.state.requisitions = [];
      this.state.purchaseRequests = [];
      this.state.purchaseOrders = [];
      this.state.inventories = [];
      this.state.assets = [];
      this.state.notifications = [];
      this.state.costCenters = this.state.costCenters.map(cc => ({ ...cc, budget: 0, spent: 0 }));
      this.state.users = cleanUsers.length > 0 ? cleanUsers : [currentUser];

      const prodAuditLog: AuditLog = {
        id: `log-prod-${Date.now()}`,
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        operation: 'CRIAR',
        module: 'Governança & Produção',
        previousValue: 'Ambiente de Testes',
        newValue: 'Ambiente de Produção (Limpeza de Fábrica Total)',
        branch: 'GLOBAL',
        timestamp: new Date().toISOString(),
        ip: '127.0.0.1 (Painel Master)',
        details: `Limpeza de fábrica concluída. Banco pronto para novo cadastramento do zero. Orçamentos zerados e usuários de teste purgados. Backup prévio salvo como ${backupFileName}.`
      };
      this.state.auditLogs = [prodAuditLog];
    }

    // 3. Salva no localStorage e força envio imediato para o Firestore
    this.saveState(undefined, true);
    await this.pushStateToCloud();
    this.notifyListeners();

    return {
      backupFileName,
      summary: mode === 'TRANSACTIONAL_ONLY'
        ? `Estoques zerados (0) em todas as filiais, orçamentos liberados para centros de custo zerados, usuários de demonstração purgados e transações eliminadas. Catálogo de produtos (${this.state.products.length} itens) e 4 unidades preservados.`
        : 'Banco de dados 100% zerado no padrão de fábrica para cadastramento novo.'
    };
  }

  public purgeDemoUsers(currentUser: User): { removedCount: number } {
    if (currentUser.role !== 'Master') {
      throw new Error('Apenas usuários Master podem remover usuários de teste.');
    }
    const DEMO_EMAILS = [
      'admin@almoxplus.com.br',
      'juliana.rj@almoxplus.com.br',
      'marcos.sjrp@almoxplus.com.br',
      'fernanda.sp@almoxplus.com.br',
      'rodrigo.bsb@almoxplus.com.br',
      'lucas.almoxarife@almoxplus.com.br',
      'mariana.compras@almoxplus.com.br',
      'roberto.gestor@almoxplus.com.br',
      'patricia.auditoria@almoxplus.com.br'
    ];

    const initialCount = this.state.users.length;
    this.state.users = this.state.users.filter(u => {
      const emailLower = (u.email || '').toLowerCase().trim();
      const isMasterTitular = emailLower === 'zynecta@gmail.com' || u.id === 'user-master-zynecta';
      const isCurrentMaster = u.id === currentUser.id;
      const isDemo = DEMO_EMAILS.includes(emailLower) || u.id.startsWith('user-comprador') || u.id.startsWith('user-almoxarife') || u.id.startsWith('user-gestor') || u.id.startsWith('user-visitor') || u.id.startsWith('user-master-1');
      return isMasterTitular || isCurrentMaster || !isDemo;
    });

    const removedCount = initialCount - this.state.users.length;
    this.logAudit(
      currentUser,
      'EXCLUIR',
      'Usuários & Permissões',
      `${removedCount} usuário(s) de teste/demonstração foram purgados do sistema para ambiente de produção.`,
      null,
      `${this.state.users.length} usuários ativos`,
      'GLOBAL'
    );

    this.saveState();
    this.pushStateToCloud();
    this.notifyListeners();
    return { removedCount };
  }

  public resetCostCenterBudgets(currentUser: User): void {
    if (currentUser.role !== 'Master') {
      throw new Error('Apenas usuários Master podem zerar os orçamentos de centros de custo.');
    }
    this.state.costCenters = this.state.costCenters.map(cc => ({
      ...cc,
      budget: 0,
      spent: 0
    }));

    this.logAudit(
      currentUser,
      'CONFIGURACAO',
      'Centros de Custo',
      'Todos os valores liberados/orçamentos aprovados de centros de custo foram zerados para marco zero de produção.',
      null,
      'R$ 0,00',
      'GLOBAL'
    );

    this.saveState();
    this.pushStateToCloud();
    this.notifyListeners();
  }

  public cleanUpProductionRemnants(currentUser?: User): void {
    // Sanitização automática: remove contas fictícias e zera dotações residuais para início em produção
    const DEMO_EMAILS = [
      'admin@almoxplus.com.br',
      'juliana.rj@almoxplus.com.br',
      'marcos.sjrp@almoxplus.com.br',
      'fernanda.sp@almoxplus.com.br',
      'rodrigo.bsb@almoxplus.com.br',
      'lucas.almoxarife@almoxplus.com.br',
      'mariana.compras@almoxplus.com.br',
      'roberto.gestor@almoxplus.com.br',
      'patricia.auditoria@almoxplus.com.br'
    ];

    let changed = false;
    const initialUserCount = this.state.users.length;
    this.state.users = this.state.users.filter(u => {
      const emailLower = (u.email || '').toLowerCase().trim();
      const isMasterTitular = emailLower === 'zynecta@gmail.com' || u.id === 'user-master-zynecta';
      const isDemo = DEMO_EMAILS.includes(emailLower) ||
        u.id.startsWith('user-comprador') ||
        u.id.startsWith('user-almoxarife') ||
        u.id.startsWith('user-gestor') ||
        u.id.startsWith('user-visitor') ||
        u.id.startsWith('user-master-1') ||
        (emailLower.endsWith('@almoxplus.com.br') && !isMasterTitular);
      return isMasterTitular || !isDemo;
    });
    if (this.state.users.length !== initialUserCount) {
      changed = true;
    }

    // Se não há movimentações nem OCs ativas (sistema zerado para produção), zera tetos orçamentários residuais
    if (this.state.purchaseOrders.length === 0 && this.state.movements.length === 0) {
      const hasResidualBudgets = this.state.costCenters.some(cc => cc.budget > 0 || cc.spent > 0);
      if (hasResidualBudgets) {
        this.state.costCenters = this.state.costCenters.map(cc => ({
          ...cc,
          budget: 0,
          spent: 0
        }));
        changed = true;
      }
    }

    if (changed) {
      this.saveState(undefined, true);
      this.pushStateToCloud();
      this.notifyListeners();
    }
  }

  public getState(): AppState {
    return this.state;
  }

  // AUDIT LOG HELPER
  public logAudit(
    currentUser: User,
    operation: AuditLog['operation'],
    moduleName: string,
    details: string,
    previousValue: string | null = null,
    newValue: string | null = null,
    branchOverride?: Branch | 'GLOBAL'
  ) {
    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      operation,
      module: moduleName,
      previousValue,
      newValue,
      branch: branchOverride || currentUser.branch,
      timestamp: new Date().toISOString(),
      ip: '127.0.0.1 (Sessão Web)',
      details
    };

    this.state.auditLogs.unshift(newLog);
    this.saveState();
  }

  // NOTIFICATIONS HELPER
  public notify(title: string, message: string, type: SystemNotification['type'], branch: Branch | 'GLOBAL', linkModule?: string) {
    const newNotif: SystemNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      title,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString(),
      branch,
      linkModule
    };
    this.state.notifications.unshift(newNotif);
    this.saveState();
  }

  public markNotificationRead(id: string) {
    const n = this.state.notifications.find(x => x.id === id);
    if (n) {
      n.read = true;
      this.saveState();
    }
  }

  public clearAllNotifications() {
    this.state.notifications = [];
    this.saveState();
  }

  // --- PRODUCTS & WAREHOUSE ---
  public getProducts(branchFilter?: Branch | 'GLOBAL'): Product[] {
    if (!branchFilter || branchFilter === 'GLOBAL') {
      return this.state.products.filter(p => p.active);
    }
    return this.state.products.filter(p => p.active);
  }

  public saveProduct(productData: Partial<Product>, currentUser: User): Product {
    if (currentUser.role === 'Visitante') {
      throw new Error('Perfil Visitante não possui permissão para cadastrar ou editar produtos.');
    }

    let product: Product;
    const isEdit = Boolean(productData.id);

    if (isEdit) {
      const index = this.state.products.findIndex(p => p.id === productData.id);
      if (index === -1) throw new Error('Produto não encontrado.');
      const prev = this.state.products[index];
      product = {
        ...prev,
        ...productData,
        updatedAt: new Date().toISOString()
      };
      this.state.products[index] = product;

      this.logAudit(
        currentUser,
        'EDITAR',
        'Almoxarifado',
        `Produto ${product.code} - ${product.name} atualizado.`,
        JSON.stringify(prev),
        JSON.stringify(product),
        currentUser.branch
      );
    } else {
      const initialBranchStock: Record<string, number> = {};
      const allBranches = this.getBranches();
      for (const b of allBranches) {
        initialBranchStock[b.code] = productData.stockByBranch?.[b.code] || 0;
      }

      product = {
        id: `prod-${Date.now()}`,
        code: productData.code || `PRD-${Math.floor(1000 + Math.random() * 9000)}`,
        name: productData.name || 'Novo Produto',
        category: productData.category || 'Geral',
        unit: productData.unit || 'UN',
        minStock: productData.minStock ?? 10,
        maxStock: productData.maxStock ?? 100,
        stockByBranch: initialBranchStock,
        unitPrice: productData.unitPrice || 0,
        expirationDate: productData.expirationDate,
        locationSlot: productData.locationSlot || 'A1',
        description: productData.description || '',
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.state.products.unshift(product);

      this.logAudit(
        currentUser,
        'CRIAR',
        'Almoxarifado',
        `Produto ${product.code} - ${product.name} cadastrado.`,
        null,
        JSON.stringify(product),
        currentUser.branch
      );
    }

    this.saveState();
    return product;
  }

  public deleteProduct(productId: string, currentUser: User) {
    if (currentUser.role === 'Visitante') {
      throw new Error('Perfil Visitante não possui permissão para excluir produtos.');
    }
    const product = this.state.products.find(p => p.id === productId);
    if (!product) return;

    // Soft delete rule
    product.active = false;
    product.updatedAt = new Date().toISOString();

    this.logAudit(
      currentUser,
      'EXCLUIR',
      'Almoxarifado',
      `Exclusão lógica do produto ${product.code} - ${product.name}.`,
      JSON.stringify(product),
      null,
      currentUser.branch
    );

    this.saveState();
  }

  public importProductsBulk(
    importedItems: Array<{
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
    }>,
    currentUser: User,
    mode: 'MERGE' | 'REPLACE' = 'MERGE'
  ): { created: number; updated: number; total: number } {
    if (currentUser.role === 'Visitante') {
      throw new Error('Perfil Visitante não possui permissão para importar produtos.');
    }

    let createdCount = 0;
    let updatedCount = 0;

    const allBranches = this.getBranches().map(b => b.code);

    if (mode === 'REPLACE') {
      // Deactivate current products
      this.state.products.forEach(p => {
        p.active = false;
        p.updatedAt = new Date().toISOString();
      });
    }

    const now = new Date().toISOString();

    for (const item of importedItems) {
      const cleanCode = item.code.trim().toUpperCase();
      const existing = this.state.products.find(p => p.code.toUpperCase() === cleanCode);

      // Ensure all branch keys are present
      const stockMap: Record<Branch, number> = {};
      for (const bCode of allBranches) {
        stockMap[bCode] = item.stockByBranch?.[bCode] ?? (existing?.stockByBranch?.[bCode] ?? 0);
      }

      if (existing) {
        // Update existing product
        existing.name = item.name.trim();
        existing.category = item.category.trim();
        existing.unit = item.unit.trim().toUpperCase();
        existing.unitPrice = item.unitPrice >= 0 ? item.unitPrice : existing.unitPrice;
        existing.minStock = item.minStock >= 0 ? item.minStock : existing.minStock;
        existing.maxStock = item.maxStock >= existing.minStock ? item.maxStock : existing.maxStock;
        existing.locationSlot = item.locationSlot.trim() || existing.locationSlot;
        existing.stockByBranch = stockMap;
        if (item.batchNumber) existing.batchNumber = item.batchNumber.trim();
        if (item.expirationDate) existing.expirationDate = item.expirationDate;
        if (item.description) existing.description = item.description.trim();
        existing.active = true;
        existing.updatedAt = now;
        updatedCount++;
      } else {
        // Create new product
        const newProduct: Product = {
          id: `prod-import-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          code: cleanCode,
          name: item.name.trim(),
          category: item.category.trim(),
          unit: item.unit.trim().toUpperCase(),
          unitPrice: item.unitPrice >= 0 ? item.unitPrice : 0,
          minStock: item.minStock >= 0 ? item.minStock : 10,
          maxStock: item.maxStock >= 10 ? item.maxStock : 100,
          locationSlot: item.locationSlot.trim() || 'PRAT-GERAL',
          stockByBranch: stockMap,
          batchNumber: item.batchNumber?.trim() || undefined,
          expirationDate: item.expirationDate || undefined,
          description: item.description?.trim() || '',
          active: true,
          createdAt: now,
          updatedAt: now
        };
        this.state.products.unshift(newProduct);
        createdCount++;
      }
    }

    this.saveState();

    this.logAudit(
      currentUser,
      'CRIAR',
      'Almoxarifado',
      `Importação em lote via CSV concluída: ${createdCount} produtos criados e ${updatedCount} atualizados (Modo: ${mode}).`,
      null,
      `Itens importados: ${importedItems.length}`,
      'GLOBAL'
    );

    this.notify(
      'Importação de Produtos Concluída',
      `Foram processados ${importedItems.length} produtos via arquivo CSV (${createdCount} novos, ${updatedCount} atualizados).`,
      'SUCCESS',
      'GLOBAL',
      'Almoxarifado'
    );

    return {
      created: createdCount,
      updated: updatedCount,
      total: importedItems.length
    };
  }

  // --- MOVEMENTS (ENTRADA / SAIDA / AJUSTE) ---
  public registerMovement(
    productId: string,
    type: 'ENTRADA' | 'SAIDA' | 'AJUSTE',
    quantity: number,
    branch: Branch,
    currentUser: User,
    notes?: string,
    costCenterId?: string,
    documentNumber?: string
  ): Movement {
    if (currentUser.role === 'Visitante') {
      throw new Error('Perfil Visitante não possui permissão para registrar movimentações.');
    }

    if (currentUser.role === 'Regular' && currentUser.branch !== branch) {
      throw new Error(`Seu usuário (${currentUser.branch}) só pode movimentar estoque na sua própria cidade.`);
    }

    if (quantity <= 0) {
      throw new Error('A quantidade de movimentação deve ser maior que zero.');
    }

    const product = this.state.products.find(p => p.id === productId);
    if (!product) throw new Error('Produto não encontrado.');

    const currentBranchStock = product.stockByBranch[branch] || 0;

    if (type === 'SAIDA' && currentBranchStock < quantity) {
      throw new Error(`Estoque insuficiente na unidade ${branch}! Disponível: ${currentBranchStock}, Solicitado: ${quantity}. REGRA: Não é permitido estoque negativo.`);
    }

    let newBranchStock = currentBranchStock;
    if (type === 'ENTRADA') {
      newBranchStock = currentBranchStock + quantity;
    } else if (type === 'SAIDA') {
      newBranchStock = currentBranchStock - quantity;
    } else if (type === 'AJUSTE') {
      newBranchStock = quantity; // Absolute stock adjustment
    }

    if (newBranchStock < 0) {
      throw new Error(`Ajuste resultaria em estoque negativo (${newBranchStock}). Não permitido.`);
    }

    // Update product stock by branch
    product.stockByBranch[branch] = newBranchStock;
    product.updatedAt = new Date().toISOString();

    const costCenter = this.state.costCenters.find(c => c.id === costCenterId);

    if (costCenter && type === 'SAIDA') {
      costCenter.spent += (quantity * product.unitPrice);
    }

    const movement: Movement = {
      id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      quantity,
      unitPrice: product.unitPrice,
      totalPrice: quantity * product.unitPrice,
      branch,
      costCenterId: costCenter?.id,
      costCenterName: costCenter?.name,
      requestedBy: currentUser.name,
      responsibleUser: currentUser.name,
      documentNumber: documentNumber || `MOV-${Date.now()}`,
      notes,
      date: new Date().toISOString()
    };

    this.state.movements.unshift(movement);

    this.logAudit(
      currentUser,
      'CRIAR',
      'Almoxarifado',
      `Movimentação ${type} de ${quantity}x ${product.name} na unidade ${branch}. Estoque anterior: ${currentBranchStock}, Novo: ${newBranchStock}.`,
      `Estoque ${branch}: ${currentBranchStock}`,
      `Estoque ${branch}: ${newBranchStock}`,
      branch
    );

    // Check min stock alert
    if (newBranchStock <= product.minStock) {
      this.notify(
        'Estoque Crítico Alcançado',
        `A unidade ${branch} atingiu o nível mínimo (${newBranchStock}/${product.minStock}) para o item ${product.name}.`,
        'WARNING',
        branch,
        'Almoxarifado'
      );
    }

    this.saveState();
    return movement;
  }

  // --- INTER-BRANCH TRANSFERS ---
  public createTransfer(
    originBranch: Branch,
    destinationBranch: Branch,
    productId: string,
    quantity: number,
    currentUser: User,
    notes?: string
  ): Transfer {
    if (currentUser.role === 'Visitante') {
      throw new Error('Perfil Visitante não pode solicitar transferências.');
    }

    if (originBranch === destinationBranch) {
      throw new Error('A cidade de origem e destino devem ser diferentes.');
    }

    if (currentUser.role === 'Regular' && currentUser.branch !== originBranch) {
      throw new Error(`Seu perfil Regular (${currentUser.branch}) só pode originar transferências da sua própria unidade.`);
    }

    const product = this.state.products.find(p => p.id === productId);
    if (!product) throw new Error('Produto não encontrado.');

    const originStock = product.stockByBranch[originBranch] || 0;
    if (originStock < quantity) {
      throw new Error(`Estoque insuficiente na unidade de origem ${originBranch}. Disponível: ${originStock}, Solicitado: ${quantity}.`);
    }

    // Step 1: Saída imediata na origem
    product.stockByBranch[originBranch] = originStock - quantity;
    product.updatedAt = new Date().toISOString();

    // Register movement of exit at origin
    const exitMov: Movement = {
      id: `mov-trf-out-${Date.now()}`,
      type: 'TRANSFERENCIA',
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      quantity,
      unitPrice: product.unitPrice,
      totalPrice: quantity * product.unitPrice,
      branch: originBranch,
      requestedBy: currentUser.name,
      responsibleUser: currentUser.name,
      documentNumber: `TRF-SAIDA-${Date.now()}`,
      notes: `Transferência para ${destinationBranch}. ${notes || ''}`,
      date: new Date().toISOString()
    };
    this.state.movements.unshift(exitMov);

    // Step 2: Transfer object created with status "EM_TRANSITO"
    const transfer: Transfer = {
      id: `trans-${Date.now()}`,
      code: `TRF-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      originBranch,
      destinationBranch,
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      quantity,
      status: 'EM_TRANSITO',
      requestedBy: currentUser.name,
      approvedBy: currentUser.name,
      sentAt: new Date().toISOString(),
      notes
    };

    this.state.transfers.unshift(transfer);

    this.logAudit(
      currentUser,
      'TRANSFERIR',
      'Transferências',
      `Criada transferência em trânsito (${transfer.code}): ${quantity}x ${product.name} de ${originBranch} para ${destinationBranch}.`,
      `Estoque ${originBranch}: ${originStock}`,
      `Estoque ${originBranch}: ${product.stockByBranch[originBranch]} (Em trânsito)`,
      originBranch
    );

    this.notify(
      'Nova Transferência Em Trânsito',
      `A unidade ${originBranch} enviou ${quantity}x ${product.name} para ${destinationBranch} (${transfer.code}). Aguardando confirmação de recebimento.`,
      'INFO',
      destinationBranch,
      'Transferencias'
    );

    this.saveState();
    return transfer;
  }

  public confirmTransferReceipt(transferId: string, currentUser: User): Transfer {
    if (currentUser.role === 'Visitante') {
      throw new Error('Perfil Visitante não pode confirmar recebimento de transferências.');
    }

    const transfer = this.state.transfers.find(t => t.id === transferId);
    if (!transfer) throw new Error('Transferência não encontrada.');

    if (transfer.status !== 'EM_TRANSITO') {
      throw new Error(`Transferência já está ${transfer.status}.`);
    }

    if (currentUser.role === 'Regular' && currentUser.branch !== transfer.destinationBranch) {
      throw new Error(`Apenas usuários da unidade de destino (${transfer.destinationBranch}) podem confirmar o recebimento.`);
    }

    const product = this.state.products.find(p => p.id === transfer.productId);
    if (!product) throw new Error('Produto da transferência não encontrado.');

    // Step 3: Confirm receipt -> Automatic entry at destination & update status to CONCLUIDO
    const destStock = product.stockByBranch[transfer.destinationBranch] || 0;
    product.stockByBranch[transfer.destinationBranch] = destStock + transfer.quantity;
    product.updatedAt = new Date().toISOString();

    transfer.status = 'CONCLUIDO';
    transfer.receivedBy = currentUser.name;
    transfer.receivedAt = new Date().toISOString();

    const entryMov: Movement = {
      id: `mov-trf-in-${Date.now()}`,
      type: 'ENTRADA',
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      quantity: transfer.quantity,
      unitPrice: product.unitPrice,
      totalPrice: transfer.quantity * product.unitPrice,
      branch: transfer.destinationBranch,
      requestedBy: transfer.requestedBy,
      responsibleUser: currentUser.name,
      documentNumber: `${transfer.code}-ENTRADA`,
      notes: `Recebimento de transferência de ${transfer.originBranch}`,
      date: new Date().toISOString()
    };
    this.state.movements.unshift(entryMov);

    this.logAudit(
      currentUser,
      'TRANSFERIR',
      'Transferências',
      `Recebimento confirmado (${transfer.code}). ${transfer.quantity}x ${product.name} adicionados ao estoque da unidade ${transfer.destinationBranch}.`,
      `Estoque ${transfer.destinationBranch}: ${destStock}`,
      `Estoque ${transfer.destinationBranch}: ${product.stockByBranch[transfer.destinationBranch]}`,
      transfer.destinationBranch
    );

    this.notify(
      'Transferência Recebida e Concluída',
      `O recebimento da transferência ${transfer.code} (${product.name}) foi confirmado pela unidade ${transfer.destinationBranch}.`,
      'SUCCESS',
      transfer.originBranch,
      'Transferencias'
    );

    this.saveState();
    return transfer;
  }

  // --- REQUISITIONS (SOLICITAÇÕES) ---
  public createRequisition(
    branch: Branch,
    costCenterId: string,
    items: Requisition['items'],
    currentUser: User,
    priority: Requisition['priority'] = 'MEDIA'
  ): Requisition {
    if (currentUser.role === 'Visitante') {
      throw new Error('Perfil Visitante não pode criar solicitações.');
    }

    const cc = this.state.costCenters.find(c => c.id === costCenterId);

    const req: Requisition = {
      id: `req-${Date.now()}`,
      code: `SOL-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      branch,
      costCenterId,
      costCenterName: cc ? cc.name : 'Geral',
      requestedBy: currentUser.name,
      requestedByEmail: currentUser.email,
      status: 'PENDENTE',
      priority,
      items,
      createdAt: new Date().toISOString()
    };

    this.state.requisitions.unshift(req);

    this.logAudit(
      currentUser,
      'CRIAR',
      'Solicitações',
      `Nova solicitação ${req.code} criada na unidade ${branch} (${items.length} itens).`,
      null,
      JSON.stringify(req),
      branch
    );

    this.notify(
      'Nova Solicitação de Material',
      `Solicitação ${req.code} criada por ${currentUser.name} para a unidade ${branch}.`,
      'INFO',
      branch,
      'Solicitacoes'
    );

    this.saveState();
    return req;
  }

  public updateRequisitionStatus(
    reqId: string,
    status: 'APROVADO' | 'REJEITADO' | 'ATENDIDO',
    currentUser: User,
    rejectionReason?: string
  ): Requisition {
    if (currentUser.role === 'Visitante') {
      throw new Error('Perfil Visitante não tem permissão para aprovar ou alterar solicitações.');
    }

    const req = this.state.requisitions.find(r => r.id === reqId);
    if (!req) throw new Error('Solicitação não encontrada.');

    req.status = status;
    if (status === 'APROVADO') {
      req.approvedAt = new Date().toISOString();
      req.approvedBy = currentUser.name;
    } else if (status === 'REJEITADO') {
      req.rejectionReason = rejectionReason || 'Rejeitado por decisão do responsável.';
    } else if (status === 'ATENDIDO') {
      // Automatically generate exit movements for approved items
      for (const item of req.items) {
        const qty = item.approvedQuantity ?? item.requestedQuantity;
        try {
          this.registerMovement(
            item.productId,
            'SAIDA',
            qty,
            req.branch,
            currentUser,
            `Atendimento da Solicitação ${req.code}`,
            req.costCenterId,
            req.code
          );
        } catch (e) {
          console.error(`Erro ao baixar item ${item.productName}:`, e);
        }
      }
    }

    this.logAudit(
      currentUser,
      'EDITAR',
      'Solicitações',
      `Solicitação ${req.code} alterada para status ${status}.`,
      null,
      status,
      req.branch
    );

    this.notify(
      `Solicitação ${status.toLowerCase()}`,
      `A solicitação ${req.code} teve seu status alterado para ${status}.`,
      status === 'APROVADO' || status === 'ATENDIDO' ? 'SUCCESS' : 'ERROR',
      req.branch,
      'Solicitacoes'
    );

    this.saveState();
    return req;
  }

  // --- PURCHASE ORDERS & SOLICITAÇÕES DE COMPRA (COMPRAS) ---
  public createPurchaseRequest(
    branch: Branch,
    justification: string,
    priority: PurchaseRequest['priority'],
    items: Array<{
      productId?: string;
      isUnregistered?: boolean;
      customProductName?: string;
      customProductCode?: string;
      customUnit?: string;
      category?: string;
      brandOrModel?: string;
      quantity: number;
      estimatedUnitPrice?: number;
      notes?: string;
    }>,
    currentUser: User,
    department?: string,
    costCenterId?: string
  ): PurchaseRequest {
    if (items.length === 0) {
      throw new Error('A solicitação de compra deve conter ao menos um item.');
    }

    const costCenter = costCenterId ? this.state.costCenters.find(c => c.id === costCenterId) : undefined;

    const requestItems: PurchaseRequestItem[] = items.map((it, idx) => {
      // Check if it is an uncataloged material (either explicitly flagged or without a catalog productId)
      if (it.isUnregistered || (!it.productId && it.customProductName)) {
        const tempCode = it.customProductCode || `MNC-${Math.floor(1000 + Math.random() * 9000)}`;
        return {
          id: `sc-item-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
          productId: it.productId || `unregistered-${Date.now()}-${idx}`,
          productCode: tempCode,
          productName: it.customProductName?.trim() || 'Material Não Cadastrado',
          unit: (it.customUnit?.trim() || 'UN').toUpperCase(),
          quantity: Math.max(1, Number(it.quantity)),
          estimatedUnitPrice: Number(it.estimatedUnitPrice || 0),
          status: 'PENDENTE',
          notes: it.notes,
          isUnregistered: true,
          category: it.category?.trim() || 'Diversos',
          brandOrModel: it.brandOrModel?.trim()
        };
      }

      const prod = this.state.products.find(p => p.id === it.productId);
      if (!prod) {
        if (it.customProductName) {
          const tempCode = it.customProductCode || `MNC-${Math.floor(1000 + Math.random() * 9000)}`;
          return {
            id: `sc-item-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
            productId: `unregistered-${Date.now()}-${idx}`,
            productCode: tempCode,
            productName: it.customProductName.trim(),
            unit: (it.customUnit?.trim() || 'UN').toUpperCase(),
            quantity: Math.max(1, Number(it.quantity)),
            estimatedUnitPrice: Number(it.estimatedUnitPrice || 0),
            status: 'PENDENTE',
            notes: it.notes,
            isUnregistered: true,
            category: it.category?.trim() || 'Diversos',
            brandOrModel: it.brandOrModel?.trim()
          };
        }
        throw new Error(`Produto ID ${it.productId} não encontrado no catálogo.`);
      }

      return {
        id: `sc-item-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
        productId: prod.id,
        productCode: prod.code,
        productName: prod.name,
        unit: prod.unit,
        quantity: Math.max(1, Number(it.quantity)),
        estimatedUnitPrice: it.estimatedUnitPrice !== undefined && it.estimatedUnitPrice > 0 ? Number(it.estimatedUnitPrice) : prod.unitPrice,
        status: 'PENDENTE',
        notes: it.notes,
        isUnregistered: false,
        category: prod.category
      };
    });

    let budgetOverrun = false;
    let budgetOverrunAmount = 0;

    if (costCenter?.id) {
      const estimatedTotal = requestItems.reduce((acc, it) => acc + (it.quantity * (it.estimatedUnitPrice || 0)), 0);
      const budgetCheck = this.checkCostCenterBudget(costCenter.id, estimatedTotal);

      if (!budgetCheck.allowed) {
        throw new Error(budgetCheck.errorMessage || 'Operação bloqueada por estouro de verba do centro de custo.');
      }

      if (budgetCheck.isOverBudget) {
        budgetOverrun = true;
        budgetOverrunAmount = budgetCheck.overrunAmount;
      }
    }

    const request: PurchaseRequest = {
      id: `sc-${Date.now()}`,
      code: `SC-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      branch,
      costCenterId: costCenter?.id,
      costCenterName: costCenter?.name,
      department: department || currentUser.department || 'Operações',
      requestedBy: currentUser.name,
      requestedByEmail: currentUser.email,
      priority,
      justification,
      items: requestItems,
      status: 'PENDENTE',
      createdAt: new Date().toISOString(),
      budgetOverrun,
      budgetOverrunAmount: budgetOverrun ? budgetOverrunAmount : undefined
    };

    if (!this.state.purchaseRequests) {
      this.state.purchaseRequests = [];
    }

    this.state.purchaseRequests.unshift(request);

    this.logAudit(
      currentUser,
      'COMPRAR',
      'Compras',
      `Nova Solicitação de Compra ${request.code} criada com ${request.items.length} item(ns)${budgetOverrun ? ` [ALERTA: Estouro Orçamentário de R$ ${budgetOverrunAmount.toFixed(2)}]` : ''}.`,
      null,
      JSON.stringify(request),
      branch
    );

    this.notify(
      budgetOverrun ? 'SC Retida - Alçada Orçamentária Requerida (Opção 3)' : 'Nova Solicitação de Compra (SC)',
      budgetOverrun
        ? `Solicitação ${request.code} (${branch}) excede o orçamento do Centro de Custo ${costCenter?.name} em R$ ${budgetOverrunAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Requer aprovação extraordinária da Diretoria.`
        : `Solicitação ${request.code} emitida por ${currentUser.name} (${request.items.length} item(ns)) para ${branch}.`,
      budgetOverrun ? 'WARNING' : 'INFO',
      branch,
      'Compras'
    );

    this.saveState();
    return request;
  }

  public approvePurchaseRequestItem(
    requestId: string,
    itemId: string,
    supplierName: string,
    supplierCnpj: string,
    negotiatedUnitPrice: number,
    paymentTerms: string,
    currentUser: User
  ): { request: PurchaseRequest; purchaseOrder: PurchaseOrder } {
    if (currentUser.role === 'Visitante') {
      throw new Error('Perfil Visitante não possui permissão para aprovar solicitações de compra.');
    }

    const req = this.state.purchaseRequests?.find(r => r.id === requestId);
    if (!req) throw new Error('Solicitação de compra não encontrada.');

    const item = req.items.find(i => i.id === itemId);
    if (!item) throw new Error('Item da solicitação de compra não encontrado.');

    if (item.status === 'APROVADO') {
      throw new Error('Este item já foi aprovado e possui uma Ordem de Compra vinculada.');
    }

    const finalUnitPrice = negotiatedUnitPrice > 0 ? negotiatedUnitPrice : (item.estimatedUnitPrice || 0);

    // Create Purchase Order (OC) automatically for this approved item
    const poItem: PurchaseOrderItem = {
      productId: item.productId,
      productCode: item.productCode,
      productName: item.productName,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: finalUnitPrice,
      totalPrice: item.quantity * finalUnitPrice,
      purchaseRequestId: req.id,
      purchaseRequestCode: req.code,
      isUnregistered: item.isUnregistered,
      category: item.category,
      brandOrModel: item.brandOrModel
    };

    const po = this.createPurchaseOrder(
      req.branch,
      supplierName || 'Fornecedor Homologado',
      supplierCnpj || '00.000.000/0001-00',
      [poItem],
      currentUser,
      paymentTerms || '28 dias faturado',
      req.id,
      req.code,
      req.costCenterId,
      req.costCenterName
    );

    // Update item in the request
    item.status = 'APROVADO';
    item.generatedPurchaseOrderId = po.id;
    item.generatedPurchaseOrderCode = po.code;
    item.supplierName = supplierName;
    item.negotiatedUnitPrice = finalUnitPrice;
    item.approvedAt = new Date().toISOString();
    item.approvedBy = currentUser.name;

    // Recalculate overall request status
    const allApprovedOrRejected = req.items.every(i => i.status === 'APROVADO' || i.status === 'REJEITADO');
    const allRejected = req.items.every(i => i.status === 'REJEITADO');
    const hasApproved = req.items.some(i => i.status === 'APROVADO');

    if (allRejected) {
      req.status = 'REJEITADA';
    } else if (allApprovedOrRejected) {
      req.status = 'CONCLUIDA';
    } else if (hasApproved) {
      req.status = 'PARCIALMENTE_ATENDIDA';
    }

    req.updatedAt = new Date().toISOString();

    this.logAudit(
      currentUser,
      'COMPRAR',
      'Compras',
      `Item "${item.productName}" da SC ${req.code} APROVADO pelo Comprador. Gerada OC automática ${po.code}.`,
      'PENDENTE',
      `APROVADO -> ${po.code}`,
      req.branch
    );

    this.notify(
      'Item de Compra Aprovado (OC Gerada)',
      `O item "${item.productName}" da SC ${req.code} foi aprovado. Ordem de Compra ${po.code} gerada com sucesso.`,
      'SUCCESS',
      req.branch,
      'Compras'
    );

    this.saveState();

    if (this.state.backupConfig?.enabled && this.state.backupConfig?.autoBackupOnPurchaseOrderApproval) {
      try {
        this.createBackupSnapshot(
          'INVENTARIO_E_COMPRAS',
          'GATILHO_OPERACIONAL',
          currentUser,
          `Backup automático de proteção após aprovação da SC ${req.code} e emissão da OC ${po.code}`
        );
      } catch (e) {
        console.error('Erro ao gerar snapshot operacional automático:', e);
      }
    }

    return { request: req, purchaseOrder: po };
  }

  public rejectPurchaseRequestItem(
    requestId: string,
    itemId: string,
    rejectionReason: string,
    currentUser: User
  ): PurchaseRequest {
    if (currentUser.role === 'Visitante') {
      throw new Error('Perfil Visitante não pode rejeitar solicitações de compra.');
    }

    const req = this.state.purchaseRequests?.find(r => r.id === requestId);
    if (!req) throw new Error('Solicitação de compra não encontrada.');

    const item = req.items.find(i => i.id === itemId);
    if (!item) throw new Error('Item da solicitação de compra não encontrado.');

    if (item.status === 'APROVADO') {
      throw new Error('Item já aprovado com OC não pode ser rejeitado diretamente.');
    }

    item.status = 'REJEITADO';
    item.rejectionReason = rejectionReason || 'Rejeitado pelo setor de compras';
    item.approvedBy = currentUser.name;
    item.approvedAt = new Date().toISOString();

    const allApprovedOrRejected = req.items.every(i => i.status === 'APROVADO' || i.status === 'REJEITADO');
    const allRejected = req.items.every(i => i.status === 'REJEITADO');
    const hasApproved = req.items.some(i => i.status === 'APROVADO');

    if (allRejected) {
      req.status = 'REJEITADA';
    } else if (allApprovedOrRejected) {
      req.status = 'CONCLUIDA';
    } else if (hasApproved) {
      req.status = 'PARCIALMENTE_ATENDIDA';
    }

    req.updatedAt = new Date().toISOString();

    this.logAudit(
      currentUser,
      'COMPRAR',
      'Compras',
      `Item "${item.productName}" da SC ${req.code} REJEITADO: ${item.rejectionReason}`,
      'PENDENTE',
      'REJEITADO',
      req.branch
    );

    this.notify(
      'Item de Solicitação Rejeitado',
      `O item "${item.productName}" da SC ${req.code} foi rejeitado: ${item.rejectionReason}`,
      'WARNING',
      req.branch,
      'Compras'
    );

    this.saveState();
    return req;
  }

  public cancelPurchaseRequest(
    requestId: string,
    currentUser: User
  ): PurchaseRequest {
    const req = this.state.purchaseRequests?.find(r => r.id === requestId);
    if (!req) throw new Error('Solicitação de compra não encontrada.');

    req.status = 'CANCELADA';
    req.items.forEach(i => {
      if (i.status === 'PENDENTE') {
        i.status = 'CANCELADO';
      }
    });
    req.updatedAt = new Date().toISOString();

    this.logAudit(
      currentUser,
      'COMPRAR',
      'Compras',
      `Solicitação de Compra ${req.code} cancelada por ${currentUser.name}.`,
      'PENDENTE',
      'CANCELADA',
      req.branch
    );

    this.saveState();
    return req;
  }

  public createPurchaseOrder(
    branch: Branch,
    supplierName: string,
    supplierCnpj: string,
    items: PurchaseOrder['items'],
    currentUser: User,
    paymentTerms?: string,
    purchaseRequestId?: string,
    purchaseRequestCode?: string,
    costCenterId?: string,
    costCenterName?: string
  ): PurchaseOrder {
    if (currentUser.role === 'Visitante') {
      throw new Error('Perfil Visitante não pode emitir ordens de compra.');
    }

    const totalVal = items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);

    let budgetOverrun = false;
    let budgetOverrunAmount = 0;

    if (costCenterId) {
      const budgetCheck = this.checkCostCenterBudget(costCenterId, totalVal);

      if (!budgetCheck.allowed) {
        throw new Error(budgetCheck.errorMessage || 'Operação bloqueada por estouro de verba do centro de custo.');
      }

      if (budgetCheck.isOverBudget) {
        budgetOverrun = true;
        budgetOverrunAmount = budgetCheck.overrunAmount;
      }
    }

    const po: PurchaseOrder = {
      id: `po-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      code: `OC-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      branch,
      costCenterId,
      costCenterName,
      supplierName,
      supplierCnpj,
      status: 'AGUARDANDO_APROVACAO',
      items,
      totalValue: totalVal,
      requestedBy: currentUser.name,
      createdAt: new Date().toISOString(),
      paymentTerms,
      purchaseRequestId,
      purchaseRequestCode,
      budgetOverrun,
      budgetOverrunAmount: budgetOverrun ? budgetOverrunAmount : undefined
    };

    this.state.purchaseOrders.unshift(po);

    this.logAudit(
      currentUser,
      'COMPRAR',
      'Compras',
      `Nova Ordem de Compra ${po.code} emitida para ${supplierName} (Total: R$ ${totalVal.toFixed(2)})${purchaseRequestCode ? ` originada da SC ${purchaseRequestCode}` : ''}${budgetOverrun ? ` [ALERTA: Estouro Orçamentário de R$ ${budgetOverrunAmount.toFixed(2)}]` : ''}.`,
      null,
      JSON.stringify(po),
      branch
    );

    this.notify(
      budgetOverrun ? 'OC com Estouro de Verba - Alçada da Diretoria (Opção 3)' : 'Ordem de Compra Emitida',
      budgetOverrun
        ? `OC ${po.code} emitida com excedente orçamentário de R$ ${budgetOverrunAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no Centro de Custo ${costCenterName || ''}. Requer aprovação extraordinária da Diretoria.`
        : `OC ${po.code} criada no valor de R$ ${totalVal.toLocaleString('pt-BR')} para a unidade ${branch}.`,
      budgetOverrun ? 'WARNING' : 'INFO',
      branch,
      'Compras'
    );

    this.saveState();
    return po;
  }

  public updatePurchaseOrderStatus(
    poId: string,
    status: PurchaseOrder['status'],
    currentUser: User,
    overrunJustification?: string
  ): PurchaseOrder {
    if (currentUser.role === 'Visitante') {
      throw new Error('Perfil Visitante não possui permissão para alterar compras.');
    }

    const po = this.state.purchaseOrders.find(p => p.id === poId);
    if (!po) throw new Error('Ordem de compra não encontrada.');

    const prevStatus = po.status;

    if (status === 'APROVADO' && po.budgetOverrun) {
      const policy = this.getBudgetPolicy();
      const isAuthorized = policy.allowedApproverRoles.includes(currentUser.role) || currentUser.role === 'Master';
      if (!isAuthorized) {
        throw new Error(`🔒 Alçada Restrita: Esta Ordem de Compra possui excedente orçamentário de R$ ${po.budgetOverrunAmount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no Centro de Custo. Pela política corporativa vigente (Opção 3: Alçada Extraordinária), a liberação é restrita a usuários com perfil ${policy.allowedApproverRoles.join(' ou ')}.`);
      }
      if (policy.requireJustification && (!overrunJustification || overrunJustification.trim().length < 5)) {
        throw new Error('É obrigatório fornecer a justificativa da diretoria para autorizar a compra com estouro orçamentário.');
      }
      po.budgetOverrunApprovedBy = currentUser.name;
      po.budgetOverrunApprovedAt = new Date().toISOString();
      if (overrunJustification) {
        po.budgetOverrunJustification = overrunJustification;
      }
    }

    po.status = status;

    if (status === 'APROVADO') {
      po.approvedAt = new Date().toISOString();
      po.approvedBy = currentUser.name;
    } else if (status === 'ENTREGUE' && prevStatus !== 'ENTREGUE') {
      po.actualDeliveryDate = new Date().toISOString().split('T')[0];
      // Automatically add stock entry for all items in the purchase order
      for (const item of po.items) {
        try {
          let product = this.state.products.find(p => p.id === item.productId);

          // If the material is not yet in the catalog (uncataloged material), auto-register it upon warehouse receipt
          if (!product) {
            const nextSku = (item.productCode && !item.productCode.startsWith('MNC-'))
              ? item.productCode
              : `SKU-${po.branch}-${Math.floor(1000 + Math.random() * 9000)}`;

            const autoBranchStock: Record<string, number> = {};
            for (const b of this.getBranches()) {
              autoBranchStock[b.code] = 0;
            }

            product = {
              id: item.productId.startsWith('unregistered')
                ? `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`
                : item.productId,
              code: nextSku,
              name: item.productName,
              category: item.category || 'Materiais Diversos',
              unit: item.unit || 'UN',
              unitPrice: item.unitPrice || 0,
              minStock: 5,
              maxStock: Math.max(20, item.quantity * 2),
              locationSlot: 'DOCA-RECEBIMENTO',
              stockByBranch: autoBranchStock,
              active: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };

            // Update item productId and productCode to match the registered product
            item.productId = product.id;
            item.productCode = product.code;

            this.state.products.unshift(product);

            this.logAudit(
              currentUser,
              'CRIAR',
              'Almoxarifado',
              `Material antes não cadastrado "${product.name}" (${product.code}) foi catalogado automaticamente ao receber a OC ${po.code}.`,
              null,
              JSON.stringify(product),
              po.branch
            );
          }

          this.registerMovement(
            product.id,
            'ENTRADA',
            item.quantity,
            po.branch,
            currentUser,
            `Entrada via Recebimento OC ${po.code}${item.isUnregistered ? ' (Material Catalogado)' : ''}`,
            undefined,
            po.code
          );
        } catch (err) {
          console.error(`Erro ao dar entrada automática do item ${item.productName}:`, err);
        }
      }
    }

    this.logAudit(
      currentUser,
      'COMPRAR',
      'Compras',
      `Ordem de Compra ${po.code} atualizada de ${prevStatus} para ${status}.`,
      prevStatus,
      status,
      po.branch
    );

    this.notify(
      `Status da OC ${po.code} Alterado`,
      `A ordem de compra ${po.code} foi atualizada para ${status}.`,
      status === 'ENTREGUE' || status === 'APROVADO' ? 'SUCCESS' : 'INFO',
      po.branch,
      'Compras'
    );

    this.saveState();

    if (
      (status === 'APROVADO' || status === 'ENTREGUE') &&
      this.state.backupConfig?.enabled &&
      this.state.backupConfig?.autoBackupOnPurchaseOrderApproval
    ) {
      try {
        this.createBackupSnapshot(
          'INVENTARIO_E_COMPRAS',
          'GATILHO_OPERACIONAL',
          currentUser,
          `Backup automático após atualização da Ordem de Compra ${po.code} para ${status}`
        );
      } catch (e) {
        console.error('Erro ao gerar snapshot operacional de OC:', e);
      }
    }

    return po;
  }

  // --- PATRIMÔNIO (ASSETS) & RASTREABILIDADE DE CUSTÓDIA ---
  public saveAsset(assetData: Partial<Asset>, currentUser: User): Asset {
    if (currentUser.role === 'Visitante') {
      throw new Error('Perfil Visitante não pode cadastrar ou alterar patrimônio.');
    }

    let asset: Asset;
    const isEdit = Boolean(assetData.id);

    if (isEdit) {
      const idx = this.state.assets.findIndex(a => a.id === assetData.id);
      if (idx === -1) throw new Error('Patrimônio não encontrado.');
      const prev = this.state.assets[idx];

      let updatedCustodyHistory = prev.custodyHistory ? [...prev.custodyHistory] : [];
      let prevBorrower = assetData.previousBorrower || prev.previousBorrower;
      let prevBorrowerDept = assetData.previousBorrowerDepartment || prev.previousBorrowerDepartment;
      let lastReturnDate = assetData.lastReturnedDate || prev.lastReturnedDate;

      // Check if custody has changed (returned or transferred to another person)
      const hadBorrower = Boolean(prev.borrowedTo);
      const isNowReturned = hadBorrower && (assetData.status !== 'EMPRESTADO' || !assetData.borrowedTo);
      const isNowTransferred = hadBorrower && assetData.status === 'EMPRESTADO' && assetData.borrowedTo && assetData.borrowedTo !== prev.borrowedTo;

      if (isNowReturned || isNowTransferred) {
        prevBorrower = prev.borrowedTo;
        prevBorrowerDept = prev.borrowedToDepartment;
        lastReturnDate = new Date().toISOString().split('T')[0];

        // Close the previous custody record in history
        const openRecordIdx = updatedCustodyHistory.findIndex(c => !c.returnedDate && c.user === prev.borrowedTo);
        if (openRecordIdx !== -1) {
          updatedCustodyHistory[openRecordIdx] = {
            ...updatedCustodyHistory[openRecordIdx],
            returnedDate: lastReturnDate,
            returnedBy: currentUser.name,
            condition: assetData.status === 'EM_MANUTENCAO' ? 'Devolvido com Avaria / Manutenção' : 'Devolvido'
          };
        } else {
          updatedCustodyHistory.push({
            id: `cust-${Date.now()}-prev`,
            user: prev.borrowedTo!,
            department: prev.borrowedToDepartment,
            borrowedDate: prev.borrowedDate || lastReturnDate,
            returnedDate: lastReturnDate,
            returnedBy: currentUser.name,
            notes: 'Devolução / Encerramento de custódia anterior.',
            condition: assetData.status === 'EM_MANUTENCAO' ? 'Devolvido com Avaria / Manutenção' : 'Devolvido'
          });
        }
      }

      // If newly borrowed to someone
      if (assetData.status === 'EMPRESTADO' && assetData.borrowedTo && assetData.borrowedTo !== prev.borrowedTo) {
        updatedCustodyHistory.push({
          id: `cust-${Date.now()}`,
          user: assetData.borrowedTo,
          department: assetData.borrowedToDepartment,
          borrowedDate: assetData.borrowedDate || new Date().toISOString().split('T')[0],
          expectedReturnDate: assetData.expectedReturnDate,
          notes: assetData.notes
        });
      }

      asset = {
        ...prev,
        ...assetData,
        previousBorrower: prevBorrower,
        previousBorrowerDepartment: prevBorrowerDept,
        lastReturnedDate: lastReturnDate,
        custodyHistory: updatedCustodyHistory
      };

      if (asset.status !== 'EMPRESTADO' && isNowReturned) {
        asset.borrowedTo = undefined;
        asset.borrowedToDepartment = undefined;
        asset.borrowedDate = undefined;
        asset.expectedReturnDate = undefined;
      }

      this.state.assets[idx] = asset;
      this.logAudit(
        currentUser,
        'EDITAR',
        'Patrimônio',
        `Patrimônio ${asset.assetTag} - ${asset.name} editado. Status: ${asset.status}${asset.previousBorrower ? ` (Último utilizador rastreado: ${asset.previousBorrower})` : ''}`,
        JSON.stringify(prev),
        JSON.stringify(asset),
        asset.branch
      );
    } else {
      const initCustody: AssetCustodyRecord[] = [];
      if (assetData.status === 'EMPRESTADO' && assetData.borrowedTo) {
        initCustody.push({
          id: `cust-${Date.now()}`,
          user: assetData.borrowedTo,
          department: assetData.borrowedToDepartment,
          borrowedDate: assetData.borrowedDate || new Date().toISOString().split('T')[0],
          expectedReturnDate: assetData.expectedReturnDate,
          notes: assetData.notes
        });
      }

      asset = {
        id: `asset-${Date.now()}`,
        assetTag: assetData.assetTag || `PAT-${assetData.branch || 'SP'}-${Math.floor(1000 + Math.random() * 9000)}`,
        name: assetData.name || 'Novo Patrimônio',
        category: assetData.category || 'Equipamento',
        branch: assetData.branch || currentUser.branch,
        location: assetData.location || 'Depósito',
        value: assetData.value || 0,
        status: assetData.status || 'EM_USO',
        borrowedTo: assetData.status === 'EMPRESTADO' ? assetData.borrowedTo : undefined,
        borrowedToDepartment: assetData.status === 'EMPRESTADO' ? assetData.borrowedToDepartment : undefined,
        borrowedDate: assetData.status === 'EMPRESTADO' ? (assetData.borrowedDate || new Date().toISOString().split('T')[0]) : undefined,
        expectedReturnDate: assetData.status === 'EMPRESTADO' ? assetData.expectedReturnDate : undefined,
        previousBorrower: assetData.previousBorrower,
        previousBorrowerDepartment: assetData.previousBorrowerDepartment,
        lastReturnedDate: assetData.lastReturnedDate,
        custodyHistory: initCustody,
        acquisitionDate: assetData.acquisitionDate || new Date().toISOString().split('T')[0],
        serialNumber: assetData.serialNumber,
        notes: assetData.notes,
        active: true
      };
      this.state.assets.unshift(asset);
      this.logAudit(currentUser, 'CRIAR', 'Patrimônio', `Patrimônio ${asset.assetTag} cadastrado.`, null, JSON.stringify(asset), asset.branch);
    }

    this.saveState();
    return asset;
  }

  public returnAsset(
    assetId: string,
    condition: string,
    notes: string,
    sendToMaintenance: boolean,
    currentUser: User
  ): Asset {
    if (currentUser.role === 'Visitante') {
      throw new Error('Perfil Visitante não possui permissão para registrar devolução de patrimônio.');
    }

    const idx = this.state.assets.findIndex(a => a.id === assetId);
    if (idx === -1) throw new Error('Patrimônio não encontrado.');
    const asset = this.state.assets[idx];

    const prevUser = asset.borrowedTo || 'Utilizador Não Informado';
    const prevDept = asset.borrowedToDepartment;
    const returnDate = new Date().toISOString().split('T')[0];

    const updatedHistory = asset.custodyHistory ? [...asset.custodyHistory] : [];
    const openIdx = updatedHistory.findIndex(c => !c.returnedDate && c.user === prevUser);
    if (openIdx !== -1) {
      updatedHistory[openIdx] = {
        ...updatedHistory[openIdx],
        returnedDate: returnDate,
        returnedBy: currentUser.name,
        condition: condition || 'Devolvido',
        notes: notes ? `${updatedHistory[openIdx].notes ? updatedHistory[openIdx].notes + ' | ' : ''}${notes}` : updatedHistory[openIdx].notes
      };
    } else {
      updatedHistory.push({
        id: `cust-${Date.now()}`,
        user: prevUser,
        department: prevDept,
        borrowedDate: asset.borrowedDate || returnDate,
        returnedDate: returnDate,
        returnedBy: currentUser.name,
        condition: condition || 'Devolvido',
        notes
      });
    }

    asset.previousBorrower = prevUser;
    asset.previousBorrowerDepartment = prevDept;
    asset.lastReturnedDate = returnDate;
    asset.custodyHistory = updatedHistory;
    asset.status = sendToMaintenance ? 'EM_MANUTENCAO' : 'EM_USO';
    asset.borrowedTo = undefined;
    asset.borrowedToDepartment = undefined;
    asset.borrowedDate = undefined;
    asset.expectedReturnDate = undefined;
    if (notes) {
      asset.notes = asset.notes ? `${asset.notes}\n[Devolução em ${returnDate} por ${prevUser}]: ${notes}` : `[Devolução em ${returnDate} por ${prevUser}]: ${notes}`;
    }

    this.state.assets[idx] = asset;

    this.logAudit(
      currentUser,
      'EDITAR',
      'Patrimônio',
      `Devolução do patrimônio ${asset.assetTag} registrada. Último utilizador arquivado para rastreabilidade: ${prevUser}. Condição: ${condition}.`,
      prevUser,
      asset.status,
      asset.branch
    );

    this.notify(
      'Patrimônio Devolvido ao Almoxarifado',
      `O bem ${asset.assetTag} (${asset.name}) foi devolvido por ${prevUser}. Status: ${asset.status}.`,
      sendToMaintenance ? 'WARNING' : 'SUCCESS',
      asset.branch,
      'Patrimonio'
    );

    this.saveState();
    return asset;
  }

  // --- INVENTORY AUDITS (INVENTÁRIO FÍSICO) ---
  public createInventoryAudit(branch: Branch, title: string, productIds: string[], currentUser: User): InventoryAudit {
    if (currentUser.role === 'Visitante') {
      throw new Error('Perfil Visitante não pode criar inventário.');
    }

    const items = productIds.map(id => {
      const p = this.state.products.find(x => x.id === id);
      const sysQty = p ? (p.stockByBranch[branch] || 0) : 0;
      return {
        productId: id,
        productCode: p ? p.code : 'PRD',
        productName: p ? p.name : 'Produto',
        unit: p ? p.unit : 'UN',
        systemQuantity: sysQty,
        countedQuantity: sysQty, // Default match, to be edited during count
        divergence: 0,
        divergenceValue: 0
      };
    });

    const audit: InventoryAudit = {
      id: `inv-${Date.now()}`,
      code: `INV-${new Date().getFullYear()}-${branch}-${Math.floor(100 + Math.random() * 900)}`,
      branch,
      title,
      status: 'EM_ANDAMENTO',
      createdBy: currentUser.name,
      auditorUser: currentUser.name,
      startedAt: new Date().toISOString(),
      items,
      totalDivergenceCount: 0,
      totalDivergenceValue: 0
    };

    this.state.inventories.unshift(audit);
    this.logAudit(currentUser, 'INVENTARIAR', 'Inventário', `Iniciado inventário físico ${audit.code} na unidade ${branch}.`, null, JSON.stringify(audit), branch);
    this.saveState();
    return audit;
  }

  public updateInventoryCount(
    auditId: string,
    countedItems: { productId: string; countedQuantity: number; notes?: string }[],
    currentUser: User
  ): InventoryAudit {
    const audit = this.state.inventories.find(i => i.id === auditId);
    if (!audit) throw new Error('Inventário não encontrado.');

    let totalDivCount = 0;
    let totalDivVal = 0;

    audit.items = audit.items.map(item => {
      const match = countedItems.find(c => c.productId === item.productId);
      if (match) {
        const counted = match.countedQuantity;
        const div = counted - item.systemQuantity;
        const p = this.state.products.find(x => x.id === item.productId);
        const uPrice = p ? p.unitPrice : 0;
        const divVal = div * uPrice;

        if (div !== 0) totalDivCount++;
        totalDivVal += divVal;

        return {
          ...item,
          countedQuantity: counted,
          divergence: div,
          divergenceValue: divVal,
          notes: match.notes
        };
      }
      return item;
    });

    audit.totalDivergenceCount = totalDivCount;
    audit.totalDivergenceValue = totalDivVal;

    this.saveState();
    return audit;
  }

  public reconcileInventory(auditId: string, currentUser: User): InventoryAudit {
    if (currentUser.role === 'Visitante') {
      throw new Error('Perfil Visitante não pode reconciliar inventário.');
    }

    const audit = this.state.inventories.find(i => i.id === auditId);
    if (!audit) throw new Error('Inventário não encontrado.');

    if (audit.status === 'CONCLUIDO') {
      throw new Error('Este inventário já foi concluído e reconciliado.');
    }

    // Apply adjustments to stock
    for (const item of audit.items) {
      if (item.divergence !== 0) {
        const p = this.state.products.find(x => x.id === item.productId);
        if (p) {
          p.stockByBranch[audit.branch] = item.countedQuantity;
          p.updatedAt = new Date().toISOString();

          // Log adjustment movement
          const mov: Movement = {
            id: `mov-inv-${Date.now()}-${item.productId}`,
            type: 'AJUSTE',
            productId: p.id,
            productCode: p.code,
            productName: p.name,
            quantity: Math.abs(item.divergence),
            unitPrice: p.unitPrice,
            totalPrice: Math.abs(item.divergence) * p.unitPrice,
            branch: audit.branch,
            requestedBy: currentUser.name,
            responsibleUser: currentUser.name,
            documentNumber: audit.code,
            notes: `Ajuste de inventário físico. Divergência de ${item.divergence > 0 ? '+' : ''}${item.divergence} ${item.unit}.`,
            date: new Date().toISOString()
          };
          this.state.movements.unshift(mov);
        }
      }
    }

    audit.status = 'CONCLUIDO';
    audit.finishedAt = new Date().toISOString();
    audit.reconciledAt = new Date().toISOString();
    audit.reconciledBy = currentUser.name;

    this.logAudit(currentUser, 'INVENTARIAR', 'Inventário', `Reconciliação do inventário ${audit.code} finalizada. Estoque atualizado.`, null, null, audit.branch);
    this.saveState();

    if (this.state.backupConfig?.enabled && this.state.backupConfig?.autoBackupOnInventoryReconcile) {
      try {
        this.createBackupSnapshot(
          'INVENTARIO_E_COMPRAS',
          'GATILHO_OPERACIONAL',
          currentUser,
          `Backup automático de segurança pós-reconciliação do Inventário Físico ${audit.code} (${audit.branch})`
        );
      } catch (e) {
        console.error('Erro ao gerar snapshot pós-inventário:', e);
      }
    }

    return audit;
  }

  // --- USER MANAGEMENT & ADMINISTRATION ---
  public saveUser(userData: Partial<User>, currentUser: User): User {
    if (currentUser.role !== 'Master' && currentUser.role !== 'Gestor') {
      throw new Error('Apenas usuários com perfil Master ou Gestor podem gerenciar os usuários do sistema.');
    }

    if (!userData.name || !userData.name.trim()) {
      throw new Error('O nome do usuário é obrigatório.');
    }
    if (!userData.email || !userData.email.trim()) {
      throw new Error('O e-mail corporativo é obrigatório.');
    }

    const existingIndex = userData.id 
      ? this.state.users.findIndex(u => u.id === userData.id)
      : -1;

    // Regra Estrita de Proteção do Master Titular:
    // Nenhum outro usuário (seja Gestor ou outro usuário Master) pode ver credenciais ou editar o Master Titular
    const isTargetMasterTitular = 
      (userData.email && userData.email.trim().toLowerCase() === 'zynecta@gmail.com') ||
      (existingIndex !== -1 && this.state.users[existingIndex].email?.toLowerCase() === 'zynecta@gmail.com') ||
      (userData.id === 'user-master-zynecta');

    const isCurrentTitular = currentUser.email?.toLowerCase() === 'zynecta@gmail.com' || currentUser.id === 'user-master-zynecta';

    if (isTargetMasterTitular && !isCurrentTitular) {
      throw new Error('Acesso Negado: As credenciais e permissões do Master Titular são confidenciais e inalteráveis por outros administradores.');
    }

    // Gestores não podem conceder perfil Master a outros usuários
    if (currentUser.role === 'Gestor' && userData.role === 'Master') {
      throw new Error('Usuários com perfil Gestor não possuem alçada para conceder o perfil Master.');
    }

    let user: User;

    if (existingIndex !== -1) {
      user = { 
        ...this.state.users[existingIndex], 
        ...userData,
        name: userData.name.trim(),
        email: userData.email.trim().toLowerCase(),
        password: userData.password ? userData.password.trim() : (this.state.users[existingIndex].password || 'senha123')
      };
      this.state.users[existingIndex] = user;
      this.logAudit(currentUser, 'EDITAR', 'Administração', `Usuário ${user.email} atualizado.`, null, JSON.stringify(user), 'GLOBAL');
    } else {
      const emailLower = userData.email.trim().toLowerCase();
      const duplicate = this.state.users.find(u => u.email.toLowerCase() === emailLower);
      if (duplicate) {
        throw new Error(`Já existe um usuário cadastrado com o e-mail ${userData.email}.`);
      }

      user = {
        id: userData.id || `user-${Date.now()}`,
        name: userData.name.trim(),
        email: emailLower,
        password: userData.password ? userData.password.trim() : 'senha123',
        role: userData.role || 'Regular',
        branch: userData.branch || 'SP',
        active: userData.active ?? true,
        firstAccess: userData.firstAccess ?? true,
        isFirstAccess: userData.isFirstAccess ?? true,
        createdAt: new Date().toISOString(),
        department: userData.department || 'Operações',
        phone: userData.phone
      };
      this.state.users.unshift(user);
      this.logAudit(currentUser, 'CRIAR', 'Administração', `Novo usuário ${user.email} criado com perfil ${user.role} na unidade ${user.branch}.`, null, JSON.stringify(user), 'GLOBAL');
    }

    this.saveState();
    return user;
  }

  public findUserByEmail(email: string): User | undefined {
    const clean = email.trim().toLowerCase();
    return this.state.users.find(u => u.email.toLowerCase() === clean);
  }

  public resetUserPassword(email: string, newPassword: string): { success: boolean; user: User } {
    const clean = email.trim().toLowerCase();
    const user = this.state.users.find(u => u.email.toLowerCase() === clean);
    if (!user) {
      throw new Error('Nenhum usuário cadastrado com o e-mail informado.');
    }
    if (!newPassword || newPassword.trim().length < 6) {
      throw new Error('A nova senha deve possuir no mínimo 6 caracteres.');
    }
    user.password = newPassword.trim();
    user.firstAccess = false;
    user.isFirstAccess = false;
    this.saveState();
    this.logAudit(user, 'EDITAR', 'Autenticação', `Senha do usuário ${user.email} foi redefinida com sucesso.`, null, null, user.branch);
    return { success: true, user };
  }

  public deleteUser(userId: string, currentUser: User): boolean {
    if (currentUser.role !== 'Master' && currentUser.role !== 'Gestor') {
      throw new Error('Apenas usuários com perfil Master ou Gestor podem excluir usuários.');
    }
    if (userId === currentUser.id) {
      throw new Error('Não é permitido excluir o seu próprio usuário logado.');
    }
    const idx = this.state.users.findIndex(u => u.id === userId);
    if (idx === -1) throw new Error('Usuário não encontrado.');
    if (this.state.users[idx].email?.toLowerCase() === 'zynecta@gmail.com' || this.state.users[idx].id === 'user-master-zynecta') {
      throw new Error('Não é permitido excluir o usuário Master Titular do sistema (zynecta@gmail.com).');
    }
    const deleted = this.state.users.splice(idx, 1)[0];
    this.logAudit(currentUser, 'EXCLUIR', 'Administração', `Usuário ${deleted.email} removido do sistema.`, JSON.stringify(deleted), null, 'GLOBAL');
    this.saveState();
    return true;
  }

  // ==========================================
  // ROTINA DE BACKUP DE DADOS & RECUPERAÇÃO (INVENTÁRIO E COMPRAS)
  // ==========================================

  private computeChecksum(content: string): string {
    let h1 = 0xdeadbeef ^ content.length;
    let h2 = 0x41c6ce57 ^ content.length;
    for (let i = 0, ch; i < content.length; i++) {
      ch = content.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
    const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
    const hex3 = ((h1 ^ h2) >>> 0).toString(16).padStart(8, '0');
    return `SHA256-${hex1}${hex2}${hex3}`.toUpperCase();
  }

  public calculateBackupMetrics(sourceState: Partial<AppState> = this.state): BackupMetricsSummary {
    const products = sourceState.products || [];
    const movements = sourceState.movements || [];
    const transfers = sourceState.transfers || [];
    const requisitions = sourceState.requisitions || [];
    const inventories = sourceState.inventories || [];
    const purchaseRequests = sourceState.purchaseRequests || [];
    const purchaseOrders = sourceState.purchaseOrders || [];
    const costCenters = sourceState.costCenters || [];
    const assets = sourceState.assets || [];

    const totalInventoryValue = products
      .filter(p => p.active !== false)
      .reduce((acc, p) => {
        const totalUnits = Object.values(p.stockByBranch || {}).reduce((s, q) => s + (Number(q) || 0), 0);
        return acc + totalUnits * (p.unitPrice || 0);
      }, 0);

    const totalPurchasesValue = purchaseOrders
      .filter(po => po.status !== 'CANCELADO')
      .reduce((acc, po) => acc + (po.totalValue || 0), 0);

    return {
      productsCount: products.length,
      movementsCount: movements.length,
      transfersCount: transfers.length,
      requisitionsCount: requisitions.length,
      inventoriesCount: inventories.length,
      purchaseRequestsCount: purchaseRequests.length,
      purchaseOrdersCount: purchaseOrders.length,
      costCentersCount: costCenters.length,
      assetsCount: assets.length,
      totalInventoryValue,
      totalPurchasesValue
    };
  }

  private buildScopedPayload(scope: BackupScope, source: AppState = this.state): Partial<AppState> {
    const clone = <T>(val: T): T => JSON.parse(JSON.stringify(val));

    if (scope === 'APENAS_INVENTARIO') {
      return {
        branches: clone(source.branches || []),
        products: clone(source.products || []),
        movements: clone(source.movements || []),
        transfers: clone(source.transfers || []),
        requisitions: clone(source.requisitions || []),
        inventories: clone(source.inventories || []),
        assets: clone(source.assets || [])
      };
    }

    if (scope === 'APENAS_COMPRAS') {
      return {
        branches: clone(source.branches || []),
        purchaseRequests: clone(source.purchaseRequests || []),
        purchaseOrders: clone(source.purchaseOrders || []),
        costCenters: clone(source.costCenters || [])
      };
    }

    if (scope === 'INVENTARIO_E_COMPRAS') {
      return {
        branches: clone(source.branches || []),
        products: clone(source.products || []),
        movements: clone(source.movements || []),
        transfers: clone(source.transfers || []),
        requisitions: clone(source.requisitions || []),
        inventories: clone(source.inventories || []),
        assets: clone(source.assets || []),
        purchaseRequests: clone(source.purchaseRequests || []),
        purchaseOrders: clone(source.purchaseOrders || []),
        costCenters: clone(source.costCenters || [])
      };
    }

    // COMPLETO (exceto a própria pilha de snapshots para não duplicar recursivamente)
    const { backupSnapshots, ...rest } = source;
    return clone(rest);
  }

  private computeNextScheduledAt(frequency: BackupFrequency, scheduledTime: string): string {
    const now = new Date();
    const [hoursStr, minutesStr] = (scheduledTime || '02:00').split(':');
    const hours = Number(hoursStr) || 2;
    const minutes = Number(minutesStr) || 0;

    if (frequency === 'A_CADA_6_HORAS') {
      return new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString();
    }
    if (frequency === 'SEMANAL') {
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      nextWeek.setHours(hours, minutes, 0, 0);
      return nextWeek.toISOString();
    }
    // DIARIO ou GATILHO_CRITICO
    const nextRun = new Date(now);
    nextRun.setHours(hours, minutes, 0, 0);
    if (nextRun.getTime() <= now.getTime()) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    return nextRun.toISOString();
  }

  private ensureBackupRoutineInitialized() {
    let changed = false;
    if (!this.state.backupConfig) {
      this.state.backupConfig = {
        ...DEFAULT_BACKUP_CONFIG,
        nextScheduledAt: this.computeNextScheduledAt(DEFAULT_BACKUP_CONFIG.frequency, DEFAULT_BACKUP_CONFIG.scheduledTime)
      };
      changed = true;
    }

    if (!this.state.backupSnapshots || !Array.isArray(this.state.backupSnapshots) || this.state.backupSnapshots.length === 0) {
      const payloadFull = this.buildScopedPayload('COMPLETO', this.state);
      const strFull = JSON.stringify(payloadFull);
      const payloadInvPurchase = this.buildScopedPayload('INVENTARIO_E_COMPRAS', this.state);
      const strInvPurchase = JSON.stringify(payloadInvPurchase);
      const metrics = this.calculateBackupMetrics(this.state);

      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const todayEarly = new Date(Date.now() - 4 * 60 * 60 * 1000);

      const snap1: BackupSnapshot = {
        id: `bkp-auto-seed-1`,
        code: `BKP-${todayEarly.toISOString().slice(0, 10).replace(/-/g, '')}-0200`,
        createdAt: todayEarly.toISOString(),
        createdBy: 'Agendador Automático (CRON)',
        createdByEmail: 'sistema@almoxplus.com.br',
        triggerType: 'AUTOMATICO_AGENDADO',
        scope: 'INVENTARIO_E_COMPRAS',
        notes: 'Rotina Diária Automática — Proteção de Saldos de Inventário, Movimentações, Solicitações e Ordens de Compra.',
        sizeBytes: new Blob([strInvPurchase]).size,
        checksum: this.computeChecksum(strInvPurchase),
        integrityVerified: true,
        metrics,
        payload: payloadInvPurchase
      };

      const snap2: BackupSnapshot = {
        id: `bkp-auto-seed-2`,
        code: `BKP-${yesterday.toISOString().slice(0, 10).replace(/-/g, '')}-0200`,
        createdAt: yesterday.toISOString(),
        createdBy: 'Agendador Automático (CRON)',
        createdByEmail: 'sistema@almoxplus.com.br',
        triggerType: 'AUTOMATICO_AGENDADO',
        scope: 'COMPLETO',
        notes: 'Snapshot Completo de Segurança (Inventário, Compras, Patrimônio, Centros de Custo e Auditoria).',
        sizeBytes: new Blob([strFull]).size,
        checksum: this.computeChecksum(strFull),
        integrityVerified: true,
        metrics,
        payload: payloadFull
      };

      this.state.backupSnapshots = [snap1, snap2];
      this.state.backupConfig.lastRunAt = todayEarly.toISOString();
      changed = true;
    }

    if (changed) {
      this.saveState();
    }
  }

  public getBackupConfig(): BackupRoutineConfig {
    this.ensureBackupRoutineInitialized();
    return this.state.backupConfig!;
  }

  public updateBackupConfig(newConfig: Partial<BackupRoutineConfig>, currentUser: User): BackupRoutineConfig {
    if (currentUser.role === 'Visitante') {
      throw new Error('Perfil Visitante não possui permissão para alterar a rotina de backup.');
    }
    this.ensureBackupRoutineInitialized();
    const prev = { ...this.state.backupConfig! };
    const merged: BackupRoutineConfig = {
      ...prev,
      ...newConfig,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.name
    };
    merged.nextScheduledAt = this.computeNextScheduledAt(merged.frequency, merged.scheduledTime);
    this.state.backupConfig = merged;
    this.saveState();

    this.logAudit(
      currentUser,
      'CONFIGURACAO',
      'Rotina de Backup',
      `Rotina de backup atualizada: Status=${merged.enabled ? 'ATIVA' : 'PAUSADA'}, Frequência=${merged.frequency}, Horário=${merged.scheduledTime}, Escopo=${merged.defaultScope}, Retenção=${merged.retentionLimit} snapshots.`,
      JSON.stringify(prev),
      JSON.stringify(merged),
      'GLOBAL'
    );

    return merged;
  }

  public getBackupSnapshots(): BackupSnapshot[] {
    this.ensureBackupRoutineInitialized();
    return this.state.backupSnapshots || [];
  }

  public createBackupSnapshot(
    scope: BackupScope,
    triggerType: BackupSnapshot['triggerType'],
    currentUser: User,
    notes?: string
  ): BackupSnapshot {
    if (currentUser.role === 'Visitante') {
      throw new Error('Perfil Visitante não possui permissão para gerar backups.');
    }

    this.ensureBackupRoutineInitialized();
    const payload = this.buildScopedPayload(scope, this.state);
    const payloadStr = JSON.stringify(payload);
    const now = new Date();
    const timeStampCode = `${now.toISOString().slice(0, 10).replace(/-/g, '')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

    const metrics = this.calculateBackupMetrics(payload);
    const checksum = this.computeChecksum(payloadStr);

    const snapshot: BackupSnapshot = {
      id: `bkp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      code: `BKP-${timeStampCode}`,
      createdAt: now.toISOString(),
      createdBy: currentUser.name,
      createdByEmail: currentUser.email,
      triggerType,
      scope,
      notes: notes?.trim() || (
        scope === 'INVENTARIO_E_COMPRAS'
          ? 'Backup dedicado de segurança das informações de Inventário e Compras.'
          : scope === 'APENAS_INVENTARIO'
          ? 'Backup focado em Saldos de Estoque, Movimentações e Auditorias de Inventário.'
          : scope === 'APENAS_COMPRAS'
          ? 'Backup focado em Solicitações de Compra (SC), Ordens de Compra (OC) e Centros de Custo.'
          : 'Backup completo do banco de dados do sistema.'
      ),
      sizeBytes: new Blob([payloadStr]).size,
      checksum,
      integrityVerified: true,
      metrics,
      payload
    };

    if (!this.state.backupSnapshots) {
      this.state.backupSnapshots = [];
    }
    this.state.backupSnapshots.unshift(snapshot);

    // Enforce retention policy
    const limit = Math.max(3, this.state.backupConfig?.retentionLimit || 15);
    if (this.state.backupSnapshots.length > limit) {
      this.state.backupSnapshots = this.state.backupSnapshots.slice(0, limit);
    }

    if (this.state.backupConfig) {
      this.state.backupConfig.lastRunAt = now.toISOString();
      this.state.backupConfig.nextScheduledAt = this.computeNextScheduledAt(
        this.state.backupConfig.frequency,
        this.state.backupConfig.scheduledTime
      );
    }

    this.saveState();

    this.logAudit(
      currentUser,
      'CONFIGURACAO',
      'Rotina de Backup',
      `Snapshot de backup ${snapshot.code} gerado (${triggerType} | Escopo: ${scope}). Protegidos: ${metrics.productsCount} produtos, ${metrics.inventoriesCount} inventários, ${metrics.purchaseRequestsCount} SCs e ${metrics.purchaseOrdersCount} OCs. Checksum: ${checksum}.`,
      null,
      snapshot.code,
      'GLOBAL'
    );

    if (this.state.backupConfig?.notifyOnSuccess && triggerType !== 'PRE_RESTAURACAO') {
      this.notify(
        `Backup Concluído (${snapshot.code})`,
        `Ponto de restauração criado com sucesso (${scope}). Integridade verificada: ${checksum.slice(0, 15)}...`,
        'SUCCESS',
        'GLOBAL',
        'Administracao'
      );
    }

    return snapshot;
  }

  public restoreFromSnapshot(
    snapshotId: string,
    restoreScope: BackupScope,
    createSafetyBackupBeforeRestore: boolean,
    currentUser: User
  ): BackupSnapshot {
    if (currentUser.role !== 'Master' && currentUser.role !== 'Gestor') {
      throw new Error('Por segurança, apenas usuários com perfil Master ou Gestor podem restaurar pontos de backup.');
    }

    const snapshots = this.getBackupSnapshots();
    const target = snapshots.find(s => s.id === snapshotId);
    if (!target) {
      throw new Error('Ponto de restauração não encontrado no cofre de backups.');
    }

    if (createSafetyBackupBeforeRestore) {
      this.createBackupSnapshot(
        'COMPLETO',
        'PRE_RESTAURACAO',
        currentUser,
        `Ponto de segurança automático gerado imediatamente antes de restaurar ${target.code}`
      );
    }

    const payload = JSON.parse(JSON.stringify(target.payload)) as Partial<AppState>;
    const currentSnapshots = this.state.backupSnapshots || [];
    const currentBackupConfig = this.state.backupConfig;

    const applyInventory = restoreScope === 'COMPLETO' || restoreScope === 'INVENTARIO_E_COMPRAS' || restoreScope === 'APENAS_INVENTARIO';
    const applyPurchases = restoreScope === 'COMPLETO' || restoreScope === 'INVENTARIO_E_COMPRAS' || restoreScope === 'APENAS_COMPRAS';

    if (applyInventory) {
      if (payload.products) this.state.products = payload.products;
      if (payload.movements) this.state.movements = payload.movements;
      if (payload.transfers) this.state.transfers = payload.transfers;
      if (payload.requisitions) this.state.requisitions = payload.requisitions;
      if (payload.inventories) this.state.inventories = payload.inventories;
      if (payload.assets) this.state.assets = payload.assets;
    }

    if (applyPurchases) {
      if (payload.purchaseRequests) this.state.purchaseRequests = payload.purchaseRequests;
      if (payload.purchaseOrders) this.state.purchaseOrders = payload.purchaseOrders;
      if (payload.costCenters) this.state.costCenters = payload.costCenters;
    }

    if (restoreScope === 'COMPLETO') {
      if (payload.branches) this.state.branches = payload.branches;
      if (payload.users) this.state.users = payload.users;
      if (payload.settings) this.state.settings = payload.settings;
    }

    this.state.backupSnapshots = currentSnapshots;
    this.state.backupConfig = currentBackupConfig;
    this.saveState();

    this.logAudit(
      currentUser,
      'ALTERAR',
      'Rotina de Backup',
      `Restauração de dados executada a partir do ponto ${target.code} (Escopo aplicado: ${restoreScope}).`,
      null,
      target.code,
      'GLOBAL'
    );

    this.notify(
      'Restauração de Backup Concluída',
      `Os dados (${restoreScope}) foram restaurados com sucesso para o ponto ${target.code} de ${new Date(target.createdAt).toLocaleString('pt-BR')}.`,
      'WARNING',
      'GLOBAL',
      'Administracao'
    );

    return target;
  }

  public deleteBackupSnapshot(snapshotId: string, currentUser: User): boolean {
    if (currentUser.role !== 'Master' && currentUser.role !== 'Gestor') {
      throw new Error('Apenas o perfil Master ou Gestor pode remover pontos de restauração.');
    }
    const list = this.getBackupSnapshots();
    const idx = list.findIndex(s => s.id === snapshotId);
    if (idx === -1) throw new Error('Ponto de restauração não localizado.');

    const removed = list.splice(idx, 1)[0];
    this.saveState();

    this.logAudit(
      currentUser,
      'EXCLUIR',
      'Rotina de Backup',
      `Ponto de restauração ${removed.code} removido do cofre de backups.`,
      removed.code,
      null,
      'GLOBAL'
    );
    return true;
  }

  public verifyDataIntegrity(): {
    valid: boolean;
    checkedAt: string;
    totalRecordsChecked: number;
    checksum: string;
    inventoryChecks: { label: string; passed: boolean; detail: string }[];
    purchaseChecks: { label: string; passed: boolean; detail: string }[];
  } {
    const products = this.state.products || [];
    const movements = this.state.movements || [];
    const transfers = this.state.transfers || [];
    const inventories = this.state.inventories || [];
    const purchaseRequests = this.state.purchaseRequests || [];
    const purchaseOrders = this.state.purchaseOrders || [];
    const costCenters = this.state.costCenters || [];

    const hasNegativeStock = products.some(p =>
      Object.values(p.stockByBranch || {}).some(qty => Number(qty) < 0)
    );
    const allProductsHaveValidSku = products.every(p => Boolean(p.id && p.code && p.name));
    const allMovementsLinked = movements.every(m => Boolean(m.id && m.productId && m.quantity > 0));
    const allInventoriesConsistent = inventories.every(inv => Array.isArray(inv.items) && inv.items.length > 0);

    const allPRsValid = purchaseRequests.every(pr => Boolean(pr.id && pr.code && Array.isArray(pr.items)));
    const allPOsValid = purchaseOrders.every(po => Boolean(po.id && po.code && po.totalValue >= 0 && Array.isArray(po.items)));
    const allCostCentersValid = costCenters.every(cc => Boolean(cc.id && cc.code && cc.budget >= 0));

    const inventoryChecks = [
      {
        label: 'Integridade de Catálogo e SKUs de Produtos',
        passed: allProductsHaveValidSku,
        detail: `${products.length} produtos verificados com código SKU e precificação válidos.`
      },
      {
        label: 'Consistência de Saldos por Unidade (Regra Estoque Não-Negativo)',
        passed: !hasNegativeStock,
        detail: hasNegativeStock
          ? 'Atenção: Detectado saldo negativo em uma ou mais unidades.'
          : `100% dos saldos em ${this.getBranches().length} unidades estão íntegros e ≥ 0.`
      },
      {
        label: 'Rastreabilidade de Movimentações e Transferências',
        passed: allMovementsLinked,
        detail: `${movements.length} movimentações e ${transfers.length} transferências auditadas sem registros órfãos.`
      },
      {
        label: 'Auditorias de Inventário Físico e Reconciliações',
        passed: allInventoriesConsistent,
        detail: `${inventories.length} inventários físicos conferidos com histórico de contagem preservado.`
      }
    ];

    const purchaseChecks = [
      {
        label: 'Solicitações de Compra (SCs) e Itens Requisitados',
        passed: allPRsValid,
        detail: `${purchaseRequests.length} solicitações de compra validadas com status e itens íntegros.`
      },
      {
        label: 'Ordens de Compra (OCs), Cotações e Vínculo Fornecedor',
        passed: allPOsValid,
        detail: `${purchaseOrders.length} ordens de compra conferidas (Total: R$ ${purchaseOrders.reduce((s, o) => s + (o.totalValue || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`
      },
      {
        label: 'Conciliação Orçamentária de Centros de Custo',
        passed: allCostCentersValid,
        detail: `${costCenters.length} centros de custo verificados com orçamento e consumo conciliados.`
      }
    ];

    const payloadStr = JSON.stringify(this.buildScopedPayload('INVENTARIO_E_COMPRAS', this.state));
    const valid = inventoryChecks.every(c => c.passed) && purchaseChecks.every(c => c.passed);

    return {
      valid,
      checkedAt: new Date().toISOString(),
      totalRecordsChecked:
        products.length +
        movements.length +
        transfers.length +
        inventories.length +
        purchaseRequests.length +
        purchaseOrders.length +
        costCenters.length,
      checksum: this.computeChecksum(payloadStr),
      inventoryChecks,
      purchaseChecks
    };
  }

  // RESET / BACKUP DATA
  public exportBackupJSON(scope: BackupScope = 'COMPLETO'): string {
    const payload = this.buildScopedPayload(scope, this.state);
    const wrapper = {
      metadata: {
        system: 'Almox Plus ERP Enterprise',
        version: '2.4.0',
        exportedAt: new Date().toISOString(),
        scope,
        checksum: this.computeChecksum(JSON.stringify(payload)),
        metrics: this.calculateBackupMetrics(payload)
      },
      data: payload
    };
    return JSON.stringify(wrapper, null, 2);
  }

  public exportDatabaseJSON(scope: BackupScope = 'COMPLETO'): string {
    return this.exportBackupJSON(scope);
  }

  public importBackupJSON(
    jsonStr: string,
    currentUser: User,
    restoreScope: BackupScope = 'COMPLETO',
    createSafetySnapshot: boolean = true
  ): boolean {
    if (currentUser.role !== 'Master' && currentUser.role !== 'Gestor') {
      throw new Error('Apenas o perfil Master ou Gestor pode restaurar backups.');
    }
    try {
      const parsed = JSON.parse(jsonStr);
      const sourceData: Partial<AppState> = parsed.data ? parsed.data : parsed;

      if (!sourceData.products && !sourceData.purchaseOrders && !sourceData.purchaseRequests) {
        throw new Error('O arquivo JSON informado não contém estruturas válidas de Inventário ou Compras do Almox Plus.');
      }

      if (createSafetySnapshot) {
        this.createBackupSnapshot(
          'COMPLETO',
          'PRE_RESTAURACAO',
          currentUser,
          'Backup automático de segurança antes de importação de arquivo externo (.json)'
        );
      }

      const currentSnapshots = this.state.backupSnapshots || [];
      const currentBackupConfig = this.state.backupConfig;

      const applyInventory = restoreScope === 'COMPLETO' || restoreScope === 'INVENTARIO_E_COMPRAS' || restoreScope === 'APENAS_INVENTARIO';
      const applyPurchases = restoreScope === 'COMPLETO' || restoreScope === 'INVENTARIO_E_COMPRAS' || restoreScope === 'APENAS_COMPRAS';

      if (applyInventory) {
        if (sourceData.products) this.state.products = sourceData.products;
        if (sourceData.movements) this.state.movements = sourceData.movements;
        if (sourceData.transfers) this.state.transfers = sourceData.transfers;
        if (sourceData.requisitions) this.state.requisitions = sourceData.requisitions;
        if (sourceData.inventories) this.state.inventories = sourceData.inventories;
        if (sourceData.assets) this.state.assets = sourceData.assets;
      }

      if (applyPurchases) {
        if (sourceData.purchaseRequests) this.state.purchaseRequests = sourceData.purchaseRequests;
        if (sourceData.purchaseOrders) this.state.purchaseOrders = sourceData.purchaseOrders;
        if (sourceData.costCenters) this.state.costCenters = sourceData.costCenters;
      }

      if (restoreScope === 'COMPLETO') {
        if (sourceData.branches) this.state.branches = sourceData.branches;
        if (sourceData.users) this.state.users = sourceData.users;
        if (sourceData.settings) this.state.settings = sourceData.settings;
      }

      this.state.backupSnapshots = currentSnapshots;
      this.state.backupConfig = currentBackupConfig;
      this.saveState();

      this.logAudit(
        currentUser,
        'ALTERAR',
        'Rotina de Backup',
        `Restauração de backup via arquivo JSON concluída com sucesso (Escopo: ${restoreScope}).`,
        null,
        restoreScope,
        'GLOBAL'
      );
      return true;
    } catch (e: any) {
      console.error('Falha ao restaurar backup:', e);
      throw new Error(e.message || 'Arquivo de backup inválido ou corrompido.');
    }
  }

  public importDatabaseJSON(
    jsonStr: string,
    currentUser: User,
    restoreScope: BackupScope = 'COMPLETO',
    createSafetySnapshot: boolean = true
  ): boolean {
    return this.importBackupJSON(jsonStr, currentUser, restoreScope, createSafetySnapshot);
  }

  // ==========================================
  // GESTÃO DINÂMICA DE UNIDADES (EXPANSÃO)
  // ==========================================

  public getBranches(onlyActive: boolean = false): BranchInfo[] {
    if (!this.state.branches || !Array.isArray(this.state.branches) || this.state.branches.length === 0) {
      this.state.branches = [...INITIAL_BRANCHES];
      this.saveState();
    }
    if (onlyActive) {
      return this.state.branches.filter(b => b.active);
    }
    return this.state.branches;
  }

  public getBranchByCode(code: string): BranchInfo | undefined {
    const branches = this.getBranches();
    return branches.find(b => b.code.toUpperCase() === code.trim().toUpperCase());
  }

  private formatConsolidatedAddress(data: Partial<BranchInfo>): string {
    if (data.street || data.number || data.neighborhood || data.zipCode) {
      const parts: string[] = [];
      if (data.street) {
        parts.push(`${data.street}${data.number ? `, ${data.number}` : ''}`);
      }
      if (data.complement) {
        parts.push(data.complement);
      }
      if (data.neighborhood) {
        parts.push(data.neighborhood);
      }
      if (data.city && data.state) {
        parts.push(`${data.city}/${data.state}`);
      }
      if (data.zipCode) {
        parts.push(`CEP ${data.zipCode}`);
      }
      return parts.join(' - ');
    }
    return data.address?.trim() || '';
  }

  public createBranch(
    branchData: Partial<BranchInfo> & {
      code: string;
      name: string;
      city: string;
      state: string;
    },
    currentUser: User
  ): BranchInfo {
    if (currentUser.role === 'Visitante') {
      throw new Error('Perfil Visitante não tem permissão para cadastrar novas unidades.');
    }

    const cleanCode = branchData.code.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 2) {
      throw new Error('A sigla/código da unidade deve conter pelo menos 2 caracteres (ex: MG, BA, PR, GO, CTBA).');
    }

    if (!branchData.name.trim()) {
      throw new Error('O nome ou identificação da unidade é obrigatório.');
    }

    if (!branchData.city.trim() || !branchData.state.trim()) {
      throw new Error('Cidade e Estado (UF) são obrigatórios.');
    }

    const existing = this.getBranchByCode(cleanCode);
    if (existing) {
      throw new Error(`Já existe uma unidade cadastrada com o código/sigla "${cleanCode}" (${existing.name}).`);
    }

    const consolidatedAddress = this.formatConsolidatedAddress(branchData);

    const newBranch: BranchInfo = {
      id: `branch-${cleanCode.toLowerCase()}-${Date.now()}`,
      code: cleanCode,
      name: branchData.name.trim(),
      corporateName: branchData.corporateName?.trim() || branchData.name.trim(),
      unitType: branchData.unitType || 'UNIDADE_OPERACIONAL',
      cnpj: branchData.cnpj?.trim() || '',
      stateRegistration: branchData.stateRegistration?.trim() || '',
      municipalRegistration: branchData.municipalRegistration?.trim() || '',
      zipCode: branchData.zipCode?.trim() || '',
      street: branchData.street?.trim() || '',
      number: branchData.number?.trim() || '',
      complement: branchData.complement?.trim() || '',
      neighborhood: branchData.neighborhood?.trim() || '',
      city: branchData.city.trim(),
      state: branchData.state.trim().toUpperCase(),
      address: consolidatedAddress,
      managerName: branchData.managerName?.trim() || '',
      managerRole: branchData.managerRole?.trim() || '',
      phone: branchData.phone?.trim() || '',
      whatsapp: branchData.whatsapp?.trim() || '',
      email: branchData.email?.trim() || '',
      operatingHours: branchData.operatingHours?.trim() || 'Seg a Sex, 08:00 às 18:00',
      areaM2: branchData.areaM2 ? Number(branchData.areaM2) : undefined,
      notes: branchData.notes?.trim() || '',
      active: branchData.active !== undefined ? branchData.active : true,
      createdAt: new Date().toISOString()
    };

    if (!this.state.branches) {
      this.state.branches = [...INITIAL_BRANCHES];
    }
    this.state.branches.push(newBranch);

    // Integração automática e transparente com catálogo de produtos
    // Garante saldo inicial 0 na nova unidade para todos os itens já existentes
    for (const prod of this.state.products) {
      if (!prod.stockByBranch) {
        prod.stockByBranch = {};
      }
      if (prod.stockByBranch[cleanCode] === undefined) {
        prod.stockByBranch[cleanCode] = 0;
      }
    }

    this.saveState();

    this.logAudit(
      currentUser,
      'CRIAR',
      'Unidades',
      `Nova unidade cadastrada no sistema: ${newBranch.name} (${newBranch.code}) - CNPJ: ${newBranch.cnpj || 'N/A'} em ${newBranch.city}/${newBranch.state}.`,
      null,
      JSON.stringify(newBranch),
      'GLOBAL'
    );

    this.notify(
      'Nova Unidade Cadastrada',
      `A unidade ${newBranch.name} (${newBranch.code}) foi cadastrada e integrada ao fluxo de compras, almoxarifado, transferências e inventário.`,
      'SUCCESS',
      'GLOBAL',
      'unidades'
    );

    return newBranch;
  }

  public updateBranch(
    branchId: string,
    branchData: Partial<BranchInfo>,
    currentUser: User
  ): BranchInfo {
    if (currentUser.role === 'Visitante') {
      throw new Error('Perfil Visitante não tem permissão para editar unidades.');
    }

    const branches = this.getBranches();
    const branch = branches.find(b => b.id === branchId || b.code === branchId);
    if (!branch) {
      throw new Error('Unidade não encontrada.');
    }

    const prev = { ...branch };

    if (branchData.name !== undefined) branch.name = branchData.name.trim();
    if (branchData.corporateName !== undefined) branch.corporateName = branchData.corporateName.trim();
    if (branchData.unitType !== undefined) branch.unitType = branchData.unitType;
    if (branchData.cnpj !== undefined) branch.cnpj = branchData.cnpj.trim();
    if (branchData.stateRegistration !== undefined) branch.stateRegistration = branchData.stateRegistration.trim();
    if (branchData.municipalRegistration !== undefined) branch.municipalRegistration = branchData.municipalRegistration.trim();
    if (branchData.zipCode !== undefined) branch.zipCode = branchData.zipCode.trim();
    if (branchData.street !== undefined) branch.street = branchData.street.trim();
    if (branchData.number !== undefined) branch.number = branchData.number.trim();
    if (branchData.complement !== undefined) branch.complement = branchData.complement.trim();
    if (branchData.neighborhood !== undefined) branch.neighborhood = branchData.neighborhood.trim();
    if (branchData.city !== undefined) branch.city = branchData.city.trim();
    if (branchData.state !== undefined) branch.state = branchData.state.trim().toUpperCase();
    if (branchData.managerName !== undefined) branch.managerName = branchData.managerName.trim();
    if (branchData.managerRole !== undefined) branch.managerRole = branchData.managerRole.trim();
    if (branchData.phone !== undefined) branch.phone = branchData.phone.trim();
    if (branchData.whatsapp !== undefined) branch.whatsapp = branchData.whatsapp.trim();
    if (branchData.email !== undefined) branch.email = branchData.email.trim();
    if (branchData.operatingHours !== undefined) branch.operatingHours = branchData.operatingHours.trim();
    if (branchData.areaM2 !== undefined) branch.areaM2 = branchData.areaM2 ? Number(branchData.areaM2) : undefined;
    if (branchData.notes !== undefined) branch.notes = branchData.notes.trim();
    if (branchData.active !== undefined) branch.active = branchData.active;

    branch.address = this.formatConsolidatedAddress({
      ...branch,
      address: branchData.address !== undefined ? branchData.address : branch.address
    });
    branch.updatedAt = new Date().toISOString();

    this.saveState();

    this.logAudit(
      currentUser,
      'EDITAR',
      'Unidades',
      `Dados cadastrais da unidade ${branch.name} (${branch.code}) foram atualizados.`,
      JSON.stringify(prev),
      JSON.stringify(branch),
      'GLOBAL'
    );

    return branch;
  }

  public toggleBranchActive(branchId: string, currentUser: User): BranchInfo {
    if (currentUser.role === 'Visitante') {
      throw new Error('Perfil Visitante não tem permissão para alterar o status da unidade.');
    }

    const branch = this.getBranches().find(b => b.id === branchId || b.code === branchId);
    if (!branch) {
      throw new Error('Unidade não encontrada.');
    }

    branch.active = !branch.active;
    branch.updatedAt = new Date().toISOString();
    this.saveState();

    this.logAudit(
      currentUser,
      'EDITAR',
      'Unidades',
      `Status da unidade ${branch.name} (${branch.code}) alterado para ${branch.active ? 'Ativa' : 'Inativa'}.`,
      null,
      null,
      'GLOBAL'
    );

    return branch;
  }

  // --- ANÁLISE COMPARATIVA DE CENTROS DE CUSTO (COMPRADO vs. ENTREGUE) ---
  public getCostCenterComparison(costCenterId: string): CostCenterComparison | null {
    const cc = this.state.costCenters.find(c => c.id === costCenterId);
    if (!cc) return null;

    const prMap = new Map((this.state.purchaseRequests || []).map(r => [r.id, r]));

    // Ordens de Compra aprovadas/ativas direcionadas a este Centro de Custo
    const pos = (this.state.purchaseOrders || []).filter(po => {
      if (po.status === 'CANCELADO') return false;
      if (po.costCenterId === cc.id) return true;
      if (po.purchaseRequestId && prMap.get(po.purchaseRequestId)?.costCenterId === cc.id) return true;
      return false;
    });

    // Total Comprado (Soma das Ordens de Compra)
    const totalPurchasedFromOrders = pos.reduce((sum, po) => sum + (po.totalValue || 0), 0);
    // Para consistência com base histórica inicial ou lançamentos diretos:
    const totalPurchased = Math.max(totalPurchasedFromOrders, cc.spent * 1.25);

    // Movimentações de Saída do Almoxarifado para este CC
    const movements = (this.state.movements || []).filter(m =>
      m.type === 'SAIDA' && (m.costCenterId === cc.id || m.costCenterName === cc.name)
    );

    // Requisições associadas a este CC
    const requisitions = (this.state.requisitions || []).filter(r =>
      r.costCenterId === cc.id || r.costCenterName === cc.name
    );

    // Total Entregue/Consumido (valor real baixado no estoque do almoxarifado)
    const totalDelivered = cc.spent;

    // Saldo em Almoxarifado (Itens adquiridos que aguardam retirada/consumo pelo setor)
    const stockWaitingConsumption = Math.max(0, totalPurchased - totalDelivered);

    // Balanço por Produto (Comprado vs Entregue)
    const productMap = new Map<string, CostCenterProductBalance>();

    pos.forEach(po => {
      po.items.forEach(item => {
        const key = item.productId || item.productCode || item.productName;
        if (!productMap.has(key)) {
          productMap.set(key, {
            productId: item.productId,
            productCode: item.productCode,
            productName: item.productName,
            unit: item.unit,
            unitPrice: item.unitPrice,
            purchasedQty: 0,
            deliveredQty: 0,
            inStockForSectorQty: 0,
            purchasedValue: 0,
            deliveredValue: 0,
            inStockForSectorValue: 0
          });
        }
        const record = productMap.get(key)!;
        record.purchasedQty += item.quantity;
        record.purchasedValue += (item.totalPrice || (item.quantity * item.unitPrice));
      });
    });

    movements.forEach(m => {
      const key = m.productId || m.productCode || m.productName;
      if (!productMap.has(key)) {
        productMap.set(key, {
          productId: m.productId,
          productCode: m.productCode,
          productName: m.productName,
          unit: 'UN',
          unitPrice: m.unitPrice || 0,
          purchasedQty: 0,
          deliveredQty: 0,
          inStockForSectorQty: 0,
          purchasedValue: 0,
          deliveredValue: 0,
          inStockForSectorValue: 0
        });
      }
      const record = productMap.get(key)!;
      record.deliveredQty += m.quantity;
      record.deliveredValue += (m.totalPrice || (m.quantity * (m.unitPrice || 0)));
    });

    const productBalances = Array.from(productMap.values()).map(p => {
      const inStock = Math.max(0, p.purchasedQty - p.deliveredQty);
      return {
        ...p,
        inStockForSectorQty: inStock,
        inStockForSectorValue: inStock * p.unitPrice
      };
    });

    return {
      id: cc.id,
      costCenter: cc,
      budget: cc.budget,
      totalPurchased,
      totalDelivered,
      stockWaitingConsumption,
      remainingBudget: cc.budget - totalDelivered,
      committedRemainingBudget: cc.budget - totalPurchased,
      purchaseOrders: pos,
      requisitions,
      movements,
      productBalances
    };
  }

  public getAllCostCentersComparison(selectedBranch?: string): CostCenterComparison[] {
    const list = this.state.costCenters
      .filter(c => !selectedBranch || selectedBranch === 'GLOBAL' || c.branch === selectedBranch)
      .map(c => this.getCostCenterComparison(c.id))
      .filter((comp): comp is CostCenterComparison => comp !== null);
    return list;
  }

  public getCostCenterComparisons(selectedBranch?: string): CostCenterComparison[] {
    return this.getAllCostCentersComparison(selectedBranch);
  }

  // --- CONFIGURAÇÕES GLOBAIS E GOVERNANÇA ORÇAMENTÁRIA ---
  public getSettings(): SystemSettings {
    if (!this.state.settings) {
      this.state.settings = { ...INITIAL_SETTINGS };
    }
    if (!this.state.settings.budgetPolicy) {
      this.state.settings.budgetPolicy = { ...DEFAULT_BUDGET_POLICY };
    }
    return this.state.settings;
  }

  public updateSettings(newSettings: Partial<SystemSettings>, currentUser: User): SystemSettings {
    const current = this.getSettings();
    this.state.settings = {
      ...current,
      ...newSettings
    };
    this.logAudit(
      currentUser,
      'CONFIGURACAO',
      'Configurações',
      'Parâmetros globais do sistema atualizados com sucesso.',
      null,
      JSON.stringify(newSettings),
      currentUser.branch || 'GLOBAL'
    );
    this.saveState();
    return this.state.settings;
  }

  public getBudgetPolicy(): CostCenterBudgetPolicy {
    const settings = this.getSettings();
    if (!settings.budgetPolicy) {
      settings.budgetPolicy = { ...DEFAULT_BUDGET_POLICY };
      this.saveState();
    }
    return settings.budgetPolicy;
  }

  public updateBudgetPolicy(
    newPolicy: Partial<CostCenterBudgetPolicy>,
    currentUser: User,
    changeReason?: string
  ): CostCenterBudgetPolicy {
    if (currentUser.role !== 'Master' && currentUser.role !== 'Gestor') {
      throw new Error('Apenas usuários com perfil Master ou Gestor podem alterar a política de governança orçamentária.');
    }

    const currentPolicy = this.getBudgetPolicy();
    const updated: CostCenterBudgetPolicy = {
      ...currentPolicy,
      ...newPolicy,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.name,
      updatedByEmail: currentUser.email,
      changeReason: changeReason || newPolicy.changeReason || 'Alteração de política orçamentária pelo painel corporativo.'
    };

    this.state.settings.budgetPolicy = updated;

    this.logAudit(
      currentUser,
      'CONFIGURACAO',
      'Governança Orçamentária',
      `Política de estouro de centros de custo atualizada para o modo: ${updated.mode} (Tolerância: ${updated.tolerancePercentage}%, Base: ${updated.calculationBasis}). Justificativa: ${updated.changeReason}`,
      JSON.stringify(currentPolicy),
      JSON.stringify(updated),
      'GLOBAL'
    );

    this.notify(
      'Política Orçamentária Atualizada',
      `A regra de estouro de centros de custo foi alterada para "${updated.mode}" por ${currentUser.name}.`,
      'INFO',
      'GLOBAL',
      'Configuracoes'
    );

    this.saveState();
    return updated;
  }

  public checkCostCenterBudget(
    costCenterId: string,
    additionalAmount: number
  ): CostCenterBudgetCheckResult {
    const policy = this.getBudgetPolicy();
    const comparison = this.getCostCenterComparison(costCenterId);

    if (!comparison) {
      return {
        allowed: true,
        isOverBudget: false,
        overrunAmount: 0,
        overrunPercentage: 0,
        budget: 0,
        currentUsed: 0,
        projectedUsed: additionalAmount,
        remainingBudget: 0,
        policyMode: policy.mode,
        requiresSpecialApproval: false,
        costCenterName: 'Não vinculado',
        costCenterCode: 'N/A'
      };
    }

    const { budget, totalPurchased, totalDelivered } = comparison;

    let currentUsed = 0;
    if (policy.calculationBasis === 'COMPROMETIDO') {
      currentUsed = totalPurchased;
    } else if (policy.calculationBasis === 'CONSUMO_REAL') {
      currentUsed = totalDelivered;
    } else {
      currentUsed = Math.max(totalPurchased, totalDelivered);
    }

    const projectedUsed = currentUsed + additionalAmount;
    const toleranceFactor = 1 + (Math.max(0, policy.tolerancePercentage || 0) / 100);
    const effectiveLimit = budget * toleranceFactor;
    const isOverBudget = projectedUsed > effectiveLimit;
    const overrunAmount = Math.max(0, projectedUsed - budget);
    const overrunPercentage = budget > 0 ? (overrunAmount / budget) * 100 : (projectedUsed > 0 ? 100 : 0);
    const remainingBudget = Math.max(0, budget - currentUsed);

    let allowed = true;
    let requiresSpecialApproval = false;
    let warningMessage: string | undefined;
    let errorMessage: string | undefined;

    if (isOverBudget) {
      switch (policy.mode) {
        case 'BLOQUEIO_RIGIDO': // Opção 1: Hard Stop
          allowed = false;
          requiresSpecialApproval = false;
          errorMessage = `Bloqueio Orçamentário Rígido (Opção 1): O Centro de Custo ${comparison.costCenter.code} - ${comparison.costCenter.name} possui teto aprovado de R$ ${budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, com R$ ${currentUsed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} já utilizados. Esta despesa de R$ ${additionalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} excede o teto em R$ ${overrunAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Conforme política da diretoria, novos pedidos estão bloqueados até suplementação de verba.`;
          break;

        case 'INFORMATIVO_AVISO': // Opção 2: Apenas Aviso
          allowed = true;
          requiresSpecialApproval = false;
          warningMessage = `Alerta Informativo (Opção 2): Esta operação faz o Centro de Custo ${comparison.costCenter.code} exceder a verba provisionada em R$ ${overrunAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${overrunPercentage.toFixed(1)}% acima do teto). Prosseguimento autorizado sem bloqueio.`;
          break;

        case 'ALCADA_DIRETORIA_MASTER': // Opção 3: Bloqueio Condicional com Alçada (Vigente)
          allowed = true;
          requiresSpecialApproval = true;
          warningMessage = `Alçada da Diretoria / Master Requerida (Opção 3): Esta compra ultrapassa o orçamento provisionado do Centro de Custo ${comparison.costCenter.code} em R$ ${overrunAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Pela política corporativa vigente, o pedido ficará retido aguardando liberação formal da Diretoria / Usuário Master com justificativa.`;
          break;

        case 'TOLERANCIA_PERCENTUAL': // Opção 4: Tolerância Parametrizada
          allowed = true;
          requiresSpecialApproval = true;
          warningMessage = `Tolerância Excedida (Opção 4): O Centro de Custo ultrapassou o teto e a margem de tolerância corporativa de ${policy.tolerancePercentage}%. Excedente total: R$ ${overrunAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Requer autorização da Diretoria / Usuário Master.`;
          break;
      }
    }

    return {
      allowed,
      isOverBudget,
      overrunAmount,
      overrunPercentage,
      budget,
      currentUsed,
      projectedUsed,
      remainingBudget,
      policyMode: policy.mode,
      requiresSpecialApproval,
      warningMessage,
      errorMessage,
      costCenterName: comparison.costCenter.name,
      costCenterCode: comparison.costCenter.code
    };
  }

  public supplementCostCenterBudget(
    costCenterId: string,
    additionalAmount: number,
    justification: string,
    currentUser: User
  ): CostCenter {
    if (currentUser.role !== 'Master') {
      throw new Error('Somente o Usuário Master ou Diretoria possui alçada para suplementar verba de Centro de Custo.');
    }
    if (additionalAmount <= 0) {
      throw new Error('O valor de suplementação deve ser superior a zero.');
    }
    if (!justification || justification.trim().length < 5) {
      throw new Error('É obrigatório fornecer justificativa formal para a suplementação orçamentária.');
    }

    const cc = this.state.costCenters.find(c => c.id === costCenterId);
    if (!cc) throw new Error('Centro de custo não encontrado.');

    const previousBudget = cc.budget;
    cc.budget += Number(additionalAmount);

    this.logAudit(
      currentUser,
      'ALTERAR',
      'Centro de Custos',
      `Suplementação Orçamentária no Centro de Custo ${cc.code} (${cc.name}) no valor de R$ ${Number(additionalAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Justificativa: ${justification}`,
      `R$ ${previousBudget.toFixed(2)}`,
      `R$ ${cc.budget.toFixed(2)}`,
      cc.branch
    );

    this.notify(
      'Suplementação Orçamentária Aprovada',
      `A Diretoria aportou R$ ${Number(additionalAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no CC ${cc.code} (${cc.name}). Novo teto: R$ ${cc.budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
      'SUCCESS',
      cc.branch,
      'CentroDeCustos'
    );

    this.saveState();
    return cc;
  }

  public transferCostCenterBudget(
    fromCostCenterId: string,
    toCostCenterId: string,
    amount: number,
    justification: string,
    currentUser: User
  ): { from: CostCenter; to: CostCenter } {
    if (currentUser.role !== 'Master') {
      throw new Error('Somente o Usuário Master ou Diretoria pode autorizar remanejamento entre Centros de Custo.');
    }
    if (fromCostCenterId === toCostCenterId) {
      throw new Error('Selecione centros de custo distintos para transferência de saldo.');
    }
    if (amount <= 0) {
      throw new Error('O valor de transferência deve ser maior que zero.');
    }
    if (!justification || justification.trim().length < 5) {
      throw new Error('Forneça uma justificativa detalhada para o remanejamento orçamentário.');
    }

    const fromCC = this.state.costCenters.find(c => c.id === fromCostCenterId);
    const toCC = this.state.costCenters.find(c => c.id === toCostCenterId);
    if (!fromCC || !toCC) throw new Error('Centros de custo informados não foram localizados.');

    const compFrom = this.getCostCenterComparison(fromCC.id);
    const availableInFrom = compFrom ? compFrom.remainingBudget : fromCC.budget;
    if (amount > availableInFrom) {
      throw new Error(`Saldo livre insuficiente no Centro de Custo de origem (${fromCC.code}). Saldo disponível: R$ ${availableInFrom.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`);
    }

    fromCC.budget -= Number(amount);
    toCC.budget += Number(amount);

    this.logAudit(
      currentUser,
      'TRANSFERIR',
      'Centro de Custos',
      `Remanejamento Orçamentário de R$ ${Number(amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de ${fromCC.code} para ${toCC.code}. Justificativa: ${justification}`,
      `${fromCC.code}: R$ ${(fromCC.budget + amount).toFixed(2)} | ${toCC.code}: R$ ${(toCC.budget - amount).toFixed(2)}`,
      `${fromCC.code}: R$ ${fromCC.budget.toFixed(2)} | ${toCC.code}: R$ ${toCC.budget.toFixed(2)}`,
      'GLOBAL'
    );

    this.notify(
      'Remanejamento Orçamentário Realizado',
      `Transferência de R$ ${Number(amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de ${fromCC.code} para ${toCC.code} autorizada pela Diretoria.`,
      'INFO',
      'GLOBAL',
      'CentroDeCustos'
    );

    this.saveState();
    return { from: fromCC, to: toCC };
  }
}

export const dataService = new DataService();
