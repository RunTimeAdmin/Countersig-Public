export interface Config {
    apiKey?: string;
    agentId?: string;
    apiUrl: string;
    privateKey?: string;
}
export declare function loadConfig(): Config;
export declare function saveConfig(updates: Partial<Config>): void;
export declare function getConfigPath(): string;
//# sourceMappingURL=config.d.ts.map