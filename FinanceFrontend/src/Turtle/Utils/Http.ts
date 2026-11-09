export function QueryHeader(obj: any): { query: string } {
    return {
        query: JSON.stringify(obj ?? {}),
    };
}
