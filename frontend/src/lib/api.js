import axios from 'axios';

const api = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth tokens if needed
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('agentid_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle specific error cases
    if (error.response?.status === 401) {
      localStorage.removeItem('agentid_token');
    }
    return Promise.reject(error);
  }
);

// Agent Registry
export const getAgents = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.capability) params.append('capability', filters.capability);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.offset) params.append('offset', filters.offset);
  
  const response = await api.get(`/agents?${params.toString()}`);
  return response.data;
};

export const getAgent = async (agentId) => {
  const response = await api.get(`/agents/${agentId}`);
  return response.data;
};

// Trust Badge
export const getBadge = async (agentId) => {
  const response = await api.get(`/badge/${agentId}`);
  return response.data;
};

// Reputation
export const getReputation = async (agentId) => {
  const response = await api.get(`/reputation/${agentId}`);
  return response.data;
};

// Registration
export const registerAgent = async (registrationData) => {
  const response = await api.post('/register', registrationData);
  return response.data;
};

// PKI Challenge-Response
export const issueChallenge = async (agentId) => {
  const response = await api.post('/verify/challenge', { agentId });
  return response.data;
};

export const verifyChallenge = async (agentId, nonce, signature) => {
  const response = await api.post('/verify/response', { 
    agentId, 
    nonce, 
    signature 
  });
  return response.data;
};

// Attestations
export const attestAgent = async (agentId, attestationData) => {
  const response = await api.post(`/agents/${agentId}/attest`, attestationData);
  return response.data;
};

export const flagAgent = async (agentId, flagData) => {
  // flagData should include: reporterPubkey, signature, timestamp, reason, evidence (optional)
  const response = await api.post(`/agents/${agentId}/flag`, flagData);
  return response.data;
};

// Discovery
export const discoverAgents = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.capability) queryParams.append('capability', params.capability);
  if (params.minScore) queryParams.append('minScore', params.minScore);
  if (params.limit) queryParams.append('limit', params.limit);
  
  const response = await api.get(`/discover?${queryParams.toString()}`);
  return response.data;
};

// Widget
export const getWidgetHtml = async (agentId) => {
  const response = await api.get(`/widget/${agentId}`);
  return response.data;
};

export const getBadgeSvg = async (agentId) => {
  const response = await api.get(`/badge/${agentId}/svg`);
  return response.data;
};

// Agent Updates
export const updateAgent = async (agentId, updateData, signature, timestamp) => {
  const response = await api.put(`/agents/${agentId}/update`, {
    ...updateData,
    signature,
    timestamp,
  });
  return response.data;
};

// Attestation and Flag History
export const getAttestations = async (agentId) => {
  const response = await api.get(`/agents/${agentId}/attestations`);
  return response.data;
};

export const getFlags = async (agentId) => {
  const response = await api.get(`/agents/${agentId}/flags`);
  return response.data;
};

// Get agents by owner pubkey
export const getAgentsByOwner = async (pubkey) => {
  const response = await api.get(`/agents/owner/${pubkey}`);
  return response.data;
};

export default api;
