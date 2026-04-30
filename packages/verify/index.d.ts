export interface CountersigVerifierOptions {
  /** PEM-encoded Ed25519 public key (SPKI format) for local verification */
  publicKey?: string;
  /** JWK-formatted Ed25519 public key for local verification */
  jwk?: JsonWebKey;
  /** Countersig API URL (default: https://api.countersig.com) */
  apiUrl?: string;
  /** @deprecated HMAC secret — migrate to Ed25519 public key or JWKS */
  secret?: string;
}

export interface A2ATokenPayload {
  sub: string;
  type: 'a2a';
  name: string;
  pubkey: string;
  chain: string;
  caps: string[];
  score: number;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

export declare class CountersigVerifier {
  constructor(options?: CountersigVerifierOptions);
  
  /** Verify token locally using Ed25519 public key */
  verifyLocal(token: string): Promise<A2ATokenPayload>;
  
  /** Verify token using JWKS fetched from Countersig API */
  verifyWithJWKS(token: string): Promise<A2ATokenPayload>;
  
  /** Verify token via Countersig HTTP API */
  verifyRemote(token: string): Promise<A2ATokenPayload>;
  
  /** Auto-select best verification method */
  verify(token: string): Promise<A2ATokenPayload>;
  
  /** Decode token without verification */
  decode(token: string): A2ATokenPayload;
}
