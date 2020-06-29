import { EventEmitter } from 'events';
import {
  Issuer,
  Client,
  ClientMetadata,
  generators,
  TokenSet,
  AuthorizationParameters,
} from 'openid-client';
import { uuid } from 'uuidv4';
import { open } from 'openurl';
import Receiver from './receiver';
import Config from './config';

/**
 * Emitting on got token
 */
const tokenCompleted = new EventEmitter();
interface OAuth2ProcessConfig {
  issuer: string;
  clientId: string;
  redirectUris: string[];
  clientSecret: string;
  userPoolId: string;
}
/**
 * OAuth2 Process
 */
export class OAuth2Process {
  private tokens: TokenSet;
  private receiver: Receiver;
  private config: OAuth2ProcessConfig;

  constructor(config: OAuth2ProcessConfig) {
    // @ts-ignore
    this.tokens = null;
    // @ts-ignore
    this.receiver = null;
    this.config = config;
    console.log(this.config);
  }

  /**
   * Issuer
   */
  public async getIssuer(): Promise<Issuer<Client>> {
    const issuer = await Issuer.discover(`${this.config.issuer}`);
    return issuer;
  }

  /**
   * Client
   * @param metaData ClientMetaData
   */
  public async getClient(metaData: ClientMetadata): Promise<Client> {
    const issuer = await this.getIssuer();
    const client = new issuer.Client(metaData);
    return client;
  }

  /**
   * Authorize
   */
  public async authorize() {
    const client = await this.getClient({
      client_id: this.config.clientId,
      redirect_uris: this.config.redirectUris,
      response_types: ['code'],
      client_secret: this.config.clientSecret,
    });

    // Verification information
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    // receiver configuration
    this.receiver = new Receiver({
      port: 3000,
      client: client,
      verifier: codeVerifier,
      callback: 'http://localhost:3000/cb',
    });
    const state = uuid();
    this.receiver.start(tokenCompleted, state);

    let authorizationParameters: AuthorizationParameters = {
      scope: 'openid email aws.cognito.signin.user.admin',
      resource: 'https://auth.getshifter.net/oauth2/authorize',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    };
    authorizationParameters['identity_provider'] = 'COGNITO';
    authorizationParameters['state'] = state;

    // Start authorize process
    const url = client.authorizationUrl(authorizationParameters);
    console.log(url);
    open(url);
    console.log('Authorize:Request', url);
  }

  /**
   * Wait for succeeded or Timeout
   */
  public async wait() {
    return new Promise((resolve, reject) => {
      const intervalObj = setTimeout(() => {
        clearTimeout(intervalObj);
        this.receiver.stop();
        reject('Timeout');
      }, 60 * 1000);

      tokenCompleted.once('tokenCompleted', (tokens: TokenSet) => {
        this.tokens = tokens;
        this.receiver.stop();
        clearTimeout(intervalObj);
        resolve();
      });
    });
  }

  /**
   * return Tokens
   */
  public getTokens() {
    return this.tokens;
  }

  public async refresh(refreshToken: string) {
    const client = await this.getClient({
      client_id: this.config.clientId,
      redirect_uris: this.config.redirectUris,
      client_secret: this.config.clientSecret,
    });
    const token = await client.refresh(refreshToken);
    return token;
  }
}

const config = {
  issuer: `https://cognito-idp.us-east-1.amazonaws.com/${Config.UserPoolId}`,
  clientId: process.env.SHIFTER_CLIENT_ID || '',
  redirectUris: ['http://localhost:3000/cb'],
  clientSecret: process.env.SHIFTER_CLIENT_SECRET || '',
  userPoolId: Config.UserPoolId,
};
/**
 * Getting Token
 */
export async function getToken() {
  const oauth2 = new OAuth2Process(config);
  await oauth2.authorize();
  await oauth2.wait();
  return oauth2.getTokens();
}

export async function refresh(refreshToken: string) {
  const oauth2 = new OAuth2Process(config);
  const token = await oauth2.refresh(refreshToken);
  return token;
}

// getToken().then(token => console.log(token))
