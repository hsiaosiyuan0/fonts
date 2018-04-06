export const encodingDescMap = new Map<number, string>();

export const pe = (platformId: number, encodingId: number) => (platformId << 8) | encodingId;

encodingDescMap.set(pe(0, 0), "Unicode 1.0 semantics");
