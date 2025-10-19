const { ipcRenderer, app, ipcMain } = require('electron');
const path = require("path")
const fs = require('fs')

ipcRenderer.on('OS', (evt, arg) => {
    if (arg == "darwin") {
        $("#titleBar").css("display", "none");
    }
});
ipcRenderer.on('listeName', (evt, arg) => {
    var erreurs = JSON.parse(fs.readFileSync(path.join(arg[2], "erreurs.json"), encoding = 'utf-8'))
    if (arg[0] == "noName") {
        $("header>h1").html(erreurs["listTitle"][document.documentElement.lang])
        var mots = ""
        for (let pas = 0; pas < 20; pas++) {
            mots += "<div><input type='text' class='word' value=''></input><i class='fa-solid fa-circle-xmark'></i></div>"
        }
        $("form").prepend(mots)
        $(".fa-circle-xmark").on("click", function () {
            this.parentElement.remove()
        })
    } else {
        $("header>h1").html(arg[0])
        console.log(arg)
        var listeDesMots = JSON.parse(fs.readFileSync(path.join(arg[1], "listes.json"), encoding = 'utf-8'))[arg[0]]
        var mots = ""
        console.log(listeDesMots)
        for (let elt of listeDesMots) {
            mots += "<div><input type='text' class='word' value='" + elt + "'></input><i class='fa-solid fa-circle-xmark'></i></div>"
        }
        $("form").prepend(mots)
        $(".fa-circle-xmark").on("click", function () {
            this.parentElement.remove()
        })
    }
    $("#enregistrerListe").on("click", function () { // on vire la liste précédente puisqu'elle est susceptible d'avoir été modifiée
        var listeGlobale = {}
        if(fs.readFileSync(path.join(arg[1], "listes.json"), encoding = 'utf-8') != ""){
            listeGlobale = JSON.parse(fs.readFileSync(path.join(arg[1], "listes.json"), encoding = 'utf-8'))
            delete listeGlobale[arg[0]]
        }
        var words = []
        for (let elt of $(".word")) {
            if($(elt).val() != ""){
                words.push($(elt).val())
            }
        }
        console.log("words : ",words)
        console.log($("h1").html())
        listeGlobale[$("h1").text()] = words
        console.log(listeGlobale)
        fs.writeFileSync(path.join(arg[1], "listes.json"), JSON.stringify(listeGlobale))
        ipcRenderer.send("changeLists", Object.keys(listeGlobale)) //on envoie le nom de la liste avec)
        ipcRenderer.send('closeListes');
    })
})
$("#ajouterMot").on("click", function () {
    $("<div><input type='text' class='word' value=''></input><i class='fa-solid fa-circle-xmark'></i></div>").insertBefore("#ajouterMot")
    $(".fa-circle-xmark").on("click", function () {
        this.parentElement.remove()
    })
})

/* ==================== GESTION DES BOUTONS DE MENU SOUS WINDOWS ET LINUX ================== */
$("#close").on("click", () => {
    ipcRenderer.send('closeListes'); // on envoie au backend sur l'évènement de fermeture de fenêtre
});
$("#minimize").on("click", () => {
    ipcRenderer.send('minimizeListes'); // on envoie au backend sur l'évènement de réduction de fenêtre
});
$("#maxRes").on("click", () => {
    ipcRenderer.send('maximizeRestoreListes'); // on envoie au backend sur l'évènement d'agrandissement de fenêtre
});
function changeMaxResBtn(isMaximizedListes) { // on gère les deux options : déjà maximisé ou pas encore
    if (isMaximizedListes) {
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