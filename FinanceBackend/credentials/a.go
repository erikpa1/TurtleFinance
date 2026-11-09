package credentials

import (
	"flag"
	"io"
	"os"
	"strconv"
	"sync"
)

var APP_NAME = "FIN"

var APP_NAME_SMALL = "fin"

// ParseArguments parses command-line arguments with a private FlagSet so
// unknown flags (e.g. -test.* under `go test`) do not abort the process.
func ParseArguments() map[string]string {
	fs := flag.NewFlagSet("turtle", flag.ContinueOnError)
	fs.SetOutput(io.Discard)

	dbName := fs.String("db-name", "-x-", "Database name")
	dbConnStr := fs.String("db-conn-str", "-x-", "Database connection string")
	ipAddress := fs.String("ip-address", "-x-", "IP address")
	port := fs.String("port", "-x-", "Port number")

	_ = fs.Parse(os.Args[1:])

	return map[string]string{
		"db_name":     *dbName,
		"db_conn_str": *dbConnStr,
		"ip_address":  *ipAddress,
		"port":        *port,
	}
}

var arguments map[string]string
var argumentsOnce sync.Once

func args() map[string]string {
	argumentsOnce.Do(func() { arguments = ParseArguments() })
	return arguments
}

// GetValue retrieves a value from the arguments map, returns "" if not found or empty
func GetValue(args map[string]string, key string) string {
	if val, ok := args[key]; ok && val != "-x-" {
		return val
	}
	return ""
}

func GetEnvOrDefault(key string, defaultValue string) string {
	var value = os.Getenv(key)

	if value == "" {
		return defaultValue
	}

	return value
}

// GetParamFromEnvOrArg retrieves a value from arguments, then environment, then default
func GetParamFromEnvOrArg(envName, defaultValue, argValue string) string {
	if argValue != "" {
		return argValue
	}
	if envValue, ok := os.LookupEnv(envName); ok {
		return envValue
	}
	return defaultValue
}

// Database-related configuration
const (
	TWIN_DB_NAME             = "TURTLE_DB_NAME"
	TWIN_DB_NAME_VAL_DEFAULT = "turtle_finance"
)

// GetDBName returns the database name
func GetDBName() string {
	return GetParamFromEnvOrArg(TWIN_DB_NAME, TWIN_DB_NAME_VAL_DEFAULT, GetValue(args(), "db_name"))
}

// GetDBConnStr returns the database connection string
func GetDBConnStr() string {
	return GetParamFromEnvOrArg("TURTLE_DB_CONN_STRING", "mongodb://localhost:27017/", GetValue(args(), "db_conn_str"))
}

// GetIpAddress returns the IP address the HTTP server binds to
func GetIpAddress() string {
	return GetParamFromEnvOrArg("TURTLE_IP", "0.0.0.0", GetValue(args(), "ip_address"))
}

// GetPort returns the HTTP port (8095 so it can run next to TurtleIntelligence on 8080)
func GetPort() int {
	portStr := GetParamFromEnvOrArg("TURTLE_PORT", "8095", GetValue(args(), "port"))
	port, err := strconv.Atoi(portStr)
	if err != nil {
		return 8095
	}
	return port
}

// OllamaHost is the default Ollama endpoint; per-org settings may override it.
func OllamaHost() string {
	return GetEnvOrDefault("TURTLE_OLLAMA_HOST", "http://localhost:11434")
}

// OllamaDefaultModel is used when neither the request nor the org settings name a model.
func OllamaDefaultModel() string {
	return GetEnvOrDefault("TURTLE_OLLAMA_MODEL", "llama3.1:8b")
}

// Authentication-related configuration
const (
	AUTH_PROVIDER_NONE = ""
)

// AuthProvider returns the authentication provider. Finance currently runs as
// a single-user local tool (provider "none"), same as the Intelligence default.
func AuthProvider() string {
	return os.Getenv("TURTLE_AUTH_PROVIDER")
}
