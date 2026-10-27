import React, { useState } from 'react';
import {
  Box, Typography, Tabs, Tab, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Select, FormControl, InputLabel,
  Alert, Chip, IconButton, Tooltip, RadioGroup, FormControlLabel, Radio
} from '@mui/material';
import {
  ArrowRightLeft, Eye, Paperclip, Upload, Printer, FileText,
  FileSpreadsheet, DownloadCloud, UploadCloud, CheckCircle2, AlertCircle
} from 'lucide-react';

import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Breadcrumb } from '../components/Breadcrumb';
import { DataTable, Column } from '../components/DataTable';
import { Product, Movement, Transfer, Requisition, Branch, ProductAttachment } from '../types';
import { ProductDetailModal } from '../components/ProductDetailModal';
import { exportRequisitionPDF } from '../utils/exportUtils';
import {
  downloadProductCSVTemplate, parseProductsCSV,
  CSVParseResult, PRODUCT_CSV_COLUMNS
} from '../utils/csvProductUtils';

export const Almoxarifado: React.FC = () => {
  const { currentUser } = useAuth();
  const { selectedBranch, refreshData } = useApp();

  const [currentTab, setCurrentTab] = useState(0);

  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [movementForm, setMovementForm] = useState({
    productId: '',
    type: 'ENTRADA' as 'ENTRADA' | 'SAIDA' | 'AJUSTE',
    quantity: 1,
    branch: (selectedBranch === 'GLOBAL' ? currentUser?.branch || 'SP' : selectedBranch) as Branch,
    costCenterId: '',
    notes: '',
    documentNumber: ''
  });

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    productId: '',
    originBranch: (currentUser?.branch || 'SP') as Branch,
    destinationBranch: 'RJ' as Branch,
    quantity: 1,
    notes: ''
  });

  const [reqModalOpen, setReqModalOpen] = useState(false);
  const [reqForm, setReqForm] = useState({
    costCenterId: '',
    priority: 'MEDIA' as Requisition['priority'],
    items: [{ productId: '', quantity: 1 }]
  });

  const [formError, setFormError] = useState<string | null>(null);

  // CSV Import Modal & State
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvParseResult, setCsvParseResult] = useState<CSVParseResult | null>(null);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvImportMode, setCsvImportMode] = useState<'MERGE' | 'REPLACE'>('MERGE');
  const [csvImportSuccess, setCsvImportSuccess] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);

  const handleCsvFileUpload = (file: File) => {
    setCsvFileName(file.name);
    setCsvError(null);
    setCsvImportSuccess(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseProductsCSV(text);
        if (parsed.errors.length > 0) {
          setCsvError(parsed.errors.join(' '));
          setCsvParseResult(null);
        } else {
          setCsvParseResult(parsed);
        }
      } catch (err: any) {
        setCsvError('Erro ao ler arquivo CSV: ' + err.message);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleConfirmCsvImport = () => {
    if (!csvParseResult || !currentUser) return;
    try {
      const res = dataService.importProductsBulk(csvParseResult.products, currentUser, csvImportMode);
      setCsvImportSuccess(`🎉 Importação concluída! ${res.created} produtos novos criados e ${res.updated} atualizados.`);
      refreshData();
      setTimeout(() => {
        setCsvModalOpen(false);
        setCsvParseResult(null);
        setCsvFileName('');
        setCsvImportSuccess(null);
      }, 2500);
    } catch (err: any) {
      setCsvError(err.message || 'Erro ao importar produtos.');
    }
  };

  const state = dataService.getState();
  const products = dataService.getProducts(selectedBranch);
  const movements = state.movements;
  const transfers = state.transfers;
  const requisitions = state.requisitions;

  const getProductCategory = (productId: string) => {
    return state.products.find(p => p.id === productId)?.category || 'Geral';
  };

  const canEdit = currentUser?.role !== 'Visitante';

  const productColumns: Column<Product>[] = [
    { id: 'code', label: 'Código SKU', accessor: (p) => p.code, sortable: true },
    { id: 'name', label: 'Nome do Produto', accessor: (p) => p.name, sortable: true },
    { id: 'category', label: 'Categoria', accessor: (p) => p.category, sortable: true },
    { id: 'unit', label: 'Unidade', accessor: (p) => p.unit },
    {
      id: 'stock',
      label: 'Estoque Local / Mínimo',
      accessor: (p) => {
        return selectedBranch === 'GLOBAL'
          ? Object.values(p.stockByBranch).reduce((a, b) => a + b, 0)
          : (p.stockByBranch[selectedBranch] || 0);
      },
      render: (p) => {
        const qty = selectedBranch === 'GLOBAL'
          ? Object.values(p.stockByBranch).reduce((a, b) => a + b, 0)
          : (p.stockByBranch[selectedBranch] || 0);
        const isLow = qty <= p.minStock;
        return (
          <Box className="flex items-center gap-2">
            <Typography className={`font-bold text-xs ${isLow ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>
              {qty} {p.unit}
            </Typography>
            {isLow && (
              <Chip label="Crítico" size="small" color="error" className="text-[9px] h-4 font-bold" />
            )}
          </Box>
        );
      }
    },
    { id: 'unitPrice', label: 'Preço Médio (R$)', accessor: (p) => `R$ ${p.unitPrice.toFixed(2)}`, sortable: true },
    { id: 'locationSlot', label: 'Prateleira', accessor: (p) => p.locationSlot },
    {
      id: 'actions',
      label: 'Ações',
      accessor: (p) => p.id,
      exportable: false,
      render: (p) => (
        <Box className="flex items-center gap-1">
          <Button
            size="small"
            variant="contained"
            color="primary"
            startIcon={<Eye className="w-3 h-3" />}
            onClick={() => setDetailProduct(p)}
            className="text-[10px] py-0.5 px-2 font-bold bg-blue-600 hover:bg-blue-700"
          >
            Ver Ficha (7 Abas)
          </Button>
          {canEdit && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                setEditingProduct(p);
                setProductModalOpen(true);
              }}
              className="text-[10px] py-0.5 px-2"
            >
              Editar
            </Button>
          )}
        </Box>
      )
    }
  ];

  const movementColumns: Column<Movement>[] = [
    { id: 'date', label: 'Data / Hora', accessor: (m) => new Date(m.date).toLocaleString('pt-BR'), sortable: true },
    { id: 'type', label: 'Tipo', accessor: (m) => m.type === 'ENTRADA' ? 'Entrada' : m.type === 'SAIDA' ? 'Saída' : 'Transferência', render: (m) => (
      <Chip 
        label={m.type === 'ENTRADA' ? 'Entrada' : m.type === 'SAIDA' ? 'Saída' : 'Transferência'} 
        size="small" 
        color={m.type === 'ENTRADA' ? 'success' : m.type === 'SAIDA' ? 'error' : 'warning'}
        className="font-bold text-[10px] h-5"
      />
    )},
    { id: 'productName', label: 'Produto', accessor: (m) => m.productName },
    { id: 'category', label: 'Categoria', accessor: (m) => getProductCategory(m.productId), sortable: true },
    { id: 'quantity', label: 'Quantidade', accessor: (m) => `${m.quantity} ${m.type === 'ENTRADA' ? '(+)' : '(-)'}` },
    { id: 'totalPrice', label: 'Valor Total', accessor: (m) => `R$ ${m.totalPrice.toFixed(2)}` },
    { id: 'branch', label: 'Unidade', accessor: (m) => m.branch },
    { id: 'responsibleUser', label: 'Responsável', accessor: (m) => m.responsibleUser },
    { id: 'documentNumber', label: 'Nº Documento', accessor: (m) => m.documentNumber || '-' }
  ];

  const transferColumns: Column<Transfer>[] = [
    { id: 'code', label: 'Código', accessor: (t) => t.code, sortable: true },
    { id: 'originBranch', label: 'Origem', accessor: (t) => t.originBranch },
    { id: 'destinationBranch', label: 'Destino', accessor: (t) => t.destinationBranch },
    { id: 'productName', label: 'Produto', accessor: (t) => t.productName },
    { id: 'category', label: 'Categoria', accessor: (t) => getProductCategory(t.productId), sortable: true },
    { id: 'quantity', label: 'Qtd', accessor: (t) => t.quantity },
    {
      id: 'status',
      label: 'Status',
      accessor: (t) => t.status === 'EM_TRANSITO' ? 'Trânsito' : t.status === 'CONCLUIDO' ? 'Concluído' : 'Cancelado',
      render: (t) => (
        <Chip
          label={t.status === 'EM_TRANSITO' ? 'Trânsito' : t.status === 'CONCLUIDO' ? 'Concluído' : 'Cancelado'}
          color={t.status === 'EM_TRANSITO' ? 'warning' : t.status === 'CONCLUIDO' ? 'success' : 'error'}
          size="small"
          className="font-bold text-[10px] h-5"
        />
      )
    },
    { id: 'sentAt', label: 'Enviado Em', accessor: (t) => new Date(t.sentAt).toLocaleDateString('pt-BR') },
    {
      id: 'actions',
      label: 'Ações Destino',
      accessor: (t) => t.id,
      exportable: false,
      render: (t) => {
        if (t.status === 'EM_TRANSITO' && canEdit) {
          const isDestinationUser = currentUser?.role === 'Master' || currentUser?.branch === t.destinationBranch;
          return (
            <Button
              size="small"
              variant="contained"
              color="success"
              disabled={!isDestinationUser}
              onClick={() => handleConfirmReceipt(t.id)}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 px-2.5"
            >
              Confirmar Recebimento
            </Button>
          );
        }
        return <Typography variant="caption" className="text-slate-400">{t.receivedBy ? `Recebido por ${t.receivedBy}` : '-'}</Typography>;
      }
    }
  ];

  const requisitionColumns: Column<Requisition>[] = [
    { id: 'code', label: 'Código', accessor: (r) => r.code, sortable: true },
    { id: 'createdAt', label: 'Data Solicitação', accessor: (r) => new Date(r.createdAt).toLocaleDateString('pt-BR'), sortable: true },
    { id: 'requestedBy', label: 'Solicitante', accessor: (r) => r.requestedBy },
    { id: 'branch', label: 'Unidade', accessor: (r) => r.branch },
    { id: 'costCenterName', label: 'Centro de Custo', accessor: (r) => r.costCenterName },
    {
      id: 'itemsSummary',
      label: 'Materiais Solicitados',
      accessor: (r) => r.items.map(i => `${i.productName} (${i.requestedQuantity} ${i.unit})`).join(', ')
    },
    {
      id: 'category',
      label: 'Categoria',
      accessor: (r) => Array.from(new Set(r.items.map(i => getProductCategory(i.productId)))).join(', '),
      sortable: true
    },
    { id: 'priority', label: 'Prioridade', accessor: (r) => r.priority },
    {
      id: 'status',
      label: 'Status',
      accessor: (r) => r.status === 'PENDENTE' ? 'Pendente' : r.status === 'APROVADO' ? 'Aprovado' : r.status === 'ATENDIDO' ? 'Atendido' : 'Rejeitado',
      render: (r) => {
        const displayLabel = r.status === 'PENDENTE' ? 'Pendente' : r.status === 'APROVADO' ? 'Aprovado' : r.status === 'ATENDIDO' ? 'Atendido' : 'Rejeitado';
        return (
          <Chip
            label={displayLabel}
            color={r.status === 'PENDENTE' ? 'warning' : r.status === 'APROVADO' ? 'info' : r.status === 'ATENDIDO' ? 'success' : 'error'}
            size="small"
            className="font-bold text-[10px] h-5"
          />
        );
      }
    },
    {
      id: 'actions',
      label: 'Ações de Aprovação & Impressão',
      accessor: (r) => r.id,
      exportable: false,
      render: (r) => (
        <Box className="flex items-center gap-1">
          <Tooltip title="Imprimir / Baixar PDF Oficial da Requisição (SM)">
            <IconButton
              size="small"
              onClick={() => {
                const branchInfo = dataService.getBranchByCode(r.branch);
                const cc = state.costCenters.find(c => c.id === r.costCenterId);
                exportRequisitionPDF(r, branchInfo, cc);
              }}
              className="p-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800"
            >
              <Printer className="w-3.5 h-3.5" />
            </IconButton>
          </Tooltip>

          {r.status === 'PENDENTE' && canEdit && (
            <>
              <Button
                size="small"
                variant="contained"
                color="info"
                onClick={() => handleApproveReq(r.id)}
                className="text-[10px] py-0.5 px-2 font-bold"
              >
                Aprovar
              </Button>
              <Button
                size="small"
                variant="contained"
                color="success"
                onClick={() => handleFulfillReq(r.id)}
                className="text-[10px] py-0.5 px-2 font-bold"
              >
                Atender
              </Button>
            </>
          )}

          {r.status !== 'PENDENTE' && (
            <Typography variant="caption" className="text-slate-400 text-[10px]">
              {r.approvedBy ? `Aprovado por ${r.approvedBy}` : '-'}
            </Typography>
          )}
        </Box>
      )
    }
  ];

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    try {
      dataService.saveProduct(editingProduct || {}, currentUser);
      setProductModalOpen(false);
      setEditingProduct(null);
      refreshData();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const handleRegisterMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setFormError(null);
    try {
      dataService.registerMovement(
        movementForm.productId,
        movementForm.type,
        Number(movementForm.quantity),
        movementForm.branch,
        currentUser,
        movementForm.notes,
        movementForm.costCenterId,
        movementForm.documentNumber
      );
      setMovementModalOpen(false);
      refreshData();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const handleCreateTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setFormError(null);
    try {
      dataService.createTransfer(
        transferForm.originBranch,
        transferForm.destinationBranch,
        transferForm.productId,
        Number(transferForm.quantity),
        currentUser,
        transferForm.notes
      );
      setTransferModalOpen(false);
      refreshData();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const handleConfirmReceipt = (transferId: string) => {
    if (!currentUser) return;
    try {
      dataService.confirmTransferReceipt(transferId, currentUser);
      refreshData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateReq = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    try {
      const items = reqForm.items.map(i => {
        const p = state.products.find(x => x.id === i.productId);
        return {
          productId: i.productId,
          productCode: p ? p.code : 'SKU',
          productName: p ? p.name : 'Item',
          unit: p ? p.unit : 'UN',
          requestedQuantity: Number(i.quantity)
        };
      });

      dataService.createRequisition(
        currentUser.branch,
        reqForm.costCenterId || state.costCenters[0]?.id || 'cc-101',
        items,
        currentUser,
        reqForm.priority
      );
      setReqModalOpen(false);
      refreshData();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const handleApproveReq = (reqId: string) => {
    if (!currentUser) return;
    dataService.updateRequisitionStatus(reqId, 'APROVADO', currentUser);
    refreshData();
  };

  const handleFulfillReq = (reqId: string) => {
    if (!currentUser) return;
    dataService.updateRequisitionStatus(reqId, 'ATENDIDO', currentUser);
    refreshData();
  };

  return (
    <Box className="space-y-6">
      <Breadcrumb items={[{ label: 'Almoxarifado Geral' }]} />

      <Box className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-2 shadow-xs">
        <Tabs 
          value={currentTab} 
          onChange={(_, val) => setCurrentTab(val)}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label="Catálogo de Produtos" className="font-bold text-xs" />
          <Tab label="Movimentações de Estoque" className="font-bold text-xs" />
          <Tab label="Transferências entre Unidades" className="font-bold text-xs" />
          <Tab label="Solicitações de Material" className="font-bold text-xs" />
        </Tabs>
      </Box>

      {currentTab === 0 && (
        <Box className="space-y-4">
          <Box className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-blue-50 via-indigo-50/40 to-slate-50 dark:from-slate-900 dark:via-blue-950/20 dark:to-slate-900 rounded-2xl border border-blue-200 dark:border-blue-900 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <Typography className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  Carga em Lote de Produtos Reais (Planilha / CSV)
                  <Chip label="Importação Rápida" size="small" className="text-[10px] h-4 font-bold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" />
                </Typography>
                <Typography variant="caption" className="text-slate-500 text-[11px] block">
                  Cadastre ou atualize centenas de produtos e saldos das 4 unidades em segundos via arquivo CSV.
                </Typography>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="small"
                variant="outlined"
                startIcon={<DownloadCloud className="w-4 h-4 text-blue-600" />}
                onClick={downloadProductCSVTemplate}
                className="text-xs font-bold border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800"
              >
                Baixar Modelo CSV
              </Button>
              {canEdit && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<UploadCloud className="w-4 h-4" />}
                  onClick={() => {
                    setCsvParseResult(null);
                    setCsvFileName('');
                    setCsvError(null);
                    setCsvImportSuccess(null);
                    setCsvModalOpen(true);
                  }}
                  className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                >
                  Importar Produtos (CSV)
                </Button>
              )}
            </div>
          </Box>

          <DataTable
            title="Catálogo Geral de Produtos"
            subTitle={`Estoque ativo para a unidade: ${selectedBranch}`}
            columns={productColumns}
            data={products}
            onAddClick={() => {
              setEditingProduct({
                code: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
                name: '',
                category: 'EPI & Segurança',
                unit: 'UN',
                minStock: 10,
                maxStock: 100,
                unitPrice: 50,
                locationSlot: 'A1'
              });
              setProductModalOpen(true);
            }}
            addButtonLabel="Cadastrar Novo Produto"
            canEditOrAdd={canEdit}
          />
        </Box>
      )}

      {currentTab === 1 && (
        <DataTable
          title="Histórico de Movimentações de Estoque"
          subTitle="Registros rastreáveis de entradas, saídas e ajustes."
          columns={movementColumns}
          data={movements}
          onAddClick={() => setMovementModalOpen(true)}
          addButtonLabel="Registrar Nova Movimentação"
          canEditOrAdd={canEdit}
        />
      )}

      {currentTab === 2 && (
        <Box className="space-y-4">
          <Alert severity="info" icon={<ArrowRightLeft className="w-5 h-5" />}>
            <strong>Regra de Transferência entre Unidades:</strong> O envio gera saída imediata na origem e status <em>"Em Trânsito"</em>. A entrada é gerada automaticamente no estoque quando a unidade destino confirma o recebimento.
          </Alert>

          <DataTable
            title="Transferências entre Unidades"
            subTitle="Gerenciamento logístico de envio e recebimento de produtos."
            columns={transferColumns}
            data={transfers}
            onAddClick={() => setTransferModalOpen(true)}
            addButtonLabel="Nova Transferência entre Unidades"
            canEditOrAdd={canEdit}
          />
        </Box>
      )}

      {currentTab === 3 && (
        <DataTable
          title="Solicitações de Material em Aberto"
          subTitle="Requisições de suprimentos para centros de custos das unidades."
          columns={requisitionColumns}
          data={requisitions}
          onAddClick={() => setReqModalOpen(true)}
          addButtonLabel="Nova Solicitação de Suprimento"
          canEditOrAdd={canEdit}
        />
      )}

      {/* PRODUCT MODAL */}
      <Dialog open={productModalOpen} onClose={() => setProductModalOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSaveProduct}>
          <DialogTitle className="font-bold">
            {editingProduct?.id ? 'Editar Produto' : 'Cadastrar Novo Produto'}
          </DialogTitle>
          <DialogContent dividers className="space-y-4">
            {formError && <Alert severity="error">{formError}</Alert>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <TextField
                  fullWidth
                  label="Código SKU"
                  value={editingProduct?.code || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, code: e.target.value })}
                  required
                />
              </div>
              <div>
                <TextField
                  fullWidth
                  label="Categoria"
                  value={editingProduct?.category || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <TextField
                  fullWidth
                  label="Nome / Descrição Resumida"
                  value={editingProduct?.name || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <TextField
                  fullWidth
                  label="Unidade"
                  value={editingProduct?.unit || 'UN'}
                  onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value as any })}
                />
              </div>
              <div>
                <TextField
                  fullWidth
                  type="number"
                  label="Estoque Mínimo"
                  value={editingProduct?.minStock ?? 10}
                  onChange={(e) => setEditingProduct({ ...editingProduct, minStock: Number(e.target.value) })}
                />
              </div>
              <div>
                <TextField
                  fullWidth
                  type="number"
                  label="Estoque Máximo"
                  value={editingProduct?.maxStock ?? 100}
                  onChange={(e) => setEditingProduct({ ...editingProduct, maxStock: Number(e.target.value) })}
                />
              </div>
              <div>
                <TextField
                  fullWidth
                  type="number"
                  label="Preço Unitário Média (R$)"
                  value={editingProduct?.unitPrice ?? 0}
                  onChange={(e) => setEditingProduct({ ...editingProduct, unitPrice: Number(e.target.value) })}
                />
              </div>
              <div className="sm:col-span-2">
                <TextField
                  fullWidth
                  label="Localização Prateleira"
                  value={editingProduct?.locationSlot || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, locationSlot: e.target.value })}
                />
              </div>

              <div className="sm:col-span-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <Typography variant="subtitle2" className="font-bold text-xs text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                  <Paperclip className="w-4 h-4 text-blue-600" />
                  Anexos & Fichas Técnicas
                </Typography>
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outlined"
                      size="small"
                      component="label"
                      startIcon={<Upload className="w-4 h-4" />}
                      className="text-xs font-bold rounded-xl border-slate-300 dark:border-slate-700"
                    >
                      Importar Anexo
                      <input
                        type="file"
                        hidden
                        multiple
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            const fileArray = Array.from(e.target.files);
                            const newAtts: ProductAttachment[] = [];
                            let done = 0;
                            fileArray.forEach(f => {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                newAtts.push({
                                  id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                                  name: f.name,
                                  size: f.size,
                                  uploadedAt: new Date().toISOString(),
                                  category: 'Ficha Técnica',
                                  dataUrl: ev.target?.result as string
                                });
                                done++;
                                if (done === fileArray.length) {
                                  setEditingProduct(prev => prev ? { 
                                    ...prev, 
                                    attachments: [...(prev.attachments || []), ...newAtts] 
                                  } : prev);
                                }
                              };
                              reader.readAsDataURL(f);
                            });
                          }
                        }}
                      />
                    </Button>
                  </div>
                  <Typography variant="caption" className="text-slate-500 font-semibold text-xs">
                    {editingProduct?.attachments?.length ? `${editingProduct.attachments.length} arquivo(s) associado(s)` : 'Nenhum arquivo anexado'}
                  </Typography>
                </div>
              </div>
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setProductModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" color="primary">Salvar Produto</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* MOVEMENT MODAL */}
      <Dialog open={movementModalOpen} onClose={() => setMovementModalOpen(false)} maxWidth="xs" fullWidth>
        <form onSubmit={handleRegisterMovement}>
          <DialogTitle className="font-bold">Registrar Movimentação de Estoque</DialogTitle>
          <DialogContent dividers className="space-y-4">
            {formError && <Alert severity="error">{formError}</Alert>}

            <FormControl fullWidth required>
              <InputLabel>Selecione o Produto</InputLabel>
              <Select
                value={movementForm.productId}
                onChange={(e) => setMovementForm({ ...movementForm, productId: e.target.value })}
                label="Selecione o Produto"
              >
                {state.products.map(p => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.code} - {p.name} (Disp: {p.stockByBranch[movementForm.branch] || 0} {p.unit})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth required>
              <InputLabel>Tipo de Movimentação</InputLabel>
              <Select
                value={movementForm.type}
                onChange={(e) => setMovementForm({ ...movementForm, type: e.target.value as any })}
                label="Tipo de Movimentação"
              >
                <MenuItem value="ENTRADA">ENTRADA (+)</MenuItem>
                <MenuItem value="SAIDA">SAÍDA (-)</MenuItem>
                <MenuItem value="AJUSTE">AJUSTE (Ajuste absoluto)</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              type="number"
              label="Quantidade"
              value={movementForm.quantity}
              onChange={(e) => setMovementForm({ ...movementForm, quantity: Number(e.target.value) })}
              required
            />

            <FormControl fullWidth>
              <InputLabel>Centro de Custo (Opcional)</InputLabel>
              <Select
                value={movementForm.costCenterId}
                onChange={(e) => setMovementForm({ ...movementForm, costCenterId: e.target.value })}
                label="Centro de Custo (Opcional)"
              >
                {state.costCenters.map(cc => (
                  <MenuItem key={cc.id} value={cc.id}>{cc.code} - {cc.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Nº Nota Fiscal / Documento"
              value={movementForm.documentNumber}
              onChange={(e) => setMovementForm({ ...movementForm, documentNumber: e.target.value })}
            />

            <TextField
              fullWidth
              multiline
              rows={2}
              label="Observações / Justificativa"
              value={movementForm.notes}
              onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setMovementModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" color="primary">Confirmar Registro</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* TRANSFER MODAL */}
      <Dialog open={transferModalOpen} onClose={() => setTransferModalOpen(false)} maxWidth="xs" fullWidth>
        <form onSubmit={handleCreateTransfer}>
          <DialogTitle className="font-bold">Nova Transferência Entre Unidades</DialogTitle>
          <DialogContent dividers className="space-y-4">
            {formError && <Alert severity="error">{formError}</Alert>}

            <FormControl fullWidth required>
              <InputLabel>Unidade de Origem (Saída)</InputLabel>
              <Select
                value={transferForm.originBranch}
                onChange={(e) => setTransferForm({ ...transferForm, originBranch: e.target.value as Branch })}
                label="Unidade de Origem (Saída)"
              >
                {dataService.getBranches(true).map(b => (
                  <MenuItem key={b.id} value={b.code}>
                    Unidade {b.code} ({b.city})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth required>
              <InputLabel>Unidade de Destino (Entrada Futura)</InputLabel>
              <Select
                value={transferForm.destinationBranch}
                onChange={(e) => setTransferForm({ ...transferForm, destinationBranch: e.target.value as Branch })}
                label="Unidade de Destino (Entrada Futura)"
              >
                {dataService.getBranches(true).map(b => (
                  <MenuItem key={b.id} value={b.code}>
                    Unidade {b.code} ({b.city})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth required>
              <InputLabel>Selecione o Produto</InputLabel>
              <Select
                value={transferForm.productId}
                onChange={(e) => setTransferForm({ ...transferForm, productId: e.target.value })}
                label="Selecione o Produto"
              >
                {state.products.map(p => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.code} - {p.name} (Disp na Origem: {p.stockByBranch[transferForm.originBranch] || 0})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              type="number"
              label="Quantidade a Transferir"
              value={transferForm.quantity}
              onChange={(e) => setTransferForm({ ...transferForm, quantity: Number(e.target.value) })}
              required
            />

            <TextField
              fullWidth
              multiline
              rows={2}
              label="Motivo da Transferência"
              value={transferForm.notes}
              onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTransferModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" color="primary">Gerar Envio (Em Trânsito)</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* REQUISITION MODAL */}
      <Dialog open={reqModalOpen} onClose={() => setReqModalOpen(false)} maxWidth="xs" fullWidth>
        <form onSubmit={handleCreateReq}>
          <DialogTitle className="font-bold">Criar Solicitação de Suprimentos</DialogTitle>
          <DialogContent dividers className="space-y-4">
            <FormControl fullWidth required>
              <InputLabel>Selecione o Produto</InputLabel>
              <Select
                value={reqForm.items[0].productId}
                onChange={(e) => setReqForm({
                  ...reqForm,
                  items: [{ ...reqForm.items[0], productId: e.target.value }]
                })}
                label="Selecione o Produto"
              >
                {state.products.map(p => (
                  <MenuItem key={p.id} value={p.id}>{p.code} - {p.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              type="number"
              label="Quantidade Solicitada"
              value={reqForm.items[0].quantity}
              onChange={(e) => setReqForm({
                ...reqForm,
                items: [{ ...reqForm.items[0], quantity: Number(e.target.value) }]
              })}
              required
            />

            <FormControl fullWidth required>
              <InputLabel>Prioridade</InputLabel>
              <Select
                value={reqForm.priority}
                onChange={(e) => setReqForm({ ...reqForm, priority: e.target.value as any })}
                label="Prioridade"
              >
                <MenuItem value="BAIXA">BAIXA</MenuItem>
                <MenuItem value="MEDIA">MÉDIA</MenuItem>
                <MenuItem value="ALTA">ALTA</MenuItem>
                <MenuItem value="URGENTE">URGENTE</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReqModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" color="primary">Enviar Solicitação</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* CSV PRODUCT IMPORT MODAL */}
      <Dialog
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle className="font-bold flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            <span>Importação em Lote de Produtos via Planilha / CSV</span>
          </div>
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadCloud className="w-3.5 h-3.5" />}
            onClick={downloadProductCSVTemplate}
            className="text-[11px] font-bold"
          >
            Baixar Modelo CSV
          </Button>
        </DialogTitle>

        <DialogContent dividers className="space-y-4 py-4">
          {csvImportSuccess && (
            <Alert severity="success" icon={<CheckCircle2 className="w-5 h-5" />} className="rounded-xl">
              {csvImportSuccess}
            </Alert>
          )}

          {csvError && (
            <Alert severity="error" icon={<AlertCircle className="w-5 h-5" />} className="rounded-xl">
              {csvError}
            </Alert>
          )}

          {/* Guidelines accordion/card */}
          <Box className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
            <Typography className="font-extrabold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span>📋 Estrutura & Ordem das Colunas no Arquivo CSV:</span>
            </Typography>
            <Typography variant="body2" className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
              O arquivo pode ser gerado no <strong>Microsoft Excel, Google Planilhas ou LibreOffice</strong> e salvo como <strong>CSV separado por ponto e vírgula (;) ou vírgula (,)</strong>.
            </Typography>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1 text-[11px]">
              {PRODUCT_CSV_COLUMNS.map(col => (
                <div key={col.key} className="p-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="font-bold font-mono text-[10px] text-blue-700 dark:text-blue-400">{col.key}</span>
                    {col.required ? (
                      <span className="text-[9px] font-extrabold text-rose-600">Obrigatório</span>
                    ) : (
                      <span className="text-[9px] text-slate-400">Opcional</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate" title={col.desc}>{col.label}</div>
                </div>
              ))}
            </div>
          </Box>

          {/* File Upload Box */}
          <div className="p-5 border-2 border-dashed border-blue-300 dark:border-blue-800 rounded-2xl bg-blue-50/40 dark:bg-blue-950/20 text-center space-y-3">
            <UploadCloud className="w-8 h-8 text-blue-600 mx-auto" />
            <div>
              <Typography className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                Selecione ou arraste seu arquivo .CSV aqui
              </Typography>
              <Typography variant="caption" className="text-slate-500 block text-[11px]">
                Compatível com arquivos exportados do ERP legado, SAP, Totvs, Excel ou Google Sheets.
              </Typography>
            </div>

            <div className="flex items-center justify-center gap-3">
              <input
                id="csv-file-input"
                type="file"
                accept=".csv, text/csv, application/vnd.ms-excel"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCsvFileUpload(file);
                }}
              />
              <label htmlFor="csv-file-input">
                <Button
                  component="span"
                  variant="contained"
                  size="small"
                  startIcon={<Upload className="w-4 h-4" />}
                  className="font-bold text-xs bg-blue-600 hover:bg-blue-700"
                >
                  Procurar Arquivo CSV no Computador
                </Button>
              </label>
              {csvFileName && (
                <Chip
                  label={csvFileName}
                  color="primary"
                  variant="outlined"
                  size="small"
                  className="font-bold text-xs"
                />
              )}
            </div>
          </div>

          {/* Mode Selection */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <Typography className="font-bold text-xs text-slate-800 dark:text-slate-200">
                Modo de Gravação dos Dados:
              </Typography>
              <Typography variant="caption" className="text-slate-500 text-[11px] block">
                Escolha se deseja mesclar com os itens existentes ou substituir o catálogo.
              </Typography>
            </div>

            <RadioGroup
              row
              value={csvImportMode}
              onChange={(e) => setCsvImportMode(e.target.value as any)}
              className="text-xs"
            >
              <FormControlLabel
                value="MERGE"
                control={<Radio size="small" />}
                label={<span className="text-xs font-semibold">Atualizar / Mesclar (Recomendado)</span>}
              />
              <FormControlLabel
                value="REPLACE"
                control={<Radio size="small" color="error" />}
                label={<span className="text-xs font-semibold text-rose-600">Substituir Catálogo</span>}
              />
            </RadioGroup>
          </div>

          {/* Parsed Preview Table */}
          {csvParseResult && csvParseResult.products.length > 0 && (
            <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
              <div className="p-3 bg-slate-100 dark:bg-slate-800 flex items-center justify-between">
                <Typography className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Pré-visualização: {csvParseResult.products.length} produtos válidos identificados
                </Typography>
                {csvParseResult.warnings.length > 0 && (
                  <Chip
                    label={`${csvParseResult.warnings.length} avisos`}
                    size="small"
                    color="warning"
                    className="text-[10px] h-4 font-bold"
                  />
                )}
              </div>

              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-[11px] text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-2">SKU</th>
                      <th className="p-2">Nome do Produto</th>
                      <th className="p-2">Categoria</th>
                      <th className="p-2 text-center">UN</th>
                      <th className="p-2 text-right">Preço</th>
                      <th className="p-2 text-center">SP</th>
                      <th className="p-2 text-center">RJ</th>
                      <th className="p-2 text-center">BSB</th>
                      <th className="p-2 text-center">SJRP</th>
                      <th className="p-2">Prateleira</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {csvParseResult.products.slice(0, 15).map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-2 font-mono font-bold text-blue-700 dark:text-blue-400">{p.code}</td>
                        <td className="p-2 font-medium">{p.name}</td>
                        <td className="p-2 text-slate-500">{p.category}</td>
                        <td className="p-2 text-center">{p.unit}</td>
                        <td className="p-2 text-right font-mono font-bold">R$ {p.unitPrice.toFixed(2)}</td>
                        <td className="p-2 text-center font-bold text-slate-700 dark:text-slate-300">{p.stockByBranch.SP || 0}</td>
                        <td className="p-2 text-center font-bold text-slate-700 dark:text-slate-300">{p.stockByBranch.RJ || 0}</td>
                        <td className="p-2 text-center font-bold text-slate-700 dark:text-slate-300">{p.stockByBranch.BSB || 0}</td>
                        <td className="p-2 text-center font-bold text-slate-700 dark:text-slate-300">{p.stockByBranch.SJRP || 0}</td>
                        <td className="p-2 text-slate-400 font-mono">{p.locationSlot}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {csvParseResult.products.length > 15 && (
                <div className="p-2 text-center bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-500">
                  ...e mais {csvParseResult.products.length - 15} produtos adicionais no arquivo.
                </div>
              )}
            </div>
          )}
        </DialogContent>

        <DialogActions className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <Button onClick={() => setCsvModalOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="primary"
            disabled={!csvParseResult || csvParseResult.products.length === 0}
            onClick={handleConfirmCsvImport}
            startIcon={<UploadCloud className="w-4 h-4" />}
            className="font-bold text-xs py-1.5 px-4 bg-blue-600 hover:bg-blue-700"
          >
            Confirmar Importação de {csvParseResult?.products.length || 0} Produtos
          </Button>
        </DialogActions>
      </Dialog>

      {/* 7-Tab Product Detail Modal */}
      <ProductDetailModal
        product={detailProduct}
        open={Boolean(detailProduct)}
        onClose={() => setDetailProduct(null)}
        onEditProduct={(p) => {
          setEditingProduct(p);
          setProductModalOpen(true);
        }}
      />
    </Box>
  );
};
