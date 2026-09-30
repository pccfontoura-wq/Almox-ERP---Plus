import React, { useState } from 'react';
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Select, FormControl, InputLabel, Alert, Chip, Card, CardContent,
  Table, TableBody, TableCell, TableHead, TableRow, Grid, IconButton, Tooltip
} from '@mui/material';
import { ClipboardCheck, Plus, CheckCircle2, AlertTriangle, RefreshCw, FileDown, Printer, FileText } from 'lucide-react';

import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Breadcrumb } from '../components/Breadcrumb';
import { DataTable, Column } from '../components/DataTable';
import { InventoryAudit, Branch } from '../types';
import { exportInventoryCountSheetPDF } from '../utils/exportUtils';

export const Inventario: React.FC = () => {
  const { currentUser } = useAuth();
  const { selectedBranch, refreshData } = useApp();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activeAudit, setActiveAudit] = useState<InventoryAudit | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const [title, setTitle] = useState('');
  const [targetBranch, setTargetBranch] = useState<Branch>(selectedBranch === 'GLOBAL' ? 'SP' : selectedBranch);

  const state = dataService.getState();
  const inventories = state.inventories.filter(i => selectedBranch === 'GLOBAL' || i.branch === selectedBranch);
  const canEdit = currentUser?.role !== 'Visitante';

  const inventoryColumns: Column<InventoryAudit>[] = [
    { id: 'code', label: 'Código Inventário', accessor: (i) => i.code, sortable: true },
    { id: 'title', label: 'Título da Campanha', accessor: (i) => i.title, sortable: true },
    { id: 'branch', label: 'Unidade', accessor: (i) => i.branch },
    {
      id: 'status',
      label: 'Status',
      accessor: (i) => i.status === 'EM_ANDAMENTO' ? 'Andamento' : 'Concluído',
      render: (i) => (
        <Chip
          label={i.status === 'EM_ANDAMENTO' ? 'Andamento' : 'Concluído'}
          color={i.status === 'EM_ANDAMENTO' ? 'warning' : 'success'}
          size="small"
          className="font-bold text-[10px] h-5"
        />
      )
    },
    { id: 'totalDivergenceCount', label: 'Itens Divergentes', accessor: (i) => i.totalDivergenceCount },
    { id: 'totalDivergenceValue', label: 'Divergência Financeira', accessor: (i) => `R$ ${i.totalDivergenceValue.toFixed(2)}` },
    { id: 'startedAt', label: 'Iniciado Em', accessor: (i) => new Date(i.startedAt).toLocaleDateString('pt-BR') },
    {
      id: 'actions',
      label: 'Contagem & Reconciliação',
      accessor: (i) => i.id,
      exportable: false,
      render: (i) => (
        <Box className="flex items-center gap-2">
          <Button
            size="small"
            variant="contained"
            color={i.status === 'EM_ANDAMENTO' ? 'primary' : 'inherit'}
            onClick={() => {
              setActiveAudit(i);
              const initialCounts: Record<string, number> = {};
              i.items.forEach(item => {
                initialCounts[item.productId] = item.countedQuantity;
              });
              setCounts(initialCounts);
            }}
            className="text-xs py-1 px-3 font-bold"
          >
            {i.status === 'EM_ANDAMENTO' ? 'Lançar Contagem' : 'Ver Resultado'}
          </Button>

          <Button
            size="small"
            variant="outlined"
            onClick={(e) => {
              e.stopPropagation();
              exportInventoryCountSheetPDF(i, state.products);
            }}
            startIcon={<FileDown className="w-3.5 h-3.5 text-blue-600" />}
            className="text-xs py-1 px-2.5 font-medium border-slate-300 text-slate-700 dark:text-slate-200 dark:border-slate-700 hover:bg-slate-50"
            title="Baixar Folha de Contagem Cega (PDF) sem os quantitativos do sistema"
          >
            Folha Cega (PDF)
          </Button>
        </Box>
      )
    }
  ];

  const handleStartAudit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const allProductIds = state.products.map(p => p.id);
    const newAudit = dataService.createInventoryAudit(
      targetBranch,
      title || 'Inventário Físico Periódico',
      allProductIds,
      currentUser
    );

    // Automatically trigger the Blind Count Sheet PDF download
    exportInventoryCountSheetPDF(newAudit, state.products);

    setCreateModalOpen(false);
    setTitle('');
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
    const formatted = Object.entries(counts).map(([productId, countedQuantity]) => ({
      productId,
      countedQuantity: Number(countedQuantity)
    }));

    dataService.updateInventoryCount(activeAudit.id, formatted, currentUser);
    refreshData();
    alert('Contagem de inventário salva com sucesso!');
  };

  const handleReconcile = () => {
    if (!activeAudit || !currentUser) return;
    if (!confirm('Deseja reconciliar o estoque agora? Isso ajustará automaticamente a quantidade de todos os produtos no banco com base na contagem contada.')) return;

    try {
      dataService.reconcileInventory(activeAudit.id, currentUser);
      setActiveAudit(null);
      refreshData();
      alert('Inventário reconciliado com sucesso! Estoque atualizado.');
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <Box className="space-y-6">
      <Breadcrumb items={[{ label: 'Inventário Físico e Auditoria' }]} />

      <Alert severity="info" icon={<ClipboardCheck className="w-5 h-5" />}>
        <strong>Acuracidade de Inventário:</strong> O módulo de inventário gera a <strong>Folha de Contagem Cega em PDF</strong> (sem exibir as quantidades do sistema) para conferência física em campo. Após a apuração dos números reais, preencha a contagem para conferir as divergências e reconciliar automaticamente o estoque.
      </Alert>

      <DataTable
        title="Campanhas de Inventário Físico"
        subTitle="Conferência de estoque real versus estoque do sistema com emissão de Folha de Contagem Cega."
        columns={inventoryColumns}
        data={inventories}
        onAddClick={() => setCreateModalOpen(true)}
        addButtonLabel="Iniciar Nova Campanha de Inventário"
        canEditOrAdd={canEdit}
      />

      {/* CREATE AUDIT MODAL */}
      <Dialog open={createModalOpen} onClose={() => setCreateModalOpen(false)} maxWidth="xs" fullWidth>
        <form onSubmit={handleStartAudit}>
          <DialogTitle className="font-bold">Iniciar Nova Campanha de Inventário</DialogTitle>
          <DialogContent dividers className="space-y-4">
            <Alert severity="info" className="text-xs">
              Ao iniciar a campanha, o sistema gerará automaticamente a <strong>Folha de Contagem Cega em PDF</strong> para impressão e contagem física no almoxarifado.
            </Alert>

            <TextField
              fullWidth
              label="Título da Campanha"
              placeholder="Ex: Inventário Geral Q3"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <FormControl fullWidth required>
              <InputLabel>Unidade Objeto de Inventário</InputLabel>
              <Select
                value={targetBranch}
                onChange={(e) => setTargetBranch(e.target.value as Branch)}
                label="Unidade Objeto de Inventário"
              >
                {dataService.getBranches(true).map(b => (
                  <MenuItem key={b.id} value={b.code}>
                    {b.code} - {b.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions className="p-4 bg-slate-50 dark:bg-slate-900">
            <Button onClick={() => setCreateModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" color="primary" startIcon={<FileDown className="w-4 h-4" />}>
              Gerar e Baixar Folha de Contagem (PDF)
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
              <Typography variant="h6" className="font-bold text-white text-base md:text-lg">
                Contagem de Inventário: {activeAudit.code} ({activeAudit.branch})
              </Typography>
              <Chip 
                label={activeAudit.status === 'EM_ANDAMENTO' ? 'Em Andamento' : 'Concluído'} 
                color={activeAudit.status === 'EM_ANDAMENTO' ? 'warning' : 'success'} 
                size="small" 
                className="font-bold ml-2"
              />
            </Box>

            {/* ACTION BUTTONS IN HEADER */}
            <Box className="flex items-center gap-2">
              <Button
                variant="contained"
                size="small"
                startIcon={<FileDown className="w-4 h-4" />}
                onClick={() => exportInventoryCountSheetPDF(activeAudit, state.products)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
              >
                Baixar Folha de Contagem Cega (PDF)
              </Button>
            </Box>
          </DialogTitle>

          <DialogContent dividers className="space-y-4">
            <Alert severity="warning" icon={<FileText className="w-5 h-5 text-amber-600" />} className="text-xs">
              <strong>Fluxo de Contagem Cega:</strong> Entregue a <strong>Folha de Contagem Cega em PDF</strong> ao inventariante sem informar os quantitativos do sistema. Conforme a contagem física for realizada em campo, insira os valores coletados na coluna <strong>"Qtd Contada"</strong> para apurar as divergências e reconciliar o saldo.
            </Alert>

            <Table size="small">
              <TableHead className="bg-slate-100 dark:bg-slate-800">
                <TableRow>
                  <TableCell className="font-bold text-xs">SKU</TableCell>
                  <TableCell className="font-bold text-xs">Descrição do Item</TableCell>
                  <TableCell className="font-bold text-xs">Localização</TableCell>
                  <TableCell align="right" className="font-bold text-xs">Qtd Sistema</TableCell>
                  <TableCell align="right" className="font-bold text-xs">Qtd Contada (Físico)</TableCell>
                  <TableCell align="right" className="font-bold text-xs">Divergência</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {activeAudit.items.map((item) => {
                  const currentCounted = counts[item.productId] ?? item.countedQuantity;
                  const div = currentCounted - item.systemQuantity;
                  const prod = state.products.find(p => p.id === item.productId);
                  return (
                    <TableRow key={item.productId} hover>
                      <TableCell className="font-mono text-xs font-bold">{item.productCode}</TableCell>
                      <TableCell className="text-xs">
                        <span className="font-medium text-slate-800 dark:text-slate-200">{item.productName}</span>
                        <span className="text-[10px] text-slate-400 block">{prod?.category || 'Geral'} • {prod?.unit || 'UN'}</span>
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
                            value={currentCounted}
                            onChange={(e) => setCounts({ ...counts, [item.productId]: Number(e.target.value) })}
                            slotProps={{
                              htmlInput: { min: 0 }
                            }}
                          />
                        ) : (
                          <Typography className="text-xs font-bold">{item.countedQuantity} {prod?.unit || 'UN'}</Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Typography className={`text-xs font-bold ${div === 0 ? 'text-slate-500' : div > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {div > 0 ? `+${div}` : div} {prod?.unit || 'UN'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </DialogContent>
          <DialogActions className="p-4 bg-slate-50 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
            <Button onClick={() => setActiveAudit(null)} variant="outlined" color="inherit">
              Fechar Janela
            </Button>

            <Box className="flex items-center gap-2">
              <Button
                variant="outlined"
                startIcon={<FileDown className="w-4 h-4 text-blue-600" />}
                onClick={() => exportInventoryCountSheetPDF(activeAudit, state.products)}
                className="text-xs font-semibold"
              >
                Reimprimir Folha Cega (PDF)
              </Button>

              {activeAudit.status === 'EM_ANDAMENTO' && canEdit && (
                <>
                  <Button variant="outlined" onClick={handleSaveCounts} color="primary" className="text-xs font-semibold">
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
              )}
            </Box>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
};

