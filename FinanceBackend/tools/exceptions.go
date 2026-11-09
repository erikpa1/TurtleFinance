package tools

import (
	"runtime/debug"
	"turtle/core/lgr"
)

// Recover is deferred at the top of goroutines so a panic in a background job
// is logged instead of crashing the whole server.
func Recover(message string, onErr ...func(any)) {
	if r := recover(); r != nil {
		lgr.ErrorStack("%s: %v", message, r)
		debug.PrintStack()

		for _, receiver := range onErr {
			receiver(r)
		}
	}
}
