export interface AgentIDVerifierOptions {
  /** PEM-encoded Ed25519 public key (SPKI format) for local verification */
  publicKey?: string;
  /** JWK-formatted Ed25519 public key for local verification */
  jwk?: JsonWebKey;
  /** AgentID API URL (default: https://api.agentidapp.com) */
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

export declare class AgentIDVerifier {
  constructor(options?: AgentIDVerifierOptions);
  
  /** Verify token locally using Ed25519 public key */
  verifyLocal(token: string): Promise<A2ATokenPayload>;
  
  /** Verify token using JWKS fetched from AgentID API */
  verifyWithJWKS(token: string): Promise<A2ATokenPayload>;
  
  /** Verify token via AgentID HTTP API */
  verifyRemote(token: string): Promise<A2ATokenPayload>;
  
  /** Auto-select best verification method */
  verify(token: string): Promise<A2ATokenPayload>;
  
  /** Decode token without verification */
  decode(token: string): A2ATokenPayload;
}
