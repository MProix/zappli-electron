const { ipcRenderer } = require('electron');

ipcRenderer.on('store-data', (evt, data) => {
    console.log(data);
    $("#message").html("<span>"+data.message+"</span><a href='"+data.url+"'>Télécharger</a><img src='"+data.img+"'>");
})