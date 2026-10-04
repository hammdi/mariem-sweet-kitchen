import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Avatar, Box, Button, ButtonBase, Card, CardContent, Typography } from '@mui/material';
import { Add, Archive, Edit, Phone, WhatsApp, ReceiptLong, Payments, Event, ShowChart } from '@mui/icons-material';
import api from '../../services/api';
import { EmptyState, KpiCard, OrderStatusBadge, PageHeader, PaymentStatusBadge, StatusBadge } from '../../components/ui';
import { color, radius } from '../../theme/tokens';
import ClientFormDialog from '../../components/admin/ClientFormDialog';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import type { Client } from '../../types/admin';
import { CLIENT_TYPE_LABELS, formatDT, formatDate, formatPhone, orderRef } from '../../utils/format';

interface ClientOrder {
  _id: string;
  orderNumber?: number;
  paymentStatus?: string;
  amountPaid?: number;
  createdAt: string;
  requestedDate: string | null;
  confirmedDate: string | null;
  status: string;
  totalPrice: number;
  items: { recipeName: string; sizeName: string; quantity: number }[];
}

interface Stats {
  orderCount: number;
  cancelledCount: number;
  lastOrderAt: string | null;
  totalOrdered: number;
  revenue?: number;
  collected?: number;
}

const ClientDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/clients/${id}`);
      setClient(res.data.data.client);
      setStats(res.data.data.stats);
      setOrders(res.data.data.orders);
    } catch {
      navigate('/admin/clients');
    }
  }, [id, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const archive = async () => {
    try {
      await api.delete(`/clients/${id}`);
      toast.success('Client archivé (son historique est conservé)');
      navigate('/admin/clients');
    } catch {
      /* toast deja affiche */
    }
  };

  if (!client || !stats) return null;

  return (
    <Box>
      <PageHeader
        title={client.name}
        subtitle={`${CLIENT_TYPE_LABELS[client.type]} · ${formatPhone(client.phone)}`}
        backTo="/admin/clients"
        actions={
          <>
            <Button variant="outlined" startIcon={<Phone />} href={`tel:${client.phone}`}>
              Appeler
            </Button>
            <Button variant="outlined" startIcon={<WhatsApp />} href={`https://wa.me/${client.phone.replace('+', '')}`} target="_blank">
              WhatsApp
            </Button>
            <Button variant="contained" startIcon={<Add />} onClick={() => navigate(`/admin/orders/new?clientId=${client._id}`)}>
              Nouvelle commande
            </Button>
          </>
        }
      />

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', lg: 'repeat(4, minmax(0,1fr))' }, mb: 2.5 }}>
        <KpiCard label="Commandes" value={stats.orderCount} icon={<ReceiptLong />} tone="rose" hint={stats.cancelledCount ? `+ ${stats.cancelledCount} annulée(s)` : 'hors annulées'} />
        <KpiCard label="CA généré" value={stats.revenue ?? stats.totalOrdered} format={(n) => formatDT(n)} icon={<ShowChart />} tone="primary" hint="Ventes confirmées, payées ou non" />
        <KpiCard label="Encaissé" value={stats.collected ?? 0} format={(n) => formatDT(n)} icon={<Payments />} tone="success" valueColor={color.successDark} hint="Argent reçu de ce client" />
        <KpiCard label="Dernière commande" value={formatDate(stats.lastOrderAt)} icon={<Event />} tone="info" />
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 4fr) minmax(0, 8fr)' }, alignItems: 'start' }}>
        <Card>
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 1.5 }}>
              <Avatar sx={{ width: 52, height: 52, bgcolor: client.type === 'cafe' ? color.violet : color.primary, fontSize: '1.3rem' }}>{client.name[0]}</Avatar>
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>{client.name}</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.25 }}>
                  <StatusBadge tone={client.type === 'cafe' ? 'violet' : 'neutral'} label={CLIENT_TYPE_LABELS[client.type]} />
                  {!client.isActive && <StatusBadge tone="neutral" label="Archivé" />}
                </Box>
              </Box>
            </Box>
            {[
              ['Téléphone', formatPhone(client.phone)],
              ['Contact', client.contactPerson],
              ['Adresse', client.address],
              ['Conditions', client.conditions],
              ['Notes', client.notes],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <Box key={k} sx={{ py: 0.75, borderBottom: `1px solid ${color.border}`, '&:last-of-type': { borderBottom: 0 } }}>
                  <Typography variant="caption" sx={{ color: color.inkSoft }}>
                    {k}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {v}
                  </Typography>
                </Box>
              ))}
            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              <Button startIcon={<Edit />} variant="outlined" onClick={() => setEditOpen(true)} sx={{ flex: 1 }}>
                Modifier
              </Button>
              {client.isActive && (
                <Button color="error" startIcon={<Archive />} onClick={() => setArchiveOpen(true)} sx={{ flex: 1 }}>
                  Archiver
                </Button>
              )}
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ p: 2.5 }}>
          <Typography variant="h6" sx={{ fontSize: '1rem', mb: 1.5 }}>
            Historique des commandes
          </Typography>
          {orders.length === 0 ? (
            <EmptyState compact icon={<ReceiptLong />} title="Aucune commande" description="Les commandes de ce client apparaîtront ici." />
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {orders.map((o) => (
                <ButtonBase
                  key={o._id}
                  onClick={() => navigate(`/admin/orders/${o._id}`)}
                  sx={{ display: 'block', textAlign: 'left', p: 1.5, borderRadius: `${radius.md}px`, border: `1px solid ${color.border}`, '&:hover': { bgcolor: color.surfaceMuted } }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                      {orderRef(o)} · {formatDate(o.createdAt)}
                      {o.confirmedDate || o.requestedDate ? ` · pour le ${formatDate(o.confirmedDate || o.requestedDate)}` : ''}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <OrderStatusBadge status={o.status} />
                      {o.status !== 'cancelled' && <PaymentStatusBadge status={o.paymentStatus} />}
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mt: 0.5 }}>
                    <Typography variant="body2" sx={{ color: color.inkSoft }}>
                      {o.items.map((i) => `${i.quantity}× ${i.recipeName}${i.sizeName ? ` ${i.sizeName}` : ''}`).join(' · ')}
                    </Typography>
                    <Typography sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{formatDT(o.totalPrice)}</Typography>
                  </Box>
                </ButtonBase>
              ))}
            </Box>
          )}
        </Card>
      </Box>

      <ClientFormDialog
        open={editOpen}
        client={client}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          load();
        }}
      />
      <ConfirmDialog
        open={archiveOpen}
        title="Archiver ce client ?"
        message="Il n'apparaîtra plus dans la recherche. Ses commandes restent dans l'historique."
        confirmLabel="Archiver"
        onConfirm={archive}
        onCancel={() => setArchiveOpen(false)}
      />
    </Box>
  );
};

export default ClientDetailPage;
