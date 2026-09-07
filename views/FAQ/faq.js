const { ipcRenderer } = require('electron');
const langue = document.documentElement.lang == "en" ? "en" : "fr";
const titresBtn = {
    "fr": { "maximize": "Agrandir", "restore": "Restaurer" },
    "en": { "maximize": "Maximize", "restore": "Restore" }
};
ipcRenderer.on('OS', (evt, arg) => {
    if (arg == "darwin") {
        $("#titleBar").css("display", "none");
    }
});
/* ==================== GESTION DES BOUTONS DE MENU SOUS WINDOWS ET LINUX ================== */
$("#close").on("click", () => {
    ipcRenderer.send('closeFaq'); // on envoie au backend sur l'évènement de fermeture de fenêtre
});
$("#minimize").on("click", () => {
    ipcRenderer.send('minimizeFaq'); // on envoie au backend sur l'évènement de réduction de fenêtre
});
$("#maxRes").on("click", () => {
    ipcRenderer.send('maximizeRestoreFaq'); // on envoie au backend sur l'évènement d'agrandissement de fenêtre
});
function changeMaxResBtn(isMaximizedFaq) { // on gère les deux options : déjà maximisé ou pas encore
    if (isMaximizedFaq) {
        $("#maxRes").attr('title', titresBtn[langue]["restore"]);
        $("#maxRes").removeClass("maximize");
        $("#maxRes").addClass("restore");
    } else {
        $("#maxRes").attr("title", titresBtn[langue]["maximize"]);
        $("#maxRes").removeClass("restore");
        $("#maxRes").addClass("maximize");
    }
}
ipcRenderer.on("isMaximized", () => { changeMaxResBtn(true) });
ipcRenderer.on("isRestored", () => { changeMaxResBtn(false) });