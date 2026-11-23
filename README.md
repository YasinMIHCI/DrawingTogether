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
