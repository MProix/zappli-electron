---
name: testing-zappli
description: How to run and end-to-end test the Zappli Electron app (card drawing from images/word lists) on a Linux VM, including renderer console capture, file dialogs and drag and drop.
---

# Tester Zappli (Electron) sur une VM Linux

## Lancer l'appli
- `npm install` puis `npm start` (= `electron .`) depuis la racine du repo.
- Tuer **toutes** les instances avant de relancer : `pkill -f "electron/dist/electron"` (vérifier avec `pgrep -af electron`).
  Une instance survivante garde le port CDP : `http://127.0.0.1:9222/json` renvoie alors l'ancienne vue
  (par ex. `home_fr.html`) alors que la fenêtre visible est déjà en anglais.
- Les erreurs `bus.cc(407)`, `viz_main_impl.cc` et `GPU process launch failed` dans les logs sont du bruit de VM headless, pas des bugs.
- Pour capturer la console du renderer, lancer plutôt :
  `./node_modules/.bin/electron . --remote-debugging-port=9222`
  (le lancer dans un shell d'arrière-plan persistant ; `nohup ... &` dans un one-shot exec peut ne pas survivre).

## Lire la console du renderer sans ouvrir DevTools
- Installer `ws` dans un dossier de travail (`npm install ws --prefix ~/test-zappli`).
- Un petit script CDP (`http://127.0.0.1:9222/json` → WebSocket, `Runtime.enable` + `Log.enable`) suffit pour logger
  `Runtime.consoleAPICalled`, `Runtime.exceptionThrown` et `Log.entryAdded` dans un fichier.
- Un second script `Runtime.evaluate` permet de lire l'état interne sans passer par l'UI, par ex. :
  - nombre de cartes affichées : `document.querySelectorAll("#affichageDesCartes1 .img").length`
  - paquet courant : `JSON.parse(document.querySelector("#affichage1 > .listeAffichable").innerHTML)`
    → `[nb, listeImages, "images"]` ou `[nb, fichiers, "mots", listeMots]`
  - liste importée conservée pour le rechargement : `#affichage1 > .listeSource`
  - type imposé pour ne pas reposer la question mots/images : attribut `data-type` du `.mainDiv`
  - fond : `document.querySelector("#affichage").style.backgroundImage`
- Attention : `Runtime.enable` rejoue les messages console déjà bufferisés ; repérer les nouveaux via un marqueur horodaté.
- Pour vérifier l'absence d'erreur au chargement (utile après un bump de jQuery / jQuery UI) : attacher le logger CDP
  PUIS déclencher `Page.reload`, et vérifier `jQuery.fn.jquery`, `jQuery.ui.version`, `typeof jQuery.fn.draggable`.

## Repères UI (vue home_fr.html)
- Zone d'import : bouton « Sélectionnez un dossier » (`#folderChosen<N>`), « Sélectionnez un ou des fichiers » (`#folderChosen2-<N>`), zone de dépôt `.dropZone2`.
- Barre du bas d'une zone : champ « Nombre de cartes », play (`#play`), `+1` (`#oneMore`), gomme (`.zero`), retour au choix du dossier (`.backToChooser`), case « Ne pas répéter les cartes » (`#repet`, cochée par défaut).
- Barre du haut : Tout mélanger, Revenir en arrière, Déplacer / Effacer / Changer / Surligner une carte, Numéroter, Changer le fond (`#fondPicker`), Supprimer le fond.
- Dossier contenant à la fois images et tableur → popup swal « Vous avez importé à la fois des listes de mots et des images » avec « Je choisis les mots » / « Je choisis les images ».

## Changer la langue de l'interface
- Menu de la fenêtre : `Action` → `Changer la langue d'affichage` / `Change display language` → `English` / `Français`.
- `changeLanguage()` fait `app.relaunch()` + `app.exit()` : le flag `--remote-debugging-port=9222` est bien conservé,
  mais le logger CDP doit être **relancé** après chaque changement de langue (le target précédent disparaît).
- `home.js` lit `document.documentElement.lang` ; contrôle rapide après bascule :
  `{lang, melange:!!#melange, oneMore:!!#oneMore, repet:!!#repet, dragover:#affichage1[ondragover]}`.
- Textes de la 2e zone générée par `ajouterZone()` : vérifier `#repetition label` et les attributs `title`
  des boutons `+`/`-` (`add a folder` / `remove a folder` vs `ajouter un dossier` / `supprimer un dossier`).
- La langue est persistée dans `~/.config/zappli/config.json` : elle survit à un redémarrage manuel.
- Tous les textes affichés viennent de `erreurs.json`, popups compris (`erTitre`, `erMotsEtImages`,
  `choixMots`/`choixImages`, `erDossierVide`, `notifsAVenir`…) : un texte français en mode anglais est une régression.

## Jeux de test
Générer sur disque (par ex. `~/test-zappli/`) : un dossier de ~150 png (pour la limite `readEntries` à 100),
un dossier avec un seul .csv/.xlsx, un dossier MIXTE images + tableur de ~5 mots (épuisement rapide du paquet),
et un dossier au nom contenant espaces/parenthèses/accents avec une image de fond.
Créer un .xlsx sans dépendance Python : `node -e` avec le module `xlsx` déjà présent dans node_modules.

## Boîtes de dialogue de fichiers (GTK sous KDE)
- La saisie de chemin par `Ctrl+L` peut ne pas valider la sélection : plus fiable de cliquer le raccourci « Home »
  ou le fil d'Ariane, puis de sélectionner le dossier dans la liste et cliquer « Upload » / « Select Folder ».

## Drag and drop de dossiers
- Dolphin est disponible (`dolphin ~/test-zappli`). Placer Zappli et Dolphin côte à côte
  (`wmctrl -r Zappli -b remove,maximized_vert,maximized_horz` puis `wmctrl -r Zappli -e 0,x,y,w,h`).
- Le drag inter-applications fonctionne : `mouse_move` sur l'icône du dossier, `left_mouse_down`, plusieurs
  `mouse_move` jusqu'à la zone de dépôt, screenshot pendant le maintien, puis `left_mouse_up`.
- Piège : si la fenêtre Zappli n'a pas été activée récemment, le `drop` peut être ignoré silencieusement
  (aucun log `getDropFiles`). Cliquer d'abord dans la fenêtre Zappli pour lui donner le focus, puis repartir
  de Dolphin ; faire plusieurs petits `mouse_move` près de la cible et attendre 2-3 s avant de relâcher.

## Devin Secrets Needed
Aucun.
