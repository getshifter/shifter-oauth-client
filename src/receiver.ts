import { EventEmitter } from 'events';
import { Client } from 'openid-client';
import http from 'http';
import express from 'express';
import { createHttpTerminator, HttpTerminator } from 'http-terminator';

interface ReceiverConfig {
  port: number;
  client: Client;
  verifier: string;
  callback: string;
}
/**
 * Receiver which accept from OAuth resource server
 */
export default class Receiver {
  private config: ReceiverConfig;
  public server: http.Server;
  public terminator: HttpTerminator;

  constructor(config: ReceiverConfig) {
    this.config = config;
    // @ts-ignore
    this.server = null;
    // @ts-ignore
    this.terminator = null;
  }

  /**
   *
   * @param tokenCompleted Notification Event to the external listeners
   * @param state against CSRF
   */
  public start(tokenCompleted: EventEmitter, state: string) {
    const app = express();
    this.server = app.listen(this.config.port);
    this.terminator = createHttpTerminator({ server: this.server });

    app.get('/cb', (req, res) => {
      const params = this.config.client.callbackParams(req);
      return this.config.client
        .callback(this.config.callback, params, {
          code_verifier: this.config.verifier,
          state: state,
        })
        .then(tokens => {
          // getting token successfully
          tokenCompleted.emit('tokenCompleted', tokens);
          return res.status(200).json(tokens);
        })
        .catch(e => {
          console.log(e);
          return res.send('error');
        });
    });
  }

  public async stop() {
    if (this.terminator) {
      this.terminator.terminate();
    }
  }
}
