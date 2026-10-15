import React, { useState, useMemo, useEffect } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  TextField, InputAdornment, IconButton, Button, Checkbox,
  TablePagination, TableSortLabel, Box, Typography, Chip, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogActions, FormGroup, FormControlLabel,
  FormControl, InputLabel, Select, MenuItem, Alert
} from '@mui/material';
import {
  Search, FileSpreadsheet, FileText, Printer, Columns, RotateCcw, Calendar, Tag, Building2, Filter
} from 'lucide-react';
import { exportToExcel, exportToPDF, printPage } from '../utils/exportUtils';
import { AppIcon } from './AppIcon';
import { dataService } from '../services/dataService';
import { useApp } from '../context/AppContext';
import { Branch } from '../types';

export interface Column<T> {
  id: string;
  label: string;
  accessor: (row: T) => any;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: (row: T) => React.ReactNode;
  exportable?: boolean;
}

export type TablePeriodFilter =
  | 'ALL'
  | 'TODAY'
  | 'YESTERDAY'
  | 'LAST_7_DAYS'
  | 'LAST_15_DAYS'
  | 'LAST_30_DAYS'
  | 'THIS_MONTH'
  | 'LAST_90_DAYS'
  | 'CUSTOM';

const PERIOD_LABELS: Record<TablePeriodFilter, string> = {
  ALL: 'Todo o Período',
  TODAY: 'Hoje (Registros do Dia)',
  YESTERDAY: 'Ontem',
  LAST_7_DAYS: 'Últimos 7 Dias',
  LAST_15_DAYS: 'Últimos 15 Dias',
  LAST_30_DAYS: 'Últimos 30 Dias',
  THIS_MONTH: 'Mês Atual',
  LAST_90_DAYS: 'Últimos 90 Dias (Trimestre)',
  CUSTOM: 'Período Personalizado'
};

interface DataTableProps<T> {
  title: string;
  subTitle?: string;
  columns: Column<T>[];
  data: T[];
  onAddClick?: () => void;
  addButtonLabel?: string;
  canEditOrAdd?: boolean;
}

export function DataTable<T extends { id: string }>({
  title,
  subTitle,
  columns,
  data,
  onAddClick,
  addButtonLabel = 'Novo Registro',
  canEditOrAdd = true
}: DataTableProps<T>) {
  const { selectedBranch } = useApp();

  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState<Branch | 'GLOBAL'>(selectedBranch);
  const [categoryFilter, setCategoryFilter] = useState<string>('TODAS');
  const [periodFilter, setPeriodFilter] = useState<TablePeriodFilter>('ALL');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [orderBy, setOrderBy] = useState<string>(columns[0]?.id || '');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(columns.map(c => c.id));
  const [columnModalOpen, setColumnModalOpen] = useState(false);

  // Export configuration modal state
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'EXCEL' | 'PDF'>('EXCEL');

  // Sync unitFilter when global selectedBranch changes in Navbar
  useEffect(() => {
    setUnitFilter(selectedBranch);
    setPage(0);
  }, [selectedBranch]);

  const state = dataService.getState();
  const activeBranches = useMemo(() => dataService.getBranches(true), [state.branches]);

  const productCategoryMap = useMemo(() => {
    const map = new Map<string, string>();
    state.products.forEach(p => {
      if (p.category) map.set(p.id, p.category);
    });
    return map;
  }, [state.products]);

  // Helper: extract categories for any row type
  const extractRowCategories = (row: any): string[] => {
    const cats = new Set<string>();
    if (typeof row.category === 'string' && row.category.trim()) {
      cats.add(row.category.trim());
    }
    if (row.productId && productCategoryMap.has(row.productId)) {
      cats.add(productCategoryMap.get(row.productId)!);
    }
    if (Array.isArray(row.items)) {
      row.items.forEach((item: any) => {
        if (item.category) cats.add(item.category);
        else if (item.productId && productCategoryMap.has(item.productId)) {
          cats.add(productCategoryMap.get(item.productId)!);
        }
      });
    }
    if (Array.isArray(row.productBalances)) {
      row.productBalances.forEach((pb: any) => {
        if (pb.productId && productCategoryMap.has(pb.productId)) {
          cats.add(productCategoryMap.get(pb.productId)!);
        }
      });
    }
    return Array.from(cats);
  };

  // Available categories dynamically derived from catalog + current data
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    state.products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    state.assets.forEach(a => {
      if (a.category) set.add(a.category);
    });
    data.forEach(row => {
      extractRowCategories(row).forEach(c => set.add(c));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [state.products, state.assets, data, productCategoryMap]);

  // Helper: check if row matches selected Unidade
  const matchesUnit = (row: any, targetUnit: Branch | 'GLOBAL'): boolean => {
    if (!targetUnit || targetUnit === 'GLOBAL') return true;
    if (typeof row.branch === 'string') {
      return row.branch === targetUnit || row.branch === 'GLOBAL';
    }
    if (typeof row.originBranch === 'string' || typeof row.destinationBranch === 'string') {
      return row.originBranch === targetUnit || row.destinationBranch === targetUnit;
    }
    if (row.costCenter && typeof row.costCenter.branch === 'string') {
      return row.costCenter.branch === targetUnit;
    }
    if (row.stockByBranch && typeof row.stockByBranch === 'object') {
      return true; // Catalog products are available across units; stock accessor displays the unit's balance
    }
    if (typeof row.code === 'string' && typeof row.city === 'string' && typeof row.state === 'string') {
      // BranchInfo row
      return row.code === targetUnit;
    }
    return true;
  };

  // Helper: check if row matches selected Categoria
  const matchesCategory = (row: any, targetCat: string): boolean => {
    if (!targetCat || targetCat === 'TODAS') return true;
    const rowCats = extractRowCategories(row);
    if (rowCats.length === 0) return true; // If entity has no category concept (e.g., Users, Units), don't hide unless applicable
    return rowCats.some(c => c.toLowerCase() === targetCat.toLowerCase());
  };

  // Compute date bounds for period filter
  const dateBounds = useMemo(() => {
    if (periodFilter === 'ALL') return null;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    switch (periodFilter) {
      case 'TODAY':
        return { start: startOfToday.getTime(), end: endOfToday.getTime() };
      case 'YESTERDAY': {
        const s = new Date(startOfToday);
        s.setDate(s.getDate() - 1);
        const e = new Date(endOfToday);
        e.setDate(e.getDate() - 1);
        return { start: s.getTime(), end: e.getTime() };
      }
      case 'LAST_7_DAYS': {
        const s = new Date(startOfToday);
        s.setDate(s.getDate() - 6);
        return { start: s.getTime(), end: endOfToday.getTime() };
      }
      case 'LAST_15_DAYS': {
        const s = new Date(startOfToday);
        s.setDate(s.getDate() - 14);
        return { start: s.getTime(), end: endOfToday.getTime() };
      }
      case 'LAST_30_DAYS': {
        const s = new Date(startOfToday);
        s.setDate(s.getDate() - 29);
        return { start: s.getTime(), end: endOfToday.getTime() };
      }
      case 'THIS_MONTH': {
        const s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        return { start: s.getTime(), end: endOfToday.getTime() };
      }
      case 'LAST_90_DAYS': {
        const s = new Date(startOfToday);
        s.setDate(s.getDate() - 89);
        return { start: s.getTime(), end: endOfToday.getTime() };
      }
      case 'CUSTOM': {
        const s = customStartDate ? new Date(`${customStartDate}T00:00:00`).getTime() : 0;
        const e = customEndDate ? new Date(`${customEndDate}T23:59:59.999`).getTime() : endOfToday.getTime();
        return { start: s, end: e };
      }
      default:
        return null;
    }
  }, [periodFilter, customStartDate, customEndDate]);

  // Helper: extract relevant date from any row
  const extractRowDate = (row: any): string | undefined => {
    return (
      row.date ||
      row.createdAt ||
      row.sentAt ||
      row.startedAt ||
      row.timestamp ||
      row.borrowedDate ||
      row.lastReturnedDate ||
      row.acquisitionDate ||
      row.updatedAt
    );
  };

  const matchesPeriod = (row: any): boolean => {
    if (!dateBounds) return true;
    const rawDate = extractRowDate(row);
    if (!rawDate) return true;
    const ts = new Date(rawDate).getTime();
    if (isNaN(ts)) return true;
    return ts >= dateBounds.start && ts <= dateBounds.end;
  };

  // Search and Filter logic
  const filteredData = useMemo(() => {
    return data.filter(row => {
      if (!matchesUnit(row, unitFilter)) return false;
      if (!matchesCategory(row, categoryFilter)) return false;
      if (!matchesPeriod(row)) return false;

      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return columns.some(col => {
        const val = col.accessor(row);
        return String(val ?? '').toLowerCase().includes(term);
      });
    });
  }, [data, search, columns, unitFilter, categoryFilter, dateBounds]);

  // Sort logic
  const sortedData = useMemo(() => {
    const col = columns.find(c => c.id === orderBy);
    if (!col) return filteredData;

    return [...filteredData].sort((a, b) => {
      const valA = col.accessor(a);
      const valB = col.accessor(b);

      if (valA === valB) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return order === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return order === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [filteredData, orderBy, order, columns]);

  // Pagination slice
  const paginatedData = useMemo(() => {
    return sortedData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [sortedData, page, rowsPerPage]);

  const handleRequestSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(filteredData.map(n => n.id));
      return;
    }
    setSelectedIds([]);
  };

  const handleClickSelect = (id: string) => {
    const selectedIndex = selectedIds.indexOf(id);
    let newSelected: string[] = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selectedIds, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selectedIds.slice(1));
    } else if (selectedIndex === selectedIds.length - 1) {
      newSelected = newSelected.concat(selectedIds.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selectedIds.slice(0, selectedIndex),
        selectedIds.slice(selectedIndex + 1)
      );
    }
    setSelectedIds(newSelected);
  };

  const activeColumns = useMemo(() => {
    return columns.filter(c => visibleColumnIds.includes(c.id));
  }, [columns, visibleColumnIds]);

  const periodSummaryText = useMemo(() => {
    if (periodFilter === 'CUSTOM') {
      const s = customStartDate ? new Date(`${customStartDate}T12:00:00`).toLocaleDateString('pt-BR') : 'Início';
      const e = customEndDate ? new Date(`${customEndDate}T12:00:00`).toLocaleDateString('pt-BR') : 'Hoje';
      return `${s} até ${e}`;
    }
    return PERIOD_LABELS[periodFilter];
  }, [periodFilter, customStartDate, customEndDate]);

  // Open Export Modal so user can verify/choose Unidade, Categoria and Período before exporting
  const openExportDialog = (format: 'EXCEL' | 'PDF') => {
    setExportFormat(format);
    setExportModalOpen(true);
  };

  // Execute Export with selected Unidade, Categoria and Período
  const executeExport = () => {
    const targetData = selectedIds.length > 0
      ? sortedData.filter(d => selectedIds.includes(d.id))
      : sortedData;

    const exportColumns = activeColumns.filter(c => c.id !== 'actions' && c.exportable !== false);

    if (exportFormat === 'EXCEL') {
      const exportRows = targetData.map((row: any) => {
        const obj: Record<string, any> = {};
        exportColumns.forEach(col => {
          obj[col.label] = col.accessor(row);
        });
        // Ensure Unidade and Categoria are present in exported Excel if not already a column
        if (!('Unidade' in obj)) {
          obj['Unidade'] = row.branch || row.originBranch || unitFilter;
        }
        if (!('Categoria' in obj)) {
          const cats = extractRowCategories(row);
          if (cats.length > 0) obj['Categoria'] = cats.join(', ');
        }
        return obj;
      });

      exportToExcel(
        exportRows,
        `relatorio-${title.toLowerCase().replace(/\s+/g, '-')}-${unitFilter}-${categoryFilter}`
      );
    } else {
      const headers = exportColumns.map(c => c.label);
      const rows = targetData.map(row =>
        exportColumns.map(c => {
          const val = c.accessor(row);
          return val == null ? '' : String(val);
        })
      );

      const filterMetadata = `Unidade: ${unitFilter === 'GLOBAL' ? 'Todas as Unidades (GLOBAL)' : unitFilter} | Categoria: ${categoryFilter} | Período: ${periodSummaryText} | Registros: ${targetData.length}`;

      exportToPDF(
        title,
        headers,
        rows,
        `relatorio-${title.toLowerCase().replace(/\s+/g, '-')}-${unitFilter}`,
        filterMetadata
      );
    }

    setExportModalOpen(false);
  };

  const handleResetFilters = () => {
    setSearch('');
    setUnitFilter(selectedBranch);
    setCategoryFilter('TODAS');
    setPeriodFilter('ALL');
    setPage(0);
  };

  return (
    <Box className="w-full bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 transition-all">
      {/* Top Header & Controls */}
      <Box className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <Typography variant="h6" className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            {title}
            {selectedIds.length > 0 && (
              <Chip label={`${selectedIds.length} selecionados`} color="primary" size="small" className="font-medium" />
            )}
          </Typography>
          {subTitle && (
            <Typography variant="body2" className="text-slate-500 dark:text-slate-400">
              {subTitle}
            </Typography>
          )}
        </div>

        <Box className="flex flex-wrap items-center gap-2">
          {canEditOrAdd && onAddClick && (
            <Button
              variant="contained"
              color="primary"
              onClick={onAddClick}
              sx={{ color: '#ffffff !important' }}
              className="!bg-blue-600 hover:!bg-blue-700 !text-white font-bold px-4 py-2"
            >
              + {addButtonLabel}
            </Button>
          )}

          <Tooltip title="Exportar Relatório Excel (Escolher Unidade, Categoria e Período)">
            <Button
              variant="outlined"
              size="small"
              onClick={() => openExportDialog('EXCEL')}
              startIcon={<AppIcon icon={FileSpreadsheet} size={16} className="text-emerald-600" />}
              className="border-slate-300 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-800 font-semibold"
            >
              Exportar Excel
            </Button>
          </Tooltip>

          <Tooltip title="Exportar Relatório PDF (Escolher Unidade, Categoria e Período)">
            <Button
              variant="outlined"
              size="small"
              onClick={() => openExportDialog('PDF')}
              startIcon={<AppIcon icon={FileText} size={16} className="text-rose-600" />}
              className="border-slate-300 text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-slate-800 font-semibold"
            >
              Exportar PDF
            </Button>
          </Tooltip>

          <Tooltip title="Imprimir Relatório">
            <IconButton
              size="small"
              onClick={printPage}
              className="border border-slate-300 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <AppIcon icon={Printer} size={16} className="text-slate-600 dark:text-slate-300" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Gerenciar Colunas Visíveis">
            <IconButton
              size="small"
              onClick={() => setColumnModalOpen(true)}
              className="border border-slate-300 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <AppIcon icon={Columns} size={16} className="text-slate-600 dark:text-slate-300" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Unified Filter Bar: Search + Unidade + Categoria + Período */}
      <Box className="mb-4 p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-center">
          <div className="lg:col-span-4">
            <TextField
              fullWidth
              size="small"
              placeholder={`Pesquisar em ${title.toLowerCase()}...`}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <AppIcon icon={Search} size={16} className="text-slate-400" />
                    </InputAdornment>
                  ),
                }
              }}
              className="bg-white dark:bg-slate-900 rounded-lg"
            />
          </div>

          <div className="lg:col-span-2">
            <FormControl fullWidth size="small" className="bg-white dark:bg-slate-900 rounded-lg">
              <InputLabel>Unidade</InputLabel>
              <Select
                value={unitFilter}
                label="Unidade"
                onChange={(e) => { setUnitFilter(e.target.value as any); setPage(0); }}
                className="text-xs font-bold"
              >
                <MenuItem value="GLOBAL">🌐 Todas as Unidades</MenuItem>
                {activeBranches.map(b => (
                  <MenuItem key={b.id} value={b.code}>Unidade {b.code} ({b.city})</MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>

          <div className="lg:col-span-3">
            <FormControl fullWidth size="small" className="bg-white dark:bg-slate-900 rounded-lg">
              <InputLabel>Categoria</InputLabel>
              <Select
                value={categoryFilter}
                label="Categoria"
                onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
                className="text-xs font-bold"
              >
                <MenuItem value="TODAS">🏷️ Todas as Categorias</MenuItem>
                {availableCategories.map(cat => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>

          <div className="lg:col-span-3">
            <FormControl fullWidth size="small" className="bg-white dark:bg-slate-900 rounded-lg">
              <InputLabel>Período</InputLabel>
              <Select
                value={periodFilter}
                label="Período"
                onChange={(e) => { setPeriodFilter(e.target.value as TablePeriodFilter); setPage(0); }}
                className="text-xs font-bold"
              >
                <MenuItem value="ALL">📅 Todo o Período</MenuItem>
                <MenuItem value="TODAY">⚡ Hoje (Registros do Dia)</MenuItem>
                <MenuItem value="YESTERDAY">🕒 Ontem</MenuItem>
                <MenuItem value="LAST_7_DAYS">📆 Últimos 7 Dias</MenuItem>
                <MenuItem value="LAST_15_DAYS">📆 Últimos 15 Dias</MenuItem>
                <MenuItem value="LAST_30_DAYS">📆 Últimos 30 Dias</MenuItem>
                <MenuItem value="THIS_MONTH">🗓️ Mês Atual</MenuItem>
                <MenuItem value="LAST_90_DAYS">📊 Últimos 90 Dias</MenuItem>
                <MenuItem value="CUSTOM" className="font-bold text-blue-600">🎯 Período Personalizado</MenuItem>
              </Select>
            </FormControl>
          </div>
        </div>

        {/* Custom Date Range Pickers if CUSTOM is selected, or active filter chips */}
        {(periodFilter === 'CUSTOM' || unitFilter !== selectedBranch || categoryFilter !== 'TODAS' || periodFilter !== 'ALL' || search.trim() !== '') && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
            <div className="flex flex-wrap items-center gap-2">
              {periodFilter === 'CUSTOM' && (
                <>
                  <TextField
                    size="small"
                    type="date"
                    label="Data Inicial (De)"
                    value={customStartDate}
                    onChange={(e) => { setCustomStartDate(e.target.value); setPage(0); }}
                    slotProps={{ inputLabel: { shrink: true } }}
                    className="bg-white dark:bg-slate-900 rounded-lg w-40"
                  />
                  <TextField
                    size="small"
                    type="date"
                    label="Data Final (Até)"
                    value={customEndDate}
                    onChange={(e) => { setCustomEndDate(e.target.value); setPage(0); }}
                    slotProps={{ inputLabel: { shrink: true } }}
                    className="bg-white dark:bg-slate-900 rounded-lg w-40"
                  />
                </>
              )}
              <Chip
                size="small"
                label={`Unidade: ${unitFilter === 'GLOBAL' ? 'Todas' : unitFilter}`}
                className="text-[11px] font-semibold"
              />
              <Chip
                size="small"
                label={`Categoria: ${categoryFilter}`}
                color={categoryFilter !== 'TODAS' ? 'info' : 'default'}
                className="text-[11px] font-semibold"
              />
              <Chip
                size="small"
                label={`Período: ${periodSummaryText}`}
                color={periodFilter !== 'ALL' ? 'primary' : 'default'}
                className="text-[11px] font-semibold"
              />
              <Typography variant="caption" className="text-slate-500 font-bold ml-1">
                ({sortedData.length} registros)
              </Typography>
            </div>

            <Button
              size="small"
              variant="text"
              onClick={handleResetFilters}
              startIcon={<RotateCcw className="w-3.5 h-3.5" />}
              className="text-xs font-bold text-slate-500 hover:text-blue-600"
            >
              Restaurar Filtros
            </Button>
          </div>
        )}
      </Box>

      {/* Data Table */}
      <TableContainer component={Paper} elevation={0} className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
        <Table size="medium">
          <TableHead className="bg-slate-100 dark:bg-slate-800/80">
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  color="primary"
                  indeterminate={selectedIds.length > 0 && selectedIds.length < filteredData.length}
                  checked={filteredData.length > 0 && selectedIds.length === filteredData.length}
                  onChange={handleSelectAllClick}
                  size="small"
                />
              </TableCell>
              {activeColumns.map((col) => (
                <TableCell
                  key={col.id}
                  align={col.align || 'left'}
                  className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 py-3"
                >
                  {col.sortable !== false ? (
                    <TableSortLabel
                      active={orderBy === col.id}
                      direction={orderBy === col.id ? order : 'asc'}
                      onClick={() => handleRequestSort(col.id)}
                    >
                      {col.label}
                    </TableSortLabel>
                  ) : (
                    col.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={activeColumns.length + 1} align="center" className="py-12 text-slate-400 dark:text-slate-500">
                  Nenhum registro encontrado para a Unidade, Categoria e Período selecionados.
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row) => {
                const isSelected = selectedIds.includes(row.id);
                return (
                  <TableRow
                    key={row.id}
                    hover
                    selected={isSelected}
                    className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        color="primary"
                        checked={isSelected}
                        onChange={() => handleClickSelect(row.id)}
                        size="small"
                      />
                    </TableCell>
                    {activeColumns.map((col) => (
                      <TableCell key={col.id} align={col.align || 'left'} className="text-sm text-slate-800 dark:text-slate-200 py-3">
                        {col.render ? col.render(row) : String(col.accessor(row) ?? '-')}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination Footer */}
      <TablePagination
        rowsPerPageOptions={[5, 10, 25, 50, 100]}
        component="div"
        count={sortedData.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={(_, newPage) => setPage(newPage)}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        labelRowsPerPage="Linhas por página:"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count !== -1 ? count : `mais de ${to}`}`}
        className="text-slate-600 dark:text-slate-400"
      />

      {/* Export Report Configuration Modal (Unidade, Categoria e Período) */}
      <Dialog open={exportModalOpen} onClose={() => setExportModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle className="font-extrabold flex items-center gap-2 text-slate-900 dark:text-slate-100">
          <Filter className="w-5 h-5 text-blue-600" />
          Exportar Relatório: {title}
        </DialogTitle>
        <DialogContent dividers className="space-y-4">
          <Alert severity="info" className="rounded-xl text-xs">
            Selecione a <strong>Unidade</strong>, a <strong>Categoria</strong> e o <strong>Período</strong> desejados para gerar a exportação oficial deste relatório.
          </Alert>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={exportFormat === 'EXCEL' ? 'contained' : 'outlined'}
              onClick={() => setExportFormat('EXCEL')}
              startIcon={<FileSpreadsheet className="w-4 h-4" />}
              sx={exportFormat === 'EXCEL' ? { color: '#ffffff !important' } : undefined}
              className={exportFormat === 'EXCEL' ? '!bg-emerald-600 hover:!bg-emerald-700 !text-white font-bold py-2' : 'font-bold py-2'}
            >
              Planilha Excel (.XLSX)
            </Button>
            <Button
              variant={exportFormat === 'PDF' ? 'contained' : 'outlined'}
              onClick={() => setExportFormat('PDF')}
              startIcon={<FileText className="w-4 h-4" />}
              sx={exportFormat === 'PDF' ? { color: '#ffffff !important' } : undefined}
              className={exportFormat === 'PDF' ? '!bg-rose-600 hover:!bg-rose-700 !text-white font-bold py-2' : 'font-bold py-2'}
            >
              Documento PDF Executivo
            </Button>
          </div>

          <div className="space-y-3 pt-1">
            <FormControl fullWidth size="small">
              <InputLabel>Unidade do Relatório</InputLabel>
              <Select
                value={unitFilter}
                label="Unidade do Relatório"
                onChange={(e) => setUnitFilter(e.target.value as any)}
                className="font-bold text-sm"
              >
                <MenuItem value="GLOBAL">🌐 GLOBAL (Todas as Unidades Consolidado)</MenuItem>
                {activeBranches.map(b => (
                  <MenuItem key={b.id} value={b.code}>
                    Unidade {b.code} — {b.name} ({b.city}/{b.state})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Categoria de Material / Item</InputLabel>
              <Select
                value={categoryFilter}
                label="Categoria de Material / Item"
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="font-bold text-sm"
              >
                <MenuItem value="TODAS">🏷️ Todas as Categorias</MenuItem>
                {availableCategories.map(cat => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Período de Apuração</InputLabel>
              <Select
                value={periodFilter}
                label="Período de Apuração"
                onChange={(e) => setPeriodFilter(e.target.value as TablePeriodFilter)}
                className="font-bold text-sm"
              >
                <MenuItem value="ALL">📅 Todo o Período (Histórico Completo)</MenuItem>
                <MenuItem value="TODAY">⚡ Hoje (Registros do Dia)</MenuItem>
                <MenuItem value="YESTERDAY">🕒 Ontem</MenuItem>
                <MenuItem value="LAST_7_DAYS">📆 Últimos 7 Dias</MenuItem>
                <MenuItem value="LAST_15_DAYS">📆 Últimos 15 Dias</MenuItem>
                <MenuItem value="LAST_30_DAYS">📆 Últimos 30 Dias</MenuItem>
                <MenuItem value="THIS_MONTH">🗓️ Mês Atual</MenuItem>
                <MenuItem value="LAST_90_DAYS">📊 Últimos 90 Dias (Trimestre)</MenuItem>
                <MenuItem value="CUSTOM" className="font-bold text-blue-600">
                  🎯 Período Personalizado (Escolher Datas)
                </MenuItem>
              </Select>
            </FormControl>

            {periodFilter === 'CUSTOM' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="Data Inicial (De)"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="Data Final (Até)"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </div>
            )}
          </div>

          <Box className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1.5">
            <Typography variant="caption" className="font-extrabold uppercase tracking-wider text-slate-500 block">
              Resumo da Exportação Selecionada
            </Typography>
            <div className="flex flex-wrap items-center gap-2">
              <Chip icon={<Building2 className="w-3.5 h-3.5" />} label={`Unidade: ${unitFilter === 'GLOBAL' ? 'Todas (GLOBAL)' : unitFilter}`} size="small" className="font-bold text-xs" />
              <Chip icon={<Tag className="w-3.5 h-3.5" />} label={`Categoria: ${categoryFilter}`} size="small" className="font-bold text-xs" />
              <Chip icon={<Calendar className="w-3.5 h-3.5" />} label={`Período: ${periodSummaryText}`} size="small" className="font-bold text-xs" />
            </div>
            <Typography variant="body2" className="font-bold text-slate-900 dark:text-slate-100 pt-1">
              Total a exportar: <span className="text-blue-600 dark:text-blue-400">{selectedIds.length > 0 ? selectedIds.length : sortedData.length} registro(s)</span>
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions className="p-4">
          <Button onClick={() => setExportModalOpen(false)} className="text-slate-600 font-bold">
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={executeExport}
            disabled={sortedData.length === 0}
            startIcon={exportFormat === 'EXCEL' ? <FileSpreadsheet className="w-4 h-4 text-white" /> : <FileText className="w-4 h-4 text-white" />}
            sx={{ color: '#ffffff !important' }}
            className={
              exportFormat === 'EXCEL'
                ? '!bg-emerald-600 hover:!bg-emerald-700 !text-white font-bold px-5 rounded-xl'
                : '!bg-rose-600 hover:!bg-rose-700 !text-white font-bold px-5 rounded-xl'
            }
          >
            Baixar {exportFormat === 'EXCEL' ? 'Excel (.XLSX)' : 'PDF Executivo'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Columns Modal */}
      <Dialog open={columnModalOpen} onClose={() => setColumnModalOpen(false)}>
        <DialogTitle className="font-bold">Gerenciar Colunas Visíveis</DialogTitle>
        <DialogContent dividers>
          <FormGroup>
            {columns.map(col => (
              <FormControlLabel
                key={col.id}
                control={
                  <Checkbox
                    checked={visibleColumnIds.includes(col.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setVisibleColumnIds([...visibleColumnIds, col.id]);
                      } else {
                        if (visibleColumnIds.length > 1) {
                          setVisibleColumnIds(visibleColumnIds.filter(id => id !== col.id));
                        }
                      }
                    }}
                  />
                }
                label={col.label}
              />
            ))}
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setColumnModalOpen(false)} color="primary">
            Concluir
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
