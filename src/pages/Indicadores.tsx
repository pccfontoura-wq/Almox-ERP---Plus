import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Card, Tabs, Tab, Button, Chip,
  FormControl, InputLabel, Select, MenuItem, Table, TableBody,
  TableCell, TableHead, TableRow, LinearProgress, TextField,
  InputAdornment, Dialog, DialogTitle, DialogContent, DialogActions, Alert
} from '@mui/material';
import {
  TrendingUp, BarChart3, Award, AlertTriangle, Clock,
  DollarSign, FileSpreadsheet, FileText, Mail,
  Users, Search, AlertOctagon, ArrowRightLeft, Sparkles
} from 'lucide-react';

import { dataService } from '../services/dataService';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Breadcrumb } from '../components/Breadcrumb';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';
import { Branch, Product } from '../types';

export const Indicadores: React.FC = () => {
  const { selectedBranch } = useApp();
  const { currentUser } = useAuth();
  const state = dataService.getState();

  const [activeTab, setActiveTab] = useState(0);
  const [targetBranch, setTargetBranch] = useState<Branch | 'GLOBAL'>(selectedBranch);
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');
  const [stagnantDays, setStagnantDays] = useState<number>(60);
  const [stagnantSearch, setStagnantSearch] = useState<string>('');
  const [scheduleFreq, setScheduleFreq] = useState<string>('SEMANAL');
  const [scheduleEmail, setScheduleEmail] = useState<string>(currentUser?.email || '');
  const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null);

  // Modal for stagnant action plan
  const [actionPlanModalOpen, setActionPlanModalOpen] = useState(false);
  const [selectedStagnantProduct, setSelectedStagnantProduct] = useState<{
    product: Product;
    diffDays: number;
    lastMovFormatted: string;
    totalQty: number;
    totalValue: number;
  } | null>(null);

  const products = useMemo(() => {
    return state.products.filter(p => {
      if (!p.active) return false;
      if (selectedCategory !== 'TODAS' && p.category !== selectedCategory) return false;
      return true;
    });
  }, [state.products, selectedCategory]);

  const categories = useMemo(() => {
    const set = new Set(state.products.map(p => p.category));
    return Array.from(set);
  }, [state.products]);

  // CALCULATION 1: Curva ABC Pareto
  const abcAnalysis = useMemo(() => {
    const list = products.map(p => {
      const qty = targetBranch === 'GLOBAL'
        ? Object.values(p.stockByBranch).reduce((a, b) => a + b, 0)
        : (p.stockByBranch[targetBranch] || 0);
      const totalVal = qty * p.unitPrice;
      return { product: p, qty, totalVal };
    }).sort((a, b) => b.totalVal - a.totalVal);

    const grandTotalValue = list.reduce((sum, item) => sum + item.totalVal, 0);
    let accum = 0;

    const classA: typeof list = [];
    const classB: typeof list = [];
    const classC: typeof list = [];

    list.forEach(item => {
      accum += item.totalVal;
      const accumPct = grandTotalValue > 0 ? (accum / grandTotalValue) * 100 : 0;
      if (accumPct <= 80) {
        classA.push(item);
      } else if (accumPct <= 95) {
        classB.push(item);
      } else {
        classC.push(item);
      }
    });

    return { list, grandTotalValue, classA, classB, classC };
  }, [products, targetBranch]);

  // CALCULATION 2: Buyer Comparison
  const buyerMetrics = useMemo(() => {
    const buyersMap: Record<string, { name: string; count: number; totalVal: number; savings: number; avgLeadDays: number }> = {
      'Carlos Eduardo Silva': { name: 'Carlos Eduardo Silva', count: 0, totalVal: 0, savings: 0, avgLeadDays: 3.5 },
      'Juliana Costa e Souza': { name: 'Juliana Costa e Souza', count: 0, totalVal: 0, savings: 0, avgLeadDays: 2.8 }
    };

    state.purchaseOrders.forEach(po => {
      const buyerName = po.requestedBy;
      if (!buyersMap[buyerName]) {
        buyersMap[buyerName] = { name: buyerName, count: 0, totalVal: 0, savings: 0, avgLeadDays: 3.0 };
      }
      buyersMap[buyerName].count += 1;
      buyersMap[buyerName].totalVal += po.totalValue;
      buyersMap[buyerName].savings += po.totalValue * 0.08;
    });

    return Object.values(buyersMap);
  }, [state.purchaseOrders]);

  // CALCULATION 3: Stagnant Products (Estoque Parado / Giro Inativo)
  const stagnantProducts = useMemo(() => {
    const now = new Date().getTime();
    return products.map(p => {
      const pMovs = state.movements.filter(m => m.productId === p.id);
      const lastMovDate = pMovs.length > 0 ? new Date(pMovs[0].date).getTime() : new Date(p.createdAt).getTime();
      const lastMovFormatted = pMovs.length > 0 
        ? new Date(pMovs[0].date).toLocaleDateString('pt-BR') 
        : new Date(p.createdAt).toLocaleDateString('pt-BR');
      const diffDays = Math.floor((now - lastMovDate) / (1000 * 3600 * 24));
      
      const totalQty = targetBranch === 'GLOBAL'
        ? Object.values(p.stockByBranch).reduce((a, b) => a + b, 0)
        : (p.stockByBranch[targetBranch] || 0);

      const totalValue = totalQty * p.unitPrice;

      return { product: p, diffDays, lastMovFormatted, totalQty, totalValue };
    })
    .filter(item => item.diffDays >= stagnantDays && item.totalQty > 0)
    .filter(item => {
      if (!stagnantSearch.trim()) return true;
      const query = stagnantSearch.toLowerCase();
      return item.product.name.toLowerCase().includes(query) || 
             item.product.code.toLowerCase().includes(query) ||
             item.product.category.toLowerCase().includes(query);
    })
    .sort((a, b) => b.totalValue - a.totalValue);
  }, [products, state.movements, stagnantDays, targetBranch, stagnantSearch]);

  // Total stagnant capital
  const stagnantSummary = useMemo(() => {
    const totalItems = stagnantProducts.length;
    const totalCapital = stagnantProducts.reduce((sum, item) => sum + item.totalValue, 0);
    const avgDays = totalItems > 0 
      ? Math.round(stagnantProducts.reduce((sum, item) => sum + item.diffDays, 0) / totalItems)
      : 0;
    const criticalCount = stagnantProducts.filter(item => item.diffDays >= 90).length;

    return { totalItems, totalCapital, avgDays, criticalCount };
  }, [stagnantProducts]);

  // CALCULATION 4: Expiration Dashboard Data
  const expirationMetrics = useMemo(() => {
    const now = new Date();
    let expired: Product[] = [];
    let d7: Product[] = [];
    let d15: Product[] = [];
    let d30: Product[] = [];
    let d60: Product[] = [];

    products.forEach(p => {
      if (p.expirationDate) {
        const exp = new Date(p.expirationDate);
        const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 3600 * 24));
        if (days < 0) expired.push(p);
        else if (days <= 7) d7.push(p);
        else if (days <= 15) d15.push(p);
        else if (days <= 30) d30.push(p);
        else if (days <= 60) d60.push(p);
      }
    });

    return { expired, d7, d15, d30, d60 };
  }, [products]);

  const handleInactivateProduct = (productId: string) => {
    if (!currentUser) return;
    if (confirm('Deseja realmente inativar este produto por estagnação prolongada?')) {
      try {
        dataService.deleteProduct(productId, currentUser);
        alert('Produto inativado com sucesso no ERP.');
      } catch (e: any) {
        alert(e.message);
      }
    }
  };

  // EXPORT HANDLERS: STAGNANT PRODUCTS
  const handleExportStagnantPDF = () => {
    if (stagnantProducts.length === 0) {
      alert('Nenhum produto estagnado no período selecionado para exportar.');
      return;
    }
    const headers = ['SKU', 'Produto', 'Categoria', 'Estoque', 'Valor Unit. (R$)', 'Total Parado (R$)', 'Dias Inativo', 'Últ. Movim.', 'Criticidade'];
    const rows = stagnantProducts.map(item => {
      const crit = item.diffDays >= 180 ? 'CRÍTICO (+180d)' : item.diffDays >= 90 ? 'ALTO (+90d)' : 'ATENÇÃO (+30d)';
      return [
        item.product.code,
        item.product.name,
        item.product.category,
        `${item.totalQty} ${item.product.unit}`,
        `R$ ${item.product.unitPrice.toFixed(2)}`,
        `R$ ${item.totalValue.toFixed(2)}`,
        `${item.diffDays} dias`,
        item.lastMovFormatted,
        crit
      ];
    });

    exportToPDF(
      'Relatório Executivo de Produtos Estagnados (Estoque Parado)',
      headers,
      rows,
      `Relatorio_Produtos_Estagnados_${targetBranch}_${stagnantDays}dias`,
      `Unidade: ${targetBranch} | Período de Inatividade: Acima de ${stagnantDays} dias | Total Capital Parado: R$ ${stagnantSummary.totalCapital.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    );
  };

  const handleExportStagnantExcel = () => {
    if (stagnantProducts.length === 0) {
      alert('Nenhum produto estagnado para exportar.');
      return;
    }
    const data = stagnantProducts.map(item => ({
      'SKU / Código': item.product.code,
      'Produto': item.product.name,
      'Categoria': item.product.category,
      'Unidade Operacional': targetBranch,
      'Qtd em Estoque': item.totalQty,
      'Unid. Medida': item.product.unit,
      'Preço Unitário (R$)': item.product.unitPrice,
      'Valor Total Parado (R$)': item.totalValue,
      'Dias Sem Movimentação': item.diffDays,
      'Data da Última Movimentação': item.lastMovFormatted,
      'Nível de Criticidade': item.diffDays >= 180 ? 'Crítico (+180 dias)' : item.diffDays >= 90 ? 'Alto (+90 dias)' : 'Atenção (+30 dias)',
      'Ação Recomendada': item.diffDays >= 180 ? 'Desmobilização Imediata / Liquidação' : 'Remanejamento / Transferência entre Unidades'
    }));

    exportToExcel(data, `Relatorio_Produtos_Estagnados_${targetBranch}_${stagnantDays}dias`);
  };

  // EXPORT HANDLER: CURVA ABC
  const handleExportAbcExcel = () => {
    const data = abcAnalysis.list.map(item => {
      const isA = abcAnalysis.classA.some(x => x.product.id === item.product.id);
      const isB = abcAnalysis.classB.some(x => x.product.id === item.product.id);
      const cls = isA ? 'A' : isB ? 'B' : 'C';
      return {
        'SKU': item.product.code,
        'Produto': item.product.name,
        'Categoria': item.product.category,
        'Quantidade': item.qty,
        'Preço Unitário (R$)': item.product.unitPrice,
        'Valor Total (R$)': item.totalVal,
        'Classe ABC': `Classe ${cls}`
      };
    });
    exportToExcel(data, `Curva_ABC_Pareto_${targetBranch}`);
  };

  const handleExportAbcPDF = () => {
    const headers = ['SKU', 'Produto', 'Categoria', 'Qtd', 'Preço Unit.', 'Valor Total', 'Classe ABC'];
    const rows = abcAnalysis.list.map(item => {
      const isA = abcAnalysis.classA.some(x => x.product.id === item.product.id);
      const isB = abcAnalysis.classB.some(x => x.product.id === item.product.id);
      const cls = isA ? 'A (80%)' : isB ? 'B (15%)' : 'C (5%)';
      return [
        item.product.code,
        item.product.name,
        item.product.category,
        String(item.qty),
        `R$ ${item.product.unitPrice.toFixed(2)}`,
        `R$ ${item.totalVal.toFixed(2)}`,
        cls
      ];
    });
    exportToPDF(
      'Relatório Curva ABC - Análise Pareto de Estoque',
      headers,
      rows,
      `Curva_ABC_${targetBranch}`,
      `Unidade: ${targetBranch} | Capital Total: R$ ${abcAnalysis.grandTotalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    );
  };

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleSuccess(`Agendamento de relatório [${scheduleFreq}] configurado para enviar periodicamente para: ${scheduleEmail}`);
  };

  return (
    <Box className="space-y-6">
      <Breadcrumb items={[{ label: 'Business Intelligence & Indicadores Gerenciais' }]} />

      {/* Top Banner & Global Filters */}
      <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900 shadow-xs">
        <Box className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Typography variant="h5" className="font-extrabold tracking-tight text-black dark:text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Módulo de Business Intelligence (BI Executivo)
            </Typography>
            <Typography variant="body2" className="text-black dark:text-slate-300 text-xs mt-1 font-medium">
              Painel analítico estratégico para tomada de decisões executivas em suprimentos, estoques e compras.
            </Typography>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col">
              <span className="text-black dark:text-slate-200 font-extrabold text-xs mb-1">
                Unidade
              </span>
              <FormControl size="small" className="min-w-[150px] bg-slate-900 dark:bg-slate-950 rounded-xl border border-slate-800 shadow-xs">
                <Select
                  value={targetBranch}
                  onChange={(e) => setTargetBranch(e.target.value as any)}
                  className="!text-white text-xs font-bold"
                  sx={{
                    color: 'white',
                    '.MuiSvgIcon-root': { color: 'white' },
                    '& .MuiSelect-select': { color: 'white', fontWeight: 'bold', py: '7px' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' }
                  }}
                >
                  <MenuItem value="GLOBAL">GLOBAL (Todas)</MenuItem>
                  {dataService.getBranches(true).map(b => (
                    <MenuItem key={b.id} value={b.code}>Unidade {b.code}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>

            <div className="flex flex-col">
              <span className="text-black dark:text-slate-200 font-extrabold text-xs mb-1">
                Categoria
              </span>
              <FormControl size="small" className="min-w-[160px] bg-slate-900 dark:bg-slate-950 rounded-xl border border-slate-800 shadow-xs">
                <Select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="!text-white text-xs font-bold"
                  sx={{
                    color: 'white',
                    '.MuiSvgIcon-root': { color: 'white' },
                    '& .MuiSelect-select': { color: 'white', fontWeight: 'bold', py: '7px' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' }
                  }}
                >
                  <MenuItem value="TODAS">Todas as Categorias</MenuItem>
                  {categories.map(c => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>

            {/* Quick Action to Stagnant Report Tab */}
            <div className="flex flex-col">
              <span className="opacity-0 text-xs mb-1 select-none pointer-events-none">.</span>
              <Button
                variant="contained"
                onClick={() => setActiveTab(3)}
                startIcon={<Clock className="w-4 h-4 text-white" />}
                className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-950 dark:hover:bg-slate-800 !text-white font-bold text-xs py-2 px-3.5 rounded-xl shadow-xs border border-slate-800 h-[36px]"
                sx={{ color: '#ffffff !important' }}
              >
                Produtos Estagnados ({stagnantSummary.totalItems})
              </Button>
            </div>
          </div>
        </Box>
      </Card>

      {/* Tabs */}
      <Box className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl p-2 shadow-xs">
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab icon={<Award className="w-4 h-4 text-blue-600" />} iconPosition="start" label="1. Painel da Diretoria" className="font-bold text-xs" />
          <Tab icon={<TrendingUp className="w-4 h-4 text-emerald-600" />} iconPosition="start" label="2. Curva ABC (Pareto)" className="font-bold text-xs" />
          <Tab icon={<Users className="w-4 h-4 text-purple-600" />} iconPosition="start" label="3. Desempenho Compradores" className="font-bold text-xs" />
          <Tab 
            icon={<Clock className="w-4 h-4 text-amber-600" />} 
            iconPosition="start" 
            label={
              <Box className="flex items-center gap-1.5 font-bold">
                <span>4. Produtos Estagnados</span>
                {stagnantSummary.totalItems > 0 && (
                  <Chip label={stagnantSummary.totalItems} size="small" className="h-4 px-1 text-[10px] font-extrabold bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200" />
                )}
              </Box>
            } 
            className="font-bold text-xs" 
          />
          <Tab icon={<AlertTriangle className="w-4 h-4 text-rose-600" />} iconPosition="start" label="5. Validade & Alertas" className="font-bold text-xs" />
          <Tab icon={<Mail className="w-4 h-4 text-indigo-600" />} iconPosition="start" label="6. Agendamento & Exportação" className="font-bold text-xs" />
        </Tabs>
      </Box>

      {/* ========================================================================= */}
      {/* TAB 1: PAINEL DA DIRETORIA */}
      {/* ========================================================================= */}
      {activeTab === 0 && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <Typography variant="h6" className="font-extrabold text-slate-900 dark:text-slate-100 text-base">
                Indicadores Executivos Globais
              </Typography>
              <Typography variant="caption" className="text-slate-500 text-xs">
                Métricas essenciais para tomada de decisão da diretoria de operações.
              </Typography>
            </div>

            <div className="flex gap-2">
              <Button
                variant="contained"
                startIcon={<FileSpreadsheet className="w-4 h-4 text-white" />}
                onClick={handleExportAbcExcel}
                className="bg-emerald-600 hover:bg-emerald-700 !text-white font-bold text-xs py-2 px-3 rounded-xl shadow-xs"
              >
                Exportar BI Excel
              </Button>
              <Button
                variant="contained"
                startIcon={<FileText className="w-4 h-4 text-white" />}
                onClick={handleExportAbcPDF}
                className="bg-rose-600 hover:bg-rose-700 !text-white font-bold text-xs py-2 px-3 rounded-xl shadow-xs"
              >
                Exportar BI PDF
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 shadow-xs">
              <Typography variant="caption" className="font-bold text-slate-500 uppercase text-[10px]">
                Giro de Estoque Anual
              </Typography>
              <Typography variant="h4" className="font-extrabold text-blue-600 mt-1">
                4.8x
              </Typography>
              <Chip label="Classificação: Excelente" color="success" size="small" className="mt-2 text-[9px] font-bold h-4" />
            </Card>

            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 shadow-xs">
              <Typography variant="caption" className="font-bold text-slate-500 uppercase text-[10px]">
                Cobertura de Estoque
              </Typography>
              <Typography variant="h4" className="font-extrabold text-emerald-600 mt-1">
                42 Dias
              </Typography>
              <Typography variant="caption" className="text-slate-500 text-[11px] block mt-1">
                Suporta o consumo médio calculado
              </Typography>
            </Card>

            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 shadow-xs">
              <Typography variant="caption" className="font-bold text-slate-500 uppercase text-[10px]">
                Economia em Negociações (Savings)
              </Typography>
              <Typography variant="h4" className="font-extrabold text-purple-600 mt-1">
                R$ 38.450,00
              </Typography>
              <Typography variant="caption" className="text-purple-600 font-bold text-[11px] block mt-1">
                ↑ +12% de savings obtido pelas cotações
              </Typography>
            </Card>

            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 shadow-xs">
              <Typography variant="caption" className="font-bold text-slate-500 uppercase text-[10px]">
                Acuracidade de Inventário
              </Typography>
              <Typography variant="h4" className="font-extrabold text-indigo-600 mt-1">
                98.4%
              </Typography>
              <Typography variant="caption" className="text-emerald-600 font-bold text-[11px] block mt-1">
                ✓ Padrão Corporativo Aprovado
              </Typography>
            </Card>
          </div>

          {/* Direct Ranking Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800 p-5 h-full bg-white dark:bg-slate-900 shadow-xs">
                <Typography variant="h6" className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-3">
                  Ranking de Unidades por Consumo Financeiro
                </Typography>
                <div className="space-y-3">
                  {[
                    { branch: 'São Paulo (SP)', value: 145000, pct: 45 },
                    { branch: 'Rio de Janeiro (RJ)', value: 92000, pct: 28 },
                    { branch: 'Brasília (BSB)', value: 54000, pct: 17 },
                    { branch: 'S. J. Rio Preto (SJRP)', value: 32000, pct: 10 }
                  ].map((item, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span>{item.branch}</span>
                        <span>R$ {item.value.toLocaleString('pt-BR')} ({item.pct}%)</span>
                      </div>
                      <LinearProgress variant="determinate" value={item.pct} className="h-2 rounded-full bg-slate-100" />
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div>
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800 p-5 h-full bg-white dark:bg-slate-900 shadow-xs">
                <Typography variant="h6" className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-3">
                  Desempenho de Fornecedores Homologados
                </Typography>
                <Table size="small">
                  <TableHead className="bg-slate-100 dark:bg-slate-800">
                    <TableRow>
                      <TableCell className="font-bold text-xs">Fornecedor</TableCell>
                      <TableCell align="right" className="font-bold text-xs">Entrega Média</TableCell>
                      <TableCell align="center" className="font-bold text-xs">Avaliação</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[
                      { name: 'Fornecedor de EPIs do Brasil', lead: '2.5 dias', rating: '9.8 / 10' },
                      { name: 'TechDistribuidora TI Ltda', lead: '3.1 dias', rating: '9.5 / 10' },
                      { name: 'Escritório & Papelaria Express', lead: '1.8 dias', rating: '9.9 / 10' }
                    ].map((f, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-bold">{f.name}</TableCell>
                        <TableCell align="right" className="text-xs">{f.lead}</TableCell>
                        <TableCell align="center">
                          <Chip label={f.rating} size="small" color="primary" className="text-[10px] font-bold h-4" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CURVA ABC PARETO */}
      {/* ========================================================================= */}
      {activeTab === 1 && (
        <Card className="rounded-2xl border-slate-200 dark:border-slate-800 p-5 space-y-4 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <Typography variant="h6" className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                Análise Curva ABC (Valor Total de Acervo)
              </Typography>
              <Typography variant="caption" className="text-slate-500 text-xs">
                Classificação 80/15/5 do capital investido em estoque.
              </Typography>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="contained"
                onClick={handleExportAbcExcel}
                startIcon={<FileSpreadsheet className="w-4 h-4 text-white" />}
                className="bg-emerald-600 hover:bg-emerald-700 !text-white font-bold text-xs py-1.5 px-3 rounded-xl shadow-xs"
              >
                Exportar Excel
              </Button>
              <Button
                variant="contained"
                onClick={handleExportAbcPDF}
                startIcon={<FileText className="w-4 h-4 text-white" />}
                className="bg-rose-600 hover:bg-rose-700 !text-white font-bold text-xs py-1.5 px-3 rounded-xl shadow-xs"
              >
                Exportar PDF
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 bg-rose-50 dark:bg-rose-950/20 border-rose-200 rounded-xl">
              <Typography variant="caption" className="font-bold text-rose-700 uppercase text-[10px]">
                Classe A (Até 80% do Valor)
              </Typography>
              <Typography variant="h5" className="font-extrabold text-rose-700 mt-1">
                {abcAnalysis.classA.length} SKUs
              </Typography>
              <Typography variant="caption" className="text-rose-600 text-[11px] block mt-1">
                Alta prioridade de controle e auditoria
              </Typography>
            </Card>

            <Card className="p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 rounded-xl">
              <Typography variant="caption" className="font-bold text-amber-700 uppercase text-[10px]">
                Classe B (15% Seguintes)
              </Typography>
              <Typography variant="h5" className="font-extrabold text-amber-700 mt-1">
                {abcAnalysis.classB.length} SKUs
              </Typography>
              <Typography variant="caption" className="text-amber-600 text-[11px] block mt-1">
                Acompanhamento intermediário
              </Typography>
            </Card>

            <Card className="p-4 bg-slate-100 dark:bg-slate-800 border-slate-200 rounded-xl">
              <Typography variant="caption" className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                Classe C (5% Restantes)
              </Typography>
              <Typography variant="h5" className="font-extrabold text-slate-700 dark:text-slate-300 mt-1">
                {abcAnalysis.classC.length} SKUs
              </Typography>
              <Typography variant="caption" className="text-slate-500 text-[11px] block mt-1">
                Itens de baixo impacto financeiro
              </Typography>
            </Card>
          </div>

          <Table size="small">
            <TableHead className="bg-slate-100 dark:bg-slate-800">
              <TableRow>
                <TableCell className="font-bold text-xs">SKU</TableCell>
                <TableCell className="font-bold text-xs">Produto</TableCell>
                <TableCell align="right" className="font-bold text-xs">Qtd Total</TableCell>
                <TableCell align="right" className="font-bold text-xs">Valor Total (R$)</TableCell>
                <TableCell align="center" className="font-bold text-xs">Classe ABC</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {abcAnalysis.list.slice(0, 15).map((item, i) => {
                const isA = abcAnalysis.classA.some(x => x.product.id === item.product.id);
                const isB = abcAnalysis.classB.some(x => x.product.id === item.product.id);
                const cls = isA ? 'A' : isB ? 'B' : 'C';
                return (
                  <TableRow key={i} hover>
                    <TableCell className="font-mono text-xs font-bold">{item.product.code}</TableCell>
                    <TableCell className="text-xs">{item.product.name}</TableCell>
                    <TableCell align="right" className="text-xs font-bold">{item.qty}</TableCell>
                    <TableCell align="right" className="text-xs font-bold">R$ {item.totalVal.toFixed(2)}</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={`Classe ${cls}`}
                        size="small"
                        color={cls === 'A' ? 'error' : cls === 'B' ? 'warning' : 'default'}
                        className="font-bold text-[10px] h-5"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DESEMPENHO COMPRADORES */}
      {/* ========================================================================= */}
      {activeTab === 2 && (
        <Card className="rounded-2xl border-slate-200 dark:border-slate-800 p-5 space-y-4 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex justify-between items-center">
            <Typography variant="h6" className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              Comparativo de Desempenho entre Compradores
            </Typography>
            <Button
              variant="contained"
              onClick={() => {
                const headers = ['Comprador', 'Ordens de Compra', 'Volume Comprado (R$)', 'Economia (Savings R$)', 'Lead Time Médio'];
                const rows = buyerMetrics.map(b => [
                  b.name,
                  String(b.count),
                  `R$ ${b.totalVal.toFixed(2)}`,
                  `R$ ${b.savings.toFixed(2)}`,
                  `${b.avgLeadDays} dias`
                ]);
                exportToPDF('Relatório de Desempenho do Time de Compras', headers, rows, 'Desempenho_Compradores');
              }}
              startIcon={<FileText className="w-4 h-4 text-white" />}
              className="bg-indigo-600 hover:bg-indigo-700 !text-white font-bold text-xs py-1.5 px-3 rounded-xl shadow-xs"
            >
              Exportar Relatório PDF
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {buyerMetrics.map((buyer, idx) => (
              <Card key={idx} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-slate-50 dark:bg-slate-900">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-full bg-blue-600 text-white font-bold text-sm">
                    {buyer.name.charAt(0)}
                  </div>
                  <div>
                    <Typography variant="subtitle1" className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                      {buyer.name}
                    </Typography>
                    <Typography variant="caption" className="text-slate-500 text-xs">
                      Comprador Sênior ERP Almox Plus
                    </Typography>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500">Ordens de Compra Emitidas:</span>
                    <span className="font-bold">{buyer.count} OCs</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500">Volume Total Comprado:</span>
                    <span className="font-bold text-emerald-600">R$ {buyer.totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500">Economia Obtida (Savings):</span>
                    <span className="font-bold text-purple-600">R$ {buyer.savings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Tempo Médio de Negociação:</span>
                    <span className="font-bold text-blue-600">{buyer.avgLeadDays} Dias</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PRODUTOS ESTAGNADOS (ESTOQUE PARADO & SEM MOVIMENTAÇÃO) */}
      {/* ========================================================================= */}
      {activeTab === 3 && (
        <Card className="rounded-2xl border-slate-200 dark:border-slate-800 p-5 space-y-5 bg-white dark:bg-slate-900 shadow-xs">
          {/* Header & Title */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
            <div>
              <Typography variant="h6" className="font-extrabold text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                Relatório & Painel de Produtos Estagnados (Estoque Parado)
              </Typography>
              <Typography variant="caption" className="text-slate-500 text-xs mt-0.5 block">
                Identificação detalhada de acervo sem giro ou movimentações recentes para evitar obsolescência, custos de armazenagem e perda de capital.
              </Typography>
            </div>

            {/* Prominent Export Buttons with Crisp White Text */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="contained"
                onClick={handleExportStagnantExcel}
                startIcon={<FileSpreadsheet className="w-4 h-4 text-white" />}
                className="bg-emerald-600 hover:bg-emerald-700 !text-white font-bold text-xs py-2 px-3.5 rounded-xl shadow-xs"
              >
                Exportar Planilha Excel
              </Button>
              <Button
                variant="contained"
                onClick={handleExportStagnantPDF}
                startIcon={<FileText className="w-4 h-4 text-white" />}
                className="bg-rose-600 hover:bg-rose-700 !text-white font-bold text-xs py-2 px-3.5 rounded-xl shadow-xs"
              >
                Gerar Relatório em PDF
              </Button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 p-4 shadow-xs">
              <Typography variant="caption" className="font-bold text-amber-800 dark:text-amber-300 uppercase text-[10px] block">
                SKUs Estagnados Identificados
              </Typography>
              <Typography variant="h4" className="font-extrabold text-amber-900 dark:text-amber-200 mt-1">
                {stagnantSummary.totalItems}
              </Typography>
              <Typography variant="caption" className="text-amber-700 dark:text-amber-400 text-[11px] block mt-1">
                Sem movimentação há mais de {stagnantDays} dias
              </Typography>
            </Card>

            <Card className="rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 p-4 shadow-xs">
              <Typography variant="caption" className="font-bold text-rose-800 dark:text-rose-300 uppercase text-[10px] block">
                Capital Total Parado
              </Typography>
              <Typography variant="h4" className="font-extrabold text-rose-900 dark:text-rose-200 mt-1">
                R$ {stagnantSummary.totalCapital.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </Typography>
              <Typography variant="caption" className="text-rose-700 dark:text-rose-400 text-[11px] block mt-1">
                Custo de aquisição imobilizado
              </Typography>
            </Card>

            <Card className="rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 p-4 shadow-xs">
              <Typography variant="caption" className="font-bold text-blue-800 dark:text-blue-300 uppercase text-[10px] block">
                Média de Inatividade
              </Typography>
              <Typography variant="h4" className="font-extrabold text-blue-900 dark:text-blue-200 mt-1">
                {stagnantSummary.avgDays} Dias
              </Typography>
              <Typography variant="caption" className="text-blue-700 dark:text-blue-400 text-[11px] block mt-1">
                Tempo médio sem saída ou requisição
              </Typography>
            </Card>

            <Card className="rounded-2xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/40 dark:bg-purple-950/20 p-4 shadow-xs">
              <Typography variant="caption" className="font-bold text-purple-800 dark:text-purple-300 uppercase text-[10px] block">
                Itens em Nível Crítico (+90d)
              </Typography>
              <Typography variant="h4" className="font-extrabold text-purple-900 dark:text-purple-200 mt-1">
                {stagnantSummary.criticalCount}
              </Typography>
              <Typography variant="caption" className="text-purple-700 dark:text-purple-400 text-[11px] block mt-1">
                Candidatos imediatos a desmobilização
              </Typography>
            </Card>
          </div>

          {/* Interactive Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="sm:col-span-4">
              <TextField
                fullWidth
                size="small"
                placeholder="Filtrar por nome do produto, código SKU ou categoria..."
                value={stagnantSearch}
                onChange={(e) => setStagnantSearch(e.target.value)}
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

            <div className="sm:col-span-4">
              <FormControl fullWidth size="small">
                <InputLabel>Período Mínimo de Inatividade</InputLabel>
                <Select
                  value={stagnantDays}
                  onChange={(e) => setStagnantDays(Number(e.target.value))}
                  label="Período Mínimo de Inatividade"
                >
                  <MenuItem value={30}>Acima de 30 dias (Alerta inicial)</MenuItem>
                  <MenuItem value={60}>Acima de 60 dias (Estoque parado)</MenuItem>
                  <MenuItem value={90}>Acima de 90 dias (Nível crítico)</MenuItem>
                  <MenuItem value={180}>Acima de 180 dias (Semestral / Obsoleto)</MenuItem>
                  <MenuItem value={365}>Acima de 365 dias (Mais de 1 ano)</MenuItem>
                </Select>
              </FormControl>
            </div>

            <div className="sm:col-span-4 flex justify-end gap-2">
              <Chip
                label={`Unidade: ${targetBranch}`}
                color="primary"
                variant="outlined"
                className="font-bold text-xs"
              />
              <Chip
                label={`${stagnantProducts.length} itens encontrados`}
                color="warning"
                className="font-bold text-xs"
              />
            </div>
          </div>

          {/* Stagnant Products Data Table */}
          <Box className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <Table size="small">
              <TableHead className="bg-slate-100 dark:bg-slate-800">
                <TableRow>
                  <TableCell className="font-bold text-xs">Código / SKU</TableCell>
                  <TableCell className="font-bold text-xs">Produto / Categoria</TableCell>
                  <TableCell align="center" className="font-bold text-xs">Estoque Atual</TableCell>
                  <TableCell align="right" className="font-bold text-xs">Preço Unitário</TableCell>
                  <TableCell align="right" className="font-bold text-xs">Capital Parado</TableCell>
                  <TableCell align="center" className="font-bold text-xs">Dias Sem Giro</TableCell>
                  <TableCell align="center" className="font-bold text-xs">Última Movimentação</TableCell>
                  <TableCell align="center" className="font-bold text-xs">Ações Gerenciais</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stagnantProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" className="py-10 text-slate-400">
                      <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                      <Typography variant="body2" className="font-bold">
                        Nenhum produto estagnado acima de {stagnantDays} dias encontrado na unidade {targetBranch}.
                      </Typography>
                      <Typography variant="caption" className="text-slate-400">
                        O giro de materiais desta unidade está dentro do ciclo operacional normal.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  stagnantProducts.map((item, idx) => {
                    const isCritical = item.diffDays >= 90;
                    return (
                      <TableRow key={idx} hover className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <TableCell className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400">
                          {item.product.code}
                        </TableCell>
                        <TableCell>
                          <Typography className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {item.product.name}
                          </Typography>
                          <Typography variant="caption" className="text-slate-500 text-[10px]">
                            {item.product.category} • Slot: {item.product.locationSlot}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                            {item.totalQty} {item.product.unit}
                          </span>
                        </TableCell>
                        <TableCell align="right" className="text-xs font-medium">
                          R$ {item.product.unitPrice.toFixed(2)}
                        </TableCell>
                        <TableCell align="right">
                          <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400">
                            R$ {item.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={`${item.diffDays} dias`}
                            size="small"
                            color={isCritical ? 'error' : 'warning'}
                            className="font-extrabold text-[10px] h-5"
                          />
                        </TableCell>
                        <TableCell align="center" className="text-xs text-slate-500">
                          {item.lastMovFormatted}
                        </TableCell>
                        <TableCell align="center">
                          <Box className="flex items-center justify-center gap-1.5">
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => {
                                setSelectedStagnantProduct(item);
                                setActionPlanModalOpen(true);
                              }}
                              className="bg-blue-600 hover:bg-blue-700 !text-white font-bold text-[10px] py-1 px-2.5 rounded-lg shadow-xs"
                            >
                              Plano de Ação
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => handleInactivateProduct(item.product.id)}
                              className="bg-rose-600 hover:bg-rose-700 !text-white font-bold text-[10px] py-1 px-2 rounded-lg shadow-xs"
                            >
                              Inativar
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Box>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: VALIDADE & ALERTAS */}
      {/* ========================================================================= */}
      {activeTab === 4 && (
        <Card className="rounded-2xl border-slate-200 dark:border-slate-800 p-5 space-y-4 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex justify-between items-center">
            <Typography variant="h6" className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              Painel Exclusivo de Controle de Validade (FEFO / PVPS)
            </Typography>
            <Button
              variant="contained"
              onClick={() => {
                const headers = ['SKU', 'Produto', 'Categoria', 'Localização', 'Data Validade', 'Status'];
                const rows = products.filter(p => p.expirationDate).map(p => {
                  const now = new Date();
                  const exp = new Date(p.expirationDate!);
                  const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 3600 * 24));
                  const status = days < 0 ? 'VENCIDO' : days <= 15 ? 'VENCE EM BREVE' : 'REGULAR';
                  return [p.code, p.name, p.category, p.locationSlot, exp.toLocaleDateString('pt-BR'), status];
                });
                exportToPDF('Relatório de Validades e Vencimentos de Materiais', headers, rows, 'Relatorio_Validades');
              }}
              startIcon={<FileText className="w-4 h-4 text-white" />}
              className="bg-amber-600 hover:bg-amber-700 !text-white font-bold text-xs py-1.5 px-3 rounded-xl shadow-xs"
            >
              Exportar Relatório PDF
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-3 bg-rose-50 dark:bg-rose-950/20 border-rose-300 rounded-xl">
              <Typography variant="caption" className="font-bold text-rose-700 text-[10px]">VENCIDOS</Typography>
              <Typography variant="h5" className="font-extrabold text-rose-700 mt-1">{expirationMetrics.expired.length}</Typography>
            </Card>
            <Card className="p-3 bg-amber-50 dark:bg-amber-950/20 border-amber-300 rounded-xl">
              <Typography variant="caption" className="font-bold text-amber-700 text-[10px]">Vence em 7 Dias</Typography>
              <Typography variant="h5" className="font-extrabold text-amber-700 mt-1">{expirationMetrics.d7.length}</Typography>
            </Card>
            <Card className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 rounded-xl">
              <Typography variant="caption" className="font-bold text-amber-600 text-[10px]">Vence em 15 Dias</Typography>
              <Typography variant="h5" className="font-extrabold text-amber-600 mt-1">{expirationMetrics.d15.length}</Typography>
            </Card>
            <Card className="p-3 bg-blue-50 dark:bg-blue-950/20 border-blue-200 rounded-xl">
              <Typography variant="caption" className="font-bold text-blue-700 text-[10px]">Vence em 30-60 Dias</Typography>
              <Typography variant="h5" className="font-extrabold text-blue-700 mt-1">{expirationMetrics.d30.length + expirationMetrics.d60.length}</Typography>
            </Card>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: AGENDAMENTO & EXPORTAÇÃO */}
      {/* ========================================================================= */}
      {activeTab === 5 && (
        <Card className="rounded-2xl border-slate-200 dark:border-slate-800 p-5 space-y-4 bg-white dark:bg-slate-900 shadow-xs">
          <Typography variant="h6" className="font-bold text-slate-900 dark:text-slate-100 text-sm">
            Agendamento Automático e Envio Periódico de Relatórios por E-mail
          </Typography>

          {scheduleSuccess && <Alert severity="success">{scheduleSuccess}</Alert>}

          <form onSubmit={handleScheduleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <FormControl fullWidth size="small">
                <InputLabel>Periodicidade do Envio</InputLabel>
                <Select
                  value={scheduleFreq}
                  onChange={(e) => setScheduleFreq(e.target.value)}
                  label="Periodicidade do Envio"
                >
                  <MenuItem value="DIARIO">Diário (Todas as manhãs)</MenuItem>
                  <MenuItem value="SEMANAL">Semanal (Toda segunda-feira)</MenuItem>
                  <MenuItem value="MENSAL">Mensal (Todo dia 1º)</MenuItem>
                </Select>
              </FormControl>
            </div>

            <div>
              <FormControl fullWidth size="small">
                <InputLabel>Destinatário E-mail</InputLabel>
                <Select
                  value={scheduleEmail}
                  onChange={(e) => setScheduleEmail(e.target.value)}
                  label="Destinatário E-mail"
                >
                  <MenuItem value={currentUser?.email || 'pccfontoura@gmail.com'}>{currentUser?.email || 'pccfontoura@gmail.com'} (Meu e-mail)</MenuItem>
                  <MenuItem value="diretoria@almoxplus.com.br">diretoria@almoxplus.com.br (Diretoria Executiva)</MenuItem>
                </Select>
              </FormControl>
            </div>

            <Button
              type="submit"
              variant="contained"
              startIcon={<Mail className="w-4 h-4 text-white" />}
              className="bg-blue-600 hover:bg-blue-700 !text-white font-bold text-xs py-2 rounded-xl shadow-xs"
            >
              Salvar Programação de Envio
            </Button>
          </form>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PLANO DE AÇÃO PARA PRODUTO ESTAGNADO */}
      {/* ========================================================================= */}
      <Dialog
        open={actionPlanModalOpen}
        onClose={() => setActionPlanModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        {selectedStagnantProduct && (
          <div>
            <DialogTitle className="font-bold flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
              <Box className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-600" />
                <span>Plano de Ação para Estoque Parado</span>
              </Box>
            </DialogTitle>

            <DialogContent dividers className="space-y-4 py-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
                <Typography variant="caption" className="font-bold text-amber-800 dark:text-amber-300 uppercase text-[10px]">
                  Material Analisado
                </Typography>
                <Typography className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  {selectedStagnantProduct.product.code} - {selectedStagnantProduct.product.name}
                </Typography>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <div>
                    <span className="text-slate-500">Estoque Parado:</span> <strong>{selectedStagnantProduct.totalQty} {selectedStagnantProduct.product.unit}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Capital Imobilizado:</span> <strong className="text-rose-600">R$ {selectedStagnantProduct.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Inatividade:</span> <strong className="text-amber-600">{selectedStagnantProduct.diffDays} dias</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Última Movimentação:</span> <strong>{selectedStagnantProduct.lastMovFormatted}</strong>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Typography variant="subtitle2" className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                  Ações Estratégicas Recomendadas pelo BI:
                </Typography>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start gap-2.5">
                  <ArrowRightLeft className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <Typography className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      1. Transferência entre Unidades
                    </Typography>
                    <Typography variant="caption" className="text-slate-500">
                      Remanejar o saldo para unidades com maior consumo ou obras ativas (ex: SP ou RJ).
                    </Typography>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start gap-2.5">
                  <DollarSign className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <Typography className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      2. Bonificação ou Desmobilização
                    </Typography>
                    <Typography variant="caption" className="text-slate-500">
                      Priorizar a utilização em ordens de serviço internas ou negociar devolução ao fornecedor.
                    </Typography>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start gap-2.5">
                  <AlertOctagon className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                  <div>
                    <Typography className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      3. Inativação de Catálogo
                    </Typography>
                    <Typography variant="caption" className="text-slate-500">
                      Bloquear novas compras para evitar acúmulo financeiro e perda patrimonial.
                    </Typography>
                  </div>
                </div>
              </div>
            </DialogContent>

            <DialogActions className="px-6 py-3 border-t border-slate-200 dark:border-slate-800">
              <Button onClick={() => setActionPlanModalOpen(false)}>Fechar</Button>
              <Button
                variant="contained"
                onClick={() => {
                  handleInactivateProduct(selectedStagnantProduct.product.id);
                  setActionPlanModalOpen(false);
                }}
                className="bg-rose-600 hover:bg-rose-700 !text-white font-bold text-xs"
              >
                Inativar Produto no Catálogo
              </Button>
            </DialogActions>
          </div>
        )}
      </Dialog>
    </Box>
  );
};
