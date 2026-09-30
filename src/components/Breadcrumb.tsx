import React from 'react';
import { Breadcrumbs, Link, Typography, Box } from '@mui/material';
import { ChevronRight, Home } from 'lucide-react';
import { AppIcon } from './AppIcon';

interface BreadcrumbProps {
  items: { label: string; href?: string }[];
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  return (
    <Box className="mb-4">
      <Breadcrumbs 
        separator={<AppIcon icon={ChevronRight} size={16} className="text-slate-400" />} 
        aria-label="breadcrumb"
      >
        <Link 
          color="inherit" 
          href="#" 
          className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          <AppIcon icon={Home} size={14} className="text-slate-500" />
          Almox Plus
        </Link>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return isLast ? (
            <Typography key={index} className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              {item.label}
            </Typography>
          ) : (
            <Link
              key={index}
              color="inherit"
              href={item.href || '#'}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              {item.label}
            </Link>
          );
        })}
      </Breadcrumbs>
    </Box>
  );
};

