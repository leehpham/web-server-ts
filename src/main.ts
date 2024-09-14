import "reflect-metadata";

// All the networking stuff is in the net module.
import * as net from "node:net";

// The net.createServer() function creates a TCP server whose type is net.Server.
const server = net.createServer();
// Registers the callback newConn.
// The runtime will automatically perform the accept operation and invoke the callback with
// the new connection as an argument of type net.Socket.
// This callback is registered once, but will be called for each new connection.
server.on("connection", newConn);
server.on("error", (err: Error) => {
  throw err;
});
// net.Server has a listen() method to bind and listen on an address.
server.listen({ host: "127.0.0.1", port: 1234 });

function newConn(socket: net.Socket): void {
  console.log("new connection", socket.remoteAddress, socket.remotePort);

  // The relevant events for reading from a socket are "data" and "end".
  // The "end" event is invoked when the peer has ended the transmission.
  socket.on("end", () => {
    // FIN received. The connectin will be closed automatically.
    console.log("EOF.");
  });

  socket.on("data", (data: Buffer) => {
    console.log("data:", data);
    // The socket.write() method sends data back to the peer.
    // Echo back the data.
    socket.write(data);

    // Actively closed the connection if the data contains 'q'
    if (data.includes("q")) {
      console.log("closing.");
      socket.end(); // this will send FIN and close the connection.
    }
  });
}

// A promise-based API for TCP sockets.
type TCPConn = {
  // The JS socket object.
  socket: net.Socket;
  // The callbacks of the promise of the current read
  reader: null | {
    resolve: (value: Buffer) => void;
    reject: (reason: Error) => void;
  };
};

// create a wrapper from net.Socket
function soInit(socket: net.Socket): TCPConn {
  const conn: TCPConn = {
    socket: socket,
    reader: null,
  };
  socket.on("data", (data: Buffer) => {
    console.assert(conn.reader);
    // pause the "data" event until the next read.
    conn.socket.pause();
    // fulfill the promise of the current read.
    conn.reader!.resolve(data);
    conn.reader = null;
  });
  return conn;
}

function soRead(conn: TCPConn): Promise<Buffer> {}
