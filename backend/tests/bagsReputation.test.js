/**
 * BAGS Reputation Service Tests
 * Tests for computeBagsScore scoring logic
 */

jest.mock('../src/models/queries', () => ({
  getAgent: jest.fn(),
  getAgentActions: jest.fn(),
  getUnresolvedFlagCount: jest.fn(),
  updateBagsScore: jest.fn(),
}));

jest.mock('../src/services/saidBinding', () => ({
  getSAIDTrustScore: jest.fn(),
}));

jest.mock('../src/config', () => ({
  saidGatewayUrl: 'http://mock-said',
  bagsApiKey: 'test-key',
}));

jest.mock('axios');

const { getAgent, getAgentActions, getUnresolvedFlagCount, updateBagsScore } = require('../src/models/queries');
const { getSAIDTrustScore } = require('../src/services/saidBinding');
const { computeBagsScore, refreshAndStoreScore } = require('../src/services/bagsReputation');
const axios = require('axios');

const TEST_AGENT_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_PUBKEY = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('BAGS Reputation Service', () => {
  describe('Scoring logic', () => {
    it('should compute score with all 5 factors', async () => {
      const tokenMint = 'TokenMint123';
      
      // Mock agent data
      getAgent.mockResolvedValue({
        agent_id: TEST_AGENT_ID,
        pubkey: TEST_PUBKEY,
        token_mint: tokenMint,
        registered_at: new Date(Date.now() - 10 * 86400000) // 10 days ago
      });

      // Mock fee activity (3 SOL = 30 points max)
      axios.get.mockResolvedValueOnce({
        data: { totalFeesSOL: 3.0 }
      });

      // Mock success rate (80% = 20 points)
      getAgentActions.mockResolvedValue({
        total: 100,
        successful: 80,
        failed: 20
      });

      // Mock SAID trust score (80/100 = 12 points)
      getSAIDTrustScore.mockResolvedValue({
        score: 80,
        label: 'HIGH'
      });

      // Mock no flags (10 points)
      getUnresolvedFlagCount.mockResolvedValue(0);

      const result = await computeBagsScore(TEST_AGENT_ID);

      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('label');
      expect(result).toHaveProperty('breakdown');
      expect(result.breakdown).toHaveProperty('feeActivity');
      expect(result.breakdown).toHaveProperty('successRate');
      expect(result.breakdown).toHaveProperty('age');
      expect(result.breakdown).toHaveProperty('saidTrust');
      expect(result.breakdown).toHaveProperty('community');
    });

    it('should have breakdown that sums to total score', async () => {
      getAgent.mockResolvedValue({
        agent_id: TEST_AGENT_ID,
        pubkey: TEST_PUBKEY,
        token_mint: null,
        registered_at: new Date()
      });

      axios.get.mockRejectedValue(new Error('API error'));
      getAgentActions.mockResolvedValue({ total: 0, successful: 0, failed: 0 });
      getSAIDTrustScore.mockRejectedValue(new Error('API error'));
      getUnresolvedFlagCount.mockResolvedValue(0);

      const result = await computeBagsScore(TEST_AGENT_ID);

      const sum = result.breakdown.feeActivity.score +
                  result.breakdown.successRate.score +
                  result.breakdown.age.score +
                  result.breakdown.saidTrust.score +
                  result.breakdown.community.score;

      expect(result.score).toBe(sum);
    });
  });

  describe('Label thresholds', () => {
    it('should return HIGH label for score >= 80', async () => {
      getAgent.mockResolvedValue({
        agent_id: TEST_AGENT_ID,
        pubkey: TEST_PUBKEY,
        token_mint: 'token123',
        registered_at: new Date(Date.now() - 100 * 86400000) // 100 days
      });

      // High fee activity
      axios.get.mockResolvedValue({ data: { totalFeesSOL: 10 } });
      // High success rate
      getAgentActions.mockResolvedValue({ total: 100, successful: 100, failed: 0 });
      // High SAID score
      getSAIDTrustScore.mockResolvedValue({ score: 100, label: 'HIGH' });
      // No flags
      getUnresolvedFlagCount.mockResolvedValue(0);

      const result = await computeBagsScore(TEST_AGENT_ID);

      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.label).toBe('HIGH');
    });

    it('should return MEDIUM label for score >= 60 and < 80', async () => {
      getAgent.mockResolvedValue({
        agent_id: TEST_AGENT_ID,
        pubkey: TEST_PUBKEY,
        token_mint: 'token123',
        registered_at: new Date(Date.now() - 30 * 86400000) // 30 days
      });

      // Medium fee activity
      axios.get.mockResolvedValue({ data: { totalFeesSOL: 2 } });
      // Medium success rate
      getAgentActions.mockResolvedValue({ total: 100, successful: 70, failed: 30 });
      // Medium SAID score
      getSAIDTrustScore.mockResolvedValue({ score: 60, label: 'MEDIUM' });
      // No flags
      getUnresolvedFlagCount.mockResolvedValue(0);

      const result = await computeBagsScore(TEST_AGENT_ID);

      expect(result.score).toBeGreaterThanOrEqual(60);
      expect(result.score).toBeLessThan(80);
      expect(result.label).toBe('MEDIUM');
    });

    it('should return LOW label for score >= 40 and < 60', async () => {
      getAgent.mockResolvedValue({
        agent_id: TEST_AGENT_ID,
        pubkey: TEST_PUBKEY,
        token_mint: 'token123',
        registered_at: new Date(Date.now() - 10 * 86400000) // 10 days ago
      });

      // Low fee activity (1 SOL = 10 points)
      axios.get.mockResolvedValue({ data: { totalFeesSOL: 1 } });
      // Medium-low success rate (50% = 12 points)
      getAgentActions.mockResolvedValue({ total: 100, successful: 50, failed: 50 });
      // Low SAID score (20/100 = 3 points)
      getSAIDTrustScore.mockResolvedValue({ score: 20, label: 'LOW' });
      // One flag (5 points)
      getUnresolvedFlagCount.mockResolvedValue(1);

      const result = await computeBagsScore(TEST_AGENT_ID);

      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.score).toBeLessThan(60);
      expect(result.label).toBe('LOW');
    });

    it('should return NEW AGENT label for score < 40', async () => {
      getAgent.mockResolvedValue({
        agent_id: TEST_AGENT_ID,
        pubkey: TEST_PUBKEY,
        token_mint: null,
        registered_at: new Date() // Just registered
      });

      // No token mint
      axios.get.mockRejectedValue(new Error('No token'));
      // Very low success rate
      getAgentActions.mockResolvedValue({ total: 100, successful: 10, failed: 90 });
      // No SAID score
      getSAIDTrustScore.mockResolvedValue({ score: 0, label: 'UNKNOWN' });
      // Multiple flags
      getUnresolvedFlagCount.mockResolvedValue(3);

      const result = await computeBagsScore(TEST_AGENT_ID);

      expect(result.score).toBeLessThan(40);
      expect(result.label).toBe('NEW AGENT');
    });
  });

  describe('Graceful degradation', () => {
    it('should handle SAID API failure gracefully', async () => {
      getAgent.mockResolvedValue({
        agent_id: TEST_AGENT_ID,
        pubkey: TEST_PUBKEY,
        token_mint: null,
        registered_at: new Date()
      });

      axios.get.mockRejectedValue(new Error('SAID API error'));
      getAgentActions.mockResolvedValue({ total: 0, successful: 0, failed: 0 });
      getSAIDTrustScore.mockRejectedValue(new Error('SAID API error'));
      getUnresolvedFlagCount.mockResolvedValue(0);

      const result = await computeBagsScore(TEST_AGENT_ID);

      expect(result.breakdown.saidTrust.score).toBe(0);
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('label');
    });

    it('should handle Bags API failure gracefully', async () => {
      getAgent.mockResolvedValue({
        agent_id: TEST_AGENT_ID,
        pubkey: TEST_PUBKEY,
        token_mint: 'token123',
        registered_at: new Date()
      });

      // Bags API fails
      axios.get.mockRejectedValue(new Error('Bags API error'));
      getAgentActions.mockResolvedValue({ total: 0, successful: 0, failed: 0 });
      getSAIDTrustScore.mockResolvedValue({ score: 0, label: 'UNKNOWN' });
      getUnresolvedFlagCount.mockResolvedValue(0);

      const result = await computeBagsScore(TEST_AGENT_ID);

      expect(result.breakdown.feeActivity.score).toBe(0);
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('label');
    });

    it('should handle both SAID and Bags API failures gracefully', async () => {
      getAgent.mockResolvedValue({
        agent_id: TEST_AGENT_ID,
        pubkey: TEST_PUBKEY,
        token_mint: 'token123',
        registered_at: new Date()
      });

      axios.get.mockRejectedValue(new Error('Bags API error'));
      getAgentActions.mockResolvedValue({ total: 0, successful: 0, failed: 0 });
      getSAIDTrustScore.mockRejectedValue(new Error('SAID API error'));
      getUnresolvedFlagCount.mockResolvedValue(0);

      const result = await computeBagsScore(TEST_AGENT_ID);

      expect(result.breakdown.feeActivity.score).toBe(0);
      expect(result.breakdown.saidTrust.score).toBe(0);
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('label');
    });
  });

  describe('refreshAndStoreScore', () => {
    it('should call computeBagsScore and updateBagsScore', async () => {
      getAgent.mockResolvedValue({
        agent_id: TEST_AGENT_ID,
        pubkey: TEST_PUBKEY,
        token_mint: null,
        registered_at: new Date()
      });

      axios.get.mockRejectedValue(new Error('API error'));
      getAgentActions.mockResolvedValue({ total: 0, successful: 0, failed: 0 });
      getSAIDTrustScore.mockRejectedValue(new Error('API error'));
      getUnresolvedFlagCount.mockResolvedValue(0);
      updateBagsScore.mockResolvedValue({ agent_id: TEST_AGENT_ID, bags_score: 10 });

      const result = await refreshAndStoreScore(TEST_AGENT_ID);

      expect(result).toHaveProperty('agent');
      expect(result).toHaveProperty('scoreData');
      expect(updateBagsScore).toHaveBeenCalledWith(TEST_AGENT_ID, expect.any(Number));
    });
  });
});
