// IMPORTS
const { ipcRenderer } = require('electron')
const path = require("path")
//const { type } = require('process')
const swal = require('sweetalert')
const fs = require('fs')
const { json } = require('stream/consumers')

// ============= VARIABLES GLOBALES ============= //
var erreurs = {}
var selected = "deplace" // pour connaitre constamment l'action au click sélectionnnée par l'utilisateur
var sensDAffichage = "portrait" // pour affiner au mieux l'affichage des tailles il faut connaitre le sens des zones d'affichage
var draggableActive = true // pour savoir si draggable est déjà désactivé sur les images
var pile = [] // pour créer un historique des modifications
var listOfValidExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".tiff", ".PNG", ".JPG", ".JPEG", ".WEBP", ".GIF", ".TIFF"] // on stocke les extensions valides pour l'affichage des images
var listOfValidListsOfWordsExtensions = [".numbers", ".xlsx", ".xsl", ".ods", ".csv"] // on stocke les extensions valides pour l'affichage de listes de mots
var nbZones = 1 // pour toujours savoir combien on a de zones d'affichage
var identifiantZone = 1 // pour incrémenter les zonnes et y envoyer les bonnes infos
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
var langue = document.documentElement.lang
//console.log(langue)

// ============= Différenciation de la barre du haut selon l'OS ============= //
ipcRenderer.on('OS', (evt, arg) => {
    if (arg == "darwin") {
        $("#titre").css("justify-content", "center");
        $("#showHideMenus").css("display", "none");
        $(".topBtn").css("display", "none");
        //$("#header").addClass("headerBackground");
    }
});
// ============= RÉCUPÉRATION DU DOSSIER UTILISATEUR ============= //
ipcRenderer.on('mainDir', (evt, arg) => {
    $($(".mainDir")[0]).attr('id', arg)
})
sleep(200).then(() => {
    erreurs = JSON.parse(fs.readFileSync(path.join($(".mainDir")[0].id, "erreurs.json"), encoding = 'utf-8'))
})
// ============= AFFICHAGE DU MENU SOUS WINDOWS ============= //
$("#showHideMenus").on("click", () => {
    ipcRenderer.send('fireMenu')
})
// ============= RENDRE LES MENUS RESIZABLES ============= //

$("#leftRightMoving").on("mousedown", (e) => {
    //On vérifie que le curseur est sur la bordure qui sert à déplacer
    if (Math.abs(e.offsetX - $(e.target).width()) <= 7) {
        document.addEventListener("mousemove", resizeGauche, false);
    }
})
$("#topBottomMoving").on("mousedown", (e) => {
    //On vérifie que le curseur est sur la bordure qui sert à déplacer
    if (Math.abs(e.offsetY - $(e.target).height()) <= 7) {
        document.addEventListener("mousemove", resizeHaut, false); // on ajoute un événement au déplacement de la souris : un resize des deux divs concernés
    }
})
function resize(e, minSize, maxSize, direction) {
    if (direction == "x") {
        if (minSize < e.clientX && e.clientX < maxSize) {
            $("#folderChooser").css("width", e.clientX)
            $("#cardsContainer").css("width", "calc(100% - " + e.clientX + "px")
        }
    } else if (direction == "y") {
        if (minSize < e.clientY && e.clientY < maxSize) {
            $("#actionsMenu").css("height", e.clientY)
            $("#mainContent").css("height", "calc(100% - " + e.clientY + "px")
        }
    }
}
$(document).on("mouseup", () => { // on supprime l'évènement quand le click se relâche
    document.removeEventListener("mousemove", resizeGauche, false)
    document.removeEventListener("mousemove", resizeHaut, false)
})
//fonctions intermédiaires pour passer les paramètres en dehors de l'event
function resizeGauche(e) { resize(e, 108, 320, "x") }
function resizeHaut(e) { resize(e, 45, 150, "y") }

// ============= ON GERE L'AJOUT OU LA SUPPRESSION DE ZONES D'AFFICHAGE DANS LA PARTIE PRINCIPALE ============= //

function ajouterZone(elt) { //pour ajouter une zone --> l'appel de la fonction se gère dans le html avec un event handler onclik sur .addFolderChooser, mais aussi dans la zone supllémentaire insérée ci-dessous, de la même manière
    if (nbZones < 5) {
        nbZones += 1
        identifiantZone += 1
        $("#affichage>div").removeClass() // on enlève la classe préexistante sur tous les divs de l'affichage
        $("#affichage>div").addClass("nbDiv" + nbZones + " mainDiv") // // on remet la bonne classe pour être sûr de savoir combien de zone on gère et gérer les affichages conditionnels dans le html
        $("#affichage").append('<div class="nbDiv' + nbZones + ' mainDiv" id="affichage' + identifiantZone + '" ondrop="getDropFiles(event)"><div class="oneCardContainer"><div class="dropZone2" id="dropImages' + identifiantZone + '"><p>' + erreurs["1"][langue] + ',<br> ' + erreurs["2"][langue] + ',<br> ' + erreurs["3"][langue] + '</p><p>(.xlsx, .xls, .csv, .numbers, .ods) ' + erreurs["5"][langue] + ' (.jpg, .png, .gif, .webp)</p></div><p>' + erreurs["5"][langue] + '</p><div class="folderSelector" id="folderSelector' + identifiantZone + '"><input type="file" webkitdirectory directory multiple style="display: none;"id="folderChosen' + identifiantZone + '" class="filepicker" onchange="getFilesOrFolders(event)"><label for="folderChosen' + identifiantZone + '">' + erreurs["4"][langue] + '</label><input type="file" multiple style="display: none;" id="folderChosen2-' + identifiantZone + '" class="filepicker" onchange="getFilesOrFolders(event)"><label for="folderChosen2-' + identifiantZone + '">' + erreurs["6"][langue] + '</label></div></div><div class="affichageMessage" id="affichageMessage' + identifiantZone + '" style="display: none;"><p>' + erreurs["7"][langue] + '</p></div><div class="affichageDesCartes" id="affichageDesCartes' + identifiantZone + '" style="display: none;"></div><div class="affichageBtns" style="display: none;"><div id="top"><div class="cardsNumber" id="cardsNumber' + identifiantZone + '"><label for="cardsNumber' + identifiantZone + '">' + erreurs["8"][langue] + '<br>' + erreurs["9"][langue] + '</label><div><input type="number" value="3" min="1" max="24"></div></div><div id="play" onclick="clickOnPlay(event)"><i class="fa-solid fa-circle-play"></i></div><div id="oneMore" onclick="addOne(event)"><i class="fa-solid fa-circle-plus"></i></div><div id="zero' + identifiantZone + '" class="zero" onclick="erase(event)"><i class="fa-solid fa-eraser"></i></div><div class="backToChooser" onclick="backToChooser(event)"><i class="fa-regular fa-folder-open"></i></div><div id="repetition"><input type="checkbox" checked id="repet" name="repet" value="0"><label for="repet">Ne pas répéter les cartes</label></label></div></div><div id="bottom"><label for="vol">' + erreurs["10"][langue] + ' : <span id="zoomValue' + identifiantZone + '" class="zoomValue">100%</span> </label><div class="zoom"><input type="range" id="vol' + identifiantZone + '" name="vol" min="20" max="200" value="100" oninput="zommOnCards(event.target)"></div></div></div><div id="delAddFolderChooser"><div class="addFolderChooser" id="addFolderChooser' + identifiantZone + '" title="ajouter un dossier" onclick="ajouterZone(this)"><i class="fa-regular fa-square-plus"></i></div><div class="delFolderChooser" id="delFolderChooser' + identifiantZone + '" title="supprimer un dossier" onclick="supprimerZone(this)"><i class="fa-regular fa-square-minus"></i></div></div><div class="listeAffichable" style="display:none"></div><div class="listeAffichableMots" style="display:none"></div><div class="nbTirages" style="display:none"></div></div>')
        // on ajoute un div dans l'affichage
    }
    for (let elt of $(".affichageDesCartes")) {
        calculerTaille("#" + elt.id)
    }
}
function supprimerZone(elt) { //pour supprimer une zone --> l'appel de la fonction se gère dans le html avec un event handler onclik sur .delFolderChooser, mais aussi dans la zone supllémentaire insérée ci-dessus, de la même manière
    if (nbZones > 1) {
        nbZones -= 1
        $(elt).parents(".mainDiv").remove() // on supprime la zone ciblée
        $("#affichage>div").removeClass() // on enlève la classe préexistante sur tous les divs de l'affichage
        $("#affichage>div").addClass("nbDiv" + nbZones + " mainDiv") // on remet la bonne classe pour être sûr de savoir combien de zone on gère et gérer les affichages conditionnels dans le html
    }
    for (let elt of $(".affichageDesCartes")) {
        calculerTaille("#" + elt.id)
    }
}

// ============= GESTION DE LA ZONE DE DRAG AND DROP ============= //
window.addEventListener("dragover", (e) => {
    e.preventDefault();
});
window.addEventListener("drop", (e) => {
    e.preventDefault();
});
function lireEntrees(dirReader) { // readEntries ne renvoie que 100 entrées par appel : il faut rappeler jusqu'à la liste vide
    return new Promise((resolve, reject) => {
        var toutes = []
        var lire = () => {
            dirReader.readEntries((entries) => {
                if (entries.length == 0) {
                    resolve(toutes)
                } else {
                    toutes = toutes.concat(entries)
                    lire()
                }
            }, reject)
        }
        lire()
    })
}
function traverseFileTree(item, chemin, liste) { // on récupère récursivement les fichiers ; la promesse dit quand c'est fini
    if (item.isFile) {
        return new Promise((resolve) => {
            item.file((file) => {
                liste.push(chemin + file.name)
                resolve()
            }, resolve)
        })
    } else if (item.isDirectory) {
        return lireEntrees(item.createReader()).then((entries) => {
            return Promise.all(entries.map((entry) => traverseFileTree(entry, chemin + item.name + "/", liste)))
        })
    }
    return Promise.resolve()
}
function getDropFiles(event) { // on récupère les données du drop
    event.preventDefault();
    var liste = []
    $(event.target).closest(".mainDiv").children(".listeAffichable").html("") // on vide le div de secours des données
    var items = event.dataTransfer.items;
    var premier = event.dataTransfer.files[0]
    if (!premier || !premier.path) { // fichiers sans chemin disque : OneDrive à la demande, pièces jointes, archives…
        swal("Il y a un problème", "Ces fichiers n'ont pas de chemin sur le disque. Copiez-les dans un dossier de l'ordinateur avant de les glisser ici.")
        return
    }
    var dossier = premier.path.split(/[\\/]/) // séparateur Windows ou macOS/Linux
    var goodPath = (dossier.slice(0, dossier.length - 1)).join("/")
    var parcours = []
    for (var i = 0; i < items.length; i++) {
        // webkitGetAsEntry is where the magic happens (à appeler avant tout await : les items ne survivent pas à l'événement)
        var item = items[i].webkitGetAsEntry();
        if (item) {
            parcours.push(traverseFileTree(item, goodPath + "/", liste))
        }
    }
    Promise.all(parcours).then(() => { // on attend la fin du parcours, pas un délai fixe
        console.log(liste)
        if (liste.length == 0) {
            swal("Il y a un problème", "Aucun fichier n'a pu être lu dans ce qui a été déposé")
            return
        }
        checkListFormats(liste, event.target)
    })
}
// ============= GESTION DU BOUTON TELECHARGER DOSSIER(S) ============= //
function getFilesOrFolders(e) {
    var listePaths = []
    for (let elt of e.target.files) {
        listePaths.push(elt.path)
    }
    console.log(listePaths)
    return checkListFormats(listePaths, e.target)
}
// ============= BOUTON POUR REVENIR AU CHOIX DE DOSSIER ============= //
function backToChooser(e) {
    $(e.target).parents(".mainDiv").children(".affichageMessage").css("display", "none")
    $(e.target).parents(".mainDiv").children(".affichageBtns").css("display", "none")
    $(e.target).parents(".mainDiv").children(".oneCardContainer").css("display", "flex")
    $(e.target).parents(".mainDiv").children(".affichageDesCartes").css("display", "none")
    $(e.target).parents(".mainDiv").find(".filepicker").val("") // sinon on a un pb si on resélectopnne le même dossier vu que l'event est "onchange"
}
// ============= BOUTON TOUT MELANGER ============= //
function melanger() {
    console.log("melanger")
    for (let elt of $(".mainDiv").find("#play")) {
        console.log(elt)
        $(elt).trigger("click")
    }
}

// ============= BOUTON EFFACER ============= //
function erase(e) {
    $(e.target).parents(".mainDiv").children(".affichageDesCartes").html("")
}
// ================ BOUTON PLAY ================ //
function clickOnPlay(event) {
    var quelleZone = numeroDeZone(event.target) // on récupère le numéro de la zone dans laquelle on se trouve pour savoir où apporter des modifs
    data = {
        "nombreDeCartes": parseInt($(event.target).parents(".mainDiv").children(".affichageBtns").children("#top").children(".cardsNumber").children("div").children("input").val()), // on envoie le nombre de cartes souhaité
        "listeImagesOuMots": JSON.parse($(event.target).parents(".mainDiv").children(".listeAffichable").html())[1], // on envoie la liste d'images ou de mots
        "listeMots": JSON.parse($(event.target).parents(".mainDiv").children(".listeAffichable").html())[3],
        "typeDeTirage": JSON.parse($(event.target).parents(".mainDiv").children(".listeAffichable").html())[2] // on précise s'il s'agit de mots ou d'images
    }
    console.log(data)
    ipcRenderer.invoke('tirage', data).then((data) => {
        console.log(data)
        if (data[1]["erreur"]) {
            console.log(data)
            console.log(erreurs[data[1]["erreur"]][langue])
            console.log(Array.isArray(erreurs[data[1]["erreur"]][langue]))
            if (erreurs[data[1]["erreur"]][langue].length > 1 && Array.isArray(erreurs[data[1]["erreur"]][langue])) {
                //console.log(data[1]["nb"])
                //console.log(erreurs[data[1]["erreur"]][langue][0] + data[1]["nb"] + erreurs[data[1]["erreur"]][langue][1])
                if (parseInt($(event.target).parents(".mainDiv").find(".nbTirages").html()) > 0) { // le paquet est épuisé : on le recharge tel quel
                    var zone = $(event.target).parents(".mainDiv")
                    zone.children(".affichageMessage").css({ "opacity": 0, "display": "none" })
                    zone.children(".affichageBtns").css("display", "none")
                    zone.children(".oneCardContainer").css({ "display": "flex", "opacity": 0 })
                    zone.children(".affichageDesCartes").css("display", "none")
                    // on repart de la liste importée (le drag and drop ne remplit aucun input), sans reposer la question mots/images
                    checkListFormats(JSON.parse(divSource(zone).html() || "[]"), zone, zone.attr("data-type")).then(() => {
                        zone.find("#play").trigger("click")
                        zone.children(".affichageMessage").css("opacity", 1)
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
            var zoneACacher = "#affichageMessage" + quelleZone
            var zoneAMontrer = "#affichageDesCartes" + quelleZone
            var listeMots = []
            if (data.length == 3) {
                listeMots = data[2]
            }
            //console.log("listeMots", data[2])
            $(zoneACacher).css("display", "none")
            $(zoneAMontrer).css("display", "flex")
            afficherCartes(data[1][0], quelleZone, zoneAMontrer, data[0], listeMots)
            if ($(event.target).parents(".mainDiv").find("#repet")[0].checked == true) { // pour savoir s'il faut ou non répéter les cartes, sinon on les retire de la liste au fur et à mesure
                if (data[0] == "mots") {
                    //console.log("mots")
                    //console.log(JSON.parse($(event.target).parents(".mainDiv").children(".listeAffichable").html())[3])
                    var nouvelleListe = JSON.parse($(event.target).parents(".mainDiv").children(".listeAffichable").html())[3]
                    var nl2 = []
                    for (let elt of nouvelleListe) {
                        nl2.push(elt[0])
                    }
                    for (let elt of data[1][0]) {
                        //console.log(nl2)
                        //console.log(elt[0])
                        //console.log(nl2.indexOf(elt[0]))
                        //console.log(nl2.includes(elt[0]))
                        nl2.splice(nl2.indexOf(elt[0]), 1)
                    }
                    //console.log(nl2)
                    var nl3 = []
                    for (let elt of nl2) {
                        nl3.push([elt])
                    }
                    //console.log((nl3))
                    $(event.target).parents(".mainDiv").children(".listeAffichable").html(JSON.stringify([JSON.parse($(event.target).parents(".mainDiv").children(".listeAffichable").html())[0], JSON.parse($(event.target).parents(".mainDiv").children(".listeAffichable").html())[1], JSON.parse($(event.target).parents(".mainDiv").children(".listeAffichable").html())[2], nl3]))
                } else {
                    var nouvelleListe = JSON.parse($(event.target).parents(".mainDiv").children(".listeAffichable").html())[1]
                    for (let elt of data[1][0]) {
                        nouvelleListe.splice(nouvelleListe.indexOf(elt), 1)
                    }
                    $(event.target).parents(".mainDiv").children(".listeAffichable").html(JSON.stringify([JSON.parse($(event.target).parents(".mainDiv").children(".listeAffichable").html())[0], nouvelleListe, JSON.parse($(event.target).parents(".mainDiv").children(".listeAffichable").html())[2]]))
                    //console.log(nouvelleListe)
                }

            }
            $(event.target).parents(".mainDiv").find(".nbTirages").html(parseInt($(event.target).parents(".mainDiv").find(".nbTirages").html()) + 1)
        }
        /* $("#vol" + quelleZone).val(100)
        $("#zoomValue" + quelleZone).html("100%") */
    })
}
// ================ BOUTON ONE MORE ================ //
function addOne(event) {
    var quelleZone = numeroDeZone(event.target) // on récupère le numéro de la zone dans laquelle on se trouve pour savoir où apporter des modifs
    // [nombre, listeImages, "images"] ou [nombre, listeFichiers, "mots", listeMots]
    var donnees = JSON.parse($(event.target).parents(".mainDiv").children(".listeAffichable").html())
    var typeDeTirage = donnees[2] // on précise s'il s'agit de mots ou d'images
    var listeAffichee = []
    for (let elt of $("#affichageDesCartes" + quelleZone).find(".img")) { // uniquement les cartes de la zone courante
        if (typeDeTirage == "mots") {
            listeAffichee.push($(elt).html())
        } else {
            listeAffichee.push($(elt).attr("src"))
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
    ipcRenderer.invoke('addOne', data).then((data) => {
        //console.log(data)
        if (data["erreur"] != undefined) {
            alert(erreurs[data["erreur"]][langue])
        } else {
            if (data[1] == "images") {
                var newImage = document.createElement("div")
                newImage.classList.add("image")
                var num = $(".image").length + 1
                //console.log(num)
                newImage.id = "addedPos" + num
                var modele = $("#affichageDesCartes" + quelleZone).children(":first-child")
                //console.log(modele.height())
                $(newImage).css({
                    "height": modele.height(),
                    "width": modele.width(),
                    "position": "absolute",
                    "left": "50%",
                    "top": "50%",
                    "translate": "-50% -50%",
                    "z-index": 1
                })
                $(newImage).html('<div class="cardContainer ui-draggable ui-draggable-handle" style="position: relative; width: 100%; height: 100%;"><img class="img" src="' + data[0] + '" onmousedown="clickOnImage(event)" style="max-height: 100%; max-width: 100%; opacity: 1;"></div>')
                var name = "#" + newImage.id + " .cardContainer"
                $("#affichageDesCartes" + quelleZone).append(newImage)
                //console.log($(newImage).prev())
                $(name).draggable({
                    containment: "#affichage",
                    scroll: false,
                    cursor: "grabbing",
                })
                $(newImage).on("mouseup", function () {
                    $(this).css("z-index", "unset")
                        (this).children(".img").css("z-index", 3)

                })
                setTimeout(() => {  // obligé sinon l'info part avant que les images soient affichées et ne les prend pas en compte
                    poserTaillesEtPlaces($(name).children()[0])
                }, 200);
            } else {
                var newImage = document.createElement("div")
                newImage.classList.add("image")
                var num = $(".image").length + 1
                //console.log(num)
                newImage.id = "addedPos" + num
                var modele = $("#affichageDesCartes" + quelleZone).children(":first-child")
                //console.log(modele.height())
                $(newImage).css({
                    "height": modele.height(),
                    "width": modele.width(),
                    "position": "absolute",
                    "z-index": 0,
                    "left": "50%",
                    "top": "50%",
                    "translate": "-50% -50%"
                })
                $(newImage).html('<div class="cardContainer ui-draggable ui-draggable-handle" style="position: relative; width: 100%; height: 100%;"><p class="img" onmousedown="clickOnImage(event)" style="max-height: 100%; max-width: 100%; opacity: 1;">' + data[0] + '</p></div>')
                var name = "#" + newImage.id + " .cardContainer"
                $("#affichageDesCartes" + quelleZone).append(newImage)
                //console.log($(newImage).prev())
                $(name).draggable({
                    containment: "#affichage",
                    scroll: false,
                    cursor: "grabbing",
                })
                setTimeout(() => {  // obligé sinon l'info part avant que les images soient affichées et ne les prend pas en compte
                    poserTaillesEtPlaces($(name).children()[0])
                }, 200);
            }
            $("#affichageDesCartes" + quelleZone + " .cardContainer").css({
                width: "100%",
                height: "100%"
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
function changerFond(event) {
    $("#affichage").css('background-image', 'url("' + cheminVersUrl(event.target.files[0].path) + '")')
}
function supprimerFond(event) {
    $("#affichage").css('background-image', "none")
}
// ================ LE BOUTON DE NUMEROTATION ================ //
$("#numerote").on("click", () => {
    if ($(".numero").length == 0) {
        var i = 1
        for (let elt of $(".img")) {
            if (!$(elt).parent().hasClass("visible")) {
                $(elt).after('<div class="numero">' + i + '</div>')
                i++
                calculateNumPositions($(elt), $(elt).next())
            }
        }
    } else {
        $(".numero").remove()
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
    if (isMaximizedApp) {
        $("#maxRes").attr('title', "Restaurer");
        $("#maxRes").removeClass("maximize");
        $("#maxRes").addClass("restore");
    } else {
        $("#maxRes").attr("title", "Agrandir");
        $("#maxRes").removeClass("restore");
        $("#maxRes").addClass("maximize");
    }
}
ipcRenderer.on("isMaximized", () => { changeMaxResBtn(true) });
ipcRenderer.on("isRestored", () => { changeMaxResBtn(false) });
// ============== BOUTONS INFOS ET NOTIFS ================ //

$("#aide").on("click", () => {
    ipcRenderer.send("help")
})
$("#notifs").on("click", () => {
    alert("Lien à venir vers les nouvelles ressources")
})
// ============= Montrer quel bouton est sélectionné dans la barre du haut pour les actions au click ============= //
$("#deplace, #efface, #change, #surligne").on("click", function () {
    $("#deplace, #efface, #change, #surligne").css("background-color", "unset") // on efface le background de focus
    $(this).css("background-color", "#1c63a0") // on le remet sur le bon élément (celui cliqué)
    selected = this.id // on change la varable globale "selected"
    //console.log(selected)
    prepareAction()
})
// ============= FONCTIONS ============= //

function appliquerListe(goodList, zone, type) { // on installe le paquet choisi dans la zone
    if (type == "mots") {
        zone.children(".listeAffichable").html(JSON.stringify([goodList[4].length, goodList[3], "mots", goodList[4]]))
    } else {
        zone.children(".listeAffichable").html(JSON.stringify([goodList[2].length, goodList[2], "images"]))
    }
    zone.attr("data-type", type) // pour recharger le même paquet sans reposer la question
    readyToPlay(zone)
}
function manageListeUploaded(goodList, zone, typeImpose) { // zone : le .mainDiv concerné ; renvoie une promesse résolue quand le paquet est prêt
    console.log("goodlist", goodList)
    if (goodList[1] == false && goodList[0] == false) { // s'il n'y a ni listes de mots ni images
        return swal("Il y a un problème", "Il n'y pas de liste de mots ni d'images dans ce dossier")
    } else if (goodList[1] == true && goodList[0] == true) { // s'il y a les deux
        if (typeImpose == "mots" || typeImpose == "images") {
            appliquerListe(goodList, zone, typeImpose)
            return Promise.resolve()
        }
        return swal("Il y a un problème", "Vous avez importé à la fois des listes de mots et des images", {
            buttons: {
                catch1: {
                    text: "Je choisis les mots",
                    value: "catch1",
                },
                catch2: {
                    text: "Je choisis les images",
                    value: "catch2",
                }
            },
        }).then((value) => {
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
    if (zone.children(".listeSource").length == 0) {
        zone.append('<div class="listeSource" style="display:none"></div>')
    }
    return zone.children(".listeSource")
}
function checkListFormats(liste, cible, typeImpose) { // cible : un élément de la zone (le drop peut viser un enfant sans id)
    var zone = $(cible).closest(".mainDiv")
    console.log(liste)
    divSource(zone).html(JSON.stringify(liste))
    var imagesList = []
    var wordsList = []
    var image = false
    var listeDeMots = false
    for (const [index, element] of liste.entries()) {
        //console.log(index, element)
        if (listOfValidExtensions.includes(element.slice(element.lastIndexOf("."), element.length))) {
            image = true
            imagesList.push(element)
        } else if (listOfValidListsOfWordsExtensions.includes(element.slice(element.lastIndexOf("."), element.length))) {
            listeDeMots = true
            wordsList.push(element)
        }
    }
    if (listeDeMots == true) {
        return ipcRenderer.invoke('getWords', [wordsList[0]]).then((listOfWords) => { // on attend la lecture du tableur, pas un délai fixe
            zone.children(".listeAffichableMots").html(JSON.stringify(listOfWords))
            return manageListeUploaded([image, listeDeMots, imagesList, wordsList, listOfWords], zone, typeImpose)
        })
    } else {
        return manageListeUploaded([image, listeDeMots, imagesList, wordsList, []], zone, typeImpose)
    }
}
// il faut un délai pour le traitement des images chargées
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function readyToPlay(zone) { // zone : le .mainDiv concerné
    zone.find(".nbTirages").html("0")
    zone.children(".affichageMessage").css("display", "flex")
    zone.children(".affichageBtns").css("display", "flex")
    zone.children(".oneCardContainer").css("display", "none")
}
function afficherCartes(liste, quelleZone, zoneAMontrer, type, listeMots) {
    //console.log(liste)
    i = 0
    $(zoneAMontrer).html("")
    //console.log(zoneAMontrer)
    while (i < liste.length) {
        if (type == "cartes") {
            $(zoneAMontrer).append('<div id="divImage' + quelleZone + '" class="image"><div class="cardContainer"><img class="img" src="' + liste[i] + '" onmousedown="clickOnImage(event)"></div></div>')
        } else if (type == "mots") {
            $(zoneAMontrer).append('<div id="divImage' + quelleZone + '" class="image"><div class="cardContainer"><p class="img" onmousedown="clickOnImage(event)">' + liste[i] + '</p></div></div>')
        }
        i++
    }
    /* if (listeMots.length >= 1) {
        var recup = JSON.parse($("#affichage" + quelleZone).children(".listeAffichable").html())
        recup.push(listeMots)
        $("#affichage" + quelleZone).children(".listeAffichable").html(JSON.stringify(recup))
    } */
    $(".cardContainer").draggable({
        containment: "#affichage",
        scroll: false,
        cursor: "grabbing",
    })
    calculerTaille(zoneAMontrer)
    setTimeout(() => {  // obligé sinon l'info part avant que les images soient affichées et ne les prend pas en compte
        actualisePile(pile)
        for (let img of $("#affichage" + quelleZone).find(".img")) {
            poserTaillesEtPlaces(img)
        }
        //console.log(pile)
    }, 200);
    setTimeout(() => {  // obligé sinon l'info part avant que les images soient affichées et ne les prend pas en compte
        zommOnCards($("#vol" + quelleZone)[0])
        $(".img").animate({ opacity: 1 })
    }, 300);

}
function calculerTaille(div) {
    //console.log(div)
    if ($($("#affichage>div")[0]).width() - $($("#affichage>div")[0]).height() >= 0) {
        sensDAffichage = "paysage"
    } else {
        sensDAffichage = "portrait"
    }
    //console.log(sensDAffichage)
    imgSize($(div).children().length, div)
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
function imgSize(num, div, diviseur = 1) {
    //console.log(diviseur)
    //console.log(num, div)
    var identifiant = div + " .image"
    //console.log(identifiant)
    $(tailles[sensDAffichage]["lignes"]).each(function (index, value) {
        //console.log("passe 1")
        if (value.includes(num)) {
            //console.log("passe 2")
            //console.log(index, value)
            $(identifiant).css("height", "calc(" + tailles[sensDAffichage]["lignes"][index][tailles[sensDAffichage]["lignes"][index].length - 1] + " * " + diviseur + ")")
        }
    })
    $(tailles[sensDAffichage]["col"]).each(function (index, value) {
        //console.log("passe 3")
        if (value.includes(num)) {
            //console.log("passe 4")
            //console.log(index, value)
            $(identifiant).css("width", "calc(" + tailles[sensDAffichage]["col"][index][tailles[sensDAffichage]["col"][index].length - 1] + " * " + diviseur + ")")
        }
    })
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
        $(".cardContainer").draggable({ containment: "#affichage", scroll: false, cursor: "grabbing" }) // on le réactive
        draggableActive = true // on renvoie l'état réctivé à la variable globale
    } else if (selected == "efface") {
        draggableTest()
    } else if (selected == "change") {
        draggableTest()
    } else if (selected == "surligne") {
        draggableTest()
    }
}
function draggableTest() { // pour tester si la fonction de déplacement est activée
    if (draggableActive == true) {
        $(".cardContainer").draggable("destroy") // on désactive le déplacement uniquement si ce n'est pas déjà fait sinon ça bloque la suite
        draggableActive = false // on renvoie l'état désactivé à la variable globale
    }
}
function clickOnImage(event) { // pour gérer les clics sur images
    var image = event.target
    $("img").css("z-index", 1)
    $(".image>p").css("z-index", 1)
    $(image).css("z-index", 3)
    if (selected == "efface") {
        $(image).parent().toggleClass("visible") // on ajoute ou enlève une classe qui joue sur l'opacité
    } else if (selected == "change") {
        changeImage(image)
    } else if (selected == "surligne") {
        $(image).toggleClass("exergue") // on ajoute ou enlève une classe qui joue sur l'ombre autour de l'image
    } else if (selected == "deplace") {
        //console.log("deplace")
        for (let elt of $(".cardContainer")) {
            $(elt).css({
                "width": $($(elt).children()[0]).width(),
                "height": "fit-content"
            })
        }
    }
}
function changeImage(image) {
    var images = []
    for (let elt of $(image).parents(".affichageDesCartes").find("img")) {
        images.push($(elt).attr('src'))
    }
    var mots = []
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
    ipcRenderer.invoke('changeImage', data).then((data) => {
        //console.log(data)
        if (data["error"]) {
            alert(erreurs[data["error"]][langue])
        } else {
            if (JSON.parse($(image).parents(".mainDiv").children(".listeAffichable").html())[2] == "images") {
                $(image).attr('src', data[0])
            }
            else {
                $(image).html(data[0])
            }
            calculerTaille($(image).parents(".affichageDesCartes").attr('id'))
            setTimeout(() => {  // obligé sinon l'info part avant que les images soient affichées et ne les prend pas en compte
                actualisePile(pile)
            }, 200);
        }
    })
}
function calculateNumPositions(previous, elt) {
    //console.log(previous, elt)
    if ($(previous).prop("nodeName") == "P") {
        var rect = previous[0].getBoundingClientRect();
        //console.log(rect.top, rect.right, rect.bottom, rect.left);
        $(elt).offset({ "top": rect.bottom })
        $(elt).offset({ "left": (rect.left + (rect.right - rect.left) / 2) - 15 })
    } else {
        var rect = previous[0].getBoundingClientRect();
        //console.log(rect.top, rect.right, rect.bottom, rect.left);
        $(elt).offset({ "top": rect.bottom - 10 })
        $(elt).offset({ "left": (rect.left + (rect.right - rect.left) / 2) - 15 })
    }

}
function actualisePile(pile) {
    pile.push($("#affichage").html())
    //console.log("actualisée",pile)
}
function getBack(event) {
    //console.log("avantpop",pile)
    lastPile = pile[pile.length - 2]
    //console.log(lastPile)
    $("#affichage").html(lastPile)
    pile.pop()
    $(".cardContainer").draggable({ containment: "#affichage", scroll: false, cursor: "grabbing" })
    $(".img").animate({ opacity: 1 })
    //console.log("aprèspop",pile)
}
function zommOnCards(target) {
    //console.log($(e.target).parents("#bottom").find(".zoomValue"))
    $(target).parents("#bottom").find(".zoomValue").html(target.value + "%")
    var ratio = target.value / 100
    for (let elt of $(target).parents(".mainDiv").find(".cardContainer")) {
        //console.log(elt)
        $(elt).width(elt.getAttribute("firstwidth") * ratio)
        $(elt).height(elt.getAttribute("firstheight") * ratio)
        //console.log($(elt).find("p").length)
        if ($(elt).find("p").length > 0) {
            //console.log("on a un mot")
            $(elt).find("p").css("font-size", parseInt($(elt).find("p")[0].getAttribute("firstfont")) * ratio + "px")
        }
    }
}
function poserTaillesEtPlaces(img) {
    var rect = img.getBoundingClientRect()
    //console.log(img)
    //console.log(rect)
    img.setAttribute("firstwidth", rect["width"])
    img.setAttribute("firstheight", rect["height"])
    img.setAttribute("firstleft", rect["left"])
    img.setAttribute("firsttop", rect["top"])
    img.setAttribute("firstfont", $(img).css("font-size"))
    img.parentNode.setAttribute("firstwidth", rect["width"])
    img.parentNode.setAttribute("firstheight", rect["height"])
    img.parentNode.setAttribute("firstleft", rect["left"])
    img.parentNode.setAttribute("firsttop", rect["top"])
    $(img.parentNode).css({
        "width": rect["width"],
        "height": rect["height"]
    })
}

// resize pour empêcher de sortir de l'écran
function allowDrop(event) {
    event.preventDefault();
}