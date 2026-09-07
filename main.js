const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require("electron"), // import des modules d'electron
    Store = require("electron-store"),
    store = new Store() // on crée la base de données qui collectera les infos pour les notifications
const fs = require('fs')
const path = require("path")
const https = require("https")
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
        envoyerRessources()
        setInterval(envoyerRessources, 6 * 60 * 60 * 1000) // une publication en cours de journée finit par être signalée
    })
    log.info
    autoUpdater.checkForUpdatesAndNotify()
})
// =============== RESSOURCES COMPATIBLES (NOTIFICATIONS) ===============

const urlRessources = "https://leszexpertsfle.com/zappli/zappli-ressources-fle/"

function getNotifs() { // les préférences de notification vivent à part de localConfig, que setConfig() réécrit entièrement
    var notifs = store.get("notifs")
    if (notifs == undefined) { notifs = {} }
    if (!Array.isArray(notifs["vues"])) { notifs["vues"] = [] }
    if (!Array.isArray(notifs["cache"])) { notifs["cache"] = [] }
    if (typeof notifs["desactive"] != "boolean") { notifs["desactive"] = false }
    if (typeof notifs["dejaOuvert"] != "boolean") { notifs["dejaOuvert"] = false }
    return notifs
}

function recupererPage(url, redirections = 3) { // petit GET maison pour ne pas ajouter de dépendance
    return new Promise((resolve, reject) => {
        var requete = https.get(url, { headers: { "User-Agent": "zappli/" + app.getVersion() } }, (reponse) => {
            if (reponse.statusCode >= 300 && reponse.statusCode < 400 && reponse.headers.location && redirections > 0) {
                reponse.resume()
                return resolve(recupererPage(new URL(reponse.headers.location, url).href, redirections - 1))
            }
            if (reponse.statusCode != 200) {
                reponse.resume()
                return reject(new Error("statut " + reponse.statusCode))
            }
            var contenu = ""
            reponse.setEncoding("utf-8")
            reponse.on("data", (morceau) => { contenu += morceau })
            reponse.on("end", () => resolve(contenu))
        })
        requete.setTimeout(15000, () => { requete.destroy(new Error("délai dépassé")) })
        requete.on("error", reject)
    })
}

function decoderHtml(texte) {
    return texte
        .replace(/&#(\d+);/g, (correspondance, code) => String.fromCharCode(parseInt(code, 10)))
        .replace(/&#x([0-9a-f]+);/gi, (correspondance, code) => String.fromCharCode(parseInt(code, 16)))
        .replace(/&nbsp;/g, " ")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .trim()
}

function extraireRessources(html) { // la page est une grille WooCommerce : un <li> par ressource
    var ressources = []
    for (let produit of html.match(/<li class="[^"]*\bproduct\b[^"]*"[^>]*>[\s\S]*?<\/li>/g) || []) {
        var lien = produit.match(/<a href="([^"]+)"/)
        var titre = produit.match(/<h2 class="woocommerce-loop-product__title">([\s\S]*?)<\/h2>/)
        var image = produit.match(/<img[^>]+src="([^"]+)"/)
        if (lien == null || titre == null) { continue }
        ressources.push({
            "url": decoderHtml(lien[1]),
            "titre": decoderHtml(titre[1].replace(/<[^>]+>/g, "")),
            "image": image == null ? "" : decoderHtml(image[1])
        })
    }
    return ressources
}

async function envoyerRessources() {
    var notifs = getNotifs()
    var ressources = notifs["cache"]
    try {
        var trouvees = extraireRessources(await recupererPage(urlRessources))
        if (trouvees.length > 0) {
            ressources = trouvees
            notifs["cache"] = trouvees
            store.set("notifs", notifs)
        }
    } catch (erreur) {
        log.warn("ressources compatibles non récupérées : " + erreur) // hors ligne : on retombe sur le dernier contenu connu
    }
    var nouveautes = notifs["dejaOuvert"]
        ? ressources.filter((ressource) => !notifs["vues"].includes(ressource["url"]))
        : ressources // tant que l'utilisateur n'a jamais ouvert le popup, tout est nouveau pour lui
    if (mainWindow != null && !mainWindow.isDestroyed()) {
        mainWindow.send("ressources", {
            "url": urlRessources,
            "ressources": ressources,
            "nouveautes": nouveautes,
            "dejaOuvert": notifs["dejaOuvert"],
            "desactive": notifs["desactive"],
            "exergue": !notifs["desactive"] && nouveautes.length > 0
        })
    }
}

ipcMain.on("ressourcesVues", (evt, arg) => { // l'utilisateur a ouvert le popup : plus rien n'est "nouveau" jusqu'à la prochaine publication
    var notifs = getNotifs()
    notifs["dejaOuvert"] = true
    notifs["vues"] = notifs["cache"].map((ressource) => ressource["url"])
    if (typeof arg == "boolean") { notifs["desactive"] = arg }
    store.set("notifs", notifs)
})

ipcMain.on("ouvrirLien", (evt, arg) => {
    if (typeof arg == "string" && arg.startsWith("https://")) { shell.openExternal(arg) }
})

// =============== ROUTE POUR RECUPERER LES MOTS ===============
ipcMain.handle('getWords', async (evt, arg) => {
    //console.log(arg)
    return getWordsFromCalcFile(arg[0])
})
// =============== ROUTES AIDE ===============

ipcMain.on("help", (evt, arg) => {
    if (faq != null && !faq.isDestroyed()) { // une seule fenêtre d'aide : on remet au premier plan celle qui est déjà ouverte
        if (faq.isMinimized()) { faq.restore() }
        faq.focus()
        return
    }
    faq = createWindow("views/FAQ/faq_" + showLanguage + ".html", winWidth = 600, winHeight = 500)
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

    // on ne compare pas les longueurs : la non-répétition retire déjà les cartes tirées de la liste
    if (arg["typeDeTirage"] == "images") {
        var candidats = arg["listeImagesOuMots"].filter((elt) => !arg["listeAffichee"].includes(elt))
        if (candidats.length == 0) {
            return { "erreur": "erAllImages" }
        }
        return [candidats[Math.floor(Math.random() * candidats.length)], "images"]
    } else {
        var candidats = arg["listeImagesOuMots"].filter((elt) => !arg["listeAffichee"].includes(elt[0]))
        if (candidats.length == 0) {
            return { "erreur": "erAllWords" }
        }
        return [candidats[Math.floor(Math.random() * candidats.length)], "mots"]
    }
})
ipcMain.handle('changeImage', async (evt, arg) => {
    //console.log(arg)
    // deux possibiltés : des images, des mots
    if (arg["typeDeTirage"] == "images") {
        var candidats = arg["listeImagesOuMots"].filter((elt) => !arg["srcImagesAffichees"].includes(elt)) // on ne remet pas une carte déjà à l'écran
        if (candidats.length == 0) {
            return { "error": "erAllImages" }
        }
        return getRandomValues(candidats, 1)
    } else {
        var words = getWordsFromCalcFile(arg["listeImagesOuMots"][0])
        var candidats = words.filter((elt) => !arg["listeMotsAffiches"].includes(elt[0]))
        if (candidats.length == 0) {
            return { "error": "erAllWords" }
        }
        return getRandomValues(candidats, 1)
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
        var shuffleList = liste.slice().sort((a, b) => 0.5 - Math.random()); // on ne mélange pas la liste d'origine
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