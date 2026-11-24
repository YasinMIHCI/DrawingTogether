# DrawingTogether

Site de dessin : dessin libre, toile partagée en temps réel (jusqu'à 8 joueurs), jeux de dessin à plusieurs,
et un petit réseau social (comptes, personnage « Bouille », amis, messages, fil, salons publics).
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

## Comptes et réseau social (Supabase)

Les comptes sont **facultatifs** (pseudo + mot de passe, sans e-mail ; question secrète pour réinitialiser).
À faire une seule fois dans Supabase :

1. **Authentication → Sign In / Providers → Email** : désactiver **Confirm email**.
2. **SQL Editor** : lancer, dans cet ordre, chaque script (tous peuvent être relancés sans risque) :

| Script | Contenu |
|---|---|
| [`social.sql`](supabase/social.sql) | profils, amis, discussions et groupes, publications, « Ouais ! », commentaires, stockage des avatars et dessins |
| [`social-grants.sql`](supabase/social-grants.sql) | droits d'accès aux tables (déjà inclus à la fin de `social.sql`) |
| [`social-2.sql`](supabase/social-2.sql) | Bouille liée au compte, publications texte, compteurs du profil |
| [`social-3.sql`](supabase/social-3.sql) | notifications |
| [`social-4.sql`](supabase/social-4.sql) | salons publics, favoris, signalements, modération |
| [`social-5.sql`](supabase/social-5.sql) | défis de la semaine, humeur des publications |

Pour nommer un modérateur (page « Modération » dans la barre de gauche) :

```sql
insert into public.moderators (user_id) select id from public.profiles where username = 'pseudo' on conflict do nothing;
```

Une publication signalée 3 fois est masquée automatiquement en attendant la modération.
Le site reste utilisable si un script manque : seules les fonctions concernées affichent un message d'installation.

## Hors ligne / application

La version publiée enregistre un *service worker* (généré à la construction depuis `src/sw-template.js`) :
le dessin libre et la galerie fonctionnent sans connexion, et le site peut être installé
(« Ajouter à l'écran d'accueil » sur téléphone). La toile partagée et les jeux ont besoin d'Internet.
