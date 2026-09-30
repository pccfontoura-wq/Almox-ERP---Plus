import React, { useState, useEffect, useRef } from 'react';
import { Box, InputBase, Paper, Typography, Chip } from '@mui/material';
import { Search, Package, ShoppingCart, Landmark, Calculator, Users, Tag, X, Building2 } from 'lucide-react';
import { dataService } from '../services/dataService';
import { AppIcon } from './AppIcon';

interface SearchResultItem {
  id: string;
  category: 'Produto' | 'Ordem de Compra' | 'Patrimônio' | 'Centro de Custo' | 'Unidade' | 'Usuário';
  title: string;
  subtitle: string;
  code?: string;
}

export const GlobalSearchBar: React.FC = () => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (text: string) => {
    setQuery(text);
    if (!text.trim() || text.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    const state = dataService.getState();
    const term = text.toLowerCase();
    const items: SearchResultItem[] = [];

    // Search Products
    state.products.forEach(p => {
      if (p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term) || p.category.toLowerCase().includes(term)) {
        items.push({
          id: p.id,
          category: 'Produto',
          title: p.name,
          subtitle: `SKU: ${p.code} | Categoria: ${p.category}`,
          code: p.code
        });
      }
    });

    // Search Purchase Orders
    state.purchaseOrders.forEach(po => {
      if (po.id.toLowerCase().includes(term) || po.supplierName.toLowerCase().includes(term)) {
        items.push({
          id: po.id,
          category: 'Ordem de Compra',
          title: `Ordem ${po.id}`,
          subtitle: `Fornecedor: ${po.supplierName} | Status: ${po.status}`,
          code: po.id
        });
      }
    });

    // Search Assets
    state.assets.forEach(a => {
      if (a.name.toLowerCase().includes(term) || a.assetTag.toLowerCase().includes(term)) {
        items.push({
          id: a.id,
          category: 'Patrimônio',
          title: a.name,
          subtitle: `Tombamento: ${a.assetTag} | Responsável: ${a.borrowedTo || 'N/A'}`,
          code: a.assetTag
        });
      }
    });

    // Search Cost Centers
    state.costCenters.forEach(cc => {
      if (cc.name.toLowerCase().includes(term) || cc.code.toLowerCase().includes(term)) {
        items.push({
          id: cc.id,
          category: 'Centro de Custo',
          title: cc.name,
          subtitle: `Código: ${cc.code} | Gestor: ${cc.responsible}`,
          code: cc.code
        });
      }
    });

    // Search Unidades
    (state.branches || []).forEach(b => {
      if (
        b.name.toLowerCase().includes(term) ||
        b.code.toLowerCase().includes(term) ||
        b.city.toLowerCase().includes(term) ||
        (b.corporateName && b.corporateName.toLowerCase().includes(term)) ||
        (b.cnpj && b.cnpj.toLowerCase().includes(term))
      ) {
        items.push({
          id: b.id,
          category: 'Unidade',
          title: `${b.code} - ${b.name}`,
          subtitle: `Razão Social: ${b.corporateName || b.name} | CNPJ: ${b.cnpj || 'N/A'} | ${b.city}/${b.state}`,
          code: b.code
        });
      }
    });

    // Search Users
    state.users.forEach(u => {
      if (u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)) {
        items.push({
          id: u.id,
          category: 'Usuário',
          title: u.name,
          subtitle: `Email: ${u.email} | Perfil: ${u.role}`,
        });
      }
    });

    setResults(items.slice(0, 8));
    setOpen(true);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Produto': return <AppIcon icon={Package} size={16} className="text-blue-500" />;
      case 'Ordem de Compra': return <AppIcon icon={ShoppingCart} size={16} className="text-amber-500" />;
      case 'Patrimônio': return <AppIcon icon={Landmark} size={16} className="text-purple-500" />;
      case 'Centro de Custo': return <AppIcon icon={Calculator} size={16} className="text-emerald-500" />;
      case 'Unidade': return <AppIcon icon={Building2} size={16} className="text-cyan-600" />;
      case 'Usuário': return <AppIcon icon={Users} size={16} className="text-indigo-500" />;
      default: return <AppIcon icon={Tag} size={16} className="text-slate-500" />;
    }
  };

  return (
    <div ref={searchRef} className="w-full relative">
      <Box className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 focus-within:border-blue-600 dark:focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all duration-200 shadow-xs">
        <AppIcon icon={Search} size={18} className="text-slate-500 dark:text-slate-400" />
        <InputBase
          inputRef={inputRef}
          placeholder="Pesquisar produtos, unidades, OCs, patrimônio, centros de custo..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full text-xs font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
        />
        {!query && (
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-400 bg-slate-200 dark:bg-slate-700 rounded border border-slate-300 dark:border-slate-600">
            Ctrl K
          </kbd>
        )}
        {query && (
          <button onClick={() => handleSearch('')} className="text-slate-400 hover:text-slate-600 transition-colors">
            <AppIcon icon={X} size={14} />
          </button>
        )}
      </Box>

      {/* Autocomplete Results Dropdown */}
      {open && (
        <Paper className="absolute left-0 right-0 top-11 z-50 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden max-h-96 overflow-y-auto">
          {results.length === 0 ? (
            <Box className="p-4 text-center text-slate-500 text-xs">
              Nenhum resultado encontrado para &quot;{query}&quot;.
            </Box>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <Box className="p-2 bg-slate-50 dark:bg-slate-800/40 px-3">
                <Typography variant="caption" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Resultados da Busca ({results.length})
                </Typography>
              </Box>
              {results.map((item) => (
                <div
                  key={`${item.category}-${item.id}`}
                  onClick={() => {
                    setOpen(false);
                    setQuery('');
                  }}
                  className="p-3 hover:bg-blue-50/60 dark:hover:bg-slate-800/80 cursor-pointer flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                      {getCategoryIcon(item.category)}
                    </div>
                    <div>
                      <Typography variant="body2" className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                        {item.title}
                      </Typography>
                      <Typography variant="caption" className="text-[11px] text-slate-500 dark:text-slate-400 block">
                        {item.subtitle}
                      </Typography>
                    </div>
                  </div>
                  <Chip
                    label={item.category}
                    size="small"
                    className="text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 h-5"
                  />
                </div>
              ))}
            </div>
          )}
        </Paper>
      )}
    </div>
  );
};
