import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, ButtonBase, ClickAwayListener, InputBase, Paper, Popper, Typography } from '@mui/material';
import { CakeOutlined, EggOutlined, PersonOutline, ReceiptLongOutlined, Search } from '@mui/icons-material';
import api from '../../services/api';
import { formatDT, orderRef } from '../../utils/format';
import { color, radius, shadow } from '../../theme/tokens';
import { OrderStatusBadge } from '../ui';

interface Result {
  group: 'Commandes' | 'Clients' | 'Recettes' | 'Ingrédients';
  id: string;
  label: string;
  hint?: string;
  status?: string;
  to: string;
}

const ICONS = {
  Commandes: <ReceiptLongOutlined fontSize="small" />,
  Clients: <PersonOutline fontSize="small" />,
  Recettes: <CakeOutlined fontSize="small" />,
  Ingrédients: <EggOutlined fontSize="small" />,
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/**
 * Recherche globale (barre du haut) : commandes (CMD-12, nom, téléphone),
 * clients, recettes, ingrédients. Lecture seule.
 */
export default function GlobalSearch({ autoFocus = false, onDone }: { autoFocus?: boolean; onDone?: () => void }) {
  const navigate = useNavigate();
  const anchor = useRef<HTMLDivElement>(null);
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const catalog = useRef<{ recipes: any[]; ingredients: any[] } | null>(null);
  const req = useRef(0);

  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const id = ++req.current;
    setLoading(true);
    const t = window.setTimeout(async () => {
      try {
        if (!catalog.current) {
          const [r, i] = await Promise.all([api.get('/recipes', { params: { limit: 200 } }), api.get('/ingredients', { params: { limit: 500 } })]);
          catalog.current = { recipes: r.data.data?.recipes || [], ingredients: i.data.data?.ingredients || [] };
        }
        const [orders, clients] = await Promise.all([
          api.get('/orders', { params: { search: q, limit: 5 } }),
          api.get('/clients', { params: { search: q, limit: 4 } }),
        ]);
        if (id !== req.current) return;
        const n = norm(q);
        const out: Result[] = [
          ...(orders.data.data?.orders || []).map((o: any) => ({
            group: 'Commandes' as const,
            id: o._id,
            label: `${orderRef(o)} · ${o.clientName}`,
            hint: formatDT(o.totalPrice),
            status: o.status,
            to: `/admin/orders/${o._id}`,
          })),
          ...(clients.data.data?.clients || []).map((c: any) => ({
            group: 'Clients' as const,
            id: c._id,
            label: c.name,
            hint: c.phone,
            to: `/admin/clients/${c._id}`,
          })),
          ...catalog.current.recipes
            .filter((r) => norm(r.name).includes(n))
            .slice(0, 4)
            .map((r) => ({ group: 'Recettes' as const, id: r._id, label: r.name, hint: `${r.variants?.length || 0} taille(s)`, to: `/admin/recipes/${r._id}/edit` })),
          ...catalog.current.ingredients
            .filter((i) => norm(i.name).includes(n))
            .slice(0, 4)
            .map((i) => ({ group: 'Ingrédients' as const, id: i._id, label: i.name, hint: `stock ${i.stockQuantity ?? 0} ${i.unit}`, to: `/admin/ingredients/${i._id}` })),
        ];
        setResults(out);
        setActive(0);
        setOpen(true);
      } catch {
        /* recherche indisponible */
      } finally {
        if (id === req.current) setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [term]);

  const go = (to: string) => {
    setOpen(false);
    setTerm('');
    navigate(to);
    onDone?.();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      if (results[active]) go(results[active].to);
      else if (term.trim()) go(`/admin/orders?search=${encodeURIComponent(term.trim())}`);
    } else if (e.key === 'Escape') {
      setOpen(false);
      onDone?.();
    }
  };

  let lastGroup = '';
  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box ref={anchor} sx={{ width: '100%', position: 'relative' }}>
        <Box
          data-tour="global-search"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            height: 48,
            px: 2,
            borderRadius: `${radius.md}px`,
            bgcolor: color.surface,
            border: `1px solid ${color.borderStrong}`,
            transition: 'border-color 140ms, box-shadow 140ms',
            '&:focus-within': { borderColor: color.primary, boxShadow: shadow.focus },
          }}
        >
          <Search sx={{ color: color.inkSoft }} />
          <InputBase
            value={term}
            autoFocus={autoFocus}
            onChange={(e) => setTerm(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
            onKeyDown={onKey}
            placeholder="Rechercher une commande, un client, une recette..."
            inputProps={{ 'aria-label': 'Rechercher une commande, un client, une recette', role: 'combobox', 'aria-expanded': open }}
            sx={{ flex: 1, fontSize: '0.95rem', color: color.ink, '& input::placeholder': { color: color.inkMuted, opacity: 1 } }}
          />
          {loading && <Typography variant="caption" sx={{ color: color.inkMuted }}>…</Typography>}
        </Box>
        <Popper open={open && term.trim().length >= 2} anchorEl={anchor.current} placement="bottom-start" sx={{ zIndex: 1350, width: anchor.current?.offsetWidth }}>
          <Paper sx={{ mt: 1, borderRadius: `${radius.md}px`, border: `1px solid ${color.border}`, boxShadow: shadow.floating, maxHeight: 420, overflowY: 'auto', py: 0.75 }} role="listbox">
            {results.length === 0 && !loading && (
              <Typography variant="body2" sx={{ px: 2, py: 1.5, color: color.inkSoft }}>
                Aucun résultat pour « {term} ».
              </Typography>
            )}
            {results.map((r, i) => {
              const header = r.group !== lastGroup;
              lastGroup = r.group;
              return (
                <Box key={`${r.group}-${r.id}`}>
                  {header && (
                    <Typography variant="overline" sx={{ display: 'block', px: 2, pt: 1, color: color.inkMuted, fontSize: '0.65rem' }}>
                      {r.group}
                    </Typography>
                  )}
                  <ButtonBase
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r.to)}
                    sx={{ width: '100%', display: 'flex', gap: 1.25, px: 2, py: 1, justifyContent: 'flex-start', bgcolor: i === active ? color.primarySoft : 'transparent', textAlign: 'left' }}
                  >
                    <Box sx={{ color: color.inkSoft, display: 'flex' }}>{ICONS[r.group]}</Box>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', flex: 1, minWidth: 0 }} noWrap>
                      {r.label}
                    </Typography>
                    {r.status && <OrderStatusBadge status={r.status} />}
                    {r.hint && (
                      <Typography variant="caption" sx={{ color: color.inkMuted, whiteSpace: 'nowrap' }}>
                        {r.hint}
                      </Typography>
                    )}
                  </ButtonBase>
                </Box>
              );
            })}
          </Paper>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
}
