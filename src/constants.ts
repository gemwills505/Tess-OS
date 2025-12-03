import { buildSystemInstruction } from './services/brain';

// Deprecated: System instruction is now built dynamically in geminiService via brain.ts
export const SYSTEM_INSTRUCTION = "Deprecated. Use buildSystemInstruction() from services/brain.ts";

// NOTE: Locations are now fetched dynamically from getBrain().locations
// Do not use static constants for mutable data.