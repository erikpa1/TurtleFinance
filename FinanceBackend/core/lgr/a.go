package lgr

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

// ANSI color codes
const (
	ColorReset  = "\033[0m"
	ColorRed    = "\033[31m"
	ColorGreen  = "\033[32m"
	ColorNormal = "\033[0m"
	ColorYellow = "\033[33m"
)

var (
	useColors    bool
	outputs      []io.Writer
	mu           sync.Mutex
	logToConsole bool
)

func init() {
	useColors = true
	logToConsole = true
	outputs = []io.Writer{os.Stdout}
}

// SetColors enables or disables colored output
func SetColors(enable bool) {
	mu.Lock()
	defer mu.Unlock()
	useColors = enable
}

// SetOutput changes the output destination
// This replaces all outputs with the provided writer
func SetOutput(writer io.Writer) {
	mu.Lock()
	defer mu.Unlock()
	outputs = []io.Writer{writer}
}

// SetOutputFolder sets output to a file
// If append is true, it appends to existing file, otherwise truncates
// If logToConsole is true, logs to both file and console
func SetOutputFolder(folderPath string, appName string, append bool) error {
	flags := os.O_CREATE | os.O_WRONLY
	if append {
		flags |= os.O_APPEND
	} else {
		flags |= os.O_TRUNC
	}

	// Setup lgr logger to write to file
	// Setup lgr logger to write to file
	logFilePath := filepath.Join(folderPath, fmt.Sprintf("%s_%s.log", appName, time.Now().Format("2006-01-02_15-04-05")))

	if err := os.MkdirAll(folderPath, 0755); err != nil {
		Error("failed to create success folder: %s", err.Error())
	}

	file, err := os.OpenFile(logFilePath, flags, 0644)
	if err != nil {
		return fmt.Errorf("failed to open log file: %w", err)
	}

	mu.Lock()
	defer mu.Unlock()

	if logToConsole {
		outputs = []io.Writer{os.Stdout, file}
	} else {
		outputs = []io.Writer{file}
	}

	return nil
}

// SetLogToConsole enables or disables console logging
// When true, logs will be written to both console and file (if file is set)
// When false, logs will only be written to file (if file is set)
func SetLogToConsole(enable bool) {
	mu.Lock()
	defer mu.Unlock()
	logToConsole = enable
}

// AddOutput adds an additional output writer
// This allows logging to multiple destinations simultaneously
func AddOutput(writer io.Writer) {
	mu.Lock()
	defer mu.Unlock()
	outputs = append(outputs, writer)
}

// Close closes all file outputs
func Close() error {
	mu.Lock()
	defer mu.Unlock()

	var lastErr error
	for _, out := range outputs {
		if file, ok := out.(*os.File); ok && file != os.Stdout && file != os.Stderr {
			if err := file.Close(); err != nil {
				lastErr = err
			}
		}
	}
	return lastErr
}

// getCallerInfo returns the file and line number of the caller
func getCallerInfo(skip int) (string, int) {
	_, file, line, ok := runtime.Caller(skip)
	if !ok {
		return "unknown", 0
	}
	return file, line
}

// getStackTrace returns stack trace information
func getStackTrace(skip, maxDepth int) []string {
	var stack []string

	// Get available stack frames
	pcs := make([]uintptr, maxDepth+skip)
	n := runtime.Callers(skip, pcs)

	if n == 0 {
		return stack
	}

	frames := runtime.CallersFrames(pcs[:n])
	count := 0

	for count < maxDepth {
		frame, more := frames.Next()
		if !more {
			break
		}
		stack = append(stack, fmt.Sprintf("  %s:%d in %s", frame.File, frame.Line, frame.Function))
		count++
		if !more {
			break
		}
	}

	return stack
}

// projectName is auto-detected from the working directory at startup.
var projectName = detectProjectName()

func detectProjectName() string {
	wd, err := os.Getwd()
	if err != nil {
		return ""
	}
	return filepath.Base(wd)
}

// trimPath shortens the file path to be relative to the project root,
// making it clickable in IDE consoles.
func trimPath(file string) string {
	if projectName == "" {
		return file
	}
	if idx := strings.Index(file, projectName); idx != -1 {
		// Skip past "projectName/" to get a path relative to the working dir
		return file[idx+len(projectName)+1:]
	}
	return file
}

// log is the internal logging function
func log(logType, color, format string, args ...interface{}) {
	file, line := getCallerInfo(3)
	file = trimPath(file)
	message := fmt.Sprintf(format, args...)

	mu.Lock()
	defer mu.Unlock()

	for _, out := range outputs {
		// Only use colors for console outputs (stdout/stderr)
		shouldColor := useColors && (out == os.Stdout || out == os.Stderr)

		if shouldColor {
			fmt.Fprintf(out, "%s%s:%d [%s]: %s%s\n", color, file, line, logType, message, ColorReset)
		} else {
			fmt.Fprintf(out, "%s:%d [%s]: %s\n", file, line, logType, message)
		}
	}
}

// Info logs a message in normal color
func Info(format string, args ...interface{}) {
	log("INFO", ColorNormal, format, args...)
}

func InfoJson(data interface{}) {
	jsonBytes, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		Error("Error marshaling JSON: %v", err)
		return
	}
	log("INFO", ColorNormal, "\n%s", string(jsonBytes))
}

// Error logs a message in red color
func Error(format string, args ...interface{}) {
	log("ERROR", ColorRed, format, args...)
}

// Ok logs a message in green color
func Ok(format string, args ...interface{}) {
	log("OK", ColorGreen, format, args...)
}

func ErrorJson(data interface{}) {
	jsonBytes, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		ErrorStack("Error marshaling JSON: %v", err)
		Error("%v", data)
		return
	}
	log("ERROR", ColorRed, "\n%s", string(jsonBytes))
}

func OkJson(data interface{}) {
	jsonBytes, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		Error("Error marshaling JSON: %v", err)
		return
	}
	log("ERROR", ColorGreen, "\n%s", string(jsonBytes))
}

// ErrorStack logs an error message with stack trace
// It will log up to maxDepth stack frames (default 5)
// If the actual stack is shorter, it logs only what's available
func ErrorStack(format string, args ...interface{}) {
	ErrorStackDepth(5, format, args...)
}

// ErrorStackDepth logs an error message with stack trace up to specified depth
func ErrorStackDepth(maxDepth int, format string, args ...interface{}) {
	file, line := getCallerInfo(2)
	message := fmt.Sprintf(format, args...)

	mu.Lock()
	defer mu.Unlock()

	for _, out := range outputs {
		shouldColor := useColors && (out == os.Stdout || out == os.Stderr)

		// Log the error message
		if shouldColor {
			fmt.Fprintf(out, "%s%s:%d [ERROR]: %s%s\n", ColorRed, file, line, message, ColorReset)
		} else {
			fmt.Fprintf(out, "%s:%d [ERROR]: %s\n", file, line, message)
		}

		// Get and log stack trace
		stack := getStackTrace(3, maxDepth)

		if len(stack) > 0 {
			if shouldColor {
				fmt.Fprintf(out, "%sStack trace:%s\n", ColorYellow, ColorReset)
				for _, frame := range stack {
					fmt.Fprintf(out, "%s%s%s\n", ColorYellow, frame, ColorReset)
				}
			} else {
				fmt.Fprintf(out, "Stack trace:\n")
				for _, frame := range stack {
					fmt.Fprintf(out, "%s\n", frame)
				}
			}
		}
	}
}
