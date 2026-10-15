import React, { useState } from 'react';
import {
  Box, Typography, Tabs, Tab, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Select, FormControl, InputLabel,
  Alert, Chip
} from '@mui/material';
import { ArrowRightLeft, Eye, Paperclip, Upload } from 'lucide-react';

import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Breadcrumb } from '../components/Breadcrumb';
import { DataTable, Column } from '../components/DataTable';
import { Product, Movement, Transfer, Requisition, Branch, ProductAttachment } from '../types';
import { ProductDetailModal } from '../components/ProductDetailModal';

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
      label: 'Ações de Aprovação',
      accessor: (r) => r.id,
      exportable: false,
      render: (r) => (
        r.status === 'PENDENTE' && canEdit ? (
          <Box className="flex items-center gap-1">
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
          </Box>
        ) : <Typography variant="caption" className="text-slate-400">{r.approvedBy ? `Aprovado por ${r.approvedBy}` : '-'}</Typography>
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
