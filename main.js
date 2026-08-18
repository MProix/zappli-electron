const { app, BrowserWindow, ipcMain, Menu, dialog } = require("electron"), // import des modules d'electron
    Store = require("electron-store"),
    store = new Store() // on crée la base de données qui collectera les infos pour les notifications
const fs = require('fs')
const path = require("path")
//const xlsx = require('node-xlsx');
const XLSX = require('xlsx')
//const { parse } = require("csv-parse");
const { autoUpdater } = require("electron-updater")
const menu = JSON.parse(fs.readFileSync(path.join(__dirname, "menu.json"), "utf-8")) // on récupère le JSON du fichier de menu
const pjson = require('./package.json'); // pour incrire dans la base de données store
const log = require("electron-log") // on initialise le système de log d'electron pour pouvoir débuguer à distance chez l'utilisateur
const openAboutWindow = require('about-window').default;
//var csvList = {} // on génère une liste vide en cas d'import de csv
let mainWindow = null //on stocke la variable de fenêtre
let faq = null // fenêtre d'aide
let userStoragePath = app.getPath("userData")
let mainDir = (__dirname)
var platform = process.platform // pour savoir sous quel OS on tourne
//var listOfValidListsOfWordsExtensions = [".numbers", ".xlsx", ".xsl", ".ods", ".csv"] // on stocke les extensions valides pour l'affichage de listes de mots

// ================ GESTION DE LA LANGUE D'AFFICHAGE ================ //

// on récupère la langue d'affichage principale du système
var locales = app.getPreferredSystemLanguages() // on récupère la langue d'affichage du système
var firstLanguage = "fr" // on passe le français en variable par défaut au cas ou la langue système ne serait pas reconnue
if (Array.isArray(locales) && locales.length > 0 && menu["listeLangues"].includes(locales[0].slice(0, 2))) {
    firstLanguage = locales[0].slice(0, 2)
}
//on remet dans un format lisible par défaut et on change le fr par la langue du système utilisateur
log.info("firstLanguage :", firstLanguage)
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
log.info("%cLe language utilisé est " + showLanguage, "color:green")
// ================ ON GÈRE LES LOGS ================ //
log.transports.file.resolvePathFn = () => path.join(userStoragePath, 'main.log') // on crée le fichier de log
log.info("%c////// Zappli version " + app.getVersion() + " ouverte //////", "color:red")
log.errorHandler.startCatching()

// ================ ON GÈRE L'UPDATE AUTOMATIQUE DES VERSIONS ================ //
/* new update available */
autoUpdater.on("update-not-available", (info) => {
    log.info("%cpas de nouvelle version", "color:blue")
    log.info("%c" + info, "color:blue")
})
autoUpdater.on("update-available", (info) => {
    log.info("%cil y a une nouvelle version", "color:blue")
    const dialogOpts = {
        type: 'info',
        buttons: ['Télécharger (redémarrage optionnel)', 'Ne pas télécharger'],
        title: 'Mise à jour de la zappli',
        detail:
            "Une nouvelle version est disponible. Vous pouvez la télécharger maintenant sans que la zappli redémarre. Les modifications auront lieu au prochain démarrage"
    }
    dialog.showMessageBox(dialogOpts).then((returnValue) => {
        if (returnValue.response === 0) {
            autoUpdater.on("update-downloaded", () => {
                const dialogOpts = {
                    type: 'info',
                    buttons: ['Redémarrer', 'Plus tard'],
                    title: 'Mise à jour de la zappli',
                    detail:
                        "Une nouvelle version a été téléchargée. Redémarrez l'application pour appliquer les mises à jour."
                }
                log.info(returnValue.response)
                dialog.showMessageBox(dialogOpts).then((returnValue) => {
                    if (returnValue.response === 0) autoUpdater.quitAndInstall()
                })
            })
        }
    })
})
autoUpdater.on("checking-for-update", (info) => {
    log.info("%cchecking for updates", "color:blue")
    log.info("%c" + info, "color:blue")
})
autoUpdater.on("error", (info) => {
    log.info("%cerror when updating", "color:blue")
    log.warn("%c" + info, "color:blue")
})
autoUpdater.on("before-quit-for-update", () => {
    setTimeout(6000)
})

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
            devTools: true // disabling devtools for distrib version
        },
        titleBarStyle: 'hidden'
    })

    win.loadFile(windowPath)

    win.on('closed', () => {
        win = null
    })
    return win
}

// ================ INITIALISATION DE LA FENÊTRE PRINCIPALE ================ //
log.info("langue utilisée :" + showLanguage)
log.info(("on ouvre : views/home/home_" + showLanguage + ".html"))

app.whenReady().then(() => {
    mainWindow = createWindow("views/home/home_" + showLanguage + ".html")
    mainWindow.webContents.once('did-finish-load', () => {
        // on vérifie s'il existe un dossier de listes
        if (fs.existsSync(path.join(userStoragePath, "listes.json"))) {
            if (fs.readFileSync(path.join(userStoragePath, "listes.json"), encoding = 'utf-8') != "") {
                mainWindow.send('listes', [JSON.parse(fs.readFileSync(path.join(userStoragePath, "listes.json"), encoding = 'utf-8')), mainDir])
            } else {
                mainWindow.send('listes', ["", mainDir])
            }
        } else {
            fs.openSync(path.join(userStoragePath, "listes.json"), 'w')
            mainWindow.send('listes', ["", mainDir])
        }
        mainWindow.send('mainDir', mainDir)
        mainWindow.send('OS', process.platform)
        mainWindow.send("storage", userStoragePath)
    })
    log.info
    autoUpdater.checkForUpdatesAndNotify()
})
// =============== ROUTE POUR RECUPERER LES MOTS ===============
ipcMain.handle('getWords', async (evt, arg) => {
    //console.log(arg)
    return getWordsFromCalcFile(arg[0])
})
// =============== ROUTES AIDE ===============

ipcMain.on("help", (evt, arg) => {
    faq = createWindow("views/FAQ/faq.html", winWidth = 600, winHeight = 400)
    faq.webContents.once('did-finish-load', () => {
        faq.send('OS', process.platform)
    })
})

// ================ ROUTES DES BOUTONS ================ //

ipcMain.handle('tirage', async (evt, arg) => {
    // deux possibiltés : des images, des mots
    if (arg["typeDeTirage"] == "images") {
        var cartes = tirerDesImages(arg["nombreDeCartes"], arg["listeImagesOuMots"])
        return ["cartes", cartes]
    } else {
        //console.log(arg)
        var mots = tirerDesMots(arg["nombreDeCartes"], arg["listeMots"])
        if(mots["erreur"] == "erPlusieursListes"){
            return ["mots", mots]
        } else if(mots["erreur"] == "erTooBig"){
            return ["mots", mots]
        } else {
            return ["mots", mots[0], mots[1]]
        }        
    }
})
ipcMain.handle('addOne', async (evt, arg) => {
    // deux possibiltés : des images, des mots
    //console.log(arg)

    if (arg["typeDeTirage"] == "images") {
        if (arg["listeImagesOuMots"].length == arg["listeAffichee"].length) {
            return { "erreur": "erAllImages" }
        } else {
            //console.log(arg["typeDeTirage"])
            var newElt = arg["listeImagesOuMots"][Math.floor(Math.random() * arg["listeImagesOuMots"].length)];
            while (arg["listeAffichee"].includes(newElt)) {
                newElt = arg["listeImagesOuMots"][Math.floor(Math.random() * arg["listeImagesOuMots"].length)];
            }
            return [newElt,"images"]
        }
    } else {
        if (arg["listeImagesOuMots"].length == arg["listeAffichee"].length) {
            return { "erreur": "erAllWords" }
        } else {
            //console.log(arg["typeDeTirage"])
            var newElt = arg["listeImagesOuMots"][Math.floor(Math.random() * arg["listeImagesOuMots"].length)];
            //console.log("newElt",newElt[0])
            //console.log("listeAffichee",arg["listeAffichee"])
            while (arg["listeAffichee"].includes(newElt[0])) {
                newElt = arg["listeImagesOuMots"][Math.floor(Math.random() * arg["listeImagesOuMots"].length)];
                //console.log("nouveau", newElt)
            }
            return [newElt,"mots"]
        }
    }
})
ipcMain.handle('changeImage', async (evt, arg) => {
    //console.log(arg)
    // deux possibiltés : des images, des mots
    if (arg["typeDeTirage"] == "images") {
        if (arg["listeImagesOuMots"].length <= arg["srcImagesAffichees"].length) {
            return { "error": "erAllImages" }
        } else {
            var newImage = getRandomValues(arg["listeImagesOuMots"], 1)
            while (arg["srcImagesAffichees"].includes(newImage[0][0])) { // on ne remet pas une carte déjà à l'écran
                newImage = getRandomValues(arg["listeImagesOuMots"], 1)
            }
            //console.log(newImage)
            return newImage
        }
    } else {
        var words = getWordsFromCalcFile(arg["listeImagesOuMots"][0])
        if (words.length == arg["listeMotsAffiches"].length) {
            return { "error": "erAllWords" }
        } else {
            var newWord = getRandomValues(words, 1)
            while (arg["listeMotsAffiches"].includes(newWord[0][0][0]) == true) {
                newWord = getRandomValues(words, 1)
            }
            return newWord
        }
    }
})

// ================ FONCTIONS DU PROGRAMME ================ //

function tirerDesImages(nbCartes, liste) {
    if (liste.length < nbCartes) {
        console.log("Il n'y a que " + liste.length + " image(s) dans cette liste.")
        return { "erreur": "erTooBig", "nb": liste.length }
    } else {
        return getRandomValues(liste, nbCartes)
    }
}
function tirerDesMots(nbCartes, liste) {
    console.log(liste.length)
    console.log(liste)
    if (liste.length < nbCartes) {
        console.log("Il n'y a que " + liste.length + " mot(s) dans cette liste.")
        return { "erreur": "erTooBig", "nb": liste.length }
    } else {
        //console.log("assez de cartes")
        return [getRandomValues(liste, nbCartes),liste]
    }
    /* var mots = getWordsFromCalcFile(liste[0])
    //console.log("------------------")
    //console.log(mots)
    //console.log("------------------")
    if (mots[0].length == 1) {
        return [getRandomValues(mots, nbCartes),mots]
    } else {
        return { "erreur": "erPlusieursListes" }
    } */
}
function getWordsFromCalcFile(calcFilePath) {
    //console.log("tatatatat")
    //console.log(calcFilePath)
    if (calcFilePath.includes('.csv')) {
        var buffer = fs.readFileSync(calcFilePath, { encoding: "utf-8" });
        var workbook = XLSX.read(buffer, { type: "string" });
    } else {
        var workbook = XLSX.readFile(calcFilePath, { type: "string" });
    }
    var result = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "" })
    var newResult = []
    var max = 0
    for (let elt of result) {
        var row = []
        for (let e of elt) {
            if (e != "") {
                row.push(e)
            }
        }
        if (row.length > max) { max = row.length }
        newResult.push(row)
    }
    //console.log("newresult",newResult)
    if (max == 1) {
        return newResult
    } else {
        var lastResult = []
        i = 0
        while (i < max) {
            lastResult.push([])
            i++
        }
        //console.log(lastResult)
        for (let elt of newResult) {
            i = 0
            while (i < max) {
                if (elt[i]) {
                    lastResult[i].push(elt[i])
                }
                i++
            }
        }
        //console.log("lastResult",lastResult)
        return lastResult
    }
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function getRandomValues(liste, nbCartes) {
    var max = liste.length
    if (max >= nbCartes) { // on vérifie qu'il y a assez de mots dans la liste par rapport au nombre demandé
        var shuffleList = liste.sort((a, b) => 0.5 - Math.random());
        var listeItems = shuffleList.slice(0, nbCartes)
        return [listeItems, max]
    } else {
        return { "erreur": "erTooBig2", "nb": max }
    }
}
function changeLanguage(lang) {
    //contents.reloadIgnoringCache()
    firstLanguage = lang
    setConfig()
    app.relaunch()
    app.exit()
}
function setConfig() {
    //console.log(firstLanguage)
    store.set("localConfig", {
        "version": pjson.version,
        "URL": "https://www.proix.eu/zapplis/superzappli.json",
        "langue": firstLanguage
    })
}

// ================ GESTION DU MENU NATIF ================ //
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
                                homepage: "https://www.leszexpertsfle.com/zappli",
                                description: "Tirez des cartes au hasard, jouez, surprenez vos apprenants…. pour mieux apprendre."
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
                                    homepage: "https://www.leszexpertsfle.com/zappli",
                                    description: "Tirez des cartes au hasard, jouez, surprenez vos apprenants…. pour mieux apprendre."
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
            { role: 'toggleDevTools' },
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
            }
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
// =============== ROUTES BOUTONS CLOSE MINIMIZE AND MAXIMIZE POUR WINDOWS ===============

// la fenêtre visée est toujours celle qui a envoyé le message, quelle que soit la vue
for (const suffixe of ["App", "Faq", "Listes"]) {
    ipcMain.on("close" + suffixe, (evt) => {
        const win = BrowserWindow.fromWebContents(evt.sender)
        if (win) { win.close() }
    })
    ipcMain.on("minimize" + suffixe, (evt) => {
        const win = BrowserWindow.fromWebContents(evt.sender)
        if (win) { win.minimize() }
    })
    ipcMain.on("maximizeRestore" + suffixe, (evt) => {
        const win = BrowserWindow.fromWebContents(evt.sender)
        if (!win) { return }
        if (win.isMaximized()) {
            win.unmaximize()
            win.webContents.send("isRestored")
        } else {
            win.maximize()
            win.webContents.send("isMaximized")
        }
    })
}
process.on('uncaughtException', function (err) {
    if (err) {
        log.error("caughtException : " + err.stack);
    }
});