# Mise en ligne gratuite : Render + MongoDB Atlas

Un seul service Render sert le site client, l'espace admin et l'API.
Les données et les photos sont dans MongoDB Atlas (offre gratuite M0).
Le PC et les téléphones utilisent la même adresse, donc la même base.

```
PC (navigateur) ───┐
                   ├──► https://<nom>.onrender.com ──► MongoDB Atlas
Téléphone (Chrome) ┘     (site + admin + API)          (données + photos)
```

## À savoir avant de commencer

- **Mise en veille** : après 15 minutes sans visite, le serveur s'endort. La première
  ouverture suivante prend jusqu'à environ 1 minute, ensuite c'est normal.
- **750 heures par mois** : suffisant pour un seul service allumé tout le mois.
- **Photos** : enregistrées dans Atlas (512 Mo au total). Gardez des photos légères
  (moins de 5 Mo chacune, c'est déjà la limite de l'envoi).
- **Secrets** : le lien Atlas et les jetons Telegram se collent uniquement dans
  Render. Ils ne vont jamais dans le code ni dans un message.

## Étape 1 — Atlas : un utilisateur et le lien de connexion

1. Ouvrez [cloud.mongodb.com](https://cloud.mongodb.com) → votre cluster.
2. **Database Access** → **Add New Database User**.
   - Méthode : mot de passe. Cliquez **Autogenerate Secure Password** et copiez-le.
   - Rôle : **Read and write to any database**.
3. **Network Access** → **Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`).
   - Render gratuit n'a pas d'adresse IP fixe : c'est le mot de passe fort qui protège la base.
4. **Connect** → **Drivers** → copiez le lien `mongodb+srv://…`.
   - Remplacez `<password>` par le mot de passe.
   - Ajoutez le nom de la base avant le `?` : `…mongodb.net/mariem_kitchen?retryWrites=true&w=majority`.
   - Si le mot de passe contient `@ : / ?`, encodez-les : `%40 %3A %2F %3F`.

## Étape 2 — Copier vos données locales dans Atlas (une seule fois)

Dans le terminal du PC, depuis le dossier du projet :

```bash
cd backend
# 1) Aperçu : ne copie rien, affiche ce qui sera copié
ATLAS_URI='mongodb+srv://…/mariem_kitchen?…' npm run copy:atlas -- --dry-run
# 2) Copie réelle
ATLAS_URI='mongodb+srv://…/mariem_kitchen?…' npm run copy:atlas
```

- Votre base locale n'est **jamais modifiée** (lecture seule).
- Si Atlas contient déjà des données, la copie s'arrête. `--replace` vide d'abord Atlas
  (et seulement Atlas) avant de copier.
- Les photos du dossier `backend/uploads` sont copiées dans Atlas, et les adresses des
  recettes sont mises à jour (dans Atlas uniquement).

## Étape 3 — Render : créer le service

1. [render.com](https://render.com) → **Sign in with GitHub**.
2. **New** → **Blueprint** → choisissez le dépôt `mariem-sweet-kitchen`.
   Render lit le fichier `render.yaml` du projet.
3. Render demande les valeurs secrètes :
   - `MONGODB_URI` : le lien Atlas de l'étape 1 ;
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` : facultatif (notifications des commandes),
     sinon laissez vide.
   - `JWT_SECRET` est généré automatiquement par Render.
4. **Apply**. La première construction prend quelques minutes.
5. L'adresse du site s'affiche en haut : `https://mariem-sweet-kitchen.onrender.com`
   (ou un nom proche si celui-ci est déjà pris).

## Étape 4 — Vérifier

- `https://<adresse>/api/health` répond `"success": true`.
- `https://<adresse>/` : le catalogue client.
- Pied de page → **🔒 Espace Mariem** → connexion avec votre compte admin habituel
  (il a été copié à l'étape 2).

## Téléphone Android

Chrome → ouvrir l'adresse → menu **⋮** → **Ajouter à l'écran d'accueil**.
L'application s'ouvre ensuite comme une app, avec la même base que le PC.

## Mises à jour

Chaque `git push` sur `main` redéploie automatiquement (2 à 5 minutes).

## En cas de problème

- **Page qui charge longtemps** : le serveur se réveille (jusqu'à environ 1 minute).
- **« MONGODB_URI » ou erreur de connexion** dans les journaux Render (onglet **Logs**) :
  vérifiez le lien, le mot de passe encodé et l'accès réseau `0.0.0.0/0` dans Atlas.
- **Revenir en arrière** : Render → **Events** → choisir un déploiement précédent →
  **Rollback**.
