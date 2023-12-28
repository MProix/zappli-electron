const { app, BrowserWindow, ipcMain, Menu, Notification, nativeImage } = require("electron"),
    Store = require("electron-store"),
    store = new Store()
const fs = require('fs')
const os = require("os")
const path = require("path")
const https = require('https')
const pjson = require('./package.json');
const { autoUpdater, AppUpdater } = require("electron-updater")

let localConfig = store.has("localConfig") ? store.get("localConfig") : setConfig()
const nodeDiskInfo = require('node-disk-info')
let autresDisques = []
let userStoragePath = app.getPath("userData")
console.log(userStoragePath)

const newVersion = ""

/////////////////////////////////////////////////

// basic flags

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

/////////////////
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
//////////////////////
//////////////////////
//////////////////////

//console.log(app.getPath("userData"))
// ================ variables globales stockées ================ //

checkUrl()
let mainWindow = null
let newVersionWin = null
var listOfValidExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".tiff"]
//let disquesSysteme = [['Disque C','C:'],['Disque D','D:'],['Disque F','F:']]
const userHomeDirectory = os.homedir()

if (fs.existsSync(path.join(userStoragePath, "historique"))) {
    //console.log("nettoyage")
    erraseFilesAndCopyNews(path.join(userStoragePath, "historique"))
} else {
    fs.mkdirSync(path.join(userStoragePath, "historique"))
    fs.chmodSync(path.join(userStoragePath, "historique"), 0o777)
}

var historiqueNum = 1

let dossiersRacineUtilisateur = choosePertinentFolders(fs.readdirSync(userHomeDirectory), userHomeDirectory)

// ================ NOUVELLE FENETRE D'APPLI ================ //

function createWindow(windowPath, winWidth = 1200, winHeight = 800) {
    console.log(winWidth, winHeight)
    let win = new BrowserWindow({
        width: winWidth,
        height: winHeight,
        "node-integration": "iframe",
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            "web-security": false
        }
    })

    win.loadFile(windowPath)

    win.on('closed', () => {
        win = null
    })
    return win
}

app.whenReady().then(() => {
    mainWindow = createWindow("views/home/home.html")
    mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.send('store-data', dossiersRacineUtilisateur)
        console.log("autresdisques", autresDisques)
        mainWindow.send('autres-disques', autresDisques)
        mainWindow.send('version', app.getVersion())
    })
    autoUpdater.checkForUpdates()
})
/////////////// setting auto-updater 

/* new update available */
autoUpdater.on("update-available", (info) => {
    console.log("il y a une nouvelle version")
    newVersion = "Nouvelle version disponible"
})


// ================= NOTIFICATION DE BUREAU (inutile pour le moment) ======================= //

function showDesktopNotification(title, body, imgPath, textButton) {
    const notification = new Notification({
        title: title,
        body: body,
        icon: nativeImage.createFromPath(imgPath),
        closeButtonText: textButton
    })
    notification.show()
}

// =============== ROUTE BOUTON PLAY ===================

ipcMain.on('getDraw', (evt, arg) => {
    var listeOfImages = choosePertinentFiles(arg["listeDossiers"])
    var data = shuffleFolder(listeOfImages, arg["nombreImages"])
    //on crée un fichier d'historique
    fs.writeFileSync(path.join(userStoragePath, "historique", "historique" + data[3] + ".json"), JSON.stringify(data[0]))
    evt.sender.send('giveDraw', data)
})

// =============== ROUTE BOUTON PREVIOUS ===============

ipcMain.on('getPreviousDraw', (evt, arg) => {
    historiqueNum = historiqueNum - 2
    //console.log(historiqueNum)
    data = JSON.parse(fs.readFileSync(path.join(userStoragePath, "historique", "historique" + historiqueNum + ".json")))
    historiqueNum += 1
    evt.sender.send('givePreviousDraw', [data, historiqueNum - 1])
})

// =============== ROUTE SUBFOLDERS ====================

ipcMain.handle('getSubfolders', async (evt, arg) => {
    var data = {
        "subFolders": choosePertinentFolders(fs.readdirSync(arg), arg),
        "parentPath": arg
    }
    return data
})

// =============== ROUTE FOLDERS =======================

ipcMain.on('getFolder', (evt, arg) => {
    var d = require('diskinfo')
    d.getDrives(function (err, aDrives) {
        var disks = []
        for (var i = 0; i < aDrives.length; i++) {
            disks.push(aDrives[i].mounted);
        }
        evt.sender.send('giveFolders', disks)
    });
})

// =============== ROUTE CHANGE IMAGE ==================

ipcMain.handle('changeImage', async (evt, arg) => {
    //console.log("image à changer : ",arg["imgToChange"])
    var erreur = ""
    historiqueNum = historiqueNum - 1
    //console.log("historique :",historiqueNum)
    var histList = JSON.parse(fs.readFileSync(path.join(userStoragePath, "historique", "historique" + historiqueNum + ".json"), "utf-8"))
    var listComp = []
    for (let elt of histList) {
        listComp.push(elt[0])
    }
    //console.log("tirage précédent : ", histList)
    var newImage = shuffleFolder(choosePertinentFiles(arg["routes"], 1))[0][0]
    var index = 0
    //console.log("histList : ", histList)
    //console.log("arg",arg)
    //console.log("Imgtochange",arg["imgToChange"])
    //console.log("index",index)
    while (histList[index][0] != arg["imgToChange"]) {
        index += 1
    }
    if (choosePertinentFiles(arg["routes"]).length == histList.length) {
        erreur = "Toutes les images de ce(s) dossier(s) sont déjà affichées"
    } else {
        while (listComp.includes(newImage[0])) {
            historiqueNum -= 1
            newImage = shuffleFolder(choosePertinentFiles(arg["routes"], 1))[0][0]
        }
    }
    histList[index] = newImage
    //console.log("NouvelleImage : ",newImage)
    //console.log("Erreur : ",erreur)
    //console.log("On en est là dans l'historique : ", historiqueNum)
    fs.writeFileSync(path.join(userStoragePath, "historique", "historique" + historiqueNum + ".json"), JSON.stringify(histList))
    historiqueNum += 1
    return { "nouvelleImage": newImage, "erreur": erreur, "index": index, "historique": historiqueNum - 1 }
})

// =============== FONCTIONS ============================
function choosePertinentFolders(folderList, basePath) {
    var finalFoldersList = []
    for (let elt of folderList) {
        if (elt[0] !== '.' && fs.lstatSync(path.join(basePath, elt)).isDirectory()) {
            var classes = checkImagesAndEmpty(basePath, elt)
            //console.log(elt,classes)
            finalFoldersList.push([elt, path.join(basePath, elt), classes])
        }
    }
    return finalFoldersList
}

function checkImagesAndEmpty(base, elt) {
    var classesToAdd = { "empty": true, "images": false, "folders": false }
    for (let element of fs.readdirSync(path.join(base, elt))) {
        //console.log("chemin complet : ",(path.join(base, elt, element)))
        if (fs.lstatSync(path.join(base, elt, element)).isDirectory()) {
            //console.log("directory")
            classesToAdd["folders"] = true
            classesToAdd["empty"] = false
        }
        if (listOfValidExtensions.includes(path.extname(path.join(elt, element)))) {
            //console.log("image")
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
    //console.log("paths : ",listeOfPaths)
    var listeImages = []
    for (let onePath of listeOfPaths) {
        for (let elt of fs.readdirSync(onePath)) {
            if (listOfValidExtensions.includes(path.extname(path.join(onePath, elt)))) {
                listeImages.push([elt, path.join(onePath, elt)])
            }
        }
    }
    //console.log("LISTEIMAGES",listeImages)
    return listeImages
}

function shuffleFolder(listeImages, num) {
    //console.log("NOMBRE DIMAGES A CHARGER : ",num)
    //console.log("LISTE : ")
    //console.log(listeImages)
    var error = ""
    var shuffleImgToLoad = listeImages.sort((a, b) => 0.5 - Math.random());
    var listeImagesChoisies = shuffleImgToLoad.slice(0, num)
    if (listeImagesChoisies == 0) {
        error = "Sélectionnez d'abord un dossier contenant des images (couleur verte) en cochant la case devant son nom."
    }
    else if (0 < listeImagesChoisies.length && listeImagesChoisies.length < num) {
        // console.log("pas assez d'images")
        error = "Ce dossier ne contient que " + listeImagesChoisies.length + " image(s) !"
    } else {
        var max = listeImages.length
        //on incrémente les noms de fichiers de l'historique
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

function checkUrl() {
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
}

function setConfig() {
    //console.log("pas de config")
    store.set("localConfig", {
        "version": pjson.version,
        "URL": "https://www.proix.eu/zapplis/superzappli.json"
    })
}

function checkNewInfo() {
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
}
////////////// config menu /////////////////

const templateMenu = [
    {
        label: 'Action',
        submenu: [
            {
                label: 'Choisir dossier',
                accelerator: "CommandOrControl+F",
                click() {
                    for (let elt of document.getElementsByClassName("optionText")) {
                        elt.classList.remove("index")
                    }
                    document.getElementById("optionText2").classList.add("index")
                    //$(".optionText").removeClass("index")
                    //$("#optionText2").toggleClass("index")
                }
            },
            {
                label: "Choisir nombre d'images",
                accelerator: "CommandOrControl+N",
                click() {
                    $(".optionText").removeClass("index")
                    $("#optionText1").toggleClass("index")
                }
            },
            {
                label: "Choisir action au clic",
                accelerator: "CommandOrControl+A",
                click() {
                    $(".optionText").removeClass("index")
                    $("#optionText3").toggleClass("index")
                }
            },
            {
                label: "Revenir au tirage précédent",
                accelerator: "Backspace",
                click() {
                    //console.log("cliqué sur le bouton back");
                    ipcRenderer.send('getPreviousDraw', '');
                    ipcRenderer.on('givePreviousDraw', (evt, data) => {
                        $("#compteur").attr('value', data[1]);
                        if (data[1] > 1) {
                            $("#previous").removeClass("backButton");
                        } else {
                            $("#previous").addClass("backButton");
                        };
                        displayImages(data[0]);
                    })
                }
            },
            {
                label: "Tirer des cartes",
                accelerator: "Return",
                click() {
                    var checkedFolders = [];
                    for (let elt of $(".folderButton:checkbox:checked")) {
                        checkedFolders.push($(elt).next().children()[0].id);
                    }
                    var data = { "listeDossiers": checkedFolders, "nombreImages": $("#cardsNumber").val() }
                    ipcRenderer.send('getDraw', data);
                    ipcRenderer.on('giveDraw', (evt, data) => {
                        //console.log("data", data);
                        if (data[1] !== "") {
                            alert(data[1])
                        } else {
                            displayImages(data[0])
                        }
                        $("#compteur").attr('value', data[3]);
                        if (data[3] > 1) {
                            $("#previous").removeClass("backButton");
                        } else {
                            $("#previous").addClass("backButton");
                        };
                    });
                }
            }
        ]
    }
]

//const menu = Menu.buildFromTemplate(templateMenu)
//Menu.setApplicationMenu(menu)


///////////////////////////////// ROUTES ET FONCTIONS DE LA PAGE NEWVERSION /////////////////////////////////////////////

ipcMain.on('dontShow', (evt, arg) => {
    //console.log("arg", arg)
    store.set("dontShowVersion", arg)
    newVersionWin.close()
})
ipcMain.on('plusTard', (evt, arg) => {
    newVersionWin.close()
})