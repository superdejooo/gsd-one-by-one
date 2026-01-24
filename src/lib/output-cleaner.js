/**
 * Strip CCR debug logs from command output.
 *
 * CCR writes debug logs to STDOUT (not STDERR), polluting agent output.
 * This function filters out:
 * - Lines starting with `[log_xxx]`
 * - Lines starting with `response NNN http:`
 * - Lines containing `ReadableStream {`
 * - Lines containing `durationMs:`
 * - Lines containing `AbortController|AbortSignal|AsyncGeneratorFunction`
 * - JS object notation (indented key: value patterns inside objects)
 * - Closing braces/brackets
 *
 * @param {string} output - Raw CCR command output
 * @returns {string} Cleaned output with debug logs removed
 */
export function stripCcrLogs(output) {
  const lines = output.split("\n");
  const cleanLines = lines.filter((line) => {
    // Skip CCR log lines that start with log markers
    if (/^\[log_[a-f0-9]+\]/.test(line)) return false;
    if (/^response \d+ http:/.test(line)) return false;
    if (/ReadableStream \{/.test(line)) return false;
    if (/durationMs:/.test(line)) return false;
    if (/AbortController|AbortSignal|AsyncGeneratorFunction/.test(line))
      return false;
    // Skip indented JS object notation (key: value patterns from debug output)
    // These patterns require leading whitespace to distinguish from normal text
    if (/^\s{2,}\w+:\s*(undefined|true|false|\[|{|'|")/.test(line)) return false;
    // Skip indented key: value patterns (requires 2+ spaces indent)
    if (/^\s{2,}'?[-\w]+(-\w+)*'?:\s*/.test(line)) return false;
    // Skip lines that are just closing braces/brackets (with optional comma)
    if (/^\s*[}\]],?\s*$/.test(line)) return false;
    // Skip object constructor patterns like "body: Fj {"
    if (/^\s{2,}\w+:\s+\w+\s*\{/.test(line)) return false;
    return true;
  });
  return cleanLines.join("\n").trim();
}

/**
 * Extract a meaningful error message from CCR output files.
 *
 * When CCR fails, the stdout file often contains only debug logs.
 * This function tries multiple sources to find a useful error message:
 * 1. Cleaned stdout output (if any meaningful content remains)
 * 2. Stderr/debug file (may contain actual error messages)
 * 3. CCR log file (contains warnings like "No content in stream response")
 *
 * @param {string} stdoutContent - Raw stdout content
 * @param {string} stderrContent - Raw stderr/debug file content
 * @param {string} ccrLogContent - Raw ccr.log content
 * @returns {string} Best available error message
 */
export function extractErrorMessage(stdoutContent, stderrContent = "", ccrLogContent = "") {
  // First try cleaned stdout - but only if there's actual content after stripping
  const cleanedOutput = stripCcrLogs(stdoutContent);
  // Check if cleaned output has meaningful content (more than just whitespace/short noise)
  // Use a low threshold since even short error messages like "Error: x" are useful
  if (cleanedOutput && cleanedOutput.trim().length > 0) {
    return cleanedOutput.substring(0, 500);
  }

  // Check for known CCR error patterns in ccr.log
  if (ccrLogContent) {
    // Look for warning messages
    const warningMatch = ccrLogContent.match(/Warning:\s*(.+)/i);
    if (warningMatch) {
      return `CCR Error: ${warningMatch[1]}`;
    }
    // Look for error messages
    const errorMatch = ccrLogContent.match(/Error:\s*(.+)/i);
    if (errorMatch) {
      return `CCR Error: ${errorMatch[1]}`;
    }
  }

  // Check stderr for meaningful errors
  if (stderrContent) {
    const cleanedStderr = stripCcrLogs(stderrContent);
    if (cleanedStderr && cleanedStderr.trim().length > 0) {
      return cleanedStderr.substring(0, 500);
    }
  }

  // Fallback message
  return "Command execution failed with no output. Check workflow artifacts for ccr.log details.";
}
