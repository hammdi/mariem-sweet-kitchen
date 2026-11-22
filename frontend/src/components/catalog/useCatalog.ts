import { useEffect, useState } from 'react';
import api from '../../services/api';
import { CatalogItem } from './catalog';

/** Catalogue public (sans connexion). */
export function useCatalog(params: { search?: string; category?: string } = {}) {
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [showPrices, setShowPrices] = useState(true);
  const { search = '', category = '' } = params;

  useEffect(() => {
    let alive = true;
    const t = setTimeout(
      () => {
        api
          .get('/catalog', {
            params: { search: search || undefined, category: category || undefined },
          })
          .then((res) => {
            if (!alive) return;
            setItems(res.data.data?.items || []);
            setShowPrices(res.data.data?.showPrices !== false);
            if (!category && !search) setCategories(res.data.data?.categories || []);
          })
          .catch(() => alive && setItems([]));
      },
      search ? 250 : 0
    );
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [search, category]);

  return { items, categories, showPrices };
}
