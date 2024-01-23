const { app, BrowserWindow, ipcMain, Menu, Notification, nativeImage } = require("electron"), // import des modules d'electron
    Store = require("electron-store"),
    store = new Store() // on crée la base de données qui collectera les infos pour les notifications
const fs = require('fs')
const os = require("os")
const path = require("path")
const https = require('https')
const pjson = require('./package.json'); // pour incrire dans la base de données store
const { autoUpdater } = require("electron-updater")
const nodeDiskInfo = require('node-disk-info') // pour récupérer les différents disques durs
const log = require("electron-log") // on initialise le système de log d'electron pour pouvoir débuguer à distance chez l'utilisateur

const openAboutWindow = require('about-window').default;
const menu = JSON.parse(fs.readFileSync(path.join(__dirname, "menu.json"), "utf-8"))
const erreurs = JSON.parse(fs.readFileSync(path.join(__dirname, "erreurs.json"), "utf-8"))
const writtenLanguages = erreurs["listeLangues"] //liste des langues supportées par l'appli (qui ont un fichier home.html dans leur langue)
let userStoragePath = app.getPath("userData")
var platform = process.platform

// ================ variables globales stockées ================ //
///////////////////////////////////////////////////////////////////
let localConfig = store.has("localConfig") ? store.get("localConfig") : setConfig()
let autresDisques = []

// on récupère la langue d'affichage principale du système
var locales = app.getPreferredSystemLanguages()
console.log("LOCALES : " + locales)
var firstLanguage = "fr"
if (locales[0].indexOf("-") != -1) {
    firstLanguage = locales[0].slice(0, locales[0].indexOf("-"))
} else {
    firstLanguage = locales[0]
}

log.transports.file.resolvePathFn = () => path.join(userStoragePath, 'main.log') // on crée le fichier de log
log.info("////////////////////// hello, log ////////////////////////////////")
log.log("Application version : " + app.getVersion())

///////////////// chercher d'autres disques que c pour windows
try {
    const disks = nodeDiskInfo.getDiskInfoSync();
    for (let disk of disks) {
        if (disk.mounted != "C:") {
            autresDisques.push([disk.mounted, disk.mounted, disk.filesystem])
        }
    }
} catch (e) {
    console.error(e);
}

let mainWindow = null //on stocke la variable de fenêtre
//let newVersionWin = null
var listOfValidExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".tiff"] // on stocke les extensions valides pour l'afichage des images
//let disquesSysteme = [['Disque C','C:'],['Disque D','D:'],['Disque F','F:']]
const userHomeDirectory = os.homedir() // on stocke le chemin du répertoire utilisateur pour construire l'arborescence de ses dossiers
let dossiersRacineUtilisateur = choosePertinentFolders(fs.readdirSync(userHomeDirectory), userHomeDirectory) //on crée l'arborescence de la racine de l'utilisateur

if (fs.existsSync(path.join(userStoragePath, "historique"))) {
    erraseFilesAndCopyNews(path.join(userStoragePath, "historique")) //on vide l'historique s'il existe déjà
} else {
    fs.mkdirSync(path.join(userStoragePath, "historique")) //sinon on le crée
    fs.chmodSync(path.join(userStoragePath, "historique"), 0o777) // et on donne les bonnes permissions d'accès
}

var historiqueNum = 1 //on initialise l'incrémentation des fichiers d'historique

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
    if (writtenLanguages.includes(firstLanguage)) {
        //console.log("LANGUAGE : "+firstLanguage)
        mainWindow = createWindow("views/home/home_" + firstLanguage + ".html")
    } else {
        firstLanguage = "fr"
        mainWindow = createWindow("views/home/home_" + firstLanguage + ".html")
    }
    mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.send('store-data', dossiersRacineUtilisateur)
        mainWindow.send('autres-disques', autresDisques)
        mainWindow.send('version', app.getVersion())
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
autoUpdater.on("download-progress", (progress) => {
    log.info(progress)
})
autoUpdater.on("update-downloaded", () => {
    log.info("update-downloaded")
})
autoUpdater.on("error", (info) => {
    log.info("error when updating")
    log.warn(info)
})

// =============== ROUTE BOUTON PLAY ===================

ipcMain.on('getDraw', (evt, arg) => {
    var listeOfImages = choosePertinentFiles(arg["listeDossiers"]) // on récupère une liste de toutes les images de ce ou ces dossier(s)
    var data = shuffleFolder(listeOfImages, arg["nombreImages"]) // on mélange et on ne garde que les premiers en fonction du nombre demandé
    fs.writeFileSync(path.join(userStoragePath, "historique", "historique" + data[3] + ".json"), JSON.stringify(data[0])) //on crée un fichier d'historique
    evt.sender.send('giveDraw', data) // on renvoie la liste d'images au front end
})

// =============== ROUTE BOUTON PREVIOUS ===============

ipcMain.on('getPreviousDraw', (evt, arg) => {
    if (historiqueNum < 3) { // on vérifie qu'il existe effectivement un tirage antérieur : si non...
        data = erreurs["erNoPrevious"][firstLanguage]
        evt.sender.send('pasdhistorique', [data]) //... on renvoie un message d'erreur pour la console du navigateur
    } else { //...si c'est bon...
        historiqueNum = historiqueNum - 2 //... on revient sur ce tirage
        data = JSON.parse(fs.readFileSync(path.join(userStoragePath, "historique", "historique" + historiqueNum + ".json"))) // on récupère les données
        historiqueNum += 1 // on se remet au bon niveau d'historique
        evt.sender.send('givePreviousDraw', [data, historiqueNum - 1]) // on envoie les données au front end
    }
})

// =============== ROUTE SUBFOLDERS ====================

ipcMain.handle('getSubfolders', async (evt, arg) => {
    var data = {
        "subFolders": choosePertinentFolders(fs.readdirSync(arg), arg), // on crée la liste des sous-dossiers
        "parentPath": arg // on récupère l'endroit où les insérer
    }
    return data // on renvoie direct au front end qui attend la réponse
})

// =============== ROUTE FOLDERS POUR LES DISQUES EXTERNES =======================

/* ipcMain.on('getFolder', (evt, arg) => {
    var d = require('diskinfo')
    d.getDrives(function (err, aDrives) {
        var disks = []
        for (var i = 0; i < aDrives.length; i++) {
            disks.push(aDrives[i].mounted);
        }
        evt.sender.send('giveFolders', disks)
    });
}) */

// =============== ROUTE CHANGE IMAGE ==================

ipcMain.handle('changeImage', async (evt, arg) => {
    var erreur = "" // on initialise le potentiel message d'erreur
    historiqueNum = historiqueNum - 1 // on se remet dans le bon tirage
    var histList = JSON.parse(fs.readFileSync(path.join(userStoragePath, "historique", "historique" + historiqueNum + ".json"), "utf-8")) // on récupère la liste des images
    var listComp = [] // on initialise une liste avec juste les titres d'images
    for (let elt of histList) {
        listComp.push(elt[0]) // on la remplit
    }
    var newImage = shuffleFolder(choosePertinentFiles(arg["routes"], 1))[0][0] // on récupère une nouvelle image
    var index = 0
    while (histList[index][0] != arg["imgToChange"]) { // on parcourt la liste de l'historique pour trouver l'indice de l'image à changer
        index += 1
    }
    if (choosePertinentFiles(arg["routes"]).length == histList.length) { // on vérifie que toutes les images ne sont pas déjà utilisées
        console.log("probleme")
        erreur = erreurs["erAllImages"][firstLanguage]
        return { "erreur": erreur }
    } else { // si c'est bon on tire des images jusqu'à ce qu'on en ait une qui n'est pas déjà dans la liste
        while (listComp.includes(newImage[0])) {
            historiqueNum -= 1
            newImage = shuffleFolder(choosePertinentFiles(arg["routes"], 1))[0][0]
        }
        histList[index] = newImage // on remplace au bon indice
        fs.writeFileSync(path.join(userStoragePath, "historique", "historique" + historiqueNum + ".json"), JSON.stringify(histList)) // on actualise le fichier d'historique
        historiqueNum += 1 // on se remet au bon numéro d'historique
        return { "nouvelleImage": newImage, "erreur": erreur, "index": index, "historique": historiqueNum - 1 } // on renvoie la bonne image et le bon indice au front end
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

// =============== FONCTIONS ============================
function choosePertinentFolders(folderList, basePath) {
    var finalFoldersList = []
    for (let elt of folderList) {
        if (elt[0] !== '.' && fs.lstatSync(path.join(basePath, elt)).isDirectory()) {
            var classes = checkImagesAndEmpty(basePath, elt)
            finalFoldersList.push([elt, path.join(basePath, elt), classes])
        }
    }
    return finalFoldersList
}

function checkImagesAndEmpty(base, elt) {
    var classesToAdd = { "empty": true, "images": false, "folders": false }
    for (let element of fs.readdirSync(path.join(base, elt))) {
        if (fs.lstatSync(path.join(base, elt, element)).isDirectory()) {
            classesToAdd["folders"] = true
            classesToAdd["empty"] = false
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
    var error = ""
    var shuffleImgToLoad = listeImages.sort((a, b) => 0.5 - Math.random());
    var listeImagesChoisies = shuffleImgToLoad.slice(0, num)
    if (listeImagesChoisies == 0) {
        error = erreurs["erSelectFolder"][firstLanguage]
    }
    else if (0 < listeImagesChoisies.length && listeImagesChoisies.length < num) {
        error = erreurs["erTooBig"][firstLanguage][0] + listeImagesChoisies.length + erreurs["erTooBig"][firstLanguage][1]
    } else {
        var max = listeImages.length
        historiqueNum = historiqueNum + 1
    }
    return [listeImagesChoisies, error, max, historiqueNum - 1]
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
        //console.log("localconfig", localConfig)
        store.set("distantConfig", localConfig)
        console.error(error.message);
    });
} */

function setConfig() {
    store.set("localConfig", {
        "version": pjson.version,
        "URL": "https://www.proix.eu/zapplis/superzappli.json"
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
                    label: menu["about"][firstLanguage],
                    click() {
                        openAboutWindow(
                            {
                                icon_path: path.join(__dirname, 'public', 'iconAbout.png'),
                                copyright: '(c) 2024 Les Zexperts FLE',
                                css_path: path.join(__dirname, "public", "aboutStyles.css")
                            }
                        )
                    }
                },
                { type: 'separator' },
                {
                    label: menu["services"][firstLanguage],
                    role: 'services'
                },
                { type: 'separator' },
                {
                    label: menu["hide"][firstLanguage],
                    role: 'hide'
                },
                {
                    label: menu["hideOthers"][firstLanguage],
                    role: 'hideOthers'
                },
                {
                    label: menu["unhide"][firstLanguage],
                    role: 'unhide'
                },
                { type: 'separator' },
                {
                    label: menu["quit"][firstLanguage],
                    role: 'quit'
                }
            ]
        }]
        : [
            {
                label: app.name,
                submenu: [
                    {
                        label: menu["about"][firstLanguage],
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
        label: menu["file"][firstLanguage],
        submenu: [
            isMac ? {
                label: menu["close"][firstLanguage],
                role: 'close'
            } : {
                label: menu["quit"][firstLanguage],
                role: 'quit'
            }
        ]
    },
    {
        label: menu["action"][firstLanguage],
        submenu: [
            { role: 'toggleDevTools' },
            {
                label: menu["chooseFolder"][firstLanguage],
                accelerator: "CommandOrControl+F",
                click() {
                    mainWindow.webContents.send("clickMenu", { "action": "2" })
                }
            },
            {
                label: menu["chooseNumber"][firstLanguage],
                accelerator: "CommandOrControl+N",
                click() {
                    mainWindow.webContents.send("clickMenu", { "action": "1" })
                }
            },
            {
                label: menu["chooseAction"][firstLanguage],
                accelerator: "CommandOrControl+A",
                click() {
                    mainWindow.webContents.send("clickMenu", { "action": "3" })
                }
            },
            { type: 'separator' },
            {
                label: menu["previousDraw"][firstLanguage],
                accelerator: "Backspace",
                click() {
                    if (historiqueNum < 3) { // on vérifie qu'il existe effectivement un tirage antérieur : si non...
                        data = erreurs["erNoPrevious"][firstLanguage]
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
                label: menu["drawImages"][firstLanguage],
                accelerator: "Return",
                click() {
                    mainWindow.webContents.send("listenPlay")
                }
            }
        ]
    },
    // { role: 'viewMenu' }
    {
        label: menu["view"][firstLanguage],
        submenu: [
            {
                label: menu["resetZoom"][firstLanguage],
                role: 'resetZoom'
            },
            {
                label: menu["zoomIn"][firstLanguage],
                role: 'zoomIn'
            },
            {
                label: menu["zoomOut"][firstLanguage],
                role: 'zoomOut'
            },
            { type: 'separator' },
            {
                label: menu["togglefullscreen"][firstLanguage],
                role: 'togglefullscreen'
            }
        ]
    },
]
if (platform == "darwin") {
    const menu = Menu.buildFromTemplate(templateMenu)
    Menu.setApplicationMenu(menu)
}
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

/* console.log(app.getPath('home'))
console.log(app.getFileIcon(app.getPath('home')))
console.log(app.getPath('module'))
console.log(app.getPath('desktop'))
console.log(app.getPath('documents'))
console.log(app.getPath('downloads'))
console.log(app.getPath('music'))
console.log(app.getPath('pictures'))
console.log(app.getPath('videos'))
console.log(app.getFileIcon(app.getAppPath('home')))
 */