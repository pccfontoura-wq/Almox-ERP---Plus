import React, { useState, useMemo } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  TextField, InputAdornment, IconButton, Button, Menu, MenuItem, Checkbox,
  TablePagination, TableSortLabel, Box, Typography, Chip, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogActions, FormGroup, FormControlLabel
} from '@mui/material';
import { 
  Search, FileSpreadsheet, FileText, Printer, Columns, Filter, ChevronDown, RefreshCw 
} from 'lucide-react';
import { exportToExcel, exportToPDF, printPage } from '../utils/exportUtils';
import { AppIcon } from './AppIcon';

export interface Column<T> {
  id: string;
  label: string;
  accessor: (row: T) => any;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: (row: T) => React.ReactNode;
  exportable?: boolean;
}

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
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [orderBy, setOrderBy] = useState<string>(columns[0]?.id || '');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(columns.map(c => c.id));
  const [columnModalOpen, setColumnModalOpen] = useState(false);

  // Search and Filter logic
  const filteredData = useMemo(() => {
    return data.filter(row => {
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return columns.some(col => {
        const val = col.accessor(row);
        return String(val ?? '').toLowerCase().includes(term);
      });
    });
  }, [data, search, columns]);

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

  // Export Excel
  const handleExportExcel = () => {
    const exportColumns = activeColumns.filter(c => c.id !== 'actions' && c.exportable !== false);
    const exportRows = (selectedIds.length > 0 
      ? data.filter(d => selectedIds.includes(d.id))
      : sortedData
    ).map(row => {
      const obj: Record<string, any> = {};
      exportColumns.forEach(col => {
        obj[col.label] = col.accessor(row);
      });
      return obj;
    });

    exportToExcel(exportRows, `exportacao-${title.toLowerCase().replace(/\s+/g, '-')}`);
  };

  // Export PDF
  const handleExportPDF = () => {
    const targetData = selectedIds.length > 0 
      ? data.filter(d => selectedIds.includes(d.id))
      : sortedData;

    const exportColumns = activeColumns.filter(c => c.id !== 'actions' && c.exportable !== false);
    const headers = exportColumns.map(c => c.label);
    const rows = targetData.map(row => 
      exportColumns.map(c => {
        const val = c.accessor(row);
        return val == null ? '' : String(val);
      })
    );

    exportToPDF(title, headers, rows, `relatorio-${title.toLowerCase().replace(/\s+/g, '-')}`, subTitle);
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
              className="bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-medium px-4 py-2"
            >
              + {addButtonLabel}
            </Button>
          )}

          <Tooltip title="Exportar para Excel (XLSX)">
            <Button
              variant="outlined"
              size="small"
              onClick={handleExportExcel}
              startIcon={<AppIcon icon={FileSpreadsheet} size={16} className="text-emerald-600" />}
              className="border-slate-300 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-800"
            >
              Excel
            </Button>
          </Tooltip>

          <Tooltip title="Exportar Relatório PDF">
            <Button
              variant="outlined"
              size="small"
              onClick={handleExportPDF}
              startIcon={<AppIcon icon={FileText} size={16} className="text-rose-600" />}
              className="border-slate-300 text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-slate-800"
            >
              PDF
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

      {/* Search Input Bar */}
      <Box className="mb-4">
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
          className="bg-slate-50 dark:bg-slate-800/50 rounded-lg"
        />
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
                  Nenhum registro encontrado.
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
