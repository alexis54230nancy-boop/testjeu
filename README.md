# Runner 3D

Un petit jeu d'arcade en 3D dans le navigateur, fait avec [Three.js](https://threejs.org/).
Le joueur court sur une piste à 3 voies, doit éviter les obstacles (sauter ou glisser)
et collecter des pièces d'or. La vitesse augmente progressivement.

## Lancer le jeu

Aucune installation nécessaire : tout est en HTML/CSS/JS statique, three.js est
inclus localement dans `vendor/`.

```bash
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000 dans un navigateur.

(Ou ouvrir directement `index.html` dans un navigateur, selon les restrictions
CORS de celui-ci.)

## Contrôles

- `←` / `→` ou `A` / `D` : changer de voie
- `↑` / `W` / `Espace` : sauter (obstacles bas)
- `↓` / `S` : glisser (obstacles hauts)

Des boutons tactiles apparaissent automatiquement sur mobile.

## Structure

- `index.html` — page et interface (écrans de démarrage / game over)
- `style.css` — mise en page et style de l'interface
- `game.js` — logique du jeu (scène 3D, génération procédurale, collisions, score)
- `vendor/three.min.js` — bibliothèque Three.js (r160), incluse localement
