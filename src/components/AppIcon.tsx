import React from 'react';
import { LucideIcon } from 'lucide-react';

export type AppIconVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple'
  | 'sidebar'
  | 'card'
  | 'inherit';

export interface AppIconProps {
  icon: LucideIcon | React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  size?: number | string;
  color?: string;
  variant?: AppIconVariant;
  className?: string;
}

export const AppIcon: React.FC<AppIconProps> = ({
  icon: IconComponent,
  size = 20,
  color,
  variant = 'inherit',
  className = '',
}) => {
  if (!IconComponent) return null;

  const variantClassMap: Record<AppIconVariant, string> = {
    primary: 'text-blue-600 dark:text-blue-400',
    secondary: 'text-slate-500 dark:text-slate-400',
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-500 dark:text-amber-400',
    danger: 'text-rose-600 dark:text-rose-400',
    info: 'text-sky-500 dark:text-sky-400',
    purple: 'text-purple-600 dark:text-purple-400',
    sidebar: 'text-slate-400 hover:text-slate-100',
    card: 'text-slate-600 dark:text-slate-300',
    inherit: 'text-current',
  };

  const styleObj: React.CSSProperties = {
    width: typeof size === 'number' ? `${size}px` : size,
    height: typeof size === 'number' ? `${size}px` : size,
  };

  if (color) {
    styleObj.color = color;
  }

  const combinedClasses = `${variant !== 'inherit' && !color ? variantClassMap[variant] : ''} ${className}`.trim();

  return <IconComponent className={combinedClasses} style={styleObj} />;
};
