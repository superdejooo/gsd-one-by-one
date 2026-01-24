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
 * - JS object notation (key: value patterns)
 * - Closing braces/brackets
 *
 * @param {string} output - Raw CCR command output
 * @returns {string} Cleaned output with debug logs removed
 */
export function stripCcrLogs(output) {
  const lines = output.split("\n");
  const cleanLines = lines.filter((line) => {
    // Skip CCR log lines
    if (/^\[log_[a-f0-9]+\]/.test(line)) return false;
    if (/^response \d+ http:/.test(line)) return false;
    if (/ReadableStream \{/.test(line)) return false;
    if (/durationMs:/.test(line)) return false;
    if (/AbortController|AbortSignal|AsyncGeneratorFunction/.test(line))
      return false;
    // Skip JS object notation (key: value patterns from debug output)
    if (/^\s*\w+:\s*(undefined|true|false|\[|{|'|")/.test(line)) return false;
    if (/^\s*'?[-\w]+(-\w+)*'?:\s*/.test(line)) return false; // any key: value
    if (/^\s*[}\]],?\s*$/.test(line)) return false; // closing braces
    if (/^\s*\w+:\s+\w+\s*\{/.test(line)) return false; // body: Fj {
    return true;
  });
  return cleanLines.join("\n").trim();
}
