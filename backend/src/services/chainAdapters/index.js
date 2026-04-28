/**
 * ChainAdapter Interface & Factory
 * 
 * Every chain adapter must implement:
 *   verifyOwnership(pubkey, signature, challenge) -> Promise<boolean>
 *   getReputationData(agentId, agentObj?) -> Promise<{ score, label, breakdown }>
 *   validateAddress(address) -> Promise<boolean>
 *   getChainMeta() -> { name, chainId, addressFormat, signingAlgo }
 *   initChallenge(pubkey) -> Promise<{ message, nonce }> (optional, for chains with external auth init)
 */

const adapters = {};

function registerAdapter(chainType, adapter) {
  adapters[chainType] = adapter;
}

function getChainAdapter(chainType) {
  const adapter = adapters[chainType];
  if (!adapter) {
    throw new Error(`Unsupported chain type: ${chainType}. Available: ${Object.keys(adapters).join(', ')}`);
  }
  return adapter;
}

function getSupportedChains() {
  return Object.keys(adapters).map(key => ({
    chainType: key,
    ...adapters[key].getChainMeta()
  }));
}

// Register adapters
const solanaBAGS = require('./solanaBAGS');
const solanaGeneric = require('./solanaGeneric');
const evm = require('./evm');

registerAdapter('solana-bags', solanaBAGS);
registerAdapter('solana', solanaGeneric);
registerAdapter('ethereum', evm.ethereum);
registerAdapter('base', evm.base);
registerAdapter('polygon', evm.polygon);

module.exports = { getChainAdapter, getSupportedChains, registerAdapter };
