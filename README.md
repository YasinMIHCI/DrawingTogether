# DrawingTogether

Site de dessin : dessin libre, toile partagée en temps réel (jusqu'à 8 joueurs) et jeux de dessin à plusieurs.
Plan de développement : [PLAN.md](PLAN.md).

## Développement

```bash
npm install
npm run dev      # serveur local
npm test         # tests unitaires
npm run check    # vérification des types
npm run build    # build de production dans dist/
```

## Mise en ligne (GitHub Pages)

Le workflow `.github/workflows/deploy.yml` construit et publie le site à chaque push sur `main`.
À faire une seule fois : **Settings → Pages → Build and deployment → Source : GitHub Actions**.

## Multijoueur (Supabase)

Le temps réel (salles, toile partagée, discussion) passe par Supabase Realtime : rien à configurer.
Le projet et sa clé publique sont dans `src/net/config.ts`.

La **sauvegarde en ligne des toiles partagées** utilise Supabase Storage. À faire une seule fois :
tableau de bord Supabase du projet → **SQL Editor** → **New query** → coller le contenu de
[`supabase/setup.sql`](supabase/setup.sql) → **Run**. Sans cette étape, tout fonctionne sauf la sauvegarde en ligne.

## Hors ligne / application

La version publiée enregistre un *service worker* (généré à la construction depuis `src/sw-template.js`) :
le dessin libre et la galerie fonctionnent sans connexion, et le site peut être installé
(« Ajouter à l'écran d'accueil » sur téléphone). La toile partagée et les jeux ont besoin d'Internet.
