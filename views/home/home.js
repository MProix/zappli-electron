// IMPORTS
const { ipcRenderer } = require('electron')
const path = require("path")
const { type } = require('process')
const swal = require('sweetalert')
const fs = require('fs')

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
var dropList = [] // pour stocker la liste d'images ou de mots sur laquelle on travaille
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
        $("#affichage").append('<div class="nbDiv' + nbZones + ' mainDiv" id="affichage' + identifiantZone + '" ondrop="getDropFiles(event)"><div class="oneCardContainer"><div class="dropZone2" id="dropImages' + identifiantZone + '"><p>' + erreurs["1"][langue] + ',<br> ' + erreurs["2"][langue] + ',<br> ' + erreurs["3"][langue] + '</p><p>(.xlsx, .xls, .csv, .numbers, .ods) ' + erreurs["5"][langue] + ' (.jpg, .png, .gif, .webp)</p></div><p>' + erreurs["5"][langue] + '</p><div class="folderSelector" id="folderSelector' + identifiantZone + '"><input type="file" webkitdirectory directory multiple style="display: none;"id="folderChosen' + identifiantZone + '" class="filepicker" onchange="getFilesOrFolders(event)"><label for="folderChosen' + identifiantZone + '">' + erreurs["4"][langue] + '</label><input type="file" multiple style="display: none;" id="folderChosen2-' + identifiantZone + '" class="filepicker" onchange="getFilesOrFolders(event)"><label for="folderChosen2-' + identifiantZone + '">' + erreurs["6"][langue] + '</label></div></div><div class="affichageMessage" id="affichageMessage' + identifiantZone + '" style="display: none;"><p>' + erreurs["7"][langue] + '</p></div><div class="affichageDesCartes" id="affichageDesCartes' + identifiantZone + '" style="display: none;"></div><div class="affichageBtns" style="display: none;"><div id="top"><div class="cardsNumber" id="cardsNumber' + identifiantZone + '"><label for="cardsNumber' + identifiantZone + '">' + erreurs["8"][langue] + '<br>' + erreurs["9"][langue] + '</label><div><input type="number" value="3" min="1" max="24"></div></div><div id="play" onclick="clickOnPlay(event)"><i class="fa-solid fa-circle-play"></i></div><div id="zero' + identifiantZone + '" class="zero" onclick="erase(event)"><i class="fa-solid fa-eraser"></i></div><div class="backToChooser" onclick="backToChooser(event)"><i class="fa-regular fa-folder-open"></i></div></div><div id="bottom"><label for="vol">' + erreurs["10"][langue] + ' : <span id="zoomValue' + identifiantZone + '" class="zoomValue">100%</span> </label><div class="zoom"><input type="range" id="vol' + identifiantZone + '" name="vol" min="20" max="200" value="100" oninput="zommOnCards(event.target)"></div></div></div><div id="delAddFolderChooser"><div class="addFolderChooser" id="addFolderChooser' + identifiantZone + '" title="ajouter un dossier" onclick="ajouterZone(this)"><i class="fa-regular fa-square-plus"></i></div><div class="delFolderChooser" id="delFolderChooser' + identifiantZone + '" title="supprimer un dossier" onclick="supprimerZone(this)"><i class="fa-regular fa-square-minus"></i></div></div><div class="listeAffichable" style="display:none"></div></div>')
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
function traverseFileTree(item, path, elt) { // on récupère de manière récursive les fichiers un par un
    path = path || "";
    if (item.isFile) {
        // Get file
        item.file(function (file) {
            dropList.push(path + file.name)
        });
    } else if (item.isDirectory) {
        // Get folder contents
        var dirReader = item.createReader();
        dirReader.readEntries(function (entries) {
            for (var i = 0; i < entries.length; i++) {
                traverseFileTree(entries[i], path + item.name + "/", elt);
            }
        });
    }
}
function getDropFiles(event) { // on récupère les données du drop
    dropList = [] // on vide la liste au cas ou elle aurait été remplie
    $(event.target).parents(".mainDiv").children(".listeAffichable").html("") // on vide le div de secours des données
    event.preventDefault();
    var items = event.dataTransfer.items;
    var path = event.dataTransfer.files[0].path.split("/")
    var goodPath = (path.slice(0, path.length - 1)).join("/")
    for (var i = 0; i < items.length; i++) {
        // webkitGetAsEntry is where the magic happens
        var item = items[i].webkitGetAsEntry();
        if (item) {
            traverseFileTree(item, goodPath + "/", $(event.target));
        }
    }
    sleep(200).then(() => {
        var goodList = checkListFormats(dropList)
        manageListeUploaded(goodList, event.target)
    })
}
// ============= GESTION DU BOUTON TELECHARGER DOSSIER(S) ============= //
function getFilesOrFolders(e) {
    //console.log(e)
    var listePaths = []
    for (let elt of e.target.files) {
        listePaths.push(elt.path)
    }
    //console.log(listePaths)
    var goodList = checkListFormats(listePaths)
    manageListeUploaded(goodList, e.target)
}
// ============= BOUTON POUR REVENIR AU CHOIX DE DOSSIER ============= //
function backToChooser(e) {
    $(e.target).parents(".mainDiv").children(".affichageMessage").css("display", "none")
    $(e.target).parents(".mainDiv").children(".affichageBtns").css("display", "none")
    $(e.target).parents(".mainDiv").children(".oneCardContainer").css("display", "flex")
    $(e.target).parents(".mainDiv").children(".affichageDesCartes").css("display", "none")
    $(e.target).parents(".mainDiv").find(".filepicker").val("") // sinon on a un pb si on resélectopnne le même dossier vu que l'event est "onchange"
}
// ============= BOUTON EFFACER ============= //
function erase(e) {
    $(e.target).parents(".mainDiv").children(".affichageDesCartes").html("")
}
// ================ BOUTON PLAY ================ //
function clickOnPlay(event) {
    var quelleZone = $(event.target).parents(".mainDiv").attr("id")[$(event.target).parents(".mainDiv").attr("id").length - 1] // on récupère le numéro de la zone dans laquelle on se trouve pour savoir où apporter des modifs
    //console.log($(event.target).parents(".mainDiv").children(".listeAffichable"))
    data = {
        "nombreDeCartes": parseInt($(event.target).parents(".mainDiv").children(".affichageBtns").children("#top").children(".cardsNumber").children("div").children("input").val()), // on envoie le nombre de cartes souhaité
        "listeImagesOuMots": JSON.parse($(event.target).parents(".mainDiv").children(".listeAffichable").html())[0], // on envoie la liste d'images ou de mots
        "typeDeTirage": JSON.parse($(event.target).parents(".mainDiv").children(".listeAffichable").html())[1] // on précise s'il s'agit de mots ou d'images
    }
    //console.log(data)
    ipcRenderer.invoke('tirage', data).then((data) => {
        //console.log(data)
        if (data[1]["erreur"]) {
            //console.log(erreurs[data[1]["erreur"]][langue])
            //console.log(erreurs[data[1]["erreur"]][langue].length)
            if (erreurs[data[1]["erreur"]][langue].length > 1 && Array.isArray(erreurs[data[1]["erreur"]][langue])) {
                //console.log(data[1]["nb"])
                //console.log(erreurs[data[1]["erreur"]][langue][0] + data[1]["nb"] + erreurs[data[1]["erreur"]][langue][1])
                alert(erreurs[data[1]["erreur"]][langue][0] + data[1]["nb"] + erreurs[data[1]["erreur"]][langue][1])
            } else {
                //console.log(erreurs[data[1]["erreur"]][langue])
                alert(erreurs[data[1]["erreur"]][langue])
            }
        } else {
            var zoneACacher = "#affichageMessage" + quelleZone
            var zoneAMontrer = "#affichageDesCartes" + quelleZone
            $(zoneACacher).css("display", "none")
            $(zoneAMontrer).css("display", "flex")
            afficherCartes(data[1][0], quelleZone, zoneAMontrer, data[0])
        }
        /* $("#vol" + quelleZone).val(100)
        $("#zoomValue" + quelleZone).html("100%") */
    })
}
// ================ BOUTONS CHANGER ET SUPPRIMER LE FOND ================ //
function changerFond(event) {
    $("#affichage").css('background-image', 'url("' + event.target.files[0].path + '")')
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

function manageListeUploaded(goodList, cible) {
    //console.log("toto")
    if (goodList[1] == false && goodList[0] == false) { // s'il n'y a ni listes de mots ni images
        swal("Il y a un problème", "Il n'y pas de liste de mots ni d'images dans ce dossier")
    } else if (goodList[1] == true && goodList[0] == true) { // s'il y a les deux
        swal("Il y a un problème", "Vous avez importé à la fois des listes de mots et des images", {
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
                    $(cible).parents(".mainDiv").children(".listeAffichable").html(JSON.stringify([goodList[3], "mots"]))
                    readyToPlay(cible)
                    break;
                case "catch2":
                    $(cible).parents(".mainDiv").children(".listeAffichable").html(JSON.stringify([goodList[2], "images"]))
                    readyToPlay(cible)
                    break;
            }
        });
    } else if (goodList[1] == true && goodList[0] == false) { // si l'upload est bon du premier coup et ce sont des mots HOURRA !!!
        //console.log("2")
        $(cible).parents(".mainDiv").children(".listeAffichable").html(JSON.stringify([goodList[3], "mots"]))
        readyToPlay(cible)
    } else {// si l'upload est bon du premier coup et ce sont des images HOURRA !!!
        //console.log("3")
        //console.log($(cible).parents(".mainDiv").children(".listeAffichable").html())
        $(cible).parents(".mainDiv").children(".listeAffichable").html(JSON.stringify([goodList[2], "images"]))
        //console.log($(cible).parents(".mainDiv").children(".listeAffichable").html())
        readyToPlay(cible)
    }
}
function checkListFormats(liste) { // on vérifie les formats des fichiers uploadés et on nettoie la liste
    var imagesList = []
    var wordsList = []
    var image = false
    var listeDeMots = false
    for (const [index, element] of liste.entries()) {
        if (listOfValidExtensions.includes(element.slice(element.lastIndexOf("."), element.length))) {
            image = true
            imagesList.push(element)
        } else if (listOfValidListsOfWordsExtensions.includes(element.slice(element.lastIndexOf("."), element.length))) {
            listeDeMots = true
            wordsList.push(element)
        }
    }
    return [image, listeDeMots, imagesList, wordsList]
}
// il faut un délai pour le traitement des images chargées
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function readyToPlay(cible) {
    $(cible).parents(".mainDiv").children(".affichageMessage").css("display", "flex")
    $(cible).parents(".mainDiv").children(".affichageBtns").css("display", "flex")
    $(cible).parents(".mainDiv").children(".oneCardContainer").css("display", "none")
}
function afficherCartes(liste, quelleZone, zoneAMontrer, type) {
    i = 0
    $(zoneAMontrer).html("")
    //console.log(zoneAMontrer)
    while (i < liste.length) {
        if (type == "cartes") {
            $(zoneAMontrer).append("<div id='divImage" + quelleZone + "' class='image'><div class='cardContainer'><img class='img' src='" + liste[i] + "' onmousedown='clickOnImage(event)'></div></div>")
        } else if (type == "mots") {
            $(zoneAMontrer).append("<div id='divImage" + quelleZone + "' class='image'><div class='cardContainer'><p class='img' onmousedown='clickOnImage(event)'>" + liste[i] + "</p></div></div>")
        }
        i++
    }
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
        if (value.includes(num)) {
            //console.log(index, value)
            $(identifiant).css("height", "calc(" + tailles[sensDAffichage]["lignes"][index][tailles[sensDAffichage]["lignes"][index].length - 1] + " * " + diviseur + ")")
        }
    })
    $(tailles[sensDAffichage]["col"]).each(function (index, value) {
        //console.log(index, value)
        if (value.includes(num)) {
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
    for (let elt of $(".cardContainer>*")) {
        //console.log($(elt))
        //console.log(elt.clientWidth)
        //console.log($(elt).height())
        /*  $(elt).css({
             "width":elt.clientWidth,
             "height":elt.clientHeight,
             "left": $(elt).offset().left,
             "top": $(elt).offset().top
         }) */

    }
    /* $(".cardContainer").css({
        "width" : "fit-content",
        "height" : "fit-content"
    }) */
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
        "listeImagesOuMots": JSON.parse($(image).parents(".mainDiv").children(".listeAffichable").html())[0], // on envoie la liste d'images ou de mots
        "typeDeTirage": JSON.parse($(image).parents(".mainDiv").children(".listeAffichable").html())[1] // on précise s'il s'agit de mots ou d'images
    }
    ipcRenderer.invoke('changeImage', data).then((data) => {
        if (data["error"]) {
            alert(erreurs[data["error"]][langue])
        } else {
            if (JSON.parse($(image).parents(".mainDiv").children(".listeAffichable").html())[1] == "images") {
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
    $(".img").animate({opacity:1})
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