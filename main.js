const { app, BrowserWindow, ipcMain, Menu, Notification, nativeImage } = require("electron"), // import des modules d'electron
    Store = require("electron-store"),
    store = new Store() // on crée la base de données qui collectera les infos pour les notifications
const fs = require('fs')
const os = require("os")
const path = require("path")
const https = require('https')
const pjson = require('./package.json'); // pour incrire dans la base de données store
const { autoUpdater } = require("electron-updater")
const log = require("electron-log") // on initialise le système de log d'electron pour pouvoir débuguer à distance chez l'utilisateur

const openAboutWindow = require('about-window').default;
const menu = JSON.parse(fs.readFileSync(path.join(__dirname, "menu.json"), "utf-8"))
const erreurs = JSON.parse(fs.readFileSync(path.join(__dirname, "erreurs.json"), "utf-8"))
const writtenLanguages = erreurs["listeLangues"] //liste des langues supportées par l'appli (qui ont un fichier home.html dans leur langue)
let userStoragePath = app.getPath("userData")
var platform = process.platform
console.log(userStoragePath)
// ================ variables globales stockées ================ //
///////////////////////////////////////////////////////////////////

let autresDisques = []

// on récupère la langue d'affichage principale du système
var locales = app.getPreferredSystemLanguages() // c'est une fonction de nodejs, on récupère la langue d'affichage du système
var firstLanguage = "fr" // on passe le français en variable par défaut au cas ou la langue système ne serait pas reconnue
//on remet dans un format lisible par défaut et on change le fr par la langue du système utilisateur
if (locales[0].indexOf("-") != -1) {
    firstLanguage = locales[0].slice(0, locales[0].indexOf("-"))
} else {
    firstLanguage = locales[0]
}
// on vérifie s'il existe une config locale
if (!store.has("localConfig")) { // s'il n'y en a pas on la crée
    setConfig()
    var localConfig = store.get("localConfig") // et on la récupère en variable
} else {
    var localConfig = store.get("localConfig") // et on la récupère en variable
}
if (localConfig["langue"] == undefined || !menu["listeLangues"].includes(localConfig["langue"])) { // s'il n'y a pas de langue enregistrée ou si elle diffère de celles que l'appli connaît
    setConfig()
    var showLanguage = firstLanguage
} else {
    var showLanguage = localConfig["langue"] // on aligne avec la langue qui va s'afficher
}

// on vérifie s'il existe un historique
if (!store.has("historique")) { // s'il n'y en a pas on le crée
    store.set("historique", {
    })
    var historique = store.get("historique") // et on le récupère en variable
} else {
    var historique = store.get("historique") // et on le récupère en variable
}
//console.log(historique)

log.transports.file.resolvePathFn = () => path.join(userStoragePath, 'main.log') // on crée le fichier de log
log.info("////////////////////// hello, log ////////////////////////////////")
log.log("Application version : " + app.getVersion())

let mainWindow = null //on stocke la variable de fenêtre
let faq = null
var listOfValidExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".tiff", ".PNG", ".JPG", ".JPEG", ".WEBP", ".GIF", ".TIFF"] // on stocke les extensions valides pour l'afichage des images
const userHomeDirectory = os.homedir() // on stocke le chemin du répertoire utilisateur pour construire l'arborescence de ses dossiers
let dossiersRacineUtilisateur = choosePertinentFolders(fs.readdirSync(userHomeDirectory), userHomeDirectory) //on crée l'arborescence de la racine de l'utilisateur

if (fs.existsSync(path.join(userStoragePath, "historique"))) {
    erraseFilesAndCopyNews(path.join(userStoragePath, "historique")) //on vide l'historique s'il existe déjà
} else {
    fs.mkdirSync(path.join(userStoragePath, "historique")) //sinon on le crée
    fs.chmodSync(path.join(userStoragePath, "historique"), 0o777) // et on donne les bonnes permissions d'accès
}

// ================ NOUVELLE FENETRE D'APPLI ================ //

function createWindow(windowPath, winWidth = 1200, winHeight = 800) {
    let win = new BrowserWindow({
        width: winWidth,
        height: winHeight,
        "node-integration": "iframe",
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            "web-security": false,
            devTools: false // disabling devtools for distrib version
        },
        titleBarStyle: 'hidden'
        //frame: true
    })

    win.loadFile(windowPath)

    win.on('closed', () => {
        win = null
    })
    return win
}

// ================ Initialisation de la fenêtre principale ================ //
app.whenReady().then(() => {
    if (writtenLanguages.includes(showLanguage)) {
        //console.log("LANGUAGE : "+showLanguage)
        mainWindow = createWindow("views/home/home_" + showLanguage + ".html")
    } else {
        showLanguage = "fr"
        mainWindow = createWindow("views/home/home_" + showLanguage + ".html")
    }
    mainWindow.webContents.once('did-finish-load', () => {
        //mainWindow.send('store-data', dossiersRacineUtilisateur)
        //mainWindow.send('autres-disques', autresDisques)
        //console.log(JSON.parse(fs.readFileSync(path.join(__dirname, "erreurs.json"),encoding='utf8')))
        mainWindow.send('erreurs', JSON.parse(fs.readFileSync(path.join(__dirname, "erreurs.json"),encoding='utf8')))
        mainWindow.send('OS', process.platform)
    })
    autoUpdater.checkForUpdatesAndNotify()
})

// ================ setting auto-updater ================ //

/* new update available */

autoUpdater.on("update-available", (info) => {
    log.info("il y a une nouvelle version", info)
})
autoUpdater.on("checking-for-update", (info) => {
    log.info("checking for updates")
    log.info("INFOS : ", info)
})
autoUpdater.on("update-downloaded", () => {
    log.info("update-downloaded")
})
autoUpdater.on("error", (info) => {
    log.info("error when updating")
    log.warn(info)
})
autoUpdater.on("before-quit-for-update", () => {
    setTimeout(6000)
})

// =============== ROUTE BOUTON PLAY ===================

ipcMain.on('getDraw', (evt, arg) => {
    var listeOfImages = choosePertinentFiles(arg["listeDossiers"]) // on récupère une liste de toutes les images de ce ou ces dossier(s)
    var data = shuffleFolder(listeOfImages, arg["nombreImages"]) // on mélange et on ne garde que les premiers en fonction du nombre demandé
    //fs.writeFileSync(path.join(userStoragePath, "historique", "historique" + data[3] + ".json"), JSON.stringify(data[0])) //on crée un fichier d'historique
    evt.sender.send('giveDraw', data) // on renvoie la liste d'images au front end
})

// =============== ROUTE CHANGE IMAGE ==================

ipcMain.handle('changeImage', async (evt, arg) => {
    //console.log(arg)
    var erreur = "" // on initialise le potentiel message d'erreur
    var listeOfImages = choosePertinentFiles([arg.chooserPath])
    if (listeOfImages.length == arg.listeImagesPresentes.length) { // on vérifie que toutes les images ne sont pas déjà affichées
        erreur = erreurs["erAllImages"][showLanguage]
        return { "erreur": erreur }
    } else { // si ce n'est pas le cas
        // on récupère une image aléatoire
        var imageChoisie = shuffleFolder(listeOfImages, 1)
        // on vérifie qu'elle n'est pas déjà affichée
        while (arg.listeImagesPresentes.includes(imageChoisie[0][0][0])) { // on tire tant que ce n'est pas bon
            imageChoisie = shuffleFolder(listeOfImages, 1)
        }
        return { "nouvelleImg": imageChoisie[0][0], "erreur": erreur }
    }
})

// =============== ROUTES BOUTONS CLOSE MINIMIZE AND MAXIMIZE POUR WINDOWS ===============

ipcMain.on("closeApp", (evt, arg) => {
    mainWindow.close()
})
ipcMain.on("minimizeApp", (evt, arg) => {
    mainWindow.minimize()
})
ipcMain.on("maximizeRestoreApp", (evt, arg) => {
    if (mainWindow.isMaximized()) {
        mainWindow.restore()
        mainWindow.webContents.send("isRestored")
    } else {
        mainWindow.maximize()
        mainWindow.webContents.send("isMaximized")
    }
})

ipcMain.on("closeFaq", (evt, arg) => {
    //console.log("ferme")
    faq.close()
})
ipcMain.on("minimizeFaq", (evt, arg) => {
    faq.minimize()
})
ipcMain.on("maximizeRestoreFaq", (evt, arg) => {
    if (faq.isMaximized()) {
        faq.restore()
        faq.webContents.send("isRestored")
    } else {
        faq.maximize()
        faq.webContents.send("isMaximized")
    }
})
// =============== ROUTES ERASE ===============

ipcMain.on("erase", (evt, arg) => {
    historiqueNum += 1
    var data = historiqueNum
    evt.sender.send('efface', data)
})
// =============== ROUTES AIDE ===============

ipcMain.on("help", (evt,arg) => {
    faq = createWindow("views/FAQ/faq.html", winWidth = 600, winHeight = 400)
})
// =============== FONCTIONS ============================
function choosePertinentFolders(folderList, basePath) {
    var finalFoldersList = []
    for (let elt of folderList) {
        if (elt[0] !== '.') {
            try {
                fs.lstatSync(path.join(basePath, elt)).isDirectory()
                var classes = checkImagesAndEmpty(basePath, elt)
                finalFoldersList.push([elt, path.join(basePath, elt), classes])
            } catch (error) {
            }
        }
    }
    return finalFoldersList
}

function checkImagesAndEmpty(base, elt) {
    var classesToAdd = { "empty": true, "images": false, "folders": false }
    for (let element of fs.readdirSync(path.join(base, elt))) {
        try {
            fs.lstatSync(path.join(base, elt, element)).isDirectory()
            classesToAdd["folders"] = true
            classesToAdd["empty"] = false
        } catch (error) {
        }
        if (listOfValidExtensions.includes(path.extname(path.join(elt, element)))) {
            classesToAdd["images"] = true
            classesToAdd["empty"] = false
        }
    }
    var finalClasses = ""
    if (classesToAdd["empty"] == true) { finalClasses += " empty" }
    if (classesToAdd["folders"] == true) { finalClasses += " folders" }
    if (classesToAdd["images"] == true) { finalClasses += " images" }
    return finalClasses
}

function choosePertinentFiles(listeOfPaths) {
    var listeImages = []
    for (let onePath of listeOfPaths) {
        for (let elt of fs.readdirSync(onePath)) {
            if (listOfValidExtensions.includes(path.extname(path.join(onePath, elt)))) {
                listeImages.push([elt, path.join(onePath, elt)])
            }
        }
    }
    return listeImages
}

function shuffleFolder(listeImages, num) {
    /* var error = "" */
    var shuffleImgToLoad = listeImages.sort((a, b) => 0.5 - Math.random());
    var listeImagesChoisies = shuffleImgToLoad.slice(0, num)
    /* if (listeImagesChoisies == 0) {
        error = erreurs["erSelectFolder"][showLanguage]
    }
    else if (0 < listeImagesChoisies.length && listeImagesChoisies.length < num) {
        error = erreurs["erTooBig"][showLanguage][0] + listeImagesChoisies.length + erreurs["erTooBig"][showLanguage][1]
    } else { */
    var max = listeImages.length
    //historiqueNum = historiqueNum + 1
    /* } */
    return [listeImagesChoisies, /* error, */ max/*, historiqueNum - 1*/]
}

function erraseFilesAndCopyNews(directory) {
    fs.readdir(directory, (err, files) => {
        if (err) throw err;
        for (const file of files) {
            fs.unlink(path.join(directory, file), (err) => {
                if (err) throw err;
            });
        }
    });
}
function changeLanguage(lang) {
    //contents.reloadIgnoringCache()
    firstLanguage = lang
    setConfig()
    app.relaunch()
    app.exit()
}
function changeToExpert(level) {
    if (level == "expert") {
        mainWindow.send('mode', "expert")
    } else if (level == "simple") {
        mainWindow.send("mode", "simple")
    }

}
/* function checkUrl() {
    let url = "https://www.proix.eu/zapplis/superzappli.json";
    https.get(url, (res) => {
        let body = "";
        res.on("data", (chunk) => {
            body += chunk;
        });

        res.on("end", () => {
            try {
                checkedUrl = JSON.parse(body);
                //console.log("checkedurl", checkedUrl)
                store.set("distantConfig", checkedUrl.config)
                checkNewInfo()
            } catch (error) {
                console.error(error.message);
            };
        });

    }).on("error", (error) => {
        //console.log("localConfig", localConfig)
        store.set("distantConfig", localConfig)
        console.error(error.message);
    });
} */

function setConfig() {
    store.set("localConfig", {
        "version": pjson.version,
        "URL": "https://www.proix.eu/zapplis/superzappli.json",
        "langue": firstLanguage
    })
}

/* function checkNewInfo() {
    //console.log(store.get("dontShowVersion"))
    //console.log(store.get("localConfig"))
    //console.log(store.get("distantConfig"))
    if (store.get("localConfig").version != store.get("distantConfig").version) {
        var message = "Nouvelle version disponible : "
        var url = "https://www.eglise-ostwald-elsau-montagneverte.fr/wp-content/uploads/2023/01/Semaine-du-28-janvier-au-05-fevrier-2023.pdf"
        var version = store.get("distantConfig").version
        //console.log("versions différentes")
        if (store.get("distantConfig").version != store.get("dontShowVersion")) {
            newVersionWin = createWindow("views/newVersion/newVersion.html", 400, 300)
            newVersionWin.webContents.once('did-finish-load', () => {
                newVersionWin.send('store-data', { "message": message, "url": url, "version": version })
            })
        }

    } else {
        //console.log("mêmes versions")
    }
} */
////////////// config menu /////////////////

const isMac = platform === 'darwin'
const templateMenu = [
    // { role: 'appMenu' }
    ...(isMac
        ? [{
            label: app.name,
            submenu: [
                {
                    label: menu["about"][showLanguage],
                    click() {
                        openAboutWindow(
                            {
                                icon_path: path.join(__dirname, 'public', 'iconAbout.png'),
                                css_path: path.join(__dirname, "public", "aboutStyles.css"),
                                homepage: "https://www.leszexpertsfle.com"
                            }
                        )
                    }
                },
                { type: 'separator' },
                {
                    label: menu["services"][showLanguage],
                    role: 'services'
                },
                { type: 'separator' },
                {
                    label: menu["hide"][showLanguage],
                    role: 'hide'
                },
                {
                    label: menu["hideOthers"][showLanguage],
                    role: 'hideOthers'
                },
                {
                    label: menu["unhide"][showLanguage],
                    role: 'unhide'
                },
                { type: 'separator' },
                {
                    label: menu["quit"][showLanguage],
                    role: 'quit'
                }
            ]
        }]
        : [
            {
                label: app.name,
                submenu: [
                    {
                        label: menu["about"][showLanguage],
                        click() {
                            openAboutWindow(
                                {
                                    icon_path: path.join(__dirname, 'public', 'iconAbout.png'),
                                    //copyright: '(c) 2024 Les Zexperts FLE',
                                    css_path: path.join(__dirname, "public", "aboutStyles.css"),
                                    homepage: "https://www.leszexpertsfle.com"
                                }
                            )
                        }
                    }
                ]
            }

        ]),
    // { role: 'fileMenu' }
    {
        label: menu["file"][showLanguage],
        submenu: [
            isMac ? {
                label: menu["close"][showLanguage],
                role: 'close'
            } : {
                label: menu["quit"][showLanguage],
                role: 'quit'
            }
        ]
    },
    // rôle ACTIONS
    {
        label: menu["action"][showLanguage],
        submenu: [
            /*{ role: 'toggleDevTools' },
            { role: 'forceReload' },
            {
                label: menu["chooseFolder"][showLanguage],
                accelerator: "CommandOrControl+F",
                click() {
                    mainWindow.webContents.send("clickMenu", { "action": "2" })
                }
            },
            {
                label: menu["chooseNumber"][showLanguage],
                accelerator: "CommandOrControl+N",
                click() {
                    mainWindow.webContents.send("clickMenu", { "action": "1" })
                }
            },
            {
                label: menu["chooseAction"][showLanguage],
                accelerator: "CommandOrControl+A",
                click() {
                    mainWindow.webContents.send("clickMenu", { "action": "3" })
                }
            },
            { type: 'separator' },
            {
                label: menu["previousDraw"][showLanguage],
                accelerator: "Backspace",
                click() {
                    if (historiqueNum < 3) { // on vérifie qu'il existe effectivement un tirage antérieur : si non...
                        data = erreurs["erNoPrevious"][showLanguage]
                        mainWindow.webContents.send('pasdhistorique', [data]) //... on renvoie un message d'erreur pour la console du navigateur
                    } else { //...si c'est bon...
                        historiqueNum = historiqueNum - 2 //... on revient sur ce tirage
                        data = JSON.parse(fs.readFileSync(path.join(userStoragePath, "historique", "historique" + historiqueNum + ".json"))) // on récupère les données
                        historiqueNum += 1 // on se remet au bon niveau d'historique
                        mainWindow.webContents.send('givePreviousDraw', [data, historiqueNum - 1]) // on envoie les données au front end
                    }
                }
            },
            {
                label: menu["drawImages"][showLanguage],
                accelerator: "Return",
                click() {
                    mainWindow.webContents.send("listenPlay")
                }
            },
            { type: 'separator' },*/
            {
                label: menu["changeLanguage"][showLanguage],
                submenu: [
                    {
                        label: "English",
                        click() {
                            changeLanguage("en")
                        }
                    },
                    {
                        label: "Français",
                        click() {
                            changeLanguage("fr")
                        }
                    },
                ]
            },
            /*{ type: 'separator' },
            {
                label: menu["chooseMode"][showLanguage],
                submenu: [
                    {
                        label: "Expert",
                        click() {
                            changeToExpert("expert")
                        }
                    },
                    {
                        label: menu["beginner"][showLanguage],
                        click() {
                            changeToExpert("simple")
                        }
                    }
                ]

            }*/
        ]
    },
    // { role: 'viewMenu' }
    {
        label: menu["view"][showLanguage],
        submenu: [
            {
                label: menu["resetZoom"][showLanguage],
                role: 'resetZoom'
            },
            {
                label: menu["zoomIn"][showLanguage],
                role: 'zoomIn'
            },
            {
                label: menu["zoomOut"][showLanguage],
                role: 'zoomOut'
            },
            { type: 'separator' },
            {
                label: menu["togglefullscreen"][showLanguage],
                role: 'togglefullscreen'
            }
        ]
    },
]
if (platform == "darwin") {
    const menu = Menu.buildFromTemplate(templateMenu)
    Menu.setApplicationMenu(menu)
}
// pour ouvrir le menu sous windows
ipcMain.on('fireMenu', (evt, arg) => {
    const menu = Menu.buildFromTemplate(templateMenu);
    menu.popup();
})

///////////////////////////////// ROUTES ET FONCTIONS DE LA PAGE NEWVERSION /////////////////////////////////////////////

/* ipcMain.on('dontShow', (evt, arg) => {
    //console.log("arg", arg)
    store.set("dontShowVersion", arg)
    newVersionWin.close()
})
ipcMain.on('plusTard', (evt, arg) => {
    newVersionWin.close()
}) */


ipcMain.handle('getDraw2', async (evt, arg) => {
    var cardsInFolder = getCardsInFolder(arg["folderPath"]) // on récupère une liste de toutes les images de ce dossier
    if (cardsInFolder.length < arg["nbCards"]) { // on vérifie qu'il y a assez de cartes dans le dossier
        return { error: erreurs["erTooBig"][showLanguage][0] + cardsInFolder.length + erreurs["erTooBig"][showLanguage][1]} // si non on renvoie une erreur
    } else {
        var data = shuffleFolder(cardsInFolder, arg["nbCards"]) // on mélange et on ne garde que les premiers en fonction du nombre demandé
        //fs.writeFileSync(path.join(userStoragePath, "historique", "historique" + data[3] + ".json"), JSON.stringify(data[0])) //on crée un fichier d'historique
        return data
    }

})

function getCardsInFolder(folderPath) {
    var listeImages = []
    for (let elt of fs.readdirSync(folderPath)) {
        if (listOfValidExtensions.includes(path.extname(path.join(folderPath, elt)))) {
            listeImages.push([elt, path.join(folderPath, elt)])
        }
    }
    return listeImages
}
