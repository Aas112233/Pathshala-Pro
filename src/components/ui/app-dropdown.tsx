import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { clsx } from 'clsx';

export interface DropdownOption {
    value: string;
    label: string;
    disabled?: boolean;
}

interface AppDropdownProps {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    options: DropdownOption[];
    placeholder?: string;
    disabled?: boolean;
    searchable?: boolean;
    searchPlaceholder?: string;
    noOptionsText?: string;
    className?: string;
    triggerClassName?: string;
    invalid?: boolean;
    "aria-describedby"?: string;
}

export function AppDropdown({
    id,
    value,
    onChange,
    options,
    placeholder = 'Select',
    disabled = false,
    searchable,
    searchPlaceholder = 'Search...',
    noOptionsText = 'No options found',
    className = '',
    triggerClassName = '',
    invalid = false,
    "aria-describedby": ariaDescribedBy,
}: AppDropdownProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const dropdownRef = useRef<HTMLDivElement | null>(null);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

    // Auto-enable search if searchable is true OR if options.length > 5 (unless explicitly set to false)
    const isSearchable = searchable === true || (searchable !== false && options.length > 5);

    const selected = options.find((option) => option.value === value);
    const filtered = useMemo(() => {
        if (!isSearchable || !search.trim()) return options;
        const key = search.trim().toLowerCase();
        return options.filter((option) => option.label.toLowerCase().includes(key));
    }, [options, search, isSearchable]);

    useEffect(() => {
        const handleClick = (event: MouseEvent) => {
            if (
                containerRef.current?.contains(event.target as Node) ||
                dropdownRef.current?.contains(event.target as Node)
            ) {
                return;
            }
            setOpen(false);
            setSearch('');
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const updatePosition = () => {
        if (open && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;

            const needsFlip = spaceBelow < 280 && spaceAbove > spaceBelow;

            setDropdownStyle({
                position: 'fixed',
                top: needsFlip ? `${rect.top - 4}px` : `${rect.bottom + 4}px`,
                left: `${rect.left}px`,
                width: `${rect.width}px`,
                transform: needsFlip ? 'translateY(-100%)' : 'none',
                zIndex: 99999,
            });
        }
    };

    useEffect(() => {
        if (open) {
            updatePosition();
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);
            // Auto focus search input
            if (isSearchable) {
                setTimeout(() => searchInputRef.current?.focus(), 50);
            }
        } else {
            setSearch('');
        }
        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [open, isSearchable]);

    // Handle closing when disabled
    useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

    return (
        <div ref={containerRef} className={clsx('relative', className)}>
            <button
                id={id}
                type="button"
                disabled={disabled}
                aria-describedby={ariaDescribedBy}
                data-invalid={invalid ? 'true' : undefined}
                onClick={() => setOpen((prev) => !prev)}
                className={clsx(
                    'w-full flex items-center justify-between',
                    'rounded-md border px-3 py-2 text-left text-sm',
                    'transition-colors duration-200',
                    disabled
                        ? 'bg-muted text-muted-foreground border-input cursor-not-allowed'
                        : 'bg-background text-foreground border-input hover:border-primary/50',
                    open && 'ring-2 ring-ring border-primary',
                    invalid && 'border-destructive ring-1 ring-destructive',
                    triggerClassName
                )}
            >
                <span className={selected ? 'text-foreground truncate' : 'text-muted-foreground truncate'}>
                    {selected?.label || placeholder}
                </span>
                <ChevronDown size={16} className={clsx('text-muted-foreground transition-transform shrink-0 ml-2', open ? 'rotate-180' : '')} />
            </button>

            {open && typeof document !== 'undefined' && createPortal(
                <div ref={dropdownRef} className="rounded-md border border-border bg-popover text-popover-foreground shadow-lg overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100" style={dropdownStyle}>
                    {isSearchable && (
                        <div className="p-2 border-b border-border bg-muted/20">
                            <div className="relative">
                                <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                                <input
                                    ref={searchInputRef}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={searchPlaceholder}
                                    className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                />
                            </div>
                        </div>
                    )}

                    <div className="max-h-56 overflow-auto py-1">
                        {filtered.length === 0 && (
                            <div className="px-3 py-3 text-xs text-center text-muted-foreground">{noOptionsText}</div>
                        )}
                        {filtered.map((option) => {
                            const isSelected = option.value === value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    disabled={option.disabled}
                                    onClick={() => {
                                        if (option.disabled) return;
                                        onChange(option.value);
                                        setOpen(false);
                                        setSearch('');
                                    }}
                                    className={clsx(
                                        'w-full flex items-center justify-between px-3 py-2 text-xs text-left',
                                        option.disabled
                                            ? 'text-muted-foreground cursor-not-allowed opacity-50'
                                            : isSelected
                                                ? 'bg-primary/10 text-primary font-semibold'
                                                : 'text-foreground hover:bg-muted hover:text-accent-foreground'
                                    )}
                                >
                                    <span className="truncate mr-2">{option.label}</span>
                                    {isSelected && <Check size={14} className="text-primary shrink-0" />}
                                </button>
                            );
                        })}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
