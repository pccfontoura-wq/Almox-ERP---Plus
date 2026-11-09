import React, { useState, useMemo, useEffect } from 'react';
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Select, FormControl, InputLabel, Alert, Chip, Card, CardContent,
  Table, TableBody, TableCell, TableHead, TableRow, Tabs, Tab, Tooltip, IconButton
} from '@mui/material';
import {
  ClipboardCheck, Plus, CheckCircle2, AlertTriangle, RefreshCw, FileDown,
  Printer, FileText, Filter, Search, Award, TrendingUp, CheckCircle, Clock, RotateCcw, Building2
} from 'lucide-react';

import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Breadcrumb } from '../components/Breadcrumb';
import { DataTable, Column } from '../components/DataTable';
import { InventoryAudit, Branch } from '../types';
import { exportInventoryCountSheetPDF, exportInventoryReconciliationPDF, exportToExcel } from '../utils/exportUtils';

export const Inventario: React.FC = () => {
  const { currentUser } = useAuth();
  const { selectedBranch, setSelectedBranch, refreshData, dataVersion } = useApp();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activeAudit, setActiveAudit] = useState<InventoryAudit | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [onlyDivergentInModal, setOnlyDivergentInModal] = useState(false);
  const [modalSearchTerm, setModalSearchTerm] = useState('');

  // Status Tab: 'TODAS' | 'EM_ANDAMENTO' | 'CONCLUIDO'
  const [tabStatus, setTabStatus] = useState<'TODAS' | 'EM_ANDAMENTO' | 'CONCLUIDO'>('TODAS');

  // Page-level branch filter - defaults to 'TODAS' so Master users always see all branch campaigns
  const [pageBranchFilter, setPageBranchFilter] = useState<Branch | 'TODAS'>('TODAS');

  // Replication dialog states
  const [replicateModalAudit, setReplicateModalAudit] = useState<InventoryAudit | null>(null);
  const [targetReplicateBranch, setTargetReplicateBranch] = useState<Branch>('SP');

  // Creation form states
  const [title, setTitle] = useState('');
  const [targetBranch, setTargetBranch] = useState<Branch>(selectedBranch === 'GLOBAL' ? 'SP' : selectedBranch);
  const [targetCategory, setTargetCategory] = useState<string>('TODAS');

  const [localTick, setLocalTick] = useState(0);

  // Subscribe to real-time dataService state changes
  useEffect(() => {
    const unsub = dataService.subscribe(() => {
      setLocalTick(t => t + 1);
    });
    return unsub;
  }, []);

  const state = useMemo(() => dataService.getState(), [dataVersion, localTick]);

  // Sync targetBranch when global selectedBranch changes
  useEffect(() => {
    if (selectedBranch !== 'GLOBAL') {
      setTargetBranch(selectedBranch);
    }
  }, [selectedBranch]);

  // Available categories in catalog
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    state.products.forEach(p => {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [state.products]);

  // Count of eligible products for the selected category & branch in the creation modal
  const eligibleProductsCount = useMemo(() => {
    return state.products.filter(p => {
      if (!p.active) return false;
      if (targetCategory !== 'TODAS' && p.category !== targetCategory) return false;
      return true;
    }).length;
  }, [state.products, targetCategory]);

  // Campaign count breakdown by branch
  const branchCounts = useMemo(() => {
    const map: Record<string, number> = { TODAS: state.inventories.length };
    state.inventories.forEach(i => {
      map[i.branch] = (map[i.branch] || 0) + 1;
    });
    return map;
  }, [state.inventories]);

  // All inventories filtered by pageBranchFilter
  const allBranchInventories = useMemo(() => {
    return state.inventories.filter(i => pageBranchFilter === 'TODAS' || i.branch === pageBranchFilter);
  }, [state.inventories, pageBranchFilter]);

  // Filtered by active tab status
  const displayedInventories = useMemo(() => {
    if (tabStatus === 'TODAS') return allBranchInventories;
    return allBranchInventories.filter(i => i.status === tabStatus);
  }, [allBranchInventories, tabStatus]);

  const inProgressCount = useMemo(() => {
    return allBranchInventories.filter(i => i.status === 'EM_ANDAMENTO').length;
  }, [allBranchInventories]);

  const completedCount = useMemo(() => {
    return allBranchInventories.filter(i => i.status === 'CONCLUIDO').length;
  }, [allBranchInventories]);

  const canEdit = currentUser?.role !== 'Visitante';

  const inventoryColumns: Column<InventoryAudit>[] = [
    {
      id: 'code',
      label: 'Código Inventário',
      accessor: (i) => i.code,
      sortable: true,
      render: (i) => (
        <span className="font-mono font-bold text-blue-700 dark:text-blue-400 text-xs">
          {i.code}
        </span>
      )
    },
    {
      id: 'title',
      label: 'Título da Campanha',
      accessor: (i) => i.title,
      sortable: true,
      render: (i) => (
        <div>
          <span className="font-bold text-slate-800 dark:text-slate-100 text-xs block">
            {i.title}
          </span>
          <span className="text-[11px] text-slate-500">
            {i.items.length} produto(s) auditado(s)
          </span>
        </div>
      )
    },
    {
      id: 'category',
      label: 'Categoria Auditada',
      accessor: (i) => i.category || 'Todas as Categorias',
      render: (i) => {
        const cat = i.category || 'TODAS';
        const isAll = cat === 'TODAS' || cat === 'Todas as Categorias';
        return (
          <Chip
            label={isAll ? 'Todas as Categorias (Geral)' : cat}
            size="small"
            className={`font-semibold text-[10px] h-5 ${
              isAll
                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300'
                : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
            }`}
          />
        );
      }
    },
    {
      id: 'branch',
      label: 'Unidade Auditada',
      accessor: (i) => i.branch,
      render: (i) => (
        <Box className="flex items-center gap-1.5 flex-wrap">
          <Chip
            label={`Unidade ${i.branch}`}
            size="small"
            className={`font-bold text-[10px] h-5 ${
              i.branch === 'RJ'
                ? 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                : 'bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
            }`}
          />
          {selectedBranch !== i.branch && (
            <Tooltip title={`Alternar visão do sistema para a Unidade ${i.branch}`}>
              <Button
                size="small"
                variant="text"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedBranch(i.branch);
                }}
                className="text-[10px] py-0 px-1 text-blue-600 dark:text-blue-400 hover:underline min-w-0 font-bold"
              >
                Ver {i.branch}
              </Button>
            </Tooltip>
          )}
        </Box>
      )
    },
    {
      id: 'status',
      label: 'Status da Campanha',
      accessor: (i) => i.status === 'EM_ANDAMENTO' ? 'Em Andamento' : 'Concluído',
      render: (i) => (
        <Chip
          label={i.status === 'EM_ANDAMENTO' ? 'Em Andamento' : 'Concluído'}
          color={i.status === 'EM_ANDAMENTO' ? 'warning' : 'success'}
          size="small"
          className="font-bold text-[10px] h-5"
          icon={i.status === 'EM_ANDAMENTO' ? <Clock className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
        />
      )
    },
    {
      id: 'accuracy',
      label: 'Acuracidade (%)',
      accessor: (i) => {
        const total = i.items.length;
        if (total === 0) return 100;
        const exact = i.items.filter(item => item.divergence === 0).length;
        return Number(((exact / total) * 100).toFixed(1));
      },
      render: (i) => {
        const total = i.items.length;
        const exact = i.items.filter(item => item.divergence === 0).length;
        const pct = total > 0 ? ((exact / total) * 100).toFixed(1) : '100.0';
        const numPct = Number(pct);
        return (
          <div className="flex items-center gap-1.5">
            <span className={`font-extrabold text-xs ${
              numPct >= 95 ? 'text-emerald-600 dark:text-emerald-400' :
              numPct >= 80 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
            }`}>
              {pct}%
            </span>
          </div>
        );
      }
    },
    {
      id: 'totalDivergenceCount',
      label: 'Divergências',
      accessor: (i) => i.totalDivergenceCount,
      render: (i) => (
        <span className={`text-xs font-bold ${i.totalDivergenceCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'}`}>
          {i.totalDivergenceCount > 0 ? `${i.totalDivergenceCount} item(ns)` : 'Nenhuma'}
        </span>
      )
    },
    {
      id: 'totalDivergenceValue',
      label: 'Impacto Financeiro',
      accessor: (i) => i.totalDivergenceValue,
      render: (i) => {
        const val = i.totalDivergenceValue || 0;
        return (
          <span className={`text-xs font-bold font-mono ${val === 0 ? 'text-slate-500' : val > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {val >= 0 ? `+R$ ${val.toFixed(2)}` : `-R$ ${Math.abs(val).toFixed(2)}`}
          </span>
        );
      }
    },
    {
      id: 'dates',
      label: 'Datas & Auditor',
      accessor: (i) => i.reconciledAt || i.startedAt,
      render: (i) => {
        const startDate = new Date(i.startedAt).toLocaleDateString('pt-BR');
        const finDate = i.reconciledAt || i.finishedAt;
        return (
          <div className="text-[11px] leading-tight">
            {finDate ? (
              <>
                <span className="text-emerald-700 dark:text-emerald-400 font-bold block">
                  Concluído: {new Date(finDate).toLocaleDateString('pt-BR')}
                </span>
                <span className="text-slate-400 block text-[10px]">
                  Por: {i.reconciledBy || i.createdBy || 'Auditor'}
                </span>
              </>
            ) : (
              <>
                <span className="text-amber-700 dark:text-amber-400 font-bold block">
                  Aberto em: {startDate}
                </span>
                <span className="text-slate-400 block text-[10px]">
                  Por: {i.createdBy || i.auditorUser || 'Auditor'}
                </span>
              </>
            )}
          </div>
        );
      }
    },
    {
      id: 'actions',
      label: 'Ações & Relatórios',
      accessor: (i) => i.id,
      exportable: false,
      render: (i) => (
        <Box className="flex items-center gap-1.5 flex-wrap">
          <Button
            size="small"
            variant={i.status === 'EM_ANDAMENTO' ? 'contained' : 'outlined'}
            color={i.status === 'EM_ANDAMENTO' ? 'primary' : 'inherit'}
            onClick={() => {
              setActiveAudit(i);
              const initialCounts: Record<string, number> = {};
              i.items.forEach(item => {
                initialCounts[item.productId] = item.countedQuantity;
              });
              setCounts(initialCounts);
              setOnlyDivergentInModal(false);
              setModalSearchTerm('');
            }}
            className="text-xs py-1 px-2.5 font-bold shadow-none"
          >
            {i.status === 'EM_ANDAMENTO' ? 'Lançar Contagem' : 'Ver Laudo & Resultado'}
          </Button>

          {i.status === 'CONCLUIDO' && (
            <>
              <Tooltip title="Baixar Laudo Técnico Oficial de Reconciliação (PDF)">
                <Button
                  size="small"
                  variant="outlined"
                  color="success"
                  onClick={(e) => {
                    e.stopPropagation();
                    exportInventoryReconciliationPDF(i, state.products);
                  }}
                  startIcon={<FileDown className="w-3.5 h-3.5 text-emerald-600" />}
                  className="text-xs py-1 px-2 font-medium border-emerald-300 text-emerald-700 dark:text-emerald-400 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                >
                  Laudo PDF
                </Button>
              </Tooltip>

              {canEdit && (
                <Tooltip title="Reabrir campanha para corrigir contagens e reconciliar novamente">
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReopenAudit(i);
                    }}
                    startIcon={<RotateCcw className="w-3.5 h-3.5 text-amber-600" />}
                    className="text-xs py-1 px-2 font-medium border-amber-300 text-amber-700 dark:text-amber-400 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                  >
                    Reabrir
                  </Button>
                </Tooltip>
              )}
            </>
          )}

          <Tooltip title="Baixar Folha de Contagem Cega (PDF) para conferência física">
            <Button
              size="small"
              variant="outlined"
              onClick={(e) => {
                e.stopPropagation();
                exportInventoryCountSheetPDF(i, state.products);
              }}
              startIcon={<FileDown className="w-3.5 h-3.5 text-blue-600" />}
              className="text-xs py-1 px-2 font-medium border-slate-300 text-slate-700 dark:text-slate-200 dark:border-slate-700 hover:bg-slate-50"
            >
              Folha Cega
            </Button>
          </Tooltip>
        </Box>
      )
    }
  ];

  const handleStartAudit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    // Filter products according to chosen category
    const filteredProducts = state.products.filter(p => {
      if (!p.active) return false;
      if (targetCategory !== 'TODAS' && p.category !== targetCategory) return false;
      return true;
    });

    if (filteredProducts.length === 0) {
      alert(`Nenhum produto ativo encontrado para a categoria "${targetCategory}" na unidade ${targetBranch}.`);
      return;
    }

    const productIds = filteredProducts.map(p => p.id);
    const campaignTitle = title.trim() || `Inventário ${targetCategory === 'TODAS' ? 'Geral' : targetCategory} (${targetBranch})`;

    const newAudit = dataService.createInventoryAudit(
      targetBranch,
      campaignTitle,
      productIds,
      currentUser,
      targetCategory
    );

    // Automatically trigger the Blind Count Sheet PDF download
    exportInventoryCountSheetPDF(newAudit, state.products);

    setCreateModalOpen(false);
    setTitle('');
    setTargetCategory('TODAS');
    refreshData();

    // Open counting modal directly
    setActiveAudit(newAudit);
    const initialCounts: Record<string, number> = {};
    newAudit.items.forEach(item => {
      initialCounts[item.productId] = item.countedQuantity;
    });
    setCounts(initialCounts);
  };

  const handleSaveCounts = () => {
    if (!activeAudit || !currentUser) return;
    const formatted = activeAudit.items.map(item => {
      const raw = counts[item.productId];
      const val = (raw !== undefined && raw !== ('' as any)) ? Number(raw) : item.countedQuantity;
      return {
        productId: item.productId,
        countedQuantity: Number.isFinite(val) && val >= 0 ? val : 0
      };
    });

    const updated = dataService.updateInventoryCount(activeAudit.id, formatted, currentUser);
    setActiveAudit(updated);
    const updatedCounts: Record<string, number> = {};
    updated.items.forEach(it => {
      updatedCounts[it.productId] = it.countedQuantity;
    });
    setCounts(updatedCounts);
    refreshData();
    alert('Contagem de inventário salva com sucesso como rascunho!');
  };

  const handleReconcile = () => {
    if (!activeAudit || !currentUser) return;
    if (!confirm('Deseja reconciliar o estoque agora? Isso ajustará automaticamente a quantidade de todos os produtos no banco com base na contagem apurada e marcará o inventário como Concluído.')) return;

    try {
      const formattedCounts = activeAudit.items.map(item => {
        const raw = counts[item.productId];
        const val = (raw !== undefined && raw !== ('' as any)) ? Number(raw) : item.countedQuantity;
        return {
          productId: item.productId,
          countedQuantity: Number.isFinite(val) && val >= 0 ? val : 0
        };
      });

      const reconciled = dataService.reconcileInventory(activeAudit.id, currentUser, formattedCounts);
      setActiveAudit(reconciled);

      const updatedCounts: Record<string, number> = {};
      reconciled.items.forEach(it => {
        updatedCounts[it.productId] = it.countedQuantity;
      });
      setCounts(updatedCounts);

      refreshData();
      if (selectedBranch !== 'GLOBAL' && selectedBranch !== reconciled.branch) {
        if (confirm(`Inventário ${reconciled.code} reconciliado com sucesso na Unidade ${reconciled.branch}!\n\nSeu sistema está visualizando atualmente a Unidade ${selectedBranch}.\nDeseja alternar a visualização para a Unidade ${reconciled.branch} agora para ver os novos saldos no Almoxarifado?`)) {
          setSelectedBranch(reconciled.branch);
        }
      } else {
        alert(`Inventário ${reconciled.code} reconciliado com sucesso! Saldos de estoque atualizados na Unidade ${reconciled.branch} e laudo emitido.`);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleReopenAudit = (audit: InventoryAudit) => {
    if (!currentUser) return;
    if (!confirm(`Deseja reabrir a campanha "${audit.title}" (${audit.code}) para correção ou recontagem? Os campos de quantidade ficarão editáveis novamente para você ajustar os saldos reais.`)) return;

    try {
      const reopened = dataService.reopenInventory(audit.id, currentUser);
      setActiveAudit(reopened);
      const initialCounts: Record<string, number> = {};
      reopened.items.forEach(item => {
        initialCounts[item.productId] = item.countedQuantity;
      });
      setCounts(initialCounts);
      refreshData();
      alert(`Inventário ${reopened.code} reaberto com sucesso. Você já pode ajustar as quantidades.`);
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Helper for Exporting Audit Items to Excel
  const handleExportModalToExcel = () => {
    if (!activeAudit) return;
    const prodMap = new Map<string, any>();
    state.products.forEach(p => prodMap.set(p.id, p));

    const exportData = activeAudit.items.map(item => {
      const prod = prodMap.get(item.productId);
      const uPrice = prod?.unitPrice || 0;
      const raw = counts[item.productId];
      const currentCounted = (raw !== undefined && raw !== ('' as any)) ? Number(raw) : item.countedQuantity;
      const divergence = currentCounted - item.systemQuantity;
      const divVal = divergence * uPrice;

      return {
        'Código Auditoria': activeAudit.code,
        'Unidade': activeAudit.branch,
        'Campanha': activeAudit.title,
        'Categoria Auditada': activeAudit.category || 'Todas',
        'SKU / Código': item.productCode,
        'Descrição do Produto': item.productName,
        'Categoria Produto': prod?.category || 'Geral',
        'UN': item.unit || prod?.unit || 'UN',
        'Localização': prod?.locationSlot || 'ALMOX-GERAL',
        'Qtd Sistema': item.systemQuantity,
        'Qtd Contada': currentCounted,
        'Divergência': divergence,
        'Preço Unitário (R$)': uPrice,
        'Divergência Financeira (R$)': divVal,
        'Status': divergence === 0 ? 'Conforme (Exato)' : divergence > 0 ? 'Sobra' : 'Falta'
      };
    });

    exportToExcel(exportData, `Inventario_Reconciliado_${activeAudit.code}_${activeAudit.branch}`);
  };

  // Modal active audit stats
  const modalStats = useMemo(() => {
    if (!activeAudit) return null;
    const total = activeAudit.items.length;
    let exact = 0;
    let liveTotalDivVal = 0;

    const prodMap = new Map<string, any>();
    state.products.forEach(p => prodMap.set(p.id, p));

    activeAudit.items.forEach(i => {
      const raw = counts[i.productId];
      const currentCounted = (raw !== undefined && raw !== ('' as any)) ? Number(raw) : i.countedQuantity;
      const div = currentCounted - i.systemQuantity;
      if (div === 0) {
        exact++;
      }
      const prod = prodMap.get(i.productId);
      const uPrice = prod ? prod.unitPrice : 0;
      liveTotalDivVal += (div * uPrice);
    });

    const divergent = total - exact;
    const accuracy = total > 0 ? ((exact / total) * 100).toFixed(1) : '100.0';

    return { total, exact, divergent, accuracy, liveTotalDivVal };
  }, [activeAudit, counts, state.products]);

  // Modal filtered items
  const modalFilteredItems = useMemo(() => {
    if (!activeAudit) return [];
    return activeAudit.items.filter(item => {
      const raw = counts[item.productId];
      const currentCounted = (raw !== undefined && raw !== ('' as any)) ? Number(raw) : item.countedQuantity;
      const isDivergent = currentCounted !== item.systemQuantity;

      if (onlyDivergentInModal && !isDivergent) return false;

      if (!modalSearchTerm.trim()) return true;
      const q = modalSearchTerm.toLowerCase();
      return item.productName.toLowerCase().includes(q) || item.productCode.toLowerCase().includes(q);
    });
  }, [activeAudit, counts, onlyDivergentInModal, modalSearchTerm]);

  return (
    <Box className="space-y-6">
      <Breadcrumb items={[{ label: 'Inventário Físico e Auditoria' }]} />

      {/* INFORMATIVE CARD */}
      <Alert severity="info" icon={<ClipboardCheck className="w-5 h-5" />} className="rounded-2xl">
        <strong>Inventário Cíclico & Rotativo por Categoria:</strong> Você pode abrir campanhas de inventário para <strong>Todas as Categorias</strong> ou focar em categorias específicas (ex: <em>EPI & Segurança</em>, <em>Elétrica</em>, <em>Ferramentas</em>). O sistema gera a <strong>Folha de Contagem Cega em PDF</strong> para a equipe de campo e, após a reconciliação, mantém o histórico permanente com emissão do <strong>Laudo Oficial de Auditoria</strong>.
      </Alert>

      {/* STATUS TABS & BRANCH QUICK SELECTOR */}
      <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-xs">
        <Box className="px-4 pt-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={tabStatus}
            onChange={(_, val) => setTabStatus(val)}
            indicatorColor="primary"
            textColor="primary"
            className="min-h-0"
          >
            <Tab
              value="TODAS"
              label={
                <Box className="flex items-center gap-2 py-1">
                  <span>Todas as Campanhas</span>
                  <Chip label={allBranchInventories.length} size="small" className="text-[10px] font-bold h-4 px-1" />
                </Box>
              }
              className="text-xs font-bold capitalize min-h-0 py-2.5"
            />
            <Tab
              value="EM_ANDAMENTO"
              label={
                <Box className="flex items-center gap-2 py-1">
                  <span>Em Andamento</span>
                  <Chip
                    label={inProgressCount}
                    color={inProgressCount > 0 ? 'warning' : 'default'}
                    size="small"
                    className="text-[10px] font-bold h-4 px-1"
                  />
                </Box>
              }
              className="text-xs font-bold capitalize min-h-0 py-2.5"
            />
            <Tab
              value="CONCLUIDO"
              label={
                <Box className="flex items-center gap-2 py-1">
                  <span>Finalizadas & Reconciliadas</span>
                  <Chip
                    label={completedCount}
                    color={completedCount > 0 ? 'success' : 'default'}
                    size="small"
                    className="text-[10px] font-bold h-4 px-1"
                  />
                </Box>
              }
              className="text-xs font-bold capitalize min-h-0 py-2.5"
            />
          </Tabs>

          <Button
            variant="contained"
            color="primary"
            startIcon={<Plus className="w-4 h-4" />}
            onClick={() => setCreateModalOpen(true)}
            className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
          >
            Iniciar Nova Campanha de Inventário
          </Button>
        </Box>

        {/* QUICK BRANCH FILTER BAR */}
        <Box className="px-4 py-2.5 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              Exibir Campanhas da Unidade:
            </span>
            <Chip
              clickable
              label={`🌐 Todas as Unidades (${branchCounts['TODAS'] || 0})`}
              color={pageBranchFilter === 'TODAS' ? 'primary' : 'default'}
              variant={pageBranchFilter === 'TODAS' ? 'filled' : 'outlined'}
              size="small"
              onClick={() => setPageBranchFilter('TODAS')}
              className="text-xs font-bold"
            />
            {dataService.getBranches(true).map(b => (
              <Chip
                key={b.id}
                clickable
                label={`🏢 ${b.code} (${branchCounts[b.code] || 0})`}
                color={pageBranchFilter === b.code ? 'primary' : 'default'}
                variant={pageBranchFilter === b.code ? 'filled' : 'outlined'}
                size="small"
                onClick={() => setPageBranchFilter(b.code)}
                className="text-xs font-bold"
              />
            ))}
          </div>

          <div className="text-[11px] text-slate-500">
            Filtro da barra superior: <strong className="text-blue-600 dark:text-blue-400">{selectedBranch === 'GLOBAL' ? 'Todas as Unidades' : `Unidade ${selectedBranch}`}</strong>
          </div>
        </Box>

        <Box className="p-4">
          <DataTable
            title="Campanhas de Inventário Físico"
            subTitle={pageBranchFilter === 'TODAS' ? 'Histórico consolidado de auditorias físicas de estoque em todas as unidades' : `Histórico de auditorias físicas de estoque para a unidade: ${pageBranchFilter}`}
            columns={inventoryColumns}
            data={displayedInventories}
            onAddClick={() => setCreateModalOpen(true)}
            addButtonLabel="Iniciar Nova Campanha de Inventário"
            canEditOrAdd={canEdit}
            initialUnitFilter="GLOBAL"
          />
        </Box>
      </Card>

      {/* CREATE AUDIT MODAL WITH CATEGORY SELECTION */}
      <Dialog
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <form onSubmit={handleStartAudit}>
          <DialogTitle className="font-bold flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
            <ClipboardCheck className="w-5 h-5 text-blue-600" />
            <span>Iniciar Nova Campanha de Inventário</span>
          </DialogTitle>

          <DialogContent dividers className="space-y-4 py-4">
            <Alert severity="info" className="text-xs rounded-xl">
              Selecione se deseja realizar um inventário geral completo ou focar em uma categoria específica. O sistema gerará automaticamente a <strong>Folha de Contagem Cega em PDF</strong> contendo apenas os produtos selecionados.
            </Alert>

            {/* UNIDADE DE DESTINO */}
            <FormControl fullWidth required size="small">
              <InputLabel>Unidade Objeto de Inventário</InputLabel>
              <Select
                value={targetBranch}
                onChange={(e) => setTargetBranch(e.target.value as Branch)}
                label="Unidade Objeto de Inventário"
              >
                {dataService.getBranches(true).map(b => (
                  <MenuItem key={b.id} value={b.code}>
                    {b.code} - {b.name} ({b.city}/{b.state})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* SELEÇÃO DE CATEGORIA */}
            <FormControl fullWidth required size="small">
              <InputLabel>Categoria a Inventariar</InputLabel>
              <Select
                value={targetCategory}
                onChange={(e) => {
                  const newCat = e.target.value as string;
                  setTargetCategory(newCat);
                  if (!title || title.startsWith('Inventário')) {
                    setTitle(`Inventário ${newCat === 'TODAS' ? 'Geral' : newCat} (${targetBranch})`);
                  }
                }}
                label="Categoria a Inventariar"
              >
                <MenuItem value="TODAS">
                  <span className="font-bold text-blue-600">Todas as Categorias (Inventário Geral Completo)</span>
                </MenuItem>
                {availableCategories.map(cat => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* INFORMAÇÃO DOS PRODUTOS ELEGÍVEIS */}
            <Box className="p-3 bg-blue-50/70 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-900 flex items-center justify-between text-xs">
              <span className="text-slate-700 dark:text-slate-300">
                Itens a serem incluídos na folha de contagem:
              </span>
              <Chip
                label={`${eligibleProductsCount} produtos encontrados`}
                color={eligibleProductsCount > 0 ? 'primary' : 'default'}
                size="small"
                className="font-bold text-[11px]"
              />
            </Box>

            {/* TÍTULO DA CAMPANHA */}
            <TextField
              fullWidth
              size="small"
              label="Título da Campanha"
              placeholder={`Ex: Inventário ${targetCategory === 'TODAS' ? 'Geral Q3' : targetCategory} (${targetBranch})`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              helperText="Identificação executiva que constará nos laudos e relatórios"
            />
          </DialogContent>

          <DialogActions className="p-4 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
            <Button onClick={() => setCreateModalOpen(false)} color="inherit">
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={eligibleProductsCount === 0}
              startIcon={<FileDown className="w-4 h-4" />}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
            >
              Criar Campanha & Baixar Folha Cega (PDF)
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* COUNTING & RECONCILIATION MODAL */}
      {activeAudit && (
        <Dialog open={true} onClose={() => setActiveAudit(null)} maxWidth="lg" fullWidth>
          <DialogTitle className="font-bold bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 py-3">
            <Box className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-blue-400" />
              <div>
                <Typography variant="h6" className="font-bold text-white text-base md:text-lg leading-tight">
                  {activeAudit.title} ({activeAudit.code})
                </Typography>
                <Typography variant="caption" className="text-slate-300 block text-[11px]">
                  Unidade: <strong>{activeAudit.branch}</strong> • Categoria: <strong>{activeAudit.category || 'Todas as Categorias'}</strong>
                </Typography>
              </div>
              <Chip
                label={activeAudit.status === 'EM_ANDAMENTO' ? 'Em Andamento' : 'Concluído & Reconciliado'}
                color={activeAudit.status === 'EM_ANDAMENTO' ? 'warning' : 'success'}
                size="small"
                className="font-bold ml-2 text-[10px]"
              />
            </Box>

            {/* ACTION BUTTONS IN HEADER */}
            <Box className="flex items-center gap-2">
              {activeAudit.status === 'CONCLUIDO' && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<FileDown className="w-4 h-4" />}
                  onClick={() => exportInventoryReconciliationPDF(activeAudit, state.products)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                >
                  Laudo Oficial (PDF)
                </Button>
              )}

              <Button
                variant="outlined"
                size="small"
                startIcon={<FileDown className="w-4 h-4 text-blue-400" />}
                onClick={() => exportInventoryCountSheetPDF(activeAudit, state.products)}
                className="text-white border-slate-700 hover:bg-slate-800 font-bold text-xs"
              >
                Folha Cega (PDF)
              </Button>
            </Box>
          </DialogTitle>

          <DialogContent dividers className="space-y-4">
            {/* CONCLUDED SUCCESS BANNER */}
            {activeAudit.status === 'CONCLUIDO' ? (
              <Alert severity="success" icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />} className="rounded-xl">
                <strong>Inventário Finalizado e Reconciliado:</strong> Os saldos físicos foram homologados e aplicados no estoque da Unidade {activeAudit.branch} em{' '}
                <strong>{activeAudit.reconciledAt ? new Date(activeAudit.reconciledAt).toLocaleString('pt-BR') : 'Data registrada'}</strong> por{' '}
                <strong>{activeAudit.reconciledBy || 'Diretoria de Operações'}</strong>. As movimentações contábeis de ajuste foram registradas com sucesso.
              </Alert>
            ) : (
              <Alert severity="warning" icon={<FileText className="w-5 h-5 text-amber-600" />} className="text-xs rounded-xl">
                <strong>Fluxo de Contagem Física:</strong> Entregue a <strong>Folha de Contagem Cega em PDF</strong> aos operadores no galpão. Conforme a contagem física for apurada, digite a quantidade real encontrada na coluna <strong>"Qtd Contada"</strong>. Quando todos os itens forem apurados, clique em <strong>"Reconciliar Estoque Definitivo"</strong> para gravar o laudo e ajustar os saldos.
              </Alert>
            )}

            {/* EXECUTIVE SUMMARY KPI CARDS */}
            {modalStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <Typography variant="caption" className="text-slate-500 block text-[10px] font-bold uppercase">
                    Total de Itens Auditados
                  </Typography>
                  <Typography variant="h6" className="font-extrabold text-slate-800 dark:text-slate-100 text-lg">
                    {modalStats.total} produtos
                  </Typography>
                  <Typography variant="caption" className="text-slate-400 block text-[10px]">
                    Categoria: {activeAudit.category || 'Geral'}
                  </Typography>
                </Card>

                <Card className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl">
                  <Typography variant="caption" className="text-emerald-700 dark:text-emerald-400 block text-[10px] font-bold uppercase">
                    Acuracidade Física
                  </Typography>
                  <Typography variant="h6" className="font-extrabold text-emerald-700 dark:text-emerald-400 text-lg">
                    {modalStats.accuracy}%
                  </Typography>
                  <Typography variant="caption" className="text-emerald-600 block text-[10px]">
                    {modalStats.exact} itens com saldo 100% exato
                  </Typography>
                </Card>

                <Card className="p-3 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl">
                  <Typography variant="caption" className="text-rose-700 dark:text-rose-400 block text-[10px] font-bold uppercase">
                    Itens com Divergência
                  </Typography>
                  <Typography variant="h6" className="font-extrabold text-rose-700 dark:text-rose-400 text-lg">
                    {modalStats.divergent} itens
                  </Typography>
                  <Typography variant="caption" className="text-rose-600 block text-[10px]">
                    Requerem ajuste de saldo
                  </Typography>
                </Card>

                <Card className="p-3 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-xl">
                  <Typography variant="caption" className="text-blue-700 dark:text-blue-400 block text-[10px] font-bold uppercase">
                    Ajuste Financeiro Total
                  </Typography>
                  <Typography variant="h6" className="font-extrabold text-blue-700 dark:text-blue-400 text-lg font-mono">
                    R$ {(modalStats?.liveTotalDivVal ?? activeAudit.totalDivergenceValue ?? 0).toFixed(2)}
                  </Typography>
                  <Typography variant="caption" className="text-blue-600 block text-[10px]">
                    Impacto contábil apurado
                  </Typography>
                </Card>
              </div>
            )}

            {/* FILTER BAR INSIDE MODAL */}
            <Box className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Box className="flex items-center gap-2 flex-1 max-w-sm">
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Pesquisar por SKU ou descrição..."
                  value={modalSearchTerm}
                  onChange={(e) => setModalSearchTerm(e.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: <Search className="w-4 h-4 text-slate-400 mr-1.5" />
                    }
                  }}
                />
              </Box>

              <Box className="flex items-center gap-2">
                <Button
                  size="small"
                  variant={onlyDivergentInModal ? 'contained' : 'outlined'}
                  color={onlyDivergentInModal ? 'error' : 'inherit'}
                  onClick={() => setOnlyDivergentInModal(!onlyDivergentInModal)}
                  className="text-xs font-semibold"
                >
                  {onlyDivergentInModal ? 'Exibindo Apenas Divergências' : 'Filtrar Apenas Divergências'}
                </Button>

                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleExportModalToExcel}
                  className="text-xs font-semibold border-slate-300 text-slate-700 dark:text-slate-200"
                >
                  Exportar Planilha (Excel)
                </Button>
              </Box>
            </Box>

            {/* AUDITED ITEMS TABLE */}
            <Table size="small">
              <TableHead className="bg-slate-100 dark:bg-slate-800">
                <TableRow>
                  <TableCell className="font-bold text-xs">SKU</TableCell>
                  <TableCell className="font-bold text-xs">Descrição do Item</TableCell>
                  <TableCell className="font-bold text-xs">Categoria</TableCell>
                  <TableCell className="font-bold text-xs">Localização</TableCell>
                  <TableCell align="right" className="font-bold text-xs">Qtd Sistema</TableCell>
                  <TableCell align="right" className="font-bold text-xs">Qtd Contada (Físico)</TableCell>
                  <TableCell align="right" className="font-bold text-xs">Divergência</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {modalFilteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" className="py-6 text-slate-400 text-xs">
                      Nenhum item encontrado com os filtros atuais.
                    </TableCell>
                  </TableRow>
                ) : (
                  modalFilteredItems.map((item) => {
                    const raw = counts[item.productId];
                    const currentCounted = (raw !== undefined && raw !== ('' as any)) ? Number(raw) : item.countedQuantity;
                    const div = currentCounted - item.systemQuantity;
                    const prod = state.products.find(p => p.id === item.productId || p.code === item.productCode);
                    return (
                      <TableRow
                        key={item.productId}
                        hover
                        className={div !== 0 ? (div > 0 ? 'bg-emerald-50/30 dark:bg-emerald-950/10' : 'bg-rose-50/30 dark:bg-rose-950/10') : ''}
                      >
                        <TableCell className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                          {item.productCode}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="font-medium text-slate-800 dark:text-slate-200">{item.productName}</span>
                          <span className="text-[10px] text-slate-400 block">{prod?.unit || 'UN'}</span>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                          <Chip label={prod?.category || 'Geral'} size="small" className="text-[9px] h-4 bg-slate-200 dark:bg-slate-700" />
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 font-mono">
                          {prod?.locationSlot || 'ALMOX-GERAL'}
                        </TableCell>
                        <TableCell align="right" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {item.systemQuantity} {prod?.unit || 'UN'}
                        </TableCell>
                        <TableCell align="right">
                          {activeAudit.status === 'EM_ANDAMENTO' && canEdit ? (
                            <TextField
                              type="number"
                              size="small"
                              className="w-24"
                              value={counts[item.productId] !== undefined ? counts[item.productId] : item.countedQuantity}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCounts(prev => ({
                                  ...prev,
                                  [item.productId]: val === '' ? ('' as any) : Number(val)
                                }));
                              }}
                              slotProps={{
                                htmlInput: { min: 0 }
                              }}
                            />
                          ) : (
                            <Typography className="text-xs font-bold">{item.countedQuantity} {prod?.unit || 'UN'}</Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Typography className={`text-xs font-bold ${div === 0 ? 'text-slate-400' : div > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {div > 0 ? `+${div}` : div} {prod?.unit || 'UN'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </DialogContent>

          <DialogActions className="p-4 bg-slate-50 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
            <Button onClick={() => setActiveAudit(null)} variant="outlined" color="inherit">
              Fechar Janela
            </Button>

            <Box className="flex items-center gap-2">
              {activeAudit.status === 'CONCLUIDO' ? (
                <>
                  {canEdit && (
                    <Button
                      variant="outlined"
                      color="info"
                      startIcon={<RefreshCw className="w-4 h-4 text-blue-600" />}
                      onClick={() => {
                        setReplicateModalAudit(activeAudit);
                        setTargetReplicateBranch(activeAudit.branch === 'SP' ? 'RJ' : 'SP');
                      }}
                      className="border-blue-400 text-blue-700 dark:text-blue-300 hover:bg-blue-50 text-xs font-bold"
                    >
                      Replicar para Outra Unidade
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      variant="outlined"
                      color="warning"
                      startIcon={<RotateCcw className="w-4 h-4 text-amber-600" />}
                      onClick={() => handleReopenAudit(activeAudit)}
                      className="border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-50 text-xs font-bold"
                    >
                      Reabrir para Correção / Recontagem
                    </Button>
                  )}
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<FileDown className="w-4 h-4" />}
                    onClick={() => exportInventoryReconciliationPDF(activeAudit, state.products)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                  >
                    Baixar Laudo de Reconciliação (PDF)
                  </Button>
                </>
              ) : (
                canEdit && (
                  <>
                    <Button
                      variant="outlined"
                      onClick={handleSaveCounts}
                      color="primary"
                      className="text-xs font-semibold"
                    >
                      Salvar Rascunho da Contagem
                    </Button>
                    <Button
                      variant="contained"
                      color="success"
                      onClick={handleReconcile}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                      startIcon={<CheckCircle2 className="w-4 h-4" />}
                    >
                      Reconciliar Estoque Definitivo
                    </Button>
                  </>
                )
              )}
            </Box>
          </DialogActions>
        </Dialog>
      )}

      {/* REPLICATE INVENTORY TO ANOTHER BRANCH DIALOG */}
      <Dialog
        open={Boolean(replicateModalAudit)}
        onClose={() => setReplicateModalAudit(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle className="font-bold flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
          <RefreshCw className="w-5 h-5 text-blue-600" />
          <span>Replicar Saldos de Inventário</span>
        </DialogTitle>
        <DialogContent dividers className="space-y-3 py-4 text-xs">
          <Typography className="text-xs text-slate-600 dark:text-slate-300">
            Você está prestes a aplicar os saldos físicos apurados na campanha <strong>{replicateModalAudit?.title}</strong> ({replicateModalAudit?.code}) em outra filial da rede.
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Unidade de Destino</InputLabel>
            <Select
              value={targetReplicateBranch}
              onChange={(e) => setTargetReplicateBranch(e.target.value as Branch)}
              label="Unidade de Destino"
            >
              {dataService.getBranches(true).map(b => (
                <MenuItem key={b.id} value={b.code}>
                  {b.code} - {b.name} ({b.city}/{b.state})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Alert severity="warning" className="text-xs rounded-xl">
            Esta operação atualizará imediatamente o estoque físico de todos os <strong>{replicateModalAudit?.items.length} itens</strong> na <strong>Unidade {targetReplicateBranch}</strong> com base na contagem apurada.
          </Alert>
        </DialogContent>
        <DialogActions className="p-3 bg-slate-50 dark:bg-slate-900">
          <Button onClick={() => setReplicateModalAudit(null)} color="inherit" className="text-xs">
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              if (!replicateModalAudit || !currentUser) return;
              try {
                dataService.replicateInventoryToBranch(replicateModalAudit.id, targetReplicateBranch, currentUser);
                refreshData();
                setReplicateModalAudit(null);
                setSelectedBranch(targetReplicateBranch);
                alert(`Saldos do inventário aplicados com sucesso na Unidade ${targetReplicateBranch}! A visão do sistema foi alternada para esta unidade.`);
              } catch (err: any) {
                alert(err.message);
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 font-bold text-xs"
          >
            Confirmar e Aplicar na Unidade {targetReplicateBranch}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
