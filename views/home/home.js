const { ipcRenderer } = require('electron');
var isLeftMenuActive = false;

// ===================== On précharge les dossiers principaux

ipcRenderer.on('store-data', (evt, data) => {
    appendSubfolders('#mainUl', data);

})
ipcRenderer.on('version', (evt, arg) => {
    console.log(arg)
});
ipcRenderer.on('autres-disques', (evt, arg) => {
    console.log(arg);
    if (arg.length != 0) {
        $("#mainUl").append("<hr>");
        if (arg.length == 1) {
            $("#mainUl").append(
                '<li><input type="checkbox" name="choix" class="folderButton"><label for="name"><span class="up ' + arg[0][2] + '" id="' + arg[0][1] + '" onclick="getSubfolders(event)">&#x1f4c1; ' + arg[0][0] + '</span></label></li>'
            );
        } else {
            for (let elt of arg) {
                console.log(elt);
                $("#mainUl").append(
                    '<li><input type="checkbox" name="choix" class="folderButton"><label for="name"><span class="up ' + elt[2] + '" id="' + elt[1] + '" onclick="getSubfolders(event)">&#x1f4c1; ' + elt[0] + '</span></label></li>'
                );
            };
        }

    }
})

// Ouverture des sous-menus en cliquant sur les icônes de la colonne de gauche
$(".option").on("click", function () {
    for (let elt of $(".optionText")) {
        if (this.id.charAt(this.id.length - 1) !== elt.id.charAt(elt.id.length - 1)) {
            $(elt).removeClass('index');
        }
    }
    var classe = "#optionText" + this.id.charAt(this.id.length - 1);
    $(classe).toggleClass("index");
});

// Si on clique au plein milieu ça ferme aussi les menus
$("#cards").on("click", function () {
    $('.optionText').removeClass('index');
});

// ===================== Le bouton play ===================== //

$("#draw").on("click", () => {
    var checkedFolders = [];
    for (let elt of $(".folderButton:checkbox:checked")) {
        checkedFolders.push($(elt).next().children()[0].id);
    }
    var data = { "listeDossiers": checkedFolders, "nombreImages": $("#cardsNumber").val() }
    ipcRenderer.send('getDraw', data);
});
ipcRenderer.on('giveDraw', (evt, data) => {
    console.log("data", data);
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

// ===================== Le bouton back ===================== //

$("#previous").on("click", () => {
    console.log("cliqué sur le bouton back");
    ipcRenderer.send('getPreviousDraw', '');
});
ipcRenderer.on('givePreviousDraw', (evt, data) => {
    $("#compteur").attr('value', data[1]);
    if (data[1] > 1) {
        $("#previous").removeClass("backButton");
    } else {
        $("#previous").addClass("backButton");
    };
    displayImages(data[0]);
})

// ===================== Le bouton subfolders ===================== //

function getSubfolders(event) {
    if ("EXISTS", $(event.target).parent().parent().children("ul").length == 0) {
        ipcRenderer.invoke('getSubfolders', event.target.id).then((data) => {
            $(event.target).parent().parent().append("<ul></ul>");
            appendSubfolders($(event.target).parent().parent().children("ul"), data.subFolders);
        })
    } else {
        $(event.target).parent().parent().children("ul").toggleClass("invisible");
    }
};

// ===================== fonctions ================================ //

function appendSubfolders(location, liste) {
    //console.log("location",location);
    //console.log("liste",liste);
    for (let elt of liste) {
        //console.log(elt);
        $(location).append(
            '<li><input type="checkbox" name="choix" class="folderButton"><label for="name"><span class="up ' + elt[2] + '" id="' + elt[1] + '" onclick="getSubfolders(event)">&#x1f4c1; ' + elt[0] + '</span></label></li>'
        );
    };
};
//	&#128194; 

function displayImages(array) {
    $(".optionText").removeClass("index");
    $("#displayImages").html("");
    var imagesHtml = "";
    for (let elt of array) {
        imagesHtml += '<div class="image"><img src="' + elt[1] + '" id="' + elt[0] + '" class="' + elt[2] + '"></div>';
    };
    $("#displayImages").append(imagesHtml);
    imgSize(parseInt(array.length));
    $.wait = function (ms) {
        var defer = $.Deferred();
        setTimeout(function () { defer.resolve(); }, ms);
        return defer;
    };
    $.wait(100).then(function () {
        $(".image").css({
            'opacity': '1',
            'transform': 'scale(1)',
        });
    });
    $(".image").on("click", function () {
        if ($("#efface")[0].checked == true) {
            $(this).toggleClass("cache");
        } else if ($("#exergue")[0].checked == true) {
            $(this).children().toggleClass("exergue");
        } else if ($("#change")[0].checked == true) {
            //console.log($(this).children()[0].id);
            var checkedFolders = [];
            for (let elt of $(".folderButton:checkbox:checked")) {
                checkedFolders.push($(elt).next().children()[0].id);
            }
            var data = {
                "imgToChange": $(this).children()[0].id,
                "routes": checkedFolders
            }
            ipcRenderer.invoke("changeImage", data).then((data) => {
                console.log("IMPDATA", data);
                if (data["erreur"] != "") {
                    alert(data["erreur"]);
                } else {
                    $($($("#displayImages").children()[data["index"]]).children()[0]).attr("src", data["nouvelleImage"][1])
                    $($($("#displayImages").children()[data["index"]]).children()[0]).attr("id", data["nouvelleImage"][0])
                };
                $("#compteur").attr('value', data["historique"]);
                if (data["historique"] > 1) {
                    $("#previous").removeClass("backButton");
                } else {
                    $("#previous").addClass("backButton");
                };
            })
        }
    })
};

var tableSizesCol = [
    [1, "97%"],
    [2, 4, "47%"],
    [3, 5, 6, 9, "31%"],
    [7, 8, 10, 11, 12, 13, 14, 16, "22%"],
    [17, 18, 19, 20, 15, "17%"],
    [21, 22, 23, 24, "15%"]
]

var tableSizesLine = [
    [1, 2, 3, "97%"],
    [4, 5, 6, 7, 8, "47%"],
    [9, 10, 11, 12, 15, "31%"],
    [13, 14, 16, 17, 18, 19, 20, 21, 22, 23, 24, "22%"]
]

function imgSize(num) {
    $(tableSizesLine).each(function (index, value) {
        if (value.includes(num)) {
            $(".image").css("max-height", tableSizesLine[index][tableSizesLine[index].length - 1])
        }
    })
    $(tableSizesCol).each(function (index, value) {
        if (value.includes(num)) {
            $(".image").css("width", tableSizesCol[index][tableSizesCol[index].length - 1])
        }
    })
}

$("#close").on("click", () => {
    ipcRenderer.send('closeApp');
});
$("#minimize").on("click", () => {
    ipcRenderer.send('minimizeApp');
});
$("#maxRes").on("click", () => {
    ipcRenderer.send('maximizeRestoreApp');
});

function changeMaxResBtn(isMaximizedApp){
    if(isMaximizedApp){
        $("#maxRes").attr('title',"Restaurer");
        $("#maxRes").removeClass("maximize");
        $("#maxRes").addClass("restore");
    }else{
        $("#maxRes").attr("title","Agrandir");
        $("#maxRes").removeClass("restore");
        $("#maxRes").addClass("maximize");
    }
}
ipcRenderer.on("isMaximized", () => { changeMaxResBtn(true) });
ipcRenderer.on("isRestored", () => { changeMaxResBtn(false) });

$("#showHideMenus").on("click", () => {
    if(isLeftMenuActive){
        $("#monMenu").css("opacity","0");
        isLeftMenuActive = false;
    }else{
        $("#monMenu").css("opacity","1");
        isLeftMenuActive = true;
    }
})
$("#container").on("click", (e) => {
    if(e.target.id != "showHideMenus" && isLeftMenuActive){
        $("#monMenu").css("opacity","0");
        isLeftMenuActive = false;
    }
})