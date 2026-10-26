import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Tabs, Tab,
  Box, Typography, Chip, Table, TableBody, TableCell, TableHead, TableRow,
  Grid, Card, CardContent, Divider, FormControl, Select, MenuItem,
  IconButton, Snackbar, Alert, Tooltip
} from '@mui/material';
import {
  Package, MapPin, History, ShoppingBag, BarChart3, Clock, Paperclip,
  AlertTriangle, CheckCircle, FileText, Download, ShieldAlert, Sparkles,
  Upload, Trash2, Plus, FileCode, ShieldCheck, BookOpen, FileSpreadsheet,
  FileImage, Check, X
} from 'lucide-react';
import { Product, Movement, PurchaseOrder, Branch, ProductAttachment } from '../types';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { Line } from 'react-chartjs-2';

interface ProductDetailModalProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onEditProduct?: (p: Product) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product, open, onClose, onEditProduct
}) => {
  const { currentUser } = useAuth();
  const [tab, setTab] = useState(0);

  // Attachments state & drag/drop
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ProductAttachment['category']>('Ficha Técnica');
  const [isDragging, setIsDragging] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'info' | 'error'>('success');

  const [attachmentsList, setAttachmentsList] = useState<ProductAttachment[]>([]);

  // Sync attachments when product changes
  useEffect(() => {
    if (!product) return;
    if (product.attachments && product.attachments.length > 0) {
      setAttachmentsList(product.attachments);
    } else {
      // Default initial mock attachments
      const defaultAttachments: ProductAttachment[] = [
        {
          id: `att-1-${product.id}`,
          name: `Ficha_Tecnica_Seguranca_${product.code}.pdf`,
          size: 1420000,
          uploadedAt: new Date().toISOString(),
          category: 'Ficha Técnica'
        },
        {
          id: `att-2-${product.id}`,
          name: `Certificado_Homologacao_ABNT_${product.code}.pdf`,
          size: 850000,
          uploadedAt: new Date().toISOString(),
          category: 'Certificado / Laudo'
        }
      ];
      setAttachmentsList(defaultAttachments);
    }
  }, [product]);

  if (!product) return null;

  const state = dataService.getState();

  // Related data
  const productMovements = state.movements.filter(m => m.productId === product.id);
  const productPOs = state.purchaseOrders.filter(po => 
    po.items.some(item => item.productId === product.id)
  );

  const totalStockAllBranches = Object.values(product.stockByBranch).reduce((a, b) => a + b, 0);

  // Expiration calculation
  let expStatus: 'NORMAL' | 'EXPIRING' | 'EXPIRED' = 'NORMAL';
  let daysToExp: number | null = null;
  if (product.expirationDate) {
    const exp = new Date(product.expirationDate);
    const now = new Date();
    const diffTime = exp.getTime() - now.getTime();
    daysToExp = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (daysToExp < 0) expStatus = 'EXPIRED';
    else if (daysToExp <= 60) expStatus = 'EXPIRING';
  }

  // Consolidação de Lotes e Validade por Unidade Operacional
  const branchesList = state.branches && state.branches.length > 0 ? state.branches : [
    { id: 'b-sp', code: 'SP', name: 'Unidade São Paulo (Matriz)', city: 'São Paulo', active: true },
    { id: 'b-rj', code: 'RJ', name: 'Unidade Rio de Janeiro', city: 'Rio de Janeiro', active: true },
    { id: 'b-sjrp', code: 'SJRP', name: 'Unidade São José do Rio Preto', city: 'São José do Rio Preto', active: true },
    { id: 'b-bsb', code: 'BSB', name: 'Unidade Brasília', city: 'Brasília', active: true }
  ];

  const batchPerBranch = branchesList.map(b => {
    const qty = (product.stockByBranch && product.stockByBranch[b.code] !== undefined)
      ? Number(product.stockByBranch[b.code])
      : 0;
    const branchBatch = product.batches?.find(pb => pb.branch === b.code);
    const batchCode = branchBatch?.batchNumber || product.batchNumber || 'LT-PADRAO';
    const batchExp = branchBatch?.expirationDate || product.expirationDate;

    let branchExpStatus: 'NORMAL' | 'EXPIRING' | 'EXPIRED' | 'NONE' = 'NONE';
    let branchDays: number | null = null;
    if (batchExp) {
      const exp = new Date(batchExp);
      const diffTime = exp.getTime() - new Date().getTime();
      branchDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (branchDays < 0) branchExpStatus = 'EXPIRED';
      else if (branchDays <= 60) branchExpStatus = 'EXPIRING';
      else branchExpStatus = 'NORMAL';
    }

    return {
      branchCode: b.code,
      branchName: b.name,
      quantity: qty,
      batchNumber: batchCode,
      expirationDate: batchExp,
      daysToExp: branchDays,
      status: branchExpStatus,
      notes: branchBatch?.notes
    };
  });

  const uniqueBatches = Array.from(new Set(batchPerBranch.map(b => b.batchNumber).filter(Boolean)));
  const isSameBatchAcrossAllBranches = uniqueBatches.length <= 1;
  const expiredStockTotal = batchPerBranch.reduce((acc, b) => b.status === 'EXPIRED' ? acc + b.quantity : acc, 0);
  const financialLossExpired = expiredStockTotal * (product.unitPrice || 0);

  // Monthly consumption chart data simulation/calculation
  const chartData = {
    labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul'],
    datasets: [
      {
        label: 'Consumo Mensal (Unidades)',
        data: [12, 19, 15, 25, 22, 30, productMovements.filter(m => m.type === 'SAIDA').reduce((sum, m) => sum + m.quantity, 0)],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.3,
        fill: true
      }
    ]
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Helper for file type icon
  const getFileIcon = (name: string, category?: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText className="w-5 h-5 text-rose-500" />;
    if (['doc', 'docx'].includes(ext || '')) return <BookOpen className="w-5 h-5 text-blue-500" />;
    if (['xls', 'xlsx', 'csv'].includes(ext || '')) return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext || '')) return <FileImage className="w-5 h-5 text-purple-500" />;
    if (category === 'Certificado / Laudo') return <ShieldCheck className="w-5 h-5 text-emerald-500" />;
    if (category === 'FISPQ') return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    return <Paperclip className="w-5 h-5 text-slate-500" />;
  };

  // Handle uploading files
  const processFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    let processedCount = 0;
    const newAttachments: ProductAttachment[] = [];

    fileArray.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const newAtt: ProductAttachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          category: selectedCategory || 'Ficha Técnica',
          dataUrl
        };

        newAttachments.push(newAtt);
        processedCount++;

        if (processedCount === fileArray.length) {
          setAttachmentsList((prev) => {
            const updated = [...newAttachments, ...prev];
            // Save to dataService
            try {
              if (currentUser) {
                dataService.saveProduct({ ...product, attachments: updated }, currentUser);
              }
            } catch (err) {
              console.error('Erro ao salvar anexos no produto:', err);
            }
            return updated;
          });

          setSnackbarSeverity('success');
          setSnackbarMessage(`${fileArray.length} arquivo(s) importado(s) e anexado(s) com sucesso!`);
        }
      };

      reader.onerror = () => {
        setSnackbarSeverity('error');
        setSnackbarMessage(`Erro ao carregar o arquivo ${file.name}`);
      };

      reader.readAsDataURL(file);
    });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  // Download attachment
  const handleDownload = (att: ProductAttachment) => {
    if (att.dataUrl) {
      const link = document.createElement('a');
      link.href = att.dataUrl;
      link.download = att.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Fallback synthetic file generator for mock attachments
      const content = `Almox Plus ERP - Documento Oficial\n` +
        `----------------------------------------\n` +
        `Código Produto (SKU): ${product.code}\n` +
        `Nome Produto: ${product.name}\n` +
        `Nome do Anexo: ${att.name}\n` +
        `Tipo / Categoria: ${att.category || 'Documento Técnico'}\n` +
        `Data do Registro: ${new Date(att.uploadedAt).toLocaleString('pt-BR')}\n` +
        `Status: Documento homologado e verificado.\n`;

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = att.name.replace(/\.pdf$/, '.txt');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    setSnackbarSeverity('info');
    setSnackbarMessage(`Download do arquivo "${att.name}" iniciado.`);
  };

  // Delete attachment
  const handleDeleteAttachment = (attId: string, attName: string) => {
    setAttachmentsList((prev) => {
      const updated = prev.filter(item => item.id !== attId);
      try {
        if (currentUser) {
          dataService.saveProduct({ ...product, attachments: updated }, currentUser);
        }
      } catch (err) {
        console.error('Erro ao atualizar produto no dataService:', err);
      }
      return updated;
    });
    setSnackbarSeverity('success');
    setSnackbarMessage(`Anexo "${attName}" removido.`);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle className="bg-slate-900 text-white font-bold p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-600/30 text-blue-400">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <Typography variant="h6" className="font-extrabold text-sm md:text-base leading-tight">
              {product.name}
            </Typography>
            <Typography variant="caption" className="text-slate-400 font-mono text-xs">
              SKU: {product.code} | Categoria: {product.category}
            </Typography>
          </div>
        </div>
        <Chip
          label={product.active ? 'Ativo no ERP' : 'Inativo'}
          color={product.active ? 'success' : 'default'}
          size="small"
          className="font-bold text-xs"
        />
      </DialogTitle>

      <Box className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4">
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab icon={<Package className="w-4 h-4" />} iconPosition="start" label="1. Geral" className="font-bold text-xs" />
          <Tab icon={<MapPin className="w-4 h-4" />} iconPosition="start" label="2. Estoque por Cidade" className="font-bold text-xs" />
          <Tab icon={<History className="w-4 h-4" />} iconPosition="start" label="3. Movimentações" className="font-bold text-xs" />
          <Tab icon={<ShoppingBag className="w-4 h-4" />} iconPosition="start" label="4. Compras" className="font-bold text-xs" />
          <Tab icon={<BarChart3 className="w-4 h-4" />} iconPosition="start" label="5. Consumo" className="font-bold text-xs" />
          <Tab icon={<Clock className="w-4 h-4" />} iconPosition="start" label="6. Validade" className="font-bold text-xs" />
          <Tab icon={<Paperclip className="w-4 h-4" />} iconPosition="start" label="7. Anexos & Ficha" className="font-bold text-xs" />
        </Tabs>
      </Box>

      <DialogContent dividers className="p-6 bg-slate-50/50 dark:bg-slate-950/30 min-h-[420px]">
        {/* TAB 1: GERAL */}
        {tab === 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Card className="rounded-xl p-4 border-slate-200 dark:border-slate-800">
                  <Typography variant="caption" className="text-slate-400 font-bold uppercase text-[10px]">
                    Código SKU / Ficha
                  </Typography>
                  <Typography variant="h6" className="font-mono font-bold text-blue-600 mt-1">
                    {product.code}
                  </Typography>
                </Card>
              </div>

              <div>
                <Card className="rounded-xl p-4 border-slate-200 dark:border-slate-800">
                  <Typography variant="caption" className="text-slate-400 font-bold uppercase text-[10px]">
                    Preço Médio de Aquisição
                  </Typography>
                  <Typography variant="h6" className="font-bold text-emerald-600 mt-1">
                    R$ {product.unitPrice.toFixed(2)} / {product.unit}
                  </Typography>
                </Card>
              </div>

              <div>
                <Card className="rounded-xl p-3 border-slate-200 dark:border-slate-800">
                  <Typography variant="caption" className="text-slate-500 font-bold text-[10px]">
                    Estoque Mínimo
                  </Typography>
                  <Typography variant="body1" className="font-bold text-rose-600">
                    {product.minStock} {product.unit}
                  </Typography>
                </Card>
              </div>

              <div>
                <Card className="rounded-xl p-3 border-slate-200 dark:border-slate-800">
                  <Typography variant="caption" className="text-slate-500 font-bold text-[10px]">
                    Estoque Máximo
                  </Typography>
                  <Typography variant="body1" className="font-bold text-slate-800 dark:text-slate-200">
                    {product.maxStock} {product.unit}
                  </Typography>
                </Card>
              </div>

              <div className="sm:col-span-2">
                <Card className="rounded-xl p-3 border-slate-200 dark:border-slate-800">
                  <Typography variant="caption" className="text-slate-500 font-bold text-[10px]">
                    Localização no Galpão
                  </Typography>
                  <Typography variant="body1" className="font-bold text-indigo-600">
                    Prateleira {product.locationSlot || 'A1'}
                  </Typography>
                </Card>
              </div>
            </div>

            <Card className="rounded-xl p-4 border-slate-200 dark:border-slate-800">
              <Typography variant="subtitle2" className="font-bold text-xs text-slate-800 dark:text-slate-200 mb-1">
                Descrição Técnica do Item
              </Typography>
              <Typography variant="body2" className="text-xs text-slate-600 dark:text-slate-400">
                {product.description || 'Produto cadastrado no acervo geral do almoxarifado ERP. Utilizado para suprimentos e requisições internas de centro de custo.'}
              </Typography>
            </Card>
          </div>
        )}

        {/* TAB 2: ESTOQUE POR CIDADE */}
        {tab === 1 && (
          <div className="space-y-4">
            <Box className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl flex items-center justify-between">
              <Typography variant="body2" className="text-xs font-bold text-blue-900 dark:text-blue-200">
                Saldo Consolidado Total no Brasil:
              </Typography>
              <Chip label={`${totalStockAllBranches} ${product.unit}`} color="primary" className="font-bold text-xs" />
            </Box>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {dataService.getBranches().map(b => {
                const qty = product.stockByBranch[b.code] || 0;
                const isLow = qty <= product.minStock;
                return (
                  <Card key={b.id} className={`rounded-xl p-4 border ${isLow ? 'border-rose-300 bg-rose-50/40 dark:bg-rose-950/20' : 'border-slate-200 dark:border-slate-800'}`}>
                    <div className="flex items-center justify-between">
                      <Typography variant="caption" className="font-bold text-slate-500 uppercase text-[10px]">
                        Unidade {b.code}
                      </Typography>
                      <Chip label={b.city} size="small" variant="outlined" className="text-[9px] h-4" />
                    </div>
                    <Typography variant="h5" className={`font-extrabold mt-1 ${isLow ? 'text-rose-600' : 'text-slate-900 dark:text-slate-100'}`}>
                      {qty} <span className="text-xs font-normal text-slate-500">{product.unit}</span>
                    </Typography>
                    <Typography variant="caption" className={`text-[10px] block mt-1 font-bold ${isLow ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {isLow ? '⚠ Abaixo do Mínimo' : '✓ Nível Seguro'}
                    </Typography>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: MOVIMENTAÇÕES */}
        {tab === 2 && (
          <Table size="small">
            <TableHead className="bg-slate-100 dark:bg-slate-800">
              <TableRow>
                <TableCell className="font-bold text-xs">Data</TableCell>
                <TableCell className="font-bold text-xs">Tipo</TableCell>
                <TableCell className="font-bold text-xs">Unidade</TableCell>
                <TableCell align="right" className="font-bold text-xs">Quantidade</TableCell>
                <TableCell className="font-bold text-xs">Responsável</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {productMovements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" className="py-6 text-slate-400">
                    Nenhuma movimentação registrada para este produto.
                  </TableCell>
                </TableRow>
              ) : (
                productMovements.map(m => (
                  <TableRow key={m.id} hover>
                    <TableCell className="text-xs">{new Date(m.date).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>
                      <Chip label={m.type} size="small" color={m.type === 'ENTRADA' ? 'success' : 'error'} className="text-[9px] font-bold h-4" />
                    </TableCell>
                    <TableCell className="text-xs font-bold">{m.branch}</TableCell>
                    <TableCell align="right" className="text-xs font-bold">{m.quantity}</TableCell>
                    <TableCell className="text-xs">{m.responsibleUser}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}

        {/* TAB 4: COMPRAS */}
        {tab === 3 && (
          <Table size="small">
            <TableHead className="bg-slate-100 dark:bg-slate-800">
              <TableRow>
                <TableCell className="font-bold text-xs">Nº Ordem (OC)</TableCell>
                <TableCell className="font-bold text-xs">Fornecedor</TableCell>
                <TableCell className="font-bold text-xs">Unidade</TableCell>
                <TableCell className="font-bold text-xs">Status</TableCell>
                <TableCell align="right" className="font-bold text-xs">Valor Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {productPOs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" className="py-6 text-slate-400">
                    Nenhuma ordem de compra registrada para este item.
                  </TableCell>
                </TableRow>
              ) : (
                productPOs.map(po => (
                  <TableRow key={po.id} hover>
                    <TableCell className="text-xs font-mono font-bold">{po.code}</TableCell>
                    <TableCell className="text-xs">{po.supplierName}</TableCell>
                    <TableCell className="text-xs">{po.branch}</TableCell>
                    <TableCell>
                      <Chip label={po.status} size="small" color={po.status === 'ENTREGUE' ? 'success' : 'warning'} className="text-[9px] font-bold h-4" />
                    </TableCell>
                    <TableCell align="right" className="text-xs font-bold">R$ {po.totalValue.toFixed(2)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}

        {/* TAB 5: CONSUMO */}
        {tab === 4 && (
          <Box className="space-y-4">
            <Typography variant="subtitle2" className="font-bold text-xs text-slate-700 dark:text-slate-300">
              Histórico de Consumo e Saídas Mensais
            </Typography>
            <Box className="h-56">
              <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />
            </Box>
          </Box>
        )}

        {/* TAB 6: VALIDADE & LOTES */}
        {tab === 5 && (
          <Box className="space-y-4">
            {/* CARDS DE TOPO: DATA DE VALIDADE, LOTE PRINCIPAL E HOMOGENEIDADE */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card className="rounded-xl p-4 border-slate-200 dark:border-slate-800">
                <Typography variant="caption" className="text-slate-400 font-bold uppercase text-[10px] block">
                  Data de Validade Geral
                </Typography>
                <div className="flex items-center justify-between mt-1.5">
                  <Typography variant="h6" className="font-bold text-slate-900 dark:text-slate-100 text-sm md:text-base">
                    {product.expirationDate ? new Date(product.expirationDate).toLocaleDateString('pt-BR') : 'Sem controle'}
                  </Typography>
                  {product.expirationDate && (
                    <Chip
                      label={expStatus === 'EXPIRED' ? 'VENCIDO' : expStatus === 'EXPIRING' ? `Vence em ${daysToExp}d` : 'Dentro do Prazo'}
                      color={expStatus === 'EXPIRED' ? 'error' : expStatus === 'EXPIRING' ? 'warning' : 'success'}
                      size="small"
                      className="font-bold text-[11px]"
                    />
                  )}
                </div>
              </Card>

              <Card className="rounded-xl p-4 border-slate-200 dark:border-slate-800">
                <Typography variant="caption" className="text-slate-400 font-bold uppercase text-[10px] block">
                  Código do Lote Registrado
                </Typography>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded text-sm">
                    {product.batchNumber || 'LT-PADRAO'}
                  </span>
                </div>
              </Card>

              <Card className="rounded-xl p-4 border-slate-200 dark:border-slate-800">
                <Typography variant="caption" className="text-slate-400 font-bold uppercase text-[10px] block">
                  Consolidação entre Unidades
                </Typography>
                <div className="mt-1.5">
                  {isSameBatchAcrossAllBranches ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-1 rounded-md">
                      <Check className="w-3.5 h-3.5" />
                      Mesmo lote em todas as unidades
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-1 rounded-md">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Lotes distintos por unidade
                    </span>
                  )}
                </div>
              </Card>
            </div>

            {/* ALERTA OPERACIONAL DE VENCIMENTO / EXPIRAÇÃO */}
            {expStatus === 'EXPIRED' && (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200 font-bold text-xs">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>PRODUTO COM VALIDADE VENCIDA — AÇÃO OPERACIONAL OBRIGATÓRIA</span>
                  </div>
                  <span className="font-bold text-xs text-rose-700 dark:text-rose-300">
                    Prejuízo Total: R$ {financialLossExpired.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <Typography variant="body2" className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                  As <strong>{expiredStockTotal} unidades</strong> distribuídas nas filiais pertencem ao lote <strong>{product.batchNumber || 'LT-PADRAO'}</strong> com validade expirada. É vedada qualquer liberação para consumo ou requisição. Proceder imediatamente com a segregação física em quarentena e protocolo de descarte/baixa por avaria.
                </Typography>
              </div>
            )}

            {expStatus === 'EXPIRING' && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-amber-800 dark:text-amber-200 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Alerta de Vencimento Próximo (vence em {daysToExp} dias). Priorizar expedição e consumo deste lote conforme regra FEFO (First-Expired, First-Out).
                </span>
              </div>
            )}

            {/* TABELA DE DETALHAMENTO DE LOTES POR UNIDADE */}
            <Card className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <Box className="p-3 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <Typography variant="subtitle2" className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Rastreabilidade de Lotes e Validade por Filial
                </Typography>
                <Typography variant="caption" className="text-slate-400 text-[11px]">
                  Total Físico: <strong>{totalStockAllBranches} {product.unit}</strong>
                </Typography>
              </Box>

              <Table size="small">
                <TableHead>
                  <TableRow className="bg-slate-100/50 dark:bg-slate-900/40">
                    <TableCell className="font-bold text-[11px] text-slate-500">Unidade Operacional</TableCell>
                    <TableCell className="font-bold text-[11px] text-slate-500">Lote Registrado</TableCell>
                    <TableCell align="center" className="font-bold text-[11px] text-slate-500">Saldo em Estoque</TableCell>
                    <TableCell className="font-bold text-[11px] text-slate-500">Data de Validade</TableCell>
                    <TableCell className="font-bold text-[11px] text-slate-500">Situação</TableCell>
                    <TableCell className="font-bold text-[11px] text-slate-500">Ação Recomendada</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {batchPerBranch.map((item) => {
                    const isExp = item.status === 'EXPIRED';
                    const isNear = item.status === 'EXPIRING';

                    return (
                      <TableRow key={item.branchCode} hover className={isExp ? 'bg-rose-50/30 dark:bg-rose-950/20' : ''}>
                        <TableCell>
                          <div className="font-bold text-xs text-slate-800 dark:text-slate-200">
                            Unidade {item.branchCode}
                          </div>
                          <div className="text-[10px] text-slate-400">{item.branchName}</div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono font-bold text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded">
                            {item.batchNumber}
                          </span>
                        </TableCell>
                        <TableCell align="center">
                          <span className={`font-bold text-xs ${item.quantity > 0 ? (isExp ? 'text-rose-600' : 'text-slate-800 dark:text-slate-200') : 'text-slate-400'}`}>
                            {item.quantity} {product.unit}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {item.expirationDate ? new Date(item.expirationDate).toLocaleDateString('pt-BR') : 'Sem controle'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {isExp ? (
                            <Chip label={`Vencido (${Math.abs(item.daysToExp || 0)}d)`} color="error" size="small" className="text-[10px] font-bold h-5" />
                          ) : isNear ? (
                            <Chip label={`Vence em ${item.daysToExp}d`} color="warning" size="small" className="text-[10px] font-bold h-5" />
                          ) : item.expirationDate ? (
                            <Chip label="Em dia" color="success" size="small" className="text-[10px] font-bold h-5" />
                          ) : (
                            <span className="text-[10px] text-slate-400">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isExp && item.quantity > 0 ? (
                            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded inline-block">
                              Segregar / Descarte
                            </span>
                          ) : isNear && item.quantity > 0 ? (
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded inline-block">
                              Consumo Prioritário
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500">Operação Normal</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </Box>
        )}

        {/* TAB 7: ANEXOS & FICHA TÉCNICA */}
        {tab === 6 && (
          <Box className="space-y-4">
            {/* FILE UPLOAD / IMPORT BOX */}
            <Card 
              className={`rounded-2xl border-2 border-dashed p-4 transition-all duration-200 ${
                isDragging 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 shadow-md' 
                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:border-blue-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInputChange}
                hidden
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
              />

              <div className="flex flex-col items-center justify-center text-center space-y-3 py-2">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs">
                  <Upload className="w-6 h-6 animate-pulse" />
                </div>

                <div>
                  <Typography variant="subtitle2" className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">
                    Importar Anexos, Laudos & Fichas Técnicas
                  </Typography>
                  <Typography variant="caption" className="text-slate-500 dark:text-slate-400 block text-xs mt-0.5">
                    Arraste e solte seus arquivos aqui, ou selecione uma categoria e clique no botão abaixo.
                  </Typography>
                </div>

                {/* CATEGORY & ACTION BAR */}
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1 w-full max-w-lg">
                  <FormControl size="small" className="min-w-[170px]">
                    <Select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value as any)}
                      className="bg-slate-50 dark:bg-slate-800 text-xs font-semibold rounded-xl h-9"
                    >
                      <MenuItem value="Ficha Técnica" className="text-xs font-semibold">📄 Ficha Técnica</MenuItem>
                      <MenuItem value="Certificado / Laudo" className="text-xs font-semibold">🛡️ Certificado / Laudo</MenuItem>
                      <MenuItem value="Manual" className="text-xs font-semibold">📘 Manual de Uso</MenuItem>
                      <MenuItem value="FISPQ" className="text-xs font-semibold">⚠️ FISPQ / Segurança</MenuItem>
                      <MenuItem value="Outro" className="text-xs font-semibold">📎 Outro Documento</MenuItem>
                    </Select>
                  </FormControl>

                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<Upload className="w-4 h-4" />}
                    onClick={() => fileInputRef.current?.click()}
                    className="font-bold text-xs h-9 rounded-xl shadow-xs px-4"
                  >
                    Selecionar Arquivo
                  </Button>
                </div>

                <Typography variant="caption" className="text-[10px] text-slate-400 font-mono">
                  Formatos aceitos: PDF, DOCX, XLSX, PNG, JPG, ZIP (até 25 MB por arquivo)
                </Typography>
              </div>
            </Card>

            <Divider className="my-2 border-slate-200 dark:border-slate-800" />

            {/* ATTACHMENTS LIST */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Typography variant="subtitle2" className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-blue-600" />
                  Documentos & Fichas Técnicas Anexadas ({attachmentsList.length})
                </Typography>
                <Typography variant="caption" className="text-slate-400 text-[11px]">
                  Vinculados ao SKU: <span className="font-mono font-bold text-slate-600 dark:text-slate-300">{product.code}</span>
                </Typography>
              </div>

              {attachmentsList.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <FileCode className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <Typography variant="body2" className="text-xs font-medium text-slate-500">
                    Nenhum anexo ou ficha técnica cadastrado para este produto.
                  </Typography>
                  <Typography variant="caption" className="text-[11px] text-slate-400 block mt-1">
                    Utilize a área de upload acima para anexar PDFs, manuais e laudos técnicos.
                  </Typography>
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {attachmentsList.map((att) => {
                    const badgeColor = 
                      att.category === 'Certificado / Laudo' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                      att.category === 'FISPQ' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' :
                      att.category === 'Manual' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300' :
                      'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300';

                    return (
                      <div 
                        key={att.id} 
                        className="p-3 bg-white dark:bg-slate-900/90 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
                            {getFileIcon(att.name, att.category)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-[280px]" title={att.name}>
                                {att.name}
                              </span>
                              {att.category && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${badgeColor}`}>
                                  {att.category}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium mt-0.5">
                              <span>Tamanho: {formatFileSize(att.size)}</span>
                              <span>•</span>
                              <span>Data: {new Date(att.uploadedAt).toLocaleDateString('pt-BR')}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button 
                            size="small" 
                            variant="outlined" 
                            color="primary"
                            startIcon={<Download className="w-3.5 h-3.5" />}
                            onClick={() => handleDownload(att)}
                            className="text-[11px] font-bold py-1 px-2.5 rounded-lg border-slate-300 dark:border-slate-700"
                          >
                            Baixar
                          </Button>
                          <Tooltip title="Excluir este anexo">
                            <IconButton 
                              size="small" 
                              onClick={() => handleDeleteAttachment(att.id, att.name)}
                              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1.5 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </IconButton>
                          </Tooltip>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Box>
        )}
      </DialogContent>

      <Snackbar
        open={Boolean(snackbarMessage)}
        autoHideDuration={4000}
        onClose={() => setSnackbarMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbarMessage(null)} 
          severity={snackbarSeverity}
          variant="filled"
          className="font-bold text-xs shadow-lg"
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>

      <DialogActions className="p-4 bg-slate-900 text-white flex justify-between">
        {onEditProduct && (
          <Button
            onClick={() => {
              onClose();
              onEditProduct(product);
            }}
            variant="outlined"
            className="border-slate-700 text-white hover:bg-slate-800 font-bold text-xs"
          >
            Editar Cadastro
          </Button>
        )}
        <Button onClick={onClose} variant="contained" color="primary" className="font-bold text-xs">
          Fechar Visualização
        </Button>
      </DialogActions>
    </Dialog>
  );
};
