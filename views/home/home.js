// IMPORTS
const userOS = navigator.platform
const { ipcRenderer } = require('electron');
const { get } = require('jquery');
const path = require("path")
// ============= VARIABLES GLOBALES ============= //
var selected = "deplace" // pour connaitre constamment l'action au click sélectionnnée par l'utilisateur
var nbFolderChoosers = 1 // pour savoir combien de possibilités de tirages on a
var sensDAffichage = "portrait" // pour affiner au mieux l'affichage des tailles il faut connaitre le sens des zones d'affichage
var draggableActive = true // pour savoir si draggable est déjà désactivé sur les images
var pile = [] // pour créer un historique des modifications
var erreurs = {}

// ============= Différenciation de la barre du haut selon l'OS ============= //
ipcRenderer.on('OS', (evt, arg) => {
    if (arg == "darwin") {
        $("#titre").css("justify-content", "center");
        $("#showHideMenus").css("display", "none");
        $(".topBtn").css("display", "none");
        //$("#header").addClass("headerBackground");
    }
});
ipcRenderer.on('erreurs', (evt, arg) => {
    erreurs = arg
})
// ============= AFFICHAGE DU MENU SOUS WINDOWS ============== //

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

// ============= Montrer quel bouton est sélectionné dans la barre du haut pour les actions au click ============= //
$("#deplace, #efface, #change, #surligne").on("click", function () {
    $("#deplace, #efface, #change, #surligne").css("background-color", "unset") // on efface le background de focus
    $(this).css("background-color", "#1c63a0") // on le remet sur le bon élément (celui cliqué)
    selected = this.id // on change la varable globale "selected"
    prepareAction()
})
// ============= PASSER L'AFFICHAGE DES CARTES EN PLEIN ÉCRAN ET REVENIR EN NORMAL ============= //
//on passe en plein écran en ne gardant que le menu du haut
$("#toFullScreen, #toFullScreenText").on("click", () => {
    $("#folderChooser, #leftRightMoving").addClass("leftFullScreen")
    $("#cardsContainer").addClass("rightFullScreen")
    $("#toRegularScreen, #toRegularScreenText").css("display", "block")
    $("#toFullScreen, #toFullScreenText").css("display", "none")
})
//on passe en écran normal
$("#toRegularScreen, #toRegularScreenText").on("click", () => {
    $("#folderChooser, #leftRightMoving").removeClass("leftFullScreen")
    $("#cardsContainer").removeClass("rightFullScreen")
    $("#toRegularScreen, #toRegularScreenText").css("display", "none")
    $("#toFullScreen, #toFullScreenText").css("display", "block")
})
// ============= POUR AJOUTER ET SUPPRIMER DES CHOIX DE DOSSIERS A GAUCHE ============= //
$("#addFolderChooser").on("click", () => {
    nbFolderChoosers += 1 // on incrémente le nombre de sélecteurs de dossiers disponibles
    if (nbFolderChoosers > 1) {
        $("#delFolderChooser").css("display", "block")
    }
    if (nbFolderChoosers == 3) {
        $("#addFolderChooser").css("display", "none")
    }
    $("#folder" + nbFolderChoosers).css("display", "flex")
    $("#affichage").append("<div></div>") // on ajoute un div dans l'affichage
    $("#affichage>div").removeClass() // on enlève la classe préexistante sur tous les divs de l'affichage
    $("#affichage>div").addClass("nbDiv" + $("#affichage>div").length) // on remet la bonne classe
    $("#affichage>div").last().attr("id", "affichage" + $("#affichage>div").length) // on ajoute un id
    $("#affichage").children().each(function () { //on recalcule les tailles des images
        calculerTaille(this)
    })
})
$("#delFolderChooser").on("click", () => {
    nbFolderChoosers -= 1 // on diminue le nombre de sélecteurs de dossiers disponibles
    if (nbFolderChoosers == 1) { // on remet en place les boutons plus et moins en fonction du nombre de sélecteurs de dossiers
        $("#delFolderChooser").css("display", "none")
    }
    if (nbFolderChoosers == 2) {
        $("#addFolderChooser").css("display", "block")
    }
    $($(".oneFolder")[nbFolderChoosers]).css("display", "none") // on masque le dernier sélecteur
    $("#affichage").children().last().remove() // on supprime un div d'affichage
    $("#affichage>div").removeClass() // on enlève la classe préexistante sur tous les divs de l'affichage
    $("#affichage>div").addClass("nbDiv" + $("#affichage>div").length) // on remet la bonne classe
    $("#affichage").children().each(function () { //on recalcule les tailles des images
        calculerTaille(this)
    })
})
// ============= AJOUTER LE NOM et l'ID DU DOSSIER EN HAUT DU FOLDER CHOOSER ============= //
function addChangeOnFolderSelect(cible, OS) {
    $(cible).on("change", (e) => {
        let folderPath = e.target.files[0].path // on récupère le chemin du dossier
        let folderPathSplit = (path.parse(folderPath))["dir"] // on le split en diverses parties et on récupère la partie "directory"
        if (OS == "Win32") {
            var endFolderPathSplit = folderPathSplit.slice(folderPathSplit.lastIndexOf("\\") + 1, folderPathSplit.length) // formatage windows
        } else {
            var endFolderPathSplit = folderPathSplit.slice(folderPathSplit.lastIndexOf("/") + 1, folderPathSplit.length) // autres formatages
        }
        $($($(e.target).parent()).prev()).children()[0].innerText = endFolderPathSplit // on l'ajoute comme titre
        $($($(e.target).parent()).prev()).children()[0].id = folderPathSplit // on lui colle le chemin d'accès comme ID pour pouvoir le récupérer pour le tirage
    })
}
addChangeOnFolderSelect(".filepicker", userOS) // on l'applique au div déjà précréé

//#####################################################//
// ============= BRANCHEMENT DES BOUTONS ============= //
//#####################################################//

// ============= LES BOUTONS PLAY DES FOLDER CHOOSERS ============= //
function applyPlayBtns(cible) { // fonction générale qui calcule l'action des boutons plays de la colonne de gauche
    $(cible).on("click", clickOnPlay).on("click", function () {
        setTimeout(() => {  // obligé sinon l'info part avant que les images soient affichées et ne les prend pas en compte
            actualisePile(pile)
        }, 200);
    })
}
function calculerTaille(div) {
    if ($($("#affichage>div")[0]).width() - $($("#affichage>div")[0]).height() >= 0) {
        sensDAffichage = "paysage"
    } else {
        sensDAffichage = "portrait"
    }
    imgSize($(div).children().length, div)
    setTimeout(recadrer, 200);
}
applyPlayBtns(".submitOneFolder")
// ============= LE BOUTON CHANGER DE FOND ============ //
$("#fondPicker").on("change", (e) => {
    $("#affichage").css("background-image", "url(" + e.target.files[0].path + ")")
})
// ============= LE BOUTON REMETTRE À ZÉRO ============ //

$("#zero").on("click", (e) => {
    for (let elt of $("#affichage").children()) {
        $(elt).html("")
    }
    $("#affichage").css("background-image", "none")
})

// ============= LE BOUTON PLAY PRINCIPAL ============= //

$("#play").on("click", () => {
    $(".submitOneFolder:visible").each(clickOnPlay)
    setTimeout(() => {  // obligé sinon l'info part avant que les images soient affichées et ne les prend pas en compte
        actualisePile(pile)
    }, 200);
}) // on tire les cartes de tous les choosers visibles de gauche
function clickOnPlay() {
    var cible = this
    var error = ""
    data = {
        "nbCards": $($($($(cible).parent()).children(".cardsNumber")).children("div")).children("input").val(), // on envoie le nombre de cartes souhaité
        "folderPath": $($(cible).parent().children(".folderTitle")).children("div").attr("id") // on envoie le chemin d'accès aux images
    }
    if (data["folderPath"] == undefined || data["folderPath"] == "") { // on vérifie qu'un dossier a bien été sélectionéé sinon on affiche une erreur
        error = erreurs["erSelectFolder"][document.documentElement.lang]
        alert(error)
    } else {
        // on envoie la requête au backend
        ipcRenderer.invoke('getDraw2', data).then((data) => {
            if (data["error"] != undefined) { // si le backend renvoie une erreur on l'affiche
                alert(data["error"])
            }
            else {
                var quelDiv = (cible.id.slice(-1)) // sinon on récupère le numéro du chooser d'où est partie la requête
                $("#affichage").children()[quelDiv - 1].innerHTML = ""
                $(data[0]).each(function (index, elt) {
                    $($("#affichage").children()[quelDiv - 1]).append('<div class="image" id="imgDiv' + index + '"><div class="img"><img src="' + elt[1] + '" id="' + elt[0] + '" class=number></div></div>')
                })
                $(".img").draggable({ containment: "#affichage", scroll: false })
                $("#affichage").children().each(function () { //on recalcule les tailles des images
                    calculerTaille(this)
                })
                var bonnesImages = "#affichage" + quelDiv + " img" // on fabrique l'identifiant pour jquery
                $(bonnesImages).on("click", function () { // on applique la fonction uniquement sur les bonnes images parce que les autres l'ont déjà et qu'en la dupliquant on a de mauvaises surprises
                    clickOnImage(this)
                })
                $(bonnesImages).on("mousedown", function () { // on fait passer au-dessus l'image qu'on manipule
                    $("img").css("z-index", 1)
                    $(this).css("z-index", 2)
                })
            }
        })
    }
}
// =============  ============= //

/* function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
} */

// ============= LE BOUTON DE NUMEROTATION ============= //
$("#numerote").on("click", () => {
    if ($(".numero").length == 0) {
        $(".img").each(function (index) {
            $($(this).children()[0]).after('<div class="numero">' + parseInt(index + 1) + '</div>')
            calculateNumPositions($(this).children()[0], $($(this).children()[0]).next())
        })
    } else {
        $(".numero").remove()
    }
})

// ============= LE BOUTON BACK ============= //
$("#back").on("click", () => {
    lastPile = pile[pile.length - 2]
    nbFolderChoosers = 0
    $("#actionsMenu").height(lastPile.menuHaut)
    $("#folderChooser").width(lastPile.menuGauche)
    $("#cardsContainer").width("calc(100% - " + lastPile.menuGauche + ")")
    $("#mainContent").height("calc(100% - " + lastPile.menuHaut + ")")
    if (lastPile.leftFullScreen == true) {
        $("#folderChooser").addClass("leftFullScreen")
        $("#cardsContainer").addClass("rightFullScreen")
    }
    var compt = 1
    for (let elt of [lastPile.cards1, lastPile.cards2, lastPile.cards3]) {
        if (elt != undefined) {
            $("#affichage" + compt).html(elt)
            nbFolderChoosers += 1
        } else {
            if (nbFolderChoosers == 1) { // on remet en place les boutons plus et moins en fonction du nombre de sélecteurs de dossiers
                $("#delFolderChooser").css("display", "none")
            }
            if (nbFolderChoosers == 2) {
                $("#addFolderChooser").css("display", "block")
            }
            let i = 3
            while (i > nbFolderChoosers) {
                $($(".oneFolder")[i - 1]).css("display", "none") // on masque les sélecteurs surnuméraires
                $($("#affichage").children()[i - 1]).remove() // on supprime les divs d'affichage surnuméraires
                i--
            }
            $("#affichage>div").removeClass() // on enlève la classe préexistante sur tous les divs de l'affichage
            $("#affichage>div").addClass("nbDiv" + $("#affichage>div").length) // on remet la bonne classe
            $("#affichage").children().each(function () { //on recalcule les tailles des images
                calculerTaille(this)
            })
        }
        compt += 1
    }
    pile.pop()
    $("img").on("click", function () { // on applique la fonction uniquement sur les bonnes images parce que les autres l'ont déjà et qu'en la dupliquant on a de mauvaises surprises
        clickOnImage(this)
    })
    $("img").on("mousedown", function () { // on fait passer au-dessus l'image qu'on manipule
        $("img").css("z-index", 1)
        $(this).css("z-index", 2)
    })
    $(".img").draggable({ containment: "#affichage", scroll: false }) // on le réactive
    draggableActive = true // on renvoie l'état réctivé à la variable globale
})

// ============= AUTRES FONCTIONS

function calculateNumPositions(previous, elt) {
    $(elt).offset({ "top": $(previous).offset().top + $(previous).height() })
    $(elt).css("transform", "translateY(-15px)");
}
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
function imgSize(num, div) {
    var identifiant = "#" + div.id + " .image"
    $(tailles[sensDAffichage]["lignes"]).each(function (index, value) {
        if (value.includes(num)) {
            $(identifiant).css("height", tailles[sensDAffichage]["lignes"][index][tailles[sensDAffichage]["lignes"][index].length - 1])
        }
    })
    $(tailles[sensDAffichage]["col"]).each(function (index, value) {
        if (value.includes(num)) {
            $(identifiant).css("width", tailles[sensDAffichage]["col"][index][tailles[sensDAffichage]["col"][index].length - 1])
        }
    })
    if (sensDAffichage == "paysage") {
        $(".img").css({
            height: "fit-content",
            width: "100%"
        })
    } else {
        $(".img").css({
            width: "fit-content",
            height: "100%"
        })
    }
}
function recadrer() {
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
}
function prepareAction() { // pour désactiver/réactiver la possibilité de déplacer les images
    if (selected == "deplace" && draggableActive == false) { // si on clique sur déplace et que le déplacement a été désactivé
        $(".img").draggable({ containment: "#affichage", scroll: false }) // on le réactive
        draggableActive = true // on renvoie l'état réctivé à la variable globale
    } else if (selected == "efface") {
        draggableTest()
    } else if (selected == "change") {
        draggableTest()
    } else if (selected == "surligne") {
        draggableTest()
    }
}
function clickOnImage(image) { // pour gérer les clics sur images
    if (selected == "efface") {
        $(image).toggleClass("visible") // on ajoute ou enlève une classe qui joue sur l'opacité
    } else if (selected == "change") {
        changeImage(image)
    } else if (selected == "surligne") {
        $(image).toggleClass("exergue") // on ajoute ou enlève une classe qui joue sur l'ombre autour de l'image
    }
}

function draggableTest() { // pour tester si la fonction de déplacement est activée
    if (draggableActive == true) {
        $(".img").draggable("destroy") // on désactive le déplacement uniquement si ce n'est pas déjà fait sinon ça bloque la suite
        draggableActive = false // on renvoie l'état désactivé à la variable globale
    }
}
function changeImage(cible) {
    var listeImagesPresentes = []
    var chooserSelector = "#titleFolder" + $(cible).parent().parent().parent().attr('id').charAt($(cible).parent().parent().parent().attr('id').length - 1) + ">div"
    for (let elt of $(cible).parent().parent().parent().children().children()) {
        listeImagesPresentes.push(($(elt).children()[0].id))
    }
    data = { // on envoie
        "listeImagesPresentes": listeImagesPresentes, // la liste des images déjà présentes
        "chooserPath": $(chooserSelector).attr("id") // le chemin d'accès de ces images
    }
    ipcRenderer.invoke("changeImage", data).then((data) => {
        if (data["erreur"] != "") {
            alert(data["erreur"])
        } else {
            $(cible).attr("src", data.nouvelleImg[1])
            $(cible).attr("id", data.nouvelleImg[0])
        };
    })
}
function actualisePile(pile) {
    pile.push({
        "menuHaut": $("#actionsMenu").height(),
        "menuGauche": $("#folderChooser").width(),
        "cartesWidth": "calc(100% - " + $("#folderChooser").width() + ")",
        "cartesHeight": "calc(100% - " + $("#actionsMenu").height() + ")",
        "leftFullScreen": $("#folderChooser").hasClass("leftFullScreen"),
        "rightFullScreen": $("#cardsContainer").hasClass("rightFullScreen"),
        "folder1": {
            "active": true,
            "folderId": $("#titleFolder1").children()[0].id,
            "folderName": $("#titleFolder1").children()[0].innerHTML,
            "number": $("#cardsNumber1 input").val()
        },
        "folder2": {
            "active": $("#folder2").css("display") == "flex",
            "folderId": $("#titleFolder2").children()[0].id,
            "folderName": $("#titleFolder2").children()[0].innerHTML,
            "number": $("#cardsNumber2 input").val()
        },
        "folder3": {
            "active": $("#folder3").css("display") == "flex",
            "folderId": $("#titleFolder3").children()[0].id,
            "folderName": $("#titleFolder3").children()[0].innerHTML,
            "number": $("#cardsNumber3 input").val()
        },
        "cards1": $($($("#affichage")).children()[0]).html(),
        "cards2": $($($("#affichage")).children()[1]).html(),
        "cards3": $($($("#affichage")).children()[2]).html(),
    })
}


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