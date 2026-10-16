import React, { useState } from 'react';
import {
  Box, Typography, Card, Button, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem,
  Chip, Alert, Switch, FormControlLabel, IconButton, Tooltip, Snackbar, Tabs, Tab, Divider, CircularProgress
} from '@mui/material';
import {
  Building2, Plus, Edit3, Power, MapPin, FileCheck2, Phone, Mail,
  UserCheck, Eye, Copy, CheckCircle2, Search, Warehouse, Globe, Landmark, Package, Clock
} from 'lucide-react';
import { Breadcrumb } from '../components/Breadcrumb';
import { DataTable, Column } from '../components/DataTable';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { BranchInfo, UnitType } from '../types';
import { copyToClipboard } from '../utils/clipboard';

const BRAZIL_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const UNIT_TYPE_LABELS: Record<UnitType, { label: string; color: 'primary' | 'info' | 'secondary' | 'warning' | 'success' }> = {
  MATRIZ: { label: 'Matriz Corporativa', color: 'primary' },
  UNIDADE_OPERACIONAL: { label: 'Unidade Operacional', color: 'info' },
  CENTRO_DISTRIBUICAO: { label: 'Centro de Distribuição (CD)', color: 'secondary' },
  ADMINISTRATIVA: { label: 'Unidade Administrativa', color: 'success' },
  OBRA_PROJETO: { label: 'Obra / Projeto Especial', color: 'warning' }
};

export const formatCnpj = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
};

export const formatCep = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
};

export const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

interface UnidadesProps {
  embedded?: boolean;
}

export const Unidades: React.FC<UnidadesProps> = ({ embedded = false }) => {
  const { currentUser } = useAuth();
  const { refreshData, setSelectedBranch } = useApp();

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<BranchInfo | null>(null);
  const [formTab, setFormTab] = useState(0);
  const [loadingCep, setLoadingCep] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [unitForm, setUnitForm] = useState<Partial<BranchInfo>>({
    code: '',
    name: '',
    corporateName: '',
    unitType: 'UNIDADE_OPERACIONAL',
    cnpj: '',
    stateRegistration: '',
    municipalRegistration: '',
    cnae: '5211-7/99 - Depósitos de mercadorias para terceiros',
    zipCode: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: 'SP',
    address: '',
    referencePoint: '',
    manager: '',
    managerRole: 'Coordenador de Operações e Almoxarifado',
    phone: '',
    whatsapp: '',
    email: '',
    operatingHours: 'Seg a Sex, 08:00 às 18:00',
    areaM2: 1000,
    openingDate: new Date().toISOString().split('T')[0],
    notes: '',
    active: true
  });

  const state = dataService.getState();
  const branches = dataService.getBranches(false);
  const canEdit = currentUser?.role !== 'Visitante';

  // Operational metrics helper per Unit
  const getUnitOperationalSummary = (branchCode: string) => {
    const activeSkus = state.products.filter(p => (p.stockByBranch[branchCode] || 0) > 0).length;
    const totalItems = state.products.reduce((acc, p) => acc + (p.stockByBranch[branchCode] || 0), 0);
    const totalStockValue = state.products.reduce((acc, p) => acc + ((p.stockByBranch[branchCode] || 0) * p.unitPrice), 0);
    const unitAssets = state.assets.filter(a => a.branch === branchCode);
    const totalAssetsValue = unitAssets.reduce((acc, a) => acc + a.value, 0);
    const unitUsers = state.users.filter(u => u.branch === branchCode && u.active).length;
    const unitCostCenters = state.costCenters.filter(cc => cc.branch === branchCode && cc.active).length;

    return {
      activeSkus,
      totalItems,
      totalStockValue,
      assetsCount: unitAssets.length,
      totalAssetsValue,
      unitUsers,
      unitCostCenters
    };
  };

  const handleOpenNewUnit = () => {
    setFormError(null);
    setFormTab(0);
    setUnitForm({
      code: '',
      name: '',
      corporateName: '',
      unitType: 'UNIDADE_OPERACIONAL',
      cnpj: '',
      stateRegistration: '',
      municipalRegistration: '',
      cnae: '5211-7/99 - Depósitos de mercadorias para terceiros',
      zipCode: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: 'SP',
      address: '',
      referencePoint: '',
      manager: '',
      managerRole: 'Gerente de Unidade / Almoxarifado',
      phone: '',
      whatsapp: '',
      email: '',
      operatingHours: 'Seg a Sex, 08:00 às 18:00',
      areaM2: 1200,
      openingDate: new Date().toISOString().split('T')[0],
      notes: '',
      active: true
    });
    setFormModalOpen(true);
  };

  const handleOpenEditUnit = (unit: BranchInfo) => {
    setFormError(null);
    setFormTab(0);
    setUnitForm({
      ...unit,
      unitType: unit.unitType || 'UNIDADE_OPERACIONAL',
      corporateName: unit.corporateName || `Almox Plus Tecnologia e Logística S.A. - ${unit.name}`,
      cnae: unit.cnae || '5211-7/99 - Depósitos de mercadorias para terceiros',
      operatingHours: unit.operatingHours || 'Seg a Sex, 08:00 às 18:00'
    });
    setFormModalOpen(true);
  };

  const handleOpenDetails = (unit: BranchInfo) => {
    setSelectedUnit(unit);
    setDetailModalOpen(true);
  };

  const handleLookupCep = async () => {
    const cleanCep = (unitForm.zipCode || '').replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      setFormError('Informe um CEP válido com 8 dígitos para busca automática.');
      return;
    }

    setLoadingCep(true);
    setFormError(null);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (data.erro) {
        setFormError('CEP não encontrado na base dos Correios. Preencha os campos manualmente.');
      } else {
        setUnitForm(prev => ({
          ...prev,
          street: data.logradouro || prev.street || '',
          neighborhood: data.bairro || prev.neighborhood || '',
          city: data.localidade || prev.city || '',
          state: data.uf || prev.state || 'SP',
          complement: data.complemento || prev.complement || ''
        }));
        setToastMessage(`Endereço localizado para o CEP ${formatCep(cleanCep)} (${data.localidade}/${data.uf}).`);
      }
    } catch {
      setFormError('Não foi possível consultar o CEP automaticamente no momento. Preencha manualmente.');
    } finally {
      setLoadingCep(false);
    }
  };

  const handleSaveUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setFormError(null);

    const code = (unitForm.code || '').trim().toUpperCase();
    const name = (unitForm.name || '').trim();
    const corporateName = (unitForm.corporateName || '').trim();
    const cnpj = (unitForm.cnpj || '').trim();
    const city = (unitForm.city || '').trim();
    const stateUf = (unitForm.state || '').trim().toUpperCase();

    if (!code || !name || !corporateName || !cnpj || !city || !stateUf) {
      setFormError('Preencha todos os campos obrigatórios: Sigla, Nome da Unidade, Razão Social, CNPJ, Cidade e UF.');
      return;
    }

    const composedAddress = [
      unitForm.street ? `${unitForm.street}${unitForm.number ? `, ${unitForm.number}` : ''}` : '',
      unitForm.complement,
      unitForm.neighborhood
    ].filter(Boolean).join(' - ') || unitForm.address || '';

    const payload: Omit<BranchInfo, 'id' | 'createdAt'> = {
      code,
      name,
      corporateName,
      unitType: unitForm.unitType || 'UNIDADE_OPERACIONAL',
      cnpj,
      stateRegistration: unitForm.stateRegistration?.trim(),
      municipalRegistration: unitForm.municipalRegistration?.trim(),
      cnae: unitForm.cnae?.trim(),
      zipCode: unitForm.zipCode?.trim(),
      street: unitForm.street?.trim(),
      number: unitForm.number?.trim(),
      complement: unitForm.complement?.trim(),
      neighborhood: unitForm.neighborhood?.trim(),
      city,
      state: stateUf,
      address: composedAddress,
      referencePoint: unitForm.referencePoint?.trim(),
      manager: unitForm.manager?.trim(),
      managerRole: unitForm.managerRole?.trim(),
      phone: unitForm.phone?.trim(),
      whatsapp: unitForm.whatsapp?.trim(),
      email: unitForm.email?.trim(),
      operatingHours: unitForm.operatingHours?.trim(),
      areaM2: unitForm.areaM2 ? Number(unitForm.areaM2) : undefined,
      openingDate: unitForm.openingDate,
      notes: unitForm.notes?.trim(),
      active: unitForm.active ?? true
    };

    try {
      if (unitForm.id) {
        dataService.updateBranch(unitForm.id, payload, currentUser);
        setToastMessage(`Cadastro da Unidade "${code} - ${name}" atualizado com sucesso!`);
      } else {
        dataService.createBranch(payload, currentUser);
        setToastMessage(`Nova Unidade "${code} - ${name}" cadastrada com sucesso e integrada a todo o ERP!`);
      }
      setFormModalOpen(false);
      refreshData();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const handleToggleUnitStatus = (unit: BranchInfo) => {
    if (!currentUser) return;
    try {
      const updated = dataService.toggleBranchActive(unit.id, currentUser);
      setToastMessage(`Status da Unidade ${unit.code} alterado para ${updated.active ? 'Ativa' : 'Inativa'}.`);
      refreshData();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const handleCopyBillingData = async (unit: BranchInfo) => {
    const fullAddress = [
      unit.street ? `${unit.street}${unit.number ? `, ${unit.number}` : ''}` : unit.address,
      unit.complement,
      unit.neighborhood,
      `${unit.city} - ${unit.state}`,
      unit.zipCode ? `CEP: ${unit.zipCode}` : ''
    ].filter(Boolean).join(' | ');

    const text = [
      `DADOS CADASTRAIS E DE FATURAMENTO - UNIDADE ${unit.code}`,
      `Unidade: ${unit.name}`,
      `Razão Social: ${unit.corporateName || unit.name}`,
      `CNPJ: ${unit.cnpj || 'Não informado'}`,
      `Inscrição Estadual (IE): ${unit.stateRegistration || 'Isento'}`,
      `Inscrição Municipal (IM): ${unit.municipalRegistration || '-'}`,
      `Endereço Completo: ${fullAddress}`,
      `Responsável: ${unit.manager || '-'} (${unit.managerRole || 'Gestor'})`,
      `Telefone: ${unit.phone || '-'} | E-mail NF-e: ${unit.email || '-'}`
    ].join('\n');

    try {
      await copyToClipboard(text);
    } catch {
      // Handled gracefully
    }
    setToastMessage(`Dados de faturamento e endereço da Unidade ${unit.code} copiados para a área de transferência!`);
  };

  const unitColumns: Column<BranchInfo>[] = [
    {
      id: 'code',
      label: 'Sigla / Tipo',
      accessor: (b) => b.code,
      sortable: true,
      render: (b) => {
        const typeCfg = UNIT_TYPE_LABELS[b.unitType || 'UNIDADE_OPERACIONAL'];
        return (
          <div className="flex flex-col gap-1 items-start">
            <Chip
              label={`Unidade ${b.code}`}
              color="primary"
              size="small"
              className="font-mono font-extrabold text-xs h-5"
            />
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
              {typeCfg.label}
            </span>
          </div>
        );
      }
    },
    {
      id: 'corporateName',
      label: 'Unidade & Razão Social',
      accessor: (b) => `${b.name} ${b.corporateName || ''}`,
      sortable: true,
      render: (b) => (
        <div className="max-w-[260px]">
          <Typography className="text-xs font-extrabold text-slate-900 dark:text-slate-100 leading-snug">
            {b.name}
          </Typography>
          <Typography variant="caption" className="text-[11px] text-slate-600 dark:text-slate-400 block truncate" title={b.corporateName || b.name}>
            {b.corporateName || `Almox Plus S.A. - ${b.name}`}
          </Typography>
        </div>
      )
    },
    {
      id: 'cnpj',
      label: 'CNPJ & Inscrições Fiscais',
      accessor: (b) => b.cnpj || '-',
      sortable: true,
      render: (b) => (
        <div className="font-mono text-xs">
          <div className="font-bold text-slate-800 dark:text-slate-200">
            {b.cnpj || 'Não informado'}
          </div>
          <div className="text-[10px] text-slate-500">
            IE: {b.stateRegistration || 'Isento'} {b.municipalRegistration ? `• IM: ${b.municipalRegistration}` : ''}
          </div>
        </div>
      )
    },
    {
      id: 'address',
      label: 'Endereço Completo',
      accessor: (b) => `${b.street || b.address || ''} ${b.city}/${b.state} ${b.zipCode || ''}`,
      render: (b) => {
        const line1 = b.street
          ? `${b.street}${b.number ? `, ${b.number}` : ''}${b.complement ? ` (${b.complement})` : ''}`
          : (b.address || '-');
        const line2 = [b.neighborhood, `${b.city}/${b.state}`, b.zipCode ? `CEP ${b.zipCode}` : ''].filter(Boolean).join(' • ');
        return (
          <div className="max-w-[270px] text-xs">
            <div className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={line1}>
              {line1}
            </div>
            <div className="text-[10px] text-slate-500 truncate" title={line2}>
              {line2}
            </div>
          </div>
        );
      }
    },
    {
      id: 'manager',
      label: 'Gestor & Contato',
      accessor: (b) => b.manager || '-',
      render: (b) => (
        <div className="text-xs">
          <div className="font-bold text-slate-800 dark:text-slate-200">
            {b.manager || '-'}
          </div>
          <div className="text-[10px] text-slate-500">
            {b.phone || b.whatsapp || '-'}
          </div>
          {b.email && (
            <div className="text-[10px] text-blue-600 dark:text-blue-400 truncate max-w-[170px]">
              {b.email}
            </div>
          )}
        </div>
      )
    },
    {
      id: 'operational',
      label: 'Acervo Operacional',
      accessor: (b) => getUnitOperationalSummary(b.code).totalStockValue,
      sortable: true,
      render: (b) => {
        const summary = getUnitOperationalSummary(b.code);
        return (
          <div className="text-xs">
            <div className="font-extrabold text-emerald-700 dark:text-emerald-400">
              R$ {summary.totalStockValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-500">
              {summary.activeSkus} SKUs • {summary.assetsCount} Patrimônios • {summary.unitUsers} Usuários
            </div>
          </div>
        );
      }
    },
    {
      id: 'active',
      label: 'Status',
      accessor: (b) => b.active ? 'Ativa' : 'Inativa',
      render: (b) => (
        <Chip
          label={b.active ? 'Ativa' : 'Inativa'}
          color={b.active ? 'success' : 'default'}
          size="small"
          className="font-bold text-[10px] h-5"
        />
      )
    },
    {
      id: 'actions',
      label: 'Ações',
      accessor: (b) => b.id,
      exportable: false,
      render: (b) => (
        <Box className="flex items-center gap-1">
          <Tooltip title="Ver Ficha Cadastral Completa e Dados de Faturamento">
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleOpenDetails(b)}
              startIcon={<Eye className="w-3.5 h-3.5" />}
              className="text-[10px] py-0.5 px-2 font-bold"
            >
              Ficha
            </Button>
          </Tooltip>
          {canEdit && (
            <>
              <Tooltip title="Editar Cadastro da Unidade">
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => handleOpenEditUnit(b)}
                  className="p-1"
                >
                  <Edit3 className="w-4 h-4" />
                </IconButton>
              </Tooltip>
              <Tooltip title={b.active ? 'Inativar Unidade' : 'Ativar Unidade'}>
                <IconButton
                  size="small"
                  color={b.active ? 'warning' : 'success'}
                  onClick={() => handleToggleUnitStatus(b)}
                  className="p-1"
                >
                  <Power className="w-4 h-4" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      )
    }
  ];

  const activeUnitsCount = branches.filter(b => b.active).length;
  const distinctStatesCount = new Set(branches.map(b => b.state)).size;
  const totalAreaM2 = branches.reduce((acc, b) => acc + (b.areaM2 || 0), 0);

  return (
    <Box className="space-y-6">
      {!embedded && (
        <Breadcrumb items={[{ label: 'Cadastro e Gestão de Unidades Operacionais' }]} />
      )}

      {/* Top Executive Header */}
      <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <Typography variant="h5" className="font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                Central de Cadastro de Unidades
              </Typography>
              <Typography variant="body2" className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                Gerenciamento societário, fiscal (Razão Social, CNPJ, IE, IM), endereço logístico completo e infraestrutura de todas as unidades da empresa.
              </Typography>
            </div>
          </div>

          {canEdit && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleOpenNewUnit}
              startIcon={<Plus className="w-4 h-4" />}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-xs shrink-0"
            >
              Cadastrar Nova Unidade
            </Button>
          )}
        </div>
      </Card>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between">
            <Typography variant="caption" className="font-bold text-slate-500 uppercase text-[10px]">
              Unidades Cadastradas
            </Typography>
            <Building2 className="w-4 h-4 text-blue-600" />
          </div>
          <Typography variant="h4" className="font-extrabold text-slate-900 dark:text-slate-100 mt-1">
            {branches.length}
          </Typography>
          <Typography variant="caption" className="text-emerald-600 font-bold text-[11px] block mt-1">
            {activeUnitsCount} unidade(s) ativa(s) em operação
          </Typography>
        </Card>

        <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between">
            <Typography variant="caption" className="font-bold text-slate-500 uppercase text-[10px]">
              Regularidade Fiscal (CNPJ / IE)
            </Typography>
            <FileCheck2 className="w-4 h-4 text-emerald-600" />
          </div>
          <Typography variant="h4" className="font-extrabold text-emerald-600 mt-1">
            {branches.filter(b => b.cnpj && b.corporateName).length}/{branches.length}
          </Typography>
          <Typography variant="caption" className="text-slate-500 text-[11px] block mt-1">
            Com Razão Social e CNPJ habilitados para NF-e
          </Typography>
        </Card>

        <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between">
            <Typography variant="caption" className="font-bold text-slate-500 uppercase text-[10px]">
              Abrangência Geográfica
            </Typography>
            <Globe className="w-4 h-4 text-indigo-600" />
          </div>
          <Typography variant="h4" className="font-extrabold text-indigo-600 mt-1">
            {distinctStatesCount} UF(s)
          </Typography>
          <Typography variant="caption" className="text-slate-500 text-[11px] block mt-1">
            Estados: {Array.from(new Set(branches.map(b => b.state))).join(', ')}
          </Typography>
        </Card>

        <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between">
            <Typography variant="caption" className="font-bold text-slate-500 uppercase text-[10px]">
              Área Total de Armazenagem
            </Typography>
            <Warehouse className="w-4 h-4 text-amber-600" />
          </div>
          <Typography variant="h4" className="font-extrabold text-amber-600 mt-1">
            {totalAreaM2.toLocaleString('pt-BR')} m²
          </Typography>
          <Typography variant="caption" className="text-slate-500 text-[11px] block mt-1">
            Infraestrutura física consolidada
          </Typography>
        </Card>
      </div>

      {/* Main DataTable */}
      <DataTable
        title="Diretório Societário e Logístico de Unidades"
        subTitle="Consulte ou edite Razão Social, CNPJ, Inscrição Estadual, Endereço Completo, CEP e Gestor Responsável de cada unidade."
        columns={unitColumns}
        data={branches}
        onAddClick={handleOpenNewUnit}
        addButtonLabel="Cadastrar Nova Unidade"
        canEditOrAdd={canEdit}
      />

      {/* ========================================================================= */}
      {/* MODAL 1: FICHA CADASTRAL COMPLETA DA UNIDADE */}
      {/* ========================================================================= */}
      <Dialog
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedUnit && (() => {
          const opSummary = getUnitOperationalSummary(selectedUnit.code);
          const typeCfg = UNIT_TYPE_LABELS[selectedUnit.unitType || 'UNIDADE_OPERACIONAL'];
          return (
            <div>
              <DialogTitle className="bg-slate-900 text-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center font-mono font-extrabold text-base text-white shadow-xs">
                    {selectedUnit.code}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Typography variant="h6" className="font-extrabold text-base sm:text-lg leading-tight">
                        {selectedUnit.name}
                      </Typography>
                      <Chip
                        label={typeCfg.label}
                        color={typeCfg.color}
                        size="small"
                        className="font-bold text-[10px] h-5"
                      />
                      <Chip
                        label={selectedUnit.active ? 'Ativa' : 'Inativa'}
                        color={selectedUnit.active ? 'success' : 'default'}
                        size="small"
                        className="font-bold text-[10px] h-5"
                      />
                    </div>
                    <Typography variant="caption" className="text-slate-300 block mt-0.5">
                      Razão Social: <strong>{selectedUnit.corporateName || selectedUnit.name}</strong>
                    </Typography>
                  </div>
                </div>

                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleCopyBillingData(selectedUnit)}
                  startIcon={<Copy className="w-3.5 h-3.5" />}
                  className="border-slate-600 text-slate-200 hover:bg-slate-800 text-xs font-bold shrink-0"
                >
                  Copiar Dados de Faturamento
                </Button>
              </DialogTitle>

              <DialogContent dividers className="p-5 space-y-5 bg-slate-50/50 dark:bg-slate-950">
                {/* 1. Dados Societários e Fiscais */}
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                  <Typography variant="subtitle2" className="font-extrabold text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                    <FileCheck2 className="w-4 h-4" />
                    1. Dados Societários e Fiscais (Para Emissão de NF-e e Contratos)
                  </Typography>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="sm:col-span-2">
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Razão Social</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {selectedUnit.corporateName || selectedUnit.name}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">CNPJ</span>
                      <span className="font-mono font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                        {selectedUnit.cnpj || 'Não informado'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Inscrição Estadual (IE)</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {selectedUnit.stateRegistration || 'ISENTO'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Inscrição Municipal (IM)</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {selectedUnit.municipalRegistration || 'Não informado'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Abertura / Inauguração</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {selectedUnit.openingDate ? new Date(selectedUnit.openingDate).toLocaleDateString('pt-BR') : '-'}
                      </span>
                    </div>
                    <div className="sm:col-span-3">
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">CNAE Principal / Atividade Econômica</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {selectedUnit.cnae || '5211-7/99 - Depósitos de mercadorias para terceiros, exceto armazéns gerais e guarda-móveis'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Endereço Completo e Logística */}
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                  <Typography variant="subtitle2" className="font-extrabold text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    2. Endereço Completo (Entrega, Coleta e Faturamento)
                  </Typography>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">CEP</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {selectedUnit.zipCode || '-'}
                      </span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Logradouro</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {selectedUnit.street || selectedUnit.address || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Número</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {selectedUnit.number || 'S/N'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Complemento / Doca</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {selectedUnit.complement || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Bairro / Distrito</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {selectedUnit.neighborhood || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Cidade / UF</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {selectedUnit.city} - {selectedUnit.state}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Área de Armazenagem</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {selectedUnit.areaM2 ? `${selectedUnit.areaM2.toLocaleString('pt-BR')} m²` : '-'}
                      </span>
                    </div>
                    {selectedUnit.referencePoint && (
                      <div className="sm:col-span-4">
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">Ponto de Referência / Instruções de Recebimento</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {selectedUnit.referencePoint}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Gestão e Contatos */}
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                  <Typography variant="subtitle2" className="font-extrabold text-xs uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4" />
                    3. Responsável, Contatos e Horário Operacional
                  </Typography>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Gestor Responsável</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {selectedUnit.manager || '-'}
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        {selectedUnit.managerRole || 'Gestor da Unidade'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Telefones de Contato</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                        Fixo: {selectedUnit.phone || '-'}
                      </span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400 block">
                        WhatsApp: {selectedUnit.whatsapp || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">E-mail Corporativo / NF-e</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400 block break-all">
                        {selectedUnit.email || '-'}
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        Horário: {selectedUnit.operatingHours || 'Seg a Sex, 08h às 18h'}
                      </span>
                    </div>
                    {selectedUnit.notes && (
                      <div className="sm:col-span-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">Observações Operacionais e Fiscais</span>
                        <span className="text-slate-700 dark:text-slate-300 italic">
                          {selectedUnit.notes}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Resumo Operacional no ERP */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
                    <span className="text-[10px] font-bold uppercase text-blue-700 dark:text-blue-300 block">Valor em Estoque</span>
                    <span className="text-sm font-extrabold text-blue-900 dark:text-blue-100">
                      R$ {opSummary.totalStockValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-blue-600 block">{opSummary.activeSkus} SKUs ativos</span>
                  </div>
                  <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900">
                    <span className="text-[10px] font-bold uppercase text-purple-700 dark:text-purple-300 block">Patrimônios Alocados</span>
                    <span className="text-sm font-extrabold text-purple-900 dark:text-purple-100">
                      {opSummary.assetsCount} bens
                    </span>
                    <span className="text-[10px] text-purple-600 block">
                      R$ {opSummary.totalAssetsValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
                    <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300 block">Centros de Custo</span>
                    <span className="text-sm font-extrabold text-emerald-900 dark:text-emerald-100">
                      {opSummary.unitCostCenters} setores
                    </span>
                    <span className="text-[10px] text-emerald-600 block">Vinculados à unidade</span>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                    <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300 block">Equipe no ERP</span>
                    <span className="text-sm font-extrabold text-amber-900 dark:text-amber-100">
                      {opSummary.unitUsers} usuário(s)
                    </span>
                    <span className="text-[10px] text-amber-600 block">Lotados na unidade</span>
                  </div>
                </div>
              </DialogContent>

              <DialogActions className="p-4 bg-slate-100 dark:bg-slate-900 flex justify-between">
                {currentUser?.role === 'Master' ? (
                  <Button
                    size="small"
                    variant="outlined"
                    color="primary"
                    onClick={() => {
                      setSelectedBranch(selectedUnit.code);
                      setDetailModalOpen(false);
                      setToastMessage(`Filtro global do sistema alternado para a Unidade ${selectedUnit.code}.`);
                    }}
                    className="font-bold text-xs"
                  >
                    Filtrar ERP por esta Unidade ({selectedUnit.code})
                  </Button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  {canEdit && (
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => {
                        setDetailModalOpen(false);
                        handleOpenEditUnit(selectedUnit);
                      }}
                      startIcon={<Edit3 className="w-4 h-4" />}
                      className="font-bold text-xs"
                    >
                      Editar Cadastro
                    </Button>
                  )}
                  <Button onClick={() => setDetailModalOpen(false)} className="font-bold text-xs">
                    Fechar
                  </Button>
                </div>
              </DialogActions>
            </div>
          );
        })()}
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 2: FORMULÁRIO COMPLETO DE CADASTRO / EDIÇÃO DE UNIDADE */}
      {/* ========================================================================= */}
      <Dialog
        open={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <form onSubmit={handleSaveUnit}>
          <DialogTitle className="font-bold border-b border-slate-200 dark:border-slate-800 pb-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-600 text-white">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <Typography variant="h6" className="font-extrabold text-base leading-tight">
                    {unitForm.id ? `Editar Cadastro da Unidade (${unitForm.code})` : 'Cadastrar Nova Unidade Operacional'}
                  </Typography>
                  <Typography variant="caption" className="text-slate-500">
                    Preencha os dados societários, CNPJ, inscrições fiscais, endereço completo e responsável da unidade.
                  </Typography>
                </div>
              </div>
            </div>

            <Tabs
              value={formTab}
              onChange={(_, v) => setFormTab(v)}
              textColor="primary"
              indicatorColor="primary"
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab label="1. Dados Societários & CNPJ" className="font-bold text-xs" />
              <Tab label="2. Endereço Completo & CEP" className="font-bold text-xs" />
              <Tab label="3. Responsável, Contatos & Operação" className="font-bold text-xs" />
            </Tabs>
          </DialogTitle>

          <DialogContent dividers className="p-5 space-y-4">
            {formError && (
              <Alert severity="error" className="rounded-xl text-xs font-medium">
                {formError}
              </Alert>
            )}

            {/* ABA 0: DADOS SOCIETÁRIOS E FISCAIS */}
            {formTab === 0 && (
              <div className="space-y-4">
                <Alert severity="info" className="rounded-xl text-xs">
                  <strong>Identificação Societária e Fiscal:</strong> Informe a Razão Social, CNPJ e Inscrições Fiscais da unidade para emissão de Ordens de Compra, Notas Fiscais e Contratos.
                </Alert>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  <div className="sm:col-span-3">
                    <TextField
                      fullWidth
                      size="small"
                      label="Sigla / Código *"
                      placeholder="Ex: SP, RJ, MG, PR"
                      value={unitForm.code || ''}
                      onChange={(e) => setUnitForm({ ...unitForm, code: e.target.value.toUpperCase() })}
                      disabled={Boolean(unitForm.id)}
                      required
                      helperText={unitForm.id ? 'Código fixo no ERP' : 'Até 6 letras/números'}
                      slotProps={{ htmlInput: { maxLength: 8 } }}
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <FormControl fullWidth size="small" required>
                      <InputLabel>Tipo de Unidade</InputLabel>
                      <Select
                        value={unitForm.unitType || 'UNIDADE_OPERACIONAL'}
                        onChange={(e) => setUnitForm({ ...unitForm, unitType: e.target.value as UnitType })}
                        label="Tipo de Unidade"
                      >
                        <MenuItem value="MATRIZ">Matriz Corporativa</MenuItem>
                        <MenuItem value="UNIDADE_OPERACIONAL">Unidade Operacional</MenuItem>
                        <MenuItem value="CENTRO_DISTRIBUICAO">Centro de Distribuição (CD)</MenuItem>
                        <MenuItem value="ADMINISTRATIVA">Unidade Administrativa</MenuItem>
                        <MenuItem value="OBRA_PROJETO">Obra / Projeto Especial</MenuItem>
                      </Select>
                    </FormControl>
                  </div>

                  <div className="sm:col-span-5">
                    <TextField
                      fullWidth
                      size="small"
                      label="Nome Fantasia / Nome da Unidade *"
                      placeholder="Ex: Unidade Belo Horizonte"
                      value={unitForm.name || ''}
                      onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="sm:col-span-12">
                    <TextField
                      fullWidth
                      size="small"
                      label="Razão Social Completa *"
                      placeholder="Ex: Almox Plus Tecnologia e Logística S.A. - Unidade MG"
                      value={unitForm.corporateName || ''}
                      onChange={(e) => setUnitForm({ ...unitForm, corporateName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <TextField
                      fullWidth
                      size="small"
                      label="CNPJ da Unidade *"
                      placeholder="00.000.000/0001-00"
                      value={unitForm.cnpj || ''}
                      onChange={(e) => setUnitForm({ ...unitForm, cnpj: formatCnpj(e.target.value) })}
                      required
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <TextField
                      fullWidth
                      size="small"
                      label="Inscrição Estadual (IE)"
                      placeholder="Ex: 110.042.490.114 ou ISENTO"
                      value={unitForm.stateRegistration || ''}
                      onChange={(e) => setUnitForm({ ...unitForm, stateRegistration: e.target.value })}
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <TextField
                      fullWidth
                      size="small"
                      label="Inscrição Municipal (IM)"
                      placeholder="Ex: 4.521.890-2"
                      value={unitForm.municipalRegistration || ''}
                      onChange={(e) => setUnitForm({ ...unitForm, municipalRegistration: e.target.value })}
                    />
                  </div>

                  <div className="sm:col-span-8">
                    <TextField
                      fullWidth
                      size="small"
                      label="CNAE Principal / Ramo de Atividade"
                      placeholder="Ex: 5211-7/99 - Depósitos de mercadorias para terceiros"
                      value={unitForm.cnae || ''}
                      onChange={(e) => setUnitForm({ ...unitForm, cnae: e.target.value })}
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <TextField
                      fullWidth
                      size="small"
                      type="date"
                      label="Data de Abertura / Inauguração"
                      slotProps={{ inputLabel: { shrink: true } }}
                      value={unitForm.openingDate || ''}
                      onChange={(e) => setUnitForm({ ...unitForm, openingDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ABA 1: ENDEREÇO COMPLETO E LOCALIZAÇÃO */}
            {formTab === 1 && (
              <div className="space-y-4">
                <Alert severity="info" className="rounded-xl text-xs">
                  <strong>Endereço Logístico Completo:</strong> Digite o CEP e clique em <em>"Buscar CEP"</em> para preenchimento automático, ou informe manualmente o endereço completo de entrega e faturamento.
                </Alert>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
                  <div className="sm:col-span-4 flex gap-2">
                    <TextField
                      fullWidth
                      size="small"
                      label="CEP *"
                      placeholder="00000-000"
                      value={unitForm.zipCode || ''}
                      onChange={(e) => setUnitForm({ ...unitForm, zipCode: formatCep(e.target.value) })}
                    />
                    <Button
                      variant="outlined"
                      onClick={handleLookupCep}
                      disabled={loadingCep}
                      className="shrink-0 font-bold text-xs px-3 h-[40px]"
                      startIcon={loadingCep ? <CircularProgress size={14} /> : <Search className="w-3.5 h-3.5" />}
                    >
                      Buscar CEP
                    </Button>
                  </div>

                  <div className="sm:col-span-6">
                    <TextField
                      fullWidth
                      size="small"
                      label="Logradouro (Rua, Avenida, Rodovia) *"
                      placeholder="Ex: Av. Paulista / Rodovia Washington Luís"
                      value={unitForm.street || ''}
                      onChange={(e) => setUnitForm({ ...unitForm, street: e.target.value })}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <TextField
                      fullWidth
                      size="small"
                      label="Número *"
                      placeholder="Ex: 1578"
                      value={unitForm.number || ''}
                      onChange={(e) => setUnitForm({ ...unitForm, number: e.target.value })}
                    />
                  </div>

                  <div className="sm:col-span-5">
                    <TextField
                      fullWidth
                      size="small"
                      label="Complemento (Galpão, Bloco, Doca, Sala)"
                      placeholder="Ex: Galpão Logístico 04 - Docas 1 a 6"
                      value={unitForm.complement || ''}
                      onChange={(e) => setUnitForm({ ...unitForm, complement: e.target.value })}
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <TextField
                      fullWidth
                      size="small"
                      label="Bairro / Distrito Industrial *"
                      placeholder="Ex: Distrito Industrial / Centro"
                      value={unitForm.neighborhood || ''}
                      onChange={(e) => setUnitForm({ ...unitForm, neighborhood: e.target.value })}
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Área Física (m²)"
                      placeholder="Ex: 2500"
                      value={unitForm.areaM2 || ''}
                      onChange={(e) => setUnitForm({ ...unitForm, areaM2: Number(e.target.value) })}
                    />
                  </div>

                  <div className="sm:col-span-8">
                    <TextField
                      fullWidth
                      size="small"
                      label="Cidade / Município *"
                      placeholder="Ex: São Paulo, Belo Horizonte, Curitiba"
                      value={unitForm.city || ''}
                      onChange={(e) => setUnitForm({ ...unitForm, city: e.target.value })}
                      required
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <FormControl fullWidth size="small" required>
                      <InputLabel>Estado (UF) *</InputLabel>
                      <Select
                        value={unitForm.state || 'SP'}
                        onChange={(e) => setUnitForm({ ...unitForm, state: e.target.value })}
                        label="Estado (UF) *"
                      >
                        {BRAZIL_STATES.map(uf => (
                          <MenuItem key={uf} value={uf}>{uf}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </div>

                  <div className="sm:col-span-12">
                    <TextField
                      fullWidth
                      size="small"
                      label="Ponto de Referência / Instruções para Recebimento de Mercadorias"
                      placeholder="Ex: Entrada de caminhões pela portaria 2; recebimento mediante agendamento prévio."
                      value={unitForm.referencePoint || ''}
                      onChange={(e) => setUnitForm({ ...unitForm, referencePoint: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ABA 2: RESPONSÁVEL, CONTATOS E OPERAÇÃO */}
            {formTab === 2 && (
              <div className="space-y-4">
                <Alert severity="info" className="rounded-xl text-xs">
                  <strong>Gestão Local e Contatos:</strong> Defina o gestor responsável pela unidade, contatos telefônicos e e-mail para recebimento de alertas e documentos fiscais.
                </Alert>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  <div className="sm:col-span-6">
                    <TextField
                      fullWidth
                      size="small"
                      label="Nome do Gestor / Responsável pela Unidade"
                      placeholder="Ex: Carlos Eduardo Fontoura"
                      value={unitForm.manager || ''}
                      onChange={(e) => setUnitForm({ ...unitForm, manager: e.target.value })}
                    />
                  </div>

                  <div className="sm:col-span-6">
                    <TextField
                      fullWidth
                      size="small"
                      label="Cargo / Função do Responsável"
                      placeholder="Ex: Gerente Geral de Operações"
                      value={unitForm.managerRole || ''}
                      onChange={(e) => setUnitForm({ ...unitForm, managerRole: e.target.value })}
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <TextField
                      fullWidth
                      size="small"
                      label="Telefone Fixo / PABX"
                      placeholder="(11) 3280-4000"
                      value={unitForm.phone || ''}
                      onChange={(e) => setUnitForm({ ...unitForm, phone: formatPhone(e.target.value) })}
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <TextField
                      fullWidth
                      size="small"
                      label="Celular / WhatsApp Corporativo"
                      placeholder="(11) 99812-4000"
                      value={unitForm.whatsapp || ''}
                      onChange={(e) => setUnitForm({ ...unitForm, whatsapp: formatPhone(e.target.value) })}
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <TextField
                      fullWidth
                      size="small"
                      type="email"
                      label="E-mail da Unidade / NF-e"
                      placeholder="unidade.sp@almoxplus.com.br"
                      value={unitForm.email || ''}
                      onChange={(e) => setUnitForm({ ...unitForm, email: e.target.value })}
                    />
                  </div>

                  <div className="sm:col-span-12">
                    <TextField
                      fullWidth
                      size="small"
                      label="Horário de Funcionamento e Recebimento de Cargas"
                      placeholder="Ex: Seg a Sex, 07:00 às 19:00 | Sáb, 08:00 às 12:00"
                      value={unitForm.operatingHours || ''}
                      onChange={(e) => setUnitForm({ ...unitForm, operatingHours: e.target.value })}
                    />
                  </div>

                  <div className="sm:col-span-12">
                    <TextField
                      fullWidth
                      size="small"
                      multiline
                      rows={2}
                      label="Observações Fiscais, Societárias ou Operacionais"
                      placeholder="Ex: Unidade habilitada para importação e armazenagem de EPIs e instrumentação."
                      value={unitForm.notes || ''}
                      onChange={(e) => setUnitForm({ ...unitForm, notes: e.target.value })}
                    />
                  </div>

                  <div className="sm:col-span-12">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={unitForm.active ?? true}
                          onChange={(e) => setUnitForm({ ...unitForm, active: e.target.checked })}
                          color="success"
                        />
                      }
                      label={
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Unidade ativa no sistema (habilitada para estoque, compras, transferências, inventário e centros de custo)
                        </span>
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </DialogContent>

          <DialogActions className="p-4 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {formTab > 0 && (
                <Button size="small" onClick={() => setFormTab(formTab - 1)} className="text-xs font-bold">
                  ← Etapa Anterior
                </Button>
              )}
              {formTab < 2 && (
                <Button size="small" variant="outlined" onClick={() => setFormTab(formTab + 1)} className="text-xs font-bold">
                  Próxima Etapa →
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={() => setFormModalOpen(false)}>Cancelar</Button>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                startIcon={<CheckCircle2 className="w-4 h-4" />}
                className="font-bold text-xs px-4"
              >
                {unitForm.id ? 'Salvar Alterações da Unidade' : 'Concluir Cadastro da Unidade'}
              </Button>
            </div>
          </DialogActions>
        </form>
      </Dialog>

      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={4500}
        onClose={() => setToastMessage(null)}
        message={toastMessage}
      />
    </Box>
  );
};
