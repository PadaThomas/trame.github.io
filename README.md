# TRAME

**Dessinez • Connectez • Pilotez** — synoptiques techniques pour le spectacle vivant (réseau, DMX, son, vidéo). Application web statique, sans installation.

Identité visuelle : voir `brand/` (logos, symbole, favicon, `README-charte.md`) et `css/trame-tokens.css` (couleurs, polices, thèmes clair / sombre).

## Lancer

- Ouvrir `dist/TRAME.html` dans Chrome, Safari ou Firefox (fichier unique, autonome).
- Après une modification du code : `./build.sh` régénère `dist/TRAME.html` (et une copie `dist/Synoptique.html`, ancienne adresse, le temps de la transition).
- Polices de la charte : Space Grotesk (titres), Inter (interface), JetBrains Mono (ports, IP), intégrées dans `dist/TRAME.html` (dossier `fonts/`, licence OFL) : rendu identique hors ligne sur tous les postes.

## Mettre en ligne (GitHub Pages)

- `./build.sh` prépare aussi le dossier **`docs/`** : `index.html` (l'application), manifeste, icônes et service worker (fonctionne hors ligne après la 1re visite, installable sur l'écran d'accueil).
- Sur GitHub : *Settings › Pages › Build and deployment › Deploy from a branch* → branche `main`, dossier **`/docs`**.
- Adresse : `https://<compte>.github.io/<dépôt>/`. Sur iPad : Safari › Partager › « Sur l'écran d'accueil ».
- Sur iPad, « Enregistrer » ouvre la feuille de partage → « Enregistrer dans Fichiers ».
- Après chaque modification : `./build.sh`, puis commit + push ; la nouvelle version s'affiche à l'ouverture suivante de l'app.

## Fonctions

- **Tactile et navigation** : 1 doigt = sélectionner / déplacer un appareil / déplacer la vue, 2 doigts = pincer pour zoomer (seul l'espace de travail zoome, jamais la page), double tape sur un appareil = détail des ports, toucher un modèle de la bibliothèque = l'ajouter. Clic molette (souris) = déplacer la vue n'importe où. Déplacer la vue ne désélectionne rien et n'annule pas un câble en cours de tirage ; seul un simple clic / tape dans le vide le fait.

- **Barre du haut** : onglets (Synoptique / Câbles / Nomenclature), Détaillée / Simplifiée, menu « Affichage » (zones, faisceaux, contournement, thème), « Réseaux & câbles », menu « Fichier » (nouveau, ouvrir, enregistrer, export PDF / SVG). Les libellés se raccourcissent quand la fenêtre est étroite.
- **Panneaux latéraux repliables** : petites languettes ‹ › au milieu des bords gauche et droit du synoptique (ou touches `[` et `]`) pour masquer la bibliothèque et l'inspecteur ; l'état est mémorisé. Inspecteur replié : il s'ouvre tout seul quand on sélectionne un câble, un faisceau ou un appareil, et se replie de nouveau quand on désélectionne.

- **Bibliothèque** (238 modèles) : consoles lumière (MA, ETC, ChamSys), consoles son (Allen & Heath dLive / Avantis / SQ / Qu / CQ, Yamaha), amplis L-Acoustics (LA4X, LA12X, LA7.16…) et enceintes (L-Acoustics A10 / A15 / X / KS, QSC K.2), stageboxes et périphériques A&H (DX, AudioRack, Dante DT, ME, IP), projecteurs Martin, Ayrton, Clay Paky, Robe, Robert Juliat (Sully, Zep²), Starway, Cameo… Les liaisons SLink / DX / gigaACE sont typées « audio numérique » (pas Ethernet).
- **Bibliothèque** d'appareils avec leurs ports (connecteur, type de réseau, sens). Badge `doc ✓` = recoupé avec la doc constructeur, `à vérifier` = générique, `web` = issu de la recherche web.
- **Barre latérale repliable** : cliquer sur le titre Bibliothèque / Zones / Filtres replie la section. Dans la bibliothèque, la liste « Catégories » et chaque catégorie sont fermées au démarrage ; une recherche les ouvre automatiquement.
- **Validation des modèles** : un badge « à vérifier » (dans la bibliothèque ou l'inspecteur) ouvre une fenêtre pour comparer avec la doc constructeur, corriger les ports et valider. La validation (date, commentaire, ports corrigés) est gardée dans le projet et dans le navigateur ; les appareils déjà placés peuvent être mis à jour (les câbles des ports conservés restent branchés). Case « Seulement à vérifier » pour lister ce qui reste à contrôler.
- **Ajouter par recherche web** : tapez un nom d'appareil, l'assistant (API Claude + recherche web) lit la fiche technique et propose la liste des ports, que vous relisez avant enregistrement. Nécessite une clé API Anthropic (stockée seulement dans le navigateur).
- **Créer un appareil** à la main, en saisie rapide : `6 x DMX ; XLR5F ; dmx ; out ; A` (une ligne par groupe de ports, `pass` pour un port traversant de brassage).
- **Baies** : glissez des appareils dedans, ils suivent la baie quand on la déplace.
- **Côté des ports** : dans l'inspecteur, colonne « Côté » (Auto / Gauche / Droite) pour chaque port, boutons « Tous à gauche / à droite / Auto », et « Retourner » pour inverser tout le périphérique (ports traversants compris). Les câbles suivent.
- **Connecteurs bicolores** : l'anneau extérieur prend la couleur du type de réseau (DMX, Ethernet…), l'intérieur celle du câble branché (univers, VLAN…) ; un connecteur libre est vide.
- **Anti-chevauchement** : chaque câble dessiné occupe une grille ; un câble dont la courbe recouvrirait un câble existant (ou passerait sous un appareil) est re-tracé en contournant, en évitant les zones occupées, puis ses segments sont décalés sur la voie libre la plus proche (±8, ±16, ±24 px). Seuls des croisements ponctuels subsistent.
- **Contournement** : les câbles et faisceaux font le tour des appareils au lieu de passer dessous. Si deux appareils sont collés et qu'il n'y a pas de passage, le câble passe dessous. Case « Contourner » pour désactiver. Un tracé déplacé à la main passe par le point choisi, mais s'il croise un appareil (ou si on pose un appareil dessus), il est recalculé pour le contourner ; un point lâché sur un bloc est repoussé au bord libre le plus proche.
- **Boîtes / panneaux de brassage** : ports traversants (côté gauche = liaison, côté droit = face).
- **Boîtiers muraux et baie scéno** : sur un boîtier, « Raccorder » relie chaque port libre à la baie choisie (ports créés au nom du boîtier). Chaque liaison fixe est nommée automatiquement « départ – arrivée » (ex : « Boîtier mur cour – Baie scéno » ; un répartiteur rangé dans une baie prend le nom de la baie), et suit les renommages ; un repère saisi à la main reste prioritaire. Ces liaisons fixes s'affichent en faisceau, avec seulement leur nom (le contenu « 2 Ethernet · 1 DMX… » est en info-bulle et dans l'inspecteur) ; case « Faisceaux » pour voir le détail.
- **Compatibilité des connecteurs** : chaque câble est vérifié selon ses deux connecteurs (36 types, toutes les paires). Connexion impossible (ex. DisplayPort → powerCON, sortie haut-parleur → entrée XLR, alimentation → signal) : alerte rouge à la création, câble signalé « ⛔ Incompatible ». Adaptateur ou convertisseur nécessaire (XLR5 / RJ45, SDI / HDMI, fibre / RJ45, inverseur XLR…) : on demande s'il est en place. L'inspecteur du projet donne le bilan et un clic passe d'un câble à corriger au suivant.
- **Arrivées séparées dans la baie** : quand un répartiteur reçoit les liaisons fixes de plusieurs boîtiers, ses ports sont regroupés en un bloc par boîtier, avec le nom du boîtier en titre (et le nom du port raccourci).
- **Patch DMX** : sur les projecteurs et gradateurs, univers (vide = déduit du câble DMX qui arrive), adresse, nombre de canaux et mode. Le patch s'affiche dans l'en-tête de l'appareil (« DMX U1 · 001–016 · Mode 2 ») et dans la nomenclature ; les chevauchements d'adresses dans un même univers et les dépassements du canal 512 sont signalés. « Dupliquer » patche la copie à la suite.
- **Adresses IP** : l'IP d'un appareil s'affiche sur le synoptique ; un clic ouvre sa page de configuration (http://IP/ ou une adresse personnalisée).
- **Zones** : cadre coloré autour des appareils de chaque zone (salle, plateau, local…). Glisser la barre de titre d'une zone la déplace en entier, avec ses appareils, baies et tracés.
- **Réseaux & câbles** : une couleur par type de réseau (par défaut celles de la charte : lumière/DMX orange, audio bleu, vidéo violet, réseau turquoise, énergie rouge ; bouton « Couleurs de la charte TRAME » pour les réappliquer à un projet existant), et une par sous-réseau (Univers 1 cyan, Univers 2 orange, VLAN…). L'univers attribué à un câble se propage en aval (splitters, thru, brassages).
- **Vues** : détaillée (tous les ports + connecteurs), simplifiée (seulement les ports câblés ; sur un boîtier / panneau de brassage, seuls les ports câblés en volant s'affichent, et une liaison fixe n'apparaît que si ses deux bouts sont câblés), filtres par réseau, double-clic = détail de tous les ports d'un appareil.
- **Listes** : liste des câbles (export CSV), nomenclature par zone.
- **Fichiers** : chaque projet est un fichier **`.trame`** (contenu JSON lisible). « Enregistrer » (⌘S / Ctrl+S) met à jour le fichier ouvert, « Enregistrer sous… » (⇧⌘S) en crée un nouveau, « Ouvrir… » (⌘O) — ou glisser-déposer un `.trame` sur la fenêtre. Les anciens fichiers `.json` s'ouvrent toujours. Le nom du fichier en cours s'affiche à côté du nom du projet (• = modifications non enregistrées). Sous Chrome / Edge le fichier est réécrit directement ; sous Safari / Firefox, une copie est téléchargée. Enregistrement automatique dans le navigateur en plus. Exports SVG et PDF (synoptique + câbles + nomenclature, A3 paysage, via « Enregistrer en PDF » du navigateur).
- **Partager** : Fichier › « Partager l'application (TRAME.html) » télécharge l'application complète en un seul fichier (polices comprises, fonctionne hors ligne, rien à installer). Envoyez `TRAME.html` + vos fichiers `.trame` : le destinataire ouvre TRAME.html dans son navigateur puis dépose le `.trame` dessus.
- **Thème** : sombre par défaut, ou auto / clair.

## Structure

- `js/library.js` — connecteurs, types de réseaux, modèles d'appareils
- `js/ai-import.js` — recherche web d'un appareil via l'API Claude
- `js/app.js` — éditeur (rendu SVG, câblage, inspecteur, tableaux)
- `css/style.css`, `index.html`, `build.sh`
