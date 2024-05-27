const { ipcRenderer } = require('electron');
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