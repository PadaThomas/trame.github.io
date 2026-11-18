# TRAME — mini charte graphique

## Positionnement
TRAME est un outil web universel de création et de lecture de synoptiques techniques pour le spectacle vivant.
Promesse : rendre les infrastructures techniques lisibles, partageables et maîtrisables.

## Signature
**Dessinez • Connectez • Pilotez**
Signature descriptive alternative : *Synoptiques techniques pour le spectacle vivant.*

## Logo
- Le symbole représente un T abstrait construit comme un chemin de connexion.
- Les trois nœuds carrés évoquent les points de raccordement.
- Utiliser `trame-logo-dark.svg` sur fond sombre et `trame-logo-light.svg` sur fond clair.
- Utiliser les fichiers `trame-symbol-*.svg` ou `favicon.svg` pour les petites surfaces.
- Zone de protection minimale : largeur d'un nœud autour du logo.
- Taille minimale recommandée : 120 px de large pour le logo complet, 24 px pour le symbole.
- Ne pas étirer, recolorer arbitrairement, ajouter d'ombre ou placer sur un fond chargé.

## Couleurs
| Rôle | Couleur sombre | Couleur claire |
|---|---|---|
| Fond | `#10131A` | `#F5F7FA` |
| Surface | `#1B202B` | `#FFFFFF` |
| Texte | `#F4F5F7` | `#17202B` |
| Texte secondaire | `#AAB3C2` | `#667085` |
| Accent principal | `#FFAA24` | `#C87900` |
| Signal / audio | `#21A8EF` | `#087DBB` |
| Réseau | `#36C9AD` | `#138B76` |

Les couleurs d'accent servent à identifier les actions et les familles techniques. Garder les fonds de panneaux neutres pour préserver la lisibilité.

## Typographie
- Titres et identité : Space Grotesk, graisse 600–700.
- Interface : Inter, graisse 400–600.
- Valeurs techniques, ports et adresses : JetBrains Mono.
Prévoir des polices de repli système.

## Principes d'interface
1. Interface hybride : navigation à gauche, grande zone de dessin au centre, inspecteur contextuel à droite.
2. Le synoptique est la priorité visuelle : donner le maximum d'espace au canevas.
3. Les panneaux et outils restent sobres ; la couleur identifie les disciplines et les états.
4. Prévoir un thème clair et un thème sombre avec les mêmes contrastes fonctionnels.
5. Les éléments sélectionnés doivent être identifiables autrement que par la couleur seule (contour, icône ou libellé).
6. Les actions destructives utilisent une confirmation explicite.
7. Prévoir clavier, focus visible, zoom et densité d'affichage adaptés aux longues sessions de régie.

## Couleurs de disciplines — proposition initiale
- Lumière : orange `#FFAA24`
- Audio : bleu `#21A8EF`
- Vidéo : violet `#A78BFA`
- Réseau : turquoise `#36C9AD`
- Énergie : rouge `#E45B65`
- Machinerie / structure : gris ardoise `#94A3B8`

Ces couleurs sont des repères visuels proposés ; elles ne remplacent pas les libellés, légendes ou conventions de sécurité propres aux installations.

## Intégration web
Inclure `web/trame-tokens.css` dans la feuille de style globale.
Basculer le thème en posant `data-theme="dark"` ou `data-theme="light"` sur l'élément `<html>`.
Le layout hybride utilise `.trame-app-shell`, `.trame-sidebar`, `.trame-workspace` et `.trame-inspector`.
