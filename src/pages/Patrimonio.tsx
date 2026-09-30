import React, { useState } from 'react';
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Select, FormControl, InputLabel, Alert, Chip,
  Table, TableBody, TableCell, TableHead, TableRow, Tooltip, IconButton, Divider
} from '@mui/material';
import { History, RotateCcw, ShieldCheck, UserCheck, AlertTriangle, FileText, CheckCircle2, Clock } from 'lucide-react';

import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Breadcrumb } from '../components/Breadcrumb';
import { DataTable, Column } from '../components/DataTable';
import { Asset, AssetStatus, Branch } from '../types';

export const Patrimonio: React.FC = () => {
  const { currentUser } = useAuth();
  const { selectedBranch, refreshData } = useApp();

  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [editingAsset, setEditingAsset] = useState<Partial<Asset> | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Return asset modal state
  const [returnCondition, setReturnCondition] = useState('Perfeito Estado de Conservação');
  const [returnNotes, setReturnNotes] = useState('');
  const [sendToMaintenance, setSendToMaintenance] = useState(false);

  const state = dataService.getState();
  const assets = state.assets.filter(a => selectedBranch === 'GLOBAL' || a.branch === selectedBranch);
  const canEdit = currentUser?.role !== 'Visitante';

  const assetColumns: Column<Asset>[] = [
    { id: 'assetTag', label: 'Tombamento (Nº Pat.)', accessor: (a) => a.assetTag, sortable: true },
    { id: 'name', label: 'Descrição do Bem', accessor: (a) => a.name, sortable: true },
    { id: 'category', label: 'Categoria', accessor: (a) => a.category },
    { id: 'branch', label: 'Unidade', accessor: (a) => a.branch },
    { id: 'location', label: 'Localização Física', accessor: (a) => a.location },
    { id: 'value', label: 'Valor do Bem', accessor: (a) => `R$ ${a.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, sortable: true },
    {
      id: 'status',
      label: 'Status do Patrimônio',
      accessor: (a) => a.status === 'EM_USO' ? 'Em Uso / Disponível' : a.status === 'EMPRESTADO' ? 'Emprestado' : a.status === 'EM_MANUTENCAO' ? 'Manutenção' : 'Baixado',
      render: (a) => (
        <Chip
          label={a.status === 'EM_USO' ? 'Disponível / Em Uso' : a.status === 'EMPRESTADO' ? 'Emprestado' : a.status === 'EM_MANUTENCAO' ? 'Manutenção' : 'Baixado'}
          color={a.status === 'EM_USO' ? 'success' : a.status === 'EMPRESTADO' ? 'warning' : a.status === 'EM_MANUTENCAO' ? 'info' : 'error'}
          size="small"
          className="font-bold text-[10px] h-5"
        />
      )
    },
    {
      id: 'borrowedTo',
      label: 'Utilizador Atual (Custódia)',
      accessor: (a) => a.borrowedTo || 'Almoxarifado',
      render: (a) => (
        a.borrowedTo ? (
          <div className="flex flex-col">
            <span className="font-bold text-amber-700 dark:text-amber-400 text-xs flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" />
              {a.borrowedTo}
            </span>
            {a.borrowedToDepartment && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {a.borrowedToDepartment}
              </span>
            )}
            {a.expectedReturnDate && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Prev. Devolução: {new Date(a.expectedReturnDate).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Almoxarifado Local</span>
        )
      )
    },
    {
      id: 'previousBorrower',
      label: 'Último Utilizador (Rastreabilidade)',
      accessor: (a) => a.previousBorrower || 'Sem registro anterior',
      render: (a) => (
        a.previousBorrower ? (
          <div className="flex flex-col bg-slate-50 dark:bg-slate-800/80 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              {a.previousBorrower}
            </span>
            {a.previousBorrowerDepartment && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {a.previousBorrowerDepartment}
              </span>
            )}
            {a.lastReturnedDate && (
              <span className="text-[10px] text-blue-700 dark:text-blue-300 font-medium mt-0.5">
                Devolvido em {new Date(a.lastReturnedDate).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-400 italic">Sem histórico anterior</span>
        )
      )
    },
    {
      id: 'actions',
      label: 'Ações & Rastreio',
      accessor: (a) => a.id,
      exportable: false,
      render: (a) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          {canEdit && a.status === 'EMPRESTADO' && (
            <Tooltip title="Registrar devolução e arquivar utilizador para rastreabilidade">
              <Button
                size="small"
                variant="contained"
                color="success"
                onClick={() => {
                  setSelectedAsset(a);
                  setReturnCondition('Perfeito Estado de Conservação');
                  setReturnNotes('');
                  setSendToMaintenance(false);
                  setReturnModalOpen(true);
                }}
                className="text-[11px] py-0.5 px-2 bg-emerald-600 hover:bg-emerald-700 !text-white font-bold"
                startIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Devolver
              </Button>
            </Tooltip>
          )}

          {canEdit && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                setEditingAsset(a);
                setAssetModalOpen(true);
              }}
              className="text-[11px] py-0.5 px-2"
            >
              Editar
            </Button>
          )}

          <Tooltip title="Ver Histórico Completo de Custódia e Utilizadores">
            <IconButton
              size="small"
              onClick={() => {
                setSelectedAsset(a);
                setHistoryModalOpen(true);
              }}
              className="text-slate-600 hover:text-blue-600 dark:text-slate-300"
            >
              <History className="w-4 h-4" />
            </IconButton>
          </Tooltip>
        </div>
      )
    }
  ];

  const handleSaveAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setFormError(null);

    try {
      dataService.saveAsset(editingAsset || {}, currentUser);
      setAssetModalOpen(false);
      refreshData();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const handleConfirmReturn = () => {
    if (!selectedAsset || !currentUser) return;
    try {
      dataService.returnAsset(
        selectedAsset.id,
        returnCondition,
        returnNotes,
        sendToMaintenance,
        currentUser
      );
      setReturnModalOpen(false);
      refreshData();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  return (
    <Box className="space-y-6">
      <Breadcrumb items={[{ label: 'Gestão de Patrimônio, Tombamento e Rastreabilidade' }]} />

      <DataTable
        title="Cadastro de Patrimônio e Rastreabilidade de Custódia"
        subTitle="Controle de tombamento, empréstimos, histórico e rastreamento do último utilizador em caso de avarias ou manutenções."
        columns={assetColumns}
        data={assets}
        onAddClick={() => {
          setEditingAsset({
            assetTag: `PAT-${selectedBranch === 'GLOBAL' ? 'SP' : selectedBranch}-${Math.floor(1000 + Math.random() * 9000)}`,
            name: '',
            category: 'Instrumentação & Medição',
            branch: selectedBranch === 'GLOBAL' ? 'SP' : selectedBranch,
            location: 'Laboratório',
            value: 5000,
            status: 'EM_USO'
          });
          setAssetModalOpen(true);
        }}
        addButtonLabel="Cadastrar Novo Patrimônio"
        canEditOrAdd={canEdit}
      />

      {/* ASSET MODAL (CADASTRO / EDIÇÃO) */}
      <Dialog open={assetModalOpen} onClose={() => setAssetModalOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSaveAsset}>
          <DialogTitle className="font-bold">
            {editingAsset?.id ? 'Editar Patrimônio / Empréstimo' : 'Cadastrar Novo Patrimônio'}
          </DialogTitle>
          <DialogContent dividers className="space-y-4">
            {formError && <Alert severity="error">{formError}</Alert>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <TextField
                  fullWidth
                  label="Tombamento (Nº Patrimônio)"
                  value={editingAsset?.assetTag || ''}
                  onChange={(e) => setEditingAsset({ ...editingAsset, assetTag: e.target.value })}
                  required
                />
              </div>
              <div>
                <FormControl fullWidth required>
                  <InputLabel>Unidade Responsável</InputLabel>
                  <Select
                    value={editingAsset?.branch || 'SP'}
                    onChange={(e) => setEditingAsset({ ...editingAsset, branch: e.target.value as Branch })}
                    label="Unidade Responsável"
                  >
                    {dataService.getBranches(true).map(b => (
                      <MenuItem key={b.id} value={b.code}>
                        Unidade {b.code} ({b.city})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>
              <div className="sm:col-span-2">
                <TextField
                  fullWidth
                  label="Nome / Descrição do Bem"
                  value={editingAsset?.name || ''}
                  onChange={(e) => setEditingAsset({ ...editingAsset, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <TextField
                  fullWidth
                  label="Categoria"
                  value={editingAsset?.category || ''}
                  onChange={(e) => setEditingAsset({ ...editingAsset, category: e.target.value })}
                />
              </div>
              <div>
                <TextField
                  fullWidth
                  type="number"
                  label="Valor Avaliado (R$)"
                  value={editingAsset?.value ?? 0}
                  onChange={(e) => setEditingAsset({ ...editingAsset, value: Number(e.target.value) })}
                />
              </div>
              <div>
                <FormControl fullWidth required>
                  <InputLabel>Status do Bem</InputLabel>
                  <Select
                    value={editingAsset?.status || 'EM_USO'}
                    onChange={(e) => setEditingAsset({ ...editingAsset, status: e.target.value as AssetStatus })}
                    label="Status do Bem"
                  >
                    <MenuItem value="EM_USO">EM USO / DISPONÍVEL</MenuItem>
                    <MenuItem value="EMPRESTADO">EMPRESTADO</MenuItem>
                    <MenuItem value="EM_MANUTENCAO">EM MANUTENÇÃO</MenuItem>
                    <MenuItem value="BAIXADO">BAIXADO</MenuItem>
                  </Select>
                </FormControl>
              </div>
              <div>
                <TextField
                  fullWidth
                  label="Localização Física"
                  value={editingAsset?.location || ''}
                  onChange={(e) => setEditingAsset({ ...editingAsset, location: e.target.value })}
                />
              </div>

              {editingAsset?.status === 'EMPRESTADO' && (
                <>
                  <div className="sm:col-span-2 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
                    <Typography variant="subtitle2" className="font-bold text-amber-900 dark:text-amber-300 mb-2 flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4" /> Dados do Empréstimo / Custódia Atual
                    </Typography>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <TextField
                          fullWidth
                          size="small"
                          label="Emprestado Para (Pessoa)"
                          value={editingAsset?.borrowedTo || ''}
                          onChange={(e) => setEditingAsset({ ...editingAsset, borrowedTo: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <TextField
                          fullWidth
                          size="small"
                          label="Departamento / Setor"
                          value={editingAsset?.borrowedToDepartment || ''}
                          onChange={(e) => setEditingAsset({ ...editingAsset, borrowedToDepartment: e.target.value })}
                        />
                      </div>
                      <div>
                        <TextField
                          fullWidth
                          size="small"
                          type="date"
                          label="Data do Empréstimo"
                          slotProps={{ inputLabel: { shrink: true } }}
                          value={editingAsset?.borrowedDate || new Date().toISOString().split('T')[0]}
                          onChange={(e) => setEditingAsset({ ...editingAsset, borrowedDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <TextField
                          fullWidth
                          size="small"
                          type="date"
                          label="Data Prevista de Devolução"
                          slotProps={{ inputLabel: { shrink: true } }}
                          value={editingAsset?.expectedReturnDate || ''}
                          onChange={(e) => setEditingAsset({ ...editingAsset, expectedReturnDate: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Rastreabilidade de Último Utilizador Anterior */}
              {editingAsset?.previousBorrower && (
                <div className="sm:col-span-2 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <Typography variant="caption" className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    Rastreabilidade: Último Utilizador Anterior
                  </Typography>
                  <Typography variant="body2" className="text-xs text-slate-800 dark:text-slate-200 mt-1">
                    <strong>{editingAsset.previousBorrower}</strong>
                    {editingAsset.previousBorrowerDepartment && ` — ${editingAsset.previousBorrowerDepartment}`}
                    {editingAsset.lastReturnedDate && ` (Devolvido em ${new Date(editingAsset.lastReturnedDate).toLocaleDateString('pt-BR')})`}
                  </Typography>
                </div>
              )}
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAssetModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" color="primary">Salvar Patrimônio</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* MODAL DE REGISTRO DE DEVOLUÇÃO COM RASTREAMENTO */}
      <Dialog open={returnModalOpen} onClose={() => setReturnModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle className="font-bold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
          <RotateCcw className="w-5 h-5" />
          Registrar Devolução de Patrimônio
        </DialogTitle>
        <DialogContent dividers className="space-y-4">
          <Alert severity="info" className="text-xs">
            Ao confirmar a devolução, <strong>{selectedAsset?.borrowedTo}</strong> será arquivado como o <strong>Último Utilizador</strong> deste bem no sistema e relatórios, garantindo total rastreabilidade.
          </Alert>

          <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
            <Typography variant="subtitle2" className="font-bold text-slate-900 dark:text-slate-100">
              {selectedAsset?.assetTag} — {selectedAsset?.name}
            </Typography>
            <Typography variant="caption" className="text-slate-600 dark:text-slate-300 block">
              Utilizador Atual Devolvendo: <strong>{selectedAsset?.borrowedTo}</strong> ({selectedAsset?.borrowedToDepartment || 'Geral'})
            </Typography>
          </div>

          <div>
            <FormControl fullWidth size="small">
              <InputLabel>Condição / Estado do Bem no Recebimento</InputLabel>
              <Select
                value={returnCondition}
                onChange={(e) => {
                  setReturnCondition(e.target.value);
                  if (e.target.value.includes('Avaria') || e.target.value.includes('Manutenção')) {
                    setSendToMaintenance(true);
                  }
                }}
                label="Condição / Estado do Bem no Recebimento"
              >
                <MenuItem value="Perfeito Estado de Conservação">✅ Perfeito Estado de Conservação</MenuItem>
                <MenuItem value="Bom Estado de Conservação">👌 Bom Estado com Marcas Leves de Uso</MenuItem>
                <MenuItem value="Com Pequena Avaria / Falha Parcial">⚠️ Com Pequena Avaria / Falha Parcial</MenuItem>
                <MenuItem value="Danificado / Necessita de Manutenção Corretiva">🚨 Danificado / Necessita Manutenção</MenuItem>
              </Select>
            </FormControl>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="maintCheck"
              checked={sendToMaintenance}
              onChange={(e) => setSendToMaintenance(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600"
            />
            <label htmlFor="maintCheck" className="text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
              Direcionar bem automaticamente para "EM MANUTENÇÃO"
            </label>
          </div>

          <div>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Observações da Devolução / Parecer de Inspeção"
              placeholder="Ex: Devolvido com todos os acessórios, sem avarias no cabo de teste."
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReturnModalOpen(false)}>Cancelar</Button>
          <Button onClick={handleConfirmReturn} variant="contained" color="success">
            Confirmar Devolução e Arquivar Histórico
          </Button>
        </DialogActions>
      </Dialog>

      {/* MODAL DE HISTÓRICO DE CUSTÓDIA COMPLETO */}
      <Dialog open={historyModalOpen} onClose={() => setHistoryModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle className="font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <span>Rastreabilidade & Histórico de Custódia do Bem</span>
          </div>
          <Chip
            label={selectedAsset?.assetTag || ''}
            color="primary"
            size="small"
            className="font-bold"
          />
        </DialogTitle>
        <DialogContent dividers className="space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <Typography variant="h6" className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
              {selectedAsset?.name}
            </Typography>
            <Typography variant="caption" className="text-slate-500 dark:text-slate-400">
              Unidade: <strong>{selectedAsset?.branch}</strong> | Categoria: <strong>{selectedAsset?.category}</strong> | Valor: <strong>R$ {selectedAsset?.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
            </Typography>
          </div>

          <Typography variant="subtitle2" className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-500" />
            Linha do Tempo de Utilizadores (Auditoria & Rastreio)
          </Typography>

          <Box className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <Table size="small">
              <TableHead className="bg-slate-100 dark:bg-slate-800">
                <TableRow>
                  <TableCell className="font-bold text-xs">Utilizador / Responsável</TableCell>
                  <TableCell className="font-bold text-xs">Setor / Departamento</TableCell>
                  <TableCell className="font-bold text-xs">Data Retirada</TableCell>
                  <TableCell className="font-bold text-xs">Data Devolução</TableCell>
                  <TableCell className="font-bold text-xs">Condição / Estado</TableCell>
                  <TableCell className="font-bold text-xs">Recebido Por</TableCell>
                  <TableCell className="font-bold text-xs">Observações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedAsset?.custodyHistory && selectedAsset.custodyHistory.length > 0 ? (
                  selectedAsset.custodyHistory.map((ch, idx) => (
                    <TableRow key={ch.id || idx} hover className={!ch.returnedDate ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
                      <TableCell className="font-bold text-xs text-slate-900 dark:text-slate-100">
                        {ch.user} {!ch.returnedDate && <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-normal">(Custódia Ativa)</span>}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-300">{ch.department || '-'}</TableCell>
                      <TableCell className="text-xs">{ch.borrowedDate ? new Date(ch.borrowedDate).toLocaleDateString('pt-BR') : '-'}</TableCell>
                      <TableCell className="text-xs">
                        {ch.returnedDate ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                            {new Date(ch.returnedDate).toLocaleDateString('pt-BR')}
                          </span>
                        ) : (
                          <span className="text-amber-700 dark:text-amber-400 font-bold">Em Aberto</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Chip
                          label={ch.condition || (ch.returnedDate ? 'Devolvido' : 'Em Uso')}
                          size="small"
                          color={ch.condition?.includes('Avaria') || ch.condition?.includes('Manutenção') ? 'error' : ch.returnedDate ? 'success' : 'warning'}
                          className="text-[10px] h-5 font-semibold"
                        />
                      </TableCell>
                      <TableCell className="text-xs">{ch.returnedBy || '-'}</TableCell>
                      <TableCell className="text-xs max-w-xs">{ch.notes || '-'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} align="center" className="py-6 text-slate-400 text-xs">
                      Nenhum histórico detalhado registrado para este item.
                      {selectedAsset?.previousBorrower && (
                        <div className="mt-2 text-slate-700 dark:text-slate-300 font-semibold">
                          Último Utilizador Registrado: {selectedAsset.previousBorrower} {selectedAsset.lastReturnedDate ? `(Devolvido em ${new Date(selectedAsset.lastReturnedDate).toLocaleDateString('pt-BR')})` : ''}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryModalOpen(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
