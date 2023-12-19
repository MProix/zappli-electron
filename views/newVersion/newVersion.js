const { ipcRenderer } = require('electron');

ipcRenderer.on('store-data', (evt, data) => {
    console.log(data);
    $("#dontShow").addClass(data.version)
    $("#message").html("<span>"+data.message+"</span><a href='"+data.url+"'>Télécharger</a>");
});

$("#dontShow").on("click", (evt) => {
    console.log($(evt.target).attr("class"))
    ipcRenderer.send("dontShow", $(evt.target).attr("class"))
});