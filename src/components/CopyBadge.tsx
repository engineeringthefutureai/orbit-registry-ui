import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';
import { useToast } from '../context/ToastContext';

interface CopyBadgeProps {
  text: string;
  copyValue: string;
  variant?: 'tag' | 'digest' | 'mono';
  title?: string;
  className?: string;
}

export function CopyBadge({
  text,
  copyValue,
  variant = 'tag',
  title,
  className = '',
}: CopyBadgeProps) {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await copyToClipboard(copyValue);
    if (success) {
      setCopied(true);
      showToast(`Copied: ${copyValue}`);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const baseStyles =
    'group inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono transition-all duration-150 cursor-pointer select-none';

  const variantStyles = {
    tag: 'bg-indigo-950/80 text-indigo-300 hover:bg-indigo-900 border border-indigo-700/50 hover:border-indigo-500',
    digest: 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800 hover:border-slate-600',
    mono: 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800/80 hover:border-slate-700',
  }[variant];

  return (
    <button
      onClick={handleCopy}
      title={title || `Click to copy: ${copyValue}`}
      className={`${baseStyles} ${variantStyles} ${className}`}
      type="button"
    >
      <span>{text}</span>
      {copied ? (
        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
      ) : (
        <Copy className="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
      )}
    </button>
  );
}
