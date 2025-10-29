# Agent Profile Integration - Complete

## Summary

The selected agent from the `AgentSelector` component is now fully integrated into the assistant session creation flow. When users run pipelines or read context files, the system automatically uses the currently selected agent profile.

## Integration Flow

```
User interaction → AgentSelector → agentStore → assistantStore → Session creation
```

### Detailed Flow

1. **User Selection**
   - User selects an agent via the `AgentSelector` dropdown component
   - Component calls `agentStore.selectAgent(agentId)`

2. **Agent Store Update**
   - `agentStore.selectedAgentId` is set to the chosen agent ID
   - `agentStore.selectedAgent` computed property returns the full `AgentProfile`

3. **Session Creation**
   - When `runPipeline()` or `readContextFile()` is called:
     - The method reads `selectedAgent` from `agentStore` using `storeToRefs`
     - Agent profile is passed to `ensurePipelineSession(provider, agent)`
   
4. **Agent Application**
   - `ensurePipelineSession()` checks if a session exists with the same agent
   - If not, creates a new session via `createSession(payload, agent)`
   - `applyAgentProfile()` merges agent configuration into the session:
     - System prompt from agent
     - Required tools from agent
     - Temperature, maxTokens, and other config overrides

5. **Session Active**
   - `activeAgentProfile` stores the current agent profile
   - All subsequent operations in the session use this agent's configuration

## Key Files Modified

### `assistantStore.ts`
- **Imports**: Added `storeToRefs` and `useAgentStore`
- **Store initialization**: Gets `selectedAgent` ref from `agentStore`
- **`runPipeline()`**: Reads selected agent and passes to `ensurePipelineSession()`
- **`readContextFile()`**: Reads selected agent and passes to `ensurePipelineSession()`

## Components Involved

- **`AgentSelector.vue`**: UI for selecting agents
- **`ToolPanel.vue`**: Renders `AgentSelector` and executes pipelines
- **`agentStore.ts`**: Manages agent profiles and selection state
- **`assistantStore.ts`**: Creates sessions with selected agent configuration

## Agent Profile Application

When an agent is applied to a session:

```typescript
{
  systemPrompt: agent.systemPrompt || defaultPrompt,
  activeTools: agent.tools.filter(t => t.required).map(t => t.toolId),
  temperature: agent.config?.temperature,
  maxTokens: agent.config?.maxTokens,
  enableLogprobs: agent.config?.enableLogprobs
}
```

## Testing Verification

To verify the integration:

1. Open ToolPanel UI
2. Select different agents from the AgentSelector dropdown
3. Run a pipeline or read a context file
4. Verify the session is created with the selected agent's configuration
5. Check that the agent's system prompt and tools are active in the session

## Future Enhancements

- Add visual indicator showing which agent is active in the current session
- Allow agent switching mid-session (create new session with new agent)
- Display agent metadata in the conversation UI
- Add agent-specific UI customizations based on agent.metadata.tags
