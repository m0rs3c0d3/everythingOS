// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Built-in Tools
// ═══════════════════════════════════════════════════════════════════════════════

export { calculatorTool } from './calculator';
export { webSearchTool, configureWebSearch } from './web-search';
export { 
  fileReadTool, 
  fileWriteTool, 
  fileListTool, 
  fileDeleteTool,
  setSandboxDirectory,
} from './file-ops';

import { Tool } from '../ToolTypes';
import { calculatorTool } from './calculator';
import { webSearchTool } from './web-search';
import { fileReadTool, fileWriteTool, fileListTool, fileDeleteTool } from './file-ops';

/**
 * Get all built-in tools
 */
export function getBuiltinTools(): Tool[] {
  return [
    calculatorTool,
    webSearchTool,
    fileReadTool,
    fileWriteTool,
    fileListTool,
    fileDeleteTool,
  ];
}

/**
 * Get only safe built-in tools (no approval needed)
 */
export function getSafeBuiltinTools(): Tool[] {
  return getBuiltinTools().filter(t => t.trustLevel === 'safe');
}
