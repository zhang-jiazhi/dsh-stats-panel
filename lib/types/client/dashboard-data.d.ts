export type UsageSort = 'tokens' | 'calls';
/** Match all terms, including terms split across model and channel. */
export declare function matchesQuery(query: string, ...values: string[]): boolean;
export declare function rankUsage<T extends {
    totalTokens: number;
    calls: number;
}>(rows: readonly T[], sort: UsageSort): T[];
/** Preserve exact values and prevent model names from becoming spreadsheet formulas. */
export declare function usageCsv(headers: string[], rows: Array<Array<string | number>>): string;
//# sourceMappingURL=dashboard-data.d.ts.map