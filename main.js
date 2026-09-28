const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require("electron"), // import des modules d'electron
    Store = require("electron-store"), // module de stockage persistant (un fichier JSON dans le dossier utilisateur)
    store = new Store() // on crée la base de données qui collectera les infos pour les notifications
const fs = require('fs') // lecture/écriture de fichiers sur le disque
const path = require("path") // fabrication de chemins valides quel que soit l'OS
const https = require("https") // requêtes web (récupération de la page des ressources)
//const xlsx = require('node-xlsx');
const XLSX = require('xlsx') // lecture des tableurs .xlsx/.ods/.csv
//const { parse } = require("csv-parse");
const { autoUpdater } = require("electron-updater") // mise à jour automatique de l'appli
const menu = JSON.parse(fs.readFileSync(path.join(__dirname, "menu.json"), "utf-8")) // on récupère le JSON du fichier de menu
const pjson = require('./package.json'); // pour incrire dans la base de données store
const log = require("electron-log") // on initialise le système de log d'electron pour pouvoir débuguer à distance chez l'utilisateur
const openAboutWindow = require('about-window').default; // fenêtre "À propos" toute faite
//var csvList = {} // on génère une liste vide en cas d'import de csv
let mainWindow = null //on stocke la variable de fenêtre
let faq = null // fenêtre d'aide
let userStoragePath = app.getPath("userData") // dossier de l'utilisateur où l'on écrit logs, listes et config
let mainDir = (__dirname) // dossier d'installation de l'appli, transmis aux vues pour retrouver leurs fichiers
var platform = process.platform // pour savoir sous quel OS on tourne
//var listOfValidListsOfWordsExtensions = [".numbers", ".xlsx", ".xsl", ".ods", ".csv"] // on stocke les extensions valides pour l'affichage de listes de mots

// ================ GESTION DE LA LANGUE D'AFFICHAGE ================ //

// on récupère la langue d'affichage principale du système
var locales = app.getPreferredSystemLanguages() // on récupère la langue d'affichage du système
var firstLanguage = "fr" // on passe le français en variable par défaut au cas ou la langue système ne serait pas reconnue
if (Array.isArray(locales) && locales.length > 0 && menu["listeLangues"].includes(locales[0].slice(0, 2))) { // la langue système existe et l'appli la connaît ("fr-FR" → "fr")
    firstLanguage = locales[0].slice(0, 2) // on adopte cette langue par défaut
}
//on remet dans un format lisible par défaut et on change le fr par la langue du système utilisateur
log.info("firstLanguage :", firstLanguage) // trace utile pour comprendre un affichage inattendu chez l'utilisateur
// on vérifie s'il existe une config locale
if (!store.has("localConfig")) { // s'il n'y en a pas on la crée
    setConfig() // écriture de la config par défaut (version, URL, langue)
    var localConfig = store.get("localConfig") // et on la récupère en variable
} else {
    var localConfig = store.get("localConfig") // et on la récupère en variable
}
if (localConfig["langue"] == undefined || !menu["listeLangues"].includes(localConfig["langue"])) { // s'il n'y a pas de langue enregistrée ou si elle diffère de celles que l'appli connaît
    setConfig() // on réécrit la config avec la langue système
    var showLanguage = firstLanguage // et c'est elle qui sera affichée
} else {
    var showLanguage = localConfig["langue"] // on aligne avec la langue qui va s'afficher
}
log.info("%cLe language utilisé est " + showLanguage, "color:green") // trace de la langue retenue
// ================ ON GÈRE LES LOGS ================ //
log.transports.file.resolvePathFn = () => path.join(userStoragePath, 'main.log') // on crée le fichier de log
log.info("%c////// Zappli version " + app.getVersion() + " ouverte //////", "color:red") // marqueur de début de session dans le log
log.errorHandler.startCatching() // toute erreur non interceptée part aussi dans le log

// ================ ON GÈRE L'UPDATE AUTOMATIQUE DES VERSIONS ================ //
/* new update available */
autoUpdater.on("update-not-available", (info) => { // l'appli est déjà à jour
    log.info("%cpas de nouvelle version", "color:blue")
    log.info("%c" + info, "color:blue")
})
autoUpdater.on("update-available", (info) => { // une version plus récente est publiée
    log.info("%cil y a une nouvelle version", "color:blue")
    const dialogOpts = { // première boîte de dialogue : proposer le téléchargement
        type: 'info',
        buttons: ['Télécharger (redémarrage optionnel)', 'Ne pas télécharger'],
        title: 'Mise à jour de la zappli',
        detail:
            "Une nouvelle version est disponible. Vous pouvez la télécharger maintenant sans que la zappli redémarre. Les modifications auront lieu au prochain démarrage"
    }
    dialog.showMessageBox(dialogOpts).then((returnValue) => { // réponse de l'utilisateur
        if (returnValue.response === 0) { // bouton "Télécharger"
            autoUpdater.on("update-downloaded", () => { // une fois le téléchargement terminé
                const dialogOpts = { // seconde boîte : proposer le redémarrage
                    type: 'info',
                    buttons: ['Redémarrer', 'Plus tard'],
                    title: 'Mise à jour de la zappli',
                    detail:
                        "Une nouvelle version a été téléchargée. Redémarrez l'application pour appliquer les mises à jour."
                }
                log.info(returnValue.response)
                dialog.showMessageBox(dialogOpts).then((returnValue) => { // réponse de l'utilisateur
                    if (returnValue.response === 0) autoUpdater.quitAndInstall() // bouton "Redémarrer" : on installe tout de suite
                })
            })
        }
    })
})
autoUpdater.on("checking-for-update", (info) => { // vérification en cours
    log.info("%cchecking for updates", "color:blue")
    log.info("%c" + info, "color:blue")
})
autoUpdater.on("error", (info) => { // échec de la vérification ou du téléchargement (souvent : pas de réseau)
    log.info("%cerror when updating", "color:blue")
    log.warn("%c" + info, "color:blue")
})
autoUpdater.on("before-quit-for-update", () => { // juste avant la fermeture pour installer
    setTimeout(6000) // petit délai pour laisser l'appli se terminer proprement
})

// ================ NOUVELLE FENETRE D'APPLI ================ //

function createWindow(windowPath, winWidth = 1200, winHeight = 800) { // fabrique une fenêtre à partir d'un fichier HTML
    let win = new BrowserWindow({
        width: winWidth, // largeur d'ouverture
        height: winHeight, // hauteur d'ouverture
        "node-integration": "iframe",
        webPreferences: {
            nodeIntegration: true, // les vues peuvent utiliser require() (elles lisent le disque directement)
            contextIsolation: false, // pas d'isolation : les vues partagent le contexte Node
            "web-security": false, // nécessaire pour afficher des images par chemin disque
            devTools: true // disabling devtools for distrib version
        },
        titleBarStyle: 'hidden' // barre de titre native masquée : elle est dessinée par la vue
    })

    win.loadFile(windowPath) // on charge la vue demandée

    win.on('closed', () => { // à la fermeture
        win = null // on libère la référence
    })
    return win // la fenêtre est renvoyée à l'appelant, qui la stocke
}

// ================ INITIALISATION DE LA FENÊTRE PRINCIPALE ================ //
log.info("langue utilisée :" + showLanguage)
log.info(("on ouvre : views/home/home_" + showLanguage + ".html"))

app.whenReady().then(() => { // electron est prêt : on peut créer des fenêtres
    mainWindow = createWindow("views/home/home_" + showLanguage + ".html") // vue principale dans la langue retenue
    mainWindow.webContents.once('did-finish-load', () => { // la vue est chargée : on peut lui envoyer ses données
        // on vérifie s'il existe un dossier de listes
        if (fs.existsSync(path.join(userStoragePath, "listes.json"))) { // le fichier des listes enregistrées existe
            if (fs.readFileSync(path.join(userStoragePath, "listes.json"), encoding = 'utf-8') != "") { // et il n'est pas vide
                mainWindow.send('listes', [JSON.parse(fs.readFileSync(path.join(userStoragePath, "listes.json"), encoding = 'utf-8')), mainDir]) // on envoie son contenu à la vue
            } else {
                mainWindow.send('listes', ["", mainDir]) // fichier vide : aucune liste à transmettre
            }
        } else {
            fs.openSync(path.join(userStoragePath, "listes.json"), 'w') // première ouverture : on crée le fichier
            mainWindow.send('listes', ["", mainDir]) // et on annonce qu'il n'y a pas de liste
        }
        mainWindow.send('mainDir', mainDir) // dossier de l'appli (chemins d'images internes)
        mainWindow.send('OS', process.platform) // l'OS conditionne l'affichage des boutons de fenêtre
        mainWindow.send("storage", userStoragePath) // dossier utilisateur (fond de plateau, listes)
        envoyerRessources() // première vérification des ressources compatibles
        setInterval(envoyerRessources, 6 * 60 * 60 * 1000) // une publication en cours de journée finit par être signalée
    })
    log.info
    autoUpdater.checkForUpdatesAndNotify() // recherche d'une nouvelle version au démarrage
})
// =============== RESSOURCES COMPATIBLES (NOTIFICATIONS) ===============

const urlRessources = "https://leszexpertsfle.com/zappli/zappli-ressources-fle/" // page boutique listant les ressources compatibles

function getNotifs() { // les préférences de notification vivent à part de localConfig, que setConfig() réécrit entièrement
    var notifs = store.get("notifs") // état enregistré au dernier lancement
    if (notifs == undefined) { notifs = {} } // premier lancement : on part d'un objet vide
    if (!Array.isArray(notifs["vues"])) { notifs["vues"] = [] } // URL des ressources déjà vues par l'utilisateur
    if (!Array.isArray(notifs["cache"])) { notifs["cache"] = [] } // dernière liste récupérée, réutilisée hors ligne
    if (typeof notifs["desactive"] != "boolean") { notifs["desactive"] = false } // case "ne plus m'avertir"
    if (typeof notifs["dejaOuvert"] != "boolean") { notifs["dejaOuvert"] = false } // le popup a-t-il déjà été ouvert une fois
    return notifs // objet complet, toujours exploitable
}

function recupererPage(url, redirections = 3) { // petit GET maison pour ne pas ajouter de dépendance
    return new Promise((resolve, reject) => { // on emballe la requête pour pouvoir l'attendre avec await
        var requete = https.get(url, { headers: { "User-Agent": "zappli/" + app.getVersion() } }, (reponse) => { // on s'identifie auprès du serveur
            if (reponse.statusCode >= 300 && reponse.statusCode < 400 && reponse.headers.location && redirections > 0) { // redirection à suivre
                reponse.resume() // on vide la réponse pour libérer la connexion
                return resolve(recupererPage(new URL(reponse.headers.location, url).href, redirections - 1)) // on rappelle la fonction sur la nouvelle adresse
            }
            if (reponse.statusCode != 200) { // toute autre réponse que "OK" est un échec
                reponse.resume()
                return reject(new Error("statut " + reponse.statusCode))
            }
            var contenu = "" // on accumule le HTML reçu
            reponse.setEncoding("utf-8") // pour ne pas casser les accents
            reponse.on("data", (morceau) => { contenu += morceau }) // la réponse arrive par morceaux
            reponse.on("end", () => resolve(contenu)) // page complète
        })
        requete.setTimeout(15000, () => { requete.destroy(new Error("délai dépassé")) }) // un serveur muet ne doit pas bloquer l'appli
        requete.on("error", reject) // pas de réseau, DNS en erreur, etc.
    })
}

function decoderHtml(texte) { // les titres de la page contiennent des entités HTML (&#039;, &amp;…)
    return texte
        .replace(/&#(\d+);/g, (correspondance, code) => String.fromCharCode(parseInt(code, 10))) // entités décimales
        .replace(/&#x([0-9a-f]+);/gi, (correspondance, code) => String.fromCharCode(parseInt(code, 16))) // entités hexadécimales
        .replace(/&nbsp;/g, " ") // espace insécable
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&") // en dernier, sinon on redécoderait les entités produites au-dessus
        .trim() // on retire les espaces autour
}

function extraireRessources(html) { // la page est une grille WooCommerce : un <li> par ressource
    var ressources = [] // résultat : une liste d'objets {url, titre, image}
    for (let produit of html.match(/<li class="[^"]*\bproduct\b[^"]*"[^>]*>[\s\S]*?<\/li>/g) || []) { // chaque bloc produit ; [] si la page a changé de structure
        var lien = produit.match(/<a href="([^"]+)"/) // premier lien du bloc : la fiche produit
        var titre = produit.match(/<h2 class="woocommerce-loop-product__title">([\s\S]*?)<\/h2>/) // titre affiché
        var image = produit.match(/<img[^>]+src="([^"]+)"/) // visuel du produit
        if (lien == null || titre == null) { continue } // bloc inexploitable : on l'ignore
        ressources.push({
            "url": decoderHtml(lien[1]), // adresse de la fiche
            "titre": decoderHtml(titre[1].replace(/<[^>]+>/g, "")), // titre nettoyé de ses balises
            "image": image == null ? "" : decoderHtml(image[1]) // l'image est facultative
        })
    }
    return ressources // dans l'ordre de la page
}

async function envoyerRessources() { // récupère la page puis informe la vue de l'état des nouveautés
    var notifs = getNotifs() // préférences et cache
    var ressources = notifs["cache"] // par défaut : le dernier contenu connu
    try {
        var trouvees = extraireRessources(await recupererPage(urlRessources)) // téléchargement + extraction
        if (trouvees.length > 0) { // extraction réussie
            ressources = trouvees // on travaille sur la liste fraîche
            notifs["cache"] = trouvees // et on la garde pour les prochains lancements hors ligne
            store.set("notifs", notifs) // écriture sur le disque
        }
    } catch (erreur) {
        log.warn("ressources compatibles non récupérées : " + erreur) // hors ligne : on retombe sur le dernier contenu connu
    }
    var nouveautes = notifs["dejaOuvert"]
        ? ressources.filter((ressource) => !notifs["vues"].includes(ressource["url"])) // ressources jamais vues par cet utilisateur
        : ressources // tant que l'utilisateur n'a jamais ouvert le popup, tout est nouveau pour lui
    if (mainWindow != null && !mainWindow.isDestroyed()) { // la fenêtre peut avoir été fermée entre deux vérifications
        mainWindow.send("ressources", {
            "url": urlRessources, // lien "voir toutes les ressources"
            "ressources": ressources, // toute la page, dans l'ordre (rubrique "À la une")
            "nouveautes": nouveautes, // sous-ensemble non vu (rubrique "Nouveautés")
            "dejaOuvert": notifs["dejaOuvert"], // conditionne l'aperçu au survol
            "desactive": notifs["desactive"], // case "ne plus m'avertir"
            "exergue": !notifs["desactive"] && nouveautes.length > 0 // faut-il faire clignoter le bouton
        })
    }
}

ipcMain.on("ressourcesVues", (evt, arg) => { // l'utilisateur a ouvert le popup : plus rien n'est "nouveau" jusqu'à la prochaine publication
    var notifs = getNotifs()
    notifs["dejaOuvert"] = true // le premier clignotement n'a plus lieu d'être
    notifs["vues"] = notifs["cache"].map((ressource) => ressource["url"]) // tout ce qui est affiché est considéré comme vu
    if (typeof arg == "boolean") { notifs["desactive"] = arg } // état de la case à cocher envoyé par la vue
    store.set("notifs", notifs) // on enregistre
})

ipcMain.on("ouvrirLien", (evt, arg) => { // clic sur une ressource : ouverture dans le navigateur, pas dans l'appli
    if (typeof arg == "string" && arg.startsWith("https://")) { shell.openExternal(arg) } // on n'ouvre que des adresses web sûres
})

// =============== ROUTE POUR RECUPERER LES MOTS ===============
ipcMain.handle('getWords', async (evt, arg) => { // la vue demande le contenu d'un tableur
    //console.log(arg)
    return getWordsFromCalcFile(arg[0]) // arg[0] = chemin du fichier
})
// =============== ROUTES AIDE ===============

ipcMain.on("help", (evt, arg) => { // clic sur le bouton d'aide
    if (faq != null && !faq.isDestroyed()) { // une seule fenêtre d'aide : on remet au premier plan celle qui est déjà ouverte
        if (faq.isMinimized()) { faq.restore() } // elle était réduite dans la barre des tâches
        faq.focus() // on la remet devant
        return // et surtout on n'en ouvre pas une seconde
    }
    faq = createWindow("views/FAQ/faq_" + showLanguage + ".html", winWidth = 600, winHeight = 500) // FAQ dans la langue de l'appli
    faq.webContents.once('did-finish-load', () => { // une fois la FAQ chargée
        faq.send('OS', process.platform) // elle a besoin de l'OS pour ses boutons de fenêtre
    })
})

// ================ ROUTES DES BOUTONS ================ //

ipcMain.handle('tirage', async (evt, arg) => { // bouton "jouer" : tirage complet d'une zone
    // deux possibiltés : des images, des mots
    if (arg["typeDeTirage"] == "images") {
        var cartes = tirerDesImages(arg["nombreDeCartes"], arg["listeImagesOuMots"]) // tirage dans les fichiers images
        return ["cartes", cartes] // la vue distingue les cartes-images des cartes-mots
    } else {
        //console.log(arg)
        var mots = tirerDesMots(arg["nombreDeCartes"], arg["listeMots"]) // tirage dans la liste de mots
        if(mots["erreur"] == "erPlusieursListes"){ // le tableur contient plusieurs colonnes
            return ["mots", mots]
        } else if(mots["erreur"] == "erTooBig"){ // moins de mots que de cartes demandées
            return ["mots", mots]
        } else {
            return ["mots", mots[0], mots[1]] // mots tirés + liste complète (pour le "+1" et la non-répétition)
        }        
    }
})
ipcMain.handle('addOne', async (evt, arg) => { // bouton "+1" : une carte de plus dans la zone
    // deux possibiltés : des images, des mots
    //console.log(arg)

    // on ne compare pas les longueurs : la non-répétition retire déjà les cartes tirées de la liste
    if (arg["typeDeTirage"] == "images") {
        var candidats = arg["listeImagesOuMots"].filter((elt) => !arg["listeAffichee"].includes(elt)) // on écarte ce qui est déjà à l'écran
        if (candidats.length == 0) { // tout est déjà affiché
            return { "erreur": "erAllImages" }
        }
        return [candidats[Math.floor(Math.random() * candidats.length)], "images"] // une image au hasard parmi les candidates
    } else {
        var candidats = arg["listeImagesOuMots"].filter((elt) => !arg["listeAffichee"].includes(elt[0])) // idem pour les mots (elt[0] : le mot dans sa ligne)
        if (candidats.length == 0) {
            return { "erreur": "erAllWords" }
        }
        return [candidats[Math.floor(Math.random() * candidats.length)], "mots"] // un mot au hasard
    }
})
ipcMain.handle('changeImage', async (evt, arg) => { // outil "changer" : on remplace une carte précise
    //console.log(arg)
    // deux possibiltés : des images, des mots
    if (arg["typeDeTirage"] == "images") {
        var candidats = arg["listeImagesOuMots"].filter((elt) => !arg["srcImagesAffichees"].includes(elt)) // on ne remet pas une carte déjà à l'écran
        if (candidats.length == 0) {
            return { "error": "erAllImages" }
        }
        return getRandomValues(candidats, 1) // une seule carte de remplacement
    } else {
        var words = getWordsFromCalcFile(arg["listeImagesOuMots"][0]) // on relit le tableur d'origine
        var candidats = words.filter((elt) => !arg["listeMotsAffiches"].includes(elt[0])) // sans les mots déjà affichés
        if (candidats.length == 0) {
            return { "error": "erAllWords" }
        }
        return getRandomValues(candidats, 1) // un seul mot de remplacement
    }
})

// ================ FONCTIONS DU PROGRAMME ================ //

function tirerDesImages(nbCartes, liste) { // tirage d'images avec contrôle du nombre disponible
    if (liste.length < nbCartes) { // pas assez d'images dans le dossier
        console.log("Il n'y a que " + liste.length + " image(s) dans cette liste.")
        return { "erreur": "erTooBig", "nb": liste.length } // la vue affiche le message correspondant
    } else {
        return getRandomValues(liste, nbCartes) // tirage aléatoire sans répétition
    }
}
function tirerDesMots(nbCartes, liste) { // même logique pour les mots
    console.log(liste.length)
    console.log(liste)
    if (liste.length < nbCartes) { // pas assez de mots
        console.log("Il n'y a que " + liste.length + " mot(s) dans cette liste.")
        return { "erreur": "erTooBig", "nb": liste.length }
    } else {
        //console.log("assez de cartes")
        return [getRandomValues(liste, nbCartes),liste] // mots tirés + liste complète conservée par la vue
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
function getWordsFromCalcFile(calcFilePath) { // lit un tableur et en sort une (ou plusieurs) listes de mots
    //console.log("tatatatat")
    //console.log(calcFilePath)
    if (calcFilePath.includes('.csv')) { // un CSV se lit comme du texte
        var buffer = fs.readFileSync(calcFilePath, { encoding: "utf-8" }); // lecture en UTF-8 pour garder les accents
        var workbook = XLSX.read(buffer, { type: "string" });
    } else {
        var workbook = XLSX.readFile(calcFilePath, { type: "string" }); // .xlsx/.ods : lecture binaire par SheetJS
    }
    var result = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "" }) // première feuille, en tableau de lignes
    var newResult = [] // lignes nettoyées
    var max = 0 // nombre de colonnes réellement remplies
    for (let elt of result) { // pour chaque ligne du tableur
        var row = [] // ligne sans les cellules vides
        for (let e of elt) { // pour chaque cellule
            if (e != "") { // on ignore les cellules vides
                row.push(e)
            }
        }
        if (row.length > max) { max = row.length } // on retient la ligne la plus large
        newResult.push(row)
    }
    //console.log("newresult",newResult)
    if (max == 1) { // une seule colonne : une seule liste de mots
        return newResult
    } else {
        var lastResult = [] // plusieurs colonnes : une liste par colonne
        i = 0
        while (i < max) { // on prépare une liste vide par colonne
            lastResult.push([])
            i++
        }
        //console.log(lastResult)
        for (let elt of newResult) { // on répartit chaque ligne dans les colonnes
            i = 0
            while (i < max) {
                if (elt[i]) { // la cellule existe
                    lastResult[i].push(elt[i])
                }
                i++
            }
        }
        //console.log("lastResult",lastResult)
        return lastResult // la vue proposera de choisir la colonne
    }
}
function sleep(ms) { // pause utilisable avec await
    return new Promise(resolve => setTimeout(resolve, ms));
}
function getRandomValues(liste, nbCartes) { // tire nbCartes éléments distincts au hasard
    var max = liste.length // taille du paquet disponible
    if (max >= nbCartes) { // on vérifie qu'il y a assez de mots dans la liste par rapport au nombre demandé
        var shuffleList = liste.slice().sort((a, b) => 0.5 - Math.random()); // on ne mélange pas la liste d'origine
        var listeItems = shuffleList.slice(0, nbCartes) // on prend les premiers du paquet mélangé
        return [listeItems, max] // cartes tirées + taille du paquet (affichée par la vue)
    } else {
        return { "erreur": "erTooBig2", "nb": max } // paquet trop petit
    }
}
function changeLanguage(lang) { // changement de langue depuis le menu
    //contents.reloadIgnoringCache()
    firstLanguage = lang // nouvelle langue à enregistrer
    setConfig() // écriture dans la config locale
    app.relaunch() // l'appli se relance...
    app.exit() // ...après s'être fermée : la vue est rechargée dans la bonne langue
}
function setConfig() { // (ré)écrit la configuration locale de l'utilisateur
    //console.log(firstLanguage)
    store.set("localConfig", {
        "version": pjson.version, // version de l'appli au moment de l'écriture
        "URL": "https://www.proix.eu/zapplis/superzappli.json",
        "langue": firstLanguage // langue retenue
    })
}

// ================ GESTION DU MENU NATIF ================ //
const isMac = platform === 'darwin' // macOS a un menu applicatif, pas Windows ni Linux
const templateMenu = [ // description du menu, construite dans la langue de l'appli
    // { role: 'appMenu' }
    ...(isMac
        ? [{ // menu "zappli" de macOS
            label: app.name,
            submenu: [
                {
                    label: menu["about"][showLanguage], // "À propos"
                    click() {
                        openAboutWindow( // fenêtre d'informations sur l'appli
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
                    role: 'services' // entrée standard de macOS
                },
                { type: 'separator' },
                {
                    label: menu["hide"][showLanguage],
                    role: 'hide' // masquer l'appli
                },
                {
                    label: menu["hideOthers"][showLanguage],
                    role: 'hideOthers' // masquer les autres applis
                },
                {
                    label: menu["unhide"][showLanguage],
                    role: 'unhide' // tout réafficher
                },
                { type: 'separator' },
                {
                    label: menu["quit"][showLanguage],
                    role: 'quit' // quitter
                }
            ]
        }]
        : [ // hors macOS : un menu réduit, ouvert par le bouton de la barre de titre
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
        label: menu["file"][showLanguage], // menu "Fichier"
        submenu: [
            isMac ? { // sur macOS on ferme la fenêtre, ailleurs on quitte l'appli
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
        label: menu["action"][showLanguage], // menu "Actions"
        submenu: [
            { role: 'toggleDevTools' }, // outils de développement (diagnostic à distance)
            {
                label: menu["changeLanguage"][showLanguage], // sous-menu de langue
                submenu: [
                    {
                        label: "English",
                        click() {
                            changeLanguage("en") // bascule en anglais et relance
                        }
                    },
                    {
                        label: "Français",
                        click() {
                            changeLanguage("fr") // bascule en français et relance
                        }
                    },
                ]
            }
        ]
    },
    // { role: 'viewMenu' }
    {
        label: menu["view"][showLanguage], // menu "Affichage"
        submenu: [
            {
                label: menu["resetZoom"][showLanguage],
                role: 'resetZoom' // zoom de la fenêtre à 100 %
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
                role: 'togglefullscreen' // plein écran
            }
        ]
    },
]
if (platform == "darwin") { // seul macOS affiche ce menu en permanence
    const menu = Menu.buildFromTemplate(templateMenu)
    Menu.setApplicationMenu(menu)
}
// pour ouvrir le menu sous windows
ipcMain.on('fireMenu', (evt, arg) => { // clic sur le bouton "menu" de la barre de titre maison
    const menu = Menu.buildFromTemplate(templateMenu);
    menu.popup(); // le menu s'ouvre à l'emplacement du curseur
})
// =============== ROUTES BOUTONS CLOSE MINIMIZE AND MAXIMIZE POUR WINDOWS ===============

// la fenêtre visée est toujours celle qui a envoyé le message, quelle que soit la vue
for (const suffixe of ["App", "Faq", "Listes"]) { // les trois vues ont les mêmes boutons de fenêtre
    ipcMain.on("close" + suffixe, (evt) => { // bouton fermer
        const win = BrowserWindow.fromWebContents(evt.sender) // fenêtre émettrice
        if (win) { win.close() }
    })
    ipcMain.on("minimize" + suffixe, (evt) => { // bouton réduire
        const win = BrowserWindow.fromWebContents(evt.sender)
        if (win) { win.minimize() }
    })
    ipcMain.on("maximizeRestore" + suffixe, (evt) => { // bouton agrandir/restaurer
        const win = BrowserWindow.fromWebContents(evt.sender)
        if (!win) { return } // la fenêtre a pu être fermée entre-temps
        if (win.isMaximized()) { // elle est agrandie : on restaure
            win.unmaximize()
            win.webContents.send("isRestored") // la vue remet l'icône correspondante
        } else {
            win.maximize() // sinon on agrandit
            win.webContents.send("isMaximized") // et la vue change d'icône
        }
    })
}
process.on('uncaughtException', function (err) { // dernier filet : une erreur non gérée est tracée au lieu de tuer l'appli silencieusement
    if (err) {
        log.error("caughtException : " + err.stack);
    }
});
