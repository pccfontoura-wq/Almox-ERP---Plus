import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, TextField, Button,
  Switch, FormControlLabel, Alert, Divider, Chip,
  Radio, RadioGroup, FormControl, FormLabel,
  InputAdornment, MenuItem, Select, InputLabel, Tooltip
} from '@mui/material';
import {
  Save, ShieldCheck, AlertTriangle, Lock, FileText, CheckCircle2,
  Building, Sliders, Bell, Mail, ShieldAlert, Sparkles, Scale, Info
} from 'lucide-react';

import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { Breadcrumb } from '../components/Breadcrumb';
import {
  CostCenterBudgetPolicy, BudgetOverrunPolicyMode,
  BudgetCalculationBasis, UserRole
} from '../types';

export const Configuracoes: React.FC = () => {
  const { currentUser } = useAuth();

  const settings = dataService.getSettings();
  const currentPolicy = dataService.getBudgetPolicy();

  // Dados da Organização
  const [companyName, setCompanyName] = useState(settings.companyName || 'Almox Plus Tecnologia e Logística S.A.');
  const [cnpj, setCnpj] = useState(settings.cnpj || '10.987.654/0001-32');

  // Parâmetros de Estoque
  const [allowNegativeStock, setAllowNegativeStock] = useState(settings.allowNegativeStock || false);
  const [enableAutoPO, setEnableAutoPO] = useState(settings.enableAutoPO || false);
  const [enableEmailAlerts, setEnableEmailAlerts] = useState(settings.enableEmailAlerts ?? true);
  const [autoApproveRequisitionsBelow, setAutoApproveRequisitionsBelow] = useState(settings.autoApproveRequisitionsBelow || 500);

  // SMTP
  const [smtpServer, setSmtpServer] = useState(settings.smtpServer || 'smtp.office365.com');
  const [smtpPort, setSmtpPort] = useState(settings.smtpPort || '587');

  // GOVERNANÇA ORÇAMENTÁRIA (POLÍTICA DE ESTOURO DE CENTRO DE CUSTO)
  const [policyMode, setPolicyMode] = useState<BudgetOverrunPolicyMode>(currentPolicy.mode || 'ALCADA_DIRETORIA_MASTER');
  const [calculationBasis, setCalculationBasis] = useState<BudgetCalculationBasis>(currentPolicy.calculationBasis || 'COMPROMETIDO');
  const [tolerancePercentage, setTolerancePercentage] = useState<number>(currentPolicy.tolerancePercentage || 0);
  const [requireJustification, setRequireJustification] = useState<boolean>(currentPolicy.requireJustification ?? true);
  const [allowedApproverRoles, setAllowedApproverRoles] = useState<string>(
    currentPolicy.allowedApproverRoles?.includes('Gestor') ? 'MASTER_AND_GESTOR' : 'MASTER_ONLY'
  );
  const [notifyFinanceOnOverrun, setNotifyFinanceOnOverrun] = useState<boolean>(currentPolicy.notifyFinanceOnOverrun ?? true);
  const [preventRequisitionExceeding, setPreventRequisitionExceeding] = useState<boolean>(currentPolicy.preventRequisitionExceeding ?? true);
  const [changeReason, setChangeReason] = useState<string>('');

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isMasterOrAdmin = currentUser?.role === 'Master';
  const canEdit = currentUser && currentUser.role !== 'Visitante';

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setErrorMessage(null);

    try {
      // 1. Atualizar Parâmetros Globais
      dataService.updateSettings({
        companyName,
        cnpj,
        enableAutoPO,
        enableEmailAlerts,
        autoApproveRequisitionsBelow: Number(autoApproveRequisitionsBelow),
        smtpServer,
        smtpPort
      }, currentUser);

      // 2. Atualizar Política Orçamentária
      const targetRoles: UserRole[] = allowedApproverRoles === 'MASTER_AND_GESTOR'
        ? ['Master', 'Gestor']
        : ['Master'];

      dataService.updateBudgetPolicy({
        mode: policyMode,
        calculationBasis,
        tolerancePercentage: Number(tolerancePercentage),
        requireJustification,
        allowedApproverRoles: targetRoles,
        notifyFinanceOnOverrun,
        preventRequisitionExceeding,
        changeReason: changeReason.trim() || 'Ajuste de parâmetros de governança orçamentária no painel administrativo.'
      }, currentUser, changeReason);

      setSavedSuccess(true);
      setChangeReason('');
      setTimeout(() => setSavedSuccess(false), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao salvar configurações.');
    }
  };

  return (
    <Box className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Breadcrumb items={[{ label: 'Configurações Globais & Governança Orçamentária' }]} />
        <div className="flex items-center gap-2">
          <Chip
            icon={<ShieldCheck className="w-3.5 h-3.5 text-blue-600" />}
            label={`Política Vigente: ${
              policyMode === 'ALCADA_DIRETORIA_MASTER'
                ? 'Opção 3 (Alçada da Diretoria)'
                : policyMode === 'BLOQUEIO_RIGIDO'
                ? 'Opção 1 (Bloqueio Rígido)'
                : policyMode === 'INFORMATIVO_AVISO'
                ? 'Opção 2 (Apenas Aviso)'
                : 'Opção 4 (Tolerância Margem)'
            }`}
            color="primary"
            variant="outlined"
            className="font-bold text-xs bg-blue-50/70 dark:bg-blue-950/40"
          />
        </div>
      </div>

      {savedSuccess && (
        <Alert severity="success" className="rounded-xl shadow-sm">
          <strong>Sucesso!</strong> As configurações e a política de governança orçamentária foram salvas e já estão ativas em todo o ERP.
        </Alert>
      )}

      {errorMessage && (
        <Alert severity="error" className="rounded-xl shadow-sm">
          {errorMessage}
        </Alert>
      )}

      <form onSubmit={handleSaveAll} className="space-y-6">
        {/* ========================================================= */}
        {/* SEÇÃO PRINCIPAL: GOVERNANÇA ORÇAMENTÁRIA & ESTOURO DE CC */}
        {/* ========================================================= */}
        <Card className="rounded-2xl border border-blue-200 dark:border-blue-900 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-900 p-5 text-white">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-md">
                  <Scale className="w-6 h-6 text-white" />
                </div>
                <div>
                  <Typography variant="h6" className="font-extrabold text-base sm:text-lg">
                    Regra Corporativa de Estouro de Centro de Custo & Compras
                  </Typography>
                  <Typography variant="caption" className="text-blue-100 block text-xs">
                    Defina o comportamento do sistema quando um setor solicitar ou comprar além do valor orçado/provisionado.
                  </Typography>
                </div>
              </div>
              <Chip
                label="Painel de Controle da Diretoria"
                size="small"
                className="bg-white/20 text-white font-bold text-xs"
              />
            </div>
          </div>

          <div className="p-6 space-y-6 bg-white dark:bg-slate-900">
            {/* Explicação de Diretoria e Alternativas */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Como funciona para a Diretoria:</strong> Você pode alterar a regra a qualquer momento sem necessidade de nova programação.
                Atualmente, a regra ativa é a <strong>Opção 3 (Alçada da Diretoria / Master)</strong>, que impede compras irregulares sem aprovação formal, mantendo a operação flexível em caso de emergências justificadas.
              </div>
            </div>

            {/* SELEÇÃO DO MODO DA POLÍTICA (OPÇÕES 1, 2, 3, 4) */}
            <div>
              <Typography variant="subtitle2" className="font-bold text-slate-900 dark:text-slate-100 mb-3 text-sm">
                1. Selecione a Política de Ação em caso de Estouro Orçamentário:
              </Typography>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* OPÇÃO 3 (PADRÃO / RECOMENDADA) */}
                <div
                  onClick={() => isMasterOrAdmin && setPolicyMode('ALCADA_DIRETORIA_MASTER')}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative ${
                    policyMode === 'ALCADA_DIRETORIA_MASTER'
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Radio
                        checked={policyMode === 'ALCADA_DIRETORIA_MASTER'}
                        value="ALCADA_DIRETORIA_MASTER"
                        name="policyModeRadio"
                        size="small"
                      />
                      <span className="font-extrabold text-blue-900 dark:text-blue-300 text-sm">
                        Opção 3: Alçada Extraordinária (Diretoria / Master)
                      </span>
                    </div>
                    <Chip label="Ativa / Recomendada" color="primary" size="small" className="font-bold text-[10px]" />
                  </div>
                  <Typography variant="body2" className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-7">
                    O pedido <strong>NÃO é descartado</strong>, mas entra em <strong>retenção orçamentária preventiva</strong>. Fica com aviso em destaque e somente o Usuário Master / Diretoria tem alçada para aprovar mediante justificativa formal.
                  </Typography>
                </div>

                {/* OPÇÃO 1 (BLOQUEIO RÍGIDO) */}
                <div
                  onClick={() => isMasterOrAdmin && setPolicyMode('BLOQUEIO_RIGIDO')}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative ${
                    policyMode === 'BLOQUEIO_RIGIDO'
                      ? 'border-rose-600 bg-rose-50/70 dark:bg-rose-950/40 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Radio
                        checked={policyMode === 'BLOQUEIO_RIGIDO'}
                        value="BLOQUEIO_RIGIDO"
                        name="policyModeRadio"
                        size="small"
                      />
                      <span className="font-extrabold text-rose-900 dark:text-rose-300 text-sm">
                        Opção 1: Bloqueio Rígido Total (Hard Stop)
                      </span>
                    </div>
                    <Chip label="Teto Inviolável" color="error" size="small" className="font-bold text-[10px]" />
                  </div>
                  <Typography variant="body2" className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-7">
                    Trava imediata do ERP. Nenhuma solicitação ou ordem de compra é emitida se o valor exceder a dotação provisionada do Centro de Custo. Exige suplementação prévia de verba.
                  </Typography>
                </div>

                {/* OPÇÃO 2 (INFORMATIVO) */}
                <div
                  onClick={() => isMasterOrAdmin && setPolicyMode('INFORMATIVO_AVISO')}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative ${
                    policyMode === 'INFORMATIVO_AVISO'
                      ? 'border-amber-600 bg-amber-50/70 dark:bg-amber-950/40 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Radio
                        checked={policyMode === 'INFORMATIVO_AVISO'}
                        value="INFORMATIVO_AVISO"
                        name="policyModeRadio"
                        size="small"
                      />
                      <span className="font-extrabold text-amber-900 dark:text-amber-300 text-sm">
                        Opção 2: Informativo com Alerta (Apenas Aviso)
                      </span>
                    </div>
                    <Chip label="Operação Livre" color="warning" size="small" className="font-bold text-[10px]" />
                  </div>
                  <Typography variant="body2" className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-7">
                    Exibe alertas visuais e registra no log de auditoria que o setor ultrapassou o orçamento, mas <strong>não bloqueia</strong> a criação ou aprovação das compras.
                  </Typography>
                </div>

                {/* OPÇÃO 4 (TOLERÂNCIA PERCENTUAL) */}
                <div
                  onClick={() => isMasterOrAdmin && setPolicyMode('TOLERANCIA_PERCENTUAL')}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative ${
                    policyMode === 'TOLERANCIA_PERCENTUAL'
                      ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/40 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Radio
                        checked={policyMode === 'TOLERANCIA_PERCENTUAL'}
                        value="TOLERANCIA_PERCENTUAL"
                        name="policyModeRadio"
                        size="small"
                      />
                      <span className="font-extrabold text-teal-900 dark:text-teal-300 text-sm">
                        Opção 4: Tolerância Percentual (Buffer Parametrizado)
                      </span>
                    </div>
                    <Chip label="Margem Flexível" color="info" size="small" className="font-bold text-[10px]" />
                  </div>
                  <Typography variant="body2" className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-7">
                    Permite uma margem percentual configurável de tolerância acima do orçamento. Acima dessa margem, aplica o bloqueio condicional com alçada da Diretoria.
                  </Typography>
                </div>
              </div>
            </div>

            <Divider />

            {/* PARÂMETROS COMPLEMENTARES DA POLÍTICA */}
            <div className="space-y-4">
              <Typography variant="subtitle2" className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                2. Parâmetros Detalhados da Regra Orçamentária:
              </Typography>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* BASE DE CÁLCULO */}
                <div>
                  <FormControl fullWidth size="small">
                    <InputLabel id="calc-basis-label">Base de Avaliação do Limite</InputLabel>
                    <Select
                      labelId="calc-basis-label"
                      label="Base de Avaliação do Limite"
                      value={calculationBasis}
                      onChange={(e) => setCalculationBasis(e.target.value as BudgetCalculationBasis)}
                      disabled={!isMasterOrAdmin}
                    >
                      <MenuItem value="COMPROMETIDO">
                        Comprometido (OCs Emitidas + Em Trânsito)
                      </MenuItem>
                      <MenuItem value="CONSUMO_REAL">
                        Consumo Efetivo (Baixas do Almoxarifado)
                      </MenuItem>
                      <MenuItem value="AMBOS">
                        Mais Restritivo (Comprometido ou Consumo)
                      </MenuItem>
                    </Select>
                  </FormControl>
                  <Typography variant="caption" className="text-slate-500 text-[11px] block mt-1">
                    Recomendado: Comprometido para proteger o caixa antes do pedido ser emitido.
                  </Typography>
                </div>

                {/* MARGEM DE TOLERÂNCIA */}
                <div>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Margem de Tolerância Aceitável (%)"
                    value={tolerancePercentage}
                    onChange={(e) => setTolerancePercentage(Math.max(0, Math.min(50, Number(e.target.value))))}
                    slotProps={{
                      input: {
                        endAdornment: <InputAdornment position="end">%</InputAdornment>
                      }
                    }}
                    disabled={!isMasterOrAdmin}
                  />
                  <Typography variant="caption" className="text-slate-500 text-[11px] block mt-1">
                    0% significa teto exato. Ex: 5% aceita até R$ 105.000 para orçamento de R$ 100.000.
                  </Typography>
                </div>

                {/* ALÇADA MÍNIMA */}
                <div>
                  <FormControl fullWidth size="small">
                    <InputLabel id="approver-role-label">Alçada Mínima de Liberação</InputLabel>
                    <Select
                      labelId="approver-role-label"
                      label="Alçada Mínima de Liberação"
                      value={allowedApproverRoles}
                      onChange={(e) => setAllowedApproverRoles(e.target.value)}
                      disabled={!isMasterOrAdmin}
                    >
                      <MenuItem value="MASTER_ONLY">
                        Somente Usuário Master / Diretoria Executiva
                      </MenuItem>
                      <MenuItem value="MASTER_AND_GESTOR">
                        Usuário Master e Coordenadores de Área (Gestores)
                      </MenuItem>
                    </Select>
                  </FormControl>
                  <Typography variant="caption" className="text-slate-500 text-[11px] block mt-1">
                    Define quem tem a chave de liberação extraordinária.
                  </Typography>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <FormControlLabel
                    control={
                      <Switch
                        checked={requireJustification}
                        onChange={(e) => setRequireJustification(e.target.checked)}
                        disabled={!isMasterOrAdmin}
                        color="primary"
                      />
                    }
                    label={
                      <div>
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">
                          Exigir Justificativa Formal da Diretoria na Liberação
                        </span>
                        <span className="text-[11px] text-slate-500 block">
                          Obriga o preenchimento do motivo no ato da aprovação para fins de auditoria e compliance.
                        </span>
                      </div>
                    }
                  />
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notifyFinanceOnOverrun}
                        onChange={(e) => setNotifyFinanceOnOverrun(e.target.checked)}
                        disabled={!isMasterOrAdmin}
                        color="primary"
                      />
                    }
                    label={
                      <div>
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">
                          Notificação Automática do Setor Financeiro / Diretoria
                        </span>
                        <span className="text-[11px] text-slate-500 block">
                          Dispara alertas no sino do ERP e avisos para gestores da matriz quando houver estouro.
                        </span>
                      </div>
                    }
                  />
                </div>
              </div>

              {/* MOTIVO DA ALTERAÇÃO (GOVERNANÇA AUDITÁVEL) */}
              <div className="pt-2">
                <TextField
                  fullWidth
                  size="small"
                  label="Motivo / Ata de Deliberação da Alteração da Regra (Auditável)"
                  placeholder="Ex: Deliberação da diretoria em 15/10/2026 - Ativação da Opção 3 com retenção preventiva e alçada extraordinária."
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  disabled={!isMasterOrAdmin}
                  helperText="Este motivo será registrado permanentemente no histórico de auditoria do sistema."
                />
              </div>

              {/* HISTÓRICO DE AUDITORIA DA POLÍTICA */}
              {currentPolicy.updatedAt && (
                <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-900 text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <strong>Última revisão da regra:</strong> {new Date(currentPolicy.updatedAt).toLocaleString('pt-BR')} por <strong>{currentPolicy.updatedBy || 'Administrador Master'}</strong>
                  </div>
                  {currentPolicy.changeReason && (
                    <div className="italic text-slate-500">
                      "{currentPolicy.changeReason}"
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* ========================================================= */}
        {/* SEÇÃO 2: DADOS DA ORGANIZAÇÃO */}
        {/* ========================================================= */}
        <Card className="rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-base">
            <Building className="w-5 h-5 text-blue-600" />
            Dados Cadastrais da Organização
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <TextField
                fullWidth
                size="small"
                label="Razão Social Corporativa"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={!isMasterOrAdmin}
              />
            </div>
            <div>
              <TextField
                fullWidth
                size="small"
                label="CNPJ Matriz"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                disabled={!isMasterOrAdmin}
              />
            </div>
          </div>
        </Card>

        {/* ========================================================= */}
        {/* SEÇÃO 3: PARÂMETROS OPERACIONAIS DE ESTOQUE E COMPRAS */}
        {/* ========================================================= */}
        <Card className="rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-base">
            <Sliders className="w-5 h-5 text-indigo-600" />
            Parâmetros Operacionais de Almoxarifado e Suprimentos
          </div>

          <div className="space-y-4">
            <FormControlLabel
              control={
                <Switch
                  checked={allowNegativeStock}
                  onChange={(e) => setAllowNegativeStock(e.target.checked)}
                  disabled // Trava rígida
                />
              }
              label={
                <div>
                  <Typography variant="subtitle2" className="font-bold text-xs">
                    Permitir Saldo de Estoque Negativo
                  </Typography>
                  <Typography variant="caption" className="text-rose-600 dark:text-rose-400 text-[11px] block">
                    🔒 Trava de Segurança Corporativa Ativa: Não é permitido estoque negativo no Almox Plus.
                  </Typography>
                </div>
              }
            />

            <Divider />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FormControlLabel
                  control={
                    <Switch
                      checked={enableAutoPO}
                      onChange={(e) => setEnableAutoPO(e.target.checked)}
                      disabled={!isMasterOrAdmin}
                    />
                  }
                  label={
                    <div>
                      <Typography variant="subtitle2" className="font-bold text-xs">
                        Minuta Automática de Compra ao Atingir Estoque Mínimo
                      </Typography>
                      <Typography variant="caption" className="text-slate-500 text-[11px] block">
                        Gera minuta de pedido para análise do comprador.
                      </Typography>
                    </div>
                  }
                />
              </div>

              <div>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Aprovação Automática de Requisições até (R$)"
                  value={autoApproveRequisitionsBelow}
                  onChange={(e) => setAutoApproveRequisitionsBelow(Number(e.target.value))}
                  disabled={!isMasterOrAdmin}
                  helperText="Requisições internas de almoxarifado abaixo deste valor são pré-aprovadas."
                />
              </div>
            </div>
          </div>
        </Card>

        {/* ========================================================= */}
        {/* SEÇÃO 4: CONFIGURAÇÃO SMTP (E-MAIL) */}
        {/* ========================================================= */}
        <Card className="rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-base">
            <Mail className="w-5 h-5 text-amber-600" />
            Servidor de Notificações por E-mail (SMTP Corporativo)
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <TextField
                fullWidth
                size="small"
                label="Servidor SMTP Host"
                value={smtpServer}
                onChange={(e) => setSmtpServer(e.target.value)}
                disabled={!isMasterOrAdmin}
              />
            </div>
            <div>
              <TextField
                fullWidth
                size="small"
                label="Porta SMTP"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                disabled={!isMasterOrAdmin}
              />
            </div>
          </div>
        </Card>

        {/* BOTÃO DE SALVAR */}
        <Box className="flex justify-between items-center flex-wrap gap-4 pt-2">
          <Typography variant="caption" className="text-slate-500 text-xs">
            {isMasterOrAdmin
              ? 'Alterações efetuadas neste painel impactam imediatamente as validações de compras e centros de custo em todas as unidades.'
              : 'Visualização somente leitura. Apenas administradores Master possuem permissão de alteração.'}
          </Typography>

          <Button
            type="submit"
            variant="contained"
            color="primary"
            startIcon={<Save className="w-4 h-4" />}
            disabled={!isMasterOrAdmin}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-7 rounded-xl shadow-md"
          >
            Salvar e Aplicar Política de Governança
          </Button>
        </Box>
      </form>
    </Box>
  );
};
