# DrawingTogether — Plan de développement

> Document de travail. Chaque tâche a un identifiant (ex. `T2.3`) pour que tu puisses me dire précisément quoi faire : « fais T1.1 à T1.4 ».
> Les points marqués **❓** attendent ta réponse (voir la section *Questions ouvertes* en bas). Je ne commencerai pas une tâche qui dépend d'un ❓ avant ta réponse.

---

## 1. Vision

Un site web (hébergé sur **GitHub Pages**) autour du dessin, avec :

1. **Toile partagée** : un joueur héberge une salle, les autres la rejoignent avec un code/lien et dessinent ensemble en temps réel sur une grande toile.
2. **Jeux de « téléphone dessiné »** : chaque mode de jeu de tes captures devient un jeu séparé, accessible depuis l'accueil.
3. **Un vrai logiciel de dessin** dans le navigateur :
   - **Ordinateur** : interface type logiciel de bureau (Krita / Paint) — barre de menus, boîte à outils, panneaux ancrés (calques, couleurs, options d'outil).
   - **Mobile / tablette** : interface tactile calquée sur l'ergonomie de tes captures (barre d'outils en bas, panneaux qui montent du bas, roue chromatique, panneau de calques latéral, curseurs taille/opacité).

**Identité visuelle** : on reprend les *mécaniques* de jeu et l'*ergonomie* des interfaces, mais avec nos propres noms de modes, icônes, textes, couleurs et mascotte — pas de copie du logo, des illustrations ou de la charte graphique des applis existantes.

---

## 2. Contraintes techniques et architecture

### 2.1 GitHub Pages = site 100 % statique
GitHub Pages ne peut pas exécuter de serveur. Pour le multijoueur il faut donc **un service temps réel externe**. **Décision : option B avec Supabase (Realtime)** — le site reste sur GitHub Pages, Supabase gère le temps réel. Pour mémoire :

| Option | Principe | + | − |
|---|---|---|---|
| **A. WebRTC pair-à-pair (PeerJS)** — *recommandé* | Le navigateur de l'hôte *est* le serveur de la salle. Un serveur public gratuit sert uniquement à mettre les joueurs en relation. | Gratuit, aucun compte, colle à « une personne héberge la salle ». | Si l'hôte ferme l'onglet, la salle s'arrête. Certains réseaux (4G, réseaux d'entreprise) bloquent le P2P → ~10 % de connexions échouent sans serveur relais (TURN), qui est payant ou à héberger. |
| **B. Base temps réel (Firebase ou Supabase)** | Tous les joueurs se synchronisent via une base cloud. | Fonctionne sur tous les réseaux, la salle survit au départ de l'hôte, possibilité de sauvegarder la toile. | Nécessite un compte (gratuit avec quotas) et une clé publique dans le code ; quotas à surveiller si beaucoup de joueurs. |

Le code réseau sera isolé derrière une interface `Transport` pour pouvoir changer d'option plus tard sans tout réécrire.

### 2.2 Pile technique proposée ❓(Q8)
- **Vite + TypeScript** (build), déployé automatiquement sur Pages via **GitHub Actions**.
- **UI** : Svelte 5 (validé).
- **Dessin** : Canvas 2D (+ WebGL plus tard si besoin de perfs pour les pinceaux texturés), **Pointer Events** (souris, doigt, stylet avec pression/inclinaison).
- **Stockage local** : IndexedDB (sauvegarde des dessins, palettes, réglages).

### 2.3 Organisation du code
```
src/
  engine/      moteur de dessin (calques, pinceaux, outils, historique) — sans UI
  ui/desktop/  interface ordinateur
  ui/mobile/   interface mobile/tablette
  net/         transport réseau, salles, synchronisation
  games/       moteur de partie générique + un fichier par mode
  pages/       accueil, lobby, toile partagée, partie, album
```
Le **moteur de dessin est unique** : les deux interfaces (bureau / mobile) et tous les jeux l'utilisent. La sélection de l'interface se fait automatiquement (taille d'écran + type de pointeur), avec un bouton pour forcer l'autre.

### 2.4 Synchronisation du dessin
- On n'envoie pas des images mais des **traits** (points + réglages du pinceau) : léger et rejouable.
- L'hôte numérote les traits → tout le monde obtient exactement le même résultat.
- Un joueur qui arrive en cours reçoit une image de la toile + les traits récents.
- Annuler/rétablir **par joueur** sur la toile partagée (j'annule mes traits, pas ceux des autres).

---

## 3. Phases et tâches

### Phase 0 — Fondations
- ✅ **T0.1** Projet Vite + TS + structure de dossiers, lint, tests unitaires (Vitest).
- ✅ **T0.2** Déploiement GitHub Pages via GitHub Actions (à chaque push sur `main`).
- ✅ **T0.3** Page d'accueil minimale (choix : Toile partagée / Jeux / Dessin libre) + choix pseudo + avatar dans une liste (pas de compte).
- ✅ **T0.4** Détection bureau/mobile + bascule manuelle ; gestion du viewport mobile (empêcher le zoom/scroll du navigateur sur la toile).
- ✅ **T0.5** Système de traduction **français + anglais** (langue du navigateur par défaut, sélecteur manuel).

### Phase 1 — Moteur de dessin (cœur)
- ✅ **T1.1** Toile : taille du document, fond, zoom, déplacement, **rotation**, ajustement à l'écran.
- ✅ **T1.2** Calques : ajouter, supprimer, dupliquer, réordonner, masquer, opacité, verrouillage, fusion, modes de fusion (normal, multiplier, superposition…), calque de fond.
- ✅ **T1.3** Historique annuler/rétablir (par commandes, limite mémoire).
- ✅ **T1.4** Moteur de pinceau : tampons interpolés, lissage (stabilisateur), pression → taille/opacité, couleur, taille, opacité.
- ✅ **T1.5** Bibliothèque de pinceaux par catégories (comme tes captures) :
  - *Stylo* : plume fine, plume réaliste, plume ronde, plume épaisse, stylo texturé, stylo croquis, calligraphie, feutre précis, feutre.
  - *Croquis* : crayon, porte-mine, fusain, craie grasse, pastel, craie.
  - *Pinceau* : aquarelle circulaire, pinceau plat, aquarelle diluée, aquarelle humide, aquarelle brute, éclaboussures, pinceau mouillé, mélangeur rond, gouache.
  - *Pulvérisation* : doux (aérographe), pulvérisation, gouttelettes, bruit, pulvérisation floue.
  - *Mélange* : mélange de couleurs, flou, doigt (estompe), mélangeur de peinture, mélangeur fibreux, mélangeur texturé.
  - *Décoration* : étoiles, cœurs, étincelles, fleurs, bulles, feuilles · *Gomme* : dure, douce, texturée.
  - Réglages par pinceau + « réinitialiser les options ». Pinceaux personnalisés (« + ») en phase ultérieure.
- ✅ **T1.6** Outils : gomme, remplissage (pot de peinture, tolérance), pipette, formes (ligne, rectangle, ellipse, polygone), texte.
- ✅ **T1.7** Sélection (rectangle, lasso, baguette magique) + déplacer/transformer (redimensionner, pivoter, retourner).
- ✅ **T1.8** Filtres : luminosité/contraste, teinte/saturation, flou, inverser, niveaux de gris. *(Liquéfier et « Effet » plus tard : T1.10)*
- ✅ **T1.9** Nouveau dessin (choix de la taille), import d'image (bouton, glisser-déposer, coller), export PNG/JPG, sauvegarde automatique dans le navigateur, fichier projet `.dtproj` avec calques.
- ✅ **T1.10** Avancé : liquéfier, effets (sépia, postériser, mosaïque, bruit, netteté), pinceaux personnalisés (« Mes pinceaux »).

### Phase 2 — Interface ordinateur : **deux interfaces au choix, Krita par défaut**
L'utilisateur bascule entre « Style Krita » et « Style Paint » dans les réglages (choix mémorisé).
- **T2.1** Barre de menus (Fichier, Édition, Image, Calque, Sélection, Filtres, Affichage).
- **T2.2** Boîte à outils verticale à gauche + barre d'options de l'outil en haut.
- **T2.3** Panneaux ancrés à droite : couleurs (roue + carré, HSV/RVB, hex, palettes), pinceaux, calques, navigateur.
- **T2.4** Raccourcis clavier (B pinceau, E gomme, Ctrl+Z, [ ] taille, espace = main, etc.).
- **T2.5** Panneaux redimensionnables / repliables, thème clair/sombre.
- **T2.6** Interface « Style Paint » : ruban en haut (presse-papiers, image, outils, pinceaux, formes, taille, couleurs), toile au centre, barre d'état en bas.
- **T2.7** Sélecteur de style d'interface (Krita / Paint / Mobile) dans les réglages.

### Phase 3 — Interface mobile / tablette (d'après tes captures)
- ✅ **T3.1** Écran plein toile, en haut : retour, annuler/rétablir, galerie/aperçu, menu « … ».
- ✅ **T3.2** Curseurs rapides taille + opacité au-dessus de la barre du bas (avec valeur numérique).
- ✅ **T3.3** Barre du bas à 5 boutons : bascule pinceau/gomme · outils · pinceaux · couleur · calques.
- ✅ **T3.4** Panneau **Outils** (grille : déplacer/transformer, sélection, liquéfier, figure, filtres, pinceau, gomme, remplir, pipette, effet).
- ✅ **T3.5** Panneau **Pinceaux** : catégories à gauche, liste avec aperçu du trait à droite, flèche → réglages du pinceau.
- ✅ **T3.6** Panneau **Couleur** : couleur principale/secondaire, hex modifiable, roue + carré, onglets « palettes » (ajout de couleurs) et « curseurs » (HSV / RVB), transparent.
- ✅ **T3.7** Panneau **Calques** latéral (vignettes, +, menu …, fond).
- ✅ **T3.8** Gestes : pincer = zoom/rotation, 2 doigts tap = annuler, 3 doigts tap = rétablir, appui long = pipette, rejet de la paume avec stylet.
- ✅ **T3.9** Mise en page tablette (panneaux plus larges, éventuellement côte à côte en paysage).

### Phase 4 — Réseau et salles
- **T4.1** Couche `Transport` Supabase Realtime (canaux *broadcast* pour les traits, *presence* pour la liste des joueurs). Seule la clé publique `anon` va dans le code, jamais la clé `service_role`.
- **T4.2** Créer une salle (code court + lien d'invitation + QR code), rejoindre, quitter.
- **T4.3** Lobby : liste des joueurs avec avatars, hôte (couronne), places vides, **8 joueurs max**.
- **T4.4** Outils de l'hôte : exclure un joueur, verrouiller la salle, mot de passe ❓(Q7), transférer l'hôte.
- **T4.5** Reconnexion après coupure, gestion du départ de l'hôte.

### Phase 5 — Toile partagée
- **T5.1** Grande toile synchronisée, curseurs des autres joueurs avec leur pseudo.
- **T5.1b** Taille de cadre modulable : l'hôte choisit la taille à la création (préréglages, ex. 4000×3000 par défaut pour 8 joueurs) et peut l'agrandir en cours de partie (ajout de place sur les bords) ; les joueurs naviguent librement (zoom/déplacement + mini-carte).
- **T5.2** Calques partagés ou calque par joueur ❓(Q10).
- **T5.3** Arrivée en cours de partie (rattrapage de l'état).
- **T5.4** Export de la toile ; sauvegarde/persistance ❓(Q10).
- **T5.5** Chat simple (optionnel).

### Phase 6 — Jeux de téléphone dessiné
- **T6.1** Moteur de partie générique : « chaînes » qui tournent entre joueurs, étapes (écrire / dessiner / regarder), minuteur, attribution sans répétition, gestion des absents.
- **T6.2** Écran de configuration avec deux onglets : **Préréglages** (les modes) et **Personnalisations** ❓(Q2).
- **T6.3** Écrans d'étape : saisie de phrase, dessin, attente des autres. **Dessin : éditeur simplifié par défaut** (quelques pinceaux, gomme, remplissage, couleurs, annuler) **+ bouton pour passer à l'éditeur complet**.
- **T6.4** **Album de fin** : révélation chaîne par chaîne, réactions, téléchargement (image/GIF).
- **T6.5** Un sous-tâche par mode (voir tableau ci-dessous).

| ID | Mode (nom provisoire) | Ce que j'ai compris | Statut |
|---|---|---|---|
| T6.5.1 | Normal | Alternance écrire → dessiner → décrire → dessiner… jusqu'à la fin du tour. | ✅ compris |
| ~~T6.5.2~~ | Imitation (reporté) | Reproduire le dessin précédent ; le temps diminue à chaque tour. Le dessin d'origine est-il visible pendant qu'on dessine ou seulement quelques secondes ? Point de départ : phrase ou dessin ? | ❓ Q2 |
| T6.5.3 | Animation | Chaque joueur dessine l'image suivante en voyant la précédente en transparence ; le résultat est une animation. | ✅ compris (nb d'images, vitesse ❓) |
| ~~T6.5.4~~ | Brise-glace (reporté) | « Une seule phrase, poser des questions » — mécanique exacte ? | ❓ Q2 |
| T6.5.5 | Cadavre exquis | Chacun dessine une partie d'un personnage en ne voyant que le bas du dessin précédent ; résultat assemblé verticalement. | ✅ compris |
| T6.5.6 | Complément | On commence par quelques traits, le suivant complète/interprète. | ✅ compris (qui fait les traits de départ ? joueur ou aléatoire ❓) |
| T6.5.7 | Chef-d'œuvre | Un seul tour, un seul dessin, sans limite de temps. | ✅ compris |
| T6.5.8 | Histoire | Écriture seule : chacun continue l'histoire en ne voyant que la phrase précédente. | ✅ compris |
| ~~T6.5.9~~ | Pièce manquante (reporté) | « Dessin pas fini, chaque tour une partie est ajoutée et une autre perdue » — qu'est-ce qui est perdu exactement ? | ❓ Q2 |
| ~~T6.5.10~~ | Secret (reporté) | Comme Normal, mais les dessins/phrases sont cachés pendant la partie — on dessine à l'aveugle ? | ❓ Q2 |
| T6.5.11 | Co-op | À partir d'une phrase, chaque joueur ajoute sa contribution au même dessin. | ✅ compris |
| ~~T6.5.12~~ | Score (reporté) | Un point quand le sens est conservé — qui juge (vote des joueurs, l'auteur de la phrase) ? | ❓ Q2 |
| ~~T6.5.13~~ | Sandwich (reporté) | Description non visible sur la capture. | ❓ Q2 |
| — | Modes ❓ ci-dessus et suite de la liste | **Reportés** : non implémentés pour l'instant. | ⏸ |

### Phase 7 — Finitions
- **T7.1** Galerie locale de mes dessins.
- **T7.2** Sons et animations d'interface (désactivables).
- **T7.3** Performances (gros documents, mobiles bas de gamme), tests sur Android/iOS/desktop.
- **T7.4** Accessibilité de base, mode hors-ligne pour le dessin solo (PWA).

### Ordre conseillé
`Phase 0 → Phase 1 (T1.1–T1.6) → Phase 3 (mobile) et Phase 2 (desktop) en parallèle → Phase 4 → Phase 5 → Phase 6 → reste de la Phase 1 → Phase 7`.
Ainsi tu as très vite une appli de dessin utilisable sur téléphone, puis la toile partagée, puis les jeux.

---

## 4. Questions ouvertes

- **Q1 — Multijoueur** : option A (P2P, gratuit, salle liée à l'hôte) ou B (Firebase/Supabase, compte gratuit nécessaire) ?
- **Q2 — Modes de jeu** : peux-tu m'envoyer des captures (ou une description) de : la fin de la liste après « Sandwich », l'onglet **Personnalisations**, et préciser les modes marqués ❓ dans le tableau ?
- **Q3 — Limites** : nombre max de joueurs par salle (jeux et toile partagée) ? Taille de la toile partagée (ex. 4000×4000 px, ou « infinie » qui s'agrandit) ?
- **Q4 — Langues** : français uniquement, ou français + anglais (+ autres) ?
- **Q5 — Joueurs** : simple pseudo + avatar choisi dans une liste ? Ou avatar dessiné par le joueur ? Pas de comptes ni de connexion ?
- **Q6 — Nom du site** et éventuelle couleur/ambiance souhaitée (ou je propose) ?
- **Q7 — Salles** : uniquement privées (code/lien) ou aussi une liste de salles publiques ? Mot de passe ?
- **Q8 — Technique** : OK pour Vite + TypeScript + Svelte, ou préférence (React, JS pur…) ?
- **Q9 — Dépôt** : le site sera servi sur `https://<ton-pseudo>.github.io/DrawingTogether/` — ou un nom de domaine perso ?
- **Q10 — Toile partagée** : un calque par joueur ou tout le monde sur les mêmes calques ? Doit-elle être sauvegardée quand tout le monde part (nécessite l'option B) ?
- **Q11 — Bureau** : plutôt **Krita** (complet, panneaux ancrés, sombre) ou plutôt **Paint** (simple, ruban en haut) ? Les deux sont très différents.
- **Q12 — Pinceaux** : la catégorie « Décoration » (étoiles, motifs…) est-elle importante ? Faut-il les ~40 pinceaux dès le début ou une dizaine d'abord ?
- **Q13 — Dessin pendant les jeux** : l'éditeur complet (calques, tous les pinceaux) ou une version simplifiée et rapide comme dans les jeux de ce type ?
