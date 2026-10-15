import React, { useState, useMemo, useEffect } from 'react';
import {
  Box, Typography, Card, Button, Chip, FormControl, InputLabel, Select,
  MenuItem, TextField, Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions, LinearProgress, IconButton, Tooltip, Alert
} from '@mui/material';
import {
  Plus, Trash2, FileSpreadsheet, FileText, Target, Layers, Calculator,
  TrendingUp, CheckCircle2, AlertTriangle, Sparkles, Sliders, Copy, Eye,
  BookOpen, HelpCircle, ChevronDown, ChevronUp, Lightbulb
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';
import { Branch } from '../types';

export type KpiDataSource =
  | 'MOVEMENTS'
  | 'TRANSFERS'
  | 'REQUISITIONS'
  | 'PURCHASE_REQUESTS'
  | 'PURCHASE_ORDERS'
  | 'STOCK_CATALOG'
  | 'COST_CENTERS';

export type KpiCalculationMode =
  | 'SUM_VALUE'
  | 'SUM_QUANTITY'
  | 'COUNT_RECORDS'
  | 'AVG_VALUE'
  | 'FULFILLMENT_RATE_PCT'
  | 'CONSUMPTION_VS_STOCK_PCT'
  | 'BUDGET_COMMITMENT_PCT';

export type KpiGroupBy =
  | 'BRANCH'
  | 'CATEGORY'
  | 'STATUS'
  | 'COST_CENTER'
  | 'RESPONSIBLE_OR_SUPPLIER';

export type KpiGoalDirection = 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';

export interface CustomKpiDefinition {
  id: string;
  name: string;
  description: string;
  dataSource: KpiDataSource;
  calculationMode: KpiCalculationMode;
  groupBy: KpiGroupBy;
  unitFormat: 'CURRENCY' | 'PERCENTAGE' | 'NUMBER';
  targetValue: number;
  goalDirection: KpiGoalDirection;
  movementTypeFilter?: 'ALL' | 'ENTRADA' | 'SAIDA';
  createdAt: string;
}

const DEFAULT_CUSTOM_KPIS: CustomKpiDefinition[] = [
  {
    id: 'kpi-custom-1',
    name: 'Nível de Atendimento do Almoxarifado (Fill Rate %)',
    description: 'Mede o percentual de solicitações de material atendidas ou aprovadas em relação ao total requisitado pelos setores.',
    dataSource: 'REQUISITIONS',
    calculationMode: 'FULFILLMENT_RATE_PCT',
    groupBy: 'BRANCH',
    unitFormat: 'PERCENTAGE',
    targetValue: 85,
    goalDirection: 'HIGHER_IS_BETTER',
    createdAt: '2026-09-15'
  },
  {
    id: 'kpi-custom-2',
    name: 'Ticket Médio de Ordens de Compra por Categoria',
    description: 'Calcula o valor médio financeiro (R$) por item nas Ordens de Compra emitidas, agrupado por categoria de material.',
    dataSource: 'PURCHASE_ORDERS',
    calculationMode: 'AVG_VALUE',
    groupBy: 'CATEGORY',
    unitFormat: 'CURRENCY',
    targetValue: 5000,
    goalDirection: 'LOWER_IS_BETTER',
    createdAt: '2026-09-18'
  },
  {
    id: 'kpi-custom-3',
    name: 'Taxa de Conversão de Solicitações de Compra (SC → OC)',
    description: 'Percentual de itens de Solicitações de Compra (SC) já convertidos em Ordens de Compra (OC) pelo setor de suprimentos.',
    dataSource: 'PURCHASE_REQUESTS',
    calculationMode: 'FULFILLMENT_RATE_PCT',
    groupBy: 'CATEGORY',
    unitFormat: 'PERCENTAGE',
    targetValue: 80,
    goalDirection: 'HIGHER_IS_BETTER',
    createdAt: '2026-09-20'
  },
  {
    id: 'kpi-custom-4',
    name: 'Volume Financeiro de Saídas (Consumo por Unidade)',
    description: 'Soma o valor total (R$) de materiais baixados/consumidos no almoxarifado no período selecionado.',
    dataSource: 'MOVEMENTS',
    calculationMode: 'SUM_VALUE',
    groupBy: 'CATEGORY',
    unitFormat: 'CURRENCY',
    targetValue: 25000,
    goalDirection: 'LOWER_IS_BETTER',
    movementTypeFilter: 'SAIDA',
    createdAt: '2026-09-25'
  }
];

const DATA_SOURCE_LABELS: Record<KpiDataSource, string> = {
  MOVEMENTS: 'Almoxarifado — Movimentações de Estoque',
  TRANSFERS: 'Almoxarifado — Transferências entre Unidades',
  REQUISITIONS: 'Almoxarifado — Solicitações de Material',
  PURCHASE_REQUESTS: 'Compras — Solicitações de Compra (SC)',
  PURCHASE_ORDERS: 'Compras — Ordens de Compra (OC)',
  STOCK_CATALOG: 'Almoxarifado — Catálogo & Posição de Estoque',
  COST_CENTERS: 'Financeiro — Centros de Custo & Orçamentos'
};

const CALC_MODE_LABELS: Record<KpiCalculationMode, string> = {
  SUM_VALUE: 'Soma Financeira Total (Σ R$)',
  SUM_QUANTITY: 'Soma de Quantidade Física (Σ Qtd)',
  COUNT_RECORDS: 'Contagem de Registros / Ocorrências (Nº)',
  AVG_VALUE: 'Média Financeira / Ticket Médio (R$ Médio)',
  FULFILLMENT_RATE_PCT: 'Taxa de Atendimento / Conclusão (Concluídos ÷ Total %)',
  CONSUMPTION_VS_STOCK_PCT: 'Índice de Giro / Consumo sobre Estoque (%)',
  BUDGET_COMMITMENT_PCT: 'Comprometimento do Orçamento (Realizado ÷ Orçado %)'
};

const GROUP_BY_LABELS: Record<KpiGroupBy, string> = {
  BRANCH: 'Por Unidade (SP, RJ, MG, PR...)',
  CATEGORY: 'Por Categoria de Material',
  STATUS: 'Por Status Operacional',
  COST_CENTER: 'Por Centro de Custo / Departamento',
  RESPONSIBLE_OR_SUPPLIER: 'Por Responsável / Solicitante / Fornecedor'
};

interface CustomKpiBuilderProps {
  globalBranch: Branch | 'GLOBAL';
  globalCategory: string;
  globalPeriod: string;
}

const STORAGE_KEY = 'almox_plus_custom_kpis_v1';

export const CustomKpiBuilder: React.FC<CustomKpiBuilderProps> = ({
  globalBranch,
  globalCategory,
  globalPeriod
}) => {
  const [kpis, setKpis] = useState<CustomKpiDefinition[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_CUSTOM_KPIS;
  });

  const [selectedKpiId, setSelectedKpiId] = useState<string>(() => kpis[0]?.id || 'kpi-custom-1');
  const [unitFilter, setUnitFilter] = useState<Branch | 'GLOBAL'>(globalBranch);
  const [categoryFilter, setCategoryFilter] = useState<string>(globalCategory);
  const [periodFilter, setPeriodFilter] = useState<string>(globalPeriod || 'ALL');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Modal state for creating / editing a custom KPI
  const [modalOpen, setModalOpen] = useState(false);
  const [showReadme, setShowReadme] = useState<boolean>(true);
  const [formState, setFormState] = useState<Omit<CustomKpiDefinition, 'id' | 'createdAt'>>({
    name: '',
    description: '',
    dataSource: 'MOVEMENTS',
    calculationMode: 'SUM_VALUE',
    groupBy: 'CATEGORY',
    unitFormat: 'CURRENCY',
    targetValue: 10000,
    goalDirection: 'HIGHER_IS_BETTER',
    movementTypeFilter: 'ALL'
  });

  useEffect(() => {
    setUnitFilter(globalBranch);
  }, [globalBranch]);

  useEffect(() => {
    setCategoryFilter(globalCategory);
  }, [globalCategory]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(kpis));
    } catch {
      // ignore
    }
  }, [kpis]);

  const state = dataService.getState();
  const activeBranches = useMemo(() => dataService.getBranches(true), [state.branches]);

  const productMap = useMemo(() => {
    const map = new Map<string, { category: string; code: string; name: string; unitPrice: number }>();
    state.products.forEach(p => {
      map.set(p.id, { category: p.category, code: p.code, name: p.name, unitPrice: p.unitPrice });
    });
    return map;
  }, [state.products]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    state.products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [state.products]);

  const activeKpi = useMemo(
    () => kpis.find(k => k.id === selectedKpiId) || kpis[0],
    [kpis, selectedKpiId]
  );

  // Date filter check
  const isDateInPeriod = (dateStr?: string): boolean => {
    if (!periodFilter || periodFilter === 'ALL') return true;
    if (!dateStr) return false;
    const ts = new Date(dateStr).getTime();
    if (isNaN(ts)) return false;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (periodFilter === 'HOJE' || periodFilter === 'TODAY') {
      return ts >= startOfToday.getTime() && ts <= endOfToday.getTime();
    }
    if (periodFilter === 'ULTIMOS_7_DIAS' || periodFilter === 'LAST_7_DAYS') {
      const s = new Date(startOfToday);
      s.setDate(s.getDate() - 6);
      return ts >= s.getTime() && ts <= endOfToday.getTime();
    }
    if (periodFilter === 'ULTIMOS_30_DIAS' || periodFilter === 'LAST_30_DAYS') {
      const s = new Date(startOfToday);
      s.setDate(s.getDate() - 29);
      return ts >= s.getTime() && ts <= endOfToday.getTime();
    }
    if (periodFilter === 'MES_ATUAL' || periodFilter === 'THIS_MONTH') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return ts >= s.getTime() && ts <= endOfToday.getTime();
    }
    if (periodFilter === 'TRIMESTRE' || periodFilter === 'LAST_90_DAYS') {
      const s = new Date(startOfToday);
      s.setDate(s.getDate() - 89);
      return ts >= s.getTime() && ts <= endOfToday.getTime();
    }
    if (periodFilter === 'CUSTOM') {
      const s = customStartDate ? new Date(`${customStartDate}T00:00:00`).getTime() : 0;
      const e = customEndDate ? new Date(`${customEndDate}T23:59:59.999`).getTime() : endOfToday.getTime();
      return ts >= s && ts <= e;
    }
    return true;
  };

  // Normalize records from the chosen DataSource into uniform analytical items
  const normalizedRecords = useMemo(() => {
    if (!activeKpi) return [];

    interface NormalizedItem {
      branch: string;
      category: string;
      status: string;
      costCenter: string;
      actor: string;
      value: number;
      quantity: number;
      isFulfilled: boolean;
      budgetBase: number;
    }

    const items: NormalizedItem[] = [];

    const matchUnit = (b: string) => unitFilter === 'GLOBAL' || b === unitFilter;
    const matchCat = (c: string) => categoryFilter === 'TODAS' || c.toLowerCase() === categoryFilter.toLowerCase();

    switch (activeKpi.dataSource) {
      case 'MOVEMENTS':
        state.movements.forEach(m => {
          if (activeKpi.movementTypeFilter && activeKpi.movementTypeFilter !== 'ALL' && m.type !== activeKpi.movementTypeFilter) {
            return;
          }
          const cat = productMap.get(m.productId)?.category || 'Geral';
          if (!matchUnit(m.branch) || !matchCat(cat) || !isDateInPeriod(m.date)) return;
          items.push({
            branch: m.branch,
            category: cat,
            status: m.type,
            costCenter: m.costCenterName || 'Estoque Geral',
            actor: m.responsibleUser,
            value: m.totalPrice,
            quantity: m.quantity,
            isFulfilled: m.type === 'ENTRADA' || m.type === 'SAIDA',
            budgetBase: m.totalPrice
          });
        });
        break;

      case 'TRANSFERS':
        state.transfers.forEach(t => {
          const cat = productMap.get(t.productId)?.category || 'Geral';
          const unitPrice = productMap.get(t.productId)?.unitPrice || 0;
          const bMatch = unitFilter === 'GLOBAL' || t.originBranch === unitFilter || t.destinationBranch === unitFilter;
          if (!bMatch || !matchCat(cat) || !isDateInPeriod(t.sentAt)) return;
          items.push({
            branch: `${t.originBranch} ➔ ${t.destinationBranch}`,
            category: cat,
            status: t.status === 'CONCLUIDO' ? 'Concluído' : t.status === 'EM_TRANSITO' ? 'Em Trânsito' : 'Cancelado',
            costCenter: `Logística (${t.originBranch})`,
            actor: t.sentBy || t.requestedBy || 'Almoxarifado',
            value: t.quantity * unitPrice,
            quantity: t.quantity,
            isFulfilled: t.status === 'CONCLUIDO',
            budgetBase: t.quantity * unitPrice
          });
        });
        break;

      case 'REQUISITIONS':
        state.requisitions.forEach(r => {
          if (!matchUnit(r.branch) || !isDateInPeriod(r.createdAt)) return;
          r.items.forEach(ri => {
            const cat = productMap.get(ri.productId)?.category || 'Geral';
            const unitPrice = productMap.get(ri.productId)?.unitPrice || 0;
            if (!matchCat(cat)) return;
            items.push({
              branch: r.branch,
              category: cat,
              status: r.status,
              costCenter: r.costCenterName || 'Geral',
              actor: r.requestedBy,
              value: ri.requestedQuantity * unitPrice,
              quantity: ri.requestedQuantity,
              isFulfilled: r.status === 'ATENDIDO' || r.status === 'APROVADO',
              budgetBase: ri.requestedQuantity * unitPrice
            });
          });
        });
        break;

      case 'PURCHASE_REQUESTS':
        (state.purchaseRequests || []).forEach(sc => {
          if (!matchUnit(sc.branch) || !isDateInPeriod(sc.createdAt)) return;
          sc.items.forEach(si => {
            const cat = si.category || productMap.get(si.productId)?.category || 'Geral';
            const unitPrice = si.negotiatedUnitPrice || si.estimatedUnitPrice || productMap.get(si.productId)?.unitPrice || 0;
            if (!matchCat(cat)) return;
            items.push({
              branch: sc.branch,
              category: cat,
              status: si.status,
              costCenter: sc.department || sc.costCenterName || 'Geral',
              actor: sc.requestedBy,
              value: si.quantity * unitPrice,
              quantity: si.quantity,
              isFulfilled: si.status === 'APROVADO',
              budgetBase: si.quantity * unitPrice
            });
          });
        });
        break;

      case 'PURCHASE_ORDERS':
        state.purchaseOrders.forEach(po => {
          if (!matchUnit(po.branch) || !isDateInPeriod(po.createdAt)) return;
          po.items.forEach(pi => {
            const cat = pi.category || productMap.get(pi.productId)?.category || 'Geral';
            if (!matchCat(cat)) return;
            items.push({
              branch: po.branch,
              category: cat,
              status: po.status,
              costCenter: po.costCenterName || 'Suprimentos',
              actor: po.supplierName,
              value: pi.totalPrice,
              quantity: pi.quantity,
              isFulfilled: po.status === 'ENTREGUE' || po.status === 'APROVADO',
              budgetBase: pi.totalPrice
            });
          });
        });
        break;

      case 'STOCK_CATALOG':
        state.products.forEach(p => {
          if (!p.active || !matchCat(p.category)) return;
          const qty = unitFilter === 'GLOBAL'
            ? Object.values(p.stockByBranch).reduce((a, b) => a + b, 0)
            : (p.stockByBranch[unitFilter] || 0);
          items.push({
            branch: unitFilter === 'GLOBAL' ? 'Todas as Unidades' : unitFilter,
            category: p.category,
            status: qty <= p.minStock ? 'Crítico (Repor)' : 'Regular',
            costCenter: `Slot ${p.locationSlot}`,
            actor: p.name,
            value: qty * p.unitPrice,
            quantity: qty,
            isFulfilled: qty > p.minStock,
            budgetBase: p.maxStock * p.unitPrice
          });
        });
        break;

      case 'COST_CENTERS': {
        const comparisons = dataService.getCostCenterComparisons(unitFilter);
        comparisons.forEach(c => {
          items.push({
            branch: c.costCenter.branch,
            category: categoryFilter === 'TODAS' ? 'Orçamento Corporativo' : categoryFilter,
            status: c.remainingBudget >= 0 ? 'Dentro do Orçamento' : 'Estourado',
            costCenter: `${c.costCenter.code} - ${c.costCenter.name}`,
            actor: c.costCenter.responsible,
            value: c.totalPurchased,
            quantity: c.purchaseOrders.length + c.requisitions.length,
            isFulfilled: c.remainingBudget >= 0,
            budgetBase: c.budget
          });
        });
        break;
      }
    }

    return items;
  }, [activeKpi, state, unitFilter, categoryFilter, periodFilter, customStartDate, customEndDate, productMap]);

  // Compute metric for a subset of normalized items
  const computeMetricValue = (subset: typeof normalizedRecords, mode: KpiCalculationMode): number => {
    if (subset.length === 0) return 0;
    const sumVal = subset.reduce((acc, r) => acc + r.value, 0);
    const sumQty = subset.reduce((acc, r) => acc + r.quantity, 0);
    const fulfilledCount = subset.filter(r => r.isFulfilled).length;
    const sumBudget = subset.reduce((acc, r) => acc + r.budgetBase, 0);

    switch (mode) {
      case 'SUM_VALUE':
        return sumVal;
      case 'SUM_QUANTITY':
        return sumQty;
      case 'COUNT_RECORDS':
        return subset.length;
      case 'AVG_VALUE':
        return sumVal / subset.length;
      case 'FULFILLMENT_RATE_PCT':
        return (fulfilledCount / subset.length) * 100;
      case 'CONSUMPTION_VS_STOCK_PCT':
      case 'BUDGET_COMMITMENT_PCT':
        return sumBudget > 0 ? (sumVal / sumBudget) * 100 : 0;
      default:
        return sumVal;
    }
  };

  // Overall KPI Value & Grouped Breakdown
  const kpiEvaluation = useMemo(() => {
    if (!activeKpi) return { overallValue: 0, breakdown: [], status: 'REGULAR' as const };

    const overallValue = computeMetricValue(normalizedRecords, activeKpi.calculationMode);

    // Group by selected dimension
    const groups = new Map<string, typeof normalizedRecords>();
    normalizedRecords.forEach(item => {
      const key =
        activeKpi.groupBy === 'BRANCH' ? item.branch :
        activeKpi.groupBy === 'CATEGORY' ? item.category :
        activeKpi.groupBy === 'STATUS' ? item.status :
        activeKpi.groupBy === 'COST_CENTER' ? item.costCenter :
        item.actor;

      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    });

    const breakdown = Array.from(groups.entries()).map(([dimensionLabel, groupItems]) => {
      const val = computeMetricValue(groupItems, activeKpi.calculationMode);
      const totalVal = groupItems.reduce((a, b) => a + b.value, 0);
      const totalQty = groupItems.reduce((a, b) => a + b.quantity, 0);
      const meetsGoal =
        activeKpi.goalDirection === 'HIGHER_IS_BETTER'
          ? val >= activeKpi.targetValue
          : val <= activeKpi.targetValue;

      return {
        dimensionLabel,
        recordsCount: groupItems.length,
        totalQty,
        totalVal,
        kpiValue: val,
        meetsGoal
      };
    }).sort((a, b) => b.kpiValue - a.kpiValue);

    const overallMeetsGoal =
      activeKpi.goalDirection === 'HIGHER_IS_BETTER'
        ? overallValue >= activeKpi.targetValue
        : overallValue <= activeKpi.targetValue;

    return {
      overallValue,
      breakdown,
      overallMeetsGoal
    };
  }, [activeKpi, normalizedRecords]);

  const formatMetric = (val: number, format: CustomKpiDefinition['unitFormat']) => {
    if (format === 'CURRENCY') {
      return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (format === 'PERCENTAGE') {
      return `${val.toFixed(1)}%`;
    }
    return val.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  };

  const handleSaveNewKpi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name.trim()) return;

    const newKpi: CustomKpiDefinition = {
      ...formState,
      id: `kpi-custom-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0]
    };

    setKpis(prev => [newKpi, ...prev]);
    setSelectedKpiId(newKpi.id);
    setModalOpen(false);
  };

  const handleDeleteKpi = (id: string) => {
    if (kpis.length <= 1) return;
    const remaining = kpis.filter(k => k.id !== id);
    setKpis(remaining);
    if (selectedKpiId === id) {
      setSelectedKpiId(remaining[0].id);
    }
  };

  const handleExportCustomKpiExcel = () => {
    if (!activeKpi) return;
    const rows = kpiEvaluation.breakdown.map(b => ({
      Indicador_KPI: activeKpi.name,
      Fonte_Modulo: DATA_SOURCE_LABELS[activeKpi.dataSource],
      Unidade_Filtro: unitFilter,
      Categoria_Filtro: categoryFilter,
      Periodo_Filtro: periodFilter === 'CUSTOM' ? `${customStartDate} a ${customEndDate}` : periodFilter,
      Dimensao_Agrupamento: b.dimensionLabel,
      Qtd_Registros_Analisados: b.recordsCount,
      Volume_Fisico_Acumulado: b.totalQty,
      Volume_Financeiro_Acumulado: `R$ ${b.totalVal.toFixed(2)}`,
      Resultado_Indicador: formatMetric(b.kpiValue, activeKpi.unitFormat),
      Meta_Estabelecida: formatMetric(activeKpi.targetValue, activeKpi.unitFormat),
      Status_Meta: b.meetsGoal ? 'META ATINGIDA' : 'FORA DA META'
    }));

    exportToExcel(
      rows,
      `KPI_Personalizado_${activeKpi.name.replace(/\s+/g, '_')}_${unitFilter}_${categoryFilter}`
    );
  };

  const handleExportCustomKpiPDF = () => {
    if (!activeKpi || kpiEvaluation.breakdown.length === 0) return;
    const headers = [
      GROUP_BY_LABELS[activeKpi.groupBy],
      'Registros',
      'Qtd Física',
      'Volume (R$)',
      'Resultado KPI',
      'Meta',
      'Status'
    ];
    const rows = kpiEvaluation.breakdown.map(b => [
      b.dimensionLabel,
      String(b.recordsCount),
      String(b.totalQty),
      `R$ ${b.totalVal.toFixed(2)}`,
      formatMetric(b.kpiValue, activeKpi.unitFormat),
      formatMetric(activeKpi.targetValue, activeKpi.unitFormat),
      b.meetsGoal ? 'META ATINGIDA' : 'ATENÇÃO / ABAIXO'
    ]);

    const periodText = periodFilter === 'CUSTOM' ? `${customStartDate} até ${customEndDate}` : periodFilter;

    exportToPDF(
      `KPI Personalizado: ${activeKpi.name}`,
      headers,
      rows,
      `KPI_${activeKpi.name.replace(/\s+/g, '_')}_${unitFilter}`,
      `Unidade: ${unitFilter} | Categoria: ${categoryFilter} | Período: ${periodText} | Resultado Geral: ${formatMetric(kpiEvaluation.overallValue, activeKpi.unitFormat)} (Meta: ${formatMetric(activeKpi.targetValue, activeKpi.unitFormat)})`
    );
  };

  return (
    <Box className="space-y-5">
      {/* Top Banner: Construtor de KPIs Self-Service BI */}
      <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <Typography variant="h6" className="font-extrabold text-slate-900 dark:text-white text-base">
                Construtor de KPIs & Relatórios Personalizados (Self-Service BI)
              </Typography>
            </div>
            <Typography variant="body2" className="text-slate-700 dark:text-slate-300 text-xs font-medium max-w-3xl">
              Crie seus próprios indicadores combinando <strong className="text-slate-900 dark:text-white">Módulo / Fonte de Dados</strong>, <strong className="text-slate-900 dark:text-white">Fórmula de Cálculo</strong>, <strong className="text-slate-900 dark:text-white">Agrupamento (Dimensão)</strong> e <strong className="text-slate-900 dark:text-white">Meta (Semáforo)</strong>, com exportação em Excel e PDF filtrada por Unidade, Categoria e Período.
            </Typography>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="outlined"
              onClick={() => setShowReadme(prev => !prev)}
              startIcon={<BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
              endIcon={showReadme ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              className="border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 font-bold text-xs py-2.5 px-3.5 rounded-xl"
            >
              {showReadme ? 'Ocultar Instruções (Read-Me)' : '📖 Como Criar KPI (Instruções)'}
            </Button>

            <Button
              variant="contained"
              onClick={() => setModalOpen(true)}
              startIcon={<Plus className="w-4 h-4 text-white" />}
              className="!bg-blue-600 hover:!bg-blue-700 !text-white font-extrabold text-xs py-2.5 px-4 rounded-xl shadow-sm"
              sx={{ color: '#ffffff !important', backgroundColor: '#2563eb' }}
            >
              Criar Novo Indicador (KPI)
            </Button>
          </div>
        </div>
      </Card>

      {/* READ-ME / MANUAL DE INSTRUÇÕES PASSO A PASSO INTEGRADO AO MÓDULO */}
      {showReadme && (
        <Card className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/30 dark:bg-slate-900 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-blue-200/70 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div>
                <Typography variant="subtitle1" className="font-extrabold text-slate-900 dark:text-white text-sm">
                  📖 Guia Rápido (Read-Me): Como Criar e Configurar seu Indicador de KPI Personalizado
                </Typography>
                <Typography variant="caption" className="text-slate-600 dark:text-slate-400 block">
                  Siga os 4 passos abaixo para montar qualquer indicador gerencial sob medida ou clique em um dos modelos prontos para preencher automaticamente.
                </Typography>
              </div>
            </div>

            <Chip
              label="Manual Interativo do Usuário"
              color="primary"
              size="small"
              variant="outlined"
              className="font-bold text-[10px]"
            />
          </div>

          {/* 4 Step-by-Step Instruction Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                  1
                </span>
                <Typography className="font-extrabold text-xs text-slate-900 dark:text-white">
                  Escolha a Fonte de Dados
                </Typography>
              </div>
              <Typography variant="caption" className="text-slate-600 dark:text-slate-300 text-[11px] block leading-relaxed">
                Defina de qual módulo o KPI buscará os registros:
              </Typography>
              <ul className="text-[11px] text-slate-700 dark:text-slate-300 space-y-0.5 pl-3 list-disc">
                <li><strong>Movimentações:</strong> Entradas e saídas do estoque.</li>
                <li><strong>Transferências:</strong> Envios entre unidades.</li>
                <li><strong>Solicitações Material:</strong> Requisições internas.</li>
                <li><strong>Compras (SC / OC):</strong> Cotações e pedidos.</li>
                <li><strong>Centros de Custo:</strong> Orçamento x gastos.</li>
              </ul>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                  2
                </span>
                <Typography className="font-extrabold text-xs text-slate-900 dark:text-white">
                  Selecione a Fórmula
                </Typography>
              </div>
              <Typography variant="caption" className="text-slate-600 dark:text-slate-300 text-[11px] block leading-relaxed">
                Escolha o cálculo matemático que o ERP fará sozinho:
              </Typography>
              <ul className="text-[11px] text-slate-700 dark:text-slate-300 space-y-0.5 pl-3 list-disc">
                <li><strong>Soma Financeira (R$):</strong> Total gasto/movimentado.</li>
                <li><strong>Média / Ticket Médio:</strong> Valor médio por pedido/item.</li>
                <li><strong>Taxa de Atendimento (%):</strong> % de pedidos concluídos/aprovados sobre o total.</li>
                <li><strong>Comprometimento (%):</strong> % do orçamento já gasto.</li>
              </ul>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                  3
                </span>
                <Typography className="font-extrabold text-xs text-slate-900 dark:text-white">
                  Defina o Agrupamento
                </Typography>
              </div>
              <Typography variant="caption" className="text-slate-600 dark:text-slate-300 text-[11px] block leading-relaxed">
                Escolha como deseja dividir as linhas da tabela analítica:
              </Typography>
              <ul className="text-[11px] text-slate-700 dark:text-slate-300 space-y-0.5 pl-3 list-disc">
                <li><strong>Por Unidade:</strong> Compara SP, RJ, MG, PR, etc.</li>
                <li><strong>Por Categoria:</strong> Compara EPI, TI, Elétrica, etc.</li>
                <li><strong>Por Centro de Custo:</strong> Compara setores/obras.</li>
                <li><strong>Por Fornecedor / Solicitante:</strong> Ranking por pessoa ou empresa.</li>
              </ul>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                  4
                </span>
                <Typography className="font-extrabold text-xs text-slate-900 dark:text-white">
                  Configure Meta e Exporte
                </Typography>
              </div>
              <Typography variant="caption" className="text-slate-600 dark:text-slate-300 text-[11px] block leading-relaxed">
                Ative o semáforo automático e exporte:
              </Typography>
              <ul className="text-[11px] text-slate-700 dark:text-slate-300 space-y-0.5 pl-3 list-disc">
                <li><strong>Maior é Melhor (≥):</strong> Ideal para metas de entrega e produtividade (ex: Meta ≥ 85%).</li>
                <li><strong>Menor é Melhor (≤):</strong> Ideal para teto de gastos/custos (ex: Meta ≤ R$ 20.000).</li>
                <li>Use os filtros de <strong>Unidade, Categoria e Período</strong> e exporte em <strong>Excel ou PDF</strong>.</li>
              </ul>
            </div>
          </div>

          {/* Quick 1-Click Recipes */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/60 border border-blue-200/80 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
              <Typography variant="caption" className="text-slate-800 dark:text-slate-200 font-bold text-xs">
                Dica Rápida — Clique em um modelo abaixo para abrir o criador já preenchido como exemplo:
              </Typography>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  setFormState({
                    name: 'SLA de Recebimento de Transferências (%)',
                    description: 'Percentual de transferências entre unidades já concluídas/recebidas no destino.',
                    dataSource: 'TRANSFERS',
                    calculationMode: 'FULFILLMENT_RATE_PCT',
                    groupBy: 'BRANCH',
                    unitFormat: 'PERCENTAGE',
                    targetValue: 90,
                    goalDirection: 'HIGHER_IS_BETTER',
                    movementTypeFilter: 'ALL'
                  });
                  setModalOpen(true);
                }}
                className="text-[11px] font-bold border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg py-1 px-2.5"
              >
                ⚡ Modelo 1: SLA de Transferências (%)
              </Button>

              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  setFormState({
                    name: 'Comprometimento Orçamentário por Setor (%)',
                    description: 'Percentual do orçamento anual já comprometido com compras em cada Centro de Custo.',
                    dataSource: 'COST_CENTERS',
                    calculationMode: 'BUDGET_COMMITMENT_PCT',
                    groupBy: 'COST_CENTER',
                    unitFormat: 'PERCENTAGE',
                    targetValue: 80,
                    goalDirection: 'LOWER_IS_BETTER',
                    movementTypeFilter: 'ALL'
                  });
                  setModalOpen(true);
                }}
                className="text-[11px] font-bold border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg py-1 px-2.5"
              >
                💰 Modelo 2: Consumo de Orçamento (%)
              </Button>

              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  setFormState({
                    name: 'Volume de Compras por Fornecedor (R$)',
                    description: 'Total financeiro adquirido em Ordens de Compra agrupado por fornecedor homologado.',
                    dataSource: 'PURCHASE_ORDERS',
                    calculationMode: 'SUM_VALUE',
                    groupBy: 'RESPONSIBLE_OR_SUPPLIER',
                    unitFormat: 'CURRENCY',
                    targetValue: 50000,
                    goalDirection: 'LOWER_IS_BETTER',
                    movementTypeFilter: 'ALL'
                  });
                  setModalOpen(true);
                }}
                className="text-[11px] font-bold border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg py-1 px-2.5"
              >
                🛒 Modelo 3: Compras por Fornecedor (R$)
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Gallery of User's Custom KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {kpis.map(kpi => {
          const isSelected = kpi.id === activeKpi?.id;
          return (
            <Card
              key={kpi.id}
              onClick={() => setSelectedKpiId(kpi.id)}
              className={`cursor-pointer rounded-2xl p-4 transition-all border ${
                isSelected
                  ? 'border-blue-600 dark:border-blue-400 bg-blue-50/40 dark:bg-blue-950/30 shadow-sm ring-1 ring-blue-500'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <Chip
                  label={DATA_SOURCE_LABELS[kpi.dataSource].split('—')[0].trim()}
                  size="small"
                  color={isSelected ? 'primary' : 'default'}
                  className="font-bold text-[10px] h-5"
                />
                {kpis.length > 1 && (
                  <Tooltip title="Excluir Indicador">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteKpi(kpi.id);
                      }}
                      className="p-0.5 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </IconButton>
                  </Tooltip>
                )}
              </div>

              <Typography className="font-extrabold text-xs text-slate-900 dark:text-slate-100 mt-2 line-clamp-2">
                {kpi.name}
              </Typography>
              <Typography variant="caption" className="text-slate-500 text-[11px] block mt-1 line-clamp-2">
                {CALC_MODE_LABELS[kpi.calculationMode]}
              </Typography>

              <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                <span className="text-slate-500 font-medium">
                  Meta: <strong>{formatMetric(kpi.targetValue, kpi.unitFormat)}</strong>
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-bold">
                  {isSelected ? '● Em Exibição' : 'Selecionar →'}
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Active KPI Workspace & Filter Bar (Unidade, Categoria, Período) */}
      {activeKpi && (
        <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900 shadow-xs space-y-5">
          {/* Filter & Export Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-blue-600" />
                <Typography variant="h6" className="font-extrabold text-slate-900 dark:text-slate-100 text-base">
                  {activeKpi.name}
                </Typography>
              </div>
              <Typography variant="caption" className="text-slate-500 text-xs block mt-0.5">
                {activeKpi.description || `${DATA_SOURCE_LABELS[activeKpi.dataSource]} • ${CALC_MODE_LABELS[activeKpi.calculationMode]}`}
              </Typography>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="contained"
                onClick={handleExportCustomKpiExcel}
                disabled={kpiEvaluation.breakdown.length === 0}
                startIcon={<FileSpreadsheet className="w-4 h-4 text-white" />}
                className="!bg-emerald-600 hover:!bg-emerald-700 !text-white font-bold text-xs py-2 px-3.5 rounded-xl shadow-xs"
                sx={{ color: '#ffffff !important' }}
              >
                Exportar KPI Excel
              </Button>
              <Button
                variant="contained"
                onClick={handleExportCustomKpiPDF}
                disabled={kpiEvaluation.breakdown.length === 0}
                startIcon={<FileText className="w-4 h-4 text-white" />}
                className="!bg-rose-600 hover:!bg-rose-700 !text-white font-bold text-xs py-2 px-3.5 rounded-xl shadow-xs"
                sx={{ color: '#ffffff !important' }}
              >
                Exportar KPI PDF
              </Button>
            </div>
          </div>

          {/* Mandatory Selectors: Unidade, Categoria, Período, Agrupamento Dinâmico */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <FormControl fullWidth size="small" className="bg-white dark:bg-slate-900 rounded-lg">
              <InputLabel>Unidade do KPI</InputLabel>
              <Select
                value={unitFilter}
                label="Unidade do KPI"
                onChange={(e) => setUnitFilter(e.target.value as any)}
                className="text-xs font-bold"
              >
                <MenuItem value="GLOBAL">🌐 GLOBAL (Todas as Unidades)</MenuItem>
                {activeBranches.map(b => (
                  <MenuItem key={b.id} value={b.code}>Unidade {b.code} ({b.city})</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small" className="bg-white dark:bg-slate-900 rounded-lg">
              <InputLabel>Categoria</InputLabel>
              <Select
                value={categoryFilter}
                label="Categoria"
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs font-bold"
              >
                <MenuItem value="TODAS">🏷️ Todas as Categorias</MenuItem>
                {availableCategories.map(cat => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small" className="bg-white dark:bg-slate-900 rounded-lg">
              <InputLabel>Período de Apuração</InputLabel>
              <Select
                value={periodFilter}
                label="Período de Apuração"
                onChange={(e) => setPeriodFilter(e.target.value)}
                className="text-xs font-bold"
              >
                <MenuItem value="ALL">📅 Todo o Período</MenuItem>
                <MenuItem value="HOJE">⚡ Hoje</MenuItem>
                <MenuItem value="ULTIMOS_7_DIAS">📆 Últimos 7 Dias</MenuItem>
                <MenuItem value="ULTIMOS_30_DIAS">📆 Últimos 30 Dias</MenuItem>
                <MenuItem value="MES_ATUAL">🗓️ Mês Atual</MenuItem>
                <MenuItem value="TRIMESTRE">📊 Últimos 90 Dias</MenuItem>
                <MenuItem value="CUSTOM" className="font-bold text-blue-600">🎯 Período Personalizado</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth size="small" className="bg-white dark:bg-slate-900 rounded-lg">
              <InputLabel>Agrupar Relatório Por</InputLabel>
              <Select
                value={activeKpi.groupBy}
                label="Agrupar Relatório Por"
                onChange={(e) => {
                  const newGroup = e.target.value as KpiGroupBy;
                  setKpis(prev => prev.map(k => k.id === activeKpi.id ? { ...k, groupBy: newGroup } : k));
                }}
                className="text-xs font-bold"
              >
                <MenuItem value="BRANCH">🏢 Por Unidade</MenuItem>
                <MenuItem value="CATEGORY">🏷️ Por Categoria</MenuItem>
                <MenuItem value="COST_CENTER">💼 Por Centro de Custo / Setor</MenuItem>
                <MenuItem value="STATUS"> 📌 Por Status</MenuItem>
                <MenuItem value="RESPONSIBLE_OR_SUPPLIER">👤 Por Solicitante / Fornecedor</MenuItem>
              </Select>
            </FormControl>

            {periodFilter === 'CUSTOM' && (
              <>
                <TextField
                  size="small"
                  type="date"
                  label="Data Inicial (De)"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  className="bg-white dark:bg-slate-900 rounded-lg"
                />
                <TextField
                  size="small"
                  type="date"
                  label="Data Final (Até)"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  className="bg-white dark:bg-slate-900 rounded-lg"
                />
              </>
            )}
          </div>

          {/* Executive Scorecard Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
              <Typography variant="caption" className="font-bold text-slate-500 uppercase text-[10px]">
                Resultado Consolidado do Indicador
              </Typography>
              <Typography variant="h4" className="font-extrabold text-blue-600 dark:text-blue-400 mt-1">
                {formatMetric(kpiEvaluation.overallValue, activeKpi.unitFormat)}
              </Typography>
              <Typography variant="caption" className="text-slate-500 text-[11px] block mt-1">
                Baseado em {normalizedRecords.length} registros filtrados
              </Typography>
            </Card>

            <Card className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
              <Typography variant="caption" className="font-bold text-slate-500 uppercase text-[10px]">
                Meta Configurada pelo Usuário
              </Typography>
              <Typography variant="h4" className="font-extrabold text-slate-800 dark:text-slate-100 mt-1">
                {formatMetric(activeKpi.targetValue, activeKpi.unitFormat)}
              </Typography>
              <Typography variant="caption" className="text-slate-500 text-[11px] block mt-1">
                Critério: {activeKpi.goalDirection === 'HIGHER_IS_BETTER' ? 'Quanto maior, melhor (≥ Meta)' : 'Quanto menor, melhor (≤ Meta)'}
              </Typography>
            </Card>

            <Card
              className={`p-4 rounded-xl border ${
                kpiEvaluation.overallMeetsGoal
                  ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20'
                  : 'border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20'
              }`}
            >
              <Typography variant="caption" className="font-bold uppercase text-[10px] text-slate-600 dark:text-slate-300">
                 Diagnóstico / Semáforo de Performance
              </Typography>
              <div className="flex items-center gap-2 mt-1.5">
                {kpiEvaluation.overallMeetsGoal ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                )}
                <Typography className={`font-extrabold text-base ${kpiEvaluation.overallMeetsGoal ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'}`}>
                  {kpiEvaluation.overallMeetsGoal ? 'DENTRO DA META' : 'ATENÇÃO / FORA DA META'}
                </Typography>
              </div>
              <Typography variant="caption" className="text-slate-500 text-[11px] block mt-1">
                Fonte: {DATA_SOURCE_LABELS[activeKpi.dataSource]}
              </Typography>
            </Card>
          </div>

          {/* Visual Bar Chart + Analytical Table Breakdown */}
          <div className="space-y-2">
            <Typography variant="subtitle2" className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
              Desdobramento Analítico ({GROUP_BY_LABELS[activeKpi.groupBy]})
            </Typography>

            <Box className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
              <Table size="small">
                <TableHead className="bg-slate-100 dark:bg-slate-800">
                  <TableRow>
                    <TableCell className="font-bold text-xs">{GROUP_BY_LABELS[activeKpi.groupBy]}</TableCell>
                    <TableCell align="center" className="font-bold text-xs">Registros</TableCell>
                    <TableCell align="right" className="font-bold text-xs">Volume Físico</TableCell>
                    <TableCell align="right" className="font-bold text-xs">Volume Financeiro</TableCell>
                    <TableCell align="right" className="font-bold text-xs">Resultado KPI</TableCell>
                    <TableCell className="font-bold text-xs w-48">Comparativo Visual</TableCell>
                    <TableCell align="center" className="font-bold text-xs">Status vs Meta</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {kpiEvaluation.breakdown.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" className="py-8 text-slate-400 text-xs">
                        Nenhum dado encontrado para os filtros selecionados (Unidade: {unitFilter}, Categoria: {categoryFilter}).
                      </TableCell>
                    </TableRow>
                  ) : (
                    kpiEvaluation.breakdown.map((row, idx) => {
                      const maxKpiVal = Math.max(...kpiEvaluation.breakdown.map(x => x.kpiValue), activeKpi.targetValue, 1);
                      const pctBar = Math.min(100, Math.round((row.kpiValue / maxKpiVal) * 100));
                      return (
                        <TableRow key={idx} hover>
                          <TableCell className="font-bold text-xs text-slate-900 dark:text-slate-100">
                            {row.dimensionLabel}
                          </TableCell>
                          <TableCell align="center" className="text-xs">
                            {row.recordsCount}
                          </TableCell>
                          <TableCell align="right" className="text-xs">
                            {row.totalQty.toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell align="right" className="text-xs font-medium">
                            R$ {row.totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell align="right" className="font-extrabold text-xs text-blue-700 dark:text-blue-400">
                            {formatMetric(row.kpiValue, activeKpi.unitFormat)}
                          </TableCell>
                          <TableCell>
                            <LinearProgress
                              variant="determinate"
                              value={pctBar}
                              color={row.meetsGoal ? 'success' : 'warning'}
                              className="h-2 rounded-full bg-slate-100 dark:bg-slate-800"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={row.meetsGoal ? 'Meta Atingida' : 'Fora da Meta'}
                              size="small"
                              color={row.meetsGoal ? 'success' : 'warning'}
                              className="font-bold text-[10px] h-5"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </Box>
          </div>
        </Card>
      )}

      {/* Modal: Criar Novo Indicador (KPI) Personalizado */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSaveNewKpi}>
          <DialogTitle className="font-extrabold flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-600" />
            Criar Novo Indicador de KPI Personalizado
          </DialogTitle>
          <DialogContent dividers className="space-y-4">
            <Alert severity="info" className="rounded-xl text-xs">
              <strong>Passo a Passo:</strong> Dê um nome ao indicador, escolha o <strong>Módulo (Passo 1)</strong>, a <strong>Fórmula (Passo 2)</strong>, como deseja <strong>Agrupar (Passo 3)</strong> e defina a <strong>Meta (Passo 4)</strong>.
            </Alert>

            <TextField
              fullWidth
              size="small"
              label="Nome do Indicador (KPI)"
              placeholder="Ex: Custo Médio de Saídas por Centro de Custo"
              value={formState.name}
              onChange={(e) => setFormState({ ...formState, name: e.target.value })}
              required
            />

            <TextField
              fullWidth
              size="small"
              label="Objetivo / Descrição do Indicador"
              placeholder="Ex: Monitora o consumo financeiro de materiais por setor para controle mensal"
              value={formState.description}
              onChange={(e) => setFormState({ ...formState, description: e.target.value })}
            />

            <FormControl fullWidth size="small">
              <InputLabel>1. Módulo / Fonte de Dados</InputLabel>
              <Select
                value={formState.dataSource}
                label="1. Módulo / Fonte de Dados"
                onChange={(e) => setFormState({ ...formState, dataSource: e.target.value as KpiDataSource })}
              >
                {Object.entries(DATA_SOURCE_LABELS).map(([k, label]) => (
                  <MenuItem key={k} value={k}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {formState.dataSource === 'MOVEMENTS' && (
              <FormControl fullWidth size="small">
                <InputLabel>Filtro de Tipo de Movimentação</InputLabel>
                <Select
                  value={formState.movementTypeFilter || 'ALL'}
                  label="Filtro de Tipo de Movimentação"
                  onChange={(e) => setFormState({ ...formState, movementTypeFilter: e.target.value as any })}
                >
                  <MenuItem value="ALL">Todas (Entradas + Saídas)</MenuItem>
                  <MenuItem value="SAIDA">Apenas Saídas / Consumo (-)</MenuItem>
                  <MenuItem value="ENTRADA">Apenas Entradas / Recebimentos (+)</MenuItem>
                </Select>
              </FormControl>
            )}

            <FormControl fullWidth size="small">
              <InputLabel>2. Fórmula / Regra de Cálculo</InputLabel>
              <Select
                value={formState.calculationMode}
                label="2. Fórmula / Regra de Cálculo"
                onChange={(e) => {
                  const mode = e.target.value as KpiCalculationMode;
                  const defaultUnit =
                    mode === 'FULFILLMENT_RATE_PCT' || mode === 'CONSUMPTION_VS_STOCK_PCT' || mode === 'BUDGET_COMMITMENT_PCT'
                      ? 'PERCENTAGE'
                      : mode === 'SUM_VALUE' || mode === 'AVG_VALUE'
                      ? 'CURRENCY'
                      : 'NUMBER';
                  setFormState({ ...formState, calculationMode: mode, unitFormat: defaultUnit });
                }}
              >
                {Object.entries(CALC_MODE_LABELS).map(([k, label]) => (
                  <MenuItem key={k} value={k}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>3. Dimensão de Agrupamento Padrão</InputLabel>
              <Select
                value={formState.groupBy}
                label="3. Dimensão de Agrupamento Padrão"
                onChange={(e) => setFormState({ ...formState, groupBy: e.target.value as KpiGroupBy })}
              >
                {Object.entries(GROUP_BY_LABELS).map(([k, label]) => (
                  <MenuItem key={k} value={k}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormControl fullWidth size="small">
                <InputLabel>Formato</InputLabel>
                <Select
                  value={formState.unitFormat}
                  label="Formato"
                  onChange={(e) => setFormState({ ...formState, unitFormat: e.target.value as any })}
                >
                  <MenuItem value="CURRENCY">Moeda (R$)</MenuItem>
                  <MenuItem value="PERCENTAGE">Percentual (%)</MenuItem>
                  <MenuItem value="NUMBER">Numérico (Qtd)</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                size="small"
                type="number"
                label="Valor da Meta (Target)"
                value={formState.targetValue}
                onChange={(e) => setFormState({ ...formState, targetValue: Number(e.target.value) })}
              />

              <FormControl fullWidth size="small">
                <InputLabel>Direção da Meta</InputLabel>
                <Select
                  value={formState.goalDirection}
                  label="Direção da Meta"
                  onChange={(e) => setFormState({ ...formState, goalDirection: e.target.value as KpiGoalDirection })}
                >
                  <MenuItem value="HIGHER_IS_BETTER">Maior é Melhor (≥)</MenuItem>
                  <MenuItem value="LOWER_IS_BETTER">Menor é Melhor (≤)</MenuItem>
                </Select>
              </FormControl>
            </div>
          </DialogContent>
          <DialogActions className="p-4">
            <Button onClick={() => setModalOpen(false)} className="text-slate-600 font-bold">
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="contained"
              className="!bg-blue-600 hover:!bg-blue-700 !text-white font-bold px-5 rounded-xl"
              sx={{ color: '#ffffff !important', backgroundColor: '#2563eb' }}
            >
              Salvar e Gerar Indicador
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};
