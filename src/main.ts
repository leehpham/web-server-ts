import "reflect-metadata";

// All the networking stuff is in the net module.
import * as net from "node:net";

// The net.createServer() function creates a TCP server whose type is net.Server.
const server = net.createServer({
  // Since the "data" event is paused until we read the socket,
  // the socket should be paused by default after it is created.
  pauseOnConnect: true, // required by `TCPConn`
});

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

async function newConn(socket: net.Socket): Promise<void> {
  // TODO: remove later
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

  // new logic
  console.log("new connection", socket.remoteAddress, socket.remotePort);
  try {
    await serveClient(socket);
  } catch (exc) {
    console.error("exeption:", exc);
  } finally {
    socket.destroy();
  }
}

// echo server
async function serveClient(socket: net.Socket): Promise<void> {
  const conn: TCPConn = soInit(socket);
  while (true) {
    const data = await soRead(conn);
    if (data.length === 0) {
      console.log("end connection");
      break;
    }
    console.log("data", data);
    await soWrite(conn, data);
  }
}

// A promise-based API for TCP sockets.
type TCPConn = {
  /** The JS socket object. */
  socket: net.Socket;
  /** from the "error" event */
  err: Error | null;
  /** EOF, from the "end" event */
  ended: boolean;
  /** The callbacks of the promise of the current read */
  reader: {
    resolve: (value: Buffer) => void;
    reject: (reason: Error) => void;
  } | null;
};

// create a wrapper from net.Socket
function soInit(socket: net.Socket): TCPConn {
  const conn: TCPConn = {
    socket: socket,
    err: null,
    ended: false,
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

  // The "end" event is invoked when the peer has ended the transmission.
  socket.on("end", () => {
    // this also fulfills the current read.
    conn.ended = true;
    if (conn.reader) {
      conn.reader.resolve(Buffer.from("")); // EOF
      conn.reader = null;
    }
  });

  socket.on("error", (err: Error) => {
    // errors are also delivered to the current read.
    conn.err = err;
    if (conn.reader) {
      conn.reader.reject(err);
      conn.reader = null;
    }
  });

  return conn;
}

// returns an empty `Buffer` after EOF.
function soRead(conn: TCPConn): Promise<Buffer> {
  console.assert(!conn.reader); // no concurrent calls
  return new Promise((resolve, reject) => {
    // if the connection is not readable, complete the promise now.
    if (conn.err) {
      reject(conn.err);
      return;
    }
    if (conn.ended) {
      resolve(Buffer.from("")); // EOF
      return;
    }
    // save the promise callbacks
    conn.reader = { resolve: resolve, reject: reject };
    // and resume the "data" event to fulfill the promise later.
    conn.socket.resume();
  });
}

function soWrite(conn: TCPConn, data: Buffer): Promise<void> {
  console.assert(data.length > 0);
  return new Promise((resolve, reject) => {
    if (conn.err) {
      reject(conn.err);
      return;
    }
    conn.socket.write(data, (err?: Error) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
