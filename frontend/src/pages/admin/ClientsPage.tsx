import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  ButtonBase,
  Card,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Add, People, Search, Storefront, Person } from '@mui/icons-material';
import api from '../../services/api';
import ClientFormDialog from '../../components/admin/ClientFormDialog';
import type { Client, ClientType } from '../../types/admin';
import { CLIENT_TYPE_LABELS, formatDate, formatDT, formatPhone } from '../../utils/format';
import { EmptyState, FilterChips, KpiCard, PageHeader, SkeletonRows, StatusBadge } from '../../components/ui';
import { color } from '../../theme/tokens';

type ClientRow = Client & { stats?: { orderCount: number; revenue: number; lastOrderAt: string | null } };

const ClientsPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const [clients, setClients] = useState<ClientRow[] | null>(null);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<ClientType | ''>('');
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/clients', { params: { search: search.trim() || undefined, type: type || undefined, limit: 200 } });
        setClients(res.data.data?.clients || []);
      } catch {
        setClients((prev) => prev || []);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [search, type]);

  const list = clients || [];
  const cafes = list.filter((c) => c.type === 'cafe').length;
  const revenue = list.reduce((s, c) => s + (c.stats?.revenue || 0), 0);
  const open = (id: string) => navigate(`/admin/clients/${id}`);

  return (
    <Box>
      <PageHeader
        title="Clients"
        subtitle="Particuliers et cafés : commandes, chiffre d’affaires généré, dernière commande."
        icon={<People />}
        tone="info"
        helpFlow="sale"
        actions={
          <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>
            Nouveau client
          </Button>
        }
      />

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(3, minmax(0,1fr))' }, mb: 2.5 }}>
        <KpiCard label="Clients" value={list.length} icon={<People />} tone="info" />
        <KpiCard label="Cafés" value={cafes} icon={<Storefront />} tone="violet" />
        <KpiCard label="CA généré" value={revenue} format={(n) => formatDT(n)} icon={<Person />} tone="primary" hint="Ventes des clients affichés" />
      </Box>

      <Card sx={{ p: { xs: 1.5, md: 2 }, mb: 2, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 1.5, alignItems: { md: 'center' } }}>
        <TextField
          size="small"
          placeholder="Rechercher par nom ou téléphone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          inputProps={{ 'aria-label': 'Rechercher un client' }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
          sx={{ width: { xs: '100%', md: 320 } }}
        />
        <FilterChips
          ariaLabel="Type de client"
          value={type}
          onChange={(v) => setType(v as ClientType | '')}
          options={[
            { value: '', label: 'Tous' },
            { value: 'individual', label: 'Particuliers' },
            { value: 'cafe', label: 'Cafés' },
          ]}
        />
      </Card>

      {clients === null ? (
        <SkeletonRows rows={5} />
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<People />}
            tone="info"
            title={search ? 'Aucun client trouvé' : 'Aucun client enregistré'}
            description="Les clients sont créés depuis une commande ou ici."
            action={
              <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>
                Nouveau client
              </Button>
            }
          />
        </Card>
      ) : mobile ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {list.map((c) => (
            <ButtonBase key={c._id} onClick={() => open(c._id)} sx={{ display: 'flex', gap: 1.5, p: 1.5, borderRadius: '16px', bgcolor: color.surface, border: `1px solid ${color.border}`, textAlign: 'left' }}>
              <Avatar sx={{ bgcolor: c.type === 'cafe' ? color.violet : color.primary, width: 40, height: 40 }}>{c.name[0]}</Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700 }} noWrap>
                  {c.name}
                </Typography>
                <Typography variant="caption" sx={{ color: color.inkSoft, display: 'block' }}>
                  {formatPhone(c.phone)} · {c.stats?.orderCount || 0} commande{(c.stats?.orderCount || 0) > 1 ? 's' : ''}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <StatusBadge tone={c.type === 'cafe' ? 'violet' : 'neutral'} label={CLIENT_TYPE_LABELS[c.type]} />
                <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', mt: 0.5 }}>{formatDT(c.stats?.revenue || 0)}</Typography>
              </Box>
            </ButtonBase>
          ))}
        </Box>
      ) : (
        <TableContainer component={Card}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Client</TableCell>
                <TableCell>Téléphone</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Commandes</TableCell>
                <TableCell align="right">CA généré</TableCell>
                <TableCell>Dernière commande</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map((c) => (
                <TableRow key={c._id} hover tabIndex={0} onClick={() => open(c._id)} onKeyDown={(e) => e.key === 'Enter' && open(c._id)} sx={{ cursor: 'pointer' }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <Avatar sx={{ bgcolor: c.type === 'cafe' ? color.violet : color.primary, width: 34, height: 34, fontSize: '0.9rem' }}>{c.name[0]}</Avatar>
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.92rem' }}>{c.name}</Typography>
                        {(c.contactPerson || c.address) && (
                          <Typography variant="caption" sx={{ color: color.inkSoft }}>
                            {[c.contactPerson, c.address].filter(Boolean).join(' · ')}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatPhone(c.phone)}</TableCell>
                  <TableCell>
                    <StatusBadge tone={c.type === 'cafe' ? 'violet' : 'neutral'} label={CLIENT_TYPE_LABELS[c.type]} />
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {c.stats?.orderCount || 0}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
                    {formatDT(c.stats?.revenue || 0)}
                  </TableCell>
                  <TableCell sx={{ color: color.inkSoft }}>{c.stats?.lastOrderAt ? formatDate(c.stats.lastOrderAt) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <ClientFormDialog
        open={dialogOpen}
        defaultType={type || 'individual'}
        onClose={() => setDialogOpen(false)}
        onSaved={(c) => navigate(`/admin/clients/${c._id}`)}
        onUseExisting={(c) => navigate(`/admin/clients/${c._id}`)}
      />
    </Box>
  );
};

export default ClientsPage;
