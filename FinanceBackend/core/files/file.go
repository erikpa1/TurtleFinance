package files

import (
	"path/filepath"
	"strings"
)

func ExtractExtensionNoDot(filename string) string {
	ext := filepath.Ext(filename)
	if ext != "" {
		return strings.TrimPrefix(ext, ".")
	}
	return ""
}
