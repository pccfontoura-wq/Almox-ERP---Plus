import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Card, Button, FormControl,
  InputLabel, Select, MenuItem, Table, TableBody, TableCell, TableHead, TableRow, Chip, TextField, InputAdornment, Tooltip
} from '@mui/material';
import {
  FileSpreadsheet, FileText, Clock, Calendar, Tag, Search, RotateCcw, Filter,
  Package, ArrowRightLeft, ClipboardList, ShoppingCart, Layers, Building2, Landmark
} from 'lucide-react';
import * as XLSX from 'xlsx';

import { dataService } from '../services/dataService';
import { useApp } from '../context/AppContext';
import { Breadcrumb } from '../components/Breadcrumb';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';
import { Branch } from '../types';

type PeriodFilterType =
  | 'ALL'
  | 'TODAY'
  | 'YESTERDAY'
  | 'LAST_7_DAYS'
  | 'LAST_15_DAYS'
  | 'LAST_30_DAYS'
  | 'THIS_MONTH'
  | 'LAST_90_DAYS'
  | 'CUSTOM';

export type ConsolidatedReportType =
  | 'MOVEMENTS'
  | 'TRANSFERS'
  | 'REQUISITIONS'
  | 'PURCHASE_REQUESTS'
  | 'PURCHASE_ORDERS'
  | 'STOCK_CATALOG'
  | 'STAGNANT_PRODUCTS'
  | 'LOW_STOCK'
  | 'PATRIMONY'
  | 'PATRIMONY_CUSTODY'
  | 'INVENTORY'
  | 'COST_CENTERS';

const PERIOD_LABELS: Record<PeriodFilterType, string> = {
  ALL: 'Todo o Período (Histórico Completo)',
  TODAY: 'Hoje (Registros do Dia)',
  YESTERDAY: 'Ontem',
  LAST_7_DAYS: 'Últimos 7 Dias',
  LAST_15_DAYS: 'Últimos 15 Dias',
  LAST_30_DAYS: 'Últimos 30 Dias',
  THIS_MONTH: 'Mês Atual',
  LAST_90_DAYS: 'Últimos 90 Dias (Trimestre)',
  CUSTOM: 'Período Personalizado (Escolher Datas)'
};

const REPORT_METADATA: Record<ConsolidatedReportType, { title: string; module: string; badgeColor: 'primary' | 'info' | 'warning' | 'success' | 'error' }> = {
  MOVEMENTS: {
    title: 'Relatório de Movimentações de Estoque (Entradas, Saídas e Ajustes)',
    module: 'Almoxarifado • Movimentação',
    badgeColor: 'primary'
  },
  TRANSFERS: {
    title: 'Relatório de Transferências de Materiais entre Unidades',
    module: 'Almoxarifado • Transferências',
    badgeColor: 'info'
  },
  REQUISITIONS: {
    title: 'Relatório de Solicitações de Material ao Almoxarifado (Requisições)',
    module: 'Almoxarifado • Solicitações de Material',
    badgeColor: 'primary'
  },
  PURCHASE_REQUESTS: {
    title: 'Relatório de Solicitações de Compras (SCs Detalhadas por Item)',
    module: 'Compras • Solicitação de Compras',
    badgeColor: 'warning'
  },
  PURCHASE_ORDERS: {
    title: 'Relatório de Ordens de Compra e Fornecedores (OCs)',
    module: 'Compras • Ordens de Compra',
    badgeColor: 'success'
  },
  STOCK_CATALOG: {
    title: 'Relatório de Catálogo Geral e Posição Financeira de Estoque',
    module: 'Almoxarifado • Catálogo de Produtos',
    badgeColor: 'primary'
  },
  STAGNANT_PRODUCTS: {
    title: 'Relatório de Produtos Estagnados (Estoque Parado / Sem Giro)',
    module: 'Almoxarifado • Giro de Estoque',
    badgeColor: 'warning'
  },
  LOW_STOCK: {
    title: 'Relatório de Itens Críticos e Necessidade de Reposição (Estoque Mínimo)',
    module: 'Almoxarifado • Reposição',
    badgeColor: 'error'
  },
  PATRIMONY: {
    title: 'Relatório de Controle Patrimonial e Últimos Utilizadores',
    module: 'Patrimônio • Ativos Fixos',
    badgeColor: 'info'
  },
  PATRIMONY_CUSTODY: {
    title: 'Relatório de Rastreabilidade e Histórico de Custódia Patrimonial',
    module: 'Patrimônio • Custódia',
    badgeColor: 'info'
  },
  INVENTORY: {
    title: 'Relatório de Campanhas de Inventário e Auditoria de Divergências',
    module: 'Inventário • Auditoria Física',
    badgeColor: 'warning'
  },
  COST_CENTERS: {
    title: 'Relatório Consolidado de Centros de Custo (Orçado x Comprado x Consumido)',
    module: 'Financeiro • Centros de Custo',
    badgeColor: 'success'
  }
};

export const Relatorios: React.FC = () => {
  const { selectedBranch } = useApp();
  const [reportType, setReportType] = useState<ConsolidatedReportType>('MOVEMENTS');
  const [targetBranch, setTargetBranch] = useState<Branch | 'GLOBAL'>(selectedBranch);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterType>('ALL');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [stagnantThreshold, setStagnantThreshold] = useState<number>(60);

  const state = dataService.getState();
  const activeBranches = useMemo(() => dataService.getBranches(true), [state.branches]);

  // Map productId -> Product for quick category, unit & SKU lookup across all modules
  const productMap = useMemo(() => {
    const map = new Map<string, { category: string; code: string; name: string; unit: string; unitPrice: number }>();
    state.products.forEach(p => {
      map.set(p.id, { category: p.category, code: p.code, name: p.name, unit: p.unit, unitPrice: p.unitPrice });
    });
    return map;
  }, [state.products]);

  // Dynamic list of all available categories across products, purchase requests, purchase orders, and patrimony assets
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    state.products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    state.assets.forEach(a => {
      if (a.category) set.add(a.category);
    });
    (state.purchaseRequests || []).forEach(pr => {
      pr.items.forEach(i => {
        if (i.category) set.add(i.category);
      });
    });
    (state.purchaseOrders || []).forEach(po => {
      po.items.forEach(i => {
        if (i.category) set.add(i.category);
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [state.products, state.assets, state.purchaseRequests, state.purchaseOrders]);

  // Compute start and end timestamps for the selected period
  const dateBounds = useMemo(() => {
    if (periodFilter === 'ALL') return null;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    switch (periodFilter) {
      case 'TODAY':
        return { start: startOfToday.getTime(), end: endOfToday.getTime() };
      case 'YESTERDAY': {
        const startY = new Date(startOfToday);
        startY.setDate(startY.getDate() - 1);
        const endY = new Date(endOfToday);
        endY.setDate(endY.getDate() - 1);
        return { start: startY.getTime(), end: endY.getTime() };
      }
      case 'LAST_7_DAYS': {
        const start7 = new Date(startOfToday);
        start7.setDate(start7.getDate() - 6);
        return { start: start7.getTime(), end: endOfToday.getTime() };
      }
      case 'LAST_15_DAYS': {
        const start15 = new Date(startOfToday);
        start15.setDate(start15.getDate() - 14);
        return { start: start15.getTime(), end: endOfToday.getTime() };
      }
      case 'LAST_30_DAYS': {
        const start30 = new Date(startOfToday);
        start30.setDate(start30.getDate() - 29);
        return { start: start30.getTime(), end: endOfToday.getTime() };
      }
      case 'THIS_MONTH': {
        const startMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        return { start: startMonth.getTime(), end: endOfToday.getTime() };
      }
      case 'LAST_90_DAYS': {
        const start90 = new Date(startOfToday);
        start90.setDate(start90.getDate() - 89);
        return { start: start90.getTime(), end: endOfToday.getTime() };
      }
      case 'CUSTOM': {
        const startCustom = customStartDate
          ? new Date(`${customStartDate}T00:00:00`).getTime()
          : 0;
        const endCustom = customEndDate
          ? new Date(`${customEndDate}T23:59:59.999`).getTime()
          : endOfToday.getTime();
        return { start: startCustom, end: endCustom };
      }
      default:
        return null;
    }
  }, [periodFilter, customStartDate, customEndDate]);

  const isDateInSelectedPeriod = (dateStr?: string) => {
    if (!dateBounds) return true;
    if (!dateStr) return false;
    const ts = new Date(dateStr).getTime();
    if (isNaN(ts)) return false;
    return ts >= dateBounds.start && ts <= dateBounds.end;
  };

  const matchesCategory = (cat?: string) => {
    if (selectedCategory === 'TODAS') return true;
    return (cat || '').toLowerCase() === selectedCategory.toLowerCase();
  };

  const matchesSearch = (values: (string | number | undefined)[]) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.trim().toLowerCase();
    return values.some(v => String(v ?? '').toLowerCase().includes(term));
  };

  // Dedicated generator for any report type (reusable for single export and multi-tab consolidated export)
  const buildReportRows = (type: ConsolidatedReportType): Record<string, any>[] => {
    switch (type) {
      // 1. ALMOXARIFADO - MOVIMENTAÇÕES DE ESTOQUE
      case 'MOVEMENTS':
        return state.movements
          .filter(m => {
            const prodInfo = productMap.get(m.productId);
            const category = prodInfo?.category || 'Geral';
            return (
              (targetBranch === 'GLOBAL' || m.branch === targetBranch) &&
              isDateInSelectedPeriod(m.date) &&
              matchesCategory(category) &&
              matchesSearch([m.productName, m.productCode, category, m.responsibleUser, m.documentNumber, m.type, m.branch, m.costCenterName])
            );
          })
          .map(m => {
            const prodInfo = productMap.get(m.productId);
            const category = prodInfo?.category || 'Geral';
            const dt = new Date(m.date);
            return {
              DataHora: `${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
              Unidade: m.branch,
              Tipo: m.type === 'ENTRADA' ? 'Entrada (+)' : m.type === 'SAIDA' ? 'Saída (-)' : m.type === 'TRANSFERENCIA' ? 'Transferência' : 'Ajuste',
              SKU: m.productCode,
              Produto: m.productName,
              Categoria: category,
              Quantidade: m.quantity,
              ValorUnitario: `R$ ${m.unitPrice.toFixed(2)}`,
              ValorTotal: `R$ ${m.totalPrice.toFixed(2)}`,
              CentroDeCusto: m.costCenterName || 'Geral / Estoque',
              Responsavel: m.responsibleUser,
              Documento: m.documentNumber || '-'
            };
          });

      // 2. ALMOXARIFADO - TRANSFERÊNCIAS ENTRE UNIDADES
      case 'TRANSFERS':
        return state.transfers
          .filter(t => {
            const prodInfo = productMap.get(t.productId);
            const category = prodInfo?.category || 'Geral';
            const branchMatch =
              targetBranch === 'GLOBAL' ||
              t.originBranch === targetBranch ||
              t.destinationBranch === targetBranch;
            const refDate = t.sentAt || t.receivedAt;
            return (
              branchMatch &&
              isDateInSelectedPeriod(refDate) &&
              matchesCategory(category) &&
              matchesSearch([t.code, t.originBranch, t.destinationBranch, t.productName, t.productCode, category, t.status, t.sentBy, t.receivedBy])
            );
          })
          .map(t => {
            const prodInfo = productMap.get(t.productId);
            const category = prodInfo?.category || 'Geral';
            const unitPrice = prodInfo?.unitPrice || 0;
            return {
              Codigo: t.code,
              DataEnvio: t.sentAt ? new Date(t.sentAt).toLocaleDateString('pt-BR') : '-',
              UnidadeOrigem: t.originBranch,
              UnidadeDestino: t.destinationBranch,
              SKU: t.productCode,
              Produto: t.productName,
              Categoria: category,
              Quantidade: `${t.quantity} ${prodInfo?.unit || 'UN'}`,
              ValorEstimado: `R$ ${(t.quantity * unitPrice).toFixed(2)}`,
              Status: t.status === 'EM_TRANSITO' ? 'Em Trânsito' : t.status === 'CONCLUIDO' ? 'Concluído' : 'Cancelado',
              EnviadoPor: t.sentBy || t.requestedBy || '-',
              RecebidoPor: t.receivedBy || 'Aguardando Destino',
              DataRecebimento: t.receivedAt ? new Date(t.receivedAt).toLocaleDateString('pt-BR') : '-'
            };
          });

      // 3. ALMOXARIFADO - SOLICITAÇÕES DE MATERIAL (REQUISIÇÕES INTERNAS)
      case 'REQUISITIONS': {
        const rows: Record<string, any>[] = [];
        state.requisitions
          .filter(r => (targetBranch === 'GLOBAL' || r.branch === targetBranch) && isDateInSelectedPeriod(r.createdAt))
          .forEach(r => {
            r.items.forEach(item => {
              const prodInfo = productMap.get(item.productId);
              const category = prodInfo?.category || 'Geral';
              if (!matchesCategory(category)) return;
              if (!matchesSearch([r.code, r.branch, r.requestedBy, r.costCenterName, item.productName, item.productCode, category, r.status, r.priority])) return;

              rows.push({
                CodigoRequisicao: r.code,
                DataSolicitacao: new Date(r.createdAt).toLocaleDateString('pt-BR'),
                Unidade: r.branch,
                Solicitante: r.requestedBy,
                CentroDeCusto: r.costCenterName,
                SKU: item.productCode,
                MaterialSolicitado: item.productName,
                Categoria: category,
                QtdSolicitada: `${item.requestedQuantity} ${item.unit}`,
                QtdAtendida: `${item.fulfilledQuantity ?? (r.status === 'ATENDIDO' ? item.requestedQuantity : 0)} ${item.unit}`,
                Prioridade: r.priority,
                Status: r.status === 'PENDENTE' ? 'Pendente' : r.status === 'APROVADO' ? 'Aprovado' : r.status === 'ATENDIDO' ? 'Atendido' : 'Rejeitado',
                AprovadoPor: r.approvedBy || '-'
              });
            });
          });
        return rows;
      }

      // 4. COMPRAS - SOLICITAÇÕES DE COMPRAS (SCs)
      case 'PURCHASE_REQUESTS': {
        const rows: Record<string, any>[] = [];
        (state.purchaseRequests || [])
          .filter(sc => (targetBranch === 'GLOBAL' || sc.branch === targetBranch) && isDateInSelectedPeriod(sc.createdAt))
          .forEach(sc => {
            sc.items.forEach(item => {
              const prodInfo = productMap.get(item.productId);
              const category = item.category || prodInfo?.category || 'Geral';
              if (!matchesCategory(category)) return;
              if (!matchesSearch([sc.code, sc.branch, sc.requestedBy, sc.department, sc.costCenterName, item.productName, item.productCode, category, item.status, sc.status, item.generatedPurchaseOrderCode])) return;

              const unitPrice = item.negotiatedUnitPrice || item.estimatedUnitPrice || prodInfo?.unitPrice || 0;
              rows.push({
                NumeroSC: sc.code,
                DataEmissao: new Date(sc.createdAt).toLocaleDateString('pt-BR'),
                Unidade: sc.branch,
                Solicitante: sc.requestedBy,
                Departamento: sc.department || sc.costCenterName || 'Geral',
                SKU: item.productCode || 'NÃO-CAD',
                MaterialSolicitado: item.productName,
                Categoria: category,
                Quantidade: `${item.quantity} ${item.unit}`,
                ValorUnitEstimado: `R$ ${unitPrice.toFixed(2)}`,
                ValorTotalItem: `R$ ${(item.quantity * unitPrice).toFixed(2)}`,
                Prioridade: sc.priority,
                StatusItem: item.status === 'APROVADO' ? 'Aprovado (Com OC)' : item.status === 'PENDENTE' ? 'Aguardando Compras' : item.status === 'REJEITADO' ? 'Rejeitado' : 'Cancelado',
                OrdemCompraGerada: item.generatedPurchaseOrderCode || '-'
              });
            });
          });
        return rows;
      }

      // 5. COMPRAS - ORDENS DE COMPRA (OCs)
      case 'PURCHASE_ORDERS': {
        const rows: Record<string, any>[] = [];
        state.purchaseOrders
          .filter(po => (targetBranch === 'GLOBAL' || po.branch === targetBranch) && isDateInSelectedPeriod(po.createdAt))
          .forEach(po => {
            po.items.forEach(item => {
              const prodCat = item.category || productMap.get(item.productId)?.category || 'Geral';
              if (!matchesCategory(prodCat)) return;
              if (!matchesSearch([po.code, po.branch, po.supplierName, po.supplierCnpj, item.productName, item.productCode, prodCat, po.requestedBy, po.status, po.purchaseRequestCode])) return;

              rows.push({
                OrdemCompra: po.code,
                OrigemSC: po.purchaseRequestCode || item.purchaseRequestCode || 'Direta',
                DataEmissao: new Date(po.createdAt).toLocaleDateString('pt-BR'),
                Unidade: po.branch,
                Fornecedor: po.supplierName,
                CNPJFornecedor: po.supplierCnpj,
                Produto: `${item.productCode} - ${item.productName}`,
                Categoria: prodCat,
                Quantidade: `${item.quantity} ${item.unit}`,
                ValorUnitario: `R$ ${item.unitPrice.toFixed(2)}`,
                ValorTotalItem: `R$ ${item.totalPrice.toFixed(2)}`,
                Comprador: po.requestedBy,
                Status: po.status
              });
            });
          });
        return rows;
      }

      // 6. ALMOXARIFADO - CATÁLOGO GERAL E POSIÇÃO DE ESTOQUE
      case 'STOCK_CATALOG':
        return state.products
          .filter(p => {
            if (!p.active) return false;
            const pMovs = state.movements.filter(m => m.productId === p.id);
            const refDate = pMovs.length > 0 ? pMovs[0].date : p.createdAt;
            return (
              matchesCategory(p.category) &&
              isDateInSelectedPeriod(refDate) &&
              matchesSearch([p.code, p.name, p.category, p.locationSlot])
            );
          })
          .map(p => {
            const qty = targetBranch === 'GLOBAL'
              ? Object.values(p.stockByBranch).reduce((a, b) => a + b, 0)
              : (p.stockByBranch[targetBranch] || 0);
            const totalValue = qty * p.unitPrice;
            return {
              SKU: p.code,
              Produto: p.name,
              Categoria: p.category,
              Unidade: targetBranch,
              EstoqueAtual: `${qty} ${p.unit}`,
              EstoqueMinimo: `${p.minStock} ${p.unit}`,
              PrecoUnitario: `R$ ${p.unitPrice.toFixed(2)}`,
              ValorTotalEstoque: `R$ ${totalValue.toFixed(2)}`,
              Localizacao: p.locationSlot,
              StatusEstoque: qty <= p.minStock ? 'CRÍTICO (Abaixo do Mínimo)' : 'NORMAL'
            };
          });

      // 7. ALMOXARIFADO - PRODUTOS ESTAGNADOS
      case 'STAGNANT_PRODUCTS': {
        const now = new Date().getTime();
        return state.products
          .filter(p => p.active && matchesCategory(p.category))
          .map(p => {
            const pMovs = state.movements.filter(m => m.productId === p.id);
            const rawLastDate = pMovs.length > 0 ? pMovs[0].date : p.createdAt;
            const lastMovDate = new Date(rawLastDate).getTime();
            const lastMovFormatted = new Date(rawLastDate).toLocaleDateString('pt-BR');
            const diffDays = Math.floor((now - lastMovDate) / (1000 * 3600 * 24));

            const qty = targetBranch === 'GLOBAL'
              ? Object.values(p.stockByBranch).reduce((a, b) => a + b, 0)
              : (p.stockByBranch[targetBranch] || 0);

            const totalVal = qty * p.unitPrice;

            return {
              SKU: p.code,
              Produto: p.name,
              Categoria: p.category,
              Unidade: targetBranch,
              EstoqueAtual: qty,
              PrecoUnitario: `R$ ${p.unitPrice.toFixed(2)}`,
              CapitalImobilizado: `R$ ${totalVal.toFixed(2)}`,
              DiasSemMovimento: `${diffDays} dias`,
              UltimaMovimentacao: lastMovFormatted,
              Criticidade: diffDays >= 180 ? 'CRÍTICO (+180d)' : diffDays >= 90 ? 'ALTO (+90d)' : 'MODERADO (+30d)',
              _diffDays: diffDays,
              _totalVal: totalVal,
              _qty: qty,
              _rawDate: rawLastDate
            };
          })
          .filter(item =>
            item._diffDays >= stagnantThreshold &&
            item._qty > 0 &&
            isDateInSelectedPeriod(item._rawDate) &&
            matchesSearch([item.SKU, item.Produto, item.Categoria, item.Criticidade])
          )
          .sort((a, b) => b._totalVal - a._totalVal)
          .map(({ _diffDays, _totalVal, _qty, _rawDate, ...rest }) => rest);
      }

      // 8. ALMOXARIFADO - ESTOQUE MÍNIMO / REPOSIÇÃO
      case 'LOW_STOCK':
        return state.products
          .filter(p => {
            const qty = targetBranch === 'GLOBAL'
              ? Object.values(p.stockByBranch).reduce((a, b) => a + b, 0)
              : (p.stockByBranch[targetBranch] || 0);
            const branchMatch = qty <= p.minStock;
            const pMovs = state.movements.filter(m => m.productId === p.id);
            const refDate = pMovs.length > 0 ? pMovs[0].date : p.createdAt;
            return (
              branchMatch &&
              matchesCategory(p.category) &&
              isDateInSelectedPeriod(refDate) &&
              matchesSearch([p.code, p.name, p.category])
            );
          })
          .map(p => {
            const qty = targetBranch === 'GLOBAL'
              ? Object.values(p.stockByBranch).reduce((a, b) => a + b, 0)
              : (p.stockByBranch[targetBranch] || 0);
            const deficit = Math.max(0, p.maxStock - qty);
            return {
              SKU: p.code,
              Produto: p.name,
              Categoria: p.category,
              Unidade: targetBranch,
              EstoqueAtual: qty,
              EstoqueMinimo: p.minStock,
              SugestaoCompra: `${deficit} ${p.unit}`,
              PrecoMedio: `R$ ${p.unitPrice.toFixed(2)}`,
              CustoEstimadoReposicao: `R$ ${(deficit * p.unitPrice).toFixed(2)}`
            };
          });

      // 9. PATRIMÔNIO - CONTROLE PATRIMONIAL
      case 'PATRIMONY':
        return state.assets
          .filter(a => {
            const refDate = a.borrowedDate || a.lastReturnedDate || a.acquisitionDate;
            return (
              (targetBranch === 'GLOBAL' || a.branch === targetBranch) &&
              matchesCategory(a.category) &&
              isDateInSelectedPeriod(refDate) &&
              matchesSearch([a.assetTag, a.name, a.category, a.borrowedTo, a.previousBorrower, a.location])
            );
          })
          .map(a => ({
            Tombamento: a.assetTag,
            Bem: a.name,
            Categoria: a.category,
            Unidade: a.branch,
            Status: a.status === 'EM_USO' ? 'Disponível / Em Uso' : a.status === 'EMPRESTADO' ? 'Emprestado' : a.status === 'EM_MANUTENCAO' ? 'Em Manutenção' : 'Baixado',
            UtilizadorAtual: a.borrowedTo ? `${a.borrowedTo}${a.borrowedToDepartment ? ` (${a.borrowedToDepartment})` : ''}` : 'Almoxarifado Local',
            UltimoUtilizadorAnterior: a.previousBorrower ? `${a.previousBorrower}${a.previousBorrowerDepartment ? ` (${a.previousBorrowerDepartment})` : ''}` : 'Sem registro anterior',
            DataUltimaDevolucao: a.lastReturnedDate ? new Date(a.lastReturnedDate).toLocaleDateString('pt-BR') : '-',
            Localizacao: a.location,
            Valor: `R$ ${a.value.toFixed(2)}`
          }));

      // 10. PATRIMÔNIO - RASTREABILIDADE DE CUSTÓDIA
      case 'PATRIMONY_CUSTODY': {
        const custodyRecords: Record<string, any>[] = [];
        const filtered = state.assets.filter(a =>
          (targetBranch === 'GLOBAL' || a.branch === targetBranch) &&
          matchesCategory(a.category)
        );

        filtered.forEach(a => {
          if (a.custodyHistory && a.custodyHistory.length > 0) {
            a.custodyHistory.forEach(ch => {
              const eventDate = ch.borrowedDate || ch.returnedDate;
              if (!isDateInSelectedPeriod(eventDate)) return;
              if (!matchesSearch([a.assetTag, a.name, a.category, ch.user, ch.department, ch.notes])) return;

              custodyRecords.push({
                Tombamento: a.assetTag,
                Bem: a.name,
                Categoria: a.category,
                Unidade: a.branch,
                Utilizador: ch.user,
                Departamento: ch.department || 'Geral',
                DataRetirada: ch.borrowedDate ? new Date(ch.borrowedDate).toLocaleDateString('pt-BR') : '-',
                DataDevolucao: ch.returnedDate ? new Date(ch.returnedDate).toLocaleDateString('pt-BR') : 'Em Aberto (Posse Atual)',
                CondicaoDevolucao: ch.condition || (ch.returnedDate ? 'Devolvido' : 'Em Posse'),
                RecebidoPor: ch.returnedBy || '-',
                Observacoes: ch.notes || '-'
              });
            });
          } else if (a.previousBorrower || a.borrowedTo) {
            const eventDate = a.borrowedDate || a.lastReturnedDate || a.acquisitionDate;
            if (!isDateInSelectedPeriod(eventDate)) return;
            if (!matchesSearch([a.assetTag, a.name, a.category, a.borrowedTo, a.previousBorrower])) return;

            custodyRecords.push({
              Tombamento: a.assetTag,
              Bem: a.name,
              Categoria: a.category,
              Unidade: a.branch,
              Utilizador: a.borrowedTo || a.previousBorrower || '-',
              Departamento: a.borrowedToDepartment || a.previousBorrowerDepartment || 'Geral',
              DataRetirada: a.borrowedDate ? new Date(a.borrowedDate).toLocaleDateString('pt-BR') : '-',
              DataDevolucao: a.lastReturnedDate ? new Date(a.lastReturnedDate).toLocaleDateString('pt-BR') : (a.borrowedTo ? 'Em Aberto (Posse Atual)' : '-'),
              CondicaoDevolucao: a.status === 'EM_MANUTENCAO' ? 'Avaria / Manutenção' : 'Normal',
              RecebidoPor: 'Almoxarifado',
              Observacoes: a.notes || '-'
            });
          }
        });

        return custodyRecords;
      }

      // 11. INVENTÁRIO - AUDITORIAS E DIVERGÊNCIAS
      case 'INVENTORY': {
        const rows: Record<string, any>[] = [];
        state.inventories
          .filter(inv => (targetBranch === 'GLOBAL' || inv.branch === targetBranch) && isDateInSelectedPeriod(inv.startedAt))
          .forEach(inv => {
            inv.items.forEach(item => {
              const prodCat = productMap.get(item.productId)?.category || 'Geral';
              if (!matchesCategory(prodCat)) return;
              if (!matchesSearch([inv.code, inv.title, inv.branch, item.productCode, item.productName, prodCat, inv.status])) return;

              rows.push({
                CodigoAuditoria: inv.code,
                Campanha: inv.title,
                DataAbertura: new Date(inv.startedAt).toLocaleDateString('pt-BR'),
                Unidade: inv.branch,
                SKU: item.productCode,
                Produto: item.productName,
                Categoria: prodCat,
                QtdSistema: item.systemQuantity,
                QtdContada: item.countedQuantity,
                Divergencia: item.divergence,
                StatusCampanha: inv.status === 'CONCLUIDO' ? 'Concluído' : 'Em Andamento'
              });
            });
          });
        return rows;
      }

      // 12. FINANCEIRO - CENTROS DE CUSTO
      case 'COST_CENTERS': {
        const comparisons = dataService.getCostCenterComparisons(targetBranch);
        return comparisons
          .filter(c => {
            const hasMatchingCategory =
              selectedCategory === 'TODAS' ||
              c.productBalances.some(pb => matchesCategory(productMap.get(pb.productId)?.category));
            const latestDate = c.movements[0]?.date || c.purchaseOrders[0]?.createdAt;
            return (
              hasMatchingCategory &&
              (periodFilter === 'ALL' || isDateInSelectedPeriod(latestDate)) &&
              matchesSearch([c.costCenter.code, c.costCenter.name, c.costCenter.branch, c.costCenter.responsible])
            );
          })
          .map(c => ({
            CodigoCC: c.costCenter.code,
            CentroDeCusto: c.costCenter.name,
            Unidade: c.costCenter.branch,
            Responsavel: c.costCenter.responsible,
            CategoriaFiltro: selectedCategory,
            OrcamentoTotal: `R$ ${c.budget.toFixed(2)}`,
            TotalCompradoOCs: `R$ ${c.totalPurchased.toFixed(2)}`,
            TotalConsumidoAlmox: `R$ ${c.totalDelivered.toFixed(2)}`,
            SaldoDisponivel: `R$ ${c.remainingBudget.toFixed(2)}`
          }));
      }

      default:
        return [];
    }
  };

  const currentData = useMemo(
    () => buildReportRows(reportType),
    [reportType, targetBranch, periodFilter, customStartDate, customEndDate, selectedCategory, searchTerm, stagnantThreshold, state]
  );

  const periodSummaryLabel = useMemo(() => {
    if (periodFilter === 'CUSTOM') {
      const s = customStartDate ? new Date(`${customStartDate}T12:00:00`).toLocaleDateString('pt-BR') : 'Início';
      const e = customEndDate ? new Date(`${customEndDate}T12:00:00`).toLocaleDateString('pt-BR') : 'Hoje';
      return `${s} até ${e}`;
    }
    return PERIOD_LABELS[periodFilter];
  }, [periodFilter, customStartDate, customEndDate]);

  const handleResetFilters = () => {
    setTargetBranch(selectedBranch);
    setPeriodFilter('ALL');
    setSelectedCategory('TODAS');
    setSearchTerm('');
  };

  const handleExportExcel = () => {
    exportToExcel(
      currentData,
      `Relatorio_${reportType}_${targetBranch}_${selectedCategory}_${new Date().toISOString().slice(0, 10)}`
    );
  };

  const handleExportPDF = () => {
    if (currentData.length === 0) return;
    const headers = Object.keys(currentData[0]);
    const rows = currentData.map(item => Object.values(item).map(val => String(val)));

    const reportMeta = REPORT_METADATA[reportType];

    exportToPDF(
      reportMeta.title,
      headers,
      rows,
      `Relatorio_${reportType}_${targetBranch}`,
      `Módulo: ${reportMeta.module} | Unidade: ${targetBranch === 'GLOBAL' ? 'Todas as Unidades (GLOBAL)' : targetBranch} | Categoria: ${selectedCategory} | Período: ${periodSummaryLabel} | Total: ${currentData.length} registros`
    );
  };

  // Export Multi-Sheet Consolidated Excel Workbook across all 5 core operational modules
  const handleExportConsolidatedAllModulesExcel = () => {
    const workbook = XLSX.utils.book_new();
    const modulesToExport: { type: ConsolidatedReportType; sheetName: string }[] = [
      { type: 'MOVEMENTS', sheetName: 'Almox_Movimentacoes' },
      { type: 'TRANSFERS', sheetName: 'Almox_Transferencias' },
      { type: 'REQUISITIONS', sheetName: 'Almox_Solic_Material' },
      { type: 'PURCHASE_REQUESTS', sheetName: 'Compras_Solic_SC' },
      { type: 'PURCHASE_ORDERS', sheetName: 'Compras_Ordens_OC' }
    ];

    let totalRowsAdded = 0;
    modulesToExport.forEach(({ type, sheetName }) => {
      const rows = buildReportRows(type);
      totalRowsAdded += rows.length;
      const sheetData = rows.length > 0
        ? rows
        : [{ Aviso: `Sem registros para Unidade: ${targetBranch} | Categoria: ${selectedCategory} | Período: ${periodSummaryLabel}` }];
      const ws = XLSX.utils.json_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(workbook, ws, sheetName);
    });

    XLSX.writeFile(
      workbook,
      `Consolidado_Geral_Almox_Compras_${targetBranch}_${selectedCategory}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  const quickModuleButtons: { id: ConsolidatedReportType; label: string; group: string; icon: any }[] = [
    { id: 'MOVEMENTS', label: 'Movimentações', group: 'Almoxarifado', icon: Package },
    { id: 'TRANSFERS', label: 'Transferências', group: 'Almoxarifado', icon: ArrowRightLeft },
    { id: 'REQUISITIONS', label: 'Solicitações de Material', group: 'Almoxarifado', icon: ClipboardList },
    { id: 'PURCHASE_REQUESTS', label: 'Solicitações de Compras (SC)', group: 'Compras', icon: FileText },
    { id: 'PURCHASE_ORDERS', label: 'Ordens de Compra (OC)', group: 'Compras', icon: ShoppingCart },
    { id: 'STAGNANT_PRODUCTS', label: 'Produtos Estagnados', group: 'Estoque', icon: Clock },
    { id: 'PATRIMONY', label: 'Patrimônio & Custódia', group: 'Patrimônio', icon: Landmark }
  ];

  return (
    <Box className="space-y-6">
      <Breadcrumb items={[{ label: 'Central Consolidada de Relatórios Executivos' }]} />

      {/* Quick Module Selector Cards (Consolidated Access to Almoxarifado & Compras) */}
      <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <Typography variant="subtitle1" className="font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2 text-sm">
              <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Central Consolidada de Relatórios (Almoxarifado, Compras, Patrimônio & Custos)
            </Typography>
            <Typography variant="caption" className="text-slate-500 block">
              Selecione abaixo o módulo desejado e filtre por <strong>Unidade</strong>, <strong>Categoria</strong> e <strong>Período</strong> antes de exportar.
            </Typography>
          </div>

          <Tooltip title="Gera uma única planilha Excel (.XLSX) contendo 5 abas consolidadas (Movimentações, Transferências, Solicitações de Material, Solicitações de Compras e Ordens de Compra) respeitando a Unidade, Categoria e Período selecionados.">
            <Button
              size="small"
              variant="outlined"
              onClick={handleExportConsolidatedAllModulesExcel}
              startIcon={<FileSpreadsheet className="w-4 h-4 text-blue-600" />}
              className="border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 font-bold text-xs rounded-xl py-1.5 px-3"
            >
              Exportar Pacote Consolidado (Todos os Módulos .XLSX)
            </Button>
          </Tooltip>
        </div>

        <div className="flex flex-wrap gap-2">
          {quickModuleButtons.map(btn => {
            const IconComp = btn.icon;
            const isSelected = reportType === btn.id;
            return (
              <Button
                key={btn.id}
                size="small"
                variant={isSelected ? 'contained' : 'outlined'}
                onClick={() => setReportType(btn.id)}
                startIcon={<IconComp className="w-3.5 h-3.5" />}
                sx={isSelected ? { color: '#ffffff !important' } : undefined}
                className={
                  isSelected
                    ? '!bg-blue-600 hover:!bg-blue-700 !text-white font-bold text-xs rounded-xl py-1.5 px-3 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl py-1.5 px-3 hover:bg-slate-50 dark:hover:bg-slate-800'
                }
              >
                <span className="opacity-80 mr-1 text-[10px] uppercase">[{btn.group}]</span> {btn.label}
              </Button>
            );
          })}
        </div>
      </Card>

      {/* Filter Options Card */}
      <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <Typography variant="subtitle2" className="font-extrabold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider">
              Parâmetros Obrigatórios de Exportação: Relatório, Unidade, Categoria e Período
            </Typography>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="small"
              variant="text"
              onClick={handleResetFilters}
              startIcon={<RotateCcw className="w-3.5 h-3.5" />}
              className="text-xs font-bold text-slate-500 hover:text-blue-600"
            >
              Limpar Filtros
            </Button>
            <Button
              variant="contained"
              startIcon={<FileSpreadsheet className="w-4 h-4 text-white" />}
              onClick={handleExportExcel}
              disabled={currentData.length === 0}
              sx={{ color: '#ffffff !important' }}
              className="!bg-emerald-600 hover:!bg-emerald-700 !text-white font-bold text-xs py-1.5 px-3.5 rounded-xl shadow-xs"
            >
              Exportar Excel (.XLSX)
            </Button>
            <Button
              variant="contained"
              startIcon={<FileText className="w-4 h-4 text-white" />}
              onClick={handleExportPDF}
              disabled={currentData.length === 0}
              sx={{ color: '#ffffff !important' }}
              className="!bg-rose-600 hover:!bg-rose-700 !text-white font-bold text-xs py-1.5 px-3.5 rounded-xl shadow-xs"
            >
              Exportar PDF Executivo
            </Button>
          </div>
        </div>

        {/* Row 1: Tipo de Relatório, Unidade, Período, Categoria */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-center">
          <div className="lg:col-span-4">
            <FormControl fullWidth size="small">
              <InputLabel>Módulo / Tipo de Relatório Consolidado</InputLabel>
              <Select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ConsolidatedReportType)}
                label="Módulo / Tipo de Relatório Consolidado"
                className="font-bold text-xs"
              >
                <MenuItem disabled className="text-[10px] font-extrabold uppercase text-slate-400 opacity-100">
                  — MÓDULO ALMOXARIFADO —
                </MenuItem>
                <MenuItem value="MOVEMENTS">📈 Almoxarifado — Movimentações de Estoque (Entradas e Saídas)</MenuItem>
                <MenuItem value="TRANSFERS">🔄 Almoxarifado — Transferências entre Unidades</MenuItem>
                <MenuItem value="REQUISITIONS">📋 Almoxarifado — Solicitações de Material (Requisições)</MenuItem>
                <MenuItem value="STOCK_CATALOG">📦 Almoxarifado — Catálogo Geral e Posição de Estoque</MenuItem>
                <MenuItem value="STAGNANT_PRODUCTS" className="font-bold text-amber-700">
                  ⏳ Almoxarifado — Produtos Estagnados (Sem Giro)
                </MenuItem>
                <MenuItem value="LOW_STOCK">⚠️ Almoxarifado — Reposição / Estoque Mínimo</MenuItem>

                <MenuItem disabled className="text-[10px] font-extrabold uppercase text-slate-400 opacity-100 mt-1">
                  — MÓDULO COMPRAS & SUPRIMENTOS —
                </MenuItem>
                <MenuItem value="PURCHASE_REQUESTS" className="font-bold text-blue-700 dark:text-blue-400">
                  📝 Compras — Solicitações de Compras (SCs por Item)
                </MenuItem>
                <MenuItem value="PURCHASE_ORDERS" className="font-bold text-emerald-700 dark:text-emerald-400">
                  🛒 Compras — Ordens de Compra (OCs e Fornecedores)
                </MenuItem>

                <MenuItem disabled className="text-[10px] font-extrabold uppercase text-slate-400 opacity-100 mt-1">
                  — PATRIMÔNIO, INVENTÁRIO & CUSTOS —
                </MenuItem>
                <MenuItem value="PATRIMONY">🏛️ Patrimônio — Ativos e Patrimônio (com Último Utilizador)</MenuItem>
                <MenuItem value="PATRIMONY_CUSTODY">🛡️ Patrimônio — Rastreabilidade de Custódia (Histórico)</MenuItem>
                <MenuItem value="INVENTORY">📑 Inventário — Campanhas e Divergências de Contagem</MenuItem>
                <MenuItem value="COST_CENTERS">💰 Financeiro — Centros de Custo (Orçado x Comprado x Consumido)</MenuItem>
              </Select>
            </FormControl>
          </div>

          <div className="lg:col-span-2">
            <FormControl fullWidth size="small">
              <InputLabel>Unidade</InputLabel>
              <Select
                value={targetBranch}
                onChange={(e) => setTargetBranch(e.target.value as any)}
                label="Unidade"
                className="font-bold text-xs"
              >
                <MenuItem value="GLOBAL">🌐 GLOBAL (Todas as Unidades)</MenuItem>
                {activeBranches.map(b => (
                  <MenuItem key={b.id} value={b.code}>Unidade {b.code} ({b.city})</MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>

          {/* Categoria Selection Box */}
          <div className="lg:col-span-3">
            <FormControl fullWidth size="small">
              <InputLabel>Categoria</InputLabel>
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                label="Categoria"
                className="font-bold text-xs"
              >
                <MenuItem value="TODAS">🏷️ Todas as Categorias</MenuItem>
                {availableCategories.map(cat => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>

          {/* Período Selection Box */}
          <div className="lg:col-span-3">
            <FormControl fullWidth size="small">
              <InputLabel>Período de Apuração</InputLabel>
              <Select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value as PeriodFilterType)}
                label="Período de Apuração"
                className="font-bold text-xs"
              >
                <MenuItem value="ALL">📅 Todo o Período (Histórico Completo)</MenuItem>
                <MenuItem value="TODAY">⚡ Hoje (Registros do Dia)</MenuItem>
                <MenuItem value="YESTERDAY">🕒 Ontem</MenuItem>
                <MenuItem value="LAST_7_DAYS">📆 Últimos 7 Dias</MenuItem>
                <MenuItem value="LAST_15_DAYS">📆 Últimos 15 Dias</MenuItem>
                <MenuItem value="LAST_30_DAYS">📆 Últimos 30 Dias</MenuItem>
                <MenuItem value="THIS_MONTH">🗓️ Mês Atual</MenuItem>
                <MenuItem value="LAST_90_DAYS">📊 Últimos 90 Dias (Trimestre)</MenuItem>
                <MenuItem value="CUSTOM" className="font-bold text-blue-600">
                  🎯 Período Personalizado (Data Inicial / Final)
                </MenuItem>
              </Select>
            </FormControl>
          </div>
        </div>

        {/* Row 2: Custom Date Pickers (if CUSTOM), Stagnant Days (if STAGNANT_PRODUCTS), and Quick Search */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-center pt-1">
          {periodFilter === 'CUSTOM' && (
            <>
              <div className="sm:col-span-3">
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="Data Inicial (De)"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </div>
              <div className="sm:col-span-3">
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="Data Final (Até)"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </div>
            </>
          )}

          {reportType === 'STAGNANT_PRODUCTS' && (
            <div className={periodFilter === 'CUSTOM' ? 'sm:col-span-2' : 'sm:col-span-3'}>
              <FormControl fullWidth size="small">
                <InputLabel>Dias Parado (Sem Giro)</InputLabel>
                <Select
                  value={stagnantThreshold}
                  onChange={(e) => setStagnantThreshold(Number(e.target.value))}
                  label="Dias Parado (Sem Giro)"
                >
                  <MenuItem value={30}>+ 30 dias sem giro</MenuItem>
                  <MenuItem value={60}>+ 60 dias sem giro</MenuItem>
                  <MenuItem value={90}>+ 90 dias sem giro</MenuItem>
                  <MenuItem value={180}>+ 180 dias sem giro</MenuItem>
                  <MenuItem value={365}>+ 365 dias sem giro</MenuItem>
                </Select>
              </FormControl>
            </div>
          )}

          <div
            className={
              periodFilter === 'CUSTOM' && reportType === 'STAGNANT_PRODUCTS'
                ? 'sm:col-span-4'
                : periodFilter === 'CUSTOM'
                ? 'sm:col-span-6'
                : reportType === 'STAGNANT_PRODUCTS'
                ? 'sm:col-span-9'
                : 'sm:col-span-12'
            }
          >
            <TextField
              fullWidth
              size="small"
              placeholder="Refinar busca dentro do relatório (ex: nome do produto, SKU, código SC/OC, solicitante, fornecedor)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search className="w-4 h-4 text-slate-400" />
                    </InputAdornment>
                  )
                }
              }}
            />
          </div>
        </div>
      </Card>

      {/* Preview Table */}
      <Card className="rounded-2xl border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Chip
                label={REPORT_METADATA[reportType].module}
                color={REPORT_METADATA[reportType].badgeColor}
                size="small"
                className="font-extrabold text-[10px] h-5"
              />
              <Typography variant="h6" className="font-bold text-slate-900 dark:text-slate-100 text-base">
                {REPORT_METADATA[reportType].title}
              </Typography>
            </div>
            <Typography variant="caption" className="text-slate-500 text-xs block mt-1">
              Unidade: <strong>{targetBranch === 'GLOBAL' ? 'Todas as Unidades (GLOBAL)' : `Unidade ${targetBranch}`}</strong> • Categoria: <strong>{selectedCategory}</strong> • Período: <strong>{periodSummaryLabel}</strong>
            </Typography>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Chip
              icon={<Building2 className="w-3.5 h-3.5" />}
              label={`Unidade: ${targetBranch === 'GLOBAL' ? 'GLOBAL' : targetBranch}`}
              size="small"
              variant="outlined"
              className="font-bold text-[11px]"
            />
            <Chip
              icon={<Tag className="w-3.5 h-3.5" />}
              label={`Categoria: ${selectedCategory}`}
              size="small"
              variant="outlined"
              color={selectedCategory === 'TODAS' ? 'default' : 'info'}
              className="font-bold text-[11px]"
            />
            <Chip
              icon={<Calendar className="w-3.5 h-3.5" />}
              label={periodSummaryLabel}
              size="small"
              variant="outlined"
              className="font-bold text-[11px]"
            />
            <Chip
              label={`${currentData.length} registros`}
              color={REPORT_METADATA[reportType].badgeColor}
              className="font-bold text-xs"
            />
          </div>
        </div>

        <Box className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto shadow-xs">
          <Table size="small">
            <TableHead className="bg-slate-100 dark:bg-slate-800">
              <TableRow>
                {currentData.length > 0 && Object.keys(currentData[0]).map((h, i) => (
                  <TableCell key={i} className="font-bold text-xs whitespace-nowrap">{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {currentData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} align="center" className="py-10 text-slate-400">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    Nenhum dado encontrado em <strong>{REPORT_METADATA[reportType].module}</strong> para a unidade <strong>{targetBranch}</strong>, categoria <strong>{selectedCategory}</strong> e período <strong>{periodSummaryLabel}</strong>.
                  </TableCell>
                </TableRow>
              ) : (
                currentData.slice(0, 100).map((row, idx) => (
                  <TableRow key={idx} hover>
                    {Object.values(row).map((val, cIdx) => (
                      <TableCell key={cIdx} className="text-xs whitespace-nowrap">{String(val)}</TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Box>
      </Card>
    </Box>
  );
};
