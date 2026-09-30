import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Card, Button, FormControl,
  InputLabel, Select, MenuItem, Table, TableBody, TableCell, TableHead, TableRow, Chip, TextField, InputAdornment
} from '@mui/material';
import {
  FileSpreadsheet, FileText, Clock, Calendar, Tag, Search, RotateCcw, Filter
} from 'lucide-react';

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

export const Relatorios: React.FC = () => {
  const { selectedBranch } = useApp();
  const [reportType, setReportType] = useState('MOVEMENTS');
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

  // Map productId -> Product for quick category & SKU lookup in movements and purchase orders
  const productMap = useMemo(() => {
    const map = new Map<string, { category: string; code: string; name: string }>();
    state.products.forEach(p => {
      map.set(p.id, { category: p.category, code: p.code, name: p.name });
    });
    return map;
  }, [state.products]);

  // Dynamic list of all available categories across products and patrimony assets
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    state.products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    state.assets.forEach(a => {
      if (a.category) set.add(a.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [state.products, state.assets]);

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

  const getReportData = () => {
    switch (reportType) {
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

      case 'LOW_STOCK':
        return state.products
          .filter(p => {
            const branchMatch = targetBranch === 'GLOBAL' || (p.stockByBranch[targetBranch] || 0) <= p.minStock;
            const pMovs = state.movements.filter(m => m.productId === p.id);
            const refDate = pMovs.length > 0 ? pMovs[0].date : p.createdAt;
            return (
              branchMatch &&
              matchesCategory(p.category) &&
              isDateInSelectedPeriod(refDate) &&
              matchesSearch([p.code, p.name, p.category])
            );
          })
          .map(p => ({
            SKU: p.code,
            Produto: p.name,
            Categoria: p.category,
            Unidade: targetBranch,
            EstoqueAtual: targetBranch === 'GLOBAL' ? Object.values(p.stockByBranch).reduce((a, b) => a + b, 0) : (p.stockByBranch[targetBranch] || 0),
            EstoqueMinimo: p.minStock,
            PrecoMedio: `R$ ${p.unitPrice.toFixed(2)}`
          }));

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

      case 'PATRIMONY_CUSTODY': {
        const custodyRecords: any[] = [];
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

      case 'PURCHASE_ORDERS': {
        const rows: any[] = [];
        state.purchaseOrders
          .filter(po => (targetBranch === 'GLOBAL' || po.branch === targetBranch) && isDateInSelectedPeriod(po.createdAt))
          .forEach(po => {
            po.items.forEach(item => {
              const prodCat = item.category || productMap.get(item.productId)?.category || 'Geral';
              if (!matchesCategory(prodCat)) return;
              if (!matchesSearch([po.code, po.supplierName, item.productName, item.productCode, prodCat, po.requestedBy])) return;

              rows.push({
                DataEmissao: new Date(po.createdAt).toLocaleDateString('pt-BR'),
                OrdemCompra: po.code,
                Unidade: po.branch,
                Fornecedor: po.supplierName,
                Produto: `${item.productCode} - ${item.productName}`,
                Categoria: prodCat,
                Quantidade: `${item.quantity} ${item.unit}`,
                ValorTotalItem: `R$ ${item.totalPrice.toFixed(2)}`,
                Status: po.status
              });
            });
          });
        return rows;
      }

      case 'MOVEMENTS':
      default:
        return state.movements
          .filter(m => {
            const prodInfo = productMap.get(m.productId);
            const category = prodInfo?.category || 'Geral';
            return (
              (targetBranch === 'GLOBAL' || m.branch === targetBranch) &&
              isDateInSelectedPeriod(m.date) &&
              matchesCategory(category) &&
              matchesSearch([m.productName, m.productCode, category, m.responsibleUser, m.documentNumber, m.type])
            );
          })
          .map(m => {
            const prodInfo = productMap.get(m.productId);
            const category = prodInfo?.category || 'Geral';
            const dt = new Date(m.date);
            return {
              DataHora: `${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
              Tipo: m.type,
              Produto: m.productName,
              Categoria: category,
              Quantidade: m.quantity,
              ValorTotal: `R$ ${m.totalPrice.toFixed(2)}`,
              Unidade: m.branch,
              Responsavel: m.responsibleUser,
              Documento: m.documentNumber || '-'
            };
          });
    }
  };

  const currentData = getReportData();

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

    const reportTitle =
      reportType === 'STAGNANT_PRODUCTS' ? 'Relatório de Produtos Estagnados (Estoque Parado)' :
      reportType === 'MOVEMENTS' ? 'Relatório Executivo de Movimentações de Estoque' :
      reportType === 'LOW_STOCK' ? 'Relatório de Itens Críticos e Reposição' :
      reportType === 'PURCHASE_ORDERS' ? 'Relatório de Ordens de Compra por Período e Categoria' :
      reportType === 'PATRIMONY_CUSTODY' ? 'Relatório de Rastreabilidade & Histórico de Utilizadores de Patrimônio' :
      'Relatório de Controle Patrimonial e Últimos Utilizadores';

    exportToPDF(
      reportTitle,
      headers,
      rows,
      `Relatorio_${reportType}_${targetBranch}`,
      `Unidade: ${targetBranch} | Período: ${periodSummaryLabel} | Categoria: ${selectedCategory} | Total: ${currentData.length} registros`
    );
  };

  return (
    <Box className="space-y-6">
      <Breadcrumb items={[{ label: 'Central de Relatórios Executivos' }]} />

      {/* Filter Options Card */}
      <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <Typography variant="subtitle2" className="font-extrabold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider">
              Filtros de Emissão por Relatório, Unidade, Período e Categoria
            </Typography>
          </div>

          <div className="flex items-center gap-2">
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
              className="bg-emerald-600 hover:bg-emerald-700 !text-white font-bold text-xs py-1.5 px-3 rounded-xl shadow-xs"
            >
              Exportar Excel
            </Button>
            <Button
              variant="contained"
              startIcon={<FileText className="w-4 h-4 text-white" />}
              onClick={handleExportPDF}
              disabled={currentData.length === 0}
              className="bg-rose-600 hover:bg-rose-700 !text-white font-bold text-xs py-1.5 px-3 rounded-xl shadow-xs"
            >
              Exportar PDF
            </Button>
          </div>
        </div>

        {/* Row 1: Tipo de Relatório, Unidade, Período, Categoria */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-center">
          <div className="lg:col-span-4">
            <FormControl fullWidth size="small">
              <InputLabel>Tipo de Relatório Executivo</InputLabel>
              <Select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                label="Tipo de Relatório Executivo"
                className="font-bold text-xs"
              >
                <MenuItem value="MOVEMENTS">📈 Movimentações de Estoque (Entradas e Saídas)</MenuItem>
                <MenuItem value="PURCHASE_ORDERS">🛒 Ordens de Compra e Suprimentos (OCs)</MenuItem>
                <MenuItem value="STAGNANT_PRODUCTS" className="font-bold text-amber-700">
                  📦 Relatório de Produtos Estagnados (Sem Giro)
                </MenuItem>
                <MenuItem value="LOW_STOCK">⚠️ Relatório de Reposição / Estoque Mínimo</MenuItem>
                <MenuItem value="PATRIMONY">🏛️ Relatório de Ativos e Patrimônio (com Último Utilizador)</MenuItem>
                <MenuItem value="PATRIMONY_CUSTODY" className="font-bold text-blue-700 dark:text-blue-400">
                  🛡️ Rastreabilidade Completa de Custódia (Histórico de Utilizadores)
                </MenuItem>
              </Select>
            </FormControl>
          </div>

          <div className="lg:col-span-2">
            <FormControl fullWidth size="small">
              <InputLabel>Unidade de Análise</InputLabel>
              <Select
                value={targetBranch}
                onChange={(e) => setTargetBranch(e.target.value as any)}
                label="Unidade de Análise"
                className="font-bold text-xs"
              >
                <MenuItem value="GLOBAL">GLOBAL (Todas as Unidades)</MenuItem>
                {dataService.getBranches(true).map(b => (
                  <MenuItem key={b.id} value={b.code}>Unidade {b.code} ({b.city})</MenuItem>
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

          {/* Categoria Selection Box */}
          <div className="lg:col-span-3">
            <FormControl fullWidth size="small">
              <InputLabel>Categoria de Material / Bem</InputLabel>
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                label="Categoria de Material / Bem"
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
              placeholder="Refinar busca dentro do relatório (ex: nome do produto, SKU, responsável, documento)..."
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
            <Typography variant="h6" className="font-bold text-slate-900 dark:text-slate-100 text-base">
              Pré-visualização dos Dados Gerados ({currentData.length} registros)
            </Typography>
            <Typography variant="caption" className="text-slate-500 text-xs block mt-0.5">
              Unidade: <strong>{targetBranch}</strong> • Período: <strong>{periodSummaryLabel}</strong> • Categoria: <strong>{selectedCategory}</strong>
            </Typography>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Chip
              icon={<Calendar className="w-3.5 h-3.5" />}
              label={periodSummaryLabel}
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
              label={`${currentData.length} itens listados`}
              color={reportType === 'STAGNANT_PRODUCTS' ? 'warning' : 'primary'}
              className="font-bold text-xs"
            />
          </div>
        </div>

        <Box className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <Table size="small">
            <TableHead className="bg-slate-100 dark:bg-slate-800">
              <TableRow>
                {currentData.length > 0 && Object.keys(currentData[0]).map((h, i) => (
                  <TableCell key={i} className="font-bold text-xs">{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {currentData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" className="py-10 text-slate-400">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    Nenhum dado encontrado para a unidade <strong>{targetBranch}</strong> no período <strong>{periodSummaryLabel}</strong> e categoria <strong>{selectedCategory}</strong>.
                  </TableCell>
                </TableRow>
              ) : (
                currentData.slice(0, 50).map((row, idx) => (
                  <TableRow key={idx} hover>
                    {Object.values(row).map((val, cIdx) => (
                      <TableCell key={cIdx} className="text-xs">{String(val)}</TableCell>
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
