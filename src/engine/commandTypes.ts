// Type-only view of the command registry. Importing this module never bundles engine code.
import type { COMMANDS } from './registry.ts';

export type CommandName = keyof typeof COMMANDS;
type Fn<N extends CommandName> = (typeof COMMANDS)[N];
export type CommandInput<N extends CommandName> = Parameters<Fn<N>> extends [unknown, infer I, ...unknown[]] ? I : undefined;
