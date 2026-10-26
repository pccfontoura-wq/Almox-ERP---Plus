import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Select, FormControl, InputLabel, Alert, Chip, Tabs, Tab,
  Card, CardContent, IconButton, Tooltip, Divider, Badge
} from '@mui/material';
import {
  ShoppingCart, FileText, CheckCircle2, XCircle, Plus, Trash2,
  Building2, AlertCircle, ArrowRight, Clock, ExternalLink, Eye,
  Check, X, Search, Layers, RefreshCw, Send, DollarSign,
  ShieldAlert, Scale, Printer
} from 'lucide-react';

import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Breadcrumb } from '../components/Breadcrumb';
import { DataTable, Column } from '../components/DataTable';
import { exportPurchaseOrderPDF, exportPurchaseRequestPDF } from '../utils/exportUtils';
import {
  PurchaseOrder, PurchaseOrderStatus, PurchaseRequest,
  PurchaseRequestItem, PurchaseRequestStatus, Branch
} from '../types';

interface NewRequestItemForm {
  isUnregistered: boolean;
  productId: string;
  customProductName: string;
  customUnit: string;
  category: string;
  brandOrModel: string;
  quantity: number;
  estimatedUnitPrice: number;
  notes: string;
}

const COMMON_UNITS = ['UN', 'KG', 'M', 'CX', 'L', 'PAR', 'JG', 'PCT', 'ROLO', 'LATA', 'M2', 'M3'];
const COMMON_CATEGORIES = [
  'Elétrica', 'Hidráulica', 'Mecânica', 'Ferramentas', 'EPI / Segurança',
  'Tecnologia da Informação', 'Infraestrutura', 'Pintura', 'Limpeza', 'Escritório', 'Diversos'
];

export const Compras: React.FC = () => {
  const { currentUser } = useAuth();
  const { selectedBranch, refreshData } = useApp();

  // Tab State: 'SOLICITACOES' | 'ORDENS_COMPRA'
  const [activeTab, setActiveTab] = useState<'SOLICITACOES' | 'ORDENS_COMPRA'>('SOLICITACOES');

  // --- SOLICITAÇÃO DE COMPRA (SC) STATES ---
  const [newRequestModalOpen, setNewRequestModalOpen] = useState(false);
  const [requestDetailModalOpen, setRequestDetailModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);

  // Form state for creating a new SC (Multi-item)
  const [newRequestBranch, setNewRequestBranch] = useState<Branch>(
    currentUser?.branch || 'SP'
  );
  const [newRequestCostCenter, setNewRequestCostCenter] = useState<string>('');
  const [newRequestDepartment, setNewRequestDepartment] = useState<string>(
    currentUser?.department || 'Operações'
  );
  const [newRequestPriority, setNewRequestPriority] = useState<PurchaseRequest['priority']>('MEDIA');
  const [newRequestJustification, setNewRequestJustification] = useState<string>('');
  const [requestItems, setRequestItems] = useState<NewRequestItemForm[]>([
    {
      isUnregistered: false,
      productId: '',
      customProductName: '',
      customUnit: 'UN',
      category: 'Diversos',
      brandOrModel: '',
      quantity: 1,
      estimatedUnitPrice: 0,
      notes: ''
    }
  ]);
  const [requestFormError, setRequestFormError] = useState<string | null>(null);

  // Item approval dialog states (Setor de Compras aprova item e gera OC)
  const [approveItemModalOpen, setApproveItemModalOpen] = useState(false);
  const [itemToApprove, setItemToApprove] = useState<PurchaseRequestItem | null>(null);
  const [approvalSupplierName, setApprovalSupplierName] = useState<string>('');
  const [approvalSupplierCnpj, setApprovalSupplierCnpj] = useState<string>('');
  const [approvalUnitPrice, setApprovalUnitPrice] = useState<number>(0);
  const [approvalPaymentTerms, setApprovalPaymentTerms] = useState<string>('28 dias faturado');
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // Item rejection dialog states
  const [rejectItemModalOpen, setRejectItemModalOpen] = useState(false);
  const [itemToReject, setItemToReject] = useState<PurchaseRequestItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  // --- DIRECT PURCHASE ORDER (OC) STATES ---
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [poDetailModalOpen, setPoDetailModalOpen] = useState(false);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);
  const [poForm, setPoForm] = useState({
    branch: currentUser?.branch || 'SP',
    costCenterId: '',
    isUnregistered: false,
    supplierName: '',
    supplierCnpj: '',
    productId: '',
    customProductName: '',
    customUnit: 'UN',
    category: 'Diversos',
    quantity: 10,
    unitPrice: 50,
    paymentTerms: '28 dias faturado'
  });
  const [poFormError, setPoFormError] = useState<string | null>(null);

  // Overrun Approval States (Política de Estouro Orçamentário - Opção 3)
  const [overrunApprovalModalOpen, setOverrunApprovalModalOpen] = useState(false);
  const [poToApproveOverrun, setPoToApproveOverrun] = useState<PurchaseOrder | null>(null);
  const [overrunJustification, setOverrunJustification] = useState('');
  const [overrunApprovalError, setOverrunApprovalError] = useState<string | null>(null);

  const state = dataService.getState();
  const canEdit = currentUser?.role !== 'Visitante';

  // Verificação Orçamentária em Tempo Real para Formulário de SC
  const requestEstimatedTotal = useMemo(() => {
    return requestItems.reduce((acc, it) => acc + (it.quantity * (it.estimatedUnitPrice || 0)), 0);
  }, [requestItems]);

  const requestBudgetCheck = useMemo(() => {
    if (!newRequestCostCenter) return null;
    return dataService.checkCostCenterBudget(newRequestCostCenter, requestEstimatedTotal);
  }, [newRequestCostCenter, requestEstimatedTotal, state]);

  // Verificação Orçamentária em Tempo Real para Formulário de OC Direta
  const poTotalEstimated = useMemo(() => {
    return Number(poForm.quantity || 0) * Number(poForm.unitPrice || 0);
  }, [poForm.quantity, poForm.unitPrice]);

  const directPoBudgetCheck = useMemo(() => {
    if (!poForm.costCenterId) return null;
    return dataService.checkCostCenterBudget(poForm.costCenterId, poTotalEstimated);
  }, [poForm.costCenterId, poTotalEstimated, state]);

  // Filtered lists
  const purchaseRequests = useMemo(() => {
    const list = state.purchaseRequests || [];
    return list.filter(r => selectedBranch === 'GLOBAL' || r.branch === selectedBranch);
  }, [state.purchaseRequests, selectedBranch]);

  const purchaseOrders = useMemo(() => {
    return state.purchaseOrders.filter(po => selectedBranch === 'GLOBAL' || po.branch === selectedBranch);
  }, [state.purchaseOrders, selectedBranch]);

  // Statistics
  const pendingRequestsCount = useMemo(() => {
    return (state.purchaseRequests || []).filter(
      r => (selectedBranch === 'GLOBAL' || r.branch === selectedBranch) && (r.status === 'PENDENTE' || r.status === 'PARCIALMENTE_ATENDIDA')
    ).length;
  }, [state.purchaseRequests, selectedBranch]);

  const pendingPoCount = useMemo(() => {
    return state.purchaseOrders.filter(
      po => (selectedBranch === 'GLOBAL' || po.branch === selectedBranch) && (po.status === 'AGUARDANDO_APROVACAO' || po.status === 'COTACAO')
    ).length;
  }, [state.purchaseOrders, selectedBranch]);

  // Helper status labels
  const getRequestStatusChip = (status: PurchaseRequestStatus) => {
    switch (status) {
      case 'PENDENTE':
        return <Chip label="Pendente" color="warning" size="small" className="font-bold text-[11px] h-5" />;
      case 'PARCIALMENTE_ATENDIDA':
        return <Chip label="Parcialmente Atendida" color="info" size="small" className="font-bold text-[11px] h-5" />;
      case 'CONCLUIDA':
        return <Chip label="Concluída (OC Gerada)" color="success" size="small" className="font-bold text-[11px] h-5" />;
      case 'REJEITADA':
        return <Chip label="Rejeitada" color="error" size="small" className="font-bold text-[11px] h-5" />;
      case 'CANCELADA':
        return <Chip label="Cancelada" size="small" className="font-bold text-[11px] h-5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300" />;
      default:
        return <Chip label={status} size="small" className="font-bold text-[11px] h-5" />;
    }
  };

  const getItemStatusChip = (status: PurchaseRequestItem['status']) => {
    switch (status) {
      case 'PENDENTE':
        return <Chip label="Aguardando Análise" color="warning" size="small" className="font-bold text-[10px] h-5" />;
      case 'APROVADO':
        return <Chip label="Aprovado (OC Gerada)" color="success" size="small" className="font-bold text-[10px] h-5" />;
      case 'REJEITADO':
        return <Chip label="Rejeitado" color="error" size="small" className="font-bold text-[10px] h-5" />;
      case 'CANCELADO':
        return <Chip label="Cancelado" size="small" className="font-bold text-[10px] h-5 bg-slate-200 dark:bg-slate-700" />;
      default:
        return <Chip label={status} size="small" className="font-bold text-[10px] h-5" />;
    }
  };

  const getPriorityChip = (priority: PurchaseRequest['priority']) => {
    switch (priority) {
      case 'URGENTE':
        return <Chip label="Urgente" color="error" size="small" className="font-extrabold text-[10px] h-5" />;
      case 'ALTA':
        return <Chip label="Alta" color="warning" size="small" className="font-bold text-[10px] h-5" />;
      case 'MEDIA':
        return <Chip label="Média" color="primary" size="small" className="font-medium text-[10px] h-5" />;
      case 'BAIXA':
        return <Chip label="Baixa" size="small" className="font-normal text-[10px] h-5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" />;
      default:
        return <Chip label={priority} size="small" className="text-[10px] h-5" />;
    }
  };

  const getPoStatusLabel = (status: PurchaseOrderStatus): string => {
    switch (status) {
      case 'AGUARDANDO_APROVACAO': return 'Aguardando Aprovação';
      case 'APROVADO': return 'Aprovado';
      case 'EM_TRANSITO': return 'Em Trânsito';
      case 'ENTREGUE': return 'Entregue (Estoque Atualizado)';
      case 'CANCELADO': return 'Cancelado';
      case 'COTACAO': return 'Cotação';
      default: return status;
    }
  };

  // --- MULTI-ITEM SOLICITAÇÃO HANDLERS ---
  const handleAddItemRow = (isUnregistered: boolean = false) => {
    setRequestItems(prev => [
      ...prev,
      {
        isUnregistered,
        productId: '',
        customProductName: '',
        customUnit: 'UN',
        category: 'Diversos',
        brandOrModel: '',
        quantity: 1,
        estimatedUnitPrice: 0,
        notes: ''
      }
    ]);
  };

  const handleToggleItemMode = (index: number, isUnregistered: boolean) => {
    setRequestItems(prev => prev.map((item, i) => {
      if (i === index) {
        return {
          ...item,
          isUnregistered,
          productId: isUnregistered ? '' : item.productId,
          customProductName: !isUnregistered ? '' : item.customProductName
        };
      }
      return item;
    }));
  };

  const handleRemoveItemRow = (index: number) => {
    if (requestItems.length <= 1) return;
    setRequestItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemProductChange = (index: number, productId: string) => {
    const prod = state.products.find(p => p.id === productId);
    setRequestItems(prev => prev.map((item, i) => {
      if (i === index) {
        return {
          ...item,
          productId,
          estimatedUnitPrice: prod ? prod.unitPrice : 0
        };
      }
      return item;
    }));
  };

  const handleItemFieldChange = (index: number, field: keyof NewRequestItemForm, value: any) => {
    setRequestItems(prev => prev.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const totalEstimatedCost = useMemo(() => {
    return requestItems.reduce((acc, curr) => acc + (Number(curr.quantity || 0) * Number(curr.estimatedUnitPrice || 0)), 0);
  }, [requestItems]);

  const handleOpenNewRequestModal = () => {
    setNewRequestBranch(currentUser?.branch || 'SP');
    setNewRequestCostCenter('');
    setNewRequestDepartment(currentUser?.department || 'Operações');
    setNewRequestPriority('MEDIA');
    setNewRequestJustification('');
    setRequestItems([{
      isUnregistered: false,
      productId: '',
      customProductName: '',
      customUnit: 'UN',
      category: 'Diversos',
      brandOrModel: '',
      quantity: 1,
      estimatedUnitPrice: 0,
      notes: ''
    }]);
    setRequestFormError(null);
    setNewRequestModalOpen(true);
  };

  const handleCreatePurchaseRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setRequestFormError(null);

    if (!newRequestJustification.trim()) {
      setRequestFormError('Por favor, informe a justificativa da solicitação de compra.');
      return;
    }

    const validItems = requestItems.filter(item => {
      if (item.isUnregistered) {
        return item.customProductName.trim().length > 0 && Number(item.quantity) > 0;
      }
      return item.productId && Number(item.quantity) > 0;
    });

    if (validItems.length === 0) {
      setRequestFormError('Adicione pelo menos um item válido com quantidade maior que zero (selecione um material do catálogo ou informe a descrição do material não cadastrado).');
      return;
    }

    try {
      dataService.createPurchaseRequest(
        newRequestBranch,
        newRequestJustification,
        newRequestPriority,
        validItems.map(it => ({
          isUnregistered: it.isUnregistered,
          productId: it.isUnregistered ? undefined : it.productId,
          customProductName: it.isUnregistered ? it.customProductName.trim() : undefined,
          customUnit: it.isUnregistered ? (it.customUnit.trim() || 'UN') : undefined,
          category: it.isUnregistered ? (it.category.trim() || 'Diversos') : undefined,
          brandOrModel: it.brandOrModel ? it.brandOrModel.trim() : undefined,
          quantity: Number(it.quantity),
          estimatedUnitPrice: Number(it.estimatedUnitPrice || 0),
          notes: it.notes
        })),
        currentUser,
        newRequestDepartment,
        newRequestCostCenter || undefined
      );

      setNewRequestModalOpen(false);
      refreshData();
    } catch (err: any) {
      setRequestFormError(err.message || 'Erro ao criar solicitação de compra.');
    }
  };

  // --- ITEM APPROVAL HANDLERS (GERAÇÃO DE OC) ---
  const handleOpenApproveItem = (item: PurchaseRequestItem) => {
    setItemToApprove(item);
    setApprovalSupplierName(item.supplierName || 'Fornecedor Homologado');
    setApprovalSupplierCnpj('12.345.678/0001-90');
    setApprovalUnitPrice(item.estimatedUnitPrice || 0);
    setApprovalPaymentTerms('28 dias faturado');
    setApprovalError(null);
    setApproveItemModalOpen(true);
  };

  const handleConfirmApproveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedRequest || !itemToApprove) return;
    setApprovalError(null);

    if (!approvalSupplierName.trim()) {
      setApprovalError('Informe o nome ou razão social do fornecedor.');
      return;
    }

    try {
      const result = dataService.approvePurchaseRequestItem(
        selectedRequest.id,
        itemToApprove.id,
        approvalSupplierName,
        approvalSupplierCnpj,
        Number(approvalUnitPrice),
        approvalPaymentTerms,
        currentUser
      );

      setApproveItemModalOpen(false);
      setItemToApprove(null);
      // Update selectedRequest modal state
      setSelectedRequest(result.request);
      refreshData();
    } catch (err: any) {
      setApprovalError(err.message || 'Erro ao aprovar item e gerar Ordem de Compra.');
    }
  };

  const handleOpenRejectItem = (item: PurchaseRequestItem) => {
    setItemToReject(item);
    setRejectionReason('');
    setRejectItemModalOpen(true);
  };

  const handleConfirmRejectItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedRequest || !itemToReject) return;

    try {
      const updatedReq = dataService.rejectPurchaseRequestItem(
        selectedRequest.id,
        itemToReject.id,
        rejectionReason || 'Item não aprovado pelo setor de compras',
        currentUser
      );

      setRejectItemModalOpen(false);
      setItemToReject(null);
      setSelectedRequest(updatedReq);
      refreshData();
    } catch (err: any) {
      alert(err.message || 'Erro ao rejeitar item.');
    }
  };

  const handleCancelEntireRequest = (reqId: string) => {
    if (!currentUser) return;
    if (confirm('Deseja realmente cancelar toda esta solicitação de compra?')) {
      try {
        dataService.cancelPurchaseRequest(reqId, currentUser);
        if (selectedRequest?.id === reqId) {
          const updated = dataService.getState().purchaseRequests?.find(r => r.id === reqId);
          setSelectedRequest(updated || null);
        }
        refreshData();
      } catch (err: any) {
        alert(err.message || 'Erro ao cancelar solicitação.');
      }
    }
  };

  // Switch to OC tab and view specific PO
  const handleViewPoInPipeline = (poCode: string) => {
    setRequestDetailModalOpen(false);
    setActiveTab('ORDENS_COMPRA');
    const po = state.purchaseOrders.find(p => p.code === poCode);
    if (po) {
      setSelectedPo(po);
      setPoDetailModalOpen(true);
    }
  };

  // --- PURCHASE ORDERS (OC) TABLE & PIPELINE ---
  const handleUpdatePoStatus = (poId: string, status: PurchaseOrderStatus) => {
    if (!currentUser) return;
    const po = state.purchaseOrders.find(p => p.id === poId);
    if (!po) return;

    // Se estiver aprovando uma ordem com estouro orçamentário
    if (status === 'APROVADO' && po.budgetOverrun) {
      if (currentUser.role !== 'Master') {
        alert(`🔒 Alçada Restrita: Esta Ordem de Compra possui excedente orçamentário de R$ ${po.budgetOverrunAmount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no Centro de Custo. Pela política corporativa vigente (Opção 3: Alçada Extraordinária), a liberação é restrita a usuários com perfil Master / Diretoria.`);
        return;
      }
      setPoToApproveOverrun(po);
      setOverrunJustification('');
      setOverrunApprovalError(null);
      setOverrunApprovalModalOpen(true);
      return;
    }

    try {
      dataService.updatePurchaseOrderStatus(poId, status, currentUser);
      refreshData();
      if (selectedPo?.id === poId) {
        const updated = dataService.getState().purchaseOrders.find(p => p.id === poId);
        setSelectedPo(updated || null);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleConfirmOverrunApproval = () => {
    if (!currentUser || !poToApproveOverrun) return;
    if (!overrunJustification.trim() || overrunJustification.trim().length < 5) {
      setOverrunApprovalError('É obrigatório preencher a justificativa da diretoria (mínimo 5 caracteres) para autorizar a compra com estouro orçamentário.');
      return;
    }

    try {
      dataService.updatePurchaseOrderStatus(
        poToApproveOverrun.id,
        'APROVADO',
        currentUser,
        overrunJustification.trim()
      );
      setOverrunApprovalModalOpen(false);
      setPoToApproveOverrun(null);
      refreshData();
      if (selectedPo?.id === poToApproveOverrun.id) {
        const updated = dataService.getState().purchaseOrders.find(p => p.id === poToApproveOverrun.id);
        setSelectedPo(updated || null);
      }
    } catch (e: any) {
      setOverrunApprovalError(e.message || 'Erro ao aprovar compra.');
    }
  };

  const handleCreateDirectPo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setPoFormError(null);

    if (poForm.isUnregistered) {
      if (!poForm.customProductName.trim()) {
        setPoFormError('Informe a descrição ou nome do material não cadastrado.');
        return;
      }

      try {
        const items = [{
          productId: `unregistered-${Date.now()}`,
          productCode: `MNC-${Math.floor(1000 + Math.random() * 9000)}`,
          productName: poForm.customProductName.trim(),
          unit: (poForm.customUnit.trim() || 'UN').toUpperCase(),
          quantity: Number(poForm.quantity),
          unitPrice: Number(poForm.unitPrice),
          totalPrice: Number(poForm.quantity) * Number(poForm.unitPrice),
          isUnregistered: true,
          category: poForm.category
        }];

        const cc = state.costCenters.find(c => c.id === poForm.costCenterId);
        dataService.createPurchaseOrder(
          poForm.branch || currentUser.branch || 'SP',
          poForm.supplierName,
          poForm.supplierCnpj || '00.000.000/0001-00',
          items,
          currentUser,
          poForm.paymentTerms,
          undefined,
          undefined,
          poForm.costCenterId || undefined,
          cc?.name
        );

        setPoModalOpen(false);
        refreshData();
      } catch (err: any) {
        setPoFormError(err.message);
      }
      return;
    }

    const prod = state.products.find(p => p.id === poForm.productId);
    if (!prod) {
      setPoFormError('Selecione um produto válido.');
      return;
    }

    try {
      const items = [{
        productId: prod.id,
        productCode: prod.code,
        productName: prod.name,
        unit: prod.unit,
        quantity: Number(poForm.quantity),
        unitPrice: Number(poForm.unitPrice),
        totalPrice: Number(poForm.quantity) * Number(poForm.unitPrice),
        isUnregistered: false,
        category: prod.category
      }];

      const cc = state.costCenters.find(c => c.id === poForm.costCenterId);
      dataService.createPurchaseOrder(
        poForm.branch || currentUser.branch || 'SP',
        poForm.supplierName,
        poForm.supplierCnpj || '00.000.000/0001-00',
        items,
        currentUser,
        poForm.paymentTerms,
        undefined,
        undefined,
        poForm.costCenterId || undefined,
        cc?.name
      );

      setPoModalOpen(false);
      refreshData();
    } catch (err: any) {
      setPoFormError(err.message);
    }
  };

  // Columns for Solicitações de Compra
  const requestColumns: Column<PurchaseRequest>[] = [
    {
      id: 'code',
      label: 'Nº Solicitação',
      accessor: (r) => r.code,
      sortable: true,
      render: (r) => (
        <span className="font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1">
          <FileText className="w-3.5 h-3.5" />
          {r.code}
        </span>
      )
    },
    { id: 'branch', label: 'Unidade', accessor: (r) => r.branch, sortable: true },
    { id: 'requestedBy', label: 'Solicitante', accessor: (r) => r.requestedBy, sortable: true },
    {
      id: 'department',
      label: 'Departamento / Finalidade',
      accessor: (r) => r.department || r.costCenterName || '-',
      render: (r) => (
        <div>
          <Typography className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            {r.department || 'Geral'}
          </Typography>
          <Typography variant="caption" className="text-slate-500 truncate max-w-[220px] block" title={r.justification}>
            {r.justification}
          </Typography>
        </div>
      )
    },
    {
      id: 'itemsCount',
      label: 'Itens Solicitados',
      accessor: (r) => r.items.map(i => `${i.productName} (${i.quantity} ${i.unit})`).join(', '),
      render: (r) => {
        const approvedCount = r.items.filter(i => i.status === 'APROVADO').length;
        const pendingCount = r.items.filter(i => i.status === 'PENDENTE').length;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {r.items.length} {r.items.length === 1 ? 'item' : 'itens'}
            </span>
            <span className="text-[10px] text-slate-500">
              {approvedCount > 0 && <span className="text-emerald-600 font-bold">{approvedCount} com OC </span>}
              {pendingCount > 0 && <span className="text-amber-600 font-bold">{pendingCount} pendente(s)</span>}
            </span>
          </div>
        );
      }
    },
    {
      id: 'category',
      label: 'Categoria',
      accessor: (r) =>
        Array.from(
          new Set(
            r.items.map(
              i => i.category || state.products.find(p => p.id === i.productId)?.category || 'Geral'
            )
          )
        ).join(', '),
      sortable: true
    },
    {
      id: 'priority',
      label: 'Prioridade',
      accessor: (r) => r.priority,
      render: (r) => getPriorityChip(r.priority)
    },
    {
      id: 'status',
      label: 'Status da Solicitação',
      accessor: (r) => r.status,
      render: (r) => (
        <div className="flex flex-col gap-1 items-start">
          {getRequestStatusChip(r.status)}
          {r.budgetOverrun && (
            <Chip
              label={`⚠️ Alçada Diretoria (Excedente R$ ${r.budgetOverrunAmount ? r.budgetOverrunAmount.toLocaleString('pt-BR') : '0'})`}
              size="small"
              className="text-[10px] h-5 font-bold bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200"
            />
          )}
        </div>
      )
    },
    {
      id: 'createdAt',
      label: 'Data Emissão',
      accessor: (r) => new Date(r.createdAt).toLocaleDateString('pt-BR'),
      sortable: true
    },
    {
      id: 'actions',
      label: 'Ações',
      accessor: (r) => r.id,
      exportable: false,
      render: (r) => (
        <Box className="flex items-center gap-1.5">
          <Button
            size="small"
            variant="contained"
            color="primary"
            onClick={() => {
              setSelectedRequest(r);
              setRequestDetailModalOpen(true);
            }}
            className="text-[11px] py-1 px-2.5 font-bold flex items-center gap-1 shadow-xs"
          >
            <Eye className="w-3.5 h-3.5" />
            Analisar / Itens
          </Button>
          <Tooltip title="Imprimir / Baixar PDF Oficial da SC">
            <IconButton
              size="small"
              onClick={() => {
                const branchInfo = dataService.getBranchByCode(r.branch);
                const cc = state.costCenters.find(c => c.id === r.costCenterId);
                exportPurchaseRequestPDF(r, branchInfo, cc);
              }}
              className="p-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800"
            >
              <Printer className="w-3.5 h-3.5" />
            </IconButton>
          </Tooltip>
          {r.status === 'PENDENTE' && canEdit && (
            <Tooltip title="Cancelar Solicitação">
              <IconButton
                size="small"
                color="error"
                onClick={() => handleCancelEntireRequest(r.id)}
                className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950"
              >
                <X className="w-4 h-4" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )
    }
  ];

  // Columns for Ordens de Compra
  const poColumns: Column<PurchaseOrder>[] = [
    {
      id: 'code',
      label: 'Nº Ordem (OC)',
      accessor: (po) => po.code,
      sortable: true,
      render: (po) => (
        <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
          <ShoppingCart className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          {po.code}
        </span>
      )
    },
    {
      id: 'origin',
      label: 'Origem / SC',
      accessor: (po) => po.purchaseRequestCode || 'Direta',
      render: (po) => (
        po.purchaseRequestCode ? (
          <Chip
            label={po.purchaseRequestCode}
            size="small"
            color="info"
            variant="outlined"
            className="font-bold text-[10px] h-5"
          />
        ) : (
          <span className="text-xs text-slate-400">Emissão Direta</span>
        )
      )
    },
    { id: 'supplierName', label: 'Fornecedor', accessor: (po) => po.supplierName, sortable: true },
    { id: 'branch', label: 'Unidade', accessor: (po) => po.branch },
    {
      id: 'category',
      label: 'Categoria',
      accessor: (po) =>
        Array.from(
          new Set(
            po.items.map(
              i => i.category || state.products.find(p => p.id === i.productId)?.category || 'Geral'
            )
          )
        ).join(', '),
      sortable: true
    },
    {
      id: 'totalValue',
      label: 'Valor Total',
      accessor: (po) => `R$ ${po.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      sortable: true
    },
    { id: 'requestedBy', label: 'Comprador / Solicitante', accessor: (po) => po.requestedBy },
    {
      id: 'status',
      label: 'Status da Ordem',
      accessor: (po) => getPoStatusLabel(po.status),
      render: (po) => {
        const displayLabel = getPoStatusLabel(po.status);
        const color = po.status === 'ENTREGUE' ? 'success' : po.status === 'APROVADO' ? 'info' : po.status === 'CANCELADO' ? 'error' : 'warning';
        return (
          <div className="flex flex-col gap-1 items-start">
            <Chip label={displayLabel} color={color} size="small" className="font-bold text-[11px] h-5" />
            {po.budgetOverrun && (
              <Chip
                label={`⚠️ Alçada Diretoria (Excedente R$ ${po.budgetOverrunAmount ? po.budgetOverrunAmount.toLocaleString('pt-BR') : '0'})`}
                size="small"
                className="text-[10px] h-5 font-bold bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200"
              />
            )}
          </div>
        );
      }
    },
    { id: 'createdAt', label: 'Data Emissão', accessor: (po) => new Date(po.createdAt).toLocaleDateString('pt-BR') },
    {
      id: 'actions',
      label: 'Pipeline de Compra',
      accessor: (po) => po.id,
      exportable: false,
      render: (po) => (
        canEdit ? (
          <Box className="flex items-center gap-1">
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                setSelectedPo(po);
                setPoDetailModalOpen(true);
              }}
              className="text-[10px] py-0.5 px-2 font-bold"
            >
              Ver
            </Button>
            <Tooltip title="Imprimir / Baixar PDF Oficial da OC">
              <IconButton
                size="small"
                onClick={() => {
                  const branchInfo = dataService.getBranchByCode(po.branch);
                  const cc = state.costCenters.find(c => c.id === po.costCenterId);
                  exportPurchaseOrderPDF(po, branchInfo, cc);
                }}
                className="p-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800"
              >
                <Printer className="w-3.5 h-3.5" />
              </IconButton>
            </Tooltip>
            {po.status === 'AGUARDANDO_APROVACAO' && (
              <Button
                size="small"
                variant="contained"
                color={po.budgetOverrun ? 'warning' : 'info'}
                onClick={() => handleUpdatePoStatus(po.id, 'APROVADO')}
                className="text-[10px] py-0.5 px-2 font-bold"
              >
                {po.budgetOverrun ? 'Liberar (Diretoria)' : 'Aprovar'}
              </Button>
            )}
            {po.status === 'APROVADO' && (
              <Button size="small" variant="contained" color="warning" onClick={() => handleUpdatePoStatus(po.id, 'EM_TRANSITO')} className="text-[10px] py-0.5 px-2 font-bold">
                Em Trânsito
              </Button>
            )}
            {po.status === 'EM_TRANSITO' && (
              <Button size="small" variant="contained" color="success" onClick={() => handleUpdatePoStatus(po.id, 'ENTREGUE')} className="text-[10px] py-0.5 px-2 font-bold">
                Confirmar Entrega (+)
              </Button>
            )}
          </Box>
        ) : null
      )
    }
  ];

  return (
    <Box className="space-y-6">
      <Breadcrumb items={[{ label: 'Módulo de Compras & Suprimentos' }]} />

      {/* Top Header & Navigation Tabs */}
      <Box className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        <Box className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Box>
            <Typography variant="h5" className="font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Gestão de Compras & Aquisições
            </Typography>
            <Typography variant="body2" className="text-slate-500 dark:text-slate-400">
              Controle de solicitações de materiais, aprovações por item do setor de compras e emissão automatizada de Ordens de Compra (OC).
            </Typography>
          </Box>

          {/* Quick Action Button */}
          <Box className="flex items-center gap-2">
            <Button
              variant="contained"
              color="primary"
              onClick={handleOpenNewRequestModal}
              startIcon={<Plus className="w-4 h-4" />}
              className="font-bold py-2 px-4 shadow-sm rounded-xl text-xs"
            >
              Nova Solicitação de Compra (SC)
            </Button>
          </Box>
        </Box>

        {/* Tab Selection */}
        <Box className="mt-4 border-t border-slate-200 dark:border-slate-800 pt-2">
          <Tabs
            value={activeTab}
            onChange={(_, val) => setActiveTab(val)}
            textColor="primary"
            indicatorColor="primary"
          >
            <Tab
              value="SOLICITACOES"
              label={
                <Box className="flex items-center gap-2 font-bold">
                  <FileText className="w-4 h-4" />
                  <span>Solicitações de Compra (SC)</span>
                  {pendingRequestsCount > 0 && (
                    <Chip
                      label={pendingRequestsCount}
                      size="small"
                      color="warning"
                      className="h-5 px-1 font-extrabold text-[10px]"
                    />
                  )}
                </Box>
              }
            />
            <Tab
              value="ORDENS_COMPRA"
              label={
                <Box className="flex items-center gap-2 font-bold">
                  <ShoppingCart className="w-4 h-4" />
                  <span>Ordens de Compra (OC)</span>
                  {pendingPoCount > 0 && (
                    <Chip
                      label={pendingPoCount}
                      size="small"
                      color="info"
                      className="h-5 px-1 font-extrabold text-[10px]"
                    />
                  )}
                </Box>
              }
            />
          </Tabs>
        </Box>
      </Box>

      {/* ALERT EXPLANATORY BANNER */}
      <Alert severity="info" icon={<Layers className="w-5 h-5 text-blue-600" />} className="rounded-xl border border-blue-100 dark:border-blue-900">
        <Typography variant="body2" className="text-slate-800 dark:text-slate-200">
          <strong>Fluxo Integrado de Suprimentos:</strong> Qualquer usuário ou setor pode solicitar múltiplos materiais em uma mesma <strong>Solicitação de Compra (SC)</strong>. O Setor de Compras analisa e aprova a aquisição de cada item separadamente, gerando de forma automática a respectiva <strong>Ordem de Compra (OC)</strong> que segue o ciclo oficial de aprovação, trânsito e entrada física no estoque.
        </Typography>
      </Alert>

      {/* --- TAB 1: SOLICITAÇÕES DE COMPRA --- */}
      {activeTab === 'SOLICITACOES' && (
        <Box className="space-y-6">
          {/* Summary metrics for SC */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <CardContent className="p-4">
                <Typography variant="caption" className="text-slate-500 font-semibold uppercase tracking-wider block">
                  Total de Solicitações (SC)
                </Typography>
                <Typography variant="h5" className="font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                  {purchaseRequests.length}
                </Typography>
                <Typography variant="caption" className="text-slate-400 mt-1 block">
                  Unidade {selectedBranch}
                </Typography>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 shadow-xs">
              <CardContent className="p-4">
                <Typography variant="caption" className="text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wider block">
                  Aguardando Análise de Compras
                </Typography>
                <Typography variant="h5" className="font-extrabold text-amber-900 dark:text-amber-200 mt-1">
                  {purchaseRequests.filter(r => r.status === 'PENDENTE' || r.status === 'PARCIALMENTE_ATENDIDA').length}
                </Typography>
                <Typography variant="caption" className="text-amber-600 dark:text-amber-400 mt-1 block">
                  Itens a cotar / aprovar
                </Typography>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs">
              <CardContent className="p-4">
                <Typography variant="caption" className="text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider block">
                  Itens com OC Gerada
                </Typography>
                <Typography variant="h5" className="font-extrabold text-emerald-900 dark:text-emerald-200 mt-1">
                  {purchaseRequests.reduce((acc, r) => acc + r.items.filter(i => i.status === 'APROVADO').length, 0)}
                </Typography>
                <Typography variant="caption" className="text-emerald-600 dark:text-emerald-400 mt-1 block">
                  Convertidos em Ordens de Compra
                </Typography>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <CardContent className="p-4">
                <Typography variant="caption" className="text-slate-500 font-semibold uppercase tracking-wider block">
                  Solicitações Concluídas
                </Typography>
                <Typography variant="h5" className="font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                  {purchaseRequests.filter(r => r.status === 'CONCLUIDA').length}
                </Typography>
                <Typography variant="caption" className="text-slate-400 mt-1 block">
                  Atendidas 100%
                </Typography>
              </CardContent>
            </Card>
          </div>

          {/* DataTable of Purchase Requests */}
          <DataTable
            title="Solicitações de Compra de Materiais (SC)"
            subTitle="Requisições de suprimentos enviadas ao setor de compras com aprovação item a item."
            columns={requestColumns}
            data={state.purchaseRequests || []}
            onAddClick={handleOpenNewRequestModal}
            addButtonLabel="Nova Solicitação de Compra"
            canEditOrAdd={canEdit}
          />
        </Box>
      )}

      {/* --- TAB 2: ORDENS DE COMPRA (OC) --- */}
      {activeTab === 'ORDENS_COMPRA' && (
        <Box className="space-y-6">
          <DataTable
            title="Ordens de Compra Empresariais (OC / PO)"
            subTitle="Acompanhamento do pipeline oficial de fornecedores, frete e recebimento com entrada em estoque."
            columns={poColumns}
            data={state.purchaseOrders || []}
            onAddClick={() => setPoModalOpen(true)}
            addButtonLabel="Emitir Nova Ordem de Compra Direta"
            canEditOrAdd={canEdit}
          />
        </Box>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CRIAR NOVA SOLICITAÇÃO DE COMPRA (MULTI-ITEM) */}
      {/* ========================================================================= */}
      <Dialog
        open={newRequestModalOpen}
        onClose={() => setNewRequestModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <form onSubmit={handleCreatePurchaseRequest}>
          <DialogTitle className="font-bold flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
            <Box className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <FileText className="w-5 h-5 text-blue-600" />
              <span>Nova Solicitação de Compra ao Setor de Suprimentos</span>
            </Box>
          </DialogTitle>

          <DialogContent dividers className="space-y-6 py-4">
            {requestFormError && (
              <Alert severity="error" className="rounded-xl">{requestFormError}</Alert>
            )}

            {/* Cabeçalho da Solicitação */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <FormControl fullWidth size="small">
                  <InputLabel>Unidade de Destino</InputLabel>
                  <Select
                    value={newRequestBranch}
                    onChange={(e) => setNewRequestBranch(e.target.value as Branch)}
                    label="Unidade de Destino"
                    disabled={currentUser?.role === 'Regular' || currentUser?.role === 'Visitante'}
                  >
                    {dataService.getBranches(true).map(b => (
                      <MenuItem key={b.id} value={b.code}>
                        {b.code} - {b.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>

              <div>
                <FormControl fullWidth size="small">
                  <InputLabel>Centro de Custos (Opcional)</InputLabel>
                  <Select
                    value={newRequestCostCenter}
                    onChange={(e) => setNewRequestCostCenter(e.target.value)}
                    label="Centro de Custos (Opcional)"
                  >
                    <MenuItem value="">Nenhum / Geral</MenuItem>
                    {state.costCenters.filter(c => c.active).map(cc => (
                      <MenuItem key={cc.id} value={cc.id}>{cc.code} - {cc.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>

              <div>
                <FormControl fullWidth size="small" required>
                  <InputLabel>Prioridade de Aquisição</InputLabel>
                  <Select
                    value={newRequestPriority}
                    onChange={(e) => setNewRequestPriority(e.target.value as any)}
                    label="Prioridade de Aquisição"
                  >
                    <MenuItem value="BAIXA">Baixa (Reposição programada)</MenuItem>
                    <MenuItem value="MEDIA">Média (Consumo regular)</MenuItem>
                    <MenuItem value="ALTA">Alta (Estoque baixo / Projeto)</MenuItem>
                    <MenuItem value="URGENTE">Urgente (Parada de operação / Emergência)</MenuItem>
                  </Select>
                </FormControl>
              </div>

              <div className="sm:col-span-1">
                <TextField
                  fullWidth
                  size="small"
                  label="Departamento Solicitante"
                  value={newRequestDepartment}
                  onChange={(e) => setNewRequestDepartment(e.target.value)}
                  placeholder="Ex: Engenharia, Manutenção, TI"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <TextField
                  fullWidth
                  size="small"
                  label="Justificativa da Solicitação"
                  value={newRequestJustification}
                  onChange={(e) => setNewRequestJustification(e.target.value)}
                  placeholder="Descreva a finalidade, projeto ou motivo da compra dos materiais"
                  required
                />
              </div>
            </div>

            {/* AVISO EM TEMPO REAL DE ORÇAMENTO / POLÍTICA OPÇÃO 3 */}
            {requestBudgetCheck && (
              <div className={`p-3.5 rounded-xl border text-xs ${
                requestBudgetCheck.isOverBudget
                  ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40'
                  : 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20'
              }`}>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
                    <Scale className="w-4 h-4 text-blue-600" />
                    <span>Orçamento do Centro de Custo: {requestBudgetCheck.costCenterCode} - {requestBudgetCheck.costCenterName}</span>
                  </div>
                  <Chip
                    label={requestBudgetCheck.isOverBudget ? `Excedente Estimado: R$ ${requestBudgetCheck.overrunAmount.toLocaleString('pt-BR')}` : `Saldo Livre: R$ ${requestBudgetCheck.remainingBudget.toLocaleString('pt-BR')}`}
                    size="small"
                    color={requestBudgetCheck.isOverBudget ? 'warning' : 'success'}
                    className="font-bold text-[10px] h-5"
                  />
                </div>
                {requestBudgetCheck.isOverBudget ? (
                  <p className="text-amber-900 dark:text-amber-200 leading-relaxed">
                    ⚠️ <strong>Alerta de Governança (Política Vigente: Opção 3):</strong> O valor estimado desta solicitação (R$ {requestEstimatedTotal.toLocaleString('pt-BR')}) excede o saldo livre do setor em <strong>R$ {requestBudgetCheck.overrunAmount.toLocaleString('pt-BR')}</strong>. O pedido entrará retido com o selo de Alçada da Diretoria e exigirá autorização formal do Usuário Master.
                  </p>
                ) : (
                  <p className="text-emerald-800 dark:text-emerald-300 leading-relaxed">
                    ✅ Pedido dentro do limite orçamentário provisionado. Saldo projetado após aquisição: R$ {(requestBudgetCheck.remainingBudget - requestEstimatedTotal).toLocaleString('pt-BR')}.
                  </p>
                )}
              </div>
            )}

            {/* SEÇÃO MULTI-ITEM */}
            <Box className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50 dark:bg-slate-900/60 space-y-4">
              <Box className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <Typography variant="subtitle2" className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <ShoppingCart className="w-4 h-4 text-blue-600" />
                    Materiais Solicitados ({requestItems.length})
                  </Typography>
                  <Typography variant="caption" className="text-slate-500">
                    Adicione materiais cadastrados no catálogo ou solicite materiais novos / não cadastrados.
                  </Typography>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="small"
                    variant="outlined"
                    color="primary"
                    onClick={() => handleAddItemRow(false)}
                    startIcon={<Plus className="w-3.5 h-3.5" />}
                    className="font-bold text-xs"
                  >
                    Item do Catálogo
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    color="secondary"
                    onClick={() => handleAddItemRow(true)}
                    startIcon={<Plus className="w-3.5 h-3.5" />}
                    className="font-bold text-xs bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    Item Não Cadastrado
                  </Button>
                </div>
              </Box>

              {/* Items Rows */}
              <div className="space-y-3">
                {requestItems.map((item, idx) => {
                  const selectedProduct = state.products.find(p => p.id === item.productId);
                  const currentStockInBranch = selectedProduct ? (selectedProduct.stockByBranch[newRequestBranch] || 0) : 0;
                  const itemSubtotal = (Number(item.quantity) || 0) * (Number(item.estimatedUnitPrice) || 0);

                  return (
                    <div
                      key={idx}
                      className={`p-3.5 bg-white dark:bg-slate-800 border ${
                        item.isUnregistered
                          ? 'border-purple-300 dark:border-purple-800/80 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700'
                      } rounded-xl space-y-3 transition-all`}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                            Item #{idx + 1}
                          </span>

                          {/* Pill Mode Toggle */}
                          <div className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                            <button
                              type="button"
                              onClick={() => handleToggleItemMode(idx, false)}
                              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                                !item.isUnregistered
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                              }`}
                            >
                              📦 Do Catálogo
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleItemMode(idx, true)}
                              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                                item.isUnregistered
                                  ? 'bg-purple-600 text-white shadow-xs'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                              }`}
                            >
                              ✨ Não Cadastrado (Novo)
                            </button>
                          </div>
                        </div>

                        {requestItems.length > 1 && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleRemoveItemRow(idx)}
                            className="p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </IconButton>
                        )}
                      </div>

                      {item.isUnregistered ? (
                        /* UNREGISTERED MATERIAL FORM */
                        <div className="space-y-3">
                          <div className="p-2.5 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 rounded-lg flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                            <span className="text-xs text-purple-900 dark:text-purple-200">
                              <strong>Material Fora do Catálogo:</strong> Este item seguirá normalmente pelo fluxo de compras (cotação, aprovação e emissão de OC). Ao ser entregue no almoxarifado, ele será automaticamente cadastrado no catálogo e terá seu estoque integrado.
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                            <div className="sm:col-span-6">
                              <TextField
                                fullWidth
                                size="small"
                                label="Descrição Detalhada do Material"
                                value={item.customProductName}
                                onChange={(e) => handleItemFieldChange(idx, 'customProductName', e.target.value)}
                                placeholder="Ex: Sensor de Temperatura PT100 com Flange 1/2 NPT"
                                required
                              />
                            </div>

                            <div className="sm:col-span-3">
                              <FormControl fullWidth size="small">
                                <InputLabel>Categoria Sugerida</InputLabel>
                                <Select
                                  value={item.category || 'Diversos'}
                                  onChange={(e) => handleItemFieldChange(idx, 'category', e.target.value)}
                                  label="Categoria Sugerida"
                                >
                                  {COMMON_CATEGORIES.map(cat => (
                                    <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </div>

                            <div className="sm:col-span-3">
                              <FormControl fullWidth size="small">
                                <InputLabel>Unidade</InputLabel>
                                <Select
                                  value={item.customUnit || 'UN'}
                                  onChange={(e) => handleItemFieldChange(idx, 'customUnit', e.target.value)}
                                  label="Unidade"
                                >
                                  {COMMON_UNITS.map(u => (
                                    <MenuItem key={u} value={u}>{u}</MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </div>

                            <div className="sm:col-span-5">
                              <TextField
                                fullWidth
                                size="small"
                                label="Marca / Modelo de Referência (Opcional)"
                                value={item.brandOrModel}
                                onChange={(e) => handleItemFieldChange(idx, 'brandOrModel', e.target.value)}
                                placeholder="Ex: Novus, SKF, Schneider ou similar"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <TextField
                                fullWidth
                                size="small"
                                type="number"
                                label="Quantidade"
                                value={item.quantity}
                                onChange={(e) => handleItemFieldChange(idx, 'quantity', Math.max(1, Number(e.target.value)))}
                                slotProps={{ htmlInput: { min: 1 } }}
                                required
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <TextField
                                fullWidth
                                size="small"
                                type="number"
                                label="Preço Estim. (R$)"
                                value={item.estimatedUnitPrice}
                                onChange={(e) => handleItemFieldChange(idx, 'estimatedUnitPrice', Number(e.target.value))}
                                slotProps={{ htmlInput: { step: '0.01', min: 0 } }}
                              />
                            </div>

                            <div className="sm:col-span-3 text-right">
                              <Typography variant="caption" className="text-slate-400 block text-[10px] uppercase">
                                Subtotal Estimado
                              </Typography>
                              <Typography className="text-xs font-extrabold text-purple-700 dark:text-purple-300">
                                R$ {itemSubtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </Typography>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* CATALOG ITEM FIELDS */
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                          {/* Product selector */}
                          <div className="sm:col-span-6">
                            <FormControl fullWidth size="small" required>
                              <InputLabel>Selecione o Material</InputLabel>
                              <Select
                                value={item.productId}
                                onChange={(e) => handleItemProductChange(idx, e.target.value)}
                                label="Selecione o Material"
                              >
                                {state.products.filter(p => p.active).map(p => (
                                  <MenuItem key={p.id} value={p.id}>
                                    {p.code} - {p.name} ({p.unit})
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            {selectedProduct && (
                              <Typography variant="caption" className="text-slate-500 mt-0.5 block text-[11px]">
                                Estoque atual em {newRequestBranch}: <strong>{currentStockInBranch} {selectedProduct.unit}</strong> | Cat.: {selectedProduct.category}
                              </Typography>
                            )}
                          </div>

                          {/* Quantity */}
                          <div className="sm:col-span-2">
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              label="Quantidade"
                              value={item.quantity}
                              onChange={(e) => handleItemFieldChange(idx, 'quantity', Math.max(1, Number(e.target.value)))}
                              slotProps={{ htmlInput: { min: 1 } }}
                              required
                            />
                          </div>

                          {/* Estimated unit price */}
                          <div className="sm:col-span-2">
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              label="Preço Estim. (R$)"
                              value={item.estimatedUnitPrice}
                              onChange={(e) => handleItemFieldChange(idx, 'estimatedUnitPrice', Number(e.target.value))}
                              slotProps={{ htmlInput: { step: '0.01', min: 0 } }}
                            />
                          </div>

                          {/* Subtotal */}
                          <div className="sm:col-span-2 text-right">
                            <Typography variant="caption" className="text-slate-400 block text-[10px] uppercase">
                              Subtotal Estimado
                            </Typography>
                            <Typography className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                              R$ {itemSubtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </Typography>
                          </div>
                        </div>
                      )}

                      {/* Notes / specific need for this item */}
                      <div className="pt-1">
                        <TextField
                          fullWidth
                          size="small"
                          label="Observações / Aplicação específica deste item (Opcional)"
                          value={item.notes}
                          onChange={(e) => handleItemFieldChange(idx, 'notes', e.target.value)}
                          placeholder="Ex: Utilização na manutenção da subestação elétrica ou marca recomendada"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total bar */}
              <Box className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                <Typography className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Total de itens: <strong>{requestItems.length}</strong>
                </Typography>
                <Typography className="text-sm font-extrabold text-blue-700 dark:text-blue-400">
                  Valor Estimado Total: R$ {totalEstimatedCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </Typography>
              </Box>
            </Box>
          </DialogContent>

          <DialogActions className="px-6 py-3 border-t border-slate-200 dark:border-slate-800">
            <Button onClick={() => setNewRequestModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" color="primary" className="font-bold">
              Enviar Solicitação de Compra ao Setor de Compras
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 2: DETALHES E APROVAÇÃO POR ITEM DA SOLICITAÇÃO (SC) */}
      {/* ========================================================================= */}
      <Dialog
        open={requestDetailModalOpen}
        onClose={() => setRequestDetailModalOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        {selectedRequest && (
          <div>
            <DialogTitle className="font-bold flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
              <Box className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span>Análise da Solicitação de Compra: {selectedRequest.code}</span>
              </Box>
              <div>{getRequestStatusChip(selectedRequest.status)}</div>
            </DialogTitle>

            <DialogContent dividers className="space-y-6 py-4">
              {/* Header Details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <Typography variant="caption" className="text-slate-500 uppercase font-bold text-[10px]">
                    Solicitante
                  </Typography>
                  <Typography className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {selectedRequest.requestedBy}
                  </Typography>
                  <Typography variant="caption" className="text-slate-400 text-[10px]">
                    {selectedRequest.requestedByEmail}
                  </Typography>
                </div>

                <div>
                  <Typography variant="caption" className="text-slate-500 uppercase font-bold text-[10px]">
                    Unidade & Departamento
                  </Typography>
                  <Typography className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {selectedRequest.branch} • {selectedRequest.department || 'Operações'}
                  </Typography>
                  {selectedRequest.costCenterName && (
                    <Typography variant="caption" className="text-slate-400 text-[10px] block">
                      CC: {selectedRequest.costCenterName}
                    </Typography>
                  )}
                </div>

                <div>
                  <Typography variant="caption" className="text-slate-500 uppercase font-bold text-[10px]">
                    Data de Emissão
                  </Typography>
                  <Typography className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {new Date(selectedRequest.createdAt).toLocaleDateString('pt-BR')} às {new Date(selectedRequest.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </div>

                <div>
                  <Typography variant="caption" className="text-slate-500 uppercase font-bold text-[10px]">
                    Prioridade
                  </Typography>
                  <div className="mt-0.5">{getPriorityChip(selectedRequest.priority)}</div>
                </div>

                <div className="col-span-2 sm:col-span-4 border-t border-slate-200 dark:border-slate-800 pt-2">
                  <Typography variant="caption" className="text-slate-500 uppercase font-bold text-[10px]">
                    Justificativa da Solicitação
                  </Typography>
                  <Typography variant="body2" className="text-slate-700 dark:text-slate-300 italic">
                    "{selectedRequest.justification}"
                  </Typography>
                </div>
              </div>

              {/* Informative Help Banner for Buyer */}
              <Alert severity="info" icon={<ShoppingCart className="w-4 h-4 text-blue-600" />} className="rounded-xl">
                <Typography variant="caption" className="text-slate-800 dark:text-slate-200 font-medium">
                  <strong>Aprovação Item a Item:</strong> O setor de compras pode aprovar a compra de cada material individualmente. Ao clicar em <em>"Aprovar & Gerar OC"</em>, informe o fornecedor e o preço acordado. O sistema gerará imediatamente uma nova <strong>Ordem de Compra (OC)</strong> que seguirá o fluxo oficial de faturamento e entrega.
                </Typography>
              </Alert>

              {/* Table of items with individual approval actions */}
              <Box className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                <div className="p-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <Typography className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Materiais Solicitados ({selectedRequest.items.length})
                  </Typography>
                </div>

                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {selectedRequest.items.map((item, idx) => {
                    const prod = state.products.find(p => p.id === item.productId);
                    const stockInBranch = prod ? (prod.stockByBranch[selectedRequest.branch] || 0) : 0;

                    return (
                      <div key={item.id} className="p-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          {/* Left: Product info */}
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-blue-600 dark:text-blue-400">
                                {item.productCode}
                              </span>
                              <Typography className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                {item.productName}
                              </Typography>
                              {item.isUnregistered && (
                                <Chip
                                  label="Não Cadastrado (Novo)"
                                  size="small"
                                  className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-bold text-[10px] h-5"
                                />
                              )}
                              {getItemStatusChip(item.status)}
                            </div>

                            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                              <span>Qtd Solicitada: <strong>{item.quantity} {item.unit}</strong></span>
                              {item.isUnregistered ? (
                                <span className="text-purple-700 dark:text-purple-400 font-medium">
                                  Item fora de catálogo • Categoria: <strong>{item.category || 'Diversos'}</strong>
                                  {item.brandOrModel ? ` • Marca/Ref: ${item.brandOrModel}` : ''}
                                </span>
                              ) : (
                                <span>Estoque atual na unidade ({selectedRequest.branch}): <strong>{stockInBranch} {item.unit}</strong></span>
                              )}
                              {item.estimatedUnitPrice !== undefined && (
                                <span>Preço Unit. Estimado: <strong>R$ {item.estimatedUnitPrice.toFixed(2)}</strong></span>
                              )}
                              {item.estimatedUnitPrice !== undefined && (
                                <span>Subtotal Estimado: <strong>R$ {(item.quantity * item.estimatedUnitPrice).toFixed(2)}</strong></span>
                              )}
                            </div>

                            {item.notes && (
                              <Typography variant="caption" className="text-slate-500 italic block mt-1">
                                Obs do solicitante: {item.notes}
                              </Typography>
                            )}

                            {/* Details when approved */}
                            {item.status === 'APROVADO' && (
                              <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg text-xs text-emerald-900 dark:text-emerald-200 flex flex-wrap items-center gap-3">
                                <span>Fornecedor: <strong>{item.supplierName}</strong></span>
                                <span>Preço Negociado: <strong>R$ {item.negotiatedUnitPrice?.toFixed(2)} / {item.unit}</strong></span>
                                <span>Total OC: <strong>R$ {((item.negotiatedUnitPrice || 0) * item.quantity).toFixed(2)}</strong></span>
                                {item.generatedPurchaseOrderCode && (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="success"
                                    onClick={() => handleViewPoInPipeline(item.generatedPurchaseOrderCode!)}
                                    endIcon={<ExternalLink className="w-3 h-3" />}
                                    className="font-bold text-[10px] py-0.5 px-2 bg-white dark:bg-slate-900"
                                  >
                                    Ver Ordem {item.generatedPurchaseOrderCode}
                                  </Button>
                                )}
                              </div>
                            )}

                            {/* Details when rejected */}
                            {item.status === 'REJEITADO' && item.rejectionReason && (
                              <div className="mt-1 p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-800 dark:text-rose-200">
                                <strong>Motivo da Recusa:</strong> {item.rejectionReason}
                              </div>
                            )}
                          </div>

                          {/* Right: Actions for Buyer */}
                          <div className="flex items-center gap-2 shrink-0">
                            {item.status === 'PENDENTE' && canEdit ? (
                              <>
                                <Button
                                  variant="contained"
                                  color="success"
                                  size="small"
                                  onClick={() => handleOpenApproveItem(item)}
                                  startIcon={<Check className="w-4 h-4" />}
                                  className="font-bold text-xs py-1 px-3 shadow-xs"
                                >
                                  Aprovar & Gerar OC
                                </Button>
                                <Button
                                  variant="outlined"
                                  color="error"
                                  size="small"
                                  onClick={() => handleOpenRejectItem(item)}
                                  startIcon={<X className="w-4 h-4" />}
                                  className="font-bold text-xs py-1 px-3"
                                >
                                  Rejeitar Item
                                </Button>
                              </>
                            ) : item.status === 'APROVADO' && item.generatedPurchaseOrderCode ? (
                              <Button
                                variant="contained"
                                color="info"
                                size="small"
                                onClick={() => handleViewPoInPipeline(item.generatedPurchaseOrderCode!)}
                                startIcon={<ShoppingCart className="w-4 h-4" />}
                                className="font-bold text-xs py-1 px-3"
                              >
                                Acompanhar OC ({item.generatedPurchaseOrderCode})
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Box>
            </DialogContent>

            <DialogActions className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <Button
                variant="outlined"
                color="primary"
                startIcon={<Printer className="w-4 h-4" />}
                onClick={() => {
                  const branchInfo = dataService.getBranchByCode(selectedRequest.branch);
                  const cc = state.costCenters.find(c => c.id === selectedRequest.costCenterId);
                  exportPurchaseRequestPDF(selectedRequest, branchInfo, cc);
                }}
                className="font-bold text-xs"
              >
                Imprimir / Gerar PDF da Solicitação (SC)
              </Button>
              <Button onClick={() => setRequestDetailModalOpen(false)}>Fechar</Button>
            </DialogActions>
          </div>
        )}
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 3: APROVAR ITEM ESPECÍFICO E EMITIR ORDEM DE COMPRA (OC) */}
      {/* ========================================================================= */}
      <Dialog
        open={approveItemModalOpen}
        onClose={() => setApproveItemModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <form onSubmit={handleConfirmApproveItem}>
          <DialogTitle className="font-bold flex items-center gap-2 text-emerald-700 dark:text-emerald-400 border-b border-slate-200 dark:border-slate-800">
            <CheckCircle2 className="w-5 h-5" />
            <span>Aprovar Compra & Gerar Ordem de Compra (OC)</span>
          </DialogTitle>

          <DialogContent dividers className="space-y-4 py-4">
            {approvalError && <Alert severity="error">{approvalError}</Alert>}

            {itemToApprove && (
              <Box className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex items-center justify-between">
                  <Typography variant="caption" className="text-slate-500 uppercase font-bold text-[10px]">
                    Material Aprovado para Aquisição
                  </Typography>
                  {itemToApprove.isUnregistered && (
                    <Chip label="Fora de Catálogo" size="small" className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-bold text-[10px] h-4" />
                  )}
                </div>
                <Typography className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {itemToApprove.productCode} - {itemToApprove.productName}
                </Typography>
                <Typography variant="caption" className="text-slate-500 block">
                  Quantidade a Comprar: <strong>{itemToApprove.quantity} {itemToApprove.unit}</strong>
                  {itemToApprove.category ? ` • Categoria: ${itemToApprove.category}` : ''}
                  {itemToApprove.brandOrModel ? ` • Marca/Ref: ${itemToApprove.brandOrModel}` : ''}
                </Typography>
              </Box>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <TextField
                  fullWidth
                  size="small"
                  label="Razão Social / Nome do Fornecedor"
                  value={approvalSupplierName}
                  onChange={(e) => setApprovalSupplierName(e.target.value)}
                  placeholder="Ex: Schneider Electric do Brasil Ltda"
                  required
                />
              </div>

              <div>
                <TextField
                  fullWidth
                  size="small"
                  label="CNPJ do Fornecedor"
                  value={approvalSupplierCnpj}
                  onChange={(e) => setApprovalSupplierCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                />
              </div>

              <div>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Preço Unitário Negociado (R$)"
                  value={approvalUnitPrice}
                  onChange={(e) => setApprovalUnitPrice(Number(e.target.value))}
                  slotProps={{ htmlInput: { step: '0.01', min: 0 } }}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <TextField
                  fullWidth
                  size="small"
                  label="Condição de Pagamento"
                  value={approvalPaymentTerms}
                  onChange={(e) => setApprovalPaymentTerms(e.target.value)}
                  placeholder="Ex: 28 dias faturado, 30/60 dias, À vista"
                />
              </div>

              {itemToApprove && (
                <div className="sm:col-span-2 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                    Valor Total da Ordem de Compra (OC):
                  </span>
                  <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-400">
                    R$ {(itemToApprove.quantity * Number(approvalUnitPrice || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
          </DialogContent>

          <DialogActions className="px-6 py-3 border-t border-slate-200 dark:border-slate-800">
            <Button onClick={() => setApproveItemModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" color="success" className="font-bold">
              Confirmar Aprovação & Emitir OC
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 4: REJEITAR ITEM ESPECÍFICO */}
      {/* ========================================================================= */}
      <Dialog
        open={rejectItemModalOpen}
        onClose={() => setRejectItemModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <form onSubmit={handleConfirmRejectItem}>
          <DialogTitle className="font-bold flex items-center gap-2 text-rose-700 dark:text-rose-400">
            <XCircle className="w-5 h-5" />
            <span>Rejeitar Item da Solicitação</span>
          </DialogTitle>

          <DialogContent dividers className="space-y-4">
            {itemToReject && (
              <Typography variant="body2" className="text-slate-700 dark:text-slate-300">
                Você está rejeitando a compra do material <strong>{itemToReject.productName} ({itemToReject.quantity} {itemToReject.unit})</strong>.
              </Typography>
            )}

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Motivo da Rejeição / Justificativa"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Ex: Item já existente em excesso no almoxarifado, produto em descontinuação ou sem dotação orçamentária."
              required
            />
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setRejectItemModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" color="error" className="font-bold">
              Confirmar Rejeição do Item
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 5: DETALHES DA ORDEM DE COMPRA (OC) */}
      {/* ========================================================================= */}
      <Dialog
        open={poDetailModalOpen}
        onClose={() => setPoDetailModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedPo && (
          <div>
            <DialogTitle className="font-bold flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
              <Box className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                <span>Ordem de Compra: {selectedPo.code}</span>
              </Box>
              <Chip
                label={getPoStatusLabel(selectedPo.status)}
                color={selectedPo.status === 'ENTREGUE' ? 'success' : selectedPo.status === 'APROVADO' ? 'info' : 'warning'}
                className="font-bold text-xs"
              />
            </DialogTitle>

            <DialogContent dividers className="space-y-6 py-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <Typography variant="caption" className="text-slate-500 uppercase font-bold text-[10px]">
                    Fornecedor
                  </Typography>
                  <Typography className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {selectedPo.supplierName}
                  </Typography>
                  <Typography variant="caption" className="text-slate-400 text-[10px]">
                    CNPJ: {selectedPo.supplierCnpj}
                  </Typography>
                </div>

                <div>
                  <Typography variant="caption" className="text-slate-500 uppercase font-bold text-[10px]">
                    Unidade Destino
                  </Typography>
                  <Typography className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {selectedPo.branch}
                  </Typography>
                  {selectedPo.purchaseRequestCode && (
                    <Typography variant="caption" className="text-blue-600 font-semibold text-[10px] block">
                      Origem: {selectedPo.purchaseRequestCode}
                    </Typography>
                  )}
                </div>

                <div>
                  <Typography variant="caption" className="text-slate-500 uppercase font-bold text-[10px]">
                    Condição de Pagamento
                  </Typography>
                  <Typography className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {selectedPo.paymentTerms || '28 dias faturado'}
                  </Typography>
                </div>

                <div>
                  <Typography variant="caption" className="text-slate-500 uppercase font-bold text-[10px]">
                    Valor Total
                  </Typography>
                  <Typography className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                    R$ {selectedPo.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </Typography>
                </div>
              </div>

              {/* Items in the PO */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="p-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-800 dark:text-slate-200">
                  Itens da Ordem de Compra
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {selectedPo.items.map((it, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between bg-white dark:bg-slate-900">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Typography className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {it.productCode} - {it.productName}
                          </Typography>
                          {it.isUnregistered && (
                            <Chip label="Item Fora de Catálogo" size="small" className="text-[9px] h-4 bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-bold" />
                          )}
                        </div>
                        <Typography variant="caption" className="text-slate-500 block mt-0.5">
                          Quantidade: {it.quantity} {it.unit} • Preço Unitário: R$ {it.unitPrice.toFixed(2)}
                          {it.category ? ` • Cat.: ${it.category}` : ''}
                          {it.brandOrModel ? ` • Ref: ${it.brandOrModel}` : ''}
                        </Typography>
                      </div>
                      <Typography className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                        R$ {it.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </Typography>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alerta de Estouro Orçamentário / Alçada da Diretoria */}
              {selectedPo.budgetOverrun && (
                <div className="p-3.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200 mb-1">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    Alçada Extraordinária da Diretoria (Política Vigente: Opção 3)
                  </div>
                  <div className="text-slate-700 dark:text-slate-300 leading-normal">
                    Esta compra ultrapassou a dotação do Centro de Custo em <strong>R$ {selectedPo.budgetOverrunAmount ? selectedPo.budgetOverrunAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}</strong>.
                    {selectedPo.budgetOverrunApprovedBy ? (
                      <span className="block mt-1 text-emerald-700 dark:text-emerald-400 font-bold">
                        ✅ Liberado por {selectedPo.budgetOverrunApprovedBy} em {selectedPo.budgetOverrunApprovedAt ? new Date(selectedPo.budgetOverrunApprovedAt).toLocaleDateString('pt-BR') : ''}.
                        {selectedPo.budgetOverrunJustification && ` Motivo: "${selectedPo.budgetOverrunJustification}"`}
                      </span>
                    ) : (
                      <span className="block mt-1 text-amber-800 dark:text-amber-300 font-semibold">
                        🔒 Compra retida preventivamente. A aprovação exige perfil de Usuário Master / Diretoria com justificativa formal registrada.
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Status Actions */}
              {canEdit && (
                <Box className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <Typography variant="caption" className="text-slate-600 dark:text-slate-400 font-bold">
                    Avançar Pipeline de Entrega:
                  </Typography>
                  <Box className="flex items-center gap-2">
                    {selectedPo.status === 'AGUARDANDO_APROVACAO' && (
                      <Button
                        size="small"
                        variant="contained"
                        color={selectedPo.budgetOverrun ? 'warning' : 'info'}
                        onClick={() => handleUpdatePoStatus(selectedPo.id, 'APROVADO')}
                        className="font-bold text-xs"
                      >
                        {selectedPo.budgetOverrun ? 'Liberar com Alçada da Diretoria' : 'Aprovar Ordem'}
                      </Button>
                    )}
                    {selectedPo.status === 'APROVADO' && (
                      <Button
                        size="small"
                        variant="contained"
                        color="warning"
                        onClick={() => handleUpdatePoStatus(selectedPo.id, 'EM_TRANSITO')}
                        className="font-bold text-xs"
                      >
                        Marcar Em Trânsito
                      </Button>
                    )}
                    {selectedPo.status === 'EM_TRANSITO' && (
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        onClick={() => handleUpdatePoStatus(selectedPo.id, 'ENTREGUE')}
                        className="font-bold text-xs"
                      >
                        Confirmar Entrega (Entrada no Estoque)
                      </Button>
                    )}
                  </Box>
                </Box>
              )}
            </DialogContent>

            <DialogActions className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <Button
                variant="outlined"
                color="primary"
                startIcon={<Printer className="w-4 h-4" />}
                onClick={() => {
                  const branchInfo = dataService.getBranchByCode(selectedPo.branch);
                  const cc = state.costCenters.find(c => c.id === selectedPo.costCenterId);
                  exportPurchaseOrderPDF(selectedPo, branchInfo, cc);
                }}
                className="font-bold text-xs"
              >
                Imprimir / Gerar PDF da Ordem de Compra (OC)
              </Button>
              <Button onClick={() => setPoDetailModalOpen(false)}>Fechar</Button>
            </DialogActions>
          </div>
        )}
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 6: EMISSÃO DIRETA DE ORDEM DE COMPRA (OC) */}
      {/* ========================================================================= */}
      <Dialog open={poModalOpen} onClose={() => setPoModalOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleCreateDirectPo}>
          <DialogTitle className="font-bold">Emitir Nova Ordem de Compra Direta</DialogTitle>
          <DialogContent dividers className="space-y-4">
            {poFormError && <Alert severity="error">{poFormError}</Alert>}

            {/* Mode selection toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Tipo de Material:</span>
              <div className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setPoForm({ ...poForm, isUnregistered: false })}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                    !poForm.isUnregistered
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  📦 Do Catálogo
                </button>
                <button
                  type="button"
                  onClick={() => setPoForm({ ...poForm, isUnregistered: true })}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                    poForm.isUnregistered
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  ✨ Não Cadastrado (Novo)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormControl fullWidth size="small">
                <InputLabel>Unidade de Destino da Ordem</InputLabel>
                <Select
                  value={poForm.branch || 'SP'}
                  onChange={(e) => setPoForm({ ...poForm, branch: e.target.value as Branch })}
                  label="Unidade de Destino da Ordem"
                >
                  {dataService.getBranches(true).map(b => (
                    <MenuItem key={b.id} value={b.code}>
                      {b.code} - {b.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small">
                <InputLabel>Centro de Custo Atendido</InputLabel>
                <Select
                  value={poForm.costCenterId || ''}
                  onChange={(e) => setPoForm({ ...poForm, costCenterId: e.target.value })}
                  label="Centro de Custo Atendido"
                >
                  <MenuItem value="">Nenhum / Uso Geral da Unidade</MenuItem>
                  {state.costCenters
                    .filter(c => c.active && (c.branch === (poForm.branch || 'SP') || c.branch === 'GLOBAL'))
                    .map(c => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.code} - {c.name}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <TextField
                  fullWidth
                  size="small"
                  label="Razão Social Fornecedor"
                  value={poForm.supplierName}
                  onChange={(e) => setPoForm({ ...poForm, supplierName: e.target.value })}
                  required
                />
              </div>
              <div>
                <TextField
                  fullWidth
                  size="small"
                  label="CNPJ Fornecedor"
                  value={poForm.supplierCnpj}
                  onChange={(e) => setPoForm({ ...poForm, supplierCnpj: e.target.value })}
                />
              </div>

              {poForm.isUnregistered ? (
                <>
                  <div className="sm:col-span-2">
                    <TextField
                      fullWidth
                      size="small"
                      label="Descrição do Material Não Cadastrado"
                      value={poForm.customProductName}
                      onChange={(e) => setPoForm({ ...poForm, customProductName: e.target.value })}
                      placeholder="Ex: Sensor de Nível Capacitivo 24VDC"
                      required
                    />
                  </div>
                  <div>
                    <FormControl fullWidth size="small">
                      <InputLabel>Unidade de Medida</InputLabel>
                      <Select
                        value={poForm.customUnit || 'UN'}
                        onChange={(e) => setPoForm({ ...poForm, customUnit: e.target.value })}
                        label="Unidade de Medida"
                      >
                        {COMMON_UNITS.map(u => (
                          <MenuItem key={u} value={u}>{u}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </div>
                  <div>
                    <FormControl fullWidth size="small">
                      <InputLabel>Categoria Sugerida</InputLabel>
                      <Select
                        value={poForm.category || 'Diversos'}
                        onChange={(e) => setPoForm({ ...poForm, category: e.target.value })}
                        label="Categoria Sugerida"
                      >
                        {COMMON_CATEGORIES.map(cat => (
                          <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </div>
                </>
              ) : (
                <div className="sm:col-span-2">
                  <FormControl fullWidth size="small" required>
                    <InputLabel>Selecione o Item para Compra</InputLabel>
                    <Select
                      value={poForm.productId}
                      onChange={(e) => setPoForm({ ...poForm, productId: e.target.value })}
                      label="Selecione o Item para Compra"
                    >
                      {state.products.filter(p => p.active).map(p => (
                        <MenuItem key={p.id} value={p.id}>{p.code} - {p.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </div>
              )}

              <div>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Quantidade a Comprar"
                  value={poForm.quantity}
                  onChange={(e) => setPoForm({ ...poForm, quantity: Math.max(1, Number(e.target.value)) })}
                  slotProps={{ htmlInput: { min: 1 } }}
                  required
                />
              </div>
              <div>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Preço Unitário Acordado (R$)"
                  value={poForm.unitPrice}
                  onChange={(e) => setPoForm({ ...poForm, unitPrice: Number(e.target.value) })}
                  slotProps={{ htmlInput: { step: '0.01', min: 0 } }}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <TextField
                  fullWidth
                  size="small"
                  label="Condição de Pagamento"
                  value={poForm.paymentTerms}
                  onChange={(e) => setPoForm({ ...poForm, paymentTerms: e.target.value })}
                />
              </div>
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPoModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" color="primary">Emitir Ordem de Compra</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};
