import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolDescriptor } from '@shared/assistant/types';

/**
 * Convert our ToolDescriptor format to LangChain's DynamicStructuredTool format.
 * 
 * This enables LangChain models to autonomously invoke tools via function calling.
 * The actual execution still happens via ToolOrchestrator for consistency.
 * 
 * @param tools - Array of ToolDescriptor objects to convert
 * @param executor - Function to execute tool calls (typically orchestrator.executeTool)
 * @returns Array of LangChain DynamicStructuredTool instances
 */
export function convertToLangChainTools(
  tools: ToolDescriptor[],
  executor: (toolId: string, parameters: Record<string, unknown>) => Promise<Record<string, unknown>>
): DynamicStructuredTool[] {
  return tools.map((tool) => {
    const schema = buildZodSchemaFromJsonSchema(tool.inputSchema);
    
    return new DynamicStructuredTool({
      name: tool.id.replace(/\./g, '_'), // LangChain requires snake_case
      description: tool.description,
      schema,
      func: async (input: Record<string, unknown>) => {
        const result = await executor(tool.id, input);
        return JSON.stringify(result);
      }
    });
  });
}

/**
 * Convert JSON Schema to Zod schema for LangChain validation.
 * Supports basic types - extend as needed for complex schemas.
 */
function buildZodSchemaFromJsonSchema(jsonSchema: Record<string, unknown>): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const properties = jsonSchema.properties as Record<string, Record<string, unknown>> | undefined;
  const required = (jsonSchema.required as string[]) || [];
  
  if (!properties) {
    // Empty schema if no properties defined
    return z.object({});
  }
  
  const zodFields: Record<string, z.ZodTypeAny> = {};
  
  for (const [key, prop] of Object.entries(properties)) {
    const type = prop.type as string;
    const description = prop.description as string | undefined;
    const isRequired = required.includes(key);
    
    let fieldSchema: z.ZodTypeAny;
    
    switch (type) {
      case 'string':
        fieldSchema = z.string();
        if (description) {
          fieldSchema = fieldSchema.describe(description);
        }
        if (prop.minLength) {
          fieldSchema = (fieldSchema as z.ZodString).min(prop.minLength as number);
        }
        if (prop.maxLength) {
          fieldSchema = (fieldSchema as z.ZodString).max(prop.maxLength as number);
        }
        if (prop.pattern) {
          fieldSchema = (fieldSchema as z.ZodString).regex(new RegExp(prop.pattern as string));
        }
        break;
        
      case 'number':
        fieldSchema = z.number();
        if (description) {
          fieldSchema = fieldSchema.describe(description);
        }
        if (prop.minimum !== undefined) {
          fieldSchema = (fieldSchema as z.ZodNumber).min(prop.minimum as number);
        }
        if (prop.maximum !== undefined) {
          fieldSchema = (fieldSchema as z.ZodNumber).max(prop.maximum as number);
        }
        if (prop.default !== undefined) {
          fieldSchema = (fieldSchema as z.ZodNumber).default(prop.default as number);
        }
        break;
        
      case 'boolean':
        fieldSchema = z.boolean();
        if (description) {
          fieldSchema = fieldSchema.describe(description);
        }
        break;
        
      case 'array':
        // Simplified array handling - just allow any array
        fieldSchema = z.array(z.unknown());
        if (description) {
          fieldSchema = fieldSchema.describe(description);
        }
        break;
        
      case 'object':
        // Simplified object handling - allow any object
        fieldSchema = z.record(z.string(), z.unknown());
        if (description) {
          fieldSchema = fieldSchema.describe(description);
        }
        break;
        
      default:
        // Fallback for unknown types
        fieldSchema = z.unknown();
    }
    
    // Make optional if not required
    if (!isRequired) {
      fieldSchema = fieldSchema.optional();
    }
    
    zodFields[key] = fieldSchema;
  }
  
  return z.object(zodFields) as z.ZodObject<Record<string, z.ZodTypeAny>>;
}
