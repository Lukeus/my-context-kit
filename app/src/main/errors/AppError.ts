/**
 * Base application error class with support for error codes and user messages
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly userMessage: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      userMessage: this.userMessage,
      details: this.details,
      stack: process.env.NODE_ENV === 'development' ? this.stack : undefined
    };
  }
}

/**
 * Error for validation failures
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(
      message,
      'VALIDATION_ERROR',
      'The data you provided is invalid. Please check your input and try again.',
      details
    );
  }
}

/**
 * Error for pipeline execution failures
 */
export class PipelineError extends AppError {
  constructor(message: string, pipeline: string, details?: Record<string, unknown>) {
    super(
      message,
      'PIPELINE_ERROR',
      `Failed to execute ${pipeline} pipeline. Please check the pipeline configuration.`,
      details ? { pipeline, ...details } : { pipeline }
    );
  }
}

/**
 * Error for Git operations
 */
export class GitError extends AppError {
  constructor(message: string, operation: string, details?: Record<string, unknown>) {
    super(
      message,
      'GIT_ERROR',
      `Git ${operation} operation failed. Please check your repository state.`,
      details ? { operation, ...details } : { operation }
    );
  }
}

/**
 * Error for file system operations
 */
export class FileSystemError extends AppError {
  constructor(message: string, filePath: string, details?: Record<string, unknown>) {
    super(
      message,
      'FILESYSTEM_ERROR',
      'File system operation failed. Please check file permissions and paths.',
      details ? { filePath, ...details } : { filePath }
    );
  }
}

/**
 * Error for AI operations
 */
export class AIError extends AppError {
  constructor(message: string, provider: string, details?: Record<string, unknown>) {
    super(
      message,
      'AI_ERROR',
      `AI operation failed with ${provider}. Please check your configuration and connectivity.`,
      details ? { provider, ...details } : { provider }
    );
  }
}

/**
 * Error for configuration issues
 */
export class ConfigurationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(
      message,
      'CONFIGURATION_ERROR',
      'Configuration error detected. Please check your settings.',
      details
    );
  }
}

/**
 * Error for repository registry operations
 */
export class RepositoryError extends AppError {
  constructor(message: string, details?: unknown) {
    super(
      message,
      'REPOSITORY_ERROR',
      'Repository operation failed. Please verify the repository path and permissions.',
      details
    );
  }
}
