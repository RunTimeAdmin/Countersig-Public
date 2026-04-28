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

export interface VerifierOptions {
  /** Shared A2A secret for local HMAC verification */
  secret?: string;
  /** AgentID API base URL for remote verification. Default: https://api.agentidapp.com */
  apiUrl?: string;
}

export class AgentIDVerifier {
  constructor(options?: VerifierOptions);

  /** Verify token locally using shared secret */
  verifyLocal(token: string): A2ATokenPayload;

  /** Verify token via AgentID API */
  verifyRemote(token: string): Promise<A2ATokenPayload>;

  /** Verify using best available method */
  verify(token: string): Promise<A2ATokenPayload>;

  /** Decode without verification */
  decode(token: string): A2ATokenPayload | null;
}
