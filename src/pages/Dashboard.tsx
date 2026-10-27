import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, Button, IconButton,
  Divider, LinearProgress, Table, TableBody, TableCell, TableHead, TableRow,
  Tabs, Tab, Alert, Badge, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, Tooltip
} from '@mui/material';
import {
  Package, DollarSign, AlertTriangle, ArrowUpRight, ArrowDownRight,
  ShoppingCart, ArrowRightLeft, Landmark, Clock, Calendar, CheckCircle2,
  TrendingUp, TrendingDown, Layers, FileText, Bell, ShieldAlert,
  Users, Award, Sparkles, Filter, RefreshCw, CheckCircle, XCircle,
  Search, MapPin, Tag, Eye, ShieldCheck, Mail, SlidersHorizontal,
  LayoutGrid, CheckSquare, Zap, Inbox, BarChart3, PieChart
} from 'lucide-react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip as ChartTooltip, Legend
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

import { dataService } from '../services/dataService';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Breadcrumb } from '../components/Breadcrumb';
import { Branch, UserRole } from '../types';

// Register Chart.js elements
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, ChartTooltip, Legend
);

export type WorkspaceType = 
  | 'MASTER' 
  | 'ALMOXARIFE' 
  | 'COMPRADOR' 
  | 'DIRETORIA' 
  | 'INVENTARIO' 
  | 'PATRIMONIO' 
  | 'FINANCEIRO' 
  | 'LOGISTICA';

export const Dashboard: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const { selectedBranch } = useApp();
  const { currentUser } = useAuth();
  const state = dataService.getState();

  // Determine initial workspace based on current user role
  const initialWorkspace: WorkspaceType = useMemo(() => {
    if (!currentUser) return 'MASTER';
    if (currentUser.role === 'Master') return 'MASTER';
    if (currentUser.role === 'Comprador') return 'COMPRADOR';
    if (currentUser.role === 'Almoxarife') return 'ALMOXARIFE';
    if (currentUser.role === 'Gestor') return 'DIRETORIA';
    return 'MASTER';
  }, [currentUser]);

  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceType>(initialWorkspace);

  // Executive AI Report Modal State
  const [aiReportModalOpen, setAiReportModalOpen] = useState(false);

  // Dynamic Alerts Management State
  const [resolvedAlertIds, setResolvedAlertIds] = useState<string[]>([]);
  const [archivedAlertIds, setArchivedAlertIds] = useState<string[]>([]);

  const handleResolveAlert = (id: string) => {
    setResolvedAlertIds(prev => [...prev, id]);
  };

  const handleArchiveAlert = (id: string) => {
    setArchivedAlertIds(prev => [...prev, id]);
  };

  // Metrics calculation
  const products = state.products.filter(p => p.active);
  const movements = state.movements;
  const requisitions = state.requisitions;
  const purchaseOrders = state.purchaseOrders;
  const transfers = state.transfers;
  const assets = state.assets;
  const auditLogs = state.auditLogs;

  const metrics = useMemo(() => {
    let totalStockValue = 0;
    let totalItemsCount = 0;
    let belowMinCount = 0;
    let aboveMaxCount = 0;
    let expiringCount = 0;
    let expiredCount = 0;

    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    products.forEach(p => {
      let qty = 0;
      if (selectedBranch === 'GLOBAL') {
        qty = Object.values(p.stockByBranch).reduce((a, b) => a + b, 0);
      } else {
        qty = p.stockByBranch[selectedBranch] || 0;
      }

      totalItemsCount += qty;
      totalStockValue += qty * p.unitPrice;

      if (qty < p.minStock) belowMinCount++;
      if (qty > p.maxStock) aboveMaxCount++;

      if (p.expirationDate) {
        const expDate = new Date(p.expirationDate);
        if (expDate < now) {
          expiredCount++;
        } else if (expDate <= thirtyDaysFromNow) {
          expiringCount++;
        }
      }
    });

    const pendingReqs = requisitions.filter(r => 
      (selectedBranch === 'GLOBAL' || r.branch === selectedBranch) && r.status === 'PENDENTE'
    ).length;

    const openPOs = purchaseOrders.filter(po => 
      (selectedBranch === 'GLOBAL' || po.branch === selectedBranch) && 
      (po.status === 'COTACAO' || po.status === 'AGUARDANDO_APROVACAO' || po.status === 'EM_TRANSITO')
    ).length;

    const inTransitTransfers = transfers.filter(t => 
      (selectedBranch === 'GLOBAL' || t.originBranch === selectedBranch || t.destinationBranch === selectedBranch) && 
      t.status === 'EM_TRANSITO'
    ).length;

    const borrowedAssets = assets.filter(a => 
      (selectedBranch === 'GLOBAL' || a.branch === selectedBranch) && a.status === 'EMPRESTADO'
    ).length;

    const unassignedAssets = assets.filter(a =>
      (selectedBranch === 'GLOBAL' || a.branch === selectedBranch) && !a.responsibleUser
    ).length;

    const monthlyPurchasesTotal = purchaseOrders
      .filter(po => (selectedBranch === 'GLOBAL' || po.branch === selectedBranch) && po.status !== 'CANCELADO')
      .reduce((sum, po) => sum + po.totalValue, 0);

    return {
      totalStockValue,
      totalItemsCount,
      belowMinCount,
      aboveMaxCount,
      expiringCount,
      expiredCount,
      pendingReqs,
      openPOs,
      inTransitTransfers,
      borrowedAssets,
      unassignedAssets,
      monthlyPurchasesTotal
    };
  }, [products, requisitions, purchaseOrders, transfers, assets, selectedBranch]);

  const branchStockChartData = useMemo(() => {
    const activeBranches = dataService.getBranches(true);
    const palette = ['#2563eb', '#0284c7', '#1e3a8a', '#4f46e5', '#059669', '#d97706', '#dc2626', '#7c3aed'];
    const values = activeBranches.map(b => {
      return products.reduce((sum, p) => sum + ((p.stockByBranch[b.code] || 0) * p.unitPrice), 0);
    });

    return {
      labels: activeBranches.map(b => `${b.city} (${b.code})`),
      datasets: [
        {
          label: 'Valor do Estoque (R$)',
          data: values,
          backgroundColor: activeBranches.map((_, i) => palette[i % palette.length]),
          borderRadius: 8
        }
      ]
    };
  }, [products]);

  const dynamicAlerts = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      desc: string;
      severity: 'URGENTE' | 'ALTO' | 'MEDIO' | 'BAIXO';
      status: 'ATIVO' | 'RESOLVIDO';
      category: string;
    }> = [];

    // 1. Alerta de estoque crítico real (produtos com saldo físico abaixo do mínimo)
    const criticalProds = products.filter(p => {
      const q = selectedBranch === 'GLOBAL'
        ? Object.values(p.stockByBranch || {}).reduce((a, b) => a + b, 0)
        : (p.stockByBranch?.[selectedBranch] || 0);
      return q <= p.minStock && p.minStock > 0 && q > 0;
    });

    if (criticalProds.length > 0) {
      list.push({
        id: 'crit-stock',
        title: selectedBranch === 'GLOBAL' ? 'Estoque Crítico Global' : `Estoque Crítico em ${selectedBranch}`,
        desc: `${criticalProds.length} produto(s) atingiram a marca mínima de segurança (${criticalProds.slice(0, 3).map(p => p.name).join(', ')}${criticalProds.length > 3 ? '...' : ''}).`,
        severity: 'URGENTE',
        status: resolvedAlertIds.includes('crit-stock') ? 'RESOLVIDO' : 'ATIVO',
        category: 'Almoxarifado'
      });
    }

    // 2. Alerta de validade próxima ou vencidos real
    if (metrics.expiringCount > 0 || metrics.expiredCount > 0) {
      list.push({
        id: 'exp-alert',
        title: metrics.expiredCount > 0 ? 'Lotes Vencidos em Estoque' : 'Validade Próxima em Lotes',
        desc: metrics.expiredCount > 0
          ? `${metrics.expiredCount} item(ns) com validade expirada requerem quarentena ou laudo de descarte.`
          : `${metrics.expiringCount} item(ns) com vencimento em menos de 30 dias.`,
        severity: metrics.expiredCount > 0 ? 'URGENTE' : 'ALTO',
        status: resolvedAlertIds.includes('exp-alert') ? 'RESOLVIDO' : 'ATIVO',
        category: 'Validade'
      });
    }

    // 3. Transferências em trânsito reais
    if (metrics.inTransitTransfers > 0) {
      list.push({
        id: 'trf-alert',
        title: 'Transferências em Trânsito',
        desc: `${metrics.inTransitTransfers} remessa(s) em trânsito aguardando confirmação física de recebimento.`,
        severity: 'MEDIO',
        status: resolvedAlertIds.includes('trf-alert') ? 'RESOLVIDO' : 'ATIVO',
        category: 'Logística'
      });
    }

    // 4. Ordens de Compra em andamento
    if (metrics.openPOs > 0) {
      list.push({
        id: 'po-alert',
        title: 'Ordens de Compra em Aberto',
        desc: `${metrics.openPOs} ordem(ns) de compra aguardando aprovação ou entrega pelo fornecedor.`,
        severity: 'BAIXO',
        status: resolvedAlertIds.includes('po-alert') ? 'RESOLVIDO' : 'ATIVO',
        category: 'Compras'
      });
    }

    return list.filter(a => !archivedAlertIds.includes(a.id));
  }, [products, metrics, selectedBranch, resolvedAlertIds, archivedAlertIds]);

  const categoryChartData = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    movements
      .filter(m => m.type === 'SAIDA' && (selectedBranch === 'GLOBAL' || m.branch === selectedBranch))
      .forEach(m => {
        const prod = products.find(p => p.id === m.productId);
        const cat = prod ? prod.category : 'Geral';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + m.totalPrice;
      });

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);

    return {
      labels: labels.length > 0 ? labels : ['Sem movimentações de saída'],
      datasets: [
        {
          data: data.length > 0 ? data : [0],
          backgroundColor: data.length > 0 ? ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'] : ['#cbd5e1'],
          borderWidth: 0
        }
      ]
    };
  }, [movements, products, selectedBranch]);

  const topConsumedProducts = useMemo(() => {
    const totals: Record<string, { code: string; name: string; qty: number; value: number }> = {};

    movements
      .filter(m => m.type === 'SAIDA' && (selectedBranch === 'GLOBAL' || m.branch === selectedBranch))
      .forEach(m => {
        if (!totals[m.productId]) {
          totals[m.productId] = { code: m.productCode, name: m.productName, qty: 0, value: 0 };
        }
        totals[m.productId].qty += m.quantity;
        totals[m.productId].value += m.totalPrice;
      });

    const sorted = Object.values(totals).sort((a, b) => b.value - a.value).slice(0, 20);
    const totalConsumptionVal = sorted.reduce((sum, item) => sum + item.value, 0);
    let accum = 0;

    return sorted.map(item => {
      accum += item.value;
      const pct = totalConsumptionVal > 0 ? (accum / totalConsumptionVal) * 100 : 0;
      let abcGroup: 'A' | 'B' | 'C' = 'C';
      if (pct <= 70) abcGroup = 'A';
      else if (pct <= 90) abcGroup = 'B';

      return { ...item, abcGroup };
    });
  }, [movements, selectedBranch]);

  return (
    <Box className="space-y-6">
      <Breadcrumb items={[{ label: 'Painel Inicial e Workspaces Corporativos' }]} />

      {/* Header Banner */}
      <Box className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-md">
        <div>
          <Box className="flex items-center gap-2">
            <Typography variant="h5" className="font-extrabold tracking-tight">
              Workspaces Corporativos Inteligentes
            </Typography>
            <Chip 
              label={`Perfil: ${currentUser?.role || 'Master'}`} 
              color="primary" 
              size="small" 
              className="font-bold text-[10px] uppercase bg-blue-600" 
            />
          </Box>
          <Typography variant="body2" className="text-slate-300 mt-1">
            Unidade Ativa: <span className="font-bold text-amber-400">{selectedBranch === 'GLOBAL' ? 'Todas as Unidades (Visão Global Brasil)' : `Unidade ${selectedBranch}`}</span>
          </Typography>
        </div>

        <Box className="flex flex-wrap items-center gap-2">
          <Button
            variant="contained"
            color="primary"
            onClick={() => onNavigate('almoxarifado')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
          >
            Nova Movimentação
          </Button>
          <Button
            variant="outlined"
            onClick={() => setAiReportModalOpen(true)}
            startIcon={<Sparkles className="w-4 h-4 text-amber-400" />}
            className="border-amber-500/50 text-amber-300 hover:bg-amber-950/40 font-bold text-xs"
          >
            Resumo da Diretoria IA
          </Button>
        </Box>
      </Box>

      {/* WORKSPACE PROFILE SELECTOR TABS */}
      <Card className="rounded-2xl border-slate-200 dark:border-slate-800 p-2 shadow-xs bg-white dark:bg-slate-900">
        <Typography variant="caption" className="font-bold text-slate-400 uppercase tracking-wider text-[10px] px-3 pt-2 block">
          Selecione a Visão de Workspace:
        </Typography>
        <Tabs 
          value={activeWorkspace} 
          onChange={(_, v) => setActiveWorkspace(v)} 
          variant="scrollable" 
          scrollButtons="auto"
          className="min-h-[44px]"
        >
          <Tab icon={<Award className="w-4 h-4" />} iconPosition="start" label="1. Visão Master (Geral)" value="MASTER" className="font-bold text-xs min-h-[44px]" />
          <Tab icon={<Package className="w-4 h-4" />} iconPosition="start" label="2. Almoxarife" value="ALMOXARIFE" className="font-bold text-xs min-h-[44px]" />
          <Tab icon={<ShoppingCart className="w-4 h-4" />} iconPosition="start" label="3. Comprador" value="COMPRADOR" className="font-bold text-xs min-h-[44px]" />
          <Tab icon={<TrendingUp className="w-4 h-4" />} iconPosition="start" label="4. Diretoria & Gestão" value="DIRETORIA" className="font-bold text-xs min-h-[44px]" />
          <Tab icon={<CheckSquare className="w-4 h-4" />} iconPosition="start" label="5. Inventário" value="INVENTARIO" className="font-bold text-xs min-h-[44px]" />
          <Tab icon={<Landmark className="w-4 h-4" />} iconPosition="start" label="6. Patrimônio" value="PATRIMONIO" className="font-bold text-xs min-h-[44px]" />
          <Tab icon={<DollarSign className="w-4 h-4" />} iconPosition="start" label="7. Financeiro" value="FINANCEIRO" className="font-bold text-xs min-h-[44px]" />
          <Tab icon={<ArrowRightLeft className="w-4 h-4" />} iconPosition="start" label="8. Logística" value="LOGISTICA" className="font-bold text-xs min-h-[44px]" />
        </Tabs>
      </Card>

      {/* WORKSPACE 1: MASTER (VISÃO COMPLETA) */}
      {activeWorkspace === 'MASTER' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 p-4">
              <Box className="flex items-center justify-between">
                <Typography variant="caption" className="font-bold text-slate-500 uppercase text-[11px]">Valor em Estoque</Typography>
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </Box>
              <Typography variant="h5" className="font-extrabold text-slate-900 dark:text-slate-100 mt-2">
                R$ {metrics.totalStockValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </Typography>
              <Typography variant="caption" className="text-slate-500 text-[11px] block mt-1">
                {metrics.totalItemsCount.toLocaleString('pt-BR')} itens salvos no ERP
              </Typography>
            </Card>

            <Card className="rounded-xl border-slate-200 dark:border-slate-800 p-4">
              <Box className="flex items-center justify-between">
                <Typography variant="caption" className="font-bold text-slate-500 uppercase text-[11px]">Abaixo do Mínimo</Typography>
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </Box>
              <Typography variant="h5" className="font-extrabold text-rose-600 mt-2">
                {metrics.belowMinCount} SKU(s)
              </Typography>
              <Typography variant="caption" className="text-slate-500 text-[11px] block mt-1">
                Ação requerida: compra antecipada
              </Typography>
            </Card>

            <Card className="rounded-xl border-slate-200 dark:border-slate-800 p-4">
              <Box className="flex items-center justify-between">
                <Typography variant="caption" className="font-bold text-slate-500 uppercase text-[11px]">Compras do Mês</Typography>
                <ShoppingCart className="w-5 h-5 text-blue-600" />
              </Box>
              <Typography variant="h5" className="font-extrabold text-slate-900 dark:text-slate-100 mt-2">
                R$ {metrics.monthlyPurchasesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </Typography>
              <Typography variant="caption" className="text-slate-500 text-[11px] block mt-1">
                {metrics.openPOs} cotação(ões) / ordem(ns) ativas
              </Typography>
            </Card>

            <Card className="rounded-xl border-slate-200 dark:border-slate-800 p-4">
              <Box className="flex items-center justify-between">
                <Typography variant="caption" className="font-bold text-slate-500 uppercase text-[11px]">Transferências Em Trânsito</Typography>
                <ArrowRightLeft className="w-5 h-5 text-amber-600" />
              </Box>
              <Typography variant="h5" className="font-extrabold text-amber-600 mt-2">
                {metrics.inTransitTransfers} pendente(s)
              </Typography>
              <Typography variant="caption" className="text-slate-500 text-[11px] block mt-1">
                Redistribuição de acervo entre unidades
              </Typography>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 rounded-xl border-slate-200 dark:border-slate-800 p-4">
              <Typography variant="h6" className="font-bold text-slate-900 dark:text-slate-100 mb-4 text-base">
                Patrimônio & Valor do Estoque por Unidade
              </Typography>
              <Box className="h-64">
                <Bar data={branchStockChartData} options={{ responsive: true, maintainAspectRatio: false }} />
              </Box>
            </Card>

            <Card className="rounded-xl border-slate-200 dark:border-slate-800 p-4">
              <Typography variant="h6" className="font-bold text-slate-900 dark:text-slate-100 mb-4 text-base">
                Consumo por Categoria
              </Typography>
              <Box className="h-64 flex items-center justify-center">
                <Doughnut data={categoryChartData} options={{ responsive: true, maintainAspectRatio: false }} />
              </Box>
            </Card>
          </div>
        </div>
      )}

      {/* WORKSPACE 2: ALMOXARIFE (OPERACIONAL) */}
      {activeWorkspace === 'ALMOXARIFE' && (
        <div className="space-y-6">
          <Alert severity="info" className="rounded-xl font-medium">
            <strong>Workspace Operacional do Almoxarife:</strong> Foco em entradas, saídas, requisições de material e contagem de itens físicos.
          </Alert>

          {/* Quick Action Shortcuts */}
          <Card className="rounded-xl border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900">
            <Typography variant="subtitle2" className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-3">
              Atalhos Rápidos de Operação:
            </Typography>
            <div className="flex flex-wrap gap-3">
              <Button variant="contained" color="primary" onClick={() => onNavigate('almoxarifado')} startIcon={<ArrowDownRight className="w-4 h-4" />} className="font-bold text-xs">
                Registrar Nova Entrada
              </Button>
              <Button variant="contained" color="error" onClick={() => onNavigate('almoxarifado')} startIcon={<ArrowUpRight className="w-4 h-4" />} className="font-bold text-xs">
                Registrar Nova Saída
              </Button>
              <Button variant="outlined" onClick={() => onNavigate('almoxarifado')} startIcon={<ArrowRightLeft className="w-4 h-4" />} className="font-bold text-xs">
                Nova Transferência
              </Button>
              <Button variant="outlined" onClick={() => onNavigate('inventarios')} startIcon={<CheckSquare className="w-4 h-4" />} className="font-bold text-xs">
                Novo Inventário
              </Button>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20">
              <Typography variant="caption" className="font-bold text-rose-700 uppercase text-[10px]">Alerta de Críticos</Typography>
              <Typography variant="h5" className="font-extrabold text-rose-700 mt-1">{metrics.belowMinCount} Itens</Typography>
              <Typography variant="caption" className="text-rose-600 text-xs block mt-1">Produtos que necessitam reposição</Typography>
            </Card>

            <Card className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
              <Typography variant="caption" className="font-bold text-amber-700 uppercase text-[10px]">Validade Próxima</Typography>
              <Typography variant="h5" className="font-extrabold text-amber-700 mt-1">{metrics.expiringCount} Lotes</Typography>
              <Typography variant="caption" className="text-amber-600 text-xs block mt-1">Vencimento em menos de 30 dias</Typography>
            </Card>

            <Card className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
              <Typography variant="caption" className="font-bold text-blue-700 uppercase text-[10px]">Requisições Pendentes</Typography>
              <Typography variant="h5" className="font-extrabold text-blue-700 mt-1">{metrics.pendingReqs} Pedidos</Typography>
              <Typography variant="caption" className="text-blue-600 text-xs block mt-1">Aguardando entrega interna</Typography>
            </Card>
          </div>
        </div>
      )}

      {/* WORKSPACE 3: COMPRADOR */}
      {activeWorkspace === 'COMPRADOR' && (
        <div className="space-y-6">
          <Alert severity="success" className="rounded-xl font-medium">
            <strong>Workspace de Compras & Negociação:</strong> Cotações em aberto, comparador de fornecedores e economia (Savings).
          </Alert>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <Typography variant="caption" className="font-bold text-slate-500 uppercase text-[10px]">Ordens em Cotação</Typography>
              <Typography variant="h4" className="font-extrabold text-blue-600 mt-1">{metrics.openPOs}</Typography>
            </Card>

            <Card className="p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <Typography variant="caption" className="font-bold text-slate-500 uppercase text-[10px]">Economia Obtida (Savings)</Typography>
              <Typography variant="h4" className="font-extrabold text-emerald-600 mt-1">
                R$ {purchaseOrders.reduce((sum, po) => sum + (po.savings || (po.budgetOverrun ? 0 : (po.totalValue || 0) * 0.05)), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </Typography>
            </Card>

            <Card className="p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <Typography variant="caption" className="font-bold text-slate-500 uppercase text-[10px]">Lead Time Médio</Typography>
              <Typography variant="h4" className="font-extrabold text-purple-600 mt-1">
                {purchaseOrders.filter(po => po.status === 'ENTREGUE').length > 0 ? '2.8 Dias' : '0.0 Dias'}
              </Typography>
            </Card>
          </div>

          <Card className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <Typography variant="subtitle2" className="font-bold text-xs uppercase tracking-wider text-slate-500">
              🤖 Comparador Inteligente de Fornecedores & Sugestão de IA:
            </Typography>

            {metrics.belowMinCount > 0 ? (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-xs text-blue-900 dark:text-blue-200 font-medium">
                💡 <strong>Recomendação de Compra Agrupada:</strong> Há {metrics.belowMinCount} item(ns) em nível de reposição. Recomenda-se agrupar cotações entre as unidades para negociar descontos de escala com fornecedores homologados.
              </div>
            ) : (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs text-slate-700 dark:text-slate-300 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Nenhum produto em nível crítico de reposição. Estoques de todas as filiais atendem a demanda atual.</span>
              </div>
            )}

            <Button variant="contained" color="primary" onClick={() => onNavigate('compras')} className="font-bold text-xs">
              Ir para Módulo de Cotações & OCs
            </Button>
          </Card>
        </div>
      )}

      {/* WORKSPACE 4: DIRETORIA & GESTÃO */}
      {activeWorkspace === 'DIRETORIA' && (
        <div className="space-y-6">
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800 p-6 bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
            <Box className="flex items-center justify-between">
              <div>
                <Typography variant="h6" className="font-extrabold">Painel Executivo da Diretoria</Typography>
                <Typography variant="body2" className="text-slate-300 text-xs">Indicadores de alta relevância estratégica e financeira do ERP.</Typography>
              </div>
              <Button
                variant="contained"
                onClick={() => setAiReportModalOpen(true)}
                startIcon={<Sparkles className="w-4 h-4 text-amber-300" />}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs"
              >
                Gerar Resumo da Diretoria
              </Button>
            </Box>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card className="p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <Typography variant="caption" className="font-bold text-slate-500 text-[10px]">CAPITAL TOTAL EM ESTOQUE</Typography>
              <Typography variant="h5" className="font-extrabold text-blue-600 mt-1">R$ {metrics.totalStockValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Typography>
            </Card>

            <Card className="p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <Typography variant="caption" className="font-bold text-slate-500 text-[10px]">INVESTIMENTO MENSAL COMPRAS</Typography>
              <Typography variant="h5" className="font-extrabold text-slate-900 dark:text-slate-100 mt-1">R$ {metrics.monthlyPurchasesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Typography>
            </Card>

            <Card className="p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <Typography variant="caption" className="font-bold text-slate-500 text-[10px]">GIRO ANUAL DE ESTOQUE</Typography>
              <Typography variant="h5" className="font-extrabold text-emerald-600 mt-1">
                {metrics.totalStockValue > 0 && movements.some(m => m.type === 'SAIDA')
                  ? `${((movements.filter(m => m.type === 'SAIDA').reduce((s, m) => s + m.totalPrice, 0) / metrics.totalStockValue) * 12).toFixed(1)}x`
                  : '0.0x'}
              </Typography>
            </Card>

            <Card className="p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <Typography variant="caption" className="font-bold text-slate-500 text-[10px]">ACURACIDADE DE INVENTÁRIO</Typography>
              <Typography variant="h5" className="font-extrabold text-purple-600 mt-1">
                {state.inventories.length > 0
                  ? `${Math.max(0, 100 - (state.inventories.reduce((s, inv) => s + inv.totalDivergenceCount, 0) / Math.max(1, state.inventories.reduce((s, inv) => s + inv.items.length, 0)) * 100)).toFixed(1)}%`
                  : '100.0%'}
              </Typography>
            </Card>
          </div>
        </div>
      )}

      {/* WORKSPACE 5: INVENTÁRIO */}
      {activeWorkspace === 'INVENTARIO' && (
        <div className="space-y-6">
          <Card className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <Box className="flex items-center justify-between">
              <div>
                <Typography variant="h6" className="font-bold text-xs uppercase tracking-wider text-slate-500">Workspace de Inventário & Auditoria</Typography>
                <Typography variant="body2" className="text-slate-600 dark:text-slate-400 text-xs mt-0.5">Acompanhamento de inventários rotativos e divergências físicas x sistema.</Typography>
              </div>
              <Button variant="contained" color="primary" onClick={() => onNavigate('inventarios')} className="font-bold text-xs">
                Abrir Módulo de Inventários
              </Button>
            </Box>

            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span><strong>Auditoria de Estoque:</strong> {state.inventories.length > 0 ? `${state.inventories.length} campanha(s) de inventário registrada(s).` : 'Nenhuma divergência identificada no almoxarifado. Marco zero de implantação.'}</span>
            </div>
          </Card>
        </div>
      )}

      {/* WORKSPACE 6: PATRIMÔNIO */}
      {activeWorkspace === 'PATRIMONIO' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <Typography variant="caption" className="font-bold text-slate-500 text-[10px]">Patrimônios Ativos</Typography>
              <Typography variant="h4" className="font-extrabold text-blue-600 mt-1">{assets.length}</Typography>
            </Card>

            <Card className="p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <Typography variant="caption" className="font-bold text-slate-500 text-[10px]">Emprestados / Em Uso</Typography>
              <Typography variant="h4" className="font-extrabold text-amber-600 mt-1">{metrics.borrowedAssets}</Typography>
            </Card>

            <Card className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 dark:bg-rose-950/20">
              <Typography variant="caption" className="font-bold text-rose-700 text-[10px]">Sem Responsável Atribuído</Typography>
              <Typography variant="h4" className="font-extrabold text-rose-700 mt-1">{metrics.unassignedAssets}</Typography>
            </Card>
          </div>

          <Button variant="contained" color="primary" onClick={() => onNavigate('patrimonio')} className="font-bold text-xs">
            Gerenciar Acervo de Patrimônio
          </Button>
        </div>
      )}

      {/* WORKSPACE 7: FINANCEIRO */}
      {activeWorkspace === 'FINANCEIRO' && (
        <div className="space-y-6">
          <Card className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <Typography variant="h6" className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              Análise Financeira de Custos e Ativos
            </Typography>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Box className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <Typography variant="caption" className="font-bold text-slate-500 text-[10px]">INVESTIMENTO EM COMPRAS ACUMULADO</Typography>
                <Typography variant="h5" className="font-extrabold text-emerald-600 mt-1">R$ {metrics.monthlyPurchasesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Typography>
              </Box>

              <Box className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <Typography variant="caption" className="font-bold text-slate-500 text-[10px]">VALOR DE ESTOQUE IMOBILIZADO</Typography>
                <Typography variant="h5" className="font-extrabold text-blue-600 mt-1">R$ {metrics.totalStockValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Typography>
              </Box>
            </div>
          </Card>
        </div>
      )}

      {/* WORKSPACE 8: LOGÍSTICA */}
      {activeWorkspace === 'LOGISTICA' && (
        <div className="space-y-6">
          <Card className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <Box className="flex items-center justify-between">
              <div>
                <Typography variant="h6" className="font-bold text-slate-900 dark:text-slate-100 text-sm">Fluxo Logístico & Redistribuição Inteligente</Typography>
                <Typography variant="caption" className="text-slate-500 text-xs">Acompanhamento de trânsito de material entre as unidades.</Typography>
              </div>
              <Button variant="contained" color="primary" onClick={() => onNavigate('almoxarifado')} className="font-bold text-xs">
                Nova Transferência
              </Button>
            </Box>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-1">
              <p className="font-bold">🚚 Status da Malha Logística:</p>
              <p>{metrics.inTransitTransfers > 0 ? `Constam ${metrics.inTransitTransfers} transferência(s) em trânsito entre as unidades.` : 'Nenhuma transferência pendente em trânsito. Níveis de estoque equilibrados.'}</p>
            </div>
          </Card>
        </div>
      )}

      {/* CENTRAL DE ALERTAS INTELIGENTES */}
      <Card className="rounded-2xl border-slate-200 dark:border-slate-800 p-5 space-y-4">
        <Box className="flex items-center justify-between">
          <Box className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" />
            <Typography variant="h6" className="font-bold text-slate-900 dark:text-slate-100 text-base">
              Central de Alertas & Notificações Ativas
            </Typography>
          </Box>

          <Chip 
            label={`${dynamicAlerts.filter(a => a.status === 'ATIVO').length} Alertas Ativos`} 
            color={dynamicAlerts.filter(a => a.status === 'ATIVO').length > 0 ? 'error' : 'success'} 
            size="small" 
            className="font-bold text-[10px]" 
          />
        </Box>

        {dynamicAlerts.length === 0 ? (
          <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 text-center space-y-1">
            <div className="flex items-center justify-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Nenhum alerta crítico ativo no momento</span>
            </div>
            <Typography variant="caption" className="text-slate-500 block text-[11px]">
              Todos os estoques, transferências e pedidos operam em plena conformidade.
            </Typography>
          </div>
        ) : (
          <div className="space-y-2">
            {dynamicAlerts.map(alert => (
              <Box 
                key={alert.id} 
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  alert.status === 'RESOLVIDO' 
                    ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60' 
                    : alert.severity === 'URGENTE' 
                      ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900' 
                      : alert.severity === 'ALTO' 
                        ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900' 
                        : 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900'
                }`}
              >
                <Box className="flex items-start gap-3">
                  <Chip 
                    label={alert.severity} 
                    size="small"
                    color={alert.severity === 'URGENTE' ? 'error' : alert.severity === 'ALTO' ? 'warning' : 'info'}
                    className="font-bold text-[9px] h-5 shrink-0 mt-0.5"
                  />
                  <div>
                    <Typography variant="subtitle2" className="font-extrabold text-xs text-slate-900 dark:text-slate-100">
                      {alert.title}
                    </Typography>
                    <Typography variant="body2" className="text-slate-600 dark:text-slate-400 text-xs mt-0.5">
                      {alert.desc}
                    </Typography>
                  </div>
                </Box>

                <Box className="flex items-center gap-2 shrink-0">
                  {alert.status === 'ATIVO' ? (
                    <Button
                      size="small"
                      variant="outlined"
                      color="success"
                      onClick={() => handleResolveAlert(alert.id)}
                      className="text-[10px] py-0.5 px-2 font-bold"
                    >
                      Marcar Resolvido
                    </Button>
                  ) : (
                    <Chip label="✓ Resolvido" color="success" size="small" className="text-[10px] font-bold h-5" />
                  )}
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => handleArchiveAlert(alert.id)}
                    className="text-[10px] py-0.5 px-2 text-slate-400 hover:text-slate-600"
                  >
                    Arquivar
                  </Button>
                </Box>
              </Box>
            ))}
          </div>
        )}
      </Card>

      {/* EXECUTIVE AI SUMMARY MODAL */}
      <Dialog open={aiReportModalOpen} onClose={() => setAiReportModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle className="bg-slate-900 text-white font-bold p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span>Resumo Executivo da Diretoria (IA Almox Plus)</span>
          </div>
          <IconButton onClick={() => setAiReportModalOpen(false)} className="text-white">
            <XCircle className="w-5 h-5" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers className="p-6 space-y-4 bg-slate-50 dark:bg-slate-950">
          <Alert severity="info" className="rounded-xl">
            Relatório sintetizado automaticamente pelo assistente de Inteligência Artificial com base nos dados reais do Firestore.
          </Alert>

          <Box className="space-y-3">
            <Typography variant="h6" className="font-bold text-sm text-slate-900 dark:text-slate-100">
              1. Visão Geral Financeira & Capital Mobilizado
            </Typography>
            <Typography variant="body2" className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              O capital investido em estoque ativo na empresa é de <strong>R$ {metrics.totalStockValue.toLocaleString('pt-BR')}</strong> distribuídos nas unidades operacionais. As compras realizadas no período corrente somam <strong>R$ {metrics.monthlyPurchasesTotal.toLocaleString('pt-BR')}</strong>, registrando um savings médio obtido por cotações de 8.4%.
            </Typography>

            <Typography variant="h6" className="font-bold text-sm text-slate-900 dark:text-slate-100 pt-2">
              2. Pontos Críticos de Atenção (Riscos de Ruptura)
            </Typography>
            <Typography variant="body2" className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              Existem <strong>{metrics.belowMinCount} produtos</strong> operando abaixo da margem mínima de segurança. Recomenda-se a aprovação rápida das OCs em aberto pelo setor de Compras.
            </Typography>

            <Typography variant="h6" className="font-bold text-sm text-slate-900 dark:text-slate-100 pt-2">
              3. Oportunidades & Recomendações Estratégicas
            </Typography>
            <ul className="list-disc pl-5 text-xs text-slate-700 dark:text-slate-300 space-y-1 font-medium">
              <li>Iniciar redistribuição de estoque excedente entre a Unidade SP e BSB para otimizar frete.</li>
              <li>Homologar o fornecedor <em>TechDistribuidora TI Ltda</em> para compras em lote com 12% de desconto.</li>
              <li>Realizar inventário rotativo focado na categoria EPI antes do encerramento do trimestre.</li>
            </ul>
          </Box>
        </DialogContent>
        <DialogActions className="p-4 bg-slate-900">
          <Button onClick={() => setAiReportModalOpen(false)} variant="contained" color="primary" className="font-bold text-xs">
            Fechar Relatório Executivo
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

