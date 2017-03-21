// Server Side
// -------------------------------------------------------------------------

const express = require('express');  
const app = express();  
const path = require('path');
const server = require('http').createServer(app);  
const io = require('socket.io')(server);
const fs = require('fs');
const jsonfile = require('jsonfile');
const Threads = require('webworker-threads');

let matrixColumns = 1024;
let matrixRows    = 1024;

let _connsOutput;
let _id;

app.use(express.static(__dirname + '/'));  
app.get('/', function(req, res,next) {  
    res.sendFile(__dirname + '/index.html');
});

server.listen(4200);


// Utility Functions
// -------------------------------------------------------------------------

// Promisify fs.readFile()
fs.readJSONAsync = function (filename) {
    return new Promise(function (resolve, reject) {
        try {
            fs.readFile(filename, 'utf8', function(err, buffer){
                if (err) reject(err); else resolve(JSON.parse(buffer));
            });
        } catch (err) {
            reject(err);
        }
    });
};

fs.readFileAsync = function (filename, encoding='ascii') {
    return new Promise(function (resolve, reject) {
        try {
            fs.readFile(filename, 'ascii', function(err, buffer){
                if (err) reject(err); else resolve(buffer);
            });
        } catch (err) {
            reject(err);
        }
    });
};

// Size = matrixColumns * matrixRows * 3
function makeFloat32Buffer(data, size, elems) {
  let buff = new Float32Array(size * size * elems);
  if (data) {
    data.forEach((d, i) => buff[i] = d);
  }  
  return buff;
}


// Handle CellData Request
// -------------------------------------------------------------------------

// Load conns data (url + id)
function getConnsData(id) {
    let connsFile = "./connsData/conns-" + id + ".json";
    console.log('loading conns for cell ' + id);
    return fs.readJSONAsync(connsFile, 'utf8')
    .then( res => {
        return res;
    })
    .then( data => {
        let cbuff = new Float32Array(matrixColumns * matrixRows * 3); // Where to specify
        let index = 0;
        
        _connsOutput = data;
        
        Object.entries(data).forEach(([cellName, cell]) => {
            cell.forEach(contact => {
                // console.log('processing contact ' + index); // Might keep stack from overflowing
                cbuff[index + 0] = contact.post.x;
                cbuff[index + 1] = contact.post.y;
                cbuff[index + 2] = contact.post.z;
                index += 3;
            });
        });  

        return cbuff;

    }).catch(reason => console.log('conns promise rejected for', reason));
}

// Load conns data (url + id)
function getVertsData(id) {
    let meshFile  = "./meshes/" + id + ".ctm";
    // Load mesh data
    return fs.readFileAsync(meshFile).then( data => {
        console.log('loading mesh for cell ' + id);
        let worker = new Threads.Worker("./loader.js"); 
        return new Promise((f, r) => {
            worker.onmessage = ( event => {
                console.log('worker done on cell ' + id);
                console.log(event.header.vertices);
                f(event.data.body.vertices);  // Return Vertices Buffer => BAD!!!
            });
            worker.postMessage(data);
            console.log('worker working on cell ' + id); 
        });
    })
    .then( data => {
        let vbuff = new Float32Array(matrixColumns * matrixRows * 3); // Where to specify
        Object.entries(data).forEach(([index, vertex]) => vbuff[index] = vertex);  
        return vbuff;

    }).catch(reason => console.log('geometry promise rejected for', reason));
}


// Web Sockets
io.on('connection', function(client) {
    // TEST CASES
    // -------------------------------------------------------------------------
    console.log('Client 666 connected...');
    client.on('join', function(data) {
        console.log(data);
        client.emit('messages', 'Hello from server 666');
    });
    // client.on('messages', function(data) {
    //     client.emit('broad', data);
    //     client.broadcast.emit('broad', data);
    // });
    // client.on('with-binary', function(data) {
    //     console.log('Binary received!');
    //     console.log(data);
    // });

    // GPGPU CASES
    // -------------------------------------------------------------------------
    // Receive Cell ID
    client.on('id', ( id => {
        console.log('Begin Cell ' + id);
        _id = id;
    }));
    // Load + Send Cell Conns Data
    client.on('requestConnsData', ( id => {
        console.log('Request Cell Conns Data ' + id);
        getConnsData(id).then(data => client.emit('returnConnsData', data));
    }));

    // Load + Send Cell Verts Data
    client.on('requestVertsData', ( id => {
        console.log('Request Cell Verts Data ' + id);
        getVertsData(id).then(data => client.emit('returnVertsData', data));
    }));

    // Load + Send Out Buffer Context
    client.on('requestOutData', (id => {
        console.log('Request Cell Out Data ' + id);
        client.emit('returnOutData', makeFloat32Buffer(null, 1024, 3)); // Create output buffer
    }));


    // Write out updated Conns
    client.on('writeCellData', (data => {
        let vbuff = new Float32Array(matrixColumns * matrixRows * 3);
        // Flatten response data
        Object.entries(data).forEach(([index, vertex]) => vbuff[index] = vertex);  

        // Update conns-#####.json
        let index = 0;
        console.log('writing cell data ' + _id);
        Object.entries(_connsOutput).forEach(([cellName, cell]) => {
            cell.forEach(contact => {
                contact['vertex'] = vbuff[index];
                index++;
            });
        });

        // Write conns-#####.json -> to file
        let file = './connsData2/conns-' + _id + '.json'; 
        jsonfile.writeFile(file, _connsOutput, (error) => { 
            if (error) {
                console.error(error);
            }
            else {
                client.emit('writeSuccess', 'success!'); // Message complete
            }
        }); 
    }));

    // Doneskis
    client.on('done', (data => console.log(data)));
});