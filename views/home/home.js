// IMPORTS
// ipcRenderer : envoie des messages au processus principal (main.js) et reçoit les siens
// webUtils : donne le chemin disque d'un objet File (remplace file.path, supprimé par Electron)
const { ipcRenderer, webUtils } = require('electron')
const path = require("path") // séparateurs de chemins propres à l'OS
//const { type } = require('process')
const swal = require('sweetalert') // popups (remplaçant de alert(), avec du HTML et des boutons)
const fs = require('fs') // lecture de erreurs.json depuis le disque
const { json } = require('stream/consumers') // importé mais inutilisé dans ce fichier

// ============= VARIABLES GLOBALES ============= //
var erreurs = {} // tous les textes traduits (erreurs.json), rempli quelques ms après le chargement
var selected = "deplace" // pour connaitre constamment l'action au click sélectionnnée par l'utilisateur
var sensDAffichage = "portrait" // pour affiner au mieux l'affichage des tailles il faut connaitre le sens des zones d'affichage
var draggableActive = true // pour savoir si draggable est déjà désactivé sur les images
var pile = [] // pour créer un historique des modifications
var listOfValidExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".tiff", ".PNG", ".JPG", ".JPEG", ".WEBP", ".GIF", ".TIFF"] // on stocke les extensions valides pour l'affichage des images
var listOfValidListsOfWordsExtensions = [".numbers", ".xlsx", ".xsl", ".ods", ".csv"] // on stocke les extensions valides pour l'affichage de listes de mots
var nbZones = 1 // pour toujours savoir combien on a de zones d'affichage
var identifiantZone = 1 // pour incrémenter les zonnes et y envoyer les bonnes infos
// tailles[sens]["lignes"|"col"] : pour un nombre de cartes donné, quelle hauteur/largeur donner à chaque carte
// chaque sous-tableau = [ ...nombres de cartes concernés, "pourcentage à appliquer" ]
// "portrait" (zone plus haute que large) et "paysage" sont l'inverse l'un de l'autre
var tailles = {
    "portrait":
    {
        "col": [
            [1, 2, 3, "97%"],
            [4, 5, 6, 7, 8, "47%"],
            [9, 10, 11, 12, 15, "31%"],
            [13, 14, 16, 17, 18, 19, 20, 21, 22, 23, 24, "22%"]
        ],
        "lignes": [
            [1, "97%"],
            [2, 4, "47%"],
            [3, 5, 6, 9, "31%"],
            [7, 8, 10, 11, 12, 13, 14, 16, "22%"],
            [17, 18, 19, 20, 15, "17%"],
            [21, 22, 23, 24, "15%"]
        ]
    },
    "paysage":
    {
        "col": [
            [1, "97%"],
            [2, 4, "47%"],
            [3, 5, 6, 9, "31%"],
            [7, 8, 10, 11, 12, 13, 14, 16, "22%"],
            [17, 18, 19, 20, 15, "17%"],
            [21, 22, 23, 24, "15%"]
        ],
        "lignes": [
            [1, 2, 3, "97%"],
            [4, 5, 6, 7, 8, "47%"],
            [9, 10, 11, 12, 15, "31%"],
            [13, 14, 16, 17, 18, 19, 20, 21, 22, 23, 24, "22%"]
        ]
    }
}
var langue = document.documentElement.lang // "fr" ou "en", pris sur l'attribut lang du <html> (home_fr / home_en)
//console.log(langue)

// ============= Différenciation de la barre du haut selon l'OS ============= //
ipcRenderer.on('OS', (evt, arg) => { // main.js envoie le nom du système au démarrage
    if (arg == "darwin") { // macOS : le système dessine déjà ses propres boutons de fenêtre
        $("#titre").css("justify-content", "center"); // titre centré comme le veut macOS
        $("#showHideMenus").css("display", "none"); // le menu natif est dans la barre du système
        $(".topBtn").css("display", "none"); // on masque nos boutons fermer/réduire/agrandir maison
        //$("#header").addClass("headerBackground");
    }
});
// ============= RÉCUPÉRATION DU DOSSIER UTILISATEUR ============= //
ipcRenderer.on('mainDir', (evt, arg) => { // main.js envoie le dossier d'installation de l'appli
    $($(".mainDir")[0]).attr('id', arg) // on le stocke dans l'id d'un div caché, faute de variable partagée
})
sleep(200).then(() => { // on laisse le temps au message 'mainDir' d'arriver avant de lire le fichier
    erreurs = JSON.parse(fs.readFileSync(path.join($(".mainDir")[0].id, "erreurs.json"), encoding = 'utf-8'))
})
// ============= AFFICHAGE DU MENU SOUS WINDOWS ============= //
$("#showHideMenus").on("click", () => {
    ipcRenderer.send('fireMenu') // seul le processus principal peut ouvrir le menu natif
})
// ============= RENDRE LES MENUS RESIZABLES ============= //

$("#leftRightMoving").on("mousedown", (e) => { // séparateur vertical entre le menu de gauche et les cartes
    //On vérifie que le curseur est sur la bordure qui sert à déplacer
    if (Math.abs(e.offsetX - $(e.target).width()) <= 7) { // tolérance de 7 px autour du bord droit
        document.addEventListener("mousemove", resizeGauche, false); // tant que la souris bouge, on redimensionne
    }
})
$("#topBottomMoving").on("mousedown", (e) => {
    //On vérifie que le curseur est sur la bordure qui sert à déplacer
    if (Math.abs(e.offsetY - $(e.target).height()) <= 7) {
        document.addEventListener("mousemove", resizeHaut, false); // on ajoute un événement au déplacement de la souris : un resize des deux divs concernés
    }
})
function resize(e, minSize, maxSize, direction) { // redimensionne un panneau en suivant la souris, entre deux bornes
    if (direction == "x") { // séparateur vertical : on suit l'abscisse du curseur
        if (minSize < e.clientX && e.clientX < maxSize) { // on refuse les tailles trop petites ou trop grandes
            $("#folderChooser").css("width", e.clientX) // le menu de gauche prend la largeur du curseur
            $("#cardsContainer").css("width", "calc(100% - " + e.clientX + "px") // la zone des cartes prend le reste
        }
    } else if (direction == "y") { // séparateur horizontal : on suit l'ordonnée du curseur
        if (minSize < e.clientY && e.clientY < maxSize) {
            $("#actionsMenu").css("height", e.clientY) // la barre d'actions prend la hauteur du curseur
            $("#mainContent").css("height", "calc(100% - " + e.clientY + "px") // le contenu prend le reste
        }
    }
}
$(document).on("mouseup", () => { // on supprime l'évènement quand le click se relâche
    document.removeEventListener("mousemove", resizeGauche, false)
    document.removeEventListener("mousemove", resizeHaut, false)
})
//fonctions intermédiaires pour passer les paramètres en dehors de l'event
// (removeEventListener exige la même référence de fonction : on ne peut donc pas passer une fonction anonyme)
function resizeGauche(e) { resize(e, 108, 320, "x") } // menu de gauche : entre 108 et 320 px
function resizeHaut(e) { resize(e, 45, 150, "y") } // barre du haut : entre 45 et 150 px

// ============= ON GERE L'AJOUT OU LA SUPPRESSION DE ZONES D'AFFICHAGE DANS LA PARTIE PRINCIPALE ============= //

function synchroniserZones() { // l'historique remplace le HTML de l'affichage : on recale les compteurs sur ce qui est réellement à l'écran
    nbZones = $("#affichage>div").length // nombre de zones réellement présentes dans le DOM
    var maxId = 0
    for (let zone of $("#affichage>div")) {
        var num = parseInt(zone.id.replace("affichage", "")) // "affichage3" -> 3
        if (num > maxId) { maxId = num }
    }
    identifiantZone = maxId // la prochaine zone créée prendra maxId + 1, sans doublon d'id
}
function attendreImages(zone) { // getBoundingClientRect vaut 0 tant que l'image n'est pas décodée : sur un disque lent, un délai fixe mesure trop tôt
    return Promise.all($.map($(zone).find("img.img"), (img) => { // une promesse par image de la zone
        if (img.complete) { return Promise.resolve() } // déjà chargée (ou en cache) : rien à attendre
        return new Promise((resolve) => {
            img.addEventListener("load", resolve, { once: true }) // chargement terminé
            img.addEventListener("error", resolve, { once: true }) // image illisible : on débloque quand même
        })
    })) // résolue quand toutes les images ont fini (ou échoué)
}
function remesurerZone(zone) { // zone = "#affichageDesCartesN" : les tailles des cartes sont figées en pixels, il faut les reprendre à chaque changement de largeur de colonne
    var quelleZone = zone.replace("#affichageDesCartes", "") // on ne garde que le numéro de la zone
    // on annule déplacements et tailles figées pour repartir d'une grille propre
    $(zone).find(".cardContainer").css({ "left": "", "top": "", "width": "100%", "height": "100%" })
    calculerTaille(zone) // applique les pourcentages de la table tailles selon le nombre de cartes
    return attendreImages(zone).then(() => { // on ne mesure qu'une fois les images décodées
        for (let img of $(zone).find(".img")) {
            poserTaillesEtPlaces(img) // mémorise la géométrie de référence, base de calcul du zoom
        }
        if ($("#vol" + quelleZone).length > 0) { // s'il y a un curseur de zoom pour cette zone
            zommOnCards($("#vol" + quelleZone)[0]) // on réapplique le niveau de zoom choisi
        }
    })
}
function remesurerToutesLesZones() { // après ajout/suppression de zone, toutes les largeurs ont changé
    for (let zone of $(".affichageDesCartes")) {
        remesurerZone("#" + zone.id)
    }
}
function ajouterZone(elt) { //pour ajouter une zone --> l'appel de la fonction se gère dans le html avec un event handler onclik sur .addFolderChooser, mais aussi dans la zone supllémentaire insérée ci-dessous, de la même manière
    synchroniserZones() // on repart de ce qui est réellement affiché
    if (nbZones < 5) { // 5 zones maximum
        nbZones += 1
        identifiantZone += 1 // identifiant unique de la nouvelle zone
        $("#affichage>div").removeClass() // on enlève la classe préexistante sur tous les divs de l'affichage
        $("#affichage>div").addClass("nbDiv" + nbZones + " mainDiv") // // on remet la bonne classe pour être sûr de savoir combien de zone on gère et gérer les affichages conditionnels dans le html
        $("#affichage").append('<div class="nbDiv' + nbZones + ' mainDiv" id="affichage' + identifiantZone + '" ondrop="getDropFiles(event)" ondragover="allowDrop(event)"><div class="oneCardContainer"><div class="dropZone2" id="dropImages' + identifiantZone + '"><p>' + erreurs["1"][langue] + ',<br> ' + erreurs["2"][langue] + ',<br> ' + erreurs["3"][langue] + '</p><p>(.xlsx, .xls, .csv, .numbers, .ods) ' + erreurs["5"][langue] + ' (.jpg, .png, .gif, .webp)</p></div><p>' + erreurs["5"][langue] + '</p><div class="folderSelector" id="folderSelector' + identifiantZone + '"><input type="file" webkitdirectory directory multiple style="display: none;"id="folderChosen' + identifiantZone + '" class="filepicker" onchange="getFilesOrFolders(event)"><label for="folderChosen' + identifiantZone + '">' + erreurs["4"][langue] + '</label><input type="file" multiple style="display: none;" id="folderChosen2-' + identifiantZone + '" class="filepicker" onchange="getFilesOrFolders(event)"><label for="folderChosen2-' + identifiantZone + '">' + erreurs["6"][langue] + '</label></div></div><div class="affichageMessage" id="affichageMessage' + identifiantZone + '" style="display: none;"><p>' + erreurs["7"][langue] + '</p></div><div class="affichageDesCartes" id="affichageDesCartes' + identifiantZone + '" style="display: none;"></div><div class="affichageBtns" style="display: none;"><div id="top"><div class="cardsNumber" id="cardsNumber' + identifiantZone + '"><label for="cardsNumber' + identifiantZone + '">' + erreurs["8"][langue] + '<br>' + erreurs["9"][langue] + '</label><div><input type="number" value="3" min="1" max="24"></div></div><div id="play" onclick="clickOnPlay(event)"><i class="fa-solid fa-circle-play"></i></div><div id="oneMore" onclick="addOne(event)"><i class="fa-solid fa-circle-plus"></i></div><div id="zero' + identifiantZone + '" class="zero" onclick="erase(event)"><i class="fa-solid fa-eraser"></i></div><div class="backToChooser" onclick="backToChooser(event)"><i class="fa-regular fa-folder-open"></i></div><div id="repetition"><input type="checkbox" checked id="repet" name="repet" value="0"><label for="repet">' + erreurs["11"][langue] + '</label></div></div><div id="bottom"><label for="vol">' + erreurs["10"][langue] + ' : <span id="zoomValue' + identifiantZone + '" class="zoomValue">100%</span> </label><div class="zoom"><input type="range" id="vol' + identifiantZone + '" name="vol" min="20" max="200" value="100" oninput="zommOnCards(event.target)"></div></div></div><div id="delAddFolderChooser"><div class="addFolderChooser" id="addFolderChooser' + identifiantZone + '" title="' + erreurs["12"][langue] + '" onclick="ajouterZone(this)"><i class="fa-regular fa-square-plus"></i></div><div class="delFolderChooser" id="delFolderChooser' + identifiantZone + '" title="' + erreurs["13"][langue] + '" onclick="supprimerZone(this)"><i class="fa-regular fa-square-minus"></i></div></div><div class="listeAffichable" style="display:none"></div><div class="listeAffichableMots" style="display:none"></div><div class="nbTirages" style="display:none"></div></div>')
        // on ajoute un div dans l'affichage
    }
    remesurerToutesLesZones() // les zones existantes ont rétréci : leurs cartes doivent être recalculées
    actualisePile(pile) // on enregistre l'état dans l'historique (bouton retour arrière)
}
function supprimerZone(elt) { //pour supprimer une zone --> l'appel de la fonction se gère dans le html avec un event handler onclik sur .delFolderChooser, mais aussi dans la zone supllémentaire insérée ci-dessus, de la même manière
    synchroniserZones() // on repart de ce qui est réellement affiché
    if (nbZones > 1) { // on garde toujours au moins une zone
        nbZones -= 1
        $(elt).parents(".mainDiv").remove() // on supprime la zone ciblée
        $("#affichage>div").removeClass() // on enlève la classe préexistante sur tous les divs de l'affichage
        $("#affichage>div").addClass("nbDiv" + nbZones + " mainDiv") // on remet la bonne classe pour être sûr de savoir combien de zone on gère et gérer les affichages conditionnels dans le html
    }
    remesurerToutesLesZones() // les zones restantes se sont élargies : leurs cartes doivent être recalculées
    actualisePile(pile) // on enregistre l'état dans l'historique
}

// ============= CHEMIN DISQUE D'UN FICHIER ============= //
function cheminDeFichier(file) { // File.path disparaît à partir d'Electron 32, remplacé par webUtils.getPathForFile
    if (webUtils && webUtils.getPathForFile) {
        return webUtils.getPathForFile(file) // voie actuelle
    }
    return file.path // repli pour les anciennes versions d'Electron
}
// ============= GESTION DE LA ZONE DE DRAG AND DROP ============= //
// hors des zones de dépôt, on neutralise le comportement par défaut du navigateur
// (sinon lâcher un fichier sur la fenêtre l'ouvrirait à la place de l'appli)
window.addEventListener("dragover", (e) => {
    e.preventDefault();
});
window.addEventListener("drop", (e) => {
    e.preventDefault();
});
function lireEntrees(dirReader) { // readEntries ne renvoie que 100 entrées par appel : il faut rappeler jusqu'à la liste vide
    return new Promise((resolve, reject) => {
        var toutes = [] // toutes les entrées du dossier, accumulées lot par lot
        var lire = () => {
            dirReader.readEntries((entries) => {
                if (entries.length == 0) { // plus rien à lire : le dossier est entièrement parcouru
                    resolve(toutes)
                } else {
                    toutes = toutes.concat(entries)
                    lire() // on redemande le lot suivant
                }
            }, reject)
        }
        lire()
    })
}
function traverseFileTree(item, chemin, liste) { // on récupère récursivement les fichiers ; la promesse dit quand c'est fini
    if (item.isFile) { // fichier : on ajoute son chemin reconstitué à la liste
        return new Promise((resolve) => {
            item.file((file) => {
                liste.push(chemin + file.name)
                resolve()
            }, resolve) // en cas d'erreur de lecture, on continue sans bloquer
        })
    } else if (item.isDirectory) { // dossier : on descend d'un cran dans l'arborescence
        return lireEntrees(item.createReader()).then((entries) => {
            return Promise.all(entries.map((entry) => traverseFileTree(entry, chemin + item.name + "/", liste)))
        })
    }
    return Promise.resolve() // ni fichier ni dossier (lien, élément inconnu)
}
function getDropFiles(event) { // on récupère les données du drop
    event.preventDefault(); // on empêche le navigateur d'ouvrir le fichier lâché
    var liste = [] // tous les chemins trouvés dans ce qui a été lâché
    $(event.target).closest(".mainDiv").children(".listeAffichable").html("") // on vide le div de secours des données
    var items = event.dataTransfer.items; // permet de descendre dans les dossiers
    var premier = event.dataTransfer.files[0] // seul un File donne le chemin disque complet
    var cheminPremier = premier ? cheminDeFichier(premier) : ""
    if (!cheminPremier) { // fichiers sans chemin disque : OneDrive à la demande, pièces jointes, archives…
        swal(erreurs["erTitre"][langue], erreurs["erSansChemin"][langue])
        return
    }
    var dossier = cheminPremier.split(/[\\/]/) // séparateur Windows ou macOS/Linux
    var goodPath = (dossier.slice(0, dossier.length - 1)).join("/") // dossier parent, préfixe des chemins reconstitués
    var parcours = [] // une promesse par élément lâché
    for (var i = 0; i < items.length; i++) {
        // webkitGetAsEntry is where the magic happens (à appeler avant tout await : les items ne survivent pas à l'événement)
        var item = items[i].webkitGetAsEntry(); // donne accès au contenu d'un dossier lâché
        if (item) {
            parcours.push(traverseFileTree(item, goodPath + "/", liste))
        }
    }
    Promise.all(parcours).then(() => { // on attend la fin du parcours, pas un délai fixe
        console.log(liste)
        if (liste.length == 0) { // dossier vide ou contenu illisible
            swal(erreurs["erTitre"][langue], erreurs["erRienLu"][langue])
            return
        }
        checkListFormats(liste, event.target) // tri images / listes de mots, puis chargement du paquet
    })
}
// ============= GESTION DU BOUTON TELECHARGER DOSSIER(S) ============= //
function getFilesOrFolders(e) { // sélection par le sélecteur de fichiers (input type=file)
    var listePaths = []
    for (let elt of e.target.files) {
        listePaths.push(cheminDeFichier(elt)) // on ne garde que les chemins disque
    }
    console.log(listePaths)
    return checkListFormats(listePaths, e.target)
}
// ============= BOUTON POUR REVENIR AU CHOIX DE DOSSIER ============= //
function backToChooser(e) { // on revient à l'écran d'import de la zone concernée
    $(e.target).parents(".mainDiv").children(".affichageMessage").css("display", "none") // message « prêt à tirer »
    $(e.target).parents(".mainDiv").children(".affichageBtns").css("display", "none") // barre de boutons de la zone
    $(e.target).parents(".mainDiv").children(".oneCardContainer").css("display", "flex") // zone de dépôt
    $(e.target).parents(".mainDiv").children(".affichageDesCartes").css("display", "none") // cartes tirées
    $(e.target).parents(".mainDiv").find(".filepicker").val("") // sinon on a un pb si on resélectopnne le même dossier vu que l'event est "onchange"
}
// ============= BOUTON TOUT MELANGER ============= //
function melanger() { // relance un tirage dans toutes les zones chargées
    for (let zone of $(".mainDiv")) {
        if ($(zone).children(".listeAffichable").html()) { // une zone sans paquet chargé n'a rien à tirer
            $(zone).find("#play").trigger("click") // on simule un clic sur le bouton de tirage de la zone
        }
    }
}

// ============= BOUTON EFFACER ============= //
function erase(e) { // vide les cartes de la zone sans toucher au paquet importé
    $(e.target).parents(".mainDiv").children(".affichageDesCartes").html("")
    actualisePile(pile) // état enregistré : le retour arrière peut annuler l'effacement
}
// ================ BOUTON PLAY ================ //
function clickOnPlay(event) { // tirage aléatoire dans la zone où l'on a cliqué
    var quelleZone = numeroDeZone(event.target) // on récupère le numéro de la zone dans laquelle on se trouve pour savoir où apporter des modifs
    // .listeAffichable contient [nombre, liste, type] ou [nombre, liste, "mots", listeDeMots]
    data = {
        "nombreDeCartes": parseInt($(event.target).parents(".mainDiv").children(".affichageBtns").children("#top").children(".cardsNumber").children("div").children("input").val()), // on envoie le nombre de cartes souhaité
        "listeImagesOuMots": JSON.parse($(event.target).parents(".mainDiv").children(".listeAffichable").html())[1], // on envoie la liste d'images ou de mots
        "listeMots": JSON.parse($(event.target).parents(".mainDiv").children(".listeAffichable").html())[3],
        "typeDeTirage": JSON.parse($(event.target).parents(".mainDiv").children(".listeAffichable").html())[2] // on précise s'il s'agit de mots ou d'images
    }
    console.log(data)
    ipcRenderer.invoke('tirage', data).then((data) => { // c'est main.js qui tire au sort
        console.log(data)
        if (data[1]["erreur"]) { // le tirage a échoué (paquet trop petit, épuisé, plusieurs listes…)
            console.log(data)
            console.log(erreurs[data[1]["erreur"]][langue])
            console.log(Array.isArray(erreurs[data[1]["erreur"]][langue]))
            // message en deux morceaux (« il ne reste que » + nombre + « cartes ») : c'est le cas du paquet épuisé
            if (erreurs[data[1]["erreur"]][langue].length > 1 && Array.isArray(erreurs[data[1]["erreur"]][langue])) {
                //console.log(data[1]["nb"])
                //console.log(erreurs[data[1]["erreur"]][langue][0] + data[1]["nb"] + erreurs[data[1]["erreur"]][langue][1])
                if (parseInt($(event.target).parents(".mainDiv").find(".nbTirages").html()) > 0) { // le paquet est épuisé : on le recharge tel quel
                    var zone = $(event.target).parents(".mainDiv")
                    // on repasse invisiblement par l'écran d'import (opacity 0) pour ne pas faire clignoter l'affichage
                    zone.children(".affichageMessage").css({ "opacity": 0, "display": "none" })
                    zone.children(".affichageBtns").css("display", "none")
                    zone.children(".oneCardContainer").css({ "display": "flex", "opacity": 0 })
                    zone.children(".affichageDesCartes").css("display", "none")
                    // on repart de la liste importée (le drag and drop ne remplit aucun input), sans reposer la question mots/images
                    checkListFormats(JSON.parse(divSource(zone).html() || "[]"), zone, zone.attr("data-type")).then(() => {
                        zone.find("#play").trigger("click") // paquet rechargé : on relance le tirage demandé
                        zone.children(".affichageMessage").css("opacity", 1) // on rétablit la visibilité
                        zone.children(".oneCardContainer").css("opacity", 1)
                    })
                } else {
                    console.log("TOTOTOTOTO")
                    alert(erreurs[data[1]["erreur"]][langue][0] + data[1]["nb"] + erreurs[data[1]["erreur"]][langue][1])
                }
            } else {
                //console.log(erreurs[data[1]["erreur"]][langue])
                alert(erreurs[data[1]["erreur"]][langue])
            }
        } else {
            //console.log("data", data)
            var zoneACacher = "#affichageMessage" + quelleZone // le message « prêt à tirer »
            var zoneAMontrer = "#affichageDesCartes" + quelleZone // la grille de cartes
            var listeMots = []
            if (data.length == 3) { // tirage de mots : main.js renvoie aussi la liste restante
                listeMots = data[2]
            }
            //console.log("listeMots", data[2])
            $(zoneACacher).css("display", "none")
            $(zoneAMontrer).css("display", "flex")
            afficherCartes(data[1][0], quelleZone, zoneAMontrer, data[0], listeMots) // création des cartes
            if ($(event.target).parents(".mainDiv").find("#repet")[0].checked == true) { // pour savoir s'il faut ou non répéter les cartes, sinon on les retire de la liste au fur et à mesure
                if (data[0] == "mots") { // mots : la liste est un tableau de tableaux ([mot] par ligne)
                    //console.log("mots")
                    //console.log(JSON.parse($(event.target).parents(".mainDiv").children(".listeAffichable").html())[3])
                    var nouvelleListe = JSON.parse($(event.target).parents(".mainDiv").children(".listeAffichable").html())[3]
                    var nl2 = []
                    for (let elt of nouvelleListe) {
                        nl2.push(elt[0]) // on aplatit en simple liste de mots pour pouvoir chercher dedans
                    }
                    for (let elt of data[1][0]) {
                        //console.log(nl2)
                        //console.log(elt[0])
                        //console.log(nl2.indexOf(elt[0]))
                        //console.log(nl2.includes(elt[0]))
                        nl2.splice(nl2.indexOf(elt[0]), 1) // on retire du paquet chaque mot qui vient de sortir
                    }
                    //console.log(nl2)
                    var nl3 = []
                    for (let elt of nl2) {
                        nl3.push([elt]) // on remet la forme d'origine ([mot] par ligne) avant réécriture
                    }
                    //console.log((nl3))
                    $(event.target).parents(".mainDiv").children(".listeAffichable").html(JSON.stringify([JSON.parse($(event.target).parents(".mainDiv").children(".listeAffichable").html())[0], JSON.parse($(event.target).parents(".mainDiv").children(".listeAffichable").html())[1], JSON.parse($(event.target).parents(".mainDiv").children(".listeAffichable").html())[2], nl3]))
                } else { // images : la liste est une simple liste de chemins
                    var nouvelleListe = JSON.parse($(event.target).parents(".mainDiv").children(".listeAffichable").html())[1]
                    for (let elt of data[1][0]) {
                        nouvelleListe.splice(nouvelleListe.indexOf(elt), 1) // on retire les images tirées
                    }
                    $(event.target).parents(".mainDiv").children(".listeAffichable").html(JSON.stringify([JSON.parse($(event.target).parents(".mainDiv").children(".listeAffichable").html())[0], nouvelleListe, JSON.parse($(event.target).parents(".mainDiv").children(".listeAffichable").html())[2]]))
                    //console.log(nouvelleListe)
                }

            }
            // compteur de tirages de la zone : sert à savoir si le paquet a déjà servi (donc s'il faut le recharger)
            $(event.target).parents(".mainDiv").find(".nbTirages").html(parseInt($(event.target).parents(".mainDiv").find(".nbTirages").html()) + 1)
        }
        /* $("#vol" + quelleZone).val(100)
        $("#zoomValue" + quelleZone).html("100%") */
    })
}
// ================ BOUTON ONE MORE ================ //
function addOne(event) { // ajoute une seule carte, sans retirer celles déjà affichées
    var quelleZone = numeroDeZone(event.target) // on récupère le numéro de la zone dans laquelle on se trouve pour savoir où apporter des modifs
    // [nombre, listeImages, "images"] ou [nombre, listeFichiers, "mots", listeMots]
    var donnees = JSON.parse($(event.target).parents(".mainDiv").children(".listeAffichable").html())
    var typeDeTirage = donnees[2] // on précise s'il s'agit de mots ou d'images
    var listeAffichee = [] // ce qui est déjà à l'écran, pour ne pas tirer un doublon
    for (let elt of $("#affichageDesCartes" + quelleZone).find(".img")) { // uniquement les cartes de la zone courante
        if (typeDeTirage == "mots") {
            listeAffichee.push($(elt).html()) // le mot affiché
        } else {
            listeAffichee.push($(elt).attr("src")) // le chemin de l'image affichée
        }
    }
    var listeImagesOuMots // on envoie la liste d'images ou de mots
    if (typeDeTirage == "mots") {
        listeImagesOuMots = donnees[3]
    } else {
        listeImagesOuMots = donnees[1]
    }
    data = {
        "listeImagesOuMots": listeImagesOuMots,
        "typeDeTirage": typeDeTirage,
        "listeAffichee": listeAffichee
    }
    //console.log(data)
    ipcRenderer.invoke('addOne', data).then((data) => { // main.js renvoie [carte, type]
        //console.log(data)
        if (data["erreur"] != undefined) { // plus aucune carte disponible hors de celles affichées
            alert(erreurs[data["erreur"]][langue])
        } else {
            var zoneAMontrer = "#affichageDesCartes" + quelleZone
            var modele = $(zoneAMontrer).children(".image").last() // la nouvelle carte reprend le gabarit courant : les cartes déjà posées ne bougent pas
            if (data[1] == "images") {
                $(zoneAMontrer).append('<div class="image"><div class="cardContainer"><img class="img" src="' + data[0] + '" onmousedown="clickOnImage(event)"></div></div>')
            } else {
                $(zoneAMontrer).append('<div class="image"><div class="cardContainer"><p class="img" onmousedown="clickOnImage(event)">' + data[0] + '</p></div></div>')
            }
            var nouvelleCarte = $(zoneAMontrer).children(".image").last() // la carte qu'on vient d'insérer
            if (draggableActive == true) { // si le mode « déplacer » est actif, elle doit l'être aussi
                rendreDeplacable(nouvelleCarte.children(".cardContainer"))
            }
            if (modele.length == 0) { // zone vide : aucun gabarit à reprendre, on mesure comme un tirage
                remesurerZone(zoneAMontrer).then(() => {
                    nouvelleCarte.find(".img").css("opacity", 1)
                    actualisePile(pile)
                })
                return
            }
            // hors du flux, dans le coin bas-droite : la grille existante n'est pas redistribuée, quitte à recouvrir une carte
            nouvelleCarte.addClass("carteAjoutee").css({ "width": modele.css("width"), "height": modele.css("height") })
            nouvelleCarte.find("img").css({ "maxHeight": "100%", "maxWidth": "100%" }) // imgSize() n'a pas vu cette image : sans bornes elle s'affiche à sa taille naturelle
            attendreImages(zoneAMontrer).then(() => { // seule la carte ajoutée est mesurée : les autres gardent leur taille et leur place
                poserTaillesEtPlaces(nouvelleCarte.find(".img")[0])
                if ($("#vol" + quelleZone).length > 0) {
                    zommOnCards($("#vol" + quelleZone)[0])
                }
                nouvelleCarte.find(".img").css("opacity", 1)
                actualisePile(pile)
            })
        }
    })
}
// ================ BOUTONS CHANGER ET SUPPRIMER LE FOND ================ //
function cheminVersUrl(chemin) { // un chemin disque n'est pas une URL : Windows, espaces et accents la cassent
    var normalise = chemin.split(path.sep).join("/")
    if (!normalise.startsWith("/")) { normalise = "/" + normalise } // "C:/Images/fond.jpg" -> "/C:/Images/fond.jpg"
    return "file://" + encodeURI(normalise).replace(/\(/g, "%28").replace(/\)/g, "%29")
}
function changerFond(event) { // image de fond derrière toutes les zones
    $("#affichage").css('background-image', 'url("' + cheminVersUrl(cheminDeFichier(event.target.files[0])) + '")')
}
function supprimerFond(event) { // retour au fond par défaut
    $("#affichage").css('background-image', "none")
}
// ================ LE BOUTON DE NUMEROTATION ================ //
$("#numerote").on("click", () => { // le bouton fait bascule : il numérote, puis efface les numéros
    if ($(".numero").length == 0) { // aucun numéro affiché : on les pose
        var i = 1
        for (let elt of $(".img")) {
            if (!$(elt).parent().hasClass("visible")) { // on saute les cartes effacées (rendues transparentes)
                $(elt).after('<div class="numero">' + i + '</div>')
                i++
                calculateNumPositions($(elt), $(elt).next()) // on place le numéro sous la carte
            }
        }
    } else {
        $(".numero").remove() // second clic : on enlève tous les numéros
    }
})
/* ==================== GESTION DES BOUTONS DE MENU SOUS WINDOWS ET LINUX ================== */
$("#close").on("click", () => {
    ipcRenderer.send('closeApp'); // on envoie au backend sur l'évènement de fermeture de fenêtre
});
$("#minimize").on("click", () => {
    ipcRenderer.send('minimizeApp'); // on envoie au backend sur l'évènement de réduction de fenêtre
});
$("#maxRes").on("click", () => {
    ipcRenderer.send('maximizeRestoreApp'); // on envoie au backend sur l'évènement d'agrandissement de fenêtre
});
function changeMaxResBtn(isMaximizedApp) { // on gère les deux options : déjà maximisé ou pas encore
    if (isMaximizedApp) { // le bouton doit alors proposer de restaurer la taille précédente
        $("#maxRes").attr('title', "Restaurer");
        $("#maxRes").removeClass("maximize");
        $("#maxRes").addClass("restore");
    } else {
        $("#maxRes").attr("title", "Agrandir");
        $("#maxRes").removeClass("restore");
        $("#maxRes").addClass("maximize");
    }
}
// c'est main.js qui prévient : la fenêtre peut aussi être maximisée sans passer par notre bouton
ipcRenderer.on("isMaximized", () => { changeMaxResBtn(true) });
ipcRenderer.on("isRestored", () => { changeMaxResBtn(false) });
// ============== BOUTONS INFOS ET NOTIFS ================ //

$("#aide").on("click", () => {
    ipcRenderer.send("help") // main.js ouvre la fenêtre de FAQ (une seule à la fois)
})
// état des ressources compatibles du site, tel que transmis par main.js
var infosRessources = { "url": "", "ressources": [], "nouveautes": [], "dejaOuvert": false, "desactive": false, "exergue": false }

ipcRenderer.on("ressources", (evt, arg) => { // envoyé par le main au démarrage, après lecture de la page des ressources compatibles
    infosRessources = arg
    $("#notifs").toggleClass("exergue", arg["exergue"] == true) // clignotement jaune s'il y a du neuf à signaler
    construireSurvolNotifs()
})

function ouvrirLien(url) {
    ipcRenderer.send("ouvrirLien", url) // main.js ouvre le navigateur du système, pas une fenêtre Electron
}

function carteRessource(ressource) { // titre + image cliquables vers la page produit
    var carte = $('<div class="ressource"></div>')
    if (ressource["image"] != "") { // certaines fiches produit n'ont pas de visuel
        carte.append($("<img>").attr("src", ressource["image"]).attr("alt", ressource["titre"]))
    }
    carte.append($("<span></span>").text(ressource["titre"])) // .text() : le titre vient du site, jamais interprété comme du HTML
    carte.on("click", () => { ouvrirLien(ressource["url"]) })
    return carte
}

function construireSurvolNotifs() { // une fois le popup déjà ouvert une fois, les nouveautés se consultent au survol
    $("#notifsSurvol").remove() // on repart d'un survol propre à chaque mise à jour
    // rien à montrer tant que le popup n'a jamais été ouvert, si l'utilisateur a refusé les alertes, ou sans nouveauté
    if (!infosRessources["dejaOuvert"] || infosRessources["desactive"] || infosRessources["nouveautes"].length == 0) { return }
    var survol = $('<div id="notifsSurvol"></div>')
    survol.append($("<p></p>").text(erreurs["notifsNouveautes"][langue]))
    for (let ressource of infosRessources["nouveautes"].slice(0, 3)) { // 3 au maximum, faute de place
        survol.append(carteRessource(ressource))
    }
    $("#notifs").append(survol)
}

$("#notifs").on("click", () => { // popup des ressources compatibles
    var contenu = $('<div id="popupRessources"></div>') // construit en DOM, puis passé à swal
    contenu.append($("<p></p>").text(erreurs["notifsIntro"][langue]))
    var lien = $('<p class="lienRessources"></p>').text(erreurs["notifsToutesLesRessources"][langue])
    lien.on("click", () => { ouvrirLien(infosRessources["url"]) }) // vers la page complète du site
    contenu.append(lien)
    var aMontrer = infosRessources["nouveautes"].length > 0 // faute de nouveauté, on montre le haut de la page des ressources
        ? { "titre": erreurs["notifsNouveautes"][langue], "ressources": infosRessources["nouveautes"] }
        : { "titre": erreurs["notifsALaUne"][langue], "ressources": infosRessources["ressources"] }
    contenu.append($("<h4></h4>").text(aMontrer["titre"])) // « Nouveautés » ou « À la une »
    if (aMontrer["ressources"].length == 0) { // page injoignable et aucun cache : on le dit
        contenu.append($("<p></p>").text(erreurs["notifsAucune"][langue]))
    } else {
        for (let ressource of aMontrer["ressources"].slice(0, 3)) { // 3 ressources au maximum
            contenu.append(carteRessource(ressource))
        }
    }
    var caseNotifs = $('<input type="checkbox" id="plusDeNotifs">').prop("checked", infosRessources["desactive"] == true) // décocher réactive les alertes
    contenu.append($('<label class="plusDeNotifs" for="plusDeNotifs"></label>').append(caseNotifs).append($("<span></span>").text(erreurs["notifsNePlusAvertir"][langue])))
    swal({ "title": erreurs["notifsTitre"][langue], "content": contenu[0] }).then(() => { // à la fermeture du popup
        ipcRenderer.send("ressourcesVues", caseNotifs.is(":checked")) // on retient ce qui a été vu pour ne signaler que les prochaines nouveautés
        infosRessources["desactive"] = caseNotifs.is(":checked") // choix de l'utilisateur sur les alertes
        infosRessources["dejaOuvert"] = true // désormais, le survol prend le relais du popup
        infosRessources["nouveautes"] = [] // tout ce qui était affiché vient d'être vu
        $("#notifs").removeClass("exergue")
        construireSurvolNotifs()
    })
})
// ============= Montrer quel bouton est sélectionné dans la barre du haut pour les actions au click ============= //
// les quatre modes d'action au clic sur une carte : déplacer, effacer, remplacer, surligner
$("#deplace, #efface, #change, #surligne").on("click", function () {
    $("#deplace, #efface, #change, #surligne").css("background-color", "unset") // on efface le background de focus
    $(this).css("background-color", "#1c63a0") // on le remet sur le bon élément (celui cliqué)
    selected = this.id // on change la varable globale "selected"
    //console.log(selected)
    prepareAction() // active ou désactive le déplacement selon le mode choisi
})
// ============= FONCTIONS ============= //

function appliquerListe(goodList, zone, type) { // on installe le paquet choisi dans la zone
    // goodList = [image?, listeDeMots?, listeImages, listeFichiersDeMots, motsLus]
    if (type == "mots") { // [nombre de mots, fichiers lus, type, liste des mots]
        zone.children(".listeAffichable").html(JSON.stringify([goodList[4].length, goodList[3], "mots", goodList[4]]))
    } else { // [nombre d'images, liste des images, type]
        zone.children(".listeAffichable").html(JSON.stringify([goodList[2].length, goodList[2], "images"]))
    }
    zone.attr("data-type", type) // pour recharger le même paquet sans reposer la question
    readyToPlay(zone) // on affiche les boutons de tirage de la zone
}
function manageListeUploaded(goodList, zone, typeImpose) { // zone : le .mainDiv concerné ; renvoie une promesse résolue quand le paquet est prêt
    console.log("goodlist", goodList)
    if (goodList[1] == false && goodList[0] == false) { // s'il n'y a ni listes de mots ni images
        return swal(erreurs["erTitre"][langue], erreurs["erDossierVide"][langue])
    } else if (goodList[1] == true && goodList[0] == true) { // s'il y a les deux
        if (typeImpose == "mots" || typeImpose == "images") { // rechargement d'un paquet : le choix est déjà fait
            appliquerListe(goodList, zone, typeImpose)
            return Promise.resolve()
        }
        // sinon on demande à l'utilisateur ce qu'il veut tirer
        return swal(erreurs["erTitre"][langue], erreurs["erMotsEtImages"][langue], {
            buttons: {
                catch1: {
                    text: erreurs["choixMots"][langue],
                    value: "catch1",
                },
                catch2: {
                    text: erreurs["choixImages"][langue],
                    value: "catch2",
                }
            },
        }).then((value) => { // réponse de l'utilisateur
            switch (value) {
                case "catch1":
                    appliquerListe(goodList, zone, "mots")
                    break;
                case "catch2":
                    appliquerListe(goodList, zone, "images")
                    break;
            }
        });
    } else if (goodList[1] == true && goodList[0] == false) { // si l'upload est bon du premier coup et ce sont des mots HOURRA !!!
        appliquerListe(goodList, zone, "mots")
        return Promise.resolve()
    } else {// si l'upload est bon du premier coup et ce sont des images HOURRA !!!
        appliquerListe(goodList, zone, "images")
        return Promise.resolve()
    }
}
function numeroDeZone(elt) { // le numéro de la zone (.mainDiv) qui contient l'élément
    return $(elt).parents(".mainDiv").attr("id").replace("affichage", "")
}
function divSource(zone) { // le div où l'on garde la liste importée, pour pouvoir recharger le même paquet
    if (zone.children(".listeSource").length == 0) { // il n'existe pas dans le HTML d'origine : on le crée
        zone.append('<div class="listeSource" style="display:none"></div>')
    }
    return zone.children(".listeSource")
}
function checkListFormats(liste, cible, typeImpose) { // cible : un élément de la zone (le drop peut viser un enfant sans id)
    var zone = $(cible).closest(".mainDiv")
    console.log(liste)
    divSource(zone).html(JSON.stringify(liste)) // on garde la liste brute pour un rechargement ultérieur
    var imagesList = [] // les fichiers image trouvés
    var wordsList = [] // les tableurs trouvés
    var image = false // vrai dès qu'au moins une image est trouvée
    var listeDeMots = false // vrai dès qu'au moins un tableur est trouvé
    for (const [index, element] of liste.entries()) {
        //console.log(index, element)
        // on trie sur l'extension du fichier (tout ce qui suit le dernier point)
        if (listOfValidExtensions.includes(element.slice(element.lastIndexOf("."), element.length))) {
            image = true
            imagesList.push(element)
        } else if (listOfValidListsOfWordsExtensions.includes(element.slice(element.lastIndexOf("."), element.length))) {
            listeDeMots = true
            wordsList.push(element)
        }
    }
    if (listeDeMots == true) { // seul le premier tableur trouvé est lu
        return ipcRenderer.invoke('getWords', [wordsList[0]]).then((listOfWords) => { // on attend la lecture du tableur, pas un délai fixe
            zone.children(".listeAffichableMots").html(JSON.stringify(listOfWords)) // sauvegarde des mots lus
            return manageListeUploaded([image, listeDeMots, imagesList, wordsList, listOfWords], zone, typeImpose)
        })
    } else { // que des images : rien à lire côté tableur
        return manageListeUploaded([image, listeDeMots, imagesList, wordsList, []], zone, typeImpose)
    }
}
// il faut un délai pour le traitement des images chargées
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function readyToPlay(zone) { // zone : le .mainDiv concerné
    zone.find(".nbTirages").html("0") // nouveau paquet : le compteur de tirages repart de zéro
    zone.children(".affichageMessage").css("display", "flex") // message « prêt à tirer »
    zone.children(".affichageBtns").css("display", "flex") // boutons de tirage, zoom, etc.
    zone.children(".oneCardContainer").css("display", "none") // on masque la zone d'import
}
function rendreDeplacable(selection) { // une carte reste dans sa zone, sinon elle passe sous les boutons de la zone voisine et devient inatteignable
    $(selection).each(function () { // chaque carte est confinée à sa propre zone, d'où la boucle
        var zone = $(this).closest(".mainDiv")
        $(this).draggable({ // jQuery UI
            containment: zone.length > 0 ? zone : "#affichage", // limite du déplacement
            scroll: false, // pas de défilement automatique en bord de zone
            cursor: "grabbing", // curseur « main fermée » pendant le déplacement
            start: function () { premierPlan(this) }, // la carte saisie passe au-dessus des autres
            stop: function () { actualisePile(pile) } // nouvelle position enregistrée dans l'historique
        })
    })
}
function premierPlan(carte) { // la carte manipulée passe au-dessus des autres
    $(".cardContainer").css("z-index", 1) // toutes les cartes reviennent au même plan
    $(carte).css("z-index", 10) // sauf celle-ci
}
function afficherCartes(liste, quelleZone, zoneAMontrer, type, listeMots) { // crée le HTML des cartes tirées
    //console.log(liste)
    var i = 0
    $(zoneAMontrer).html("") // on repart d'une zone vide : un tirage remplace le précédent
    //console.log(zoneAMontrer)
    while (i < liste.length) {
        if (type == "cartes") {
            $(zoneAMontrer).append('<div id="divImage' + quelleZone + '-' + i + '" class="image"><div class="cardContainer"><img class="img" src="' + liste[i] + '" onmousedown="clickOnImage(event)"></div></div>')
        } else if (type == "mots") {
            $(zoneAMontrer).append('<div id="divImage' + quelleZone + '-' + i + '" class="image"><div class="cardContainer"><p class="img" onmousedown="clickOnImage(event)">' + liste[i] + '</p></div></div>')
        }
        i++
    } // les cartes sont créées transparentes (CSS) et ne seront montrées qu'une fois mesurées
    /* if (listeMots.length >= 1) {
        var recup = JSON.parse($("#affichage" + quelleZone).children(".listeAffichable").html())
        recup.push(listeMots)
        $("#affichage" + quelleZone).children(".listeAffichable").html(JSON.stringify(recup))
    } */
    rendreDeplacable(".cardContainer") // les nouvelles cartes doivent être déplaçables
    remesurerZone(zoneAMontrer).then(() => { // tailles et positions de référence
        actualisePile(pile) // état enregistré dans l'historique
        $(".img").animate({ opacity: 1 }) // apparition en fondu une fois tout en place
    })

}
function calculerTaille(div) { // choisit le sens des zones puis applique les pourcentages
    //console.log(div)
    if ($($("#affichage>div")[0]).width() - $($("#affichage>div")[0]).height() >= 0) { // zone plus large que haute
        sensDAffichage = "paysage"
    } else {
        sensDAffichage = "portrait"
    }
    //console.log(sensDAffichage)
    imgSize($(div).children().length, div) // le nombre de cartes détermine leur taille
}
/* function recadrer() {
    $(".image").each(function (index) {
        if (this.clientHeight < $(this).children()[0].clientHeight) {
            $($(this).children()[0]).css({
                width: "fit-content",
                height: "100%",
                opacity: 1
            })
        } else {
            $($(this).children()[0]).css({
                opacity: 1
            })
        }
    })
} */
// num : nombre de cartes dans la zone ; div : sélecteur de la zone ; diviseur : facteur de réduction éventuel
function imgSize(num, div, diviseur = 1) {
    //console.log(diviseur)
    //console.log(num, div)
    var identifiant = div + " .image" // toutes les cartes de cette zone
    //console.log(identifiant)
    $(tailles[sensDAffichage]["lignes"]).each(function (index, value) { // hauteur des cartes
        //console.log("passe 1")
        if (value.includes(num)) { // ce sous-tableau couvre ce nombre de cartes
            //console.log("passe 2")
            //console.log(index, value)
            $(identifiant).css("height", "calc(" + tailles[sensDAffichage]["lignes"][index][tailles[sensDAffichage]["lignes"][index].length - 1] + " * " + diviseur + ")")
        }
    })
    $(tailles[sensDAffichage]["col"]).each(function (index, value) { // largeur des cartes
        //console.log("passe 3")
        if (value.includes(num)) {
            //console.log("passe 4")
            //console.log(index, value)
            $(identifiant).css("width", "calc(" + tailles[sensDAffichage]["col"][index][tailles[sensDAffichage]["col"][index].length - 1] + " * " + diviseur + ")")
        }
    })
    // dans les deux sens on borne l'image à sa carte : elle s'y inscrit sans la déborder ni la déformer
    if (sensDAffichage == "paysage") {
        //console.log("paysage")
        $("img").css({
            maxHeight: "100%",
            maxWidth: "100%"
        })
    } else {
        //console.log("portrait")
        $("img").css({
            maxHeight: "100%",
            maxWidth: "100%"
        })
    }
}
function prepareAction() { // pour désactiver/réactiver la possibilité de déplacer les images
    if (selected == "deplace" && draggableActive == false) { // si on clique sur déplace et que le déplacement a été désactivé
        rendreDeplacable(".cardContainer") // on le réactive
        draggableActive = true // on renvoie l'état réctivé à la variable globale
    } else if (selected == "efface") { // dans les autres modes, le clic ne doit pas déplacer la carte
        draggableTest()
    } else if (selected == "change") {
        draggableTest()
    } else if (selected == "surligne") {
        draggableTest()
    }
}
function draggableTest() { // pour tester si la fonction de déplacement est activée
    if (draggableActive == true) {
        $(".cardContainer.ui-draggable").draggable("destroy") // on désactive le déplacement uniquement là où il est initialisé, sinon jQuery UI lève une erreur
        draggableActive = false // on renvoie l'état désactivé à la variable globale
    }
}
function clickOnImage(event) { // pour gérer les clics sur images
    var image = event.target // la carte cliquée (img pour une image, p pour un mot)
    $("img").css("z-index", 1) // toutes les cartes reviennent au même plan
    $(".image>p").css("z-index", 1)
    $(image).css("z-index", 3) // sauf celle qu'on vient de cliquer
    if (selected == "efface") {
        $(image).parent().toggleClass("visible") // on ajoute ou enlève une classe qui joue sur l'opacité
        actualisePile(pile)
    } else if (selected == "change") {
        changeImage(image) // on tire une autre carte à la place de celle-ci
    } else if (selected == "surligne") {
        $(image).toggleClass("exergue") // on ajoute ou enlève une classe qui joue sur l'ombre autour de l'image
        actualisePile(pile)
    } else if (selected == "deplace") {
        premierPlan($(image).parent()) // la carte saisie passe au-dessus
        //console.log("deplace")
        for (let elt of $(".cardContainer")) { // on ajuste chaque conteneur à son contenu
            $(elt).css({
                "width": $($(elt).children()[0]).width(),
                "height": "fit-content"
            })
        }
    }
}
function changeImage(image) { // remplace une carte par une autre, jamais déjà affichée
    var images = [] // images déjà visibles dans la zone
    for (let elt of $(image).parents(".affichageDesCartes").find("img")) {
        images.push($(elt).attr('src'))
    }
    var mots = [] // mots déjà visibles dans la zone
    for (let elt of $(image).parents(".affichageDesCartes").find("p")) {
        mots.push($(elt).html())
    }
    var data = {
        "srcImagesAffichees": images,
        "listeMotsAffiches": mots,
        "listeImagesOuMots": JSON.parse($(image).parents(".mainDiv").children(".listeAffichable").html())[1], // on envoie la liste d'images ou de mots
        "typeDeTirage": JSON.parse($(image).parents(".mainDiv").children(".listeAffichable").html())[2] // on précise s'il s'agit de mots ou d'images
    }
    //console.log(JSON.parse($(image).parents(".mainDiv").children(".listeAffichable").html())[1])
    //console.log(data)
    ipcRenderer.invoke('changeImage', data).then((data) => { // main.js choisit la carte de remplacement
        //console.log(data)
        if (data["error"]) { // plus aucune carte disponible en dehors de celles affichées
            alert(erreurs[data["error"]][langue])
        } else {
            if (JSON.parse($(image).parents(".mainDiv").children(".listeAffichable").html())[2] == "images") {
                $(image).attr('src', data[0]) // on remplace l'image sur place
            }
            else {
                $(image).html(data[0]) // on remplace le mot sur place
            }
            calculerTaille("#" + $(image).parents(".affichageDesCartes").attr('id')) // la nouvelle image peut avoir d'autres proportions
            attendreImages($(image).parents(".affichageDesCartes")).then(() => {
                actualisePile(pile) // état enregistré une fois la nouvelle image chargée
            })
        }
    })
}
// previous : la carte ; elt : son numéro. On pose le numéro centré sous la carte.
function calculateNumPositions(previous, elt) {
    //console.log(previous, elt)
    if ($(previous).prop("nodeName") == "P") { // carte-mot : le numéro se pose juste sous le texte
        var rect = previous[0].getBoundingClientRect();
        //console.log(rect.top, rect.right, rect.bottom, rect.left);
        $(elt).offset({ "top": rect.bottom })
        $(elt).offset({ "left": (rect.left + (rect.right - rect.left) / 2) - 15 }) // centré (le numéro fait 30 px)
    } else { // carte-image : on remonte le numéro de 10 px pour qu'il chevauche le bas de l'image
        var rect = previous[0].getBoundingClientRect();
        //console.log(rect.top, rect.right, rect.bottom, rect.left);
        $(elt).offset({ "top": rect.bottom - 10 })
        $(elt).offset({ "left": (rect.left + (rect.right - rect.left) / 2) - 15 })
    }

}
function actualisePile(pile) { // enregistre l'état courant de l'affichage dans l'historique
    pile.push($("#affichage").html()) // on stocke le HTML complet des zones
    if (pile.length > 50) { pile.shift() } // on garde un historique borné
    //console.log("actualisée",pile)
}
function getBack(event) { // bouton retour arrière : on réinstalle l'état précédent
    //console.log("avantpop",pile)
    if (pile.length < 2) { return } // rien à annuler : sans cette garde on réinstallait un état indéfini et l'affichage se vidait
    var lastPile = pile[pile.length - 2] // l'avant-dernier état : le dernier est celui affiché
    $("#affichage").html(lastPile)
    pile.pop() // on retire l'état annulé
    synchroniserZones() // le HTML restauré peut contenir un autre nombre de zones
    if (draggableActive == true) { // le HTML restauré a perdu les gestionnaires jQuery UI
        rendreDeplacable(".cardContainer")
    }
    $(".img").animate({ opacity: 1 }) // les cartes restaurées peuvent être transparentes
    //console.log("aprèspop",pile)
}
function zommOnCards(target) { // target : le curseur de zoom de la zone (valeur en %)
    //console.log($(e.target).parents("#bottom").find(".zoomValue"))
    $(target).parents("#bottom").find(".zoomValue").html(target.value + "%") // on affiche le pourcentage
    var ratio = target.value / 100 // 100 % = taille de référence
    for (let elt of $(target).parents(".mainDiv").find(".cardContainer")) { // toutes les cartes de la zone
        //console.log(elt)
        // on part toujours de la taille de référence, sinon les arrondis s'accumulent d'un zoom à l'autre
        $(elt).width(elt.getAttribute("firstwidth") * ratio)
        $(elt).height(elt.getAttribute("firstheight") * ratio)
        //console.log($(elt).find("p").length)
        if ($(elt).find("p").length > 0) { // carte-mot : le texte doit grossir avec la carte
            //console.log("on a un mot")
            $(elt).find("p").css("font-size", parseInt($(elt).find("p")[0].getAttribute("firstfont")) * ratio + "px")
        }
    }
}
// mémorise la géométrie de référence d'une carte : c'est la base de calcul du zoom
function poserTaillesEtPlaces(img) {
    var rect = img.getBoundingClientRect() // taille et position réelles à l'écran
    //console.log(img)
    //console.log(rect)
    img.setAttribute("firstwidth", rect["width"])
    img.setAttribute("firstheight", rect["height"])
    img.setAttribute("firstleft", rect["left"])
    img.setAttribute("firsttop", rect["top"])
    img.setAttribute("firstfont", $(img).css("font-size")) // utile seulement pour les cartes-mots
    img.parentNode.setAttribute("firstwidth", rect["width"])
    img.parentNode.setAttribute("firstheight", rect["height"])
    img.parentNode.setAttribute("firstleft", rect["left"])
    img.parentNode.setAttribute("firsttop", rect["top"]) // mêmes repères sur le conteneur, que le zoom redimensionne
    $(img.parentNode).css({ // on fige le conteneur à la taille mesurée
        "width": rect["width"],
        "height": rect["height"]
    })
}

// resize pour empêcher de sortir de l'écran
function allowDrop(event) { // appelée par ondragover : sans cela le navigateur refuse le dépôt
    event.preventDefault();
}