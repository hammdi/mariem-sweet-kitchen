import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { IdempotencyRecord } from '../models/IdempotencyRecord';
import { createError } from './errorHandler';
import { logger } from '../utils/logger';

/**
 * Idempotence des opérations sensibles (argent ou stock).
 *
 * Le client envoie "Idempotency-Key: <clé unique de l'opération>". La même clé
 * renvoyée (double clic, réseau qui réessaie, deux onglets) :
 *   - opération terminée → même réponse, rien n'est ré-enregistré
 *     (en-tête "Idempotent-Replay: true") ;
 *   - opération en cours → 409, rien n'est enregistré ;
 *   - clé déjà utilisée pour une AUTRE opération → 422.
 * En cas d'erreur (4xx/5xx) la clé est libérée : l'utilisateur peut corriger et réessayer.
 *
 * La contrainte est côté serveur (index unique) : la désactivation des boutons
 * dans l'interface n'est qu'un confort en plus.
 */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

const hashOf = (req: Request) =>
  crypto
    .createHash('sha256')
    .update(`${req.method} ${req.baseUrl}${req.path} ${JSON.stringify(req.body ?? {})}`)
    .digest('hex');

export function idempotent(opts: { required?: boolean } = {}) {
  const required = opts.required !== false;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const raw = req.header(IDEMPOTENCY_HEADER);
      if (!raw) {
        if (required) {
          throw createError(
            'Operation refusee : cle d idempotence manquante (en-tete Idempotency-Key)',
            400
          );
        }
        return next();
      }
      const clientKey = raw.trim();
      if (!/^[A-Za-z0-9_.:-]{8,128}$/.test(clientKey)) {
        throw createError('Cle d idempotence invalide', 400);
      }

      const key = `${req.user?._id || 'public'}:${clientKey}`;
      const bodyHash = hashOf(req);
      const path = `${req.baseUrl}${req.path}`;

      try {
        await IdempotencyRecord.create({ key, method: req.method, path, bodyHash });
      } catch (e: any) {
        if (e?.code !== 11000) {
          throw e;
        }
        const existing = await IdempotencyRecord.findOne({ key });
        if (!existing) {
          // la première tentative a échoué entre-temps et a libéré la clé
          throw createError('Operation interrompue, reessayez', 409);
        }
        if (existing.bodyHash !== bodyHash) {
          throw createError('Cette cle a deja servi pour une autre operation', 422);
        }
        if (existing.state === 'done') {
          res.set('Idempotent-Replay', 'true');
          return res.status(existing.statusCode || 200).json(existing.response);
        }
        throw createError('Cette operation est deja en cours d enregistrement', 409);
      }

      // Mémoriser la réponse AVANT de l'envoyer : une répétition arrivant juste
      // après reçoit la même réponse, jamais une 2e exécution.
      const send = res.json.bind(res);
      res.json = ((body: unknown) => {
        const done =
          res.statusCode < 400
            ? IdempotencyRecord.updateOne(
                { key },
                { $set: { state: 'done', statusCode: res.statusCode, response: body } }
              )
            : IdempotencyRecord.deleteOne({ key, state: 'processing' });
        done
          .catch((err) => logger.error(`Idempotence: ${(err as Error).message}`))
          .finally(() => send(body));
        return res;
      }) as Response['json'];

      next();
    } catch (error) {
      next(error);
    }
  };
}
