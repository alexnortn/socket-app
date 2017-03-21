// Client Side
const $ = require('jquery');
const io = require('socket.io-client');
const NearestVertex = require('./initNearestVertex.js');

let socket = io.connect();

let matrixColumns;
let matrixRows;

let connsList;
let obuff;
let cbuff;
let vbuff;

let index = 0;

matrixColumns = 1024;
matrixRows    = 1024;

// TEST CASES
// -------------------------------------------------------------------------
// let buffer = new Float32Array(10);
//     buffer.fill(666);

socket.on('connect', function(data) {
    socket.emit('join', 'Hello World from client 666');
    // socket.emit('with-binary', buffer);
});
// socket.on('messages', function(data) {
//     console.log(data);
// });
// socket.on('broad', function(data) {
//     $('#future').append(data + "<br/>");
// });

$('form').submit(function(e) {
    e.preventDefault();
    let message = $('#chat_input').val();
                    $('#chat_input').val('');

    socket.emit('messages', message);
});


// Load Cell List => Kick off processCells()
// -------------------------------------------------------------------------
fetch(`./connsData/conns-list.json`) // Check if this data exists...
.then( res => {
    return res.json();
})
.then( data => {
    connsList = data;
    processCell(connsList[index]);
}).catch(reason => console.log('conns promise rejected for', reason));


// Process Cells
// -------------------------------------------------------------------------
function processCell(id) {
    // Send Id to Server
    socket.emit('id', id);
    // Request Out Buffer Data
    outPromise = new Promise((f, r) => {
        socket.emit('requestOutData', id);
        socket.on('returnOutData', ( data => {
            let obuff = new Float32Array(matrixColumns * matrixRows * 3);
            Object.entries(data).forEach(([index, vertex]) => obuff[index] = vertex);  

            f(obuff); 
        }));
    });
    // Request Contacts Buffer Data
    connsPromise = new Promise((f, r) => {
        socket.emit('requestConnsData', id);
        socket.on('returnConnsData', ( data => {
            let cbuff = new Float32Array(matrixColumns * matrixRows * 3);
            Object.entries(data).forEach(([index, vertex]) => cbuff[index] = vertex);  

            f(cbuff);
        }));
    });
    // Request Vertices Buffer Data
    vertsPromise = new Promise((f, r) => {
        socket.emit('requestVertsData', id);
        socket.on('returnVertsData', ( data => {
            let vbuff = new Float32Array(matrixColumns * matrixRows * 3);
            Object.entries(data).forEach(([index, vertex]) => vbuff[index] = vertex);  

            f(vbuff); 
        }));
    });
    
    // Kick off GPGPU NearestVertex => Module Exports that shit
    Promise.all([outPromise, connsPromise, vertsPromise])
    .then(([obuff, cbuff, vbuff]) => {    
        window.cbuff = cbuff;
        window.vbuff = vbuff;
        console.log('out + conns + verts success!');
        return NearestVertex.gpgpu(vbuff, cbuff, obuff); // returns Promise
    })
    .then((data) => {
        socket.emit('writeCellData', data);
    }).catch(reason => console.log('NearestVertex promise rejected for', reason));
}


// Process Another Cell Event Handler
// -------------------------------------------------------------------------
socket.on('writeSuccess', function(data) {
    if (index > connsList.length) {
        socket.emit('done', 'Cell processing done!');
        return;
    }
    index++;
    processCell(connsList[index]);
});