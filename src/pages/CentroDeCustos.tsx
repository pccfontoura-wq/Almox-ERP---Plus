import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Select, FormControl, InputLabel, Alert, LinearProgress,
  Card, CardContent, Chip, Tabs, Tab, Tooltip, IconButton
} from '@mui/material';
import {
  Calculator, Plus, ShoppingBag, Truck, Package, HelpCircle, Eye,
  BarChart3, Scale, Layers, CheckCircle2, AlertTriangle, ArrowUpRight,
  TrendingDown, TrendingUp, Info, DollarSign
} from 'lucide-react';

import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Breadcrumb } from '../components/Breadcrumb';
import { DataTable, Column } from '../components/DataTable';
import { CostCenter, Branch, CostCenterComparison, CostCenterProductBalance } from '../types';

export const CentroDeCustos: React.FC = () => {
  const { currentUser } = useAuth();
  const { selectedBranch, refreshData } = useApp();

  const [ccModalOpen, setCcModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedCcId, setSelectedCcId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);

  const [ccForm, setCcForm] = useState<Partial<CostCenter>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const state = dataService.getState();
  const canEdit = currentUser?.role !== 'Visitante';

  // Obter comparações enriquecidas (Comprado vs. Entregue) para os Centros de Custo
  const comparisons = useMemo(() => {
    return dataService.getAllCostCentersComparison(selectedBranch);
  }, [state, selectedBranch]);

  // Totais consolidados para os cards superiores
  const totals = useMemo(() => {
    return comparisons.reduce(
      (acc, curr) => {
        acc.budget += curr.budget;
        acc.totalPurchased += curr.totalPurchased;
        acc.totalDelivered += curr.totalDelivered;
        acc.stockWaitingConsumption += curr.stockWaitingConsumption;
        acc.remainingBudget += curr.remainingBudget;
        return acc;
      },
      {
        budget: 0,
        totalPurchased: 0,
        totalDelivered: 0,
        stockWaitingConsumption: 0,
        remainingBudget: 0
      }
    );
  }, [comparisons]);

  const selectedComparison = useMemo(() => {
    if (!selectedCcId) return null;
    return dataService.getCostCenterComparison(selectedCcId);
  }, [selectedCcId, state]);

  const handleOpenDetail = (ccId: string) => {
    setSelectedCcId(ccId);
    setDetailTab(0);
    setDetailModalOpen(true);
  };

  const ccColumns: Column<CostCenterComparison>[] = [
    {
      id: 'code',
      label: 'Código CC',
      accessor: (c) => c.costCenter.code,
      sortable: true,
      render: (c) => (
        <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
          {c.costCenter.code}
        </span>
      )
    },
    {
      id: 'name',
      label: 'Nome do Centro de Custo',
      accessor: (c) => c.costCenter.name,
      sortable: true,
      render: (c) => (
        <div>
          <div className="font-bold text-slate-800 dark:text-slate-100">{c.costCenter.name}</div>
          <div className="text-[11px] text-slate-500">Gestor: {c.costCenter.responsible}</div>
        </div>
      )
    },
    {
      id: 'branch',
      label: 'Unidade',
      accessor: (c) => c.costCenter.branch,
      render: (c) => (
        <Chip label={c.costCenter.branch} size="small" variant="outlined" className="font-mono font-bold text-xs" />
      )
    },
    {
      id: 'budget',
      label: 'Orçamento Aprovado',
      accessor: (c) => c.budget,
      sortable: true,
      render: (c) => (
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          R$ {c.budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      )
    },
    {
      id: 'purchased',
      label: 'Comprado (OCs / Suprimentos)',
      accessor: (c) => c.totalPurchased,
      sortable: true,
      render: (c) => (
        <div>
          <div className="font-bold text-amber-700 dark:text-amber-400">
            R$ {c.totalPurchased.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500">
            {c.purchaseOrders.length} ordem(ns) de compra
          </div>
        </div>
      )
    },
    {
      id: 'delivered',
      label: 'Entregue / Consumido (Almoxarifado)',
      accessor: (c) => c.totalDelivered,
      sortable: true,
      render: (c) => (
        <div>
          <div className="font-bold text-emerald-700 dark:text-emerald-400">
            R$ {c.totalDelivered.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500">
            {c.movements.length} saída(s) efetivadas
          </div>
        </div>
      )
    },
    {
      id: 'stockWaiting',
      label: 'Em Almoxarifado (Comprado a Entregar)',
      accessor: (c) => c.stockWaitingConsumption,
      sortable: true,
      render: (c) => (
        <Chip
          label={`R$ ${c.stockWaitingConsumption.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          color={c.stockWaitingConsumption > 0 ? 'primary' : 'default'}
          size="small"
          className="font-bold text-xs"
        />
      )
    },
    {
      id: 'balance',
      label: 'Saldo Restante / Execução',
      accessor: (c) => c.remainingBudget,
      sortable: true,
      render: (c) => {
        const pct = c.budget > 0 ? (c.totalDelivered / c.budget) * 100 : 0;
        const isOver = pct >= 90;
        return (
          <Box className="w-36">
            <Box className="flex justify-between text-[10px] font-bold mb-1">
              <span>{pct.toFixed(0)}% Consumido</span>
              <span className={isOver ? 'text-rose-600' : 'text-slate-600 dark:text-slate-400'}>
                R$ {c.remainingBudget.toLocaleString('pt-BR')}
              </span>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(pct, 100)}
              color={pct >= 90 ? 'error' : pct >= 70 ? 'warning' : 'primary'}
              className="h-2 rounded-full"
            />
          </Box>
        );
      }
    },
    {
      id: 'actions',
      label: 'Comparativo',
      accessor: (c) => c.costCenter.id,
      exportable: false,
      render: (c) => (
        <Button
          size="small"
          variant="outlined"
          startIcon={<Scale className="w-3.5 h-3.5" />}
          onClick={() => handleOpenDetail(c.costCenter.id)}
          className="text-xs font-bold py-1 px-2.5 rounded-lg border-blue-300 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950"
        >
          Extrato
        </Button>
      )
    }
  ];

  const handleSaveCC = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    try {
      const cc: CostCenter = {
        id: ccForm.id || `cc-${Date.now()}`,
        code: ccForm.code || `CC-${Math.floor(100 + Math.random() * 900)}`,
        name: ccForm.name || 'Centro de Custo',
        branch: ccForm.branch || 'SP',
        budget: Number(ccForm.budget) || 100000,
        spent: ccForm.spent || 0,
        responsible: ccForm.responsible || currentUser.name,
        active: true
      };

      const existingIndex = state.costCenters.findIndex(c => c.id === cc.id);
      if (existingIndex !== -1) {
        state.costCenters[existingIndex] = cc;
      } else {
        state.costCenters.unshift(cc);
      }

      dataService.logAudit(currentUser, 'CRIAR', 'Centro de Custos', `Centro de custos ${cc.code} salvo.`, null, JSON.stringify(cc), cc.branch);
      setCcModalOpen(false);
      refreshData();
    } catch (e: any) {
      setFormError(e.message);
    }
  };

  return (
    <Box className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Breadcrumb items={[{ label: 'Centros de Custos & Comparativo Orçamentário' }]} />
        <Button
          variant="text"
          size="small"
          startIcon={<HelpCircle className="w-4 h-4 text-blue-600" />}
          onClick={() => setShowExplanation(!showExplanation)}
          className="text-xs font-bold text-blue-700 dark:text-blue-400 self-start sm:self-auto"
        >
          {showExplanation ? 'Ocultar Explicação Contábil' : 'Como é calculado: Comprado vs. Entregue?'}
        </Button>
      </div>

      {/* PAINEL EXPLICATIVO CONTÁBIL / GESTÃO DE ESTOQUE */}
      {showExplanation && (
        <Card className="rounded-2xl border-blue-200 dark:border-blue-900 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 dark:from-slate-900 dark:via-blue-950/40 dark:to-slate-900 shadow-sm p-5 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md">
              <Scale className="w-6 h-6" />
            </div>
            <div className="space-y-2 flex-1">
              <Typography variant="subtitle1" className="font-extrabold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                Por que a empresa NÃO calcula errado o gasto do setor?
              </Typography>
              <Typography variant="body2" className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                Na contabilidade gerencial e de estoques, existem duas métricas complementares essenciais:
              </Typography>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400 text-xs mb-1">
                    <ShoppingBag className="w-4 h-4" />
                    1. Gasto Comprado (Aquisição / Desembolso)
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
                    Valor total de Ordens de Compra e pedidos contratados para suprir o setor. Representa o <strong>fluxo de caixa que a empresa comprometeu</strong> com fornecedores.
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400 text-xs mb-1">
                    <Truck className="w-4 h-4" />
                    2. Gasto Entregue (Consumo Real / Competência)
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
                    Valor dos produtos <strong>fisicamente retirados do Almoxarifado</strong> e utilizados pela equipe do setor. É o custo efetivamente realizado no período.
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20 shadow-xs">
                  <div className="flex items-center gap-1.5 font-bold text-blue-700 dark:text-blue-400 text-xs mb-1">
                    <Package className="w-4 h-4" />
                    3. Saldo em Almoxarifado (Ativo Guardado)
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
                    A diferença <strong>(Comprado - Entregue)</strong> não é dinheiro perdido nem cálculo duplicado: são <strong>itens já pagos guardados na prateleira</strong> prontos para atender o setor sem nova despesa!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* CARDS DE TOTAIS CONSOLIDADOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <Card className="rounded-xl border-slate-200 dark:border-slate-800 shadow-xs p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Orçamento Aprovado</span>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600">
              <Calculator className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mt-2">
            R$ {totals.budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-slate-400">Teto orçamentário anual/período</span>
        </Card>

        <Card className="rounded-xl border-slate-200 dark:border-slate-800 shadow-xs p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Total Comprado (OCs)</span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-extrabold text-amber-700 dark:text-amber-400 mt-2">
            R$ {totals.totalPurchased.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-slate-400">
            {totals.budget > 0 ? ((totals.totalPurchased / totals.budget) * 100).toFixed(0) : 0}% do orçamento comprado
          </span>
        </Card>

        <Card className="rounded-xl border-slate-200 dark:border-slate-800 shadow-xs p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Total Entregue (Consumo)</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-400 mt-2">
            R$ {totals.totalDelivered.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-slate-400">Baixas efetivadas no estoque</span>
        </Card>

        <Card className="rounded-xl border-blue-200 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-950/20 shadow-xs p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">Guardado no Almoxarifado</span>
            <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-extrabold text-blue-700 dark:text-blue-300 mt-2">
            R$ {totals.stockWaitingConsumption.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-blue-600/80 dark:text-blue-400">Comprado pendente de retirada</span>
        </Card>

        <Card className="rounded-xl border-slate-200 dark:border-slate-800 shadow-xs p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Saldo Disponível</span>
            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mt-2">
            R$ {totals.remainingBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-slate-400">Margem orçamentária livre</span>
        </Card>
      </div>

      {/* TABELA COMPARATIVA PRINCIPAL */}
      <DataTable
        title="Centros de Custos: Comparativo Comprado vs. Entregue"
        subTitle="Acompanhamento do que a empresa comprou para o setor e o que foi efetivamente consumido no almoxarifado."
        columns={ccColumns}
        data={comparisons}
        onAddClick={() => {
          setCcForm({
            code: `CC-${Math.floor(100 + Math.random() * 900)}`,
            name: '',
            branch: selectedBranch === 'GLOBAL' ? 'SP' : selectedBranch,
            budget: 100000,
            responsible: currentUser?.name || ''
          });
          setCcModalOpen(true);
        }}
        addButtonLabel="Cadastrar Centro de Custo"
        canEditOrAdd={canEdit}
      />

      {/* MODAL DE DETALHAMENTO / EXTRATO COMPARATIVO COMPLETO */}
      <Dialog
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        {selectedComparison && (
          <div>
            <DialogTitle className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-600 text-white">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div>
                    <Typography variant="h6" className="font-extrabold text-base sm:text-lg">
                      {selectedComparison.costCenter.code} - {selectedComparison.costCenter.name}
                    </Typography>
                    <Typography variant="caption" className="text-slate-500">
                      Unidade: {selectedComparison.costCenter.branch} | Gestor: {selectedComparison.costCenter.responsible}
                    </Typography>
                  </div>
                </div>
                <Chip
                  label={selectedComparison.costCenter.active ? 'Centro de Custo Ativo' : 'Inativo'}
                  color={selectedComparison.costCenter.active ? 'success' : 'default'}
                  size="small"
                  className="font-bold text-xs"
                />
              </div>

              <Tabs
                value={detailTab}
                onChange={(_, v) => setDetailTab(v)}
                indicatorColor="primary"
                textColor="primary"
                className="mt-3 -mb-3"
              >
                <Tab label="Visão Geral & Balanço" className="font-bold text-xs" />
                <Tab
                  label={`Balanço por Produto (${selectedComparison.productBalances.length})`}
                  className="font-bold text-xs"
                />
                <Tab
                  label={`Ordens de Compra (${selectedComparison.purchaseOrders.length})`}
                  className="font-bold text-xs"
                />
                <Tab
                  label={`Consumo / Entregas (${selectedComparison.movements.length})`}
                  className="font-bold text-xs"
                />
              </Tabs>
            </DialogTitle>

            <DialogContent dividers className="space-y-5 p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-900/40">
              {/* ABA 0: VISÃO GERAL & BALANÇO */}
              {detailTab === 0 && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                      <span className="text-[11px] font-semibold text-slate-500">Orçamento Aprovado</span>
                      <div className="text-base font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                        R$ {selectedComparison.budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                      <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">Total Comprado (OCs)</span>
                      <div className="text-base font-extrabold text-amber-700 dark:text-amber-400 mt-1">
                        R$ {selectedComparison.totalPurchased.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <span className="text-[10px] text-slate-400">Desembolso contratado</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">Total Entregue (Consumo)</span>
                      <div className="text-base font-extrabold text-emerald-700 dark:text-emerald-400 mt-1">
                        R$ {selectedComparison.totalDelivered.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <span className="text-[10px] text-slate-400">Retiradas do almoxarifado</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 shadow-xs">
                      <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">Em Almoxarifado para o Setor</span>
                      <div className="text-base font-extrabold text-blue-700 dark:text-blue-300 mt-1">
                        R$ {selectedComparison.stockWaitingConsumption.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <span className="text-[10px] text-blue-600 dark:text-blue-400">Disponível para uso imediato</span>
                    </div>
                  </div>

                  {/* BARRAS DE COMPARAÇÃO VISUAL */}
                  <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-4">
                    <Typography variant="subtitle2" className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                      Indicadores de Execução Orçamentária e Consumo
                    </Typography>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span>1. Comprometimento de Compras (Comprado vs. Orçamento):</span>
                        <span className="font-mono font-bold">
                          {selectedComparison.budget > 0
                            ? ((selectedComparison.totalPurchased / selectedComparison.budget) * 100).toFixed(1)
                            : 0}%
                        </span>
                      </div>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(
                          selectedComparison.budget > 0
                            ? (selectedComparison.totalPurchased / selectedComparison.budget) * 100
                            : 0,
                          100
                        )}
                        color="warning"
                        className="h-2.5 rounded-full"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span>2. Consumo Real do Setor (Entregue vs. Orçamento):</span>
                        <span className="font-mono font-bold">
                          {selectedComparison.budget > 0
                            ? ((selectedComparison.totalDelivered / selectedComparison.budget) * 100).toFixed(1)
                            : 0}%
                        </span>
                      </div>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(
                          selectedComparison.budget > 0
                            ? (selectedComparison.totalDelivered / selectedComparison.budget) * 100
                            : 0,
                          100
                        )}
                        color="success"
                        className="h-2.5 rounded-full"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span>3. Taxa de Retirada (Do que foi comprado, quanto já foi retirado pelo setor):</span>
                        <span className="font-mono font-bold text-blue-600">
                          {selectedComparison.totalPurchased > 0
                            ? ((selectedComparison.totalDelivered / selectedComparison.totalPurchased) * 100).toFixed(1)
                            : 100}%
                        </span>
                      </div>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(
                          selectedComparison.totalPurchased > 0
                            ? (selectedComparison.totalDelivered / selectedComparison.totalPurchased) * 100
                            : 100,
                          100
                        )}
                        color="primary"
                        className="h-2.5 rounded-full"
                      />
                    </div>
                  </div>

                  {/* DIAGNÓSTICO DO GESTOR */}
                  <Alert
                    severity={selectedComparison.stockWaitingConsumption > 0 ? "info" : "success"}
                    className="rounded-xl text-xs"
                  >
                    <strong>Diagnóstico Financeiro do Centro de Custo:</strong>{' '}
                    {selectedComparison.stockWaitingConsumption > 0 ? (
                      <span>
                        Este setor possui <strong>R$ {selectedComparison.stockWaitingConsumption.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> em materiais que a empresa já comprou e que estão guardados no Almoxarifado aguardando serem retirados pela equipe. Antes de aprovar novas compras, recomenda-se verificar o estoque disponível na aba "Balanço por Produto".
                      </span>
                    ) : (
                      <span>
                        O volume comprado está em paridade com o volume entregue e consumido pelo setor. Todo o material adquirido foi utilizado na operação.
                      </span>
                    )}
                  </Alert>
                </div>
              )}

              {/* ABA 1: BALANÇO FÍSICO E FINANCEIRO POR PRODUTO */}
              {detailTab === 1 && (
                <div className="space-y-3">
                  <Alert severity="info" className="text-xs rounded-xl">
                    Demonstração item a item do que foi <strong>comprado</strong> para este Centro de Custo versus o que foi <strong>entregue</strong> fisicamente para a equipe do setor.
                  </Alert>

                  {selectedComparison.productBalances.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      Nenhum produto com movimentação individual registrada especificamente para este Centro de Custo.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300">
                            <th className="p-3">Código</th>
                            <th className="p-3">Produto / Material</th>
                            <th className="p-3 text-right">Qtd Comprada</th>
                            <th className="p-3 text-right">Qtd Entregue</th>
                            <th className="p-3 text-right">Em Almoxarifado</th>
                            <th className="p-3 text-right">Preço Médio</th>
                            <th className="p-3 text-right">Valor em Estoque</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {selectedComparison.productBalances.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                              <td className="p-3 font-mono font-bold text-blue-600">{item.productCode}</td>
                              <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{item.productName}</td>
                              <td className="p-3 text-right font-bold text-amber-700 dark:text-amber-400">
                                {item.purchasedQty} {item.unit}
                              </td>
                              <td className="p-3 text-right font-bold text-emerald-700 dark:text-emerald-400">
                                {item.deliveredQty} {item.unit}
                              </td>
                              <td className="p-3 text-right">
                                <span className={`font-extrabold px-2 py-0.5 rounded-md ${
                                  item.inStockForSectorQty > 0
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300'
                                    : 'text-slate-400'
                                }`}>
                                  {item.inStockForSectorQty} {item.unit}
                                </span>
                              </td>
                              <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400">
                                R$ {item.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                                R$ {item.inStockForSectorValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ABA 2: ORDENS DE COMPRA */}
              {detailTab === 2 && (
                <div className="space-y-3">
                  <Alert severity="info" className="text-xs rounded-xl">
                    Ordens de Compra (OCs) emitidas diretamente para suprir as demandas deste Centro de Custo.
                  </Alert>

                  {selectedComparison.purchaseOrders.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      Nenhuma Ordem de Compra vinculada diretamente a este Centro de Custo até o momento.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300">
                            <th className="p-3">Código OC</th>
                            <th className="p-3">Fornecedor</th>
                            <th className="p-3">Data Emissão</th>
                            <th className="p-3">Itens</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 text-right">Valor Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {selectedComparison.purchaseOrders.map((po) => (
                            <tr key={po.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                              <td className="p-3 font-mono font-bold text-blue-600">{po.code}</td>
                              <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{po.supplierName}</td>
                              <td className="p-3 text-slate-600">{new Date(po.createdAt).toLocaleDateString('pt-BR')}</td>
                              <td className="p-3 text-slate-600">{po.items.length} item(ns)</td>
                              <td className="p-3">
                                <Chip label={po.status} size="small" variant="outlined" className="text-[10px] font-bold" />
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-amber-700 dark:text-amber-400">
                                R$ {po.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ABA 3: ENTREGAS E CONSUMO NO ALMOXARIFADO */}
              {detailTab === 3 && (
                <div className="space-y-3">
                  <Alert severity="info" className="text-xs rounded-xl">
                    Registro de baixas físicas no estoque e entregas de materiais aos colaboradores deste setor.
                  </Alert>

                  {selectedComparison.movements.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      Nenhuma saída de almoxarifado registrada para este Centro de Custo no período.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300">
                            <th className="p-3">Data</th>
                            <th className="p-3">Material Entregue</th>
                            <th className="p-3">Qtd</th>
                            <th className="p-3">Solicitante</th>
                            <th className="p-3">Doc / Ref</th>
                            <th className="p-3 text-right">Valor Consumido</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {selectedComparison.movements.map((mov) => (
                            <tr key={mov.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                              <td className="p-3 text-slate-600">{new Date(mov.date).toLocaleDateString('pt-BR')}</td>
                              <td className="p-3 font-medium text-slate-800 dark:text-slate-200">
                                <span className="font-mono font-bold text-blue-600 mr-1">{mov.productCode}</span>
                                {mov.productName}
                              </td>
                              <td className="p-3 font-bold text-emerald-700 dark:text-emerald-400">{mov.quantity}</td>
                              <td className="p-3 text-slate-600">{mov.requestedBy || 'Colaborador'}</td>
                              <td className="p-3 font-mono text-[11px] text-slate-500">{mov.documentNumber || '-'}</td>
                              <td className="p-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                R$ {mov.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>

            <DialogActions className="p-3 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
              <Button onClick={() => setDetailModalOpen(false)} color="inherit" className="font-bold text-xs">
                Fechar Extrato
              </Button>
            </DialogActions>
          </div>
        )}
      </Dialog>

      {/* MODAL DE CADASTRO / EDIÇÃO */}
      <Dialog open={ccModalOpen} onClose={() => setCcModalOpen(false)} maxWidth="xs" fullWidth>
        <form onSubmit={handleSaveCC}>
          <DialogTitle className="font-bold">Cadastrar Centro de Custo</DialogTitle>
          <DialogContent dividers className="space-y-4">
            {formError && <Alert severity="error">{formError}</Alert>}

            <TextField
              fullWidth
              label="Código do CC"
              value={ccForm.code || ''}
              onChange={(e) => setCcForm({ ...ccForm, code: e.target.value })}
              required
            />

            <TextField
              fullWidth
              label="Nome do Centro de Custo"
              value={ccForm.name || ''}
              onChange={(e) => setCcForm({ ...ccForm, name: e.target.value })}
              required
            />

            <FormControl fullWidth required>
              <InputLabel>Unidade</InputLabel>
              <Select
                value={ccForm.branch || 'SP'}
                onChange={(e) => setCcForm({ ...ccForm, branch: e.target.value as Branch })}
                label="Unidade"
              >
                {dataService.getBranches(true).map(b => (
                  <MenuItem key={b.id} value={b.code}>
                    Unidade {b.code} ({b.city})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              type="number"
              label="Orçamento Aprovado (R$)"
              value={ccForm.budget || 100000}
              onChange={(e) => setCcForm({ ...ccForm, budget: Number(e.target.value) })}
              required
            />

            <TextField
              fullWidth
              label="Gestor Responsável"
              value={ccForm.responsible || ''}
              onChange={(e) => setCcForm({ ...ccForm, responsible: e.target.value })}
              required
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCcModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" color="primary">Salvar</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};
