/**
 * useStatusColors Composable
 * 
 * Provides consistent, token-driven color classes for status indicators
 * and severity levels throughout the application.
 * 
 * Usage:
 * ```vue
 * <script setup>
 * import { useStatusColors } from '@/composables/useStatusColors';
 * 
 * const { getStatusClasses, getSeverityClasses } = useStatusColors();
 * </script>
 * 
 * <template>
 *   <span :class="getStatusClasses(entity.status)">
 *     {{ entity.status }}
 *   </span>
 * </template>
 * ```
 */

export function useStatusColors() {
  /**
   * Get token-driven classes for entity/task status indicators
   * 
   * @param status - Status string (proposed, in-progress, done, etc.)
   * @returns Tailwind classes for background, text, and border
   */
  const getStatusClasses = (status?: string): string => {
    if (!status) return 'bg-secondary-100 text-secondary-700 border-secondary-300';
    
    const statusMap: Record<string, string> = {
      'proposed': 'bg-info-100 text-info-800 border-info-300',
      'in-progress': 'bg-warning-100 text-warning-800 border-warning-300',
      'doing': 'bg-warning-100 text-warning-800 border-warning-300',
      'done': 'bg-success-100 text-success-800 border-success-300',
      'blocked': 'bg-error-100 text-error-800 border-error-300',
      'needs-review': 'bg-warning-200 text-warning-900 border-warning-400',
      'todo': 'bg-secondary-100 text-secondary-800 border-secondary-300',
    };
    
    return statusMap[status] || 'bg-secondary-100 text-secondary-700 border-secondary-300';
  };
  
  /**
   * Get token-driven classes for issue/message severity levels
   * 
   * @param severity - Severity level (error, warning, info, success)
   * @returns Tailwind classes for background, text, and border
   */
  const getSeverityClasses = (severity?: string): string => {
    const severityMap: Record<string, string> = {
      'error': 'bg-error-50 text-error-700 border-error-300',
      'warning': 'bg-warning-50 text-warning-700 border-warning-300',
      'info': 'bg-info-50 text-info-700 border-info-300',
      'success': 'bg-success-50 text-success-700 border-success-300',
    };
    
    return severityMap[severity || 'info'] || 'bg-info-50 text-info-700 border-info-300';
  };
  
  /**
   * Get token-driven classes for status dots/indicators (without text)
   * 
   * @param status - Status string
   * @returns Tailwind classes for background color only
   */
  const getStatusDotClasses = (status?: string): string => {
    if (!status) return 'bg-secondary-400';
    
    const dotMap: Record<string, string> = {
      'proposed': 'bg-info-500',
      'in-progress': 'bg-warning-500',
      'doing': 'bg-warning-500',
      'done': 'bg-success-500',
      'blocked': 'bg-error-500',
      'needs-review': 'bg-warning-600',
      'todo': 'bg-secondary-400',
    };
    
    return dotMap[status] || 'bg-secondary-400';
  };
  
  /**
   * Get severity icon for visual representation
   * 
   * @param severity - Severity level
   * @returns Emoji icon
   */
  const getSeverityIcon = (severity?: string): string => {
    const iconMap: Record<string, string> = {
      'error': '⚠️',
      'warning': '⚡',
      'info': 'ℹ️',
      'success': '✓',
    };
    
    return iconMap[severity || 'info'] || 'ℹ️';
  };
  
  /**
   * Get complexity level classes (for agent cards, etc.)
   * 
   * @param complexity - Complexity level (basic, intermediate, advanced)
   * @returns Tailwind classes for background and text
   */
  const getComplexityClasses = (complexity?: string): string => {
    const complexityMap: Record<string, string> = {
      'basic': 'bg-success-100 text-success-700',
      'intermediate': 'bg-warning-100 text-warning-700',
      'advanced': 'bg-error-100 text-error-700',
    };
    
    return complexityMap[complexity || 'basic'] || 'bg-secondary-100 text-secondary-700';
  };
  
  /**
   * Get file change status classes (for Git panel)
   * 
   * @param status - Git file status (M, A, D, R, ?)
   * @returns Tailwind classes for text and background
   */
  const getFileStatusClasses = (status: string): string => {
    const fileStatusMap: Record<string, string> = {
      'M': 'text-warning-600 bg-warning-100',  // Modified
      'A': 'text-success-600 bg-success-100',  // Added
      'D': 'text-error-600 bg-error-100',      // Deleted
      'R': 'text-info-600 bg-info-100',        // Renamed
      '?': 'text-secondary-600 bg-secondary-100', // Untracked
    };
    
    return fileStatusMap[status] || 'text-secondary-600 bg-secondary-100';
  };
  
  return {
    getStatusClasses,
    getSeverityClasses,
    getStatusDotClasses,
    getSeverityIcon,
    getComplexityClasses,
    getFileStatusClasses,
  };
}
