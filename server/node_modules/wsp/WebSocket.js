'use strict';
var stream = require('stream');
var crypto = require('crypto');
var util = require('util');
var url = require('url');
var net = require('net');
var Rfc6455Protocol = require('./Rfc6455Protocol');

class WebSocket extends stream.Writable {
  static get READY_STATES() {
    return {
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3
    };
  }

  constructor(opts) {
    super();
    this.readyState = WebSocket.READY_STATES.CLOSED;
    if(!('socket' in opts ^ 'url' in opts)) {
      throw new Error('Specify either URL or socket');
    }
    opts.maskFrames = !!opts.maskFrames;
    if('url' in opts) {
      return this._buildWithHandshake(opts.url, !opts.headers ? {} :
        opts.headers, opts.maskFrames);
    }
    this.socket = opts.socket;
    this._buildWithSocket(opts.maskFrames);
  }

  _write(chunk, encoding, cb) {
    this.socket.write(this.rfc6455Protocol.buildBinaryFrame(chunk));
    cb();
  }

  _buildWithSocket(maskFrames) {
    var self = this;
    self.socket.setNoDelay(true);
    self.socket.setTimeout(0, function() {
      self.readyState = WebSocket.READY_STATES.CLOSED;
      self.emit('close', 'TIMED_OUT');
    });
    self.socket.setKeepAlive(true, 0);
    self.rfc6455Protocol = new Rfc6455Protocol({
      isMasking: !!maskFrames,
      listener: function(opcode, payload) {
        payload = payload || '';
        switch(opcode) {
          case Rfc6455Protocol.OPCODES.CLOSE:
            self.readyState = WebSocket.READY_STATES.CLOSED;
            self.emit('close', payload.toString());
            break;
          case Rfc6455Protocol.OPCODES.PING:
            self.emit('ping', payload.toString());
            break;
          case Rfc6455Protocol.OPCODES.PONG:
            self.emit('pong', payload.toString());
            break;
          case Rfc6455Protocol.OPCODES.TEXT:
            self.emit('message', payload.toString());
            break;
        }
      }
    });

    self.rfc6455Protocol.on('error', function(err) {
      self.emit('error', err);
    });

    self.socket.once('end', function() {
      self.readyState = WebSocket.READY_STATES.CLOSING;
      self.emit('close', '1000');
    });

    self.socket.on('error', function(err) {
      self.emit('error', err);
    });

    self.socket.once('close', function() {
      self.readyState = WebSocket.READY_STATES.CLOSED;
      self.emit('close', '1000');
    });

    self.readyState = WebSocket.READY_STATES.OPEN;
    self.socket.pipe(self.rfc6455Protocol);

    self.emit('connect');
  }

  _buildWithHandshake(url_, headers, maskFrames) {
    var self = this;
    this.readyState = WebSocket.READY_STATES.CLOSED;
    var parsedUrl = url.parse(url_);
    var secret = crypto.randomBytes(16).toString('base64');
    if(!parsedUrl.port) {
      parsedUrl.port = parsedUrl.protocol === 'wss:' ? '443' : '80';
    }
    this.socket = net.connect({
      host: parsedUrl.hostname,
      port: parsedUrl.port
    }, function() {
      self.readyState = WebSocket.READY_STATES.CONNECTING;
      var res = [
        'GET ' + parsedUrl.href + ' HTTP/1.1',
        'Upgrade: WebSocket',
        'Connection: Upgrade',
        'Host: ' + parsedUrl.hostname,
        'Origin: ' + parsedUrl.href,
        'Sec-WebSocket-Key: ' + secret,
        'Sec-WebSocket-Version: 13'
      ];
      Object.keys(headers).forEach(function(k) {
        res.push(util.format('%s: %s', k, headers[k]));
      });
      res.push('', '');
      self.socket.write(res.join('\r\n'));
    }).once('data', function(res) {
      res = res.toString();
      res.split(/\r?\n/).forEach(function(line, i) {
        if(i === 0 && !/HTTP\/1\.1 101 Switching Protocols/i.test(line)) {
          self.readyState = WebSocket.READY_STATES.CLOSED;
          throw new Error('Invalid protocol: ' + line);
        }
        if(!/Sec-WebSocket-Accept/i.test(line)) {
          return;
        }
        var headerSecret = line.split(/Sec-WebSocket-Accept: /i)[1];
        var sha1 = crypto.createHash('sha1');
        sha1.update((secret + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'));
        if(sha1.digest('base64').trim() !== headerSecret) {
          self.readyState = WebSocket.READY_STATES.CLOSED;
          throw new Error('Invalid secret');
        }
      });
      self._buildWithSocket(self, self.socket, !!maskFrames);
    });
  }

  _isClosed() {
    return this.readyState === WebSocket.READY_STATES.CLOSING ||
      this.readyState === WebSocket.READY_STATES.CLOSED;
  }

  pipe(dst) {
    this.rfc6455Protocol.pipe(dst);
    return dst;
  }

  send(data) {
    if(this._isClosed()) {
      return;
    }
    var method = 'build' + (typeof data === 'string' ? 'Text' : 'Binary') +
      'Frame';
    this.socket.write(this.rfc6455Protocol[method](Buffer.from(data)));
  }

  close(code) {
    if(this._isClosed()) {
      return;
    }
    this.readyState = WebSocket.READY_STATES.CLOSING;
    var fn = this.rfc6455Protocol.buildCloseFrame;
    try {
      this.socket.end(fn(Buffer.from(code || '1000')));
    } catch(ex) {
      this.socket.destroy();
    }
  }

  ping(data) {
    if(this._isClosed()) {
      return;
    }
    var fn = this.rfc6455Protocol.buildPingFrame;
    this.socket.write(fn(Buffer.from(data || '')));
  }

  pong(data) {
    if(this._isClosed()) {
      return;
    }
    var fn = this.rfc6455Protocol.buildPongFrame;
    this.socket.write(fn(Buffer.from(data || '')));
  }
}

module.exports = WebSocket;
