# Mushroom Kids : test sur ton PC

Tout ce qui s'affiche, dans l'extension comme dans les animations, est en anglais. Cette notice est en français, pour toi.

Deux morceaux :

- `overlay.html` : les enfants et la jauge de chaleur, affichés dans OBS (source Navigateur).
- `extension/` : extension Chrome qui lit le chat Stripchat et prévient OBS quand un tip « Feed the kids » ou « Cuddle the kids » passe.

Le signal passe par le serveur WebSocket intégré à OBS. Tout reste sur le PC.

Pour la présentation :

- `index.html` : la page de présentation (GitHub Pages), en anglais, avec deux onglets :
  - **All states** : feed, cuddle et les 6 humeurs côte à côte, en mouvement ;
  - **Live example** : on tipe soi-même (boutons ou touches F et C), avec le compteur de la jauge et l'échelle des humeurs.
  
  Chaque aperçu est le vrai `overlay.html`, sans OBS. Ouverte en local (double-clic), elle sert aussi de page de test.
- `presentation/` : les 4 GIF et le mail en vietnamien (`email-vi.txt`). Sa traduction en français, avec la marche à suivre pour insérer les GIF dans Gmail, est dans `email-fr.txt`. Les deux mails restent en local : ils sont exclus du repo par `.gitignore`.

## 0. Mettre la page en ligne (GitHub Pages)

Repo : https://github.com/VinceIXIV/Mushroom-kid

1. Pousser le dossier `champignons-obs` à la racine du repo. `index.html` charge `overlay.html` à côté de lui.
2. Sur GitHub : *Settings → Pages → Source : Deploy from a branch*, branche `main`, dossier `/ (root)`.
3. Après une minute, la page est en ligne : https://vinceixiv.github.io/Mushroom-kid/. Le mail pointe directement sur l'onglet de l'exemple : `…/Mushroom-kid/#live`.

Avec un compte gratuit, GitHub Pages ne marche que si le repo est **public**. Tout le code devient alors visible : il ne contient rien de personnel, mais ne pas y mettre le mot de passe OBS (laisser `obsPassword: ""` dans le repo).

Pour refaire les GIF après un changement de noms ou de couleurs, les scripts sont dans `presentation/tools/` :

1. `make-demo.py` fabrique une copie de l'overlay qui joue une scène.
2. `capture.mjs` la filme au ralenti dans Edge.
3. `build-gif.py` assemble le GIF.

## 1. OBS : activer le WebSocket

1. *Outils → Paramètres du serveur WebSocket*.
2. Cocher **Activer le serveur WebSocket**. Laisser le port à 4455.
3. Garder **Activer l'authentification** coché, puis cliquer sur **Afficher les infos de connexion** et copier le mot de passe.

## 2. OBS : ajouter les enfants

1. Ouvrir `overlay.html` dans un éditeur de texte et coller le mot de passe dans `obsPassword: ""` (ligne 143). Enregistrer.
2. Dans OBS : *Sources → + → Navigateur*.
   - Cocher **Fichier local** et choisir `overlay.html`.
   - Largeur **480**, hauteur **360**.
3. Placer et redimensionner la source où on veut. Le fond est transparent.

Si l'overlay est modifié plus tard : clic droit sur la source → *Propriétés* → **Actualiser le cache de la page actuelle**.

## 3. Chrome : installer l'extension

1. Aller sur `chrome://extensions` et activer le **Mode développeur** (en haut à droite).
2. Cliquer sur **Charger l'extension non empaquetée** et choisir le dossier `extension`.
3. Épingler l'icône 🍄, l'ouvrir, coller le mot de passe WebSocket, puis cliquer sur **Save**.
4. En haut de la popup, on doit lire **OBS: connected**.

## 4. Tester les animations

Dans la popup, sous *Try it* :

- **🍪 Feed** : les enfants mangent, puis leurs joues rosissent. La bulle affiche « {pseudo} fed the kids 🍪 ».
- **🤗 Cuddle** : ils se serrent l'un contre l'autre, avec des cœurs. La bulle affiche « {pseudo} cuddled the kids 💕 ».
- **Reset warmth** : remet la jauge de chaleur à zéro.

La bulle disparaît quand ils retournent à leur boucle de repos.

La jauge ne monte qu'avec les tips feed et cuddle, du montant du tip. Elle ne redescend pas toute seule. Seul le bouton **Reset warmth** la remet à zéro.

Tout se règle dans la popup, puis **Save** :

- **Triggers** : le nom de chaque item du tip menu et son prix (*price (tk)*), 25 et 50 par défaut. C'est aussi ce que chaque tip ajoute à la jauge.
- **Warmth gauge** : le nombre de tokens qui remplit la jauge à 100 %, 2000 par défaut. L'overlay le reçoit à chaque *Save*, ou avec chaque animation, puis le retient.

## 5. Tester avec de vrais tips (compte viewer)

1. Ouvrir une room Stripchat en live où ça tipe.
2. Dans la popup, cocher **Test mode: any tip triggers an animation**, puis cliquer sur **Save**. Chaque tip lance alors feed, puis cuddle, puis feed…
3. La liste **Latest tips seen** de la popup montre ce que l'extension a vu.

Pour me montrer le format d'un tip du tip menu : juste après ce tip, clique sur **📋 Copy the HTML of the latest chat messages** (section *Diagnostics*) et colle-moi le résultat. Si la liste reste vide alors que des tips passent dans le chat, fais pareil : c'est que Stripchat affiche les tips autrement que prévu, et je corrige.

Après le test, **décocher le Test mode**. En vrai, seuls ces tips déclenchent une animation :

- un tip dont le message contient **le nom de l'item** du tip menu (« Feed the kids », « Cuddle the kids ») ;
- ou un tip du **montant exact** indiqué (25 et 50 par défaut, modifiables dans la popup).

## Tester l'overlay sans OBS

Le plus simple : ouvrir `index.html` (double-clic). L'onglet *All states* montre tout en même temps, et l'onglet *Live example* permet de jouer.

Pour l'overlay seul, ouvrir `overlay.html?test=1&obs=0` dans Chrome. Retirer `&obs=0` pour tester aussi la connexion à OBS. Les touches sont :

- **F** : feed (+25 tk)
- **C** : cuddle (+50 tk)
- **1** à **9** : jauge à 10–90 %
- **0** : jauge à zéro
- **+** : +200 tokens

Le bandeau en haut rappelle les touches et indique si la connexion à OBS fonctionne.
